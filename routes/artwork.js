import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js'; // Re-add createClient import
import supabase from '../config/supabase.js'; // Import the shared client (for user context)
import { authenticateUser } from '../middleware/auth.js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const router = express.Router();

// Ensure Service Role Key is available
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("FATAL ERROR: SUPABASE_SERVICE_ROLE_KEY is not set in environment variables.");
    // Optionally throw an error or exit, as the finish auction endpoint will fail without it.
    // throw new Error("SUPABASE_SERVICE_ROLE_KEY is required."); 
}
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    }
});

// Get user's artworks (both owned and purchased)
router.get('/my-artworks', authenticateUser, async (req, res) => {
    try {
        // First get owned artworks
        const { data: ownedArtworks, error: ownedError } = await req.supabase
            .from('artworks')
            .select(`
                *,
                categories (name),
                users (full_name),
                favorites!left(count)
            `)
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (ownedError) throw ownedError;

        // Then get purchased artworks (where user is the current owner)
        const { data: purchasedArtworks, error: purchasedError } = await req.supabase
            .from('artworks')
            .select(`
                *,
                categories (name),
                users (full_name),
                favorites!left(count)
            `)
            .neq('user_id', req.user.id) // Not owned by the user
            .in('id', (await req.supabase
                .from('artwork_transactions')
                .select('artwork_id')
                .eq('buyer_id', req.user.id)
            ).data?.map(t => t.artwork_id)
            )
            .order('created_at', { ascending: false });

        if (purchasedError) throw purchasedError;

        // Combine both owned and purchased artworks
        const allArtworks = [...ownedArtworks, ...purchasedArtworks];

        const userIds = allArtworks.map(artwork => artwork.user_id);
        // Try to get user countries if available
        let usersData = [];
        try {
            const { data, error } = await req.supabase
                .from('users')
                .select('id, location')
                .in('id', userIds);
            
            if (!error) {
                usersData = data || [];
            }
        } catch (error) {
            console.error('Error fetching user countries:', error);
        }

        const artworksWithDetails = allArtworks.map(artwork => {
            const user = usersData.find(user => user.id === artwork.user_id);
            return {
                ...artwork,
                description: artwork.description || 'No description provided',
                views: artwork.views || 0,
                category: artwork.categories?.name || 'Oil Painting',
                favorites: artwork.favorites[0]?.count || 0,
                artist_name: artwork.users?.full_name || 'Unknown Artist',
                artist_country: user?.location || 'Unknown Location',
                isOwned: artwork.user_id === req.user.id
            };
        });

        res.json({ success: true, artworks: artworksWithDetails });
    } catch (error) {
        console.error('Error fetching artworks:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});



// Upload artwork
router.post('/upload', authenticateUser, upload.single('artwork'), async (req, res) => {
    try {
        console.log('Starting artwork upload process...');
        
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        console.log('File received:', {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
        });

        // Generate unique filename
        const fileExt = req.file.originalname.split('.').pop();
        const fileName = `${uuidv4()}.${fileExt}`;
        const filePath = `${req.user.id}/${fileName}`;

        console.log('Uploading to Supabase storage:', filePath);

        // Upload file directly to storage
        const { data: uploadData, error: uploadError } = await req.supabase
            .storage
            .from('artworks')
            .upload(filePath, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: false
            });

        if (uploadError) {
            console.error('Storage upload error:', uploadError);
            throw uploadError;
        }

        // Get public URL
        const { data: { publicUrl } } = req.supabase
            .storage
            .from('artworks')
            .getPublicUrl(filePath);

        // Validate and get category_id
        let validatedCategoryId = null;
        if (req.body.category) {
            console.log('Looking up category:', req.body.category);
            
            // First try exact match
            const { data: exactCategory, error: exactError } = await req.supabase
                .from('categories')
                .select('id, name')
                .eq('name', req.body.category)
                .single();
                
            if (!exactError && exactCategory) {
                console.log('Found exact category match:', exactCategory);
                validatedCategoryId = exactCategory.id;
            } else {
                // If no exact match, try case-insensitive match
                const { data: categoryData, error: categoryError } = await req.supabase
                    .from('categories')
                    .select('id, name')
                    .ilike('name', req.body.category)
                    .single();
                    
                if (!categoryError && categoryData) {
                    console.log('Found case-insensitive match:', categoryData);
                    validatedCategoryId = categoryData.id;
                } else {
                    console.error('Category lookup error:', categoryError);
                    // Default to 'Oil Painting' if category not found
                    const { data: defaultCategory } = await req.supabase
                        .from('categories')
                        .select('id')
                        .eq('name', 'Oil Painting')
                        .single();
                    
                    if (defaultCategory) {
                        console.log('Using default category: Oil Painting');
                        validatedCategoryId = defaultCategory.id;
                    } else {
                        throw new Error('Failed to find category and default category');
                    }
                }
            }
        } else {
            throw new Error('Category is required');
        }

        // Prepare artwork payload
        const artworkPayload = {
            user_id: req.user.id,
            title: req.body.title || req.file.originalname,
            description: req.body.description || '',
            category_id: validatedCategoryId,
            image_url: publicUrl,
            storage_path: filePath,
            price: req.body.price ? parseFloat(req.body.price) : null
        };

        // Save artwork details to database
        const { data: artworkData, error: dbError } = await req.supabase
            .from('artworks')
            .insert([artworkPayload])
            .select(`
                *,
                categories (
                    name
                )
            `)
            .single();

        if (dbError) {
            console.error('Database error:', dbError);
            throw dbError;
        }

        // Create auction if requested
        if (req.body.isForAuction === 'on') {
            const auctionPayload = {
                artwork_id: artworkData.id,
                starting_bid: req.body.startingBid ? parseFloat(req.body.startingBid) : null,
                duration_days: req.body.auctionDuration ? parseInt(req.body.auctionDuration) : null,
                buy_now_price: req.body.buyNowPrice ? parseFloat(req.body.buyNowPrice) : null,
                end_time: new Date(Date.now() + (req.body.auctionDuration * 24 * 60 * 60 * 1000))
            };

            await req.supabase
                .from('auctions')
                .insert([auctionPayload]);
        }

        // Transform the response
        const transformedArtwork = {
            ...artworkData,
            category: artworkData.categories?.name || 'uncategorized'
        };

        console.log('Artwork saved successfully:', transformedArtwork);

        res.json({
            success: true,
            message: 'Artwork uploaded successfully',
            artwork: transformedArtwork
        });
    } catch (error) {
        console.error('Upload process error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            details: 'Failed to process upload'
        });
    }
});

// Get user's favorite artworks
router.get('/favorites', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await req.supabase
            .from('favorites')
            .select(`
                artwork_id,
                artworks (
                    *,
                    categories (name),
                    favorites!left(count)
                )
            `)
            .eq('user_id', req.user.id);

        if (error) throw error;

        // Transform data
        const favorites = data.map(fav => {
            const artwork = fav.artworks;
            return {
                id: fav.artwork_id,
                ...artwork,
                description: artwork.description || 'No description provided',
                views: artwork.views || 0,
                category: artwork.categories?.name || 'Oil Painting',
                favorites: artwork.favorites[0]?.count || 0
            };
        });

        res.json({ success: true, favorites });
    } catch (error) {
        console.error('Error fetching favorites:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== NEW AUCTION ENDPOINTS ==========

// Create auction for artwork
router.post('/:id/auction', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const { startingBid, durationDays, buyNowPrice } = req.body;

        // Verify artwork exists and belongs to user
        const { data: artwork, error: fetchError } = await req.supabase
            .from('artworks')
            .select('id, user_id')
            .eq('id', id)
            .eq('user_id', req.user.id)
            .single();

        if (fetchError || !artwork) {
            return res.status(404).json({
                success: false,
                error: 'Artwork not found or unauthorized'
            });
        }

        // Create auction
        const { data: auction, error } = await req.supabase
            .from('auctions')
            .insert([{
                artwork_id: id,
                starting_bid: startingBid,
                current_bid: startingBid,
                duration_days: durationDays,
                buy_now_price: buyNowPrice,
                end_time: new Date(Date.now() + (durationDays * 24 * 60 * 60 * 1000))
            }])
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            auction
        });
    } catch (error) {
        console.error('Error creating auction:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get artwork's auction details
router.get('/:id/auction', async (req, res) => {
    try {
        const { id } = req.params;

        const { data: auction, error } = await req.supabase
            .from('auctions')
            .select(`
                *,
                artworks (
                    *,
                    categories (name),
                    users (full_name),
                    favorites!left(count)
                )
            `)
            .eq('artwork_id', id)
            .single();

        if (error) throw error;

        if (!auction) {
            return res.json({
                success: true,
                auction: null
            });
        }

        res.json({
            success: true,
            auction
        });
    } catch (error) {
        console.error('Error fetching auction:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Handle bid placement
router.post('/:id/bid', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const { amount } = req.body;
        
        // Verify auction exists
        const { data: auction, error: fetchError } = await req.supabase
            .from('auctions')
            .select('*')
            .eq('artwork_id', id)
            .single();

        if (fetchError || !auction) {
            return res.status(404).json({
                success: false,
                error: 'Auction not found'
            });
        }

        // Check if auction has ended
        if (new Date(auction.end_time) < new Date()) {
            return res.status(400).json({
                success: false,
                error: 'This auction has ended'
            });
        }

        // Validate bid amount
        const bidAmount = parseFloat(amount);
        if (isNaN(bidAmount) || bidAmount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid bid amount'
            });
        }

        // Check if bid meets minimum
        if (bidAmount <= auction.current_bid) {
            return res.status(400).json({
                success: false,
                error: `Bid must be higher than current bid of $${auction.current_bid}`
            });
        }

        // Verify auction exists (again)
        const { data: existingAuction, error: fetchExistingError } = await req.supabase
            .from('auctions')
            .select('*')
            .eq('artwork_id', id)
            .single();

        if (fetchExistingError || !existingAuction) {
            return res.status(404).json({
                success: false,
                error: 'Auction not found'
            });
        }

        // Update the bid
        const { error: updateError } = await req.supabase
            .from('auctions')
            .update({ 
                current_bid: bidAmount,
                current_bidder: req.user.id,
                updated_at: new Date()
            })
            .eq('artwork_id', id);

        if (updateError) throw updateError;

        // Fetch the updated auction
        const { data: updatedAuction, error: fetchUpdatedError } = await req.supabase
            .from('auctions')
            .select('*')
            .eq('artwork_id', id)
            .single();

        if (fetchUpdatedError || !updatedAuction) {
            throw new Error('Failed to fetch updated auction data');
        }

            // Get updated artwork data including new bid
            const { data: artwork } = await req.supabase
                .from('artworks')
                .select(`
                    *,
                    auctions!left(current_bid)
                `)
                .eq('id', id)
                .single();

            res.json({
                success: true,
                message: 'Bid placed successfully',
                artworkId: id,
                currentBid: updatedAuction.current_bid,
                artwork: artwork
            });
    } catch (error) {
        console.error('Error placing bid:', error);
        res.status(500).json({ 
            success: false,
            error: error.message
        });
    }
});

// Get artworks by category name - NEW IMPLEMENTATION

// Marketplace endpoint - returns both regular artworks and auction items
router.get('/marketplace', async (req, res) => {
    // Removed the redundant supabase variable declaration and initialization
    try {
        // Use the imported shared supabase client directly

        // 1. Fetch all artworks with prices (potential regular artworks)
        const fetchAllArtworks = async () => {
            const { data, error } = await supabase
                .from('artworks')
                .select('id, title, description, image_url, price, created_at')
                .not('price', 'is', null)
                .order('created_at', { ascending: false });

            // Explicitly handle empty results without throwing error
            if (error || !data) {
                return [];
            }
            return data;
        };

        // 2. Fetch all active auctions with artwork data in single query
        const fetchActiveAuctions = async () => {
            const { data, error } = await supabase
                .from('auctions')
                .select(`
                    id, 
                    current_bid, 
                    starting_bid, 
                    end_time, 
                    artwork_id,
                    artworks(id, title, description, image_url)
                `)
                .gt('end_time', new Date().toISOString())
                .order('end_time', { ascending: true });

            // Explicitly handle empty results without throwing error
            if (error || !data) {
                return [];
            }

            // Process auctions with their artwork data
            return (data || []).map(auction => ({
                ...auction,
                type: 'auction',
                current_bid: parseFloat(auction.current_bid) || 0,
                starting_bid: parseFloat(auction.starting_bid) || 0,
                artwork: auction.artworks || {
                    id: auction.artwork_id,
                    title: 'Unknown Artwork',
                    description: '',
                    image_url: ''
                }
            }));
        };

        // Execute queries in parallel with default empty arrays
        const [allArtworks = [], auctions = []] = await Promise.all([
            fetchAllArtworks(),
            fetchActiveAuctions()
        ]);

        // Get IDs of auction artworks
        const auctionArtworkIds = new Set(auctions.map(a => a.artwork_id));

        // Filter regular artworks (those not in auctions)
        const regularArtworks = allArtworks
            .filter(artwork => !auctionArtworkIds.has(artwork.id))
            .map(item => ({
                ...item,
                type: 'regular',
                price: Number(item.price) || 0
            }));

        // Helper function to add placeholder images
        const withPlaceholder = (item) => ({
            ...item,
            image_url: item.image_url || `https://picsum.photos/id/${Math.floor(Math.random() * 1000)}/800/600`
        });

        // Process auctions with placeholders
        const processedAuctions = auctions.map(auction => withPlaceholder({
            ...auction,
            type: 'auction',
            current_bid: Number(auction.current_bid) || 0,
            starting_bid: Number(auction.starting_bid) || 0
        }));

        // Process regular artworks with placeholders
        const safeRegularArtworks = (regularArtworks || []).map(withPlaceholder);
        const safeAuctionItems = processedAuctions;

        res.json({
            success: true,
            data: {
                regularArtworks: safeRegularArtworks,
                auctionItems: safeAuctionItems
            },
            timestamp: new Date().toISOString(),
            stats: {
                regularCount: safeRegularArtworks.length,
                auctionCount: safeAuctionItems.length
            }
        });

    } catch (error) {
        console.error('Marketplace endpoint error:', error);
        
        // Handle "no rows" case specifically
        if (error.message.includes('JSON object requested, multiple (or no) rows returned')) {
            return res.json({
                success: true,
                data: {
                    regularArtworks: [],
                    auctionItems: []
                }
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to load marketplace data',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Contact support'
        });
    }
});

// Get all active auctions (public endpoint)
router.get('/active-auctions', async (req, res) => {
    try {
        // Removed the redundant createClient call here

        // Get all auctions that are still active (not ended)
        // Use the imported shared supabase client
        const { data: artworks, error } = await supabase
            .from('artworks')
            .select(`
                *,
                auctions!inner(
                    current_bid,
                    current_bidder,
                    end_time,
                    starting_bid,
                    buy_now_price,
                    status,
                    bids:bid_history(
                        amount,
                        created_at,
                        users(
                            full_name
                        )
                    )
                ),
                categories(name),
                users!artworks_user_id_fkey(
                    full_name
                )
            `)
            .or(`and(status.eq.active,end_time.gt.${new Date().toISOString()})`)
            .order('auctions.end_time', { ascending: true });

        if (error) throw error;

        res.json({ artworks });
    } catch (error) {
        console.error('Error fetching active auctions:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get current user's auction artworks
router.get('/my-auctions', authenticateUser, async (req, res) => {
    try {
        // Get owner's artworks that are in auctions with bidder details
        const { data: artworks, error } = await req.supabase
            .from('artworks')
            .select(`
                *,
                users!inner(id, full_name),
                categories(name),
                auctions!inner(
                    current_bid,
                    current_bidder,
                    end_time,
                    starting_bid,
                    buy_now_price,
                    status 
                )
            `)
            .eq('user_id', req.user.id) // Only artworks owned by this user
            // .not('auctions.artwork_id', 'is', null) // Redundant with inner join
            .eq('auctions.status', 'active') // <<< Only include artworks with ACTIVE auctions
            .order('created_at', { ascending: false });

        if (error) {
             console.error("Error fetching user's active auctions:", error);
             throw error;
        };

        // Get unique bidder IDs
        const bidderIds = [...new Set(
            artworks.flatMap(artwork => 
                artwork.auctions
                    .filter(auction => auction.current_bidder)
                    .map(auction => auction.current_bidder)
            )
        )];

        // Fetch bidder details in batch
        const { data: bidders } = bidderIds.length > 0 
            ? await req.supabase
                .from('users')
                .select('id, full_name')
                .in('id', bidderIds)
            : { data: [] };

        // Format response to exactly match frontend expectations
        const formattedArtworks = artworks.map(artwork => {
            const auction = artwork.auctions[0];
            const bidder = auction?.current_bidder 
                ? bidders?.find(b => b.id === auction.current_bidder)
                : null;
            
            return {
                id: artwork.id,
                title: artwork.title,
                description: artwork.description || '',
                image_url: artwork.image_url,
                current_bid: auction?.current_bid,
                current_bidder: bidder ? { 
                    full_name: bidder.full_name,
                    email: bidder.email || '' 
                } : null,
                auction_end: auction?.end_time,
                starting_bid: auction?.starting_bid,
                buy_now_price: auction?.buy_now_price,
                user_id: artwork.user_id,
                category: artwork.categories?.name || 'General'
            };
        });

        // Match frontend's destructuring pattern
        // Return minimal response that matches frontend destructuring
        console.log('Sending artworks:', formattedArtworks.length);
        res.json({ artworks: formattedArtworks });
    } catch (error) {
        console.error('Error fetching auctions:', error);
        res.status(500).json({ 
            error: error.message
        });
    }
});

// Finish auction endpoint - Handles ownership transfer (Using Service Role Key for Updates)
router.post('/auction/finish/:id', authenticateUser, async (req, res) => {
    try {
        const artworkId = req.params.id;
        const requestingUserId = req.user.id;

        // Use the user's authenticated client (req.supabase) for initial checks
        const userSupabase = req.supabase; 

        // 1. Fetch the auction details (using user context)
        const { data: auctionData, error: auctionFetchError } = await userSupabase
            .from('auctions')
            .select('*')
            .eq('artwork_id', artworkId)
            .single();

        if (auctionFetchError) {
            console.error('Error fetching auction data (user context):', auctionFetchError);
            throw new Error('Failed to fetch auction details.');
        }
        if (!auctionData) {
            return res.status(404).json({ success: false, error: 'Auction not found' });
        }

        // 2. Fetch the related artwork details (using user context)
        const { data: artworkData, error: artworkFetchError } = await userSupabase
            .from('artworks')
            .select('user_id')
            .eq('id', artworkId)
            .single();

        if (artworkFetchError) {
            console.error('Error fetching artwork data (user context):', artworkFetchError);
            throw new Error('Failed to fetch related artwork details.');
        }
        if (!artworkData) {
            console.error(`Artwork with ID ${artworkId} not found, but auction exists.`);
            throw new Error('Associated artwork not found.');
        }

        // 3. Verify the requesting user is the original owner
        const originalOwnerId = artworkData.user_id;
        if (originalOwnerId !== requestingUserId) {
            return res.status(403).json({ success: false, error: 'Unauthorized: Only the original owner can finalize the auction.' });
        }

        // 4. Check if auction has ended (or can be ended early)
        const now = new Date();
        const endTime = new Date(auctionData.end_time);
        const canFinalize = (now >= endTime) || (auctionData.status === 'active' && auctionData.current_bidder);
        
        if (!canFinalize && auctionData.status !== 'ended_early') {
             return res.status(400).json({ success: false, error: 'Auction cannot be finalized yet (not ended or no winning bid for early finalization).' });
        }

        // --- Use Service Role Key for Updates ---
        // Create a new client instance with the service role key to bypass RLS for updates
        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL, 
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            { auth: { persistSession: false } } // Important: prevent server-side session persistence
        );
        // -----------------------------------------

        // 5. Check if there's a winning bidder
        const winningBidderId = auctionData.current_bidder;

        if (winningBidderId) {
            // 6. Transfer ownership (using admin client)
            const { error: updateArtworkError } = await supabaseAdmin
                .from('artworks')
                .update({ user_id: winningBidderId })
                .eq('id', artworkId);

            if (updateArtworkError) {
                console.error('Error updating artwork owner (admin context):', updateArtworkError);
                throw new Error('Failed to transfer artwork ownership.');
            }
            console.log(`Artwork ${artworkId} ownership transferred to user ${winningBidderId}`);
        } else {
            console.log(`Auction for artwork ${artworkId} ended with no winning bidder.`);
        }

        // 7. Update auction status to 'completed' (using admin client)
        const { error: updateAuctionError } = await supabaseAdmin
            .from('auctions')
            .update({ status: 'completed', updated_at: new Date() })
            .eq('artwork_id', artworkId);

        if (updateAuctionError) {
            console.error('Error updating auction status (admin context):', updateAuctionError);
            // Throw an error here as well, as inconsistent state is problematic
            throw new Error('Failed to update auction status after ownership transfer.'); 
        } else {
             console.log(`Auction status for artwork ${artworkId} updated to completed.`);
        }

        res.json({
            success: true,
            message: winningBidderId
                ? 'Auction completed successfully. Ownership transferred.'
                : 'Auction completed successfully. No winning bid placed.'
        });

    } catch (error) {
        console.error('Error finishing auction:', error);
        // Provide a more generic error message in production
        const errorMessage = process.env.NODE_ENV === 'development' 
            ? error.message 
            : 'An unexpected error occurred while finalizing the auction.';
        res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});

router.get('/categories', authenticateUser, async (req, res) => {
    try {
        // Get all categories with their descriptions
        const { data: categories, error: categoryError } = await req.supabase
            .from('categories')
            .select('*')
            .order('name');

        if (categoryError) throw categoryError;

        // Get artwork counts for each category *for the current user*
        const { data: artworkData, error: artworkError } = await req.supabase
            .from('artworks')
            .select('category_id')
            .eq('user_id', req.user.id); // <<< Filter by logged-in user

        if (artworkError) {
            console.error(`Error fetching artwork counts for user ${req.user.id}:`, artworkError);
            throw artworkError; // Propagate error
        }

        // Calculate counts manually
        const categoryCounts = {};
        artworkData?.forEach(artwork => {
            if (artwork.category_id) {
                categoryCounts[artwork.category_id] = (categoryCounts[artwork.category_id] || 0) + 1;
            }
        });

        // Combine the data
        const categoriesWithCounts = categories.map(category => ({
            ...category,
            count: categoryCounts[category.id] || 0,
            description: category.description || 'No description available'
        }));

        return res.json({ success: true, categories: categoriesWithCounts });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all categories for gallery page
router.get('/gallery-categories', async (req, res) => {    
    try {
        // Use the imported shared supabase client
        
        // Get categories with their descriptions
        const { data: categoryData, error: categoryError } = await supabase
            .from('categories')
            .select('*')
            .order('name');
            
        if (categoryError) throw categoryError;
        
        // If no categories found, return empty array immediately
        if (!categoryData || categoryData.length === 0) {
            console.log('[gallery-categories] No categories found in the database.'); // Added log
            return res.json({ success: true, categories: [] });
        }
        console.log(`[gallery-categories] Found ${categoryData.length} categories.`); // Added log
        
        // Get all artworks to compute counts and get sample images
        const { data: allArtworks, error: countError } = await supabase
            .from('artworks')
            .select('*')
            .order('created_at', { ascending: false });

        if (countError) throw countError;

        // Process artworks to get counts by category
        const categoryCounts = {};
        if (allArtworks && allArtworks.length > 0) {
             console.log(`[gallery-categories] Found ${allArtworks.length} artworks.`); // Added log
            allArtworks.forEach(artwork => {
                if (artwork.category_id) { // Check if category_id exists and is not null
                    if (!categoryCounts[artwork.category_id]) {
                        categoryCounts[artwork.category_id] = {
                            count: 0,
                            firstArtwork: artwork.created_at,
                            lastArtwork: artwork.created_at,
                            image: artwork.image_url
                        };
                    }
                    categoryCounts[artwork.category_id].count++;
                    categoryCounts[artwork.category_id].firstArtwork = artwork.created_at < categoryCounts[artwork.category_id].firstArtwork 
                        ? artwork.created_at : categoryCounts[artwork.category_id].firstArtwork;
                    categoryCounts[artwork.category_id].lastArtwork = artwork.created_at > categoryCounts[artwork.category_id].lastArtwork 
                        ? artwork.created_at : categoryCounts[artwork.category_id].lastArtwork;
                }
            });
        } else {
             console.log('[gallery-categories] No artworks found in the database.'); // Added log
        }
        
        // Map categories with their counts and descriptions
        const categories = categoryData.map(category => ({
            id: category.id,
            name: category.name,
            description: category.description,
            count: categoryCounts[category.id]?.count || 0,
            period: categoryCounts[category.id] 
                ? getPeriodText(categoryCounts[category.id].firstArtwork, categoryCounts[category.id].lastArtwork)
                : 'Coming Soon',
            image: getCategoryDefaultImage(category.name) // Always use the default image for consistency
        }));
        
        console.log('[gallery-categories] Formatted categories:', JSON.stringify(categories, null, 2)); // Added log
        return res.json({ success: true, categories });
    } catch (error) {
        console.error('Error in /gallery-categories:', error.message, error.stack); // Enhanced error logging
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all unique category names
router.get('/categories/names', async (req, res) => {
    try {
        // Initialize Supabase client for public routes
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );

        // Get categories from the database
        const { data: categories, error } = await supabase
            .from('categories')
            .select('id, name')
            .order('name');

        if (error) throw error;

        // Format categories for the frontend
        const formattedCategories = categories.map(category => ({
            id: category.id,
            name: category.name,
            value: category.name.toLowerCase()
            }));

        res.json({ 
            success: true, 
            categories: formattedCategories 
        });
    } catch (error) {
        console.error('Error fetching category names:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Helper function to get period text
function getPeriodText(firstArtwork, lastArtwork) {
    const firstYear = new Date(firstArtwork).getFullYear();
    const lastYear = new Date(lastArtwork).getFullYear();

    if (firstYear === lastYear) {
        return `${firstYear}`;
    } else {
        return `${firstYear} - ${lastYear}`;
    }
}

// Helper function to get default image for category
function getCategoryDefaultImage(category) {
    const artCategoryImages = {
        'Fresco': 'https://images.unsplash.com/photo-1516563670759-299070f0dc54?auto=format&fit=crop&w=800&q=80',
        'Tempera': 'https://images.unsplash.com/photo-1579762715118-a6f1d4b934f1?auto=format&fit=crop&w=800&q=80',
        'Oil Painting': 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=800&q=80',
        'Baroque': 'https://images.unsplash.com/photo-1576016770957-fd0233aa2240?auto=format&fit=crop&w=800&q=80',
        'Rococo': 'https://images.unsplash.com/photo-1582582494705-f8ce0b0c24f0?auto=format&fit=crop&w=800&q=80',
        'Neoclassicism': 'https://images.unsplash.com/photo-1574182245530-967d9b3831af?auto=format&fit=crop&w=800&q=80',
        'Romanticism': 'https://images.unsplash.com/photo-1549887534-1541e9326642?auto=format&fit=crop&w=800&q=80',
        'Realism': 'https://images.unsplash.com/photo-1578926288207-a90a5366759d?auto=format&fit=crop&w=800&q=80',
        'Academic Art': 'https://images.unsplash.com/photo-1578321272066-408f40629b89?auto=format&fit=crop&w=800&q=80'
    };

    // Default image for any category that doesn't have a specific image
    const defaultImage = 'https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?auto=format&fit=crop&w=800&q=80';

    // Try to match the category name exactly first
    if (category && artCategoryImages[category]) {
        return artCategoryImages[category];
    }

    // If no exact match, try case-insensitive match
    if (category) {
        const lowerCategory = category.toLowerCase();
        const matchingKey = Object.keys(artCategoryImages).find(key => 
            key.toLowerCase() === lowerCategory
        );
        if (matchingKey) {
            return artCategoryImages[matchingKey];
        }
    }

    // Return default image if no match found
    return defaultImage;
}

// Helper function to get category icon
function getCategoryIcon(category) {
    // Default icons for common categories - simplified
    const defaultIcon = 'palette'; // Default art icon
    
    // Map for the most common art styles and techniques
    const artCategoryIcons = {
        'painting': 'palette',
        'fresco': 'brush',
        'tempera': 'paint-brush',
        'oil painting': 'oil-can',
        'baroque': 'theater-masks',
        'rococo': 'leaf',
        'neoclassicism': 'columns',
        'romanticism': 'heart',
        'realism': 'camera',
        'academic art': 'university'
    };
    
    return artCategoryIcons[category?.toLowerCase()] || defaultIcon;
}

// Get artworks by category
router.get('/category/:categoryName', async (req, res) => {
    try {
        const { categoryName } = req.params;
        
        // Use the imported shared supabase client
        
        // First try to find the category in the database
        const { data: categoryData, error: categoryError } = await supabase
            .from('categories')
            .select('id, name')
            .ilike('name', categoryName)
            .single();
            
        if (categoryError && categoryError.code !== 'PGRST116') {
            // Real error, not just "no rows returned"
            throw categoryError;
        }
        
        let artworks;
        
        if (categoryData) {
            // If category found in database, search by category_id
            const { data, error } = await supabase
                .from('artworks')
                .select(`
                    *,
                    favorites!left(count)
                `)
                .eq('category_id', categoryData.id)
                .order('created_at', { ascending: false });
                
            if (error) throw error;
            artworks = data || [];
        } else {
            // Fallback to legacy category string search (for backward compatibility)
        const { data, error } = await supabase
            .from('artworks')
            .select(`
                *,
                favorites!left(count)
            `)
            .ilike('category', categoryName)
            .order('created_at', { ascending: false });

        if (error) throw error;
            artworks = data || [];
        }

        // If no artworks found, return empty array
        if (artworks.length === 0) {
            return res.json({ success: true, artworks: [] });
        }
        
        const artworksWithFavorites = artworks.map(artwork => ({
            ...artwork,
            description: artwork.description || 'No description provided',
            views: artwork.views || 0,
            favorites: artwork.favorites[0]?.count || 0
        }));

        res.json({ success: true, artworks: artworksWithFavorites });
    } catch (error) {
        console.error('Error in /category/:categoryName:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all artworks for gallery
router.get('/all', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('artworks')
            .select(`
                *,
                categories (name),
                users (full_name),
                favorites!left(count)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const artworksWithDetails = data.map(artwork => ({
            ...artwork,
            description: artwork.description || 'No description provided',
            views: artwork.views || 0,
            category: artwork.categories?.name || 'Oil Painting',
            favorites: artwork.favorites[0]?.count || 0,
            artist_name: artwork.users?.full_name || 'Unknown Artist'
        }));

        res.json({ success: true, artworks: artworksWithDetails });
    } catch (error) {
        console.error('Error fetching all artworks:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add favorite
router.post('/:id/favorite', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if artwork exists
        const { data: artwork, error: artworkError } = await req.supabase
            .from('artworks')
            .select('id')
            .eq('id', id)
            .single();

        if (artworkError || !artwork) {
            return res.status(404).json({ 
                success: false, 
                error: 'Artwork not found' 
            });
        }

        // Check if already favorited
        const { data: existingFavorite, error: favoriteError } = await req.supabase
            .from('favorites')
            .select('*')
            .eq('user_id', req.user.id)
            .eq('artwork_id', id)
            .single();

        if (favoriteError && favoriteError.code !== 'PGRST116') { // Ignore "no rows" error
            throw favoriteError;
        }

        if (existingFavorite) {
            // Remove favorite
            const { error: deleteError } = await req.supabase
                .from('favorites')
                .delete()
                .eq('id', existingFavorite.id);

            if (deleteError) throw deleteError;

            return res.json({ 
                success: true,
                message: 'Removed from favorites',
                isFavorite: false
            });
        } else {
            // Add favorite
            const { data: newFavorite, error: insertError } = await req.supabase
                .from('favorites')
                .insert([{
                    user_id: req.user.id,
                    artwork_id: id
                }])
                .select()
                .single();

            if (insertError) throw insertError;

            return res.json({ 
                success: true,
                message: 'Added to favorites',
                isFavorite: true
            });
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Remove favorite
router.delete('/:id/favorite', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if favorite exists
        const { data: existingFavorite, error: favoriteError } = await req.supabase
            .from('favorites')
            .select('*')
            .eq('user_id', req.user.id)
            .eq('artwork_id', id)
            .single();

        if (favoriteError && favoriteError.code !== 'PGRST116') {
            throw favoriteError;
        }

        if (!existingFavorite) {
            return res.status(404).json({
                success: false,
                error: 'Favorite not found'
            });
        }

        // Remove favorite
        const { error: deleteError } = await req.supabase
            .from('favorites')
            .delete()
            .eq('id', existingFavorite.id);

        if (deleteError) throw deleteError;

        return res.json({ 
            success: true,
            message: 'Removed from favorites',
            isFavorite: false
        });
    } catch (error) {
        console.error('Error removing favorite:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Get user's favorites
router.get('/favorites', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await req.supabase
            .from('favorites')
            .select(`
                artwork_id,
                artworks (
                    *,
                    categories (name),
                    users (full_name)
                )
            `)
            .eq('user_id', req.user.id);

        if (error) throw error;

        const favorites = data.map(fav => ({
            id: fav.artwork_id,
            ...fav.artworks,
            category: fav.artworks.categories?.name || 'Uncategorized',
            artist_name: fav.artworks.users?.full_name || 'Unknown Artist'
        }));

        res.json({ 
            success: true,
            favorites 
        });
    } catch (error) {
        console.error('Error fetching favorites:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Edit artwork
router.put('/edit/:id', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, category, tags, price } = req.body;

        // First verify artwork exists and belongs to user
        const { data: artwork, error: fetchError } = await req.supabase
            .from('artworks')
            .select('id, user_id')
            .eq('id', id)
            .eq('user_id', req.user.id)
            .single();

        if (fetchError || !artwork) {
            return res.status(404).json({
                success: false,
                error: 'Artwork not found or unauthorized'
            });
        }

        // Validate inputs
        if (!title || !category) {
            return res.status(400).json({
                success: false,
                error: 'Title and category are required'
            });
        }

        // Get category ID
        const { data: categoryData, error: categoryError } = await req.supabase
            .from('categories')
            .select('id')
            .ilike('name', category)
            .single();

        if (categoryError || !categoryData) {
            return res.status(400).json({
                success: false,
                error: 'Invalid category'
            });
        }

        // Prepare update payload
        const updatePayload = {
            title,
            description: description || null,
            category_id: categoryData.id,
            price: price ? parseFloat(price) : null,
            tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : [])
        };

        // Update artwork
        const { data: updatedArtwork, error: updateError } = await req.supabase
            .from('artworks')
            .update(updatePayload)
            .eq('id', id)
            .select(`
                *,
                categories (name),
                users (full_name)
            `)
            .single();

        if (updateError) throw updateError;

        // Format response
        const responseArtwork = {
            ...updatedArtwork,
            category: updatedArtwork.categories?.name || 'Uncategorized',
            artist_name: updatedArtwork.users?.full_name || 'Unknown Artist'
        };

        res.json({
            success: true,
            artwork: responseArtwork
        });

    } catch (error) {
        console.error('Error updating artwork:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Delete artwork
router.delete('/delete/:id', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;

        // First verify artwork exists and belongs to user
        const { data: artwork, error: fetchError } = await req.supabase
            .from('artworks')
            .select('id, user_id, storage_path')
            .eq('id', id)
            .eq('user_id', req.user.id)
            .single();

        if (fetchError || !artwork) {
            return res.status(404).json({
                success: false,
                error: 'Artwork not found or unauthorized'
            });
        }

        // Delete from storage first
        if (artwork.storage_path) {
            const { error: storageError } = await req.supabase
                .storage
                .from('artworks')
                .remove([artwork.storage_path]);

            if (storageError) {
                console.error('Error deleting from storage:', storageError);
                // Continue with DB deletion even if storage fails
            }
        }

        // Delete from database
        const { error: deleteError } = await req.supabase
            .from('artworks')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        res.json({
            success: true,
            message: 'Artwork deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting artwork:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Stripe checkout endpoint
router.post('/create-checkout-session', authenticateUser, async (req, res) => {
    try {
        const { artworkId } = req.body;

        // Fetch artwork details
        const { data: artwork, error } = await req.supabase
            .from('artworks')
            .select('id, title, price, user_id, image_url')
            .eq('id', artworkId)
            .single();

        if (error || !artwork) {
            return res.status(404).json({
                success: false,
                error: 'Artwork not found'
            });
        }

        // Check if artwork is for sale (has price)
        if (!artwork.price) {
            return res.status(400).json({
                success: false,
                error: 'Artwork is not for sale'
            });
        }

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: artwork.title,
                        images: [artwork.image_url]
                    },
                    unit_amount: Math.round(artwork.price * 100) // Convert to cents
                },
                quantity: 1
            }],
            mode: 'payment',
            success_url: `${req.protocol}://${req.get('host')}/marketplace?success=true`,
            cancel_url: `${req.protocol}://${req.get('host')}/marketplace?canceled=true`,
            metadata: {
                artworkId: artwork.id,
                sellerId: artwork.user_id,
                buyer_id: req.user.id
            }
        });

        res.json({
            success: true,
            sessionId: session.id
        });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;

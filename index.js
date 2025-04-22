import express from 'express';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser } from './middleware/auth.js';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import artworkRoutes from './routes/artwork.js';
import Stripe from 'stripe'; // Import Stripe

import cookieParser from 'cookie-parser';
import userRoutes from './routes/user.js';
import { startAuctionScheduler } from './services/auctionScheduler.js'; // Import the scheduler

// Load environment variables
dotenv.config();

// Initialize Stripe with secret key and API version
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20', // Specify the API version
});

// Check environment variables
console.log('Environment Check:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Missing');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Set' : 'Missing');

const app = express();
const port = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(express.static('public'));

// Stripe webhook endpoint - Using express.raw to get the raw body
app.post('/stripe/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    console.log('Received webhook request');
    try {
        const sig = req.headers['stripe-signature'];
        const stripeSecret = process.env.STRIPE_WEBHOOK_SECRET;

        if (!stripeSecret) {
            console.error('Stripe webhook secret is not configured');
            return res.status(500).json({ error: 'Internal server error' });
        }

        let event;

        try {
            // Pass the raw request body (Buffer) to constructEvent
            event = stripe.webhooks.constructEvent(req.body, sig, stripeSecret);
            console.log('Webhook event constructed successfully. Type:', event.type); 
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return res.status(400).json({ error: 'Invalid signature' });
        }

        if (event.type === 'checkout.session.completed') {
            console.log('>>> Processing checkout.session.completed event <<<'); // Add clear marker
            const session = event.data.object;
            // Log status and metadata immediately upon entering the block
            console.log('Received session payment_status:', session.payment_status); 
            console.log('Received session metadata:', session.metadata); 

            // Extract metadata - Using buyer_id and sellerId from metadata
            const { artworkId, sellerId, buyer_id } = session.metadata || {}; // Use default {} for safety

            // Check if all necessary metadata is present
            if (artworkId && sellerId && buyer_id) { // Check for buyer_id
                console.log(`Processing purchase for artwork: ${artworkId} by user: ${buyer_id}`);
                
                // Check payment status *before* database operations
                if (session.payment_status === 'paid') {
                    console.log('Payment status is paid. Attempting database update...');
                    try {
                        const supabaseAdmin = createClient(
                            process.env.SUPABASE_URL,
                            process.env.SUPABASE_SERVICE_ROLE_KEY,
                            { auth: { persistSession: false } }
                        );

                        // Update artwork ownership using the buyer's application user ID from metadata
                        const { error: updateError } = await supabaseAdmin
                            .from('artworks')
                            .update({ 
                                user_id: buyer_id, // Use buyer_id from metadata
                                updated_at: new Date()
                            })
                            .eq('id', artworkId);

                        if (updateError) {
                            console.error('Error transferring artwork ownership:', updateError);
                            throw updateError;
                        } else {
                            console.log('Artwork ownership updated successfully');
                        }

                        // Create transaction record
                        const transactionData = {
                            artwork_id: artworkId,
                            seller_id: sellerId, // Use sellerId from metadata
                            buyer_id: buyer_id, // Use buyer_id from metadata
                            transaction_date: new Date(),
                            amount: session.amount_total / 100 // Convert from cents to dollars
                        };
                        console.log('Creating transaction record:', transactionData);

                        const { error: transactionError } = await supabaseAdmin
                            .from('artwork_transactions')
                            .insert([transactionData]);

                        if (transactionError) {
                            console.error('Error creating transaction record:', transactionError);
                            throw transactionError;
                        } else {
                            console.log('Transaction record created successfully');
                        }
                         console.log(`Artwork ${artworkId} processing complete for buyer ${buyer_id}`);
                    } catch (error) {
                        console.error('Error processing successful purchase (database update):', error);
                    } // End of try/catch for DB ops
                } else {
                    console.log(`Payment status is ${session.payment_status}. Skipping database update.`);
                }

            } else {
                // Log which specific metadata keys were found/missing for better debugging
                console.log(`Missing required metadata for checkout session. 
                    Found artworkId: ${!!artworkId}, 
                    Found sellerId: ${!!sellerId}, 
                    Found buyer_id: ${!!buyer_id}`);
            }
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Error handling webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Global JSON Parser applied AFTER Webhook Route
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add Content Security Policy middleware
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "script-src 'self' https://cdn.tailwindcss.com https://js.stripe.com https://cdnjs.cloudflare.com https://esm.sh https://cdn.jsdelivr.net 'unsafe-inline' 'unsafe-eval'; " +
        "font-src 'self' https://api.fontshare.com https://cdn.fontshare.com https://js.stripe.com https://cdnjs.cloudflare.com data:; " +
        "img-src 'self' data: https://picsum.photos https://fastly.picsum.photos https://upload.wikimedia.org https://mayfairgallery.com https://soulspaze.com https://smarthistory.org https://iyqjtgzbkpdhbfxqlpyf.supabase.co https://*.supabase.co; " +
        "style-src 'self' https://cdnjs.cloudflare.com https://api.fontshare.com 'unsafe-inline'; " + // Added style-src for Font Awesome and inline styles
        "frame-src https://js.stripe.com; " + // Allow Stripe iframe
        "connect-src 'self' https://*.supabase.co; " + // Allow connections to Supabase
        "object-src 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self'; " +
        "frame-ancestors 'none'; " +
        "upgrade-insecure-requests;"
    );
    next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Initialize CSRF protection
import csrf from 'csurf';
const csrfProtection = csrf({ cookie: true });

// Configure cookie settings
app.use((req, res, next) => {
    res.cookie('cookieTest', 'test', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
    });
    next();
});

// Removed CSP headers to prevent issues with content loading

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, error: 'Something broke!' });
});

// Routes
// Root route
app.get('/', (req, res) => {
    res.render('pages/login', {
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY
    });
});

// Mount routes
app.use('/auth', authRoutes);

app.use('/api/artwork', artworkRoutes);

// Add DELETE endpoint for artwork
app.delete('/api/artwork/:artworkId', authenticateUser, async (req, res) => {
    try {
        const artworkId = req.params.artworkId;

        // First verify artwork exists and belongs to user or is admin
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data: artwork, error: fetchError } = await supabase
            .from('artworks')
            .select('id, user_id, storage_path')
            .eq('id', artworkId)
            .single();

        if (fetchError || !artwork) {
            return res.status(404).json({
                success: false,
                error: 'Artwork not found'
            });
        }

        // Check if user is admin or owner
        if (req.user.status !== 'admin' && artwork.user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        // Delete from storage first
        if (artwork.storage_path) {
            const { error: storageError } = await supabase
                .storage
                .from('artworks')
                .remove([artwork.storage_path]);

            if (storageError) {
                console.error('Error deleting from storage:', storageError);
                // Continue with DB deletion even if storage fails
            }
        }

            // First delete associated auctions
            const { error: deleteAuctionError } = await supabase
                .from('auctions')
                .delete()
                .eq('artwork_id', artworkId);

            if (deleteAuctionError) {
                console.error('Error deleting associated auctions:', deleteAuctionError);
                throw deleteAuctionError;
            }

            // Then delete the artwork
            const { error: deleteArtworkError } = await supabase
                .from('artworks')
                .delete()
                .eq('id', artworkId);

            if (deleteArtworkError) throw deleteArtworkError;

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

app.get('/gallery', (req, res) => {
    res.render('pages/gallery');
});

app.get('/home', (req, res) => {
    res.render('pages/index');
});

// Marketplace route
app.get('/marketplace', (req, res) => {
    res.render('pages/marketplace', {
        STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY
    });
});

app.use('/api/user', userRoutes);
// Bid endpoint
app.post('/auction/bid/:artworkId', authenticateUser, async (req, res) => {
    try {
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY,
            { 
                global: { 
                    headers: { 
                        Authorization: req.cookies.access_token 
                    } 
                } 
            }
        );
        
        const { amount } = req.body;
        const { artworkId } = req.params;
        
        // Get current highest bid
        const { data: auction, error } = await supabase
            .from('auctions')
            .select('*')
            .eq('artwork_id', artworkId)
            .single();

        if (error) throw error;
        if (!auction) return res.status(404).json({ error: 'Auction not found' });
        
        // Validate bid amount
        if (amount <= auction.current_bid) {
            return res.status(400).json({ 
                error: 'Bid must be higher than current bid' 
            });
        }

        // Update bid
        const { data: updated, error: updateError } = await supabase
            .from('auctions')
            .update({ 
                current_bid: amount,
                current_bidder: req.user.id
            })
            .eq('artwork_id', artworkId)
            .select();

        if (updateError) throw updateError;

        // Redirect to auction page on successful bid
        res.redirect('/auction');
    } catch (error) {
        console.error('Bid error:', error);
        res.status(500).json({ 
            error: 'Failed to place bid' 
        });
    }
});

// Fetch all artworks for admin panel with search
app.get('/api/admin/artworks', authenticateUser, async (req, res) => {
    try {
        if (req.user.status !== 'admin') {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const searchTerm = req.query.search?.toLowerCase();

        let query = supabase
            .from('artworks')
            .select(`
                *,
                artist:users(full_name)
            `);

        if (searchTerm) {
            query = query
                .ilike('title', `%${searchTerm}%`)
                .or(`artist.full_name.ilike.%${searchTerm}%`);
        }

        const { data: artworks, error } = await query;

        if (error) throw error;

        res.json({ success: true, artworks });
    } catch (error) {
        console.error('Error fetching artworks for admin:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch artworks' });
    }
});
// Fetch all auctions for admin panel with search
app.get('/api/admin/auctions', authenticateUser, async (req, res) => {
    try {
        if (req.user.status !== 'admin') {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const searchTerm = req.query.search?.toLowerCase();

        let query = supabase
            .from('auctions')
            .select(`
                *,
                artwork:artworks!inner(
                    title,
                    artist:users(full_name)
                ),
                current_bidder:users(full_name)
            `);

        if (searchTerm) {
            query = query
                .ilike('artwork.title', `%${searchTerm}%`)
                .or(`artwork.artist.full_name.ilike.%${searchTerm}%`)
                .or(`current_bidder.full_name.ilike.%${searchTerm}%`);
        }

        const { data: auctions, error } = await query;

        if (error) throw error;

        res.json({ success: true, auctions });
    } catch (error) {
        console.error('Error fetching auctions for admin:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch auctions' });
    }
});
// Fetch all users for admin panel with search
app.get('/api/admin/users', authenticateUser, async (req, res) => {
    try {
        if (req.user.status !== 'admin') { 
            console.log(`Unauthorized access attempt to /api/admin/users by user: ${req.user.id}`);
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        console.log(`Admin user ${req.user.id} fetching all users.`);

        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY // Use service key to fetch all users
        );

        const searchTerm = req.query.search?.toLowerCase();

        let query = supabase
            .from('users')
            .select('*'); // Select all necessary fields

        if (searchTerm) {
            query = query
                .or(`full_name.ilike.%${searchTerm}%`, `email.ilike.%${searchTerm}%`);
        }

        // Apply ordering after potential filtering
        query = query.order('created_at', { ascending: false });

        const { data: users, error } = await query;

        if (error) {
            console.error('Error fetching users for admin:', error);
            throw error;
        }

        console.log(`Successfully fetched ${users.length} users for admin.`);
        res.json({ success: true, users });

    } catch (error) {
        console.error('Error in /api/admin/users:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch users' });
    }
});

// Fetch all auctions for admin panel with search
app.get('/api/admin/auctions', authenticateUser, async (req, res) => {
    try {
        if (req.user.status !== 'admin') {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const searchTerm = req.query.search?.toLowerCase();

        let query = supabase
            .from('auctions')
            .select(`
                *,
                artwork:artworks!inner(
                    title,
                    artist:users(full_name)
                ),
                current_bidder:users(full_name)
            `);

        if (searchTerm) {
            query = query
                .ilike('artwork.title', `%${searchTerm}%`)
                .or(`artwork.artist.full_name.ilike.%${searchTerm}%`)
                .or(`current_bidder.full_name.ilike.%${searchTerm}%`);
        }

        const { data: auctions, error } = await query;

        if (error) throw error;

        res.json({ success: true, auctions });
    } catch (error) {
        console.error('Error fetching auctions for admin:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch auctions' });
    }
});
// Auction page
app.get('/auction', authenticateUser, csrfProtection, async (req, res) => {
    try {
        // Use service role key to bypass RLS for now
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        
        // Get only artworks that have active auctions with debug logging
        const currentTime = new Date().toISOString();
        console.log(`Fetching active auctions (current time: ${currentTime})`);
        
        let { data: fetchedArtworks, error } = await supabase
            .from('auctions')
            .select(`
                *,
                artwork:artworks!inner(
                    *,
                    category:categories(name),
                    artist:users(full_name)
                )
            `)
            .eq('status', 'active')
            .gt('end_time', currentTime)
            .order('end_time', { ascending: true });

        console.log('Raw query results:', fetchedArtworks);

        if (error) {
            console.error('Supabase query error:', error);
            throw error;
        }

        if (!fetchedArtworks || fetchedArtworks.length === 0) {
            return res.render('pages/error', {
                message: 'No active auctions available.'
            });
        }

        const templateData = {
            artworks: fetchedArtworks.map(auction => ({
                ...auction.artwork,
                user_id: auction.artwork.user_id, // Include user_id for owner check
                users: {
                    full_name: auction.artwork.artist?.full_name || 'Unknown Artist'
                },
                auctions: [{
                    current_bid: auction.current_bid,
                    end_time: auction.end_time,
                    starting_bid: auction.starting_bid
                }]
            })),
            currentUser: req.user ? {
                id: req.user.id,
                email: req.user.email,
                name: req.user.name
            } : null,
            isLoggedIn: !!req.user,
            csrfToken: res.locals.csrfToken
        };
        res.render('pages/auction', templateData);
    } catch (error) {
        console.error('Error loading auctions:', error);
        try {
            res.status(500).render('pages/error', {
                message: 'Failed to load auctions'
            });
        } catch (renderError) {
            console.error('Error rendering error page:', renderError);
            res.status(500).json({
                success: false,
                error: 'Failed to load auctions',
                details: error.message
            });
        }
    }
});

// Ban user by ID or email
app.post('/admin/ban-user', authenticateUser, async (req, res) => {
    try {
        if (req.user.status !== 'admin') {
            console.log(`Unauthorized ban attempt by user: ${req.user.id} (status: ${req.user.status})`);
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        const { userId, email } = req.body;
        if (!userId && !email) {
            return res.status(400).json({ success: false, error: 'Must provide userId or email' });
        }

        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Update user status in database
        const { data, error } = await supabase
            .from('users')
            .update({ is_banned: true })
            .eq(userId ? 'id' : 'email', userId || email)
            .select();

        if (error && error.code === '23514') {
            return res.status(400).json({ 
                success: false, 
                error: 'Cannot ban user due to database constraint violation' 
            });
        }

        if (error) throw error;

        res.json({ success: true, user: data[0] });
    } catch (error) {
        console.error('Ban error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Unban user by ID or email
app.post('/admin/unban-user', authenticateUser, async (req, res) => {
    try {
        if (req.user.status !== 'admin') {
            console.log(`Unauthorized unban attempt by user: ${req.user.id} (status: ${req.user.status})`);
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        const { userId, email } = req.body;
        if (!userId && !email) {
            return res.status(400).json({ success: false, error: 'Must provide userId or email' });
        }

        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Update user ban status in database
        const { data, error } = await supabase
            .from('users')
            .update({ is_banned: false })
            .eq(userId ? 'id' : 'email', userId || email)
            .select();

        if (error) throw error;

        res.json({ success: true, user: data[0] });
    } catch (error) {
        console.error('Unban error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin dashboard routes
app.get('/admin/users', authenticateUser, (req, res) => {
    if (req.user.status === 'admin') {
        res.render('pages/admin-dashboard', {
            user: req.user,
            currentSection: 'users',
            SUPABASE_URL: process.env.SUPABASE_URL,
            SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY
        });
    } else {
        res.redirect('/dashboard');
    }
});

app.get('/admin/artwork', authenticateUser, (req, res) => {
    if (req.user.status === 'admin') {
        res.render('pages/admin-dashboard', {
            user: req.user,
            currentSection: 'artwork',
            SUPABASE_URL: process.env.SUPABASE_URL,
            SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY
        });
    } else {
        res.redirect('/dashboard');
    }
});

app.get('/admin/reports', authenticateUser, (req, res) => {
    if (req.user.status === 'admin') {
        res.render('pages/admin-dashboard', {
            user: req.user,
            currentSection: 'reports',
            SUPABASE_URL: process.env.SUPABASE_URL,
            SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY
        });
    } else {
        res.redirect('/dashboard');
    }
});

app.get('/admin/auctions', authenticateUser, (req, res) => {
    if (req.user.status === 'admin') {
        res.render('pages/admin-dashboard', {
            user: req.user,
            currentSection: 'auctions',
            SUPABASE_URL: process.env.SUPABASE_URL,
            SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY
        });
    } else {
        res.redirect('/dashboard');
    }
});

app.get('/dashboard', authenticateUser, (req, res) => {
    if (req.user.status === 'admin') {
        res.render('pages/admin-dashboard', {
            user: req.user,
            currentSection: '',
            SUPABASE_URL: process.env.SUPABASE_URL,
            SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY
        });
    } else {
        res.render('pages/user-dashboard', {
            user: req.user,
            SUPABASE_URL: process.env.SUPABASE_URL,
            SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY
        });
    }
});


// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log('Server environment:', process.env.NODE_ENV || 'development');
    
    // Start the auction scheduler after the server starts
    startAuctionScheduler();
});

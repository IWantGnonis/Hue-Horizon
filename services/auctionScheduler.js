import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';

// Ensure necessary environment variables are set
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("FATAL ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for the auction scheduler.");
    // Exit or prevent scheduling if keys are missing
    process.exit(1); 
}

// Create a Supabase client with the Service Role Key to bypass RLS
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } } // Important for server-side usage
);

/**
 * Checks for auctions that have ended but are still marked as 'active',
 * finalizes them by transferring ownership (if a winner exists) and updating status.
 */
async function checkAndFinalizeAuctions() {
    console.log(`[${new Date().toISOString()}] Running auction finalization check...`);
    const now = new Date().toISOString();

    try {
        // Find auctions that have ended (end_time <= now) and are still 'active'
        const { data: endedAuctions, error: fetchError } = await supabaseAdmin
            .from('auctions')
            .select('id, artwork_id, current_bidder, status, end_time') // Select necessary fields
            .eq('status', 'active')
            .lte('end_time', now); // Less than or equal to current time

        if (fetchError) {
            console.error(`[${new Date().toISOString()}] Error fetching ended auctions:`, fetchError);
            return; // Exit check if fetch fails
        }

        if (!endedAuctions || endedAuctions.length === 0) {
            console.log(`[${new Date().toISOString()}] No active auctions found past their end time.`);
            return;
        }

        console.log(`[${new Date().toISOString()}] Found ${endedAuctions.length} ended auction(s) to process.`);

        // Process each ended auction
        for (const auction of endedAuctions) {
            console.log(`[${new Date().toISOString()}] Processing auction ID: ${auction.id} for artwork ID: ${auction.artwork_id}`);
            const winningBidderId = auction.current_bidder;
            let ownershipTransferred = false;

            // Transfer ownership if there is a winner
            if (winningBidderId) {
                const { error: updateArtworkError } = await supabaseAdmin
                    .from('artworks')
                    .update({ user_id: winningBidderId })
                    .eq('id', auction.artwork_id);

                if (updateArtworkError) {
                    console.error(`[${new Date().toISOString()}] Error transferring ownership for artwork ${auction.artwork_id} (Auction ID: ${auction.id}):`, updateArtworkError);
                    // Continue to next auction, maybe log this for manual review
                    continue; 
                }
                ownershipTransferred = true;
                console.log(`[${new Date().toISOString()}] Artwork ${auction.artwork_id} ownership transferred to user ${winningBidderId}.`);
            } else {
                console.log(`[${new Date().toISOString()}] Auction ${auction.id} (Artwork: ${auction.artwork_id}) ended with no winning bidder.`);
            }

            // Update auction status to 'completed'
            const { error: updateAuctionError } = await supabaseAdmin
                .from('auctions')
                .update({ status: 'completed', updated_at: new Date() })
                .eq('id', auction.id); // Use auction's primary key 'id'

            if (updateAuctionError) {
                console.error(`[${new Date().toISOString()}] Error updating status for auction ${auction.id} (Artwork: ${auction.artwork_id}):`, updateAuctionError);
                // Log the error, but the main goal (ownership transfer) might have succeeded
            } else {
                console.log(`[${new Date().toISOString()}] Auction ${auction.id} status updated to completed.`);
            }
        }

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Unexpected error during auction finalization check:`, error);
    }
     console.log(`[${new Date().toISOString()}] Auction finalization check finished.`);
}

/**
 * Starts the cron job to periodically check and finalize auctions.
 * Runs every minute. Adjust the cron schedule ('* * * * *') as needed.
 * See https://www.npmjs.com/package/node-cron for schedule patterns.
 */
function startAuctionScheduler() {
    console.log('Starting auction scheduler to run every minute...');
    // Schedule the task to run every minute
    cron.schedule('* * * * *', checkAndFinalizeAuctions);

    // Optional: Run once immediately on startup
    // console.log('Running initial auction finalization check...');
    // checkAndFinalizeAuctions(); 
}

export { startAuctionScheduler };

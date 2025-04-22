// Auction Management
class AuctionManager {
    static async loadAuctions() {
        const grid = document.getElementById('auctionsGrid');
        if (!grid) return;

        // Show loading state
        grid.innerHTML = `
            <div class="col-span-full">
                <div class="animate-pulse space-y-4">
                    ${Array(4).fill().map(() => `
                    <div class="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    `).join('')}
                </div>
            </div>
        `;

        try {
            // Cache user ID to avoid repeated lookups
            let userId = sessionStorage.getItem('userId');
            if (!userId) {
                userId = localStorage.getItem('userId') || 
                         new URLSearchParams(window.location.search).get('userId');
                if (userId) sessionStorage.setItem('userId', userId);
            }

            // Batch all data requests
            const [auctionsResponse, userResponse] = await Promise.all([
                fetch('/api/artwork/my-auctions'),
                userId ? Promise.resolve() : fetch('/auth/check')
            ]);
            
            if (!userId) {
                console.error('User not authenticated - checking auth status');
                try {
                    const authCheck = await fetch('/auth/check');
                    if (authCheck.status === 404) {
                        console.log('Auth check endpoint not found - using fallback');
                        // Try to get user ID from the rendered page data
                        userId = window.userData?.id;
                    } else if (authCheck.ok) {
                        const authData = await authCheck.json();
                        userId = authData.user?.id;
                    }
                    
                    if (userId) {
                        sessionStorage.setItem('userId', userId);
                        localStorage.setItem('userId', userId);
                        console.log('Retrieved user ID:', userId);
                    } else {
                        console.error('No user ID available from any source');
                    }
                } catch (err) {
                    console.error('Auth check failed:', err);
                    // Fallback to window.userData if available
                    userId = window.userData?.id;
                    if (userId) {
                        console.log('Using fallback user ID:', userId);
                    }
                }
                
                if (!userId) {
                    console.error('No user ID found - redirecting to login');
                    window.location.href = '/login';
                    return;
                }
            }

            console.log('Using user ID:', userId);
            const response = await fetch('/api/artwork/my-auctions');
            if (!response.ok) throw new Error('Failed to fetch user auctions');
            
            const result = await response.json();
            console.log('Raw API response:', result);
            
            // Handle both response formats for backward compatibility
            const artworks = result.artworks || result;
            if (!artworks) throw new Error('No artworks data found');
            
            console.log(`Found ${artworks.length} auction artworks`);
            this.renderAuctions(artworks);
        } catch (error) {
            console.error('Error loading auctions:', error);
            // Show error to user
            document.getElementById('auctionsGrid').innerHTML = `
                <div class="col-span-full text-center py-8">
                    <p class="text-red-500">Failed to load auctions. Please try again later.</p>
                </div>
            `;
        }
    }

    static renderAuctions(artworks) {
        const grid = document.getElementById('auctionsGrid');
        if (!artworks || artworks.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-8">
                    <p>No active auctions found</p>
                </div>
            `;
            return;
        }

        // Get user ID from multiple sources with proper type checking
        let currentUserId = sessionStorage.getItem('userId');
        if (!currentUserId) {
            currentUserId = localStorage.getItem('userId');
        }
        if (!currentUserId && window.userData?.id) {
            currentUserId = String(window.userData.id);
            sessionStorage.setItem('userId', currentUserId);
        }
        console.log('--- DEBUG: Auction Ownership Check ---');
        console.log('Current user ID from sessionStorage:', currentUserId, 'Type:', typeof currentUserId);
        
        if (!currentUserId) {
            console.error('No user ID found in sessionStorage!');
        }

        artworks.forEach(artwork => {
            console.log(`Artwork ${artwork.id} (${artwork.title}):`, {
                'Artwork Owner ID': artwork.user_id,
                'Type': typeof artwork.user_id,
                'Current User ID': currentUserId, 
                'Type': typeof currentUserId,
                'Ownership Match': artwork.user_id == currentUserId,
                'Should Show Delete': artwork.user_id == currentUserId
            });
        });
        grid.innerHTML = artworks.map(artwork => `
            <div class="auction-card mb-4 break-inside-avoid group relative overflow-hidden transition-all duration-300 hover:shadow-2xl">
                <div class="relative h-full overflow-hidden bg-white dark:bg-gray-800 border shadow-md hover:shadow-2xl transition-all duration-500">
                    <div class=" relative overflow-hidden">
                        <img src="${artwork.image_url}" alt="${artwork.title}" 
                             class="w-full object-cover transition-transform duration-700 group-hover:scale-105"
                             loading="lazy" 
                             data-src="${artwork.image_url}">
                        <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        
                        <!-- Badge for time left -->
                        <div class="absolute top-4 right-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium shadow-sm">
                            <i class="fas fa-clock mr-1 text-amber-500"></i>
                            <span>${this.formatTimeLeft(artwork.auction_end)}</span>
                        </div>
                    </div>

                    <div class="p-5 transition-all duration-500">
                        <div class="mb-4">
                            <h4 class="text-xl font-bold text-gray-900 dark:text-white line-clamp-1 mb-1">${artwork.title}</h4>
                            <p class="text-gray-600 dark:text-gray-300 text-sm line-clamp-2">${artwork.description || 'No description provided'}</p>
                        </div>

                        <div class="flex justify-between items-center">
                            <div>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Current Bid</p>
                                <p class="text-lg font-bold text-amber-600 dark:text-amber-400">
                                    $${artwork.current_bid || artwork.starting_bid || 'No bids yet'}
                                </p>
                                ${artwork.current_bidder ? `
                                <div class="mt-2 flex items-center text-xs text-gray-500 dark:text-gray-400">
                                    <i class="fas fa-user mr-1"></i>
                                    <span>${artwork.current_bidder.full_name || artwork.current_bidder.email}</span>
                                </div>
                                ` : ''}
                            </div>
                            
                            ${artwork.user_id == currentUserId ? `
                            <div class="flex gap-2">
                                <button class="px-3 py-1.5 bg-red-500/90 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors"
                                        onclick="AuctionManager.finishAuction('${artwork.id}')">
                                    Finish
                                </button>
                                <button class="px-3 py-1.5 bg-gray-500/90 hover:bg-gray-600 text-white text-xs font-medium rounded-lg transition-colors"
                                        onclick="AuctionManager.deleteAuction('${artwork.id}')">
                                    Delete
                                </button>
                            </div>
                            ` : `
                            <button class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors shadow-md"
                                    onclick="AuctionManager.showBidModal('${artwork.id}', ${artwork.starting_bid})">
                                Place Bid
                            </button>
                            `}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    static formatTimeLeft(endTime) {
        if (!endTime) return 'No end time set';
        
        const now = new Date();
        const end = new Date(endTime);
        
        if (isNaN(end.getTime())) return 'Invalid end date';
        
        const diff = end - now;
        
        if (diff <= 0) return 'Auction ended';
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
        if (days > 0) {
            return `Ending in ${days}d ${hours}h`;
        }
        return `Ending in ${hours}h`;
    }

    static showBidModal(artworkId, currentBid) {
        document.getElementById('bidArtworkId').value = artworkId;
        const bidInput = document.getElementById('bidAmount');
        bidInput.min = currentBid + 1;
        bidInput.value = currentBid + 1;
        document.getElementById('bidModal').classList.remove('hidden');
    }

    static async finishAuction(artworkId) {
        if (!confirm('Are you sure you want to finish this auction?')) return;
        
        try {
            const response = await fetch(`/api/artwork/auction/finish/${artworkId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) throw new Error('Failed to finish auction');
            
            const result = await response.json();
            if (result.success) {
                alert('Auction finished successfully!');
                this.loadAuctions(); // Refresh auction list
            } else {
                throw new Error(result.error || 'Failed to finish auction');
            }
        } catch (error) {
            console.error('Error finishing auction:', error);
            alert(`Error: ${error.message}`);
        }
    }

    static async deleteAuction(artworkId) {
        if (!confirm('Are you sure you want to delete this auction? This cannot be undone.')) return;
        
        try {
            const response = await fetch(`/api/artwork/delete/${artworkId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) throw new Error('Failed to delete auction');
            
            const result = await response.json();
            if (result.success) {
                alert('Auction deleted successfully!');
                this.loadAuctions(); // Refresh auction list
            } else {
                throw new Error(result.error || 'Failed to delete auction');
            }
        } catch (error) {
            console.error('Error deleting auction:', error);
            alert(`Error: ${error.message}`);
        }
    }

    static async handleBidSubmit(e) {
        e.preventDefault();
        
        const artworkId = document.getElementById('bidArtworkId').value;
        const bidAmount = parseFloat(document.getElementById('bidAmount').value);
        
        try {
            const response = await fetch(`/api/artwork/${artworkId}/bid`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: bidAmount
                })
            });

            if (!response.ok) throw new Error('Failed to place bid');
            
            const result = await response.json();
            if (result.success) {
                alert('Bid placed successfully!');
                document.getElementById('bidModal').classList.add('hidden');
                
                // Update the bid display immediately
                const bidDisplay = document.querySelector(`.auction-card[data-artwork-id="${artworkId}"] .text-amber-600`);
                if (bidDisplay) {
                    bidDisplay.textContent = `$${bidAmount}`;
                } else {
                    this.loadAuctions(); // Fallback to full refresh
                }
            } else {
                throw new Error(result.error || 'Failed to place bid');
            }
        } catch (error) {
            console.error('Error placing bid:', error);
            alert(`Error: ${error.message}`);
        }
    }
}

// Load auctions when the page loads if on auction page
if (window.location.pathname.includes('auction')) {
    AuctionManager.loadAuctions();
}

// Also load when clicking the auctions tab
document.addEventListener('DOMContentLoaded', () => {
    const auctionsTab = document.querySelector('[data-section="auction"]');
    if (auctionsTab) {
        auctionsTab.addEventListener('click', () => {
            AuctionManager.loadAuctions();
        });
    }

    // Setup bid form handler
    const bidForm = document.getElementById('bidForm');
    if (bidForm) {
        bidForm.addEventListener('submit', (e) => {
            AuctionManager.handleBidSubmit(e);
        });
    }
});

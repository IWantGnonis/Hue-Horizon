// Favorites Management
class FavoritesManager {
    static async loadFavorites() {
        const favoritesGrid = document.getElementById('favoritesGrid');
        
        try {
            // Show loading state
            this.showLoadingState(favoritesGrid);
            
            const response = await fetch('/api/artwork/favorites', {
                credentials: 'include'
            });
            const data = await response.json();

            if (data.success && data.favorites.length > 0) {
                favoritesGrid.innerHTML = data.favorites.map(artwork => this.createFavoriteCard(artwork)).join('');

                // Animate cards
                gsap.from(".artwork-card", {
                    opacity: 0,
                    y: 50,
                    duration: 1,
                    ease: "power3.out"
                });
            } else {
                this.showEmptyState(favoritesGrid);
            }
        } catch (error) {
            console.error('Error loading favorites:', error);
            this.showErrorState(favoritesGrid);
        }
    }

    static createFavoriteCard(artwork) {
        // Get category name, defaulting to Oil Painting if not set
        const categoryName = artwork.category || 'Oil Painting';
        
        return `
            <div class="artwork-card transform transition-all duration-300 hover:-translate-y-2">
                <div class="relative group rounded-xl overflow-hidden bg-white dark:bg-gray-900 border border-black/10 dark:border-white/10 shadow-lg hover:shadow-xl transition-all">
                    <div class="aspect-[4/5] relative overflow-hidden">
                        <img src="${artwork.image_url}" alt="${artwork.title}" 
                             class="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-110">
                        <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>

                    <div class="absolute bottom-0 left-0 right-0 p-6 text-white transform translate-y-6 transition-transform duration-300 group-hover:translate-y-0">
                        <div class="space-y-2 mb-4">
                            <h4 class="text-xl font-bold line-clamp-2 drop-shadow-md">${artwork.title}</h4>
                            <p class="text-sm text-white/90 line-clamp-2">${artwork.description}</p>
                        </div>

                        <div class="flex items-center gap-3 text-sm text-white/80">
                            <span class="px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm flex items-center gap-2">
                                <i class="fas fa-palette"></i>
                                ${categoryName}
                            </span>
                            ${artwork.price ? `
                                <span class="flex items-center gap-1">
                                    <i class="fas fa-tag"></i>
                                    $${parseFloat(artwork.price).toFixed(2)}
                                </span>
                            ` : ''}
                        </div>

                    </div>
                </div>
            </div>
        `;
    }

    static showLoadingState(container) {
        container.innerHTML = `
            <div class="col-span-full">
                <div class="animate-pulse grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    ${Array(6).fill(0).map(() => `
                        <div class="bg-gray-100 dark:bg-gray-800 rounded-xl aspect-[4/5]"></div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    static showEmptyState(container) {
        container.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-16">
                <div class="w-24 h-24 mb-6 rounded-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
                    <i class="fas fa-heart text-4xl text-gray-400"></i>
                </div>
                <h3 class="text-xl font-bold mb-2">No Favorites Yet</h3>
                <p class="text-gray-500 dark:text-gray-400 mb-6 text-center max-w-md">
                    Start adding artworks to your favorites by clicking the heart icon on any artwork.
                </p>
                <button onclick="showSection('artworks')" 
                        class="btn-primary">
                    <i class="fas fa-images"></i>
                    Browse Artworks
                </button>
            </div>
        `;
    }

    static showErrorState(container) {
        container.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-16">
                <div class="w-24 h-24 mb-6 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                    <i class="fas fa-exclamation-circle text-4xl text-red-500"></i>
                </div>
                <h3 class="text-xl font-bold mb-2">Failed to Load Favorites</h3>
                <p class="text-gray-500 dark:text-gray-400 mb-6 text-center max-w-md">
                    There was an error loading your favorites. Please try again.
                </p>
                <button onclick="FavoritesManager.loadFavorites()" 
                        class="btn-secondary">
                    <i class="fas fa-sync-alt"></i>
                    Try Again
                </button>
            </div>
        `;
    }

    static async checkFavoriteStatus(artworkId) {
        try {
            const response = await fetch(`/api/artwork/favorite/check/${artworkId}`, {
                credentials: 'include'
            });
            const data = await response.json();

            const favoriteIcon = document.getElementById('favoriteIcon');
            if (data.success && data.isFavorited) {
                favoriteIcon.classList.add('text-red-500');
            } else {
                favoriteIcon.classList.remove('text-red-500');
            }
        } catch (error) {
            console.error('Error checking favorite status:', error);
        }
    }

    static async toggleFavorite(artworkId) {
        const favoriteIcon = document.getElementById('favoriteIcon');
        
        try {
            const isFavorited = favoriteIcon.classList.contains('text-red-500');
            const method = isFavorited ? 'DELETE' : 'POST';
            
            const response = await fetch(`/api/artwork/favorite/${artworkId}`, {
                method,
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            
            if (data.success) {
                if (isFavorited) {
                    favoriteIcon.classList.remove('text-red-500');
                    console.log('Removed from favorites');
                } else {
                    favoriteIcon.classList.add('text-red-500');
                    console.log('Added to favorites');
                }
                
                // Refresh favorites grid if we're on the favorites section
                if (!document.getElementById('favorites').classList.contains('hidden')) {
                    this.loadFavorites();
                }
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Error toggling favorite:', error);
            console.error(`Failed to update favorites: ${error.message}`);
        }
    }
}

// Initialize favorites functionality
document.addEventListener('DOMContentLoaded', () => {
    // Load favorites on initial load and when the favorites section is shown
    FavoritesManager.loadFavorites(); // Load on DOMContentLoaded
    document.querySelector('[data-section="favorites"]').addEventListener('click', () => {
        FavoritesManager.loadFavorites();
    });
});

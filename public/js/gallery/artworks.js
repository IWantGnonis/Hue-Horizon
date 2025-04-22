import { FavoritesManager } from './favorites.js'; // Assuming FavoritesManager is exported
import { NotificationManager } from '../utils/notifications.js'; // Assuming NotificationManager exists
import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm'; // Import GSAP

export const ArtworkManager = { // Add export
    async loadArtworks(categoryName) {
        const sections = {
            artworks: document.getElementById('artworksSection'),
            categories: document.getElementById('categories'),
            grid: document.getElementById('artworksGrid'),
            title: document.getElementById('categoryTitle'),
            count: document.getElementById('artworkCount'),
            description: document.getElementById('categoryDescription') // Assuming this exists
        };

        try {
            this.switchToArtworksView(sections, categoryName);
            this.showLoadingState(sections.grid);

            const [artworksData, favorites, categoryInfo] = await Promise.all([
                this.fetchArtworks(categoryName),
                FavoritesManager.getFavorites(), // Assuming this returns an array of favorite IDs
                this.fetchCategoryInfo(categoryName)
            ]);

            if (artworksData.success && artworksData.artworks.length > 0) {
                this.renderArtworks(sections, artworksData.artworks, favorites, categoryInfo);
            } else {
                this.renderEmptyState(sections, categoryInfo);
            }
        } catch (error) {
            console.error('Error loading artworks:', error);
            this.renderError(sections, categoryName);
        }
    },

    switchToArtworksView(sections, categoryName) {
        sections.categories.classList.add('hidden');
        sections.artworks.classList.remove('hidden');
        sections.title.textContent = categoryName;
    },

    async fetchCategoryInfo(categoryName) {
        try {
            // Fetch all categories once and find the specific one
            const response = await fetch('/api/artwork/gallery-categories'); // Use the correct endpoint
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            if (!data.success) throw new Error(data.error || 'Failed to fetch category info');
            return data.categories.find(cat => cat.name.toLowerCase() === categoryName.toLowerCase());
        } catch (error) {
            console.error('Error fetching category info:', error);
            return null; // Return null if category info fails
        }
    },

    async fetchArtworks(categoryName) {
        try {
            let endpoint;
            if (categoryName.toLowerCase() === 'all') {
                endpoint = '/api/artwork/all';
            } else {
                endpoint = `/api/artwork/category/${encodeURIComponent(categoryName)}`;
            }

            const response = await fetch(endpoint);
            if (!response.ok) {
                if (response.status === 404) {
                    return { success: true, artworks: [] }; // Handle 404 gracefully
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch artworks');
            }

            // Fetch user data for each artwork and merge it into the artworks array
            const artworksWithUserData = await Promise.all(data.artworks.map(async (artwork) => {
                try {
                    const userResponse = await fetch(`/api/user/profile/${artwork.user_id}`);
                    if (!userResponse.ok) {
                        throw new Error(`HTTP error! status: ${userResponse.status}`);
                    }
                    const userData = await userResponse.json();
                    return { ...artwork, user: userData.user }; // Note: userData.user to match the response structure
                } catch (error) {
                    console.error('Error fetching user data for artwork:', artwork.id, error);
                    return { ...artwork, user: null };
                }
            }));

            return { ...data, artworks: artworksWithUserData };
        } catch (error) {
            console.error('Error fetching artworks:', error);
            NotificationManager.show('error', `Failed to load artworks: ${error.message}`);
            throw error; // Re-throw error to be caught in loadArtworks
        }
    },

    renderArtworks(sections, artworks, favorites, categoryInfo) {
        this.artworksData = artworks; // Store the artworks data
        sections.count.textContent = `(${artworks.length} artworks)`;
        if (categoryInfo && sections.description) {
            sections.description.textContent = categoryInfo.description || '';
        } else if (sections.description) {
            sections.description.textContent = ''; // Clear description if no category info
        }
        sections.grid.innerHTML = artworks.map(artwork =>
            this.createArtworkCard(artwork.id, artwork, favorites)
        ).join('');

        // Attach listeners after rendering
        this.attachArtworkCardListeners(sections.grid);

        // Animate artwork cards after rendering
        gsap.to(sections.grid.querySelectorAll(".artwork-card"), { 
            opacity: 1, 
            y: 0, 
            stagger: 0.1, 
            duration: 0.5, 
            ease: 'power2.out',
            delay: 0.1 // Shorter delay than categories
        });

        // TODO: Fetch and display color palettes and related artworks if needed
    },

    createArtworkCard(artworkId, artwork, favorites = []) {
        const isFavorited = Array.isArray(favorites) && favorites.some(fav => fav.artwork_id === artworkId);
        // Use Picsum placeholder if no image_url
        const imageUrl = artwork.image_url || 
            `https://picsum.photos/id/${Math.floor(Math.random() * 1000)}/800/600`;
        
        return `
        <div class="artwork-card relative rounded-lg shadow-lg opacity-0 mb-4 break-inside-avoid" data-artwork-id="${artworkId}">
            <div>
                <img src="${imageUrl}" alt="${artwork.title}" class="w-full object-cover">
            </div>
            <div class="artwork-overlay absolute inset-0 flex flex-col justify-end p-4">
                <h3 class="text-lg text-white font-semibold mb-1">${artwork.title || 'Untitled'}</h3>
                <p class="text-gray-200 text-sm mb-2">${artwork.description || 'No description'}</p>
                <div class="flex justify-between items-center">
                    <div class="flex items-center space-x-4">
                        <span class="text-gray-300 text-sm">${artwork.views || 0} views</span>
                    </div>
                    <div class="flex items-center space-x-2">
                        ${artwork.user ? 
                            `<img src="${artwork.user.avatar_url || '/Images/default-profile.jpg'}" 
                                  alt="${artwork.user.full_name || 'Unknown Artist'}" 
                                  class="w-6 h-6 rounded-full">
                             <span class="text-gray-300 text-sm">${artwork.user.full_name || 'Unknown Artist'}</span>` :
                            `<img src="/Images/default-profile.jpg" 
                                  alt="Unknown Artist" 
                                  class="w-6 h-6 rounded-full">
                             <span class="text-gray-300 text-sm">Unknown Artist</span>`}
                    </div>
                    <div class="flex flex-col ml-2">
                        ${artwork.user?.description ? 
                            `<p class="text-gray-300 text-xs max-w-[100px] truncate">${artwork.user.description}</p>` : ''}
                    </div>
                    <button
                        data-action="toggle-favorite"
                        data-artwork-id="${artworkId}"
                        class="favorite-btn p-2 rounded-full">
                        <i class="fas fa-heart ${isFavorited ? 'text-red-500' : 'text-white'}"></i>
                    </button>
                </div>
            </div>
        </div>
        `;
    },

    // Method to attach listeners to artwork cards
    attachArtworkCardListeners(gridElement) {
        gridElement.querySelectorAll('[data-action="toggle-favorite"]').forEach(button => {
            button.addEventListener('click', (event) => {
                const artworkId = button.dataset.artworkId;
                FavoritesManager.toggleFavorite(event, artworkId); // Call FavoritesManager method
            });
        });

        // Add click handler for artwork cards
        gridElement.querySelectorAll('.artwork-card').forEach(card => {
            card.addEventListener('click', (event) => {
                if (!event.target.closest('[data-action="toggle-favorite"]')) {
                    const artworkId = card.dataset.artworkId;
                    // Find the artwork data directly from the card
                    const artwork = this.artworksData.find(a => a.id === artworkId);
                    if (artwork) {
                        this.showFullSizeImage(artwork, artwork.user);
                    }
                }
            });
        });
    },

    findArtworkById(artworkId) {
        // Example implementation - adjust according to your data structure
        return this.artworksData.find(artwork => artwork.id === artworkId);
    },

    async findUserByArtworkId(artworkId) {
        // First find the artwork to get the user_id
        const artwork = this.findArtworkById(artworkId);
        if (!artwork) return null;
        
        try {
            const response = await fetch(`/api/user/profile/${artwork.user_id}`);
            if (!response.ok) {
                if (response.status === 404) {
                    // Return a default user object if not found
                    return {
                        id: artwork.user_id,
                        username: 'unknown_user',
                        full_name: 'Unknown Artist',
                        avatar_url: '/Images/default-profile.jpg',
                        description: 'No user description available'
                    };
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const userData = await response.json();
            return userData.user; // Note: userData.user to match the response structure
        } catch (error) {
            console.error('Error fetching user data:', error);
            NotificationManager.show('error', 'Failed to load artist information');
            return null;
        }
    },

    showFullSizeImage(artwork, user) {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4';
        modal.innerHTML = `
            <button onclick="ArtworkManager.closeArtworkViewModal()" 
                class="absolute right-4 top-4 p-4 w-16 rounded-full bg-[#e5e7eb] shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all group">
                <i class="fas fa-times text-gray-800 dark:text-gray-800 text-2xl group-hover:rotate-90 transition-transform duration-300"></i>
            </button>
            <div class="relative flex max-w-5xl w-full bg-white rounded-lg overflow-hidden">
                <div class="w-auto p-0">
                    <img src="${artwork.image_url}" class="w-full h-full object-contain max-h-[80vh]">
                </div>
                
                <div class="w-1/4 p-4 flex flex-col">
                    <div class="mb-4">
                        <h2 class="text-xl font-bold">${artwork.title || 'Untitled'}</h2>
                        <p class="text-sm text-gray-700 mt-1">${artwork.description || 'No description'}</p>
                    </div>
                    
                    <div class="mt-auto border-t pt-4">
                        <div class="flex items-center">
                            ${user && user.avatar_url ? 
                                `<img src="${user.avatar_url}" class="w-8 h-8 rounded-full mr-2">` : 
                                '<img src="/Images/default-profile.jpg" class="w-8 h-8 rounded-full mr-2">'}
                            <div>
                                <h3 class="text-sm font-medium">${user?.full_name || 'Unknown Artist'}</h3>
                                ${user?.username ? `<p class="text-xs text-gray-500">@${user.username}</p>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add close handler
        modal.querySelector('button').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        // Add to DOM
        document.body.appendChild(modal);
    },

    showLoadingState(gridElement) {
        gridElement.innerHTML = Array(6).fill(`
            <div class="artwork-card animate-pulse">
                <div class="relative overflow-hidden rounded-lg shadow-lg bg-gray-200 h-64"></div>
                <div class="mt-4 space-y-3">
                    <div class="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div class="h-3 bg-gray-200 rounded w-full"></div>
                    <div class="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
            </div>
        `).join('');
    },

    renderError(sections, categoryName) {
        sections.count.textContent = '';
        if (sections.description) sections.description.textContent = '';
        sections.grid.innerHTML = `
            <div class="col-span-full text-center py-8">
                <div class="text-red-500 mb-4">
                    <i class="fas fa-exclamation-circle text-4xl"></i>
                </div>
                <h3 class="text-xl font-semibold mb-2">Failed to Load Artworks</h3>
                <p class="text-gray-600 mb-4">We couldn't load the artworks for ${categoryName}. Please try again later.</p>
                <button
                    data-action="retry-load"
                    data-category-name="${categoryName}"
                    class="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors"
                >
                    Try Again
                </button>
            </div>
        `;
        // Attach listener for the retry button
        this.attachErrorButtonListeners(sections.grid);
    },

    // Method to attach listener to the error retry button
    attachErrorButtonListeners(gridElement) {
        const retryButton = gridElement.querySelector('[data-action="retry-load"]');
        if (retryButton) {
            retryButton.addEventListener('click', () => {
                const categoryName = retryButton.dataset.categoryName;
                this.loadArtworks(categoryName); // Call loadArtworks again
            });
        }
    },

    renderEmptyState(sections, categoryInfo) {
        sections.count.textContent = '(0 artworks)';
        if (categoryInfo && sections.description) {
            sections.description.textContent = categoryInfo.description || '';
        } else if (sections.description) {
            sections.description.textContent = ''; // Clear description
        }
        sections.grid.innerHTML = `
            <div class="col-span-full text-center py-8">
                <div class="text-gray-400 mb-4">
                    <i class="fas fa-image text-4xl"></i>
                </div>
                <h3 class="text-xl font-semibold mb-2">No Artworks Found</h3>
                <p class="text-gray-600">There are no artworks in this category yet.</p>
                ${categoryInfo?.description ? `<p class="text-gray-500 mt-4">${categoryInfo.description}</p>` : ''}
            </div>
        `;
    },

    // Featured artworks logic (assuming it exists and works similarly)
    async loadFeaturedArtworks() {
        const featuredGrid = document.getElementById('featuredGrid');
        if (!featuredGrid) return; // Guard clause

        try {
            this.showLoadingState(featuredGrid);

            const [artworksData, favorites] = await Promise.all([
                this.fetchFeaturedArtworks(),
                FavoritesManager.getFavorites() // Assuming this works
            ]);

            if (artworksData.success && artworksData.artworks.length > 0) {
                featuredGrid.innerHTML = artworksData.artworks.map(artwork =>
                    this.createArtworkCard(artwork.id, artwork, favorites)
                ).join('');
                this.attachArtworkCardListeners(featuredGrid); // Attach listeners for featured cards
                // TODO: Add animations if needed (e.g., GalleryAnimations.staggerCards)
            } else {
                featuredGrid.innerHTML = `<p class="text-gray-500">No featured artworks found.</p>`;
            }
        } catch (error) {
            console.error('Error loading featured artworks:', error);
            featuredGrid.innerHTML = `<p class="text-red-500">Failed to load featured artworks.</p>`;
        }
    },

    async fetchFeaturedArtworks() {
        // Assuming an endpoint like /api/artwork/featured exists
        try {
            const response = await fetch('/api/artwork/featured'); // Adjust endpoint if needed
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch featured artworks');
            }
            return data;
        } catch (error) {
            console.error('Error fetching featured artworks:', error);
            NotificationManager.show('error', `Failed to load featured artworks: ${error.message}`);
            throw error;
        }
    },

    async loadAllArtworks() {
        try {
            const data = await this.fetchArtworks('all');
            const container = document.getElementById('allArtworksGrid');
            if (!container) return;
            
            this.artworksData = data.artworks; // Store the artworks data
            container.innerHTML = data.artworks.map(artwork => 
                this.createAllArtworkCard(artwork.id, artwork)
            ).join('');

            this.attachArtworkCardListeners(container);

            // Animate cards
            gsap.to(container.querySelectorAll(".artwork-card"), { 
                opacity: 1, 
                y: 0, 
                stagger: 0.1, 
                duration: 0.5, 
                ease: 'power2.out',
                delay: 0.1
            });
        } catch (error) {
            console.error('Error loading all artworks:', error);
            const container = document.getElementById('allArtworksGrid');
            if (container) {
                container.innerHTML = `<p class="text-red-500">Failed to load artworks.</p>`;
            }
        }
    },

    createAllArtworkCard(artworkId, artwork) {
        // Use Picsum placeholder if no image_url
        const imageUrl = artwork.image_url || 
            `https://picsum.photos/id/${Math.floor(Math.random() * 1000)}/800/600`;
        
        return `
        <div class="artwork-card relative rounded-lg shadow-lg opacity-0 mb-4 break-inside-avoid" data-artwork-id="${artworkId}">
            <div>
                <img src="${imageUrl}" alt="${artwork.title}" class="w-full object-cover">
            </div>
            <div class="artwork-overlay absolute inset-0 flex flex-col justify-end p-4">
                <h3 class="text-lg text-white font-semibold mb-1">${artwork.title || 'Untitled'}</h3>
                <p class="text-gray-200 text-sm mb-2">${artwork.description || 'No description'}</p>
                <div class="flex justify-between items-center">
                    <div class="flex items-center space-x-2">
                        ${artwork.user ? 
                            `<img src="${artwork.user.avatar_url || '/Images/default-profile.jpg'}" 
                                  alt="${artwork.user.full_name || 'Unknown Artist'}" 
                                  class="w-6 h-6 rounded-full">
                             <span class="text-gray-300 text-sm">${artwork.user.full_name || 'Unknown Artist'}</span>` :
                            `<img src="/Images/default-profile.jpg" 
                                  alt="Unknown Artist" 
                                  class="w-6 h-6 rounded-full">
                             <span class="text-gray-300 text-sm">Unknown Artist</span>`}
                    </div>
                    <div class="flex flex-col ml-2">
                        ${artwork.user?.description ? 
                            `<p class="text-gray-300 text-xs max-w-[100px] truncate">${artwork.user.description}</p>` : ''}
                    </div>
                </div>
            </div>
        </div>
        `;
    }
};

// Initialization logic should be handled by the script that imports this module (e.g., gallery.js)

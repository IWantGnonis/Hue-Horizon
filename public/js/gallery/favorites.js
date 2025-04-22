export const FavoritesManager = {
    async getFavorites() {
        try {
            const response = await fetch('/api/artwork/favorites');
            if (!response.ok) {
                // If not logged in or other error, return empty array
                return [];
            }
            const data = await response.json();
            return data.success ? data.favorites.map(fav => fav.id) : [];
        } catch (error) {
            console.error('Error fetching favorites:', error);
            return []; // Return empty array on error
        }
    },

    async toggleFavorite(event, artworkId) {
        try {
            // Prevent default anchor behavior
            if (event) event.preventDefault();
            
            const icon = event?.target?.closest('button')?.querySelector('i.fa-heart');
            const isFavorite = icon?.classList.contains('text-red-500');
            const method = isFavorite ? 'DELETE' : 'POST';

            const response = await fetch(`/api/artwork/${artworkId}/favorite`, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include' // Important for session cookies
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to update favorite status');
            }
            
            if (data.success) {
                // Toggle heart color
                if (icon) {
                    icon.classList.toggle('text-red-500');
                    icon.classList.toggle('text-white');
                }
                
                // Update the favorite count in the UI
                const artworkIdNum = parseInt(artworkId, 10);
                const artwork = data.artwork
                
                //Update in the user dashboard
                const favCountElement = document.getElementById(`favCount-${artworkIdNum}`);
                if (favCountElement) {
                  favCountElement.textContent = artwork.favorites;
                }

                //Update in the marketplace
                const allArtworks = document.querySelectorAll(`[onclick*="toggleFavorite(event, '${artworkIdNum}')"]`);
                allArtworks.forEach(artworkElement => {
                    const viewsElement = artworkElement.parentNode.querySelector('div > span:nth-child(1)');
                    if(viewsElement) {
                        const currentText = viewsElement.textContent;
                        const newViews = currentText.replace(/\d+/, artwork.views);
                        viewsElement.textContent = newViews
                    }

                    const favCountElement = artworkElement.parentNode.querySelector('div > span:nth-child(2)');
                    if (favCountElement) {
                        favCountElement.textContent = `${artwork.favorites} favorites`;
                    }
                });
            } else {
                throw new Error(data.error || 'Failed to update favorite');
            }
        } catch (error) {
            console.error('Error toggling favorite:', error);
            console.error('Failed to update favorite. Please try again.');
        }
    }
};

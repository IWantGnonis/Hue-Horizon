// Admin Artwork Management
document.addEventListener('DOMContentLoaded', () => {
    const artworkTable = document.getElementById('artwork-table');
    const loadingIndicator = document.getElementById('loading');
    const errorDisplay = document.getElementById('error');

    // Check if elements exist before proceeding
    if (!artworkTable || !loadingIndicator || !errorDisplay) {
        console.error('Required elements not found');
        return;
    }

    // Fetch all artworks
    async function fetchArtworks() {
        try {
            loadingIndicator.classList.remove('hidden');
            errorDisplay.classList.add('hidden');
            
            const response = await fetch('/api/admin/artworks', {
                credentials: 'include'
            });
            const data = await response.json();
            
            if (data.success) {
                renderArtworks(data.artworks);
            } else {
                showError(data.error || 'Failed to load artworks');
            }
        } catch (error) {
            console.error('Fetch artworks error:', error);
            showError('Failed to load artworks');
        } finally {
            loadingIndicator.classList.add('hidden');
        }
    }

    // Render artworks in table
    function renderArtworks(artworks) {
        const tbody = artworkTable.querySelector('tbody');
        tbody.innerHTML = '';

        artworks.forEach(artwork => {
            const row = document.createElement('tr');
            row.className = 'border-b border-black dark:border-white';
            row.innerHTML = `
                <td class="p-4">${artwork.title}</td>
                <td class="p-4">${artwork.artist.full_name}</td>
                <td class="p-4">
                    <span class="status-badge ${getStatusClass(artwork.status)}">
                        ${getStatusText(artwork.status)}
                    </span>
                </td>
                <td class="p-4">
                    <div class="flex gap-2">
                        <button class="p-2 bg-red-600 text-white rounded hover:bg-red-700 delete-btn">
                            Delete
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
            
            // Attach event listener to delete button
            row.querySelector('.delete-btn').addEventListener('click', () => {
                deleteArtwork(artwork.id);
            });
        });
    }

    function getStatusClass(status) {
        return {
            'active': 'status-active',
            'inactive': 'status-inactive'
        }[status] || 'status-active';
    }

    function getStatusText(status) {
        return {
            'active': 'Active',
            'inactive': 'Inactive'
        }[status] || 'Active';
    }

    function showError(message) {
        errorDisplay.textContent = message;
        errorDisplay.classList.remove('hidden');
    }

    // Delete artwork function
    async function deleteArtwork(artworkId) {
        if (!confirm('Are you sure you want to delete this artwork?')) return;
        
        try {
            const response = await fetch(`/api/artwork/${artworkId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            const data = await response.json();
            if (data.success) {
                window.location.reload();
            } else {
                alert('Error deleting artwork: ' + (data.error || ''));
            }
        } catch (error) {
            console.error('Delete artwork error:', error);
            alert('Error deleting artwork');
        }
    }

    // Initialize
    fetchArtworks();
});

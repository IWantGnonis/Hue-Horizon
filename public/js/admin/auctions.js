// Admin Auctions Management
document.addEventListener('DOMContentLoaded', () => {
    const auctionsTable = document.getElementById('auctions-table');
    const loadingIndicator = document.getElementById('loading');
    const errorDisplay = document.getElementById('error');
    const searchInput = document.getElementById('search-input');

    // Check if elements exist before proceeding
    if (!auctionsTable || !loadingIndicator || !errorDisplay || !searchInput) {
        console.error('Required elements not found');
        return;
    }

    // Fetch all auctions
    async function fetchAuctions(searchTerm = '') {
        try {
            loadingIndicator.classList.remove('hidden');
            errorDisplay.classList.add('hidden');
            
            const response = await fetch(`/api/admin/auctions?search=${searchTerm}`, {
                credentials: 'include'
            });
            const data = await response.json();
            
            if (data.success) {
                renderAuctions(data.auctions);
            } else {
                showError(data.error || 'Failed to load auctions');
            }
        } catch (error) {
            console.error('Fetch auctions error:', error);
            showError('Failed to load auctions');
        } finally {
            loadingIndicator.classList.add('hidden');
        }
    }

    // Render auctions in table
    function renderAuctions(auctions) {
        const tbody = auctionsTable.querySelector('tbody');
        tbody.innerHTML = '';

        auctions.forEach(auction => {
            const row = document.createElement('tr');
            row.className = 'border-b border-black dark:border-white';
            row.innerHTML = `
                <td class="p-4">${auction.artwork.title}</td>
                <td class="p-4">${auction.current_bid}</td>
                <td class="p-4">${auction.current_bidder?.full_name || '-'}</td>
                <td class="p-4">${new Date(auction.end_time).toLocaleString()}</td>
                <td class="p-4">
                    <div class="flex gap-2">
                        <button class="p-2 bg-black dark:bg-white text-white dark:text-black rounded hover:opacity-80">
                            View
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    function showError(message) {
        errorDisplay.textContent = message;
        errorDisplay.classList.remove('hidden');
    }

    // Handle search input
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.trim();
        fetchAuctions(searchTerm);
    });

    // Initialize
    fetchAuctions();
});

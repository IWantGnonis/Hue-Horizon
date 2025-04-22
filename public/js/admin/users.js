// Admin Users Management
document.addEventListener('DOMContentLoaded', () => {
    const usersTable = document.getElementById('users-table');
    const loadingIndicator = document.getElementById('loading');
    const errorDisplay = document.getElementById('error');
    const searchInput = document.getElementById('search-input');

    // Check if elements exist before proceeding
    if (!usersTable || !loadingIndicator || !errorDisplay || !searchInput) {
        console.error('Required elements not found');
        return;
    }

    // Fetch all users
    async function fetchUsers(searchTerm = '') {
        try {
            loadingIndicator.classList.remove('hidden');
            errorDisplay.classList.add('hidden');
            
            const response = await fetch(`/api/admin/users?search=${searchTerm}`, {
                credentials: 'include'
            });
            const data = await response.json();
            
            if (data.success) {
                renderUsers(data.users);
            } else {
                showError(data.error || 'Failed to load users');
            }
        } catch (error) {
            console.error('Fetch users error:', error);
            showError('Failed to load users');
        } finally {
            loadingIndicator.classList.add('hidden');
        }
    }

    // Render users in table
    function renderUsers(users) {
        const tbody = usersTable.querySelector('tbody');
        tbody.innerHTML = '';

        users.forEach(user => {
            const row = document.createElement('tr');
            row.className = 'border-b border-black dark:border-white';
            row.innerHTML = `
                <td class="p-4">
                    <div class="flex items-center gap-3">
                        <img src="${user.avatar_url || 'https://picsum.photos/seed/user1/40'}" 
                             alt="User" class="w-10 h-10 rounded-full">
                        <div>
                            <div class="font-bold">${user.full_name || user.email.split('@')[0]}</div>
                            <div class="text-gray-600 dark:text-gray-400 text-sm">${user.email}</div>
                        </div>
                    </div>
                </td>
                <td class="p-4">
                    <span class="status-badge ${getStatusClass(user.is_banned)}">
                        ${getStatusText(user.is_banned)}
                    </span>
                </td>
                <td class="p-4">-</td>
                <td class="p-4">
                    <div class="flex gap-2">
                        <button class="p-2 bg-black dark:bg-white text-white dark:text-black rounded hover:opacity-80">
                            View
                        </button>
                        ${user.is_banned ? 
                            `<button class="p-2 bg-green-600 text-white rounded hover:bg-green-700 unban-btn">
                                Unban
                            </button>` : 
                            `<button class="p-2 bg-red-600 text-white rounded hover:bg-red-700 ban-btn">
                                Ban
                            </button>`}
                    </div>
                </td>
            `;
            tbody.appendChild(row);
            
            // Attach event listeners
            row.querySelector('.ban-btn')?.addEventListener('click', () => {
                banUser(user.id, user.email);
            });
            row.querySelector('.unban-btn')?.addEventListener('click', () => {
                unbanUser(user.id, user.email);
            });
        });
    }

    function getStatusClass(isBanned) {
        return isBanned ? 'status-banned' : 'status-active';
    }

    function getStatusText(isBanned) {
        return isBanned ? 'Banned' : 'Active';
    }

    function showError(message) {
        errorDisplay.textContent = message;
        errorDisplay.classList.remove('hidden');
    }

    // Handle search input
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.trim();
        fetchUsers(searchTerm);
    });

    // Ban/Unban functions
    async function banUser(userId, email) {
        if (!confirm(`Are you sure you want to ban ${email || 'this user'}?`)) return;
        
        try {
            const response = await fetch('/admin/ban-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId, email }),
                credentials: 'include'
            });

            const data = await response.json();
            if (data.success) {
                window.location.reload();
            } else {
                alert('Error banning user: ' + (data.error || ''));
            }
        } catch (error) {
            console.error('Ban error:', error);
            alert('Error banning user');
        }
    }

    async function unbanUser(userId, email) {
        if (!confirm(`Are you sure you want to unban ${email || 'this user'}?`)) return;
        
        try {
            const response = await fetch('/admin/unban-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId, email }),
                credentials: 'include'
            });

            const data = await response.json();
            if (data.success) {
                window.location.reload();
            } else {
                alert('Error unbanning user: ' + (data.error || ''));
            }
        } catch (error) {
            console.error('Unban error:', error);
            alert('Error unbanning user');
        }
    }

    // Initialize
    fetchUsers();
});

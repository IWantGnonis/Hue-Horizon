// Clear session storage when tab/window closes
window.addEventListener('beforeunload', () => {
    sessionStorage.removeItem('userId');
    sessionStorage.removeItem('authToken');
});

// Dashboard initialization
document.addEventListener('DOMContentLoaded', () => {
    // Logout functionality
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // Clear all client-side storage
                    localStorage.clear();
                    sessionStorage.clear();
                    
                    // Use redirect from server if provided, otherwise default to /login
                    window.location.href = result.redirect || '/login';
                } else {
                    console.error('Logout failed:', result.error);
                    alert('Logout failed. Please try again.');
                }
            } catch (error) {
                console.error('Logout error:', error);
                alert('An error occurred during logout.');
            }
        });
    }

    // Initialize dashboard components
    // Check for user ID in URL and store it
    const urlParams = new URLSearchParams(window.location.search);
    const userIdParam = urlParams.get('userId');
    if (userIdParam) {
        sessionStorage.setItem('userId', userIdParam);
        localStorage.setItem('userId', userIdParam);
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Initialize tab switching
    const navLinks = document.querySelectorAll('[data-section]');
    const sections = document.querySelectorAll('.section');
    
    function showSection(sectionId) {
        sections.forEach(section => {
            section.classList.add('hidden');
        });
        document.getElementById(sectionId)?.classList.remove('hidden');
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = link.dataset.section;
            showSection(sectionId);
            
            // Update active state
            navLinks.forEach(navLink => {
                navLink.classList.remove('bg-blue-100', 'dark:bg-gray-700');
            });
            link.classList.add('bg-blue-100', 'dark:bg-gray-700');
        });
    });

    // Show default section
    showSection('overview');
    document.querySelector('[data-section="overview"]')?.classList.add('bg-blue-100', 'dark:bg-gray-700');
    
    console.log('Dashboard initialized for user:', window.userData);
});

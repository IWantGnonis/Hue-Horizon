document.addEventListener('DOMContentLoaded', () => {
    // Only run on login page
    if (!window.location.pathname.includes('/login')) {
        return;
    }

    const loginForm = document.querySelector('form[onsubmit="return false;"]');
    if (!loginForm) {
        console.error('Login form not found on login page!');
        return;
    }
    
    // Get form elements
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    if (!emailInput || !passwordInput) {
        console.error('Required form fields not found!');
        return;
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = emailInput.value;
        const password = passwordInput.value;

        try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password }),
            credentials: 'include' // Required for cookies
        });

        const data = await response.json();
        
        if (response.ok) {
            // Successful login - redirect to dashboard
            window.location.href = '/dashboard';
        } else {
            alert(data.error || 'Login failed');
        }
        } catch (error) {
            console.error('Login error:', error);
            alert('An error occurred during login');
        }
    });
});

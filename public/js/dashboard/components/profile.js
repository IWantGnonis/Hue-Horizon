import { NotificationManager } from '../../utils/notifications.js'; // Import NotificationManager

// Profile Management
class ProfileManager {
    static initialize() {
        const profileForm = document.getElementById('profileForm');
        const passwordForm = document.getElementById('passwordForm');
        const avatarInput = document.getElementById('avatarInput');
        const avatarPreview = document.getElementById('avatarPreview');
        const avatarDropzone = document.getElementById('avatarDropzone');
        const avatarDropOverlay = document.getElementById('avatarDropOverlay');
        
        // Load user profile when profile section is shown
        document.querySelector('[data-section="profile"]')?.addEventListener('click', () => {
            this.loadUserProfile();
        });

        // Handle avatar upload via file input
        avatarInput?.addEventListener('change', (e) => this.handleAvatarSelect(e, avatarPreview));

        // Handle avatar drag and drop
        if (avatarDropzone) {
            // Prevent default drag behaviors
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                avatarDropzone.addEventListener(eventName, preventDefaults, false);
            });

            function preventDefaults(e) {
                e.preventDefault();
                e.stopPropagation();
            }

            // Highlight drop area when item is dragged over it
            ['dragenter', 'dragover'].forEach(eventName => {
                avatarDropzone.addEventListener(eventName, () => {
                    avatarDropOverlay.classList.remove('hidden');
                    avatarDropOverlay.classList.add('flex');
                }, false);
            });

            // Remove highlight when item is dragged out or dropped
            ['dragleave', 'drop'].forEach(eventName => {
                avatarDropzone.addEventListener(eventName, () => {
                    avatarDropOverlay.classList.add('hidden');
                    avatarDropOverlay.classList.remove('flex');
                }, false);
            });

            // Handle dropped files
            avatarDropzone.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                const files = dt.files;
                
                if (files.length) {
                    avatarInput.files = files;
                    this.handleAvatarSelect({ target: { files } }, avatarPreview);
                }
            }, false);
        }

        // Handle profile form submission
        profileForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            this.handleProfileSubmit(e);
        });

        // Handle password form submission
        passwordForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            this.handlePasswordSubmit(e);
        });

        // Handle password visibility toggle
        document.querySelectorAll('.password-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => this.togglePasswordVisibility(e));
        });

        // Handle input validation
        document.querySelectorAll('input[data-validate]').forEach(input => {
            input.addEventListener('input', (e) => this.validateInput(e.target));
            input.addEventListener('blur', (e) => this.validateInput(e.target));
        });

        // Load user profile on initial load
        this.loadUserProfile();
    }

    static handleAvatarSelect(e, avatarPreview) {
        const file = e.target.files[0];
        const statusElement = document.getElementById('avatarUploadStatus');
        
        if (!file) return;
        
        if (file && file.type.startsWith('image/')) {
            // Show status
            statusElement.classList.remove('hidden');
            
            const reader = new FileReader();
            reader.onload = function(e) {
                avatarPreview.src = e.target.result;
                
                // Animate preview update
                gsap.from(avatarPreview, {
                    scale: 0.8,
                    opacity: 0.5,
                    duration: 0.3,
                    ease: "power2.out"
                });
                
                // Hide status after preview is shown
                statusElement.classList.add('hidden');
            }
            reader.readAsDataURL(file);
            
            // Add a flag to indicate the avatar has been changed
            document.getElementById('profileForm').dataset.avatarChanged = 'true';
        } else if (file) {
            showNotification('Please select an image file (PNG, JPG, or GIF)', 'error');
            statusElement.classList.add('hidden');
        }
    }

    static async loadUserProfile() {
        try {
            // Show loading state
            const profileSection = document.getElementById('profile');
            if (!profileSection) return;
            
            profileSection.classList.add('opacity-50');
            
            const response = await fetch('/api/user/profile', {
                credentials: 'include'
            });
            
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    window.location.href = '/login';
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Profile data loaded:', data);
            
            if (data.success) {
                // Populate form fields
                const profileForm = document.getElementById('profileForm');
                if (profileForm) {
                    profileForm.querySelector('input[name="fullName"]').value = data.user.full_name || '';
                    profileForm.querySelector('textarea[name="bio"]').value = data.user.bio || '';
                    profileForm.querySelector('input[name="location"]').value = data.user.location || '';
                }
                
                // Update avatar
                const avatarPreview = document.getElementById('avatarPreview');
                if (avatarPreview) {
                    if (data.user.avatar_url) {
                        console.log('Setting avatar preview to:', data.user.avatar_url);
                        avatarPreview.src = data.user.avatar_url;
                    } else {
                        console.log('No avatar URL found, using default');
                        avatarPreview.src = '/images/default-avatar.png';
                    }
                }
                
                // Update statistics
                if (data.stats) {
                    document.getElementById('memberSince').textContent = new Date(data.user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                    document.getElementById('totalArtworks').textContent = data.stats.artworks || 0;
                    document.getElementById('totalViews').textContent = data.stats.views?.toLocaleString() || 0;
                    document.getElementById('totalFavorites').textContent = data.stats.favorites?.toLocaleString() || 0;
                }
            } else {
                throw new Error(data.error || 'Failed to load profile');
            }
        } catch (error) {
            console.error('Error loading profile:', error);
            showNotification('Failed to load profile data', 'error');
        } finally {
            // Remove loading state
            const profileSection = document.getElementById('profile');
            if (profileSection) {
                profileSection.classList.remove('opacity-50');
            }
        }
    }

    static togglePasswordVisibility(e) {
        const button = e.currentTarget;
        const input = document.getElementById(button.dataset.target);
        const icon = button.querySelector('i');

        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }

        // Animate icon
        gsap.from(icon, {
            scale: 0.5,
            duration: 0.2,
            ease: "back.out(2)"
        });
    }

    static validateInput(input) {
        const validationType = input.dataset.validate;
        const value = input.value.trim();
        let isValid = true;
        let errorMessage = '';

        switch (validationType) {
            case 'password':
                isValid = value.length >= 8;
                errorMessage = 'Password must be at least 8 characters long';
                break;
            case 'match':
                const targetInput = document.getElementById(input.dataset.matchTarget);
                isValid = value === targetInput.value;
                errorMessage = 'Passwords do not match';
                break;
        }

        const errorElement = input.nextElementSibling;
        if (!isValid && value !== '') {
            input.classList.add('border-red-500');
            if (errorElement && errorElement.classList.contains('error-message')) {
                errorElement.textContent = errorMessage;
                errorElement.classList.remove('hidden');
            }
        } else {
            input.classList.remove('border-red-500');
            if (errorElement && errorElement.classList.contains('error-message')) {
                errorElement.classList.add('hidden');
            }
        }

        return isValid;
    }

    static async handleProfileSubmit(e) {
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnHTML = submitBtn.innerHTML;
        
        try {
            // Show loading state
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Saving...';

            // Create FormData object
            const formData = new FormData(form);
            
            // Make sure the avatar file is included if it was changed
            const avatarInput = document.getElementById('avatarInput');
            if (avatarInput.files.length > 0) {
                // Ensure the file is properly attached to the FormData
                formData.set('avatar', avatarInput.files[0]);
                console.log('Avatar file included in upload:', avatarInput.files[0].name);
            }
            
            // Log the FormData contents for debugging
            console.log('Form data entries:');
            for (let pair of formData.entries()) {
                console.log(pair[0] + ': ' + (pair[1] instanceof File ? 
                    `File: ${pair[1].name} (${pair[1].type}, ${pair[1].size} bytes)` : 
                    pair[1]));
            }
            
            console.log('Sending profile update request...');
            const response = await fetch('/api/user/profile', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            console.log('Response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Profile update response:', data);
            
            if (data.success) {
                // Show success state
                submitBtn.innerHTML = '<i class="fas fa-check mr-2"></i>Saved!';
                submitBtn.classList.add('bg-green-500');
                
                // Update name in navigation if changed
                if (data.fullName) {
                    const nameElement = document.querySelector('.username-display');
                    if (nameElement) {
                        nameElement.textContent = data.fullName;
                    }
                }
                
                // Update avatar in navigation if changed
                if (data.avatarUrl) {
                    console.log('Updating avatar with URL:', data.avatarUrl);
                    const navAvatar = document.querySelector('.nav-avatar');
                    if (navAvatar) {
                        navAvatar.src = data.avatarUrl;
                    }
                    
                    // Also update the preview
                    const avatarPreview = document.getElementById('avatarPreview');
                    if (avatarPreview) {
                        avatarPreview.src = data.avatarUrl;
                    }
                }
                
                showNotification('Profile updated successfully!', 'success');
                
                // Reset button after delay
                setTimeout(() => {
                    submitBtn.innerHTML = originalBtnHTML;
                    submitBtn.classList.remove('bg-green-500');
                    submitBtn.disabled = false;
                }, 2000);
            } else {
                throw new Error(data.error || 'Update failed');
            }
        } catch (error) {
            console.error('Profile update error:', error);
            
            // Show error state
            submitBtn.innerHTML = '<i class="fas fa-exclamation-circle mr-2"></i>Failed';
            submitBtn.classList.add('bg-red-500');
            
            showNotification(error.message, 'error');
            
            // Reset button after delay
            setTimeout(() => {
                submitBtn.innerHTML = originalBtnHTML;
                submitBtn.classList.remove('bg-red-500');
                submitBtn.disabled = false;
            }, 2000);
        }
    }    static async handlePasswordSubmit(e) {
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnHTML = submitBtn.innerHTML;
        
        try {
            // Validate inputs
            const inputs = form.querySelectorAll('input[data-validate]');
            let isValid = true;
            inputs.forEach(input => {
                if (!this.validateInput(input)) {
                    isValid = false;
                }
            });

            if (!isValid) {
                throw new Error('Please fix the validation errors');
            }

            // Show loading state
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Updating...';

            const formData = new FormData(form);
            
            const response = await fetch('/api/user/change-password', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                // Show success state
                submitBtn.innerHTML = '<i class="fas fa-check mr-2"></i>Updated!';
                submitBtn.classList.add('bg-green-500');
                
                // Reset form
                form.reset();
                
                showNotification('Password updated successfully!', 'success');
                
                // Reset button after delay
                setTimeout(() => {
                    submitBtn.innerHTML = originalBtnHTML;
                    submitBtn.classList.remove('bg-green-500');
                    submitBtn.disabled = false;
                }, 2000);
            } else {
                throw new Error(data.error || 'Update failed');
            }
        } catch (error) {
            console.error('Password update error:', error);
            
            // Show error state
            submitBtn.innerHTML = '<i class="fas fa-exclamation-circle mr-2"></i>Failed';
            submitBtn.classList.add('bg-red-500');
            
            showNotification(error.message, 'error');
            
            // Reset button after delay
            setTimeout(() => {
                submitBtn.innerHTML = originalBtnHTML;
                submitBtn.classList.remove('bg-red-500');
                submitBtn.disabled = false;
            }, 2000);
        }
    }
}

// Initialize profile functionality
document.addEventListener('DOMContentLoaded', () => {
    ProfileManager.initialize();
});

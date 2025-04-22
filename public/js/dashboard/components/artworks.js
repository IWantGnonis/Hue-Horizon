// Artwork Management
class ArtworkManager {
    static async loadUserArtworks() {
        const artworksGrid = document.getElementById('artworksGrid');
        
        try {
            // Show loading state with skeleton cards
            this.showLoadingState(artworksGrid);
            
            const response = await fetch('/api/artwork/my-artworks', {
                credentials: 'include'
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            // Also load user profile to get avatar
            this.loadUserAvatar();

            if (data.success && data.artworks.length > 0) {
                artworksGrid.innerHTML = data.artworks.map(artwork => this.createArtworkCard(artwork)).join('');
                
                // Update favorite counts on cards
                data.artworks.forEach(artwork => {
                    const favCountElement = document.getElementById(`favCount-${artwork.id}`);
                    if (favCountElement) {
                        favCountElement.textContent = artwork.favorites;
                    }
                });

                // Animate cards with stagger effect
                gsap.from(".artwork-card", {
                    opacity: 0,
                    y: 50,
                    duration: 1,
                    ease: "power3.out"
                });

                // Add click event listener to artwork cards
                artworksGrid.addEventListener('click', (e) => {
                    const artworkCard = e.target.closest('.artwork-card');
                    if (artworkCard) {
                        const artwork = JSON.parse(artworkCard.dataset.artwork);
                        this.showArtworkViewModal(artwork);
                    }
                });
            } else {
                this.showEmptyState(artworksGrid);
            }
        } catch (error) {
            console.error('Error loading artworks:', error);
            this.showErrorState(artworksGrid);
        }
    }

    static async loadUserAvatar() {
        try {
            const artistAvatar = document.getElementById('artistAvatar');
            const modalArtistAvatar = document.getElementById('modalArtistAvatar');
            const navAvatar = document.querySelector('.nav-avatar');
            
            if (!artistAvatar && !modalArtistAvatar && !navAvatar) return;

            const response = await fetch('/api/user/profile', {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.user.avatar_url) {
                const avatarUrl = data.user.avatar_url;
                
                // Update all avatar instances
                if (artistAvatar) {
                    artistAvatar.src = avatarUrl;
                    artistAvatar.style.display = 'block'; // Ensure it's visible
                }
                
                if (modalArtistAvatar) {
                    modalArtistAvatar.src = avatarUrl;
                    modalArtistAvatar.style.display = 'block';
                }
                
                if (navAvatar) {
                    navAvatar.src = avatarUrl;
                    navAvatar.style.display = 'block';
                }
                
                // Also update the modal preview if it exists
                const avatarModalPreview = document.getElementById('avatarModalPreview');
                if (avatarModalPreview) {
                    avatarModalPreview.src = avatarUrl;
                    avatarModalPreview.style.display = 'block';
                }
            } else {
                // Set default avatar if no custom avatar
                const defaultAvatarUrl = '/images/default-avatar.png';
                [artistAvatar, modalArtistAvatar, navAvatar].forEach(avatar => {
                    if (avatar) {
                        avatar.src = defaultAvatarUrl;
                        avatar.style.display = 'block';
                    }
                });
            }
        } catch (error) {
            console.error('Error loading user avatar:', error);
            // Set default avatar on error
            const defaultAvatarUrl = '/images/default-avatar.png';
            [artistAvatar, modalArtistAvatar, navAvatar].forEach(avatar => {
                if (avatar) {
                    avatar.src = defaultAvatarUrl;
                    avatar.style.display = 'block';
                }
            });
        }
    }

    static createArtworkCard(artwork) {
        return `
            <div class="artwork-card mb-4 transform transition-all duration-300 hover:-translate-y-2"
                 data-artwork='${JSON.stringify(artwork)}'>
                <div class="relative group overflow-hidden bg-white shadow-lg hover:shadow-xl transition-all">
                    <div class="relative overflow-hidden">
                        <img src="${artwork.image_url}" alt="${artwork.title}" 
                             class="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-110">
                        <div class="absolute top-2 right-2 ${artwork.isOwned ? 'bg-blue-500' : 'bg-green-500'} text-white text-xs font-bold px-2 py-1 rounded-full">
                            ${artwork.isOwned ? 'Owned' : 'Purchased'}
                        </div>
                    </div>

                    <div class="absolute bottom-0 left-0 right-0 p-6 text-white transform translate-y-6 transition-transform duration-300 group-hover:translate-y-0 group-hover:bg-black/50">
                        <div class="space-y-2 mb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <h4 class="text-xl font-bold line-clamp-2 drop-shadow-md">${artwork.title}</h4>
                            <p class="text-sm text-white/90 line-clamp-2">${artwork.description || ''}</p>
                        </div>

                        <div class="flex items-center gap-3 text-sm text-white/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <span class="px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm">
                                ${artwork.category}
                            </span>
                            ${artwork.price ? `
                                <span class="flex items-center gap-1">
                                    <i class="fas fa-tag"></i>
                                    ${parseFloat(artwork.price).toFixed(2)}
                                </span>
                            ` : ''}
                            <span class="flex items-center gap-1">
                                <i class="fas fa-eye"></i>
                                ${artwork.views || 0}
                            </span>
                            <span class="flex items-center gap-1">
                                <i class="fas fa-heart"></i>
                                <span id="favCount-${artwork.id}">0</span>
                            </span>
                        </div>

                    </div>
                </div>
            </div>
        `;
    }

    static showArtworkViewModal(artwork) {
        const modal = document.getElementById('artworkViewModal');
        if (!modal) return;

        // Store artwork data and artworkId
        modal.dataset.artwork = JSON.stringify(artwork);

// No SEARCH/REPLACE block needed here as we need to modify deleteArtwork method

        // Reset modal state
        modal.classList.remove('hidden');
        modal.style.opacity = '1';

        // Set artwork image
        const modalImage = document.getElementById('artworkModalImage');
        if (modalImage) modalImage.src = artwork.image_url;
        
        // Set artist name and upload date
        const modalArtistName = document.getElementById('artworkModalArtistName');
        const modalUploadDate = document.getElementById('artworkModalUploadDate');
        
        if (modalArtistName) {
            modalArtistName.textContent = artwork.artist_name || 'Unknown Artist';
        }
        
        const modalArtistLocation = document.getElementById('artworkModalArtistLocation');
        if (modalArtistLocation && artwork.artist_country) {
            modalArtistLocation.textContent = artwork.artist_country;
        } else if (modalArtistLocation) {
            modalArtistLocation.textContent = 'Unknown Location';
        }

        if (modalUploadDate && artwork.created_at) {
            const uploadDate = new Date(artwork.created_at);
            const formattedDate = uploadDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            modalUploadDate.textContent = formattedDate;
        }
        
        // Set title and description
        const modalTitle = document.getElementById('artworkModalTitle');
        const modalDescription = document.getElementById('artworkModalDescription');
        
        if (modalTitle) {
            modalTitle.value = artwork.title;
            modalTitle.readOnly = true;
        }
        
        if (modalDescription) {
            modalDescription.value = artwork.description || 'No description available';
            modalDescription.readOnly = true;
        }
        
        // Set category
        const modalCategory = document.getElementById('artworkModalCategory');
        const modalCategoryInput = document.getElementById('artworkModalCategoryInput');
        if (modalCategory) modalCategory.textContent = artwork.category || 'Uncategorized';
        if (modalCategoryInput) {
            modalCategoryInput.value = artwork.category || '';
            if (!artwork.category && modalCategoryInput.options.length > 0) {
                modalCategoryInput.value = modalCategoryInput.options[0].value;
            }
        }
        
        // Set price section
        const priceSection = document.getElementById('modalPriceSection');
        const sellArtworkToggle = document.getElementById('modalSellArtwork');
        const priceInputSection = document.getElementById('modalPriceInputSection');
        const priceInput = document.getElementById('modalPriceInput');
        
        // Ensure category is selected
        if (!artwork.category && modalCategoryInput) {
            artwork.category = modalCategoryInput.value;
        }

        if (sellArtworkToggle && priceInputSection && priceInput) {
            // Remove any existing event listeners by cloning
            const newSellArtworkToggle = sellArtworkToggle.cloneNode(true);
            sellArtworkToggle.parentNode.replaceChild(newSellArtworkToggle, sellArtworkToggle);
            
            // Set initial state
            if (artwork.price) {
                newSellArtworkToggle.checked = true;
                priceInputSection.classList.remove('hidden');
                priceInput.value = artwork.price;
            } else {
                newSellArtworkToggle.checked = false;
                priceInputSection.classList.add('hidden');
                priceInput.value = '';
            }

            // Add new event listener
            newSellArtworkToggle.addEventListener('change', function() {
                if (this.checked) {
                    priceInputSection.classList.remove('hidden');
                    priceInput.value = priceInput.value || '0.99';
                } else {
                    priceInputSection.classList.add('hidden');
                    priceInput.value = '';
                }
            });
        }

        // Set tags
        const tagsContainer = document.getElementById('modalTags');
        const tagsInput = document.getElementById('modalTagsInput');
        if (tagsContainer && tagsInput) {
            if (artwork.tags && Array.isArray(artwork.tags)) {
                tagsContainer.innerHTML = artwork.tags.map(tag => `
                    <span class="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm">
                        ${tag}
                    </span>
                `).join('');
                tagsInput.value = artwork.tags.join(', ');
            } else {
                tagsContainer.innerHTML = '<span class="text-gray-500 text-sm">No tags</span>';
                tagsInput.value = '';
            }
        }

        // Ensure view mode is active
        const viewModeButtons = document.getElementById('viewModeButtons');
        const editModeButtons = document.getElementById('editModeButtons');
        if (viewModeButtons && editModeButtons) {
            viewModeButtons.classList.remove('hidden');
            editModeButtons.classList.add('hidden');
            editModeButtons.classList.remove('flex');
        }
    }

    static closeArtworkViewModal() {
        const modal = document.getElementById('artworkViewModal');
        if (!modal) return;

        // Animate out
        gsap.to(modal, {
            opacity: 0,
            duration: 0.3,
            ease: "power2.in",
            onComplete: () => {
                modal.classList.add('hidden');
                modal.style.opacity = '1'; // Reset opacity for next time
            }
        });
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
                    <i class="fas fa-images text-4xl text-gray-400"></i>
                </div>
                <h3 class="text-xl font-bold mb-2">No Artworks Yet</h3>
                <p class="text-gray-500 dark:text-gray-400 mb-6 text-center max-w-md">
                    Start sharing your creativity with the world by uploading your first artwork.
                </p>
                <button onclick="showSection('upload')" class="btn-primary">
                    <i class="fas fa-cloud-upload-alt"></i>
                    Upload Your First Artwork
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
                <h3 class="text-xl font-bold mb-2">Failed to Load Artworks</h3>
                <p class="text-gray-500 dark:text-gray-400 mb-6 text-center max-w-md">
                    There was an error loading your artworks. Please try again.
                </p>
                <button onclick="ArtworkManager.loadUserArtworks()" class="btn-secondary">
                    <i class="fas fa-sync-alt"></i>
                    Try Again
                </button>
            </div>
        `;
    }

    // Avatar handling methods
    static initializeAvatarUpload() {
        const artistAvatar = document.getElementById('artistAvatar');
        console.log('Avatar element found:', artistAvatar);
        
        if (artistAvatar) {
            // Remove any existing click listeners
            const newArtistAvatar = artistAvatar.cloneNode(true);
            artistAvatar.parentNode.replaceChild(newArtistAvatar, artistAvatar);
            
            newArtistAvatar.addEventListener('click', (e) => {
                console.log('Avatar clicked');
                const avatarModal = document.getElementById('avatarUploadModal');
                console.log('Modal element:', avatarModal);
                if (avatarModal) {
                    avatarModal.classList.remove('hidden');
                    // Reset modal content opacity and transform
                    const modalContent = avatarModal.querySelector('.modal-content');
                    if (modalContent) {
                        modalContent.style.opacity = '1';
                        modalContent.style.transform = 'translateY(0)';
                    }
                }
            });
        }

        // Initialize other avatar-related elements
        this.initializeAvatarModalElements();
    }

    static initializeAvatarModalElements() {
        const elements = {
            artworkAvatarInput: document.getElementById('artworkAvatarInput'),
            avatarModal: document.getElementById('avatarUploadModal'),
            avatarModalInput: document.getElementById('avatarModalInput'),
            avatarModalPreview: document.getElementById('avatarModalPreview'),
            avatarDropzone: document.getElementById('avatarDropzone'),
            avatarDropOverlay: document.getElementById('avatarDropOverlay'),
            cancelButton: document.getElementById('cancelAvatarUpload'),
            saveButton: document.getElementById('saveAvatar')
        };

        // Handle file input change
        if (elements.artworkAvatarInput) {
            elements.artworkAvatarInput.addEventListener('change', (e) => {
                if (e.target.files.length && elements.avatarModal) {
                    elements.avatarModal.classList.remove('hidden');
                    this.handleAvatarSelect(e, elements.avatarModalPreview);
                }
            });
        }

        // Handle modal file input change
        if (elements.avatarModalInput) {
            elements.avatarModalInput.addEventListener('change', (e) => {
                this.handleAvatarSelect(e, elements.avatarModalPreview);
            });
        }

        // Initialize drag and drop if elements exist
        if (elements.avatarDropzone && elements.avatarDropOverlay) {
            this.initializeAvatarDragAndDrop(elements);
        }

        // Handle cancel button
        if (elements.cancelButton) {
            elements.cancelButton.addEventListener('click', () => {
                this.closeAvatarModal();
            });
        }

        // Handle save button
        if (elements.saveButton) {
            elements.saveButton.addEventListener('click', () => {
                this.uploadAvatar();
            });
        }

        // Handle click outside modal
        if (elements.avatarModal) {
            elements.avatarModal.addEventListener('click', (e) => {
                if (e.target === elements.avatarModal) {
                    this.closeAvatarModal();
                }
            });
        }
    }

    static initializeAvatarDragAndDrop(elements) {
        const preventDefaults = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            elements.avatarDropzone.addEventListener(eventName, preventDefaults, false);
        });

        // Show overlay on drag
        ['dragenter', 'dragover'].forEach(eventName => {
            elements.avatarDropzone.addEventListener(eventName, () => {
                elements.avatarDropOverlay.classList.remove('hidden');
                elements.avatarDropOverlay.classList.add('flex');
            }, false);
        });

        // Hide overlay on drag leave or drop
        ['dragleave', 'drop'].forEach(eventName => {
            elements.avatarDropzone.addEventListener(eventName, () => {
                elements.avatarDropOverlay.classList.add('hidden');
                elements.avatarDropOverlay.classList.remove('flex');
            }, false);
        });

        // Handle file drop
        elements.avatarDropzone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length && elements.avatarModalInput) {
                elements.avatarModalInput.files = files;
                this.handleAvatarSelect({ target: { files } }, elements.avatarModalPreview);
            }
        });
    }

    static handleAvatarSelect(e, previewElement) {
        const file = e.target.files[0];
        const statusElement = document.getElementById('avatarUploadStatus');
        if (!file) return;
        
        if (file && file.type.startsWith('image/')) {
            // Show status
            if (statusElement) statusElement.classList.remove('hidden');
            const reader = new FileReader();
            reader.onload = function(e) {
                if (previewElement) previewElement.src = e.target.result;
                // Animate preview update
                gsap.from(previewElement, {
                    scale: 0.8,
                    opacity: 0.5,
                    duration: 0.3,
                    ease: "power2.out"
                });
                // Hide status after preview is shown
                if (statusElement) statusElement.classList.add('hidden');
            }
            reader.readAsDataURL(file);
        } else if (file) {
            showNotification('Please select an image file (PNG, JPG, or GIF)', 'error');
            if (statusElement) statusElement.classList.add('hidden');
        }
    }

    static async uploadAvatar() {
        const avatarModalInput = document.getElementById('avatarModalInput');
        const saveButton = document.getElementById('saveAvatar');
        const statusElement = document.getElementById('avatarUploadStatus');
        if (!avatarModalInput || !avatarModalInput.files.length) {
            showNotification('Please select an image first', 'error');
            return;
        }

        try {
            // Show loading state
            saveButton.disabled = true;
            saveButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Uploading...';
            if (statusElement) statusElement.classList.remove('hidden');

            // Create form data
            const formData = new FormData();
            formData.append('avatar', avatarModalInput.files[0]);

            // Send request
            const response = await fetch('/api/user/profile', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                // Update all avatar instances
                if (data.avatarUrl) {
                    const artistAvatar = document.getElementById('artistAvatar');
                    if (artistAvatar) artistAvatar.src = data.avatarUrl;

                    // Also update nav avatar if it exists
                    const navAvatar = document.querySelector('.nav-avatar');
                    if (navAvatar) navAvatar.src = data.avatarUrl;
                }
                showNotification('Profile picture updated successfully!', 'success');
                this.closeAvatarModal();
            } else {
                throw new Error(data.error || 'Failed to update profile picture');
            }
        } catch (error) {
            console.error('Error uploading avatar:', error);
            showNotification(error.message, 'error');
        } finally {
            // Reset button state
            saveButton.disabled = false;
            saveButton.innerHTML = 'Save Changes';
            if (statusElement) statusElement.classList.add('hidden');
        }
    }

    static closeAvatarModal() {
        const avatarModal = document.getElementById('avatarUploadModal');
        if (avatarModal) {
            gsap.to(avatarModal.querySelector('div'), {
                opacity: 0,
                y: 20,
                duration: 0.3,
                onComplete: () => {
                    avatarModal.classList.add('hidden');
                }
            });
        }
    }

    static async deleteArtwork() {
        const modal = document.getElementById('artworkViewModal');
        const artwork = JSON.parse(modal.dataset.artwork);
        
        if (!confirm('Are you sure you want to permanently delete this artwork?')) return;
        
        try {
            // Show loading state on button
            const deleteButton = modal.querySelector('button[onclick="ArtworkManager.deleteArtwork()"]');
            if (deleteButton && deleteButton.nodeType === Node.ELEMENT_NODE) {
                deleteButton.disabled = true;
                deleteButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            }

            const artworkId = artwork.id;
            if (!artworkId) {
                throw new Error('Artwork ID is missing');
            }
            // Import notification function
            const { NotificationManager } = await import('/js/utils/notifications.js');
            
            const response = await fetch(`/api/artwork/delete/${artworkId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to delete artwork');
            }

            // Close modal and animate removal
            this.closeArtworkModal();
            const artworkCard = document.querySelector(`[data-artwork-id="${artworkId}"]`);
            
            if (artworkCard) {
                gsap.to(artworkCard, {
                    opacity: 0,
                    y: -20,
                    duration: 0.3,
                    onComplete: () => {
                        artworkCard.remove();
                        NotificationManager.show('Artwork deleted successfully', 'success');
                        this.loadUserArtworks();
                    }
                });
            } else {
                NotificationManager.show('Artwork deleted successfully', 'success');
                this.loadUserArtworks();
            }
        } catch (error) {
            console.error('Error deleting artwork:', error);
            NotificationManager.show(
                error.message.includes('404') ? 
                    'Artwork not found or already deleted' : 
                    `Failed to delete artwork: ${error.message}`,
                'error'
            );
        } finally {
            // Reset button state
            const deleteButton = modal.querySelector('button[onclick="ArtworkManager.deleteArtwork()"]');
            if (deleteButton && deleteButton.nodeType === Node.ELEMENT_NODE) {
                deleteButton.disabled = false;
                deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
            }
        }
    }

    // Helper method to update modal content
    static updateModalContent(artwork) {
        const modal = document.getElementById('artworkModal');
        if (!modal) return;

        // Update the stored artwork data
        modal.dataset.artwork = JSON.stringify(artwork);

        // Update view elements if they exist
        const elements = {
            title: document.getElementById('modalTitle'),
            description: document.getElementById('modalDescription'),
            category: document.getElementById('modalCategory'),
            tags: document.getElementById('modalTags'),
            priceSection: document.getElementById('modalPriceSection'),
            sellArtwork: document.getElementById('modalSellArtwork'),
            priceInputSection: document.getElementById('modalPriceInputSection'),
            priceInput: document.getElementById('modalPriceInput')
        };

        // Update text content for basic fields
        if (elements.title) elements.title.textContent = artwork.title;
        if (elements.description) elements.description.textContent = artwork.description || '';
        if (elements.category) elements.category.textContent = artwork.category;

        // Update tags
        if (elements.tags) {
            elements.tags.innerHTML = artwork.tags && artwork.tags.length ? artwork.tags.map(tag => `
                <span class="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm">
                    ${tag}
                </span>
            `).join('') : '<span class="text-gray-500 text-sm">No tags</span>';
        }

        // Update price section
        if (elements.priceSection && elements.sellArtwork && elements.priceInputSection && elements.priceInput) {
            if (artwork.price) {
                elements.sellArtwork.checked = true;
                elements.priceInputSection.classList.remove('hidden');
                elements.priceInput.value = artwork.price;
            } else {
                elements.sellArtwork.checked = false;
                elements.priceInputSection.classList.add('hidden');
                elements.priceInput.value = '';
            }
        }
    }

    static startEditing() {
        const modal = document.getElementById('artworkViewModal');
        if (!modal) return;

        // Show save button
        const saveBtn = document.getElementById('saveArtworkBtn');
        if (saveBtn) saveBtn.classList.remove('hidden');

        // Make inputs editable and add edit styling
        const titleInput = document.getElementById('artworkModalTitle');
        const descInput = document.getElementById('artworkModalDescription');
        
        if (titleInput) {
            titleInput.readOnly = false;
            titleInput.classList.add( 'border', 'border-gray-300', 'dark:border-gray-600', 'rounded-lg');
            titleInput.focus();
        }
        
        if (descInput) {
            descInput.readOnly = false;
            descInput.classList.add( 'border', 'border-gray-300', 'dark:border-gray-600', 'rounded-lg');
        }
    }

    static async saveChanges() {
        const modal = document.getElementById('artworkViewModal');
        if (!modal) return;

        // Import notification function
        const { NotificationManager } = await import('/js/utils/notifications.js');
        
        const artwork = JSON.parse(modal.dataset.artwork);
        const saveBtn = document.getElementById('saveArtworkBtn');
        
        // Get updated values
        const titleInput = document.getElementById('artworkModalTitle');
        const descInput = document.getElementById('artworkModalDescription');
        
        if (!titleInput || !descInput) {
            console.error('Required input elements not found');
            return;
        }

        // Show loading state
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        }

        try {
            const updatedArtwork = {
                ...artwork,
                title: titleInput.value,
                description: descInput.value
            };

            // Get current category from modal
            const categoryElement = document.getElementById('artworkModalCategory');
            const category = categoryElement ? categoryElement.textContent : 'Oil Painting';

            // Make API call to save changes - using edit endpoint instead
            const response = await fetch(`/api/artwork/edit/${artwork.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    title: updatedArtwork.title,
                    description: updatedArtwork.description,
                    category: category,
                    tags: artwork.tags || [],
                    price: artwork.price || null
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to save artwork');
            }

            // Update stored artwork data only after successful save
            modal.dataset.artwork = JSON.stringify(updatedArtwork);
            NotificationManager.show('Artwork updated successfully!', 'success');

        } catch (error) {
            console.error('Error saving artwork:', error);
            NotificationManager.show(error.message, 'error');
            // Keep inputs editable since save failed
            return;
        } finally {
            // Reset button state
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-check"></i> Save';
                saveBtn.classList.add('hidden');
            }
        }

        // Reset input styling after successful save
        titleInput.readOnly = true;
        titleInput.classList.remove('bg-gray-50', 'dark:bg-gray-800', 'border', 'border-gray-300', 'dark:border-gray-600', 'rounded-lg');
        
        descInput.readOnly = true;
        descInput.classList.remove('bg-gray-50', 'dark:bg-gray-800', 'border', 'border-gray-300', 'dark:border-gray-600', 'rounded-lg');
    }

    static cancelEditing() {
        const modal = document.getElementById('artworkViewModal');
        if (!modal) return;

        // Show view mode buttons, hide edit mode buttons
        const viewModeButtons = document.getElementById('viewModeButtons');
        const editModeButtons = document.getElementById('editModeButtons');
        if (viewModeButtons && editModeButtons) {
            viewModeButtons.classList.remove('hidden');
            editModeButtons.classList.add('hidden');
            editModeButtons.classList.remove('flex');
        }

        // Hide all input fields
        document.querySelectorAll('.hidden-input').forEach(el => {
            el.classList.add('hidden');
        });

        // Show all display fields
        document.querySelectorAll('.display-field').forEach(el => {
            el.classList.remove('hidden');
        });
    }


    static closeArtworkModal() {
        const modal = document.getElementById('artworkViewModal');
        if (!modal) return;

        // Reset the delete button *before* the animation
        const deleteButton = modal.querySelector('button[onclick="ArtworkManager.deleteArtwork()"]');
        if (deleteButton) {
            deleteButton.disabled = false;
        }

        // First reset opacity
        modal.style.opacity = '1';

        // Animate out
        gsap.to(modal, {
            opacity: 0,
            duration: 0.3,
            ease: "power2.in",
            onComplete: () => {
                modal.classList.add('hidden');
                modal.style.opacity = '1'; // Reset opacity for next time

                // Reset edit mode if active
                const editModeButtons = document.getElementById('editModeButtons');
                if (editModeButtons && !editModeButtons.classList.contains('hidden')) {
                    this.cancelEditing();
                }
            }
        });
    }
}

// At the bottom of artworks.js
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing artwork functionality');

    // Load artworks on initial load and when the artworks section is shown
    ArtworkManager.loadUserArtworks(); // Load artworks on DOMContentLoaded
    const artworksTab = document.querySelector('[data-section="artworks"]');
    console.log('Artworks tab element:', artworksTab);
    if (artworksTab) {
        artworksTab.addEventListener('click', () => {
            console.log('Artworks tab clicked');
            ArtworkManager.loadUserArtworks();
        });
    }

    // Initialize avatar upload functionality
    console.log('Initializing avatar upload');
    ArtworkManager.initializeAvatarUpload();
});

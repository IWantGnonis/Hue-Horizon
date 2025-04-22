import { NotificationManager } from '../../utils/notifications.js';

// Upload Management
class UploadManager {
    static initialize() {
        const fileInput = document.querySelector('input[type="file"]');
        const imagePreview = document.getElementById('imagePreview');
        const previewImage = imagePreview.querySelector('img');
        const uploadArea = document.querySelector('.upload-area');
        const uploadForm = document.getElementById('uploadForm');
        const submitButton = document.querySelector('button[type="submit"][form="uploadForm"]');
        const originalButtonHTML = submitButton.innerHTML;
        const sellArtworkToggle = document.getElementById('sellArtwork');
        const priceField = document.getElementById('priceField');
        const priceInput = document.getElementById('priceInput');
        const listForAuctionToggle = document.getElementById('listForAuction');
        const auctionFields = document.getElementById('auctionFields');
        const startingBidInput = document.getElementById('startingBidInput');
        const auctionDurationSelect = document.getElementById('auctionDuration');
        const buyNowPriceInput = document.getElementById('buyNowPriceInput');


        // Handle sell artwork toggle
        if (sellArtworkToggle) {
            sellArtworkToggle.addEventListener('change', () => {
                this.togglePriceField();
            });
        }

        // Handle list for auction toggle
        if (listForAuctionToggle) {
            listForAuctionToggle.addEventListener('change', () => {
                if (listForAuctionToggle.checked) {
                    auctionFields.classList.remove('hidden');
                } else {
                    auctionFields.classList.add('hidden');
                }
            });
        }

        // Handle price input validation
        if (priceInput) {
            priceInput.addEventListener('input', () => {
                this.validatePrice(priceInput);
            });
        }

        // Handle drag and drop
        if (uploadArea) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                uploadArea.addEventListener(eventName, this.preventDefaults, false);
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                uploadArea.addEventListener(eventName, (e) => {
                    this.preventDefaults(e);
                    this.highlight(uploadArea);
                }, false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
                uploadArea.addEventListener(eventName, (e) => {
                    this.preventDefaults(e);
                    this.unhighlight(uploadArea);
                }, false);
            });

            uploadArea.addEventListener('drop', (e) => {
                this.preventDefaults(e);
                this.handleDrop(e, fileInput, previewImage, imagePreview);
            }, false);
        }
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e, previewImage, imagePreview), false);

        // Handle form submission
        uploadForm.addEventListener('submit', async (e) => {
            await this.handleSubmit(e, submitButton, originalButtonHTML);
        });
    }

    static preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    static highlight(uploadArea) {
        uploadArea.querySelector('div').classList.add('border-blue-500', 'bg-blue-500/5');
    }

    static unhighlight(uploadArea) {
        uploadArea.querySelector('div').classList.remove('border-blue-500', 'bg-blue-500/5');
    }

    static handleDrop(e, fileInput, previewImage, imagePreview) {
        const dt = e.dataTransfer;
        const files = dt.files;
        this.handleFiles(files, fileInput, previewImage, imagePreview);
    }

    static handleFiles(files, fileInput, previewImage, imagePreview) {
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                fileInput.files = files;
                this.showPreview(file, previewImage, imagePreview);
            } else {
            NotificationManager.show('Please upload an image file (PNG, JPG, or GIF)', 'error');
            }
        }
    }

    static handleFileSelect(e, previewImage, imagePreview) {
        const file = e.target.files[0];
        if (file) {
            this.showPreview(file, previewImage, imagePreview);
        }
    }

    static showPreview(file, previewImage, imagePreview) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImage.src = e.target.result;
            imagePreview.classList.remove('hidden');
            
            // Animate preview
            gsap.from(imagePreview, {
                opacity: 0,
                y: 20,
                duration: 0.5,
                ease: "power2.out"
            });
        }
        reader.readAsDataURL(file);
    }

    static async handleSubmit(e, submitButton, originalButtonHTML) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);

        // Show loading state
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Processing...';

        try {
            // Show uploading notification
            const title = formData.get('title').trim();
            NotificationManager.show(`Uploading "${title}"...`, 'info');
            const category = formData.get('category');
            const description = formData.get('description').trim();
            
            if (!title || !category) {
                throw new Error('Please fill in all required fields');
            }

            // Check if we're in edit mode
            const isEditMode = form.dataset.mode === 'edit';
            const artworkId = form.dataset.artworkId;
            const endpoint = isEditMode ? `/api/artwork/edit/${artworkId}` : '/api/artwork/upload';
            const method = isEditMode ? 'PUT' : 'POST';

            // If not editing and no file is selected, show error
            if (!isEditMode && !formData.get('artwork').size) {
                throw new Error('Please select an image file');
            }

            // If editing and no new file is selected, remove the file field
            if (isEditMode && !formData.get('artwork').size) {
                formData.delete('artwork');
            }

            // Handle price
            const sellArtwork = document.getElementById('sellArtwork').checked;
            if (sellArtwork) {
                const price = parseFloat(formData.get('price'));
                if (isNaN(price) || price < 0.99) {
                    throw new Error('Please enter a valid price (minimum $0.99)');
                }
            } else {
                formData.delete('price');
            }

            // Handle auction
            const listForAuction = document.getElementById('listForAuction').checked;
            if (listForAuction) {
                const startingBid = parseFloat(formData.get('startingBid'));
                if (isNaN(startingBid) || startingBid < 0.01) {
                    throw new Error('Please enter a valid starting bid (minimum $0.01)');
                }
                formData.set('startingBid', startingBid.toFixed(2));
                formData.set('auctionDuration', formData.get('auctionDuration'));
                const buyNowPrice = parseFloat(formData.get('buyNowPrice'));
                if (!isNaN(buyNowPrice)) {
                    formData.set('buyNowPrice', buyNowPrice.toFixed(2));
                }
            } else {
                formData.delete('startingBid');
                formData.delete('auctionDuration');
                formData.delete('buyNowPrice');
            }

            // Send request
            const response = await fetch(endpoint, {
                method: method,
                body: formData,
                credentials: 'include'
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to process artwork');
            }

            // Show success message with artwork title
            NotificationManager.show(
                `"${title}" ${isEditMode ? 'updated' : 'uploaded'} successfully!`,
                'success'
            );

            // Reset form if not editing
            if (!isEditMode) {
                form.reset();
                const imagePreview = document.getElementById('imagePreview');
                const priceField = document.getElementById('priceField');
                
                if (imagePreview) {
                    imagePreview.classList.add('hidden');
                }
                
                if (priceField) {
                    priceField.classList.add('hidden');
                }
            }

            // Switch to artworks section and refresh the list
            if (typeof window.showSection === 'function') {
                window.showSection('artworks');
            } else {
                console.error('showSection function not available');
            }
            if (window.ArtworkManager) {
                ArtworkManager.loadUserArtworks();
            }

        } catch (error) {
            console.error('Error processing artwork:', error);
            NotificationManager.show(
                `Upload failed: ${error.message}`,
                'error'
            );
        } finally {
            // Restore button state
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonHTML;
        }
    }

    static togglePriceField() {
        const priceField = document.getElementById('priceField');
        const priceInput = document.getElementById('priceInput');
        const sellArtwork = document.getElementById('sellArtwork');
        const priceError = document.getElementById('priceError');
        
        if (sellArtwork.checked) {
            priceField.classList.remove('hidden');
            priceInput.setAttribute('required', 'required');
            // Set a default minimum price
            if (!priceInput.value || parseFloat(priceInput.value) < 0.99) {
                priceInput.value = '0.99';
            }
            this.validatePrice(priceInput);
        } else {
            priceField.classList.add('hidden');
            priceInput.removeAttribute('required');
            priceInput.value = '';
            priceError.classList.add('hidden');
            priceInput.classList.remove('border-red-500');
        }
    }

    static validatePrice(input) {
        const priceError = document.getElementById('priceError');
        const submitButton = document.querySelector('button[type="submit"][form="uploadForm"]');
        const price = parseFloat(input.value);
        
        if (isNaN(price) || price < 0.99) {
            priceError.classList.remove('hidden');
            submitButton.disabled = true;
            input.classList.add('border-red-500');
            return false;
        } else {
            priceError.classList.add('hidden');
            submitButton.disabled = false;
            input.classList.remove('border-red-500');
            // Format the price to 2 decimal places
            input.value = price.toFixed(2);
            return true;
        }
    }
}

// Initialize upload functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing upload manager...');
    UploadManager.initialize();
});
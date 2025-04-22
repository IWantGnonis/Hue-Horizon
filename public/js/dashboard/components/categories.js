// Categories Management
class CategoryManager {
    static async loadCategories() {
        const categoriesGrid = document.getElementById('categoriesGrid');
        
        try {
            // Show loading state
            this.showLoadingState(categoriesGrid);
            
            // Use the correct endpoint
            const response = await fetch('/api/artwork/categories', {
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });

            // If unauthorized, redirect to login
            if (response.status === 401 || response.status === 403) {
                window.location.href = '/login';
                return;
            }

            const data = await response.json();

            if (data.success && data.categories && data.categories.length > 0) {
                categoriesGrid.innerHTML = data.categories.map(category => this.createCategoryCard(category)).join('');

                // Animate cards
                gsap.from(".category-card", {
                    opacity: 0,
                    y: 50,
                    duration: 0.8,
                    ease: "power2.out"
                });
            } else {
                this.showEmptyState(categoriesGrid);
            }
        } catch (error) {
            console.error('Error loading categories:', error);
            this.showErrorState(categoriesGrid);
        }
    }

    static createCategoryCard(category) {
        // Random placeholder images from Lorem Picsum
        const getRandomImage = () => {
            const randomId = Math.floor(Math.random() * 1000);
            return `https://picsum.photos/id/${randomId}/800/600`;
        };
        
        const categoryPlaceholders = {
            'Oil Painting': getRandomImage(),
            'Watercolor': getRandomImage(),
            'Acrylic': getRandomImage(),
            'Digital Art': getRandomImage(),
            'Photography': getRandomImage(),
            'Sculpture': getRandomImage(),
            'Default': getRandomImage()
        };

        const getPlaceholder = (categoryName) => {
            return categoryPlaceholders[categoryName] || categoryPlaceholders['Default'];
        };

        return `
            <div onclick="CategoryManager.showCategoryArtworks('${category.name}')" 
                class="category-card cursor-pointer transform transition-all duration-300 hover:scale-105">
                <div class="aspect-[3/4] relative overflow-hidden rounded-lg border border-gray-800 bg-gradient-to-br from-gray-900 to-black">
                    <div class="absolute inset-0 bg-gradient-to-b from-transparent to-black opacity-60"></div>
                    <img src="${category.image || getPlaceholder(category.name)}" 
                        alt="${category.name}" 
                        class="w-full h-full object-cover transition-opacity duration-300"
                        loading="lazy">
                    <div class="absolute inset-0 flex flex-col justify-end p-6 text-white backdrop-blur-sm bg-black/30 opacity-0 hover:opacity-100 transition-opacity duration-300">
                        <h3 class="text-2xl font-semibold mb-2">${category.name}</h3>
                        <p class="text-sm opacity-90">${category.count} artwork${category.count !== 1 ? 's' : ''}</p>
                        ${category.period ? `<p class="text-sm mt-2 opacity-75">${category.period}</p>` : ''}
                    </div>
                </div>
            </div>
        `;
    }
      static async showCategoryArtworks(categoryName) {
          const categoriesGrid = document.getElementById('categoriesGrid');
          const categoryArtworks = document.getElementById('categoryArtworks');
          const categoryArtworksGrid = document.getElementById('categoryArtworksGrid');
          const selectedCategoryTitle = document.getElementById('selectedCategoryTitle');
          const artworkCount = document.getElementById('artworkCount');
        
          try {
              // Hide categories grid and show artworks section
              categoriesGrid.classList.add('hidden');
              categoryArtworks.classList.remove('hidden');
            
              // Update title
              selectedCategoryTitle.textContent = categoryName;
            
              // Show loading state
              this.showLoadingState(categoryArtworksGrid);
            
              // Use the correct endpoint for fetching category artworks
              const response = await fetch(`/api/artwork/category/${encodeURIComponent(categoryName)}`, {
                  credentials: 'include'
              });
              const data = await response.json();

              if (data.success && data.artworks.length > 0) {
                  artworkCount.textContent = `(${data.artworks.length} artworks)`;
                  categoryArtworksGrid.innerHTML = data.artworks.map(artwork => this.createArtworkCard(artwork)).join('');

                  // Animate artwork cards
                  gsap.from(".artwork-card", {
                      opacity: 0,
                      y: 30,
                      duration: 0.8,
                      stagger: 0.1,
                      ease: "power2.out"
                  });
              } else {
                  artworkCount.textContent = '(0 artworks)';
                  this.showEmptyCategoryState(categoryArtworksGrid);
              }
          } catch (error) {
              console.error('Error loading category artworks:', error);
              this.showErrorState(categoryArtworksGrid);
          }
      }
    static showAllCategories() {
        const categoriesGrid = document.getElementById('categoriesGrid');
        const categoryArtworks = document.getElementById('categoryArtworks');
        
        categoriesGrid.classList.remove('hidden');
        categoryArtworks.classList.add('hidden');
    }

    static showLoadingState(container) {
        container.innerHTML = `
            <div class="col-span-full">
                <div class="animate-pulse grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    ${Array(4).fill(0).map(() => `
                        <div class="aspect-[3/4] relative overflow-hidden rounded-lg border border-gray-800">
                            <div class="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 animate-gradient"></div>
                            <div class="absolute inset-0 flex flex-col justify-end p-6">
                                <div class="h-6 bg-gray-700 rounded w-3/4 mb-2"></div>
                                <div class="h-4 bg-gray-700 rounded w-1/2"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Add the animation style if it doesn't exist
        if (!document.getElementById('loading-animation-style')) {
            const style = document.createElement('style');
            style.id = 'loading-animation-style';
            style.textContent = `
                @keyframes gradientShift {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                .animate-gradient {
                    background-size: 200% 200%;
                    animation: gradientShift 2s ease infinite;
                }
            `;
            document.head.appendChild(style);
        }
    }

    static showEmptyState(container) {
        container.innerHTML = `
            <div class="col-span-full text-center py-8">
                <div class="dashboard-card p-8 rounded-xl border border-gray-800">
                    <p class="text-gray-400 mb-4">No categories found. This might be because:</p>
                    <ul class="text-gray-500 list-disc list-inside mb-6">
                        <li>You haven't uploaded any artworks yet</li>
                        <li>Your artworks are still processing</li>
                        <li>There was an error loading the categories</li>
                    </ul>
                    <div class="flex justify-center gap-4">
                        <button onclick="CategoryManager.loadCategories()" 
                            class="btn-secondary">
                            <i class="fas fa-sync-alt mr-2"></i>Refresh
                        </button>
                        <button onclick="showSection('upload')" 
                            class="btn-primary">
                            <i class="fas fa-cloud-upload-alt mr-2"></i>Upload Artwork
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    static showEmptyCategoryState(container) {
        container.innerHTML = `
            <div class="col-span-full text-center py-8">
                <p class="text-gray-500">No artworks found in this category.</p>
                <button onclick="showSection('upload')" 
                        class="btn-primary mt-4">
                    <i class="fas fa-cloud-upload-alt mr-2"></i>
                    Upload an Artwork
                </button>
            </div>
        `;
    }

    static showErrorState(container) {
        container.innerHTML = `
            <div class="col-span-full text-center py-8">
                <div class="dashboard-card p-8 rounded-xl border border-red-800 bg-red-900/10">
                    <p class="text-red-400 mb-4">Failed to load categories</p>
                    <div class="flex justify-center gap-4">
                        <button onclick="CategoryManager.loadCategories()" 
                            class="btn-secondary">
                            <i class="fas fa-sync-alt mr-2"></i>Try Again
                        </button>
                        <button onclick="window.location.href='/login'" 
                            class="btn-primary">
                            <i class="fas fa-sign-in-alt mr-2"></i>Login Again
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    static createArtworkCard(artwork) {
        return `
            <div class="artwork-card" data-artwork-id="${artwork.id}">
                <div class="aspect-[3/4] relative overflow-hidden rounded-lg shadow-md">
                    <img src="${artwork.image_url}" alt="${artwork.title}" class="w-full h-full object-cover">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300">
                        <div class="absolute bottom-0 left-0 right-0 p-4 text-white">
                            <h3 class="text-lg font-medium">${artwork.title}</h3>
                            <p class="text-sm opacity-90">${artwork.description}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

// Initialize categories functionality
document.addEventListener('DOMContentLoaded', () => {
    // Load categories on initial load and when the categories section is shown
    CategoryManager.loadCategories(); // Load on DOMContentLoaded
    document.querySelector('[data-section="categories"]').addEventListener('click', () => {
        CategoryManager.loadCategories();
    });
});

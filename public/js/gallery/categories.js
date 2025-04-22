import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm'; // Import GSAP
import { ArtworkManager } from './artworks.js'; // Import ArtworkManager

export const CategoryManager = { // Export the object
    async init() {
        try {
            const categories = await this.fetchCategories();
            this.renderCategories(categories);
            this.setupEventListeners();
        } catch (error) {
            console.error('Error initializing categories:', error);
            NotificationManager.show('error', 'Failed to load categories');
        }
    },

    async fetchCategories() {
        try {
            const response = await fetch('/api/artwork/gallery-categories');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch categories');
            }
            return data.categories;
        } catch (error) {
            console.error('Error fetching categories:', error);
            throw error;
        }
    },

    renderCategories(categories) {
        const grid = document.getElementById('categoriesGrid');
        if (!grid) {
            console.error('Categories grid element not found!');
            return;
        }
        grid.innerHTML = categories.map(category => this.createCategoryCard(category)).join('');

        // Attach event listeners AFTER rendering
        this.attachCardClickListeners();

        // Animate the cards after they are added to the DOM
        gsap.to(".category-card", {
            opacity: 1, 
            y: 0, // Assuming they might be slightly offset initially, reset to 0
            stagger: 0.1, // Stagger the animation for a nice effect
            duration: 0.5, 
            ease: 'power2.out',
            delay: 0.2 // Small delay before starting
        });
    },

    createCategoryCard(category) {
        // Random placeholder images from Lorem Picsum
        const getRandomImage = () => {
            const randomId = Math.floor(Math.random() * 1000);
            return `https://picsum.photos/id/${randomId}/800/600`;
        };
        
        // Add data attribute to store category name, remove inline onclick
        return `
            <div class="category-card relative overflow-hidden rounded-lg shadow-lg cursor-pointer opacity-0" data-category-name="${category.name}">
                <img src="${getRandomImage()}" alt="${category.name}" class="w-full h-64 object-cover">
                <div class="category-overlay absolute inset-0 flex flex-col justify-end p-6">
                    <h3 class="text-white text-xl font-semibold mb-2">${category.name}</h3>
                    <div class="flex justify-between items-center text-gray-300">
                        <span>${category.count} artworks</span>
                        <span>${category.period}</span>
                    </div>
                </div>
            </div>
        `;
    },

    setupEventListeners() {
        const filterButtons = document.querySelectorAll('.category-filter');
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                filterButtons.forEach(btn => btn.classList.remove('active-filter'));
                button.classList.add('active-filter');
            });
        });

        // Add event listener for the back button
        const backButton = document.getElementById('backToCategoriesBtn');
        if (backButton) {
            backButton.addEventListener('click', () => {
                this.showAllCategories();
            });
        }
    },

    showAllCategories() {
        const categoriesSection = document.getElementById('categories');
        const artworksSection = document.getElementById('artworksSection');
        
        if (artworksSection) artworksSection.classList.add('hidden');
        if (categoriesSection) categoriesSection.classList.remove('hidden');
        
        // Reset category title and description
        const categoryTitle = document.getElementById('categoryTitle');
        const categoryDescription = document.getElementById('categoryDescription');
        if (categoryTitle) categoryTitle.textContent = '';
        if (categoryDescription) categoryDescription.textContent = '';
    },

    showCategory(categoryName) {
        ArtworkManager.loadArtworks(categoryName);
    },

    // New method to attach click listeners
    attachCardClickListeners() {
        const cards = document.querySelectorAll('.category-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                const categoryName = card.dataset.categoryName;
                if (categoryName) {
                    this.showCategory(categoryName);
                }
            });
        });
    }
};

// Removed DOMContentLoaded listener - initialization will be handled by importing module

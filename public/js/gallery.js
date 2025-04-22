import { CategoryManager } from './gallery/categories.js';
import { ArtworkManager } from './gallery/artworks.js';

document.addEventListener('DOMContentLoaded', () => {
    CategoryManager.init();
    ArtworkManager.loadFeaturedArtworks(); // Load featured artworks
    ArtworkManager.loadAllArtworks(); // Load all artworks
});

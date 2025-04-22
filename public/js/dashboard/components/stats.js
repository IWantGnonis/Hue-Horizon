// Statistics and Analytics Management
class StatsManager {
    static initialize() {
        this.loadStats();
        this.initializeCharts();
        
        // Refresh stats every 5 minutes
        setInterval(() => this.loadStats(), 300000);
    }

    static async loadStats() {
        try {
const response = await fetch('/api/user/profile', {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log(data);
            if (data.success) {
                this.updateStats(data.stats);
                this.updateCharts(data.stats);
            } else {
                throw new Error(data.error || 'Failed to load statistics');
            }
        } catch (error) {
            console.error('Stats loading error:', error);
            showNotification('Failed to load statistics', 'error');
        }
    }

    static updateStats(stats) {
        // Update total artworks
        const totalArtworks = document.getElementById('totalArtworks');
        if (totalArtworks) {
            const oldValue = parseInt(totalArtworks.textContent);
            const newValue = stats.totalArtworks;
            this.animateValue(totalArtworks, oldValue, newValue);
        }

        // Update total views
        const totalViews = document.getElementById('totalViews');
        if (totalViews) {
            const oldValue = parseInt(totalViews.textContent);
            const newValue = stats.totalViews;
            this.animateValue(totalViews, oldValue, newValue);
        }

        // Update total favorites
        const totalFavorites = document.getElementById('totalFavorites');
        if (totalFavorites) {
            const oldValue = parseInt(totalFavorites.textContent);
            const newValue = stats.totalFavorites;
            this.animateValue(totalFavorites, oldValue, newValue);
        }

        // Update total earnings if available
        const totalEarnings = document.getElementById('totalEarnings');
        if (totalEarnings && stats.totalEarnings !== undefined) {
            const oldValue = parseFloat(totalEarnings.dataset.value || '0');
            const newValue = stats.totalEarnings;
            this.animateValue(totalEarnings, oldValue, newValue, true);
            totalEarnings.dataset.value = newValue;
        }
    }

    static animateValue(element, start, end, isCurrency = false) {
        if (start === end) return;
        
        const duration = 1000;
        const startTime = performance.now();
        
        const updateValue = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function for smooth animation
            const easeOutQuad = progress => 1 - (1 - progress) * (1 - progress);
            const easedProgress = easeOutQuad(progress);
            
            const current = Math.round(start + (end - start) * easedProgress);
            
            if (isCurrency) {
                element.textContent = new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD'
                }).format(current);
            } else {
                element.textContent = new Intl.NumberFormat().format(current);
            }
            
            if (progress < 1) {
                requestAnimationFrame(updateValue);
            }
        };
        
        requestAnimationFrame(updateValue);
    }

    static initializeCharts() {
        // Initialize views chart
        this.viewsChart = new Chart(document.getElementById('viewsChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Views',
                    data: [],
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: this.getChartOptions('Views Over Time')
        });

        // Initialize favorites chart
        this.favoritesChart = new Chart(document.getElementById('favoritesChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Favorites',
                    data: [],
                    borderColor: 'rgb(239, 68, 68)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: this.getChartOptions('Favorites Over Time')
        });

        // Initialize category distribution chart
        this.categoryChart = new Chart(document.getElementById('categoryChart'), {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.8)',
                        'rgba(239, 68, 68, 0.8)',
                        'rgba(16, 185, 129, 0.8)',
                        'rgba(245, 158, 11, 0.8)',
                        'rgba(139, 92, 246, 0.8)'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    title: {
                        display: true,
                        text: 'Artwork Categories Distribution'
                    }
                }
            }
        });
    }

    static getChartOptions(title) {
        return {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: title
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        };
    }

    static updateCharts(stats) {
        // Update views chart
        if (this.viewsChart && stats.viewsOverTime) {
            this.viewsChart.data.labels = stats.viewsOverTime.map(item => item.date);
            this.viewsChart.data.datasets[0].data = stats.viewsOverTime.map(item => item.count);
            this.viewsChart.update();
        }

        // Update favorites chart
        if (this.favoritesChart && stats.favoritesOverTime) {
            this.favoritesChart.data.labels = stats.favoritesOverTime.map(item => item.date);
            this.favoritesChart.data.datasets[0].data = stats.favoritesOverTime.map(item => item.count);
            this.favoritesChart.update();
        }

        // Update category distribution chart
        if (this.categoryChart && stats.categoryDistribution) {
            this.categoryChart.data.labels = stats.categoryDistribution.map(item => item.category);
            this.categoryChart.data.datasets[0].data = stats.categoryDistribution.map(item => item.count);
            this.categoryChart.update();
        }
    }
}

// Initialize stats functionality
document.addEventListener('DOMContentLoaded', () => {
    StatsManager.initialize();
});

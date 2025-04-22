const Utils = {
    async isAuthenticated() {
        try {
            const response = await fetch('/api/artwork/favorites', {
                credentials: 'include'
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }
};
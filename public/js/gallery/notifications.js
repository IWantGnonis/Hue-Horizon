const NotificationManager = {
    show(type, message) {
        const notification = document.getElementById('notification');
        const notificationText = document.getElementById('notificationText');
        const notificationIcon = document.getElementById('notificationIcon');

        // Set icon based on type
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            info: 'fa-info-circle',
            warning: 'fa-exclamation-triangle'
        };

        // Set colors based on type
        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            info: 'bg-blue-500',
            warning: 'bg-yellow-500'
        };

        // Update notification content
        notificationText.textContent = message;
        notificationIcon.className = `fas ${icons[type] || icons.info}`;
        
        // Update notification color
        notification.className = `fixed bottom-4 right-4 transform transition-all duration-300 z-50 ${colors[type] || colors.info} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3`;

        // Show notification
        notification.style.transform = 'translateY(0)';
        notification.style.opacity = '1';

        // Hide after 3 seconds
        setTimeout(() => {
            notification.style.transform = 'translateY(100%)';
            notification.style.opacity = '0';
        }, 3000);
    }
};

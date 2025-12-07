// Admin JavaScript
class AdminApp {
    constructor() {
        this.currentUser = null;
        this.init();
    }
    
    init() {
        // Controleer Netlify Identity
        if (window.netlifyIdentity) {
            netlifyIdentity.on('init', user => {
                this.currentUser = user;
                this.onAuthChange(user);
            });
            
            netlifyIdentity.on('login', user => {
                this.currentUser = user;
                this.onAuthChange(user);
                this.redirectToDashboard();
            });
            
            netlifyIdentity.on('logout', () => {
                this.currentUser = null;
                this.onAuthChange(null);
                this.redirectToLogin();
            });
            
            netlifyIdentity.init();
        }
    }
    
    onAuthChange(user) {
        const loginError = document.getElementById('login-error');
        const loginSuccess = document.getElementById('login-success');
        
        if (user) {
            // Ingelogd
            if (loginSuccess) {
                loginSuccess.style.display = 'block';
                setTimeout(() => {
                    this.redirectToDashboard();
                }, 1500);
            }
        } else {
            // Uitgelogd
            if (loginError) {
                loginError.style.display = 'none';
            }
        }
    }
    
    redirectToDashboard() {
        // Alleen redirect als we op login pagina zijn
        if (window.location.pathname.includes('login')) {
            window.location.href = '/admin/dashboard.html';
        }
    }
    
    redirectToLogin() {
        // Alleen redirect als we op beveiligde pagina zijn
        if (window.location.pathname.includes('admin') && 
            !window.location.pathname.includes('login')) {
            window.location.href = '/admin/login.html';
        }
    }
    
    // Admin API calls
    async getTrainingen() {
        try {
            const response = await fetch('https://bredathenetherlands.netlify.app/.netlify/functions/add-training');
            return await response.json();
        } catch (error) {
            console.error('Fout bij ophalen trainingen:', error);
            return [];
        }
    }
    
    async deleteTraining(id) {
        try {
            // TODO: Maak delete function in Netlify
            console.log('Verwijder training:', id);
            return { success: true };
        } catch (error) {
            console.error('Fout bij verwijderen:', error);
            return { success: false, error: error.message };
        }
    }
    
    async updateTraining(id, data) {
        try {
            // TODO: Maak update function in Netlify
            console.log('Update training:', id, data);
            return { success: true };
        } catch (error) {
            console.error('Fout bij updaten:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Utility functies
    showNotification(message, type = 'info') {
        const colors = {
            success: '#4caf50',
            error: '#f44336',
            info: '#2196f3',
            warning: '#ff9800'
        };
        
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${colors[type]};
            color: white;
            border-radius: 5px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        `;
        
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation' : 'info'}-circle"></i>
            ${message}
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // Voeg CSS animaties toe
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Initialiseer admin app
const adminApp = new AdminApp();
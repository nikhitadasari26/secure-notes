/**
 * Authentication Module
 * Handles PIN hashing, setting up a new PIN, and verifying existing PIN.
 */

class AuthManager {
    constructor() {
        this.pinLength = 4;
        this.currentPin = '';
        this.mode = 'login'; // 'setup', 'confirm', 'login'
        this.setupPin = ''; // Temporarily hold pin during setup confirmation
        
        // DOM Elements
        this.authView = document.getElementById('auth-view');
        this.dashboardView = document.getElementById('dashboard-view');
        this.authTitle = document.getElementById('auth-title');
        this.authSubtitle = document.getElementById('auth-subtitle');
        this.errorMsg = document.getElementById('auth-error');
        this.dots = document.querySelectorAll('.pin-dot');
        this.numpadBtns = document.querySelectorAll('.num-btn[data-val]');
        this.backspaceBtn = document.getElementById('pin-backspace');
        this.clearBtn = document.getElementById('pin-clear');

        this.init();
    }

    async init() {
        const storedHash = localStorage.getItem('secure_notes_pin');
        
        if (!storedHash) {
            this.mode = 'setup';
            this.authTitle.textContent = 'Setup PIN';
            this.authSubtitle.textContent = 'Create a 4-digit PIN to secure your notes';
        } else {
            this.mode = 'login';
            this.authTitle.textContent = 'Welcome Back';
            this.authSubtitle.textContent = 'Enter your 4-digit PIN';
        }

        this.bindEvents();
    }

    bindEvents() {
        this.numpadBtns.forEach(btn => {
            btn.addEventListener('click', () => this.handleNumber(btn.dataset.val));
        });

        this.backspaceBtn.addEventListener('click', () => this.handleBackspace());
        this.clearBtn.addEventListener('click', () => this.handleClear());
        
        // Keyboard support
        document.addEventListener('keydown', (e) => {
            if (!this.authView.classList.contains('active')) return;
            
            if (e.key >= '0' && e.key <= '9') {
                this.handleNumber(e.key);
            } else if (e.key === 'Backspace') {
                this.handleBackspace();
            } else if (e.key === 'Escape') {
                this.handleClear();
            }
        });
    }

    updateDots() {
        this.dots.forEach((dot, index) => {
            if (index < this.currentPin.length) {
                dot.classList.add('filled');
            } else {
                dot.classList.remove('filled', 'error');
            }
        });
    }

    showError(msg) {
        this.errorMsg.textContent = msg;
        this.errorMsg.classList.remove('hidden');
        this.dots.forEach(dot => dot.classList.add('error'));
        
        setTimeout(() => {
            this.handleClear();
            this.errorMsg.classList.add('hidden');
        }, 800);
    }

    async hashPin(pin) {
        // Simple SHA-256 hash using Web Crypto API
        const msgUint8 = new TextEncoder().encode(pin);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    async processPinComplete() {
        if (this.currentPin.length !== this.pinLength) return;

        if (this.mode === 'setup') {
            this.setupPin = this.currentPin;
            this.currentPin = '';
            this.mode = 'confirm';
            this.authSubtitle.textContent = 'Confirm your PIN';
            this.updateDots();
        } 
        else if (this.mode === 'confirm') {
            if (this.currentPin === this.setupPin) {
                // PIN matched, save it
                const hash = await this.hashPin(this.currentPin);
                localStorage.setItem('secure_notes_pin', hash);
                this.unlock();
            } else {
                // PIN didn't match
                this.showError('PINs do not match. Try again.');
                this.mode = 'setup';
                this.setupPin = '';
                this.authSubtitle.textContent = 'Create a 4-digit PIN to secure your notes';
            }
        } 
        else if (this.mode === 'login') {
            const storedHash = localStorage.getItem('secure_notes_pin');
            const currentHash = await this.hashPin(this.currentPin);
            
            if (currentHash === storedHash) {
                this.unlock();
            } else {
                this.showError('Incorrect PIN');
            }
        }
    }

    handleNumber(num) {
        if (this.currentPin.length < this.pinLength) {
            this.currentPin += num;
            this.updateDots();
            
            if (this.currentPin.length === this.pinLength) {
                // Small delay for UI to show last dot filled
                setTimeout(() => this.processPinComplete(), 100);
            }
        }
    }

    handleBackspace() {
        if (this.currentPin.length > 0) {
            this.currentPin = this.currentPin.slice(0, -1);
            this.updateDots();
        }
    }

    handleClear() {
        this.currentPin = '';
        this.updateDots();
    }

    unlock() {
        this.authView.classList.remove('active');
        // Simple transition hide
        setTimeout(() => {
            this.authView.classList.add('hidden');
            this.dashboardView.classList.remove('hidden');
            this.dashboardView.classList.add('active');
            
            // Dispatch event that auth is successful so other modules can load data
            document.dispatchEvent(new CustomEvent('authSuccess'));
        }, 300);
    }
}

// Global theme logic
const themeToggleBtn = document.getElementById('theme-toggle');
const htmlTag = document.documentElement;

// Initialize theme
const currentTheme = localStorage.getItem('theme') || 'dark';
htmlTag.setAttribute('data-theme', currentTheme);
updateThemeIcon(currentTheme);

themeToggleBtn.addEventListener('click', () => {
    const newTheme = htmlTag.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    htmlTag.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
});

function updateThemeIcon(theme) {
    const icon = themeToggleBtn.querySelector('i');
    if (theme === 'dark') {
        icon.className = 'ph ph-sun';
    } else {
        icon.className = 'ph ph-moon';
    }
}

// Initialize Auth
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});

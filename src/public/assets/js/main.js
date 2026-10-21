// JavaScript utama untuk aplikasi Rencanaku.ai
// File ini akan di-link di layout EJS

class App {
  constructor() {
    this.init();
  }

  init() {
    console.log('Rencanaku.ai App initialized');
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Contoh event listener untuk tombol
    const buttons = document.querySelectorAll('button[data-action]');
    buttons.forEach(button => {
      button.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        this.handleAction(action, e);
      });
    });
  }

  handleAction(action, event) {
    console.log(`Action triggered: ${action}`);
    // Implementasi aksi berdasarkan data-action
  }

  // Helper untuk fetch API dengan error handling
  async apiFetch(url, options = {}) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Fetch Error:', error);
      throw error;
    }
  }

  // Helper untuk menampilkan pesan status
  showStatus(message, type = 'info') {
    // Buat element notification
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
      type === 'success' ? 'bg-green-500' :
      type === 'error' ? 'bg-red-500' :
      'bg-blue-500'
    } text-white`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Hapus setelah 3 detik
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// Inisialisasi aplikasi saat DOM siap
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});

// Export untuk testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = App;
}
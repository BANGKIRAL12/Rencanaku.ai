/**
 * Klien JavaScript vanilla Rencanaku.ai.
 * Tanpa bundler; dimuat langsung oleh layout EJS.
 */
(function () {
  'use strict';

  /** Tampilkan pesan status singkat (toast) yang ramah aksesibilitas. */
  function showStatus(message, type) {
    var variant = type || 'info';
    var palette = {
      success: 'bg-emerald-500 text-white',
      error: 'bg-red-500 text-white',
      warning: 'bg-yellow-500 text-black',
      info: 'bg-blue-500 text-white',
    };

    var el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.className =
      'fixed top-4 right-4 z-50 max-w-sm rounded-xl px-4 py-3 text-sm shadow-lg ' +
      (palette[variant] || palette.info);
    el.textContent = String(message);

    document.body.appendChild(el);
    window.setTimeout(function () {
      el.remove();
    }, 4000);
  }

  /**
   * Fetch helper dengan penanganan error konsisten.
   * Selalu mengembalikan objek JSON atau melempar Error berisi pesan
   * publik dari server.
   */
  async function apiFetch(url, options) {
    var opts = Object.assign({ headers: {} }, options);
    var headers = Object.assign(
      { Accept: 'application/json' },
      opts.headers
    );

    if (opts.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    var response;
    try {
      response = await fetch(url, Object.assign({}, opts, { headers: headers }));
    } catch (networkError) {
      showStatus('Tidak dapat menghubungi server.', 'error');
      throw new Error('Kesalahan jaringan');
    }

    var payload = null;
    var contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        payload = await response.json();
      } catch (parseError) {
        payload = null;
      }
    }

    if (!response.ok) {
      var message =
        (payload && payload.error && payload.error.message) ||
        'Permintaan gagal (HTTP ' + response.status + ').';
      showStatus(message, 'error');
      var error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  /** Buka/tutup dialog <dialog> berdasarkan data-action. */
  function setupDialogs() {
    document.querySelectorAll('[data-dialog-open]').forEach(function (trigger) {
      trigger.addEventListener('click', function () {
        var target = document.getElementById(trigger.dataset.dialogOpen);
        if (target && typeof target.showModal === 'function') target.showModal();
      });
    });

    document.querySelectorAll('[data-dialog-close]').forEach(function (trigger) {
      trigger.addEventListener('click', function () {
        var dialog = trigger.closest('dialog');
        if (dialog) dialog.close();
      });
    });
  }

  /** Toggle menu navigasi pada layar kecil. */
  function setupMenu() {
    var toggle = document.querySelector('[data-menu-toggle]');
    var menu = document.querySelector('[data-menu]');
    if (!toggle || !menu) return;

    toggle.addEventListener('click', function () {
      var expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      menu.classList.toggle('hidden');
    });
  }

  function init() {
    setupDialogs();
    setupMenu();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Ekspos API minimal untuk halaman yang membutuhkan.
  window.Rencanaku = { apiFetch: apiFetch, showStatus: showStatus };
})();

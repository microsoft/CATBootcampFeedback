/**
 * Manual Event Code Entry - Standalone Script
 * Handles manual event code entry for error recovery
 */

// Manual event code entry (standalone function for error recovery)
window.loadManualEventCode = function() {
    const input = document.getElementById('manualEventCode');
    const btn = document.getElementById('loadEventBtn');
    const errorEl = document.getElementById('manualEntryError');
    const code = input.value.trim().toUpperCase();

    // Clear previous error
    errorEl.classList.add('hidden');
    errorEl.textContent = '';

    if (!code) {
        errorEl.textContent = 'Please enter an event code';
        errorEl.classList.remove('hidden');
        input.focus();
        return;
    }

    // Validate format (alphanumeric, 4-20 characters)
    if (!/^[A-Z0-9]{4,20}$/.test(code)) {
        errorEl.textContent = 'Event code must be 4-20 alphanumeric characters';
        errorEl.classList.remove('hidden');
        input.focus();
        return;
    }

    // Show loading on button
    const btnText = btn.querySelector('.btn-text');
    const btnSpinner = btn.querySelector('.btn-spinner');
    btn.disabled = true;
    btnText.textContent = 'Loading...';
    btnSpinner.classList.remove('hidden');

    // Redirect with new code
    const url = new URL(window.location);
    url.searchParams.set('code', code);
    window.location.href = url.toString();
};

// Handle Enter key in manual entry input
document.addEventListener('DOMContentLoaded', function() {
    const manualInput = document.getElementById('manualEventCode');
    if (manualInput) {
        manualInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                window.loadManualEventCode();
            }
        });
    }
});

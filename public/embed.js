(function () {
    const WIDGET_URL = 'http://localhost:3000/embed/phone-verify'; // Change this to production URL

    function initPhoneVerifyWidget() {
        const container = document.getElementById('phone-verify-widget');
        if (!container) {
            console.error('Phone Verify Widget: Container element #phone-verify-widget not found.');
            return;
        }

        // Create Iframe
        const iframe = document.createElement('iframe');
        iframe.src = WIDGET_URL;
        iframe.style.width = '100%';
        iframe.style.border = 'none';
        iframe.style.overflow = 'hidden';
        iframe.style.transition = 'height 0.3s ease';
        iframe.scrolling = 'no';

        // Initial height, will be updated by widget
        iframe.style.height = '400px';

        container.appendChild(iframe);

        // Listen for messages
        window.addEventListener('message', function (event) {
            // Security check: ensure origin matches (omitted for localhost dev, but recommended for prod)
            // if (event.origin !== 'http://localhost:3000') return;

            if (event.data.type === 'WIDGET_RESIZE') {
                iframe.style.height = event.data.height + 'px';
            }

            if (event.data.type === 'PHONE_VERIFIED') {
                console.log('Phone Verification Successful:', event.data);

                // Expose event to host page
                if (window.onPhoneVerified) {
                    window.onPhoneVerified(event.data);
                }

                // Dispatch custom event
                const customEvent = new CustomEvent('phone-verified', { detail: event.data });
                container.dispatchEvent(customEvent);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPhoneVerifyWidget);
    } else {
        initPhoneVerifyWidget();
    }
})();

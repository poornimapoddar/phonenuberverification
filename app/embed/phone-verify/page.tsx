'use client';

import PhoneVerification from '@/components/PhoneVerification';
import { useEffect } from 'react';

export default function EmbedVerifyPhonePage() {
    // Add specific styles for the iframe context if needed
    useEffect(() => {
        // Make body transparent to blend with parent site if desired
        document.body.style.backgroundColor = 'transparent';

        // Add a class to body to indicate embed mode
        document.body.classList.add('embed-mode');

        return () => {
            document.body.style.backgroundColor = '';
            document.body.classList.remove('embed-mode');
        };
    }, []);

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            padding: '20px' // Add some padding
        }}>
            <PhoneVerification />
        </div>
    );
}

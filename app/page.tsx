'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to customer details page
    router.push('/customer');
  }, [router]);

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      backgroundColor: '#f3f4f6'
    }}>
      <div style={{ color: '#6b7280', fontSize: '1rem' }}>Loading...</div>
    </div>
  );
}


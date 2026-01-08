'use client';

import PhoneVerification from '@/components/PhoneVerification';
import styles from '../page.module.css';

export default function VerifyPhonePage() {
  return (
    <div className={styles.container}>
      <PhoneVerification />
    </div>
  );
}


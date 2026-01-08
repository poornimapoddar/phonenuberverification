'use client';

import CustomerDetails from '@/components/CustomerDetails';
import styles from '../page.module.css';

export default function CustomerPage() {
  return (
    <div className={styles.container}>
      <CustomerDetails />
    </div>
  );
}


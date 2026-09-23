'use client';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import styles from './Header.module.css';

export default function Header() {
  const router = useRouter();
  const [featuredTitle, setFeaturedTitle] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'books'), where('featured', '==', true), limit(1)),
        );
        if (cancelled || snap.empty) return;
        setFeaturedTitle(snap.docs[0].data().title || '');
      } catch {
        // ignore — header simply shows nothing if the fetch fails.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!featuredTitle) return null;

  return (
    <header className={styles.header}>
      <button
        type="button"
        onClick={() => router.push('/books')}
        className={styles.featuredBtn}
        title={featuredTitle}
      >
        이 주의 책 · {featuredTitle}
      </button>
    </header>
  );
}

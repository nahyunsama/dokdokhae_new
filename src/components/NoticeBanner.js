'use client';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { dangerousHtml } from '@/lib/sanitize.client';
import { Volume2, X, ArrowRight } from 'lucide-react';
import styles from './NoticeBanner.module.css';

export default function NoticeBanner() {
  const [notice, setNotice] = useState(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    getDocs(query(collection(db, 'notices'), where('pinned', '==', true), orderBy('createdAt', 'desc')))
      .then(snap => { if (!snap.empty) setNotice({ id: snap.docs[0].id, ...snap.docs[0].data() }); })
      .catch(() => {});
  }, []);

  if (!notice) return null;

  return (
    <>
      <div className={styles.banner} onClick={() => setOpen(true)}>
        <span className={styles.label}><Volume2 size={12} /> 공지</span>
        <span className={styles.title}>{notice.title}</span>
        <span className={styles.chevron}>›</span>
      </div>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{notice.title}</h2>
              <button onClick={() => setOpen(false)} className={styles.closeBtn}><X size={20} /></button>
            </div>
            <div className={`notice-content ${styles.content}`} dangerouslySetInnerHTML={dangerousHtml(notice.content)} />
            <div className={styles.footer}>
              <button onClick={() => { setOpen(false); router.push(`/notice/${notice.id}`); }}
                className={styles.viewAllBtn}>
                전체 보기 <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

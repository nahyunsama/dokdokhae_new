'use client';
import { useFCM } from '@/hooks/useFCM';
import { useAuth } from '@/lib/AuthContext';
import { Bell } from 'lucide-react';
import styles from './FCMInit.module.css';

export default function FCMInit() {
  const { user } = useAuth();
  const { permission, requestPermission } = useFCM();

  if (!user) return null;

  return (
    <>
      {permission === 'default' && (
        <div className={styles.banner}>
          <span className={styles.text}><Bell size={14} /> 모임 알림을 받으시겠어요?</span>
          <button onClick={async () => { await requestPermission(); }}
            className={styles.allowBtn}>
            허용
          </button>
        </div>
      )}
    </>
  );
}
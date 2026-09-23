'use client';
import { useEffect, useState } from 'react';
import styles from './ContentLightbox.module.css';

export default function ContentLightbox({ children, contentClassName, contentStyle }) {
  const [src, setSrc] = useState(null);

  function onClick(e) {
    if (e.button !== 0) return;
    if (e.target?.tagName === 'IMG') {
      e.preventDefault();
      setSrc(e.target.src);
    }
  }

  useEffect(() => {
    if (!src) return;
    function onKey(ev) { if (ev.key === 'Escape') setSrc(null); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [src]);

  return (
    <>
      <div className={contentClassName} style={contentStyle} onClick={onClick}>
        {children}
      </div>
      {src && (
        <div
          onClick={() => setSrc(null)}
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
        >
          <img
            src={src}
            alt=""
            className={styles.image}
          />
        </div>
      )}
    </>
  );
}

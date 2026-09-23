'use client';
import styles from './SearchBar.module.css';

export default function SearchBar({ value, onChange, onSubmit, placeholder }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.inputWrap}>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSubmit(value); }}
          placeholder={placeholder}
          className={styles.input}
          data-has-value={!!value || undefined}
        />
        {value && (
          <button
            type="button"
            onClick={() => { onChange(''); onSubmit(''); }}
            className={styles.clearBtn}
            aria-label="검색어 지우기"
          >×</button>
        )}
      </div>
      <button type="button" className="btn-sm btn-outline" onClick={() => onSubmit(value)}>검색</button>
    </div>
  );
}

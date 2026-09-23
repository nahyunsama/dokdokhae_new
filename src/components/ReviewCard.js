'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useLikes, useComments } from '@/lib/usePostInteractions';
import { stripHtml } from '@/lib/searchUtils';
import { dangerousHtml } from '@/lib/sanitize.client';
import ContentLightbox from '@/components/ContentLightbox';
import CommentSection from '@/components/CommentSection';
import LikeBurst from '@/components/LikeBurst';
import { Star, BookOpen, Heart, MessageCircle } from 'lucide-react';
import styles from './ReviewCard.module.css';

const PREVIEW_LEN = 30;

export default function ReviewCard({
  review,
  bookTitle,
  isAdmin = false,
  showBookTitle = false,
  onEdit,
  onDelete,
}) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);

  const { liked, likeCount, toggleLike } = useLikes('reviews', review.id, user);
  const { topComments } = useComments('reviews', review.id);

  const owner = user && review.uid === user.uid;
  const canModify = owner || isAdmin;
  const previewText = stripHtml(review.content || '').slice(0, PREVIEW_LEN);

  const stars = (n) => (
    <span className={styles.starsRow}>
      {[1,2,3,4,5].map(s => (
        <span key={s} className={`${styles.starIcon} ${s <= (n||0) ? styles.starFilled : styles.starEmpty}`}>
          <Star size={13} fill={s <= (n||0) ? 'currentColor' : 'none'} />
        </span>
      ))}
    </span>
  );

  return (
    <div className="review-card">
      <div
        className={styles.headerRow}
        onClick={() => setExpanded(e => !e)}
      >
        <div className={styles.headerLeft}>
          <span className={styles.nickname}>{review.nickname || '익명'}</span>
          {stars(review.rating)}
          {showBookTitle && bookTitle && (
            <span className={`${styles.meta} ${styles.metaBookTitle} ${styles.bookTitleMeta}`}><BookOpen size={12} /> {bookTitle}</span>
          )}
          {!expanded && previewText && (
            <span className={`${styles.meta} ${showBookTitle ? styles.metaPreviewHideMobile : ''}`}>
              {previewText}
            </span>
          )}
        </div>
        <div className={styles.headerRight}>
          <span className={styles.iconStat}><Heart size={12} fill="currentColor" /> {likeCount}</span>
          <span className={styles.iconStat}><MessageCircle size={12} /> {topComments.length}</span>
          <span className={styles.expandArrow}>{expanded ? '▾' : '▸'}</span>
        </div>
      </div>

      {expanded && (
        <div className={styles.expandedBody}>
          <ContentLightbox contentClassName="review-content">
            <div dangerouslySetInnerHTML={dangerousHtml(review.content || '')} />
          </ContentLightbox>

          <div className={styles.actionsRow}>
            <button
              type="button"
              className={`btn-sm btn-outline ${styles.likeBtn}`}
              onClick={(e) => { e.stopPropagation(); if (user) { toggleLike(); } else { alert('로그인이 필요해요.'); } }}
            >
              <LikeBurst liked={liked} likeCount={likeCount} size={14} />
            </button>
            {canModify && (
              <>
                {onEdit && <button type="button" className="btn-sm btn-outline" onClick={(e) => { e.stopPropagation(); onEdit(review); }}>수정</button>}
                {onDelete && <button type="button" className="btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); onDelete(review); }}>삭제</button>}
              </>
            )}
          </div>

          <CommentSection collectionName="reviews" postId={review.id} isAdmin={isAdmin} />
        </div>
      )}
    </div>
  );
}

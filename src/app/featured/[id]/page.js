'use client';
import { useEffect, useState, use } from 'react';
import { doc, getDoc, collection, getDocs, deleteDoc, query, orderBy, where, limit } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

import { dangerousHtml } from '@/lib/sanitize.client';
import { authenticatedFetch, authenticatedJsonFetch } from '@/lib/authenticatedFetch';
import { NICKNAME_TAKEN_MESSAGE } from '@/lib/nicknames';
import ContentLightbox from '@/components/ContentLightbox';
import ExpandableContent from '@/components/ExpandableContent';
import { ArrowLeft, Calendar, CalendarDays, ScrollText, PenLine, Bot, MessageCircle, CornerDownRight } from 'lucide-react';
import styles from './featured-detail.module.css';

const QuillEditor = dynamic(() => import('@/components/QuillEditor'), { ssr: false });

const NICKNAME_KEY = 'featuredAnonNickname';
const NICKNAME_MIN = 2;
const NICKNAME_MAX = 20;

export default function FeaturedDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, profile, anonymousUser, loading: authLoading } = useAuth();

  const [passage, setPassage] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [anonNicknameInput, setAnonNicknameInput] = useState('');

  const isMember = !!(user && profile);
  // 회원과 비회원 모두 댓글 작성 가능. 로그인 상태가 확정되기 전에는 막아서
  // 회원이 비회원 입력창을 보거나 익명 계정을 만드는 일이 없게 한다.
  const canComment = !authLoading;

  useEffect(() => {
    getDoc(doc(db, 'featuredPassages', id)).then(snap => {
      if (snap.exists()) setPassage({ id: snap.id, ...snap.data() });
    });
    loadComments();
  }, [id]);

  useEffect(() => {
    if (user || anonymousUser) return;
    if (typeof window === 'undefined') return;
    const saved = sessionStorage.getItem(NICKNAME_KEY) || '';
    setAnonNicknameInput(saved);
  }, [user, anonymousUser]);

  async function loadComments() {
    const snap = await getDocs(query(collection(db, 'featuredPassages', id, 'comments'), orderBy('createdAt', 'asc')));
    setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  const isEmptyHtml = (html) => !html || html.replace(/<(.|\n)*?>/g, '').trim() === '';

  async function addComment(parentId = null) {
    if (!canComment) return;
    const text = parentId ? replyText : commentText;
    if (parentId ? !text.trim() : isEmptyHtml(text)) return;
    let nickname;
    if (isMember) {
      nickname = profile.nickname;
    } else {
      nickname = anonNicknameInput.trim();
      if (!nickname || nickname.length < NICKNAME_MIN || nickname.length > NICKNAME_MAX) {
        alert(`닉네임을 ${NICKNAME_MIN}~${NICKNAME_MAX}자로 입력해주세요.`);
        return;
      }
      // 회원 닉네임과 겹치면 익명 계정을 만들기 전에 막는다. (서버 API도 같은 검사를 다시 한다.)
      try {
        const taken = await getDocs(query(collection(db, 'users'), where('nickname', '==', nickname), limit(1)));
        if (!taken.empty) {
          alert(NICKNAME_TAKEN_MESSAGE);
          return;
        }
      } catch (error) {
        console.error('nickname check failed', error);
      }
    }
    try {
      // 비회원은 댓글을 등록하는 이 시점에만 익명 계정을 만든다. (페이지를 보기만 하면 만들지 않음)
      if (!auth.currentUser) await signInAnonymously(auth);
      const result = await authenticatedJsonFetch(`/api/content/featured/${encodeURIComponent(id)}/comments`, {
        method: 'POST',
        body: { content: text, nickname, parentId },
      });
      if (result.contentWasSanitized) {
        alert('안전하지 않거나 지원되지 않는 HTML을 제거한 뒤 저장했습니다.');
      }
      // 알림 API는 회원 전용이므로 비회원 댓글은 알림을 보내지 않는다.
      if (isMember) {
        authenticatedFetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'comment', collectionName: 'featuredPassages', postId: id, commentId: result.id }),
        }).catch(() => {});
      }
      if (parentId) { setReplyText(''); setReplyTo(null); }
      else setCommentText('');
      loadComments();
    } catch (error) {
      alert(`저장 실패: ${error.message}`);
    }
  }

  async function deleteComment(commentId) {
    if (!confirm('댓글을 삭제할까요?')) return;
    await deleteDoc(doc(db, 'featuredPassages', id, 'comments', commentId));
    loadComments();
  }

  async function editComment(commentId) {
    const target = comments.find(c => c.id === commentId);
    const isRich = target?.isRich || !target?.parentId;
    if (isRich ? isEmptyHtml(editCommentText) : !editCommentText.trim()) return;
    try {
      const result = await authenticatedJsonFetch(
        `/api/content/featured/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}`,
        { method: 'PATCH', body: { content: editCommentText } },
      );
      if (result.contentWasSanitized) {
        alert('안전하지 않거나 지원되지 않는 HTML을 제거한 뒤 저장했습니다.');
      }
      setEditingCommentId(null);
      loadComments();
    } catch (error) {
      alert(`저장 실패: ${error.message}`);
    }
  }

  const isAdmin = profile?.role === 'admin';
  const effectiveUid = user?.uid || anonymousUser?.uid || null;
  const formatDate = (ts) => ts?.toDate ? `${ts.toDate().getMonth()+1}/${ts.toDate().getDate()}` : '';

  function saveAnonNickname(name) {
    const trimmed = name.trim();
    if (trimmed.length >= NICKNAME_MIN && trimmed.length <= NICKNAME_MAX) {
      try { sessionStorage.setItem(NICKNAME_KEY, trimmed); } catch {}
    } else {
      try { sessionStorage.removeItem(NICKNAME_KEY); } catch {}
    }
  }

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: passage.bookTitle, url });
    } else {
      await navigator.clipboard.writeText(url);
      alert('링크가 복사됐어요!');
    }
  }
  const topComments = comments.filter(c => !c.parentId);
  const getReplies = (commentId) => comments.filter(c => c.parentId === commentId);

  if (!passage) return <div className="empty-msg">로딩 중…</div>;

  return (
    <div>
      <button onClick={() => router.push('/featured')} className={styles.backBtn}>
        <ArrowLeft size={14} /> 목록으로
      </button>

      {/* 기간 배지 */}
      <div className={styles.periodBadge}>
        {passage.period === 'weekly' ? <><Calendar size={11} /> 이 주의 글</> : <><CalendarDays size={11} /> 이 달의 글</>} · {passage.periodKey}
      </div>

      {/* 발췌문 / 큐레이터 소개 */}
      <div className={`card ${styles.passageCard}`}>
        {passage.kind === 'public_domain' && passage.excerpt ? (
          <>
            <p className={styles.excerptQuote}>
              "{passage.excerpt}"
            </p>
            {passage.curatorNote && (
              <p className={styles.curatorNoteQuoted}>
                {passage.curatorNote}
              </p>
            )}
            <div className={styles.metaFooter}>
              <span className={styles.kindBadge}><ScrollText size={10} /> 자유 이용</span>
              <p className={styles.bookTitleMeta}>{passage.bookTitle}</p>
              {passage.bookAuthor && <p className={styles.bookAuthorMeta}>{passage.bookAuthor}</p>}
              {passage.sourceUrl && (
                <p className={styles.sourceUrlText}>
                  출처: <a href={passage.sourceUrl} target="_blank" rel="noopener noreferrer" className={styles.sourceUrlLink}>{passage.sourceUrl}</a>
                </p>
              )}
              {passage.source && <p className={styles.sourceText}>{passage.source}</p>}
              <p className={styles.licenseNote}>공표 후 보호기간 만료 저작물 — 자유롭게 이용 가능</p>
            </div>
          </>
        ) : passage.kind === 'curator_intro' ? (
          <>
            {passage.curatorNote && (
              <p className={styles.curatorNoteMain}>
                {passage.curatorNote}
              </p>
            )}
            {passage.excerpt && (
              <div className={styles.quoteBox}>
                <p className={styles.quoteBoxText}>
                  "{passage.excerpt}"
                </p>
                {passage.source && <p className={styles.quoteBoxSource}>— {passage.source}</p>}
              </div>
            )}
            <div className={styles.metaFooter}>
              <span className={styles.kindBadgeMuted}><PenLine size={10} /> 큐레이터 소개</span>
              {passage.aiGenerated?.curatorNote && <span className={styles.aiBadge}><Bot size={10} /> AI 큐레이션</span>}
              <p className={styles.bookTitleMeta}>{passage.bookTitle}</p>
              {passage.bookAuthor && <p className={styles.bookAuthorMeta}>{passage.bookAuthor}</p>}
              <p className={styles.licenseNote}>이 글은 책에 대한 큐레이터의 소개이며, 책의 원문 발췌가 아닙니다.</p>
            </div>
          </>
        ) : (
          <>
            <p className={styles.excerptQuote}>
              "{passage.passage}"
            </p>
            <div className={styles.metaFooter}>
              <p className={styles.bookTitleMetaTight}>{passage.bookTitle}</p>
              {passage.bookAuthor && <p className={styles.bookAuthorMeta}>{passage.bookAuthor}</p>}
              {passage.source && <p className={styles.sourceUrlText}>출처: {passage.source}</p>}
            </div>
          </>
        )}

        {/* 공유 버튼 */}
        <div className={styles.shareRow}>
          <button onClick={handleShare} className={styles.shareBtn}>
            공유
          </button>
        </div>
      </div>

      {/* 토론 질문 */}
      {passage.questions?.length > 0 && (
        <div className={`card ${styles.questionsCard}`}>
          <h2 className={styles.questionsTitle}><MessageCircle size={14} /> 함께 나눠볼 질문</h2>
          <ol className={styles.questionsList}>
            {passage.questions.map((q, i) => (
              <li key={i} className={styles.questionItem}>
                <span className={styles.questionNum}>{i + 1}.</span>
                <span className={styles.questionText}>{q}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 댓글 */}
      <div className={`card ${styles.commentsCard}`}>
        <h3 className={styles.commentsTitle}>
          댓글 {comments.length}개
        </h3>

        {/* 댓글 작성 */}
        {canComment ? (
          <div className={styles.composerWrap}>
            {!isMember && (
              <div className={styles.nicknameFieldWrap}>
                <input
                  type="text"
                  placeholder={`닉네임 (${NICKNAME_MIN}~${NICKNAME_MAX}자) *`}
                  value={anonNicknameInput}
                  maxLength={NICKNAME_MAX}
                  onChange={e => {
                    setAnonNicknameInput(e.target.value);
                    saveAnonNickname(e.target.value);
                  }}
                  className={styles.nicknameInput}
                />
              </div>
            )}
            <QuillEditor
              value={commentText}
              onChange={setCommentText}
              placeholder="생각을 남겨주세요…"
              minHeight={120}
            />
            <div className={styles.composerActions}>
              <button onClick={() => addComment()} className={`btn-sm ${styles.accentBtn}`}>등록</button>
            </div>
          </div>
        ) : (
          <p className={styles.pendingText}>
            댓글을 준비하는 중이에요…
          </p>
        )}

        {/* 댓글 목록 */}
        {topComments.length === 0 ? (
          <p className={styles.emptyCommentText}>
            첫 번째 댓글을 남겨보세요.
          </p>
        ) : (
          topComments.map(c => (
            <div key={c.id}>
              <div className="comment-item">
                <div className={styles.commentHeadRow}>
                  <span className={styles.commentNickname}>{c.nickname}</span>
                  {c.isAnonymous && (
                    <span className={styles.anonBadge}>비회원</span>
                  )}
                  <span className={styles.commentDate}>{formatDate(c.createdAt)}</span>
                  <div className={styles.commentActions}>
                    {canComment && (
                      <button onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
                        className={styles.actionLink}>답글</button>
                    )}
                    {(effectiveUid === c.uid || isAdmin) && (
                      <>
                        <button onClick={() => { setEditingCommentId(c.id); setEditCommentText(c.content); }}
                          className={styles.actionLink}>수정</button>
                        <button onClick={() => deleteComment(c.id)}
                          className={styles.actionLinkDanger}>삭제</button>
                      </>
                    )}
                  </div>
                </div>

                {editingCommentId === c.id ? (
                  <div>
                    <QuillEditor
                      value={editCommentText}
                      onChange={setEditCommentText}
                      placeholder="내용을 수정해주세요…"
                      minHeight={100}
                    />
                    <div className={styles.composerActions}>
                      <button onClick={() => editComment(c.id)} className={`btn-sm ${styles.accentBtn}`}>완료</button>
                      <button onClick={() => setEditingCommentId(null)} className="btn-sm btn-outline">취소</button>
                    </div>
                  </div>
                ) : (
                  <ContentLightbox
                    contentClassName={`ql-editor ql-snow ${styles.commentContent}`}
                  >
                    <ExpandableContent html={dangerousHtml(c.content)} />
                  </ContentLightbox>
                )}

                {/* 답글 입력 */}
                {replyTo === c.id && (
                  <div className={styles.replyInputRow}>
                    <input type="text" placeholder="답글을 입력해주세요…" value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addComment(c.id)}
                      className={styles.flexInput13} />
                    <button onClick={() => addComment(c.id)} className={`btn-sm ${styles.accentBtn}`}>등록</button>
                  </div>
                )}
              </div>

              {/* 대댓글 */}
              {getReplies(c.id).map(r => (
                <div key={r.id} className="reply-item">
                  <div className={styles.commentHeadRow}>
                    <CornerDownRight size={11} className={styles.replyIcon} />
                    <span className={styles.commentNickname}>{r.nickname}</span>
                    {r.isAnonymous && (
                      <span className={styles.anonBadge}>비회원</span>
                    )}
                    <span className={styles.commentDate}>{formatDate(r.createdAt)}</span>
                    {(effectiveUid === r.uid || isAdmin) && (
                      <div className={styles.commentActions}>
                        <button onClick={() => { setEditingCommentId(r.id); setEditCommentText(r.content); }}
                          className={styles.actionLink}>수정</button>
                        <button onClick={() => deleteComment(r.id)}
                          className={styles.actionLinkDanger}>삭제</button>
                      </div>
                    )}
                  </div>
                  {editingCommentId === r.id ? (
                    <div className={styles.editRow}>
                      <input value={editCommentText} onChange={e => setEditCommentText(e.target.value)}
                        className={styles.flexInput13} onKeyDown={e => e.key === 'Enter' && editComment(r.id)} />
                      <button onClick={() => editComment(r.id)} className={`btn-sm ${styles.accentBtn}`}>완료</button>
                      <button onClick={() => setEditingCommentId(null)} className="btn-sm btn-outline">취소</button>
                    </div>
                  ) : (
                    <ExpandableContent
                      text={r.content}
                      className={styles.replyText}
                    />
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

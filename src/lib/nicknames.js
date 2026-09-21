// 비회원(익명) 댓글 작성자가 회원 닉네임을 그대로 쓰면 그 회원(관리자 포함)으로 오인될 수 있다.
// 가입 화면의 중복 검사와 같은 기준(users 문서의 nickname과 정확히 일치)으로 막는다.
export const NICKNAME_TAKEN_MESSAGE = '이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해주세요.';

// Admin SDK의 Firestore(db)로 회원 프로필에 같은 닉네임이 있는지 확인한다. (서버 API 전용)
export async function isMemberNicknameTaken(db, nickname) {
  const snap = await db.collection('users').where('nickname', '==', nickname).limit(1).get();
  return !snap.empty;
}

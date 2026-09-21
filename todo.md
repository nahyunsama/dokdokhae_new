# TODO

## 비회원 댓글(익명 로그인) 운영 작업

**정책**: 이주의 글/이달의 글은 비회원도 댓글을 쓸 수 있음. 익명 로그인은 이 기능에만 사용한다.

**동작**
- 페이지를 보기만 해서는 익명 계정을 만들지 않는다. 댓글 등록을 누르는 시점에만 `signInAnonymously` 호출
- 익명 토큰은 이주의 글 댓글 API(작성/수정)에서만 허용 (`requireAuthenticatedUser(request, { allowAnonymous: true })`).
  다른 API와 Firestore 규칙(`isSignedIn`)은 익명을 거부한다. 예외는 이주의 글 댓글 삭제 규칙 하나뿐
- 비회원 댓글은 계정당 15초 간격 제한 (`assertAnonymousCommentInterval`)
- 비회원 댓글은 알림(`/api/notify`)을 보내지 않는다. 알림 API가 회원 전용이기 때문

### 운영 작업

- [ ] Firebase Console → Authentication → Sign-in method → **Anonymous 활성화** (비활성화 상태라면)
- [ ] `firestore.rules` 배포 (`firebase deploy --only firestore:rules`, Vercel로는 배포되지 않음)
- [ ] 오래된 익명 계정 정리 자동화 (아래)

### 익명 계정 정리 자동화

**상태**: 대기 (익명 계정이 누적된 뒤 구현)

댓글을 쓴 비회원만 계정이 생기지만 시간이 지나면 Firebase Auth에 계속 쌓인다.
익명 계정이 100명 이상 쌓였을 때 구현한다.

- [ ] `src/app/api/cron/route.js`에 익명 사용자 삭제 로직 추가
  - `getAuth().listUsers()`로 조회, 이메일·로그인 제공자가 없고 Firestore `users/{uid}` 문서가 없는 계정만 대상
  - 30일 이상 경과한 계정을 `auth.deleteUsers()`로 일괄 삭제
  - 결과를 `log` 배열에 추가
- [ ] 스케줄러가 매일 `/api/cron`을 호출하는지 확인 (`Authorization: Bearer ${CRON_SECRET}`)

### 참고

- 익명 계정을 삭제해도 그 계정이 쓴 댓글 문서는 남는다. 다만 작성자는 자기 댓글을 수정·삭제할 수 없게 되고 관리자만 가능
- 수동 삭제: Firebase Console → Authentication → Users → 익명 사용자 선택 삭제

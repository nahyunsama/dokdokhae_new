# TODO

## 익명 로그인 제거 후속 작업

**상태**: 코드 제거 완료. 아래 운영 작업이 남아 있음.

**배경**: 운영자 승인이 필요한 독서모임이라 비회원 댓글(익명 로그인)을 없앰. 이주의 글/이달의 글 댓글은 회원만 작성 가능.
서버(`requireAuthenticatedUser`)와 Firestore 규칙(`isSignedIn`)은 이전에 만들어진 익명 계정도 거부한다.

### 운영 작업

- [ ] Firebase Console → Authentication → Sign-in method → **Anonymous 비활성화**
  - 화면 코드를 지워도 공개 웹 API 키로 익명 계정을 만들 수 있으므로 반드시 필요
- [ ] `firestore.rules` 배포 (`firebase deploy --only firestore:rules`, Vercel로는 배포되지 않음)
- [ ] 기존 익명 계정 일괄 삭제 (Firebase Console → Authentication → Users 에서 선택 삭제,
  많으면 Admin SDK `listUsers()` + `deleteUsers()` 일회성 실행)
  - 새 익명 계정이 더 이상 생기지 않으므로 `/api/cron` 자동 정리는 필요 없음

### 참고

- 기존 익명 댓글(`isAnonymous: true`)은 그대로 남고 "비회원" 배지로 표시됨. 수정·삭제는 관리자만 가능

// users 컬렉션 문서에 저장된 `email` 필드를 제거하는 일회성 마이그레이션.
//
// users 문서는 누구나 읽을 수 있으므로(firestore.rules) 이메일이 남아 있으면 노출된다.
// 이메일은 Firebase Auth(user.email)에 그대로 있으므로 삭제해도 기능에는 영향이 없다.
//
// 사용법 (기본은 dry-run: 대상 건수만 출력하고 아무것도 바꾸지 않는다)
//   node --env-file=.env.local scripts/remove-user-emails.mjs
//   node --env-file=.env.local scripts/remove-user-emails.mjs --apply
//
// 필요한 환경변수: FIREBASE_SERVICE_ACCOUNT_KEY (서버 전용 서비스 계정 JSON)

import { cert, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const BATCH_SIZE = 400; // Firestore 배치 한도(500) 아래로 유지
const apply = process.argv.includes('--apply');

if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  console.error('FIREBASE_SERVICE_ACCOUNT_KEY 환경변수가 필요합니다. (--env-file=.env.local 확인)');
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
const db = getFirestore(initializeApp({ credential: cert(serviceAccount) }));

console.log(`프로젝트: ${serviceAccount.project_id}`);
console.log(apply ? '모드: APPLY (실제로 삭제)' : '모드: DRY-RUN (변경 없음, 실제 삭제는 --apply)');

// 개인정보를 로그에 남기지 않기 위해 이메일 값은 출력하지 않고 문서 ID와 건수만 다룬다.
const snap = await db.collection('users').get();
const targets = snap.docs.filter((d) => Object.hasOwn(d.data(), 'email'));

console.log(`users 문서 ${snap.size}건 중 email 필드가 있는 문서: ${targets.length}건`);

if (!apply) {
  console.log('dry-run 종료. 위 문서들에서 email을 삭제하려면 --apply를 붙여 다시 실행하세요.');
  process.exit(0);
}

let removed = 0;
for (let i = 0; i < targets.length; i += BATCH_SIZE) {
  const batch = db.batch();
  targets.slice(i, i + BATCH_SIZE).forEach((d) => batch.update(d.ref, { email: FieldValue.delete() }));
  await batch.commit();
  removed += Math.min(BATCH_SIZE, targets.length - i);
  console.log(`  진행: ${removed}/${targets.length}`);
}

console.log(`완료: ${removed}건에서 email 필드를 삭제했습니다.`);

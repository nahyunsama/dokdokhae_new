import assert from 'node:assert/strict';
import test from 'node:test';

import { NICKNAME_TAKEN_MESSAGE, isMemberNicknameTaken } from '../src/lib/nicknames.js';

// Admin SDK의 collection().where().limit().get() 체인을 흉내 내는 가짜 db.
// 실제 Firestore처럼 nickname이 정확히 같은 문서만 돌려주고, 호출된 조건을 기록한다.
function fakeDb(users) {
  const calls = [];
  const db = {
    collection(name) {
      calls.push(['collection', name]);
      return {
        where(field, op, value) {
          calls.push(['where', field, op, value]);
          return {
            limit(n) {
              calls.push(['limit', n]);
              return {
                async get() {
                  const docs = Object.entries(users)
                    .filter(([, data]) => data[field] === value)
                    .map(([id]) => ({ id }));
                  return { empty: docs.length === 0, docs };
                },
              };
            },
          };
        },
      };
    },
  };
  return { db, calls };
}

const MEMBERS = {
  u1: { nickname: '독서왕' },
  u2: { nickname: '관리자' },
};

test('reports a nickname that a member already uses', async () => {
  const { db } = fakeDb(MEMBERS);

  assert.equal(await isMemberNicknameTaken(db, '독서왕'), true);
  assert.equal(await isMemberNicknameTaken(db, '관리자'), true);
});

test('allows a nickname that no member uses', async () => {
  const { db } = fakeDb(MEMBERS);

  assert.equal(await isMemberNicknameTaken(db, '지나가던사람'), false);
  assert.equal(await isMemberNicknameTaken(fakeDb({}).db, '독서왕'), false);
});

test('queries only the users collection by exact nickname, one document', async () => {
  const { db, calls } = fakeDb(MEMBERS);
  await isMemberNicknameTaken(db, '독서왕');

  assert.deepEqual(calls, [
    ['collection', 'users'],
    ['where', 'nickname', '==', '독서왕'],
    ['limit', 1],
  ]);
});

test('exposes the alert message shown to the user', () => {
  assert.match(NICKNAME_TAKEN_MESSAGE, /이미 사용 중인 닉네임/);
});

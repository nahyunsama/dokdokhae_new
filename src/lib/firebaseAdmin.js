import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { NextResponse } from 'next/server';

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  return initializeApp({ credential: cert(serviceAccount) });
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

export function getAdminMessaging() {
  return getMessaging(getAdminApp());
}

export async function requireAuthenticatedUser(request) {
  const authorization = request.headers.get('authorization') || '';
  const [scheme, idToken] = authorization.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !idToken) {
    return {
      response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    };
  }

  let user;
  try {
    user = await getAuth(getAdminApp()).verifyIdToken(idToken);
  } catch {
    return {
      response: NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 }),
    };
  }

  // 익명 로그인은 더 이상 사용하지 않는다. 이전에 만들어진 익명 계정의 토큰은 거부한다.
  if (user.firebase?.sign_in_provider === 'anonymous') {
    return {
      response: NextResponse.json({ error: 'Anonymous accounts are not allowed' }, { status: 403 }),
    };
  }

  return { user };
}

export async function requireAdminUser(request) {
  const authResult = await requireAuthenticatedUser(request);
  if (authResult.response) return authResult;

  const profileSnap = await getAdminDb().collection('users').doc(authResult.user.uid).get();
  if (!profileSnap.exists || profileSnap.data().role !== 'admin') {
    return {
      response: NextResponse.json({ error: 'Admin permission required' }, { status: 403 }),
    };
  }

  return authResult;
}

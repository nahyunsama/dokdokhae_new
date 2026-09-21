import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb, requireAuthenticatedUser } from '@/lib/firebaseAdmin';
import {
  CONTENT_LIMITS,
  ContentApiError,
  contentApiErrorResponse,
  documentId,
  getUserProfile,
  readJsonBody,
  requiredString,
  requireProfile,
  sanitizedRichHtml,
} from '@/lib/contentApi';

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuthenticatedUser(request);
    if (authResult.response) return authResult.response;

    const { id: rawId } = await params;
    const passageId = documentId(rawId, 'featured passage id');
    const body = await readJsonBody(request);
    const parentId = body.parentId == null || body.parentId === ''
      ? null
      : documentId(body.parentId, 'parentId');
    const db = getAdminDb();
    const passageRef = db.collection('featuredPassages').doc(passageId);
    const [passageSnap, profile] = await Promise.all([
      passageRef.get(),
      getUserProfile(db, authResult.user.uid),
    ]);
    if (!passageSnap.exists) throw new ContentApiError(404, 'Featured passage not found');

    if (parentId) {
      const parentSnap = await passageRef.collection('comments').doc(parentId).get();
      if (!parentSnap.exists) throw new ContentApiError(400, 'Parent comment not found');
      if (parentSnap.data().parentId) {
        throw new ContentApiError(400, 'Replies can only target a top-level comment');
      }
    }

    const { nickname } = requireProfile(profile);
    const isRich = !parentId;
    const content = isRich
      ? sanitizedRichHtml(body.content, CONTENT_LIMITS.commentHtml)
      : {
          html: requiredString(body.content, 'content', CONTENT_LIMITS.commentHtml),
          removedUnsafeContent: false,
        };
    const ref = passageRef.collection('comments').doc();
    await ref.set({
      content: content.html,
      nickname,
      uid: authResult.user.uid,
      parentId,
      isRich,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      id: ref.id,
      content: content.html,
      contentWasSanitized: content.removedUnsafeContent,
    }, { status: 201 });
  } catch (error) {
    return contentApiErrorResponse(error, 'create featured comment');
  }
}

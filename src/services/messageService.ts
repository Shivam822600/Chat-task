import { DocumentSnapshot, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from '../firebase';
import { AppError } from '../errors';

// chats/{chatId}/messages/{messageId}
// chats/{chatId}/messages/{messageId}/receipts/{userId}
// chats/{chatId}/members/{userId}   (last seen message)

const messages = (chatId: string) => db.collection('chats').doc(chatId).collection('messages');

function format(chatId: string, doc: DocumentSnapshot) {
  const data = doc.data() ?? {};
  const toDate = (t?: Timestamp) => (t ? t.toDate().toISOString() : null);

  return {
    id: doc.id,
    chatId,
    senderId: data.senderId as string,
    text: data.deleted ? null : (data.text as string),
    createdAt: toDate(data.createdAt),
    editedAt: toDate(data.editedAt),
    deleted: !!data.deleted,
    readBy: (data.readBy as string[]) ?? [],
  };
}

async function findMessage(chatId: string, messageId: string) {
  const doc = await messages(chatId).doc(messageId).get();
  if (!doc.exists) throw new AppError(404, 'message not found');
  return doc;
}

export async function sendMessage(chatId: string, senderId: string, text: string) {
  const ref = messages(chatId).doc();
  await ref.set({
    senderId,
    text,
    createdAt: FieldValue.serverTimestamp(),
    editedAt: null,
    deleted: false,
    readBy: [],
  });
  return format(chatId, await ref.get());
}

export async function getMessages(chatId: string, limit: number) {
  // grab the newest ones, then flip so they read oldest -> newest
  const snap = await messages(chatId).orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((d) => format(chatId, d)).reverse();
}

export async function markRead(chatId: string, messageId: string, userId: string) {
  const msg = await findMessage(chatId, messageId);
  const receiptRef = msg.ref.collection('receipts').doc(userId);
  const receipt = await receiptRef.get();
  if (receipt.exists) {
    return { messageId, userId, alreadyRead: true };
  }

  const batch = db.batch();
  batch.set(receiptRef, { userId, readAt: FieldValue.serverTimestamp() });
  batch.update(msg.ref, { readBy: FieldValue.arrayUnion(userId) });
  await batch.commit();

  return { messageId, userId, alreadyRead: false };
}

export async function updateLastSeen(chatId: string, userId: string, messageId: string) {
  await findMessage(chatId, messageId);

  await db
    .collection('chats')
    .doc(chatId)
    .collection('members')
    .doc(userId)
    .set({ lastSeenMessageId: messageId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  return { userId, lastSeenMessageId: messageId };
}

export async function editMessage(chatId: string, messageId: string, userId: string, text: string) {
  const msg = await findMessage(chatId, messageId);
  if (msg.get('senderId') !== userId) throw new AppError(403, 'you can only edit your own messages');
  if (msg.get('deleted')) throw new AppError(400, 'message was deleted');

  await msg.ref.update({ text, editedAt: FieldValue.serverTimestamp() });
  return format(chatId, await msg.ref.get());
}

export async function deleteMessage(chatId: string, messageId: string, userId: string) {
  const msg = await findMessage(chatId, messageId);
  if (msg.get('senderId') !== userId) throw new AppError(403, 'you can only delete your own messages');

  // soft delete so the ordering and receipts don't break
  await msg.ref.update({ deleted: true, text: '' });
}

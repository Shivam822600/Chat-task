import { pool } from '../db';
import { AppError } from '../errors';

export async function createUser(name: string, email: string) {
  const { rows } = await pool.query(
    'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email',
    [name, email]
  );
  return rows[0];
}

export async function createOrGetChat(userAId: string, userBId: string): Promise<string> {
  if (userAId === userBId) {
    throw new AppError(400, 'cannot chat with yourself');
  }

  // same key no matter which user comes first
  const directKey = [userAId, userBId].sort().join(':');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const created = await client.query(
      `INSERT INTO chats (type, direct_key) VALUES ('direct', $1)
       ON CONFLICT (direct_key) DO NOTHING RETURNING id`,
      [directKey]
    );

    let chatId: string;
    if (created.rows.length > 0) {
      chatId = created.rows[0].id;
      await client.query('INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2), ($1, $3)', [
        chatId,
        userAId,
        userBId,
      ]);
    } else {
      const existing = await client.query('SELECT id FROM chats WHERE direct_key = $1', [directKey]);
      chatId = existing.rows[0].id;
    }

    await client.query('COMMIT');
    return chatId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function assertChatExists(chatId: string) {
  const chat = await pool.query('SELECT 1 FROM chats WHERE id = $1', [chatId]);
  if (chat.rows.length === 0) throw new AppError(404, 'chat not found');
}

export async function assertMember(chatId: string, userId: string) {
  await assertChatExists(chatId);

  const member = await pool.query('SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2', [
    chatId,
    userId,
  ]);
  if (member.rows.length === 0) throw new AppError(403, 'you are not a member of this chat');
}

export async function listUserChats(userId: string) {
  const user = await pool.query('SELECT 1 FROM users WHERE id = $1', [userId]);
  if (user.rows.length === 0) throw new AppError(404, 'user not found');

  const { rows } = await pool.query(
    `SELECT c.id, c.type, c.name, c.created_at,
            array_agg(m2.user_id::text) AS member_ids
     FROM chat_members m
     JOIN chats c ON c.id = m.chat_id
     JOIN chat_members m2 ON m2.chat_id = c.id
     WHERE m.user_id = $1
     GROUP BY c.id
     ORDER BY c.created_at DESC`,
    [userId]
  );

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    name: r.name,
    memberIds: r.member_ids,
    createdAt: r.created_at,
  }));
}

export async function createGroup(name: string, creatorId: string, memberIds: string[]): Promise<string> {
  const everyone = Array.from(new Set([creatorId, ...memberIds]));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const chat = await client.query(
      "INSERT INTO chats (type, name, created_by) VALUES ('group', $1, $2) RETURNING id",
      [name, creatorId]
    );
    const chatId: string = chat.rows[0].id;

    for (const id of everyone) {
      const role = id === creatorId ? 'admin' : 'member';
      await client.query('INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, $3)', [
        chatId,
        id,
        role,
      ]);
    }

    await client.query('COMMIT');
    return chatId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function assertGroupAdmin(chatId: string, userId: string) {
  const { rows } = await pool.query(
    `SELECT c.type, m.role FROM chats c
     LEFT JOIN chat_members m ON m.chat_id = c.id AND m.user_id = $2
     WHERE c.id = $1`,
    [chatId, userId]
  );
  if (rows.length === 0) throw new AppError(404, 'chat not found');
  if (rows[0].type !== 'group') throw new AppError(400, 'not a group chat');
  if (rows[0].role !== 'admin') throw new AppError(403, 'only admins can do that');
}

export async function addMembers(chatId: string, actorId: string, userIds: string[]) {
  await assertGroupAdmin(chatId, actorId);
  for (const id of userIds) {
    await pool.query(
      'INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [chatId, id]
    );
  }
}

export async function removeMember(chatId: string, actorId: string, userId: string) {
  // members can leave on their own, otherwise you need to be admin
  if (actorId !== userId) {
    await assertGroupAdmin(chatId, actorId);
  }
  const result = await pool.query('DELETE FROM chat_members WHERE chat_id = $1 AND user_id = $2', [
    chatId,
    userId,
  ]);
  if (result.rowCount === 0) throw new AppError(404, 'member not found');
}

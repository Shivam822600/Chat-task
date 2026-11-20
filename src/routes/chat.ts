import { Router } from 'express';
import { z } from 'zod';
import { wrap } from '../errors';
import * as chatService from '../services/chatService';
import * as messageService from '../services/messageService';

const router = Router();

const uuid = z.string().uuid();
const text = z.string().trim().min(1).max(4000);

// create or get 1:1 chat
router.post(
  '/create',
  wrap(async (req, res) => {
    const { userAId, userBId } = z.object({ userAId: uuid, userBId: uuid }).parse(req.body);
    const chatId = await chatService.createOrGetChat(userAId, userBId);
    res.json({ chatId });
  })
);

// group chat
router.post(
  '/group',
  wrap(async (req, res) => {
    const { name, creatorId, memberIds } = z
      .object({ name: z.string().trim().min(1), creatorId: uuid, memberIds: z.array(uuid).min(1) })
      .parse(req.body);
    const chatId = await chatService.createGroup(name, creatorId, memberIds);
    res.status(201).json({ chatId });
  })
);

router.post(
  '/:chatId/members',
  wrap(async (req, res) => {
    const chatId = uuid.parse(req.params.chatId);
    const { actorId, userIds } = z.object({ actorId: uuid, userIds: z.array(uuid).min(1) }).parse(req.body);
    await chatService.addMembers(chatId, actorId, userIds);
    res.sendStatus(204);
  })
);

router.delete(
  '/:chatId/members/:userId',
  wrap(async (req, res) => {
    const chatId = uuid.parse(req.params.chatId);
    const userId = uuid.parse(req.params.userId);
    const { actorId } = z.object({ actorId: uuid }).parse(req.query);
    await chatService.removeMember(chatId, actorId, userId);
    res.sendStatus(204);
  })
);

// send message
router.post(
  '/:chatId/message/send',
  wrap(async (req, res) => {
    const chatId = uuid.parse(req.params.chatId);
    const body = z.object({ senderId: uuid, text }).parse(req.body);

    await chatService.assertMember(chatId, body.senderId);
    const message = await messageService.sendMessage(chatId, body.senderId, body.text);
    res.status(201).json(message);
  })
);

// get messages
router.get(
  '/:chatId/messages',
  wrap(async (req, res) => {
    const chatId = uuid.parse(req.params.chatId);
    const query = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).default(50),
        userId: uuid.optional(), // if sent, we check that this user is in the chat
      })
      .parse(req.query);

    if (query.userId) {
      await chatService.assertMember(chatId, query.userId);
    } else {
      await chatService.assertChatExists(chatId);
    }
    const list = await messageService.getMessages(chatId, query.limit);
    res.json({ messages: list });
  })
);

// mark read
router.post(
  '/:chatId/message/:messageId/read',
  wrap(async (req, res) => {
    const chatId = uuid.parse(req.params.chatId);
    const { userId } = z.object({ userId: uuid }).parse(req.body);

    await chatService.assertMember(chatId, userId);
    const result = await messageService.markRead(chatId, req.params.messageId, userId);
    res.json(result);
  })
);

// last seen
router.post(
  '/:chatId/lastseen',
  wrap(async (req, res) => {
    const chatId = uuid.parse(req.params.chatId);
    const { userId, messageId } = z.object({ userId: uuid, messageId: z.string().min(1) }).parse(req.body);

    await chatService.assertMember(chatId, userId);
    const result = await messageService.updateLastSeen(chatId, userId, messageId);
    res.json(result);
  })
);

// edit / delete
router.patch(
  '/:chatId/message/:messageId',
  wrap(async (req, res) => {
    const chatId = uuid.parse(req.params.chatId);
    const body = z.object({ userId: uuid, text }).parse(req.body);

    await chatService.assertMember(chatId, body.userId);
    const message = await messageService.editMessage(chatId, req.params.messageId, body.userId, body.text);
    res.json(message);
  })
);

router.delete(
  '/:chatId/message/:messageId',
  wrap(async (req, res) => {
    const chatId = uuid.parse(req.params.chatId);
    const { userId } = z.object({ userId: uuid }).parse(req.query);

    await chatService.assertMember(chatId, userId);
    await messageService.deleteMessage(chatId, req.params.messageId, userId);
    res.sendStatus(204);
  })
);

export default router;

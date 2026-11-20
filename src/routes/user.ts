import { Router } from 'express';
import { z } from 'zod';
import { wrap } from '../errors';
import * as chatService from '../services/chatService';

const router = Router();

// just for testing, so we can make users without touching the db by hand
router.post(
  '/',
  wrap(async (req, res) => {
    const { name, email } = z.object({ name: z.string().min(1), email: z.string().email() }).parse(req.body);
    const user = await chatService.createUser(name, email);
    res.status(201).json(user);
  })
);

router.get(
  '/:userId/chats',
  wrap(async (req, res) => {
    const userId = z.string().uuid().parse(req.params.userId);
    const chats = await chatService.listUserChats(userId);
    res.json({ chats });
  })
);

export default router;

# Chat Backend

Chat API built with Node.js, TypeScript and Express. Users, chats and members are in PostgreSQL, messages / read receipts / last seen are in Firebase Firestore.

## Running it

```
npm install
cp .env.example .env
docker compose up -d
npm run migrate
npm run dev
```

For Firebase, put your service account key somewhere and set `FIREBASE_SERVICE_ACCOUNT_PATH` in `.env`. If you'd rather use the Firestore emulator, set `FIRESTORE_EMULATOR_HOST` instead (see `.env.example`).

## Endpoints

- `POST /chat/create` - body `{ userAId, userBId }`, returns `{ chatId }`
- `POST /chat/:chatId/message/send` - body `{ senderId, text }`
- `GET /chat/:chatId/messages?limit=50` - oldest to newest
- `POST /chat/:chatId/message/:messageId/read` - body `{ userId }`
- `POST /chat/:chatId/lastseen` - body `{ userId, messageId }`
- `GET /user/:userId/chats`

Extras I added:

- `POST /users` - body `{ name, email }`, handy for testing
- `POST /chat/group` - body `{ name, creatorId, memberIds }`
- `POST /chat/:chatId/members` - body `{ actorId, userIds }`, admin only
- `DELETE /chat/:chatId/members/:userId?actorId=...` - admin removes someone, or a member leaves
- `PATCH /chat/:chatId/message/:messageId` - body `{ userId, text }`
- `DELETE /chat/:chatId/message/:messageId?userId=...`

## Notes

- `GET messages` also accepts an optional `userId`. If you pass it, it must be a member of the chat.
- There's no login. User ids come from the request like the task says, so in a real app they'd come from a token.
- A pair of users can only ever have one 1:1 chat (unique `direct_key` on the chats table).
- Message timestamps are set by Firestore (server timestamp), not the client.
- Deleting a message only blanks it out, the doc stays so ordering and receipts don't break.

## Firestore layout

```
chats/{chatId}/messages/{messageId}
chats/{chatId}/messages/{messageId}/receipts/{userId}
chats/{chatId}/members/{userId}        <- lastSeenMessageId
```

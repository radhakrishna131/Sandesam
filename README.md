# Workspace

## Overview

pnpm workspace monorepo using TypeScript. The primary project is **Sandesam** — a real-time chat web application.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Real-time**: Socket.io (server) + socket.io-client (frontend)
- **Auth**: Session-based (express-session + bcryptjs)
- **File upload**: Multer (local disk storage under `uploads/`)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server + Socket.io (WebSockets)
│   └── sandesam/           # React + Vite frontend (chat UI)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Sandesam Features

- **Authentication**: Phone number + password, bcrypt hashing, session cookies
- **Forgot Password**: DOB verification flow (no OTP), secure token-based reset
- **Profile**: Username, date of birth, profile picture, last seen
- **Real-time chat**: Socket.io for instant messaging, typing indicators, online/offline status
- **Media sharing**: Images, videos, documents (stored locally via multer)
- **Search**: Find users by phone number
- **Dark mode**: Toggle stored in localStorage

## Database Schema (PostgreSQL via Drizzle)

- `users` — id, phone_number, password_hash, username, date_of_birth, profile_picture_url, created_at, last_seen
- `chats` — chat_id, user1_id, user2_id, created_at
- `messages` — message_id, chat_id, sender_id, message_text, file_url, file_type, file_name, timestamp
- `reset_tokens` — id, user_id, token, used, expires_at, created_at

## API Routes

- `POST /api/auth/signup` — register with phone + password
- `POST /api/auth/login` — login
- `POST /api/auth/logout` — logout
- `GET /api/auth/me` — get current user
- `POST /api/auth/forgot-password/verify` — verify DOB for password reset
- `POST /api/auth/forgot-password/reset` — reset password with token
- `PUT /api/users/profile` — update profile
- `GET /api/users/search?phone=...` — search users
- `GET /api/users/:id` — get user by ID
- `GET /api/chats` — list user's chats
- `POST /api/chats` — create/get chat with user
- `GET /api/chats/:chatId/messages` — get messages
- `POST /api/chats/:chatId/messages` — send message
- `POST /api/upload/file` — upload file (multipart)
- `GET /api/uploads/:filename` — serve uploaded file

## Socket.io Events

- Client→Server: `join(userId)`, `joinChat(chatId)`, `leaveChat(chatId)`, `typing({chatId, isTyping})`
- Server→Client: `message(Message)`, `userStatus({userId, online, lastSeen})`, `typing({chatId, userId, isTyping})`

## Routing

- Frontend (Sandesam): `previewPath: /`, served by Vite on dev
- API Server: `/api/*` routes, also handles Socket.io at `/api/socket.io`

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json`. Run `pnpm run typecheck` from root for full check.
hi
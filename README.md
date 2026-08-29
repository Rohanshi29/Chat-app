<<<<<<< HEAD
<img width="1366" height="640" alt="image" src="https://github.com/user-attachments/assets/3b7c5339-177b-41bd-9207-8021bab580e4" />
<img width="1366" height="648" alt="image" src="https://github.com/user-attachments/assets/6a230a99-5302-4428-b123-a38b1c806074" />
<img width="440" height="394" alt="image" src="https://github.com/user-attachments/assets/857c1fa1-965c-493d-a276-aa1b34a71560" />
<img width="1051" height="201" alt="image" src="https://github.com/user-attachments/assets/e8d61f10-617e-4dcf-b492-612919979807" />
<img width="1366" height="643" alt="image" src="https://github.com/user-attachments/assets/8bb09f25-25b6-443d-962a-37efb6f54ba8" />

=======
# Real-Time Chat Application

A full-stack real-time chat app with one-to-one and group messaging, voice/video calling with screen share, AI features, an admin dashboard, push notifications, and more.

## Tech Stack

- **Frontend:** React (Vite), React Router, Socket.io-client, Axios, emoji-picker-react, native WebRTC + Web Push APIs
- **Backend:** Node.js, Express.js, Socket.io, MongoDB (Mongoose), JWT, bcrypt, Multer, web-push

## Features Implemented

**Core**
- Auth: register, login, logout, JWT sessions, bcrypt password hashing
- Profiles: username, bio/status, profile picture upload, edit profile
- One-to-one & group chat: instant messaging via Socket.io, message history, timestamps, create/rename groups, add/remove members (with a UI to create groups)
- Online status: live online/offline indicator, last-seen timestamp, typing indicator
- Emoji picker, file/image sharing, voice notes (record + send)

**Messaging extras**
- Read receipts (✓ sent / ✓✓ read)
- Message search within a chat
- Emoji reactions
- Edit & delete messages (delete for me / delete for everyone)
- Pin/unpin messages, collapsible pinned bar
- Per-chat wallpaper picker

**Calling**
- 1:1 voice and video calls over WebRTC, signaled through Socket.io
- Mute/unmute, camera on/off, screen sharing
- *Not included:* group video calls (would need an SFU or full mesh architecture — a bigger lift than a mesh 1:1 call)

**AI (needs your own Anthropic API key)**
- Floating AI chat assistant
- Per-chat conversation summarization
- Smart reply suggestions
- Per-message translation
- Sentiment analysis endpoint (`/api/ai/sentiment`, not yet surfaced in the UI)

**Modern**
- Dark mode with persistence
- Browser push notifications (Web Push + service worker)

**Admin**
- `/admin` dashboard (admin-only): user list with ban/unban/delete, live stats, 7-day message volume chart

## Project Structure

```
chat-app/
├── backend/
│   ├── config/         # DB connection, multer upload config, web-push config
│   ├── controllers/    # auth, user, chat, message, admin, AI logic
│   ├── middleware/      # JWT auth + admin-role middleware
│   ├── models/          # User, Chat, Message (Mongoose)
│   ├── routes/           # REST API routes
│   ├── scripts/          # one-off CLI scripts (make a user admin, generate VAPID keys)
│   ├── utils/             # Anthropic API client wrapper
│   ├── socket.js          # Socket.io real-time + WebRTC signaling relay
│   └── server.js          # App entry point
└── frontend/
    ├── public/
    │   └── sw.js           # Push notification service worker
    └── src/
        ├── api/            # Axios client
        ├── context/        # Auth, Socket, Call, Theme React contexts
        ├── hooks/          # Push notification hook
        ├── components/     # Sidebar, ChatWindow, CallModal, AdminRoute, etc.
        └── pages/           # Login, Register, Chat, AdminDashboard
```

## Prerequisites

- Node.js 18+
- MongoDB running locally (or a connection string to MongoDB Atlas)

## Setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# edit .env: set MONGO_URI and a strong JWT_SECRET
npm run dev      # starts on http://localhost:5000 (uses nodemon)
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
# edit .env if your backend runs on a different URL
npm run dev      # starts on http://localhost:5173
```

Open `http://localhost:5173` in two different browser sessions (or an incognito window) to test real-time chat, calling, etc. between two accounts.

### 3. Optional: AI features

Get an API key at https://console.anthropic.com, then set in `backend/.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Without a key, the AI endpoints return a clear "not configured" error instead of crashing — the rest of the app works fine.

### 4. Optional: Forgot password emails

Forgot-password works out of the box in dev without any setup — if SMTP isn't
configured, the reset link is just printed to the backend console instead of
emailed, so you can copy it straight from the terminal.

To actually send real emails, set these in `backend/.env` (Gmail example —
use an [App Password](https://myaccount.google.com/apppasswords), not your
normal password):

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=you@gmail.com
```

Any standard SMTP provider works (SendGrid, Mailgun, Postmark, etc.) — just point `SMTP_HOST`/`SMTP_PORT` at it.

### 5. Optional: Push notifications

```bash
cd backend
node scripts/generateVapidKeys.js
```

Copy the printed `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` into `backend/.env`, and the public key into `frontend/.env` as `VITE_VAPID_PUBLIC_KEY`. Push requires HTTPS in production (localhost is fine for dev).

### 6. Optional: Make yourself an admin

New accounts are created with role `user`. Promote one:

```bash
cd backend
node scripts/makeAdmin.js you@example.com
```

Then visit `/admin` while logged in as that user.

### 7. Calling limitations

Calls use only public STUN servers — no TURN server is configured, so calls may fail to connect across some strict corporate NATs/firewalls. For production reliability, add a TURN server (e.g. via Twilio or self-hosted coturn) to the `ICE_SERVERS` config in `frontend/src/context/CallContext.jsx`.

## Environment Variables

**backend/.env**
| Variable | Description |
|---|---|
| `PORT` | Backend server port (default 5000) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign JWTs — set a long random value |
| `JWT_EXPIRES_IN` | Token lifetime (e.g. `7d`) |
| `CLIENT_URL` | Frontend origin, used for CORS |
| `ANTHROPIC_API_KEY` | Optional — enables the AI features |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Optional — enables push notifications |
| `VAPID_CONTACT_EMAIL` | Contact email included in push requests |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Optional — enables real password-reset emails (logs to console if unset) |

**frontend/.env**
| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend base URL (e.g. `http://localhost:5000`) |
| `VITE_VAPID_PUBLIC_KEY` | Optional — must match the backend's VAPID public key |

## API Overview

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Log in, returns JWT |
| POST | `/api/auth/logout` | Log out (auth required) |
| POST | `/api/auth/forgot-password` | Request a password reset email |
| POST | `/api/auth/reset-password/:token` | Set a new password using a reset token |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/users` | List all other users |
| PUT | `/api/users/profile` | Update profile (multipart, supports picture upload) |
| POST | `/api/users/push-subscribe` | Save a Web Push subscription |
| DELETE | `/api/users/push-subscribe` | Remove push subscription |
| POST | `/api/chats` | Create/access a one-to-one chat |
| GET | `/api/chats` | List my chats |
| POST | `/api/chats/group` | Create a group chat |
| PUT | `/api/chats/group/rename` | Rename a group |
| PUT | `/api/chats/group/add` | Add member to group |
| PUT | `/api/chats/group/remove` | Remove member from group |
| PUT | `/api/chats/wallpaper` | Set a chat's wallpaper |
| POST | `/api/messages` | Send a text message |
| POST | `/api/messages/file` | Send a file/image message (multipart) |
| POST | `/api/messages/voice` | Send a voice note (multipart) |
| GET | `/api/messages/:chatId` | Get message history for a chat |
| GET | `/api/messages/search/:chatId?q=` | Search messages in a chat |
| GET | `/api/messages/pinned/:chatId` | Get pinned messages |
| PUT | `/api/messages/read/:chatId` | Mark a chat's messages as read |
| PUT | `/api/messages/:id` | Edit a message |
| DELETE | `/api/messages/:id?forEveryone=true` | Delete a message |
| POST | `/api/messages/:id/react` | Toggle a reaction |
| POST | `/api/messages/:id/pin` | Toggle pin state |
| POST | `/api/ai/chat` | AI assistant chat |
| POST | `/api/ai/summarize` | Summarize a chat |
| POST | `/api/ai/smart-reply` | Get quick-reply suggestions |
| POST | `/api/ai/translate` | Translate text |
| POST | `/api/ai/sentiment` | Classify sentiment |
| GET | `/api/admin/stats` | Dashboard stats (admin only) |
| GET | `/api/admin/users` | List users (admin only) |
| PUT | `/api/admin/users/:id/ban` \| `/unban` | Ban/unban a user (admin only) |
| DELETE | `/api/admin/users/:id` | Delete a user (admin only) |

All routes except register/login require an `Authorization: Bearer <token>` header.

## Socket.io Events

| Event | Direction | Purpose |
|---|---|---|
| `join-chat` / `leave-chat` | client → server | Join/leave a chat room |
| `send-message` / `receive-message` | both | Relay new messages in real time |
| `typing` / `stop-typing` | both | Typing indicator |
| `message-read` / `chat-read` | both | Read receipts |
| `message-edited` / `message-deleted` / `message-reaction` / `message-pinned` | both | Relay message updates in real time |
| `user-online` / `user-offline` | server → client | Presence updates |
| `call:initiate` / `call:incoming` | both | Start/receive a call |
| `call:answer` / `call:answered` | both | Accept a call |
| `call:ice-candidate` | both | WebRTC ICE negotiation |
| `call:reject` / `call:rejected` | both | Decline a call |
| `call:end` / `call:ended` | both | Hang up |
| `call:unavailable` | server → client | Callee is offline |

The socket connection authenticates using the same JWT as the REST API, passed via `socket.handshake.auth.token`.

## Notes & Next Steps

This is a working foundation, not a production-hardened deployment. Before shipping, consider:
- Rate limiting and input validation/sanitization on all endpoints
- Cloud storage (S3, etc.) instead of local disk for uploaded files
- Pagination for chat/message history
- Unread message counts in the sidebar
- A TURN server for reliable calling across restrictive networks
- Group video calling (SFU-based, e.g. via mediasoup or a hosted service like LiveKit/Twilio)
- Tests (unit + integration)
- HTTPS and secure cookie/token storage in production
>>>>>>> 06165d9 (Updated Project)

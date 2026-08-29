const jwt = require("jsonwebtoken");
const User = require("./models/User");

// Maps userId -> Set of socket ids (a user can have multiple tabs/devices open)
const onlineUsers = new Map();

const initSocket = (io) => {
  // Authenticate socket connections using the same JWT used for REST API
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication error"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user) return next(new Error("Authentication error"));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.user._id.toString();

    // Track this socket under the user
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Every socket belonging to this user joins a personal room, so call
    // signaling can be routed straight to a user without needing them to
    // have a particular chat open.
    socket.join(userId);

    // Mark user online in DB (only flip on first connection)
    if (onlineUsers.get(userId).size === 1) {
      await User.findByIdAndUpdate(userId, { isOnline: true });
      socket.broadcast.emit("user-online", { userId });
    }

    // Tell the newly-connected client who's already online right now -
    // otherwise it only learns about online/offline changes that happen
    // *after* it connects, and everyone looks offline on a fresh page load.
    socket.emit("online-users", { userIds: Array.from(onlineUsers.keys()) });

    // Join a room per chat so messages broadcast only to chat members
    socket.on("join-chat", (chatId) => {
      socket.join(chatId);
    });

    socket.on("leave-chat", (chatId) => {
      socket.leave(chatId);
    });

    // Relay a new message to everyone else in the chat room
    socket.on("send-message", (message) => {
      const chatId = message.chat?._id || message.chat;
      socket.to(chatId).emit("receive-message", message);
    });

    // Typing indicators
    socket.on("typing", ({ chatId }) => {
      socket.to(chatId).emit("typing", { chatId, userId });
    });

    socket.on("stop-typing", ({ chatId }) => {
      socket.to(chatId).emit("stop-typing", { chatId, userId });
    });

    // Message read receipts
    socket.on("message-read", ({ chatId, messageId }) => {
      socket.to(chatId).emit("message-read", { messageId, userId });
    });

    // Chat-read-all: fired once when a user opens/focuses a chat so the
    // sender's UI can flip single ticks to double ticks.
    socket.on("chat-read", ({ chatId }) => {
      socket.to(chatId).emit("chat-read", { chatId, userId });
    });

    // Relay message edits, deletes, reactions and pin toggles - all of
    // these are already persisted via REST first, this just pushes the
    // resulting change to everyone else viewing the chat in real time.
    socket.on("message-edited", (payload) => {
      socket.to(payload.chatId).emit("message-edited", payload);
    });

    socket.on("message-deleted", (payload) => {
      socket.to(payload.chatId).emit("message-deleted", payload);
    });

    socket.on("message-reaction", (payload) => {
      socket.to(payload.chatId).emit("message-reaction", payload);
    });

    socket.on("message-pinned", (payload) => {
      socket.to(payload.chatId).emit("message-pinned", payload);
    });

    // ---- WebRTC call signaling ----
    // Everything here is a thin relay: the two peers do the actual media
    // negotiation, this socket layer just ferries messages between the
    // caller and callee's personal (userId) rooms.

    // Caller starts a call
    socket.on("call:initiate", ({ toUserId, chatId, offer, callType }) => {
      if (!onlineUsers.has(toUserId)) {
        socket.emit("call:unavailable", { toUserId, chatId });
        return;
      }
      socket.data.callPeer = toUserId;
      io.to(toUserId).emit("call:incoming", {
        fromUser: {
          _id: socket.user._id,
          username: socket.user.username,
          profilePicture: socket.user.profilePicture,
        },
        chatId,
        offer,
        callType,
      });
    });

    // Callee accepts and sends back an SDP answer
    socket.on("call:answer", ({ toUserId, chatId, answer }) => {
      socket.data.callPeer = toUserId;
      io.to(toUserId).emit("call:answered", { chatId, answer });
    });

    // Either side trickles ICE candidates
    socket.on("call:ice-candidate", ({ toUserId, candidate }) => {
      io.to(toUserId).emit("call:ice-candidate", { candidate });
    });

    // Callee declines
    socket.on("call:reject", ({ toUserId, chatId }) => {
      io.to(toUserId).emit("call:rejected", { chatId });
      socket.data.callPeer = null;
    });

    // Either side hangs up
    socket.on("call:end", ({ toUserId, chatId }) => {
      io.to(toUserId).emit("call:ended", { chatId });
      socket.data.callPeer = null;
    });

    socket.on("disconnect", async () => {
      // If this socket was mid-call, let the other side know so their UI
      // doesn't hang waiting for a peer that's gone.
      if (socket.data.callPeer) {
        io.to(socket.data.callPeer).emit("call:ended", { chatId: null });
      }

      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastSeen: new Date(),
          });
          socket.broadcast.emit("user-offline", {
            userId,
            lastSeen: new Date(),
          });
        }
      }
    });
  });
};

module.exports = { initSocket, onlineUsers };

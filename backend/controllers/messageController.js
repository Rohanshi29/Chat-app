const Message = require("../models/Message");
const Chat = require("../models/Chat");
const User = require("../models/User");
const { sendPushNotification } = require("../config/webpush");

const POPULATE_SENDER = "username profilePicture";

// Pushes a live sidebar-preview update to every member of the chat (via
// their personal userId room, joined in socket.js), so the chat list's
// "latest message" preview updates immediately instead of only refreshing
// on next page load.
const broadcastChatUpdate = (req, message) => {
  const io = req.app.get("io");
  if (!io || !message.chat?.users) return;
  message.chat.users.forEach((memberId) => {
    io.to(memberId.toString()).emit("chat-updated", {
      chatId: message.chat._id,
      latestMessage: message,
    });
  });
};

// Fire-and-forget push notifications to every chat member except the
// sender who has a saved push subscription.
const notifyChatMembers = async (chatId, senderId, senderName, previewText) => {
  try {
    const chat = await Chat.findById(chatId);
    if (!chat) return;

    const recipients = await User.find({
      _id: { $in: chat.users.filter((id) => id.toString() !== senderId.toString()) },
      pushSubscription: { $ne: null },
    });

    await Promise.all(
      recipients.map((r) =>
        sendPushNotification(r.pushSubscription, {
          title: chat.isGroupChat ? `${senderName} in ${chat.chatName}` : senderName,
          body: previewText,
          chatId: chat._id.toString(),
        })
      )
    );
  } catch (error) {
    console.error("notifyChatMembers failed:", error.message);
  }
};

// @route  POST /api/messages
// Send a text message
const sendMessage = async (req, res) => {
  try {
    const { chatId, content } = req.body;

    if (!chatId || !content) {
      return res
        .status(400)
        .json({ message: "chatId and content are required" });
    }

    let message = await Message.create({
      sender: req.user._id,
      chat: chatId,
      content,
      messageType: "text",
      readBy: [req.user._id],
    });

    message = await message.populate("sender", POPULATE_SENDER);
    message = await message.populate("chat");

    await Chat.findByIdAndUpdate(chatId, { latestMessage: message._id });
    notifyChatMembers(chatId, req.user._id, req.user.username, content);
    broadcastChatUpdate(req, message);

    res.status(201).json({ message });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  POST /api/messages/file
// Send a file/image message (multipart upload)
const sendFileMessage = async (req, res) => {
  try {
    const { chatId } = req.body;

    if (!chatId || !req.file) {
      return res
        .status(400)
        .json({ message: "chatId and file are required" });
    }

    const isImage = req.file.mimetype.startsWith("image/");

    let message = await Message.create({
      sender: req.user._id,
      chat: chatId,
      messageType: isImage ? "image" : "file",
      fileUrl: `/uploads/${req.file.filename}`,
      fileName: req.file.originalname,
      readBy: [req.user._id],
    });

    message = await message.populate("sender", POPULATE_SENDER);
    message = await message.populate("chat");

    await Chat.findByIdAndUpdate(chatId, { latestMessage: message._id });
    notifyChatMembers(
      chatId,
      req.user._id,
      req.user.username,
      isImage ? "📷 Photo" : `📎 ${req.file.originalname}`
    );
    broadcastChatUpdate(req, message);

    res.status(201).json({ message });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  POST /api/messages/voice
// Send a recorded voice note (multipart upload, field name "voice")
const sendVoiceMessage = async (req, res) => {
  try {
    const { chatId, duration } = req.body;

    if (!chatId || !req.file) {
      return res
        .status(400)
        .json({ message: "chatId and voice file are required" });
    }

    let message = await Message.create({
      sender: req.user._id,
      chat: chatId,
      messageType: "voice",
      fileUrl: `/uploads/${req.file.filename}`,
      fileName: req.file.originalname,
      fileDuration: Number(duration) || 0,
      readBy: [req.user._id],
    });

    message = await message.populate("sender", POPULATE_SENDER);
    message = await message.populate("chat");

    await Chat.findByIdAndUpdate(chatId, { latestMessage: message._id });
    notifyChatMembers(chatId, req.user._id, req.user.username, "🎤 Voice message");
    broadcastChatUpdate(req, message);

    res.status(201).json({ message });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  GET /api/messages/:chatId
// Get all messages for a chat (message history), hiding anything the
// requester deleted "for me" and masking anything deleted "for everyone".
const getMessages = async (req, res) => {
  try {
    const messages = await Message.find({
      chat: req.params.chatId,
      deletedFor: { $ne: req.user._id },
    })
      .populate("sender", POPULATE_SENDER)
      .populate("reactions.user", POPULATE_SENDER)
      .sort({ createdAt: 1 });

    res.json({ messages });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  GET /api/messages/search/:chatId?q=keyword
// Search message content within a single chat
const searchMessages = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return res.json({ messages: [] });
    }

    const trimmedQ = q.trim();
    const messages = await Message.find({
      chat: req.params.chatId,
      deletedFor: { $ne: req.user._id },
      isDeleted: false,
      $or: [
        { content: { $regex: trimmedQ, $options: "i" } },
        { fileName: { $regex: trimmedQ, $options: "i" } },
      ],
    })
      .populate("sender", POPULATE_SENDER)
      .sort({ createdAt: 1 })
      .limit(100);

    res.json({ messages });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  PUT /api/messages/:id
// Edit a text message (sender only)
const editMessage = async (req, res) => {
  try {
    const { content } = req.body;
    const message = await Message.findById(req.params.id);

    if (!message) return res.status(404).json({ message: "Message not found" });
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You can only edit your own messages" });
    }
    if (message.isDeleted) {
      return res.status(400).json({ message: "Cannot edit a deleted message" });
    }
    if (message.messageType !== "text") {
      return res.status(400).json({ message: "Only text messages can be edited" });
    }

    message.content = content;
    message.edited = true;
    await message.save();

    const populated = await message.populate("sender", POPULATE_SENDER);
    res.json({ message: populated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  DELETE /api/messages/:id?forEveryone=true
const deleteMessage = async (req, res) => {
  try {
    const { forEveryone } = req.query;
    const message = await Message.findById(req.params.id);

    if (!message) return res.status(404).json({ message: "Message not found" });

    if (forEveryone === "true") {
      if (message.sender.toString() !== req.user._id.toString()) {
        return res
          .status(403)
          .json({ message: "Only the sender can delete for everyone" });
      }
      message.isDeleted = true;
      message.content = "";
      message.fileUrl = "";
      message.fileName = "";
      await message.save();
    } else {
      if (!message.deletedFor.some((id) => id.toString() === req.user._id.toString())) {
        message.deletedFor.push(req.user._id);
        await message.save();
      }
    }

    res.json({ messageId: message._id, isDeleted: message.isDeleted, forEveryone: forEveryone === "true" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  POST /api/messages/:id/react   body: { emoji }
// Toggles a reaction: if the user already reacted with this emoji it's
// removed, if they reacted with a different one it's replaced.
const reactToMessage = async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ message: "emoji is required" });

    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: "Message not found" });

    const existingIndex = message.reactions.findIndex(
      (r) => r.user.toString() === req.user._id.toString()
    );

    if (existingIndex !== -1 && message.reactions[existingIndex].emoji === emoji) {
      message.reactions.splice(existingIndex, 1);
    } else if (existingIndex !== -1) {
      message.reactions[existingIndex].emoji = emoji;
    } else {
      message.reactions.push({ user: req.user._id, emoji });
    }

    await message.save();
    const populated = await message.populate("reactions.user", POPULATE_SENDER);
    res.json({ messageId: message._id, reactions: populated.reactions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  POST /api/messages/:id/pin
// Toggles a message's pinned state on its chat
const togglePinMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: "Message not found" });

    const chat = await Chat.findById(message.chat);
    if (!chat) return res.status(404).json({ message: "Chat not found" });

    const isPinned = chat.pinnedMessages.some((id) => id.toString() === message._id.toString());

    if (isPinned) {
      chat.pinnedMessages = chat.pinnedMessages.filter(
        (id) => id.toString() !== message._id.toString()
      );
    } else {
      chat.pinnedMessages.push(message._id);
    }

    await chat.save();
    res.json({ chatId: chat._id, pinnedMessages: chat.pinnedMessages, pinned: !isPinned });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  GET /api/messages/pinned/:chatId
const getPinnedMessages = async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId).populate({
      path: "pinnedMessages",
      populate: { path: "sender", select: POPULATE_SENDER },
    });
    if (!chat) return res.status(404).json({ message: "Chat not found" });
    res.json({ messages: chat.pinnedMessages });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  PUT /api/messages/read/:chatId
// Mark all messages in a chat as read by the requester (used for ✓✓ read receipts)
const markChatRead = async (req, res) => {
  try {
    await Message.updateMany(
      { chat: req.params.chatId, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );
    res.json({ chatId: req.params.chatId, readerId: req.user._id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  sendMessage,
  sendFileMessage,
  sendVoiceMessage,
  getMessages,
  searchMessages,
  editMessage,
  deleteMessage,
  reactToMessage,
  togglePinMessage,
  getPinnedMessages,
  markChatRead,
};

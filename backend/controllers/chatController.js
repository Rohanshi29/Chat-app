const Chat = require("../models/Chat");
const User = require("../models/User");

// @route  POST /api/chats
// Create or fetch existing one-to-one chat with another user
const accessChat = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    let chat = await Chat.findOne({
      isGroupChat: false,
      users: { $all: [req.user._id, userId], $size: 2 },
    })
      .populate("users", "-password")
      .populate("latestMessage");

    if (chat) {
      return res.json({ chat });
    }

    const newChat = await Chat.create({
      isGroupChat: false,
      users: [req.user._id, userId],
    });

    const fullChat = await Chat.findById(newChat._id).populate(
      "users",
      "-password"
    );

    res.status(201).json({ chat: fullChat });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  GET /api/chats
// Get all chats for the logged-in user
const getChats = async (req, res) => {
  try {
    const chats = await Chat.find({ users: req.user._id })
      .populate("users", "-password")
      .populate("groupAdmin", "-password")
      .populate("latestMessage")
      .sort({ updatedAt: -1 });

    res.json({ chats });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  POST /api/chats/group
const createGroupChat = async (req, res) => {
  try {
    const { chatName, users } = req.body;

    if (!chatName || !users || users.length < 2) {
      return res.status(400).json({
        message: "A group chat needs a name and at least 2 other users",
      });
    }

    const allUsers = [...users, req.user._id.toString()];

    const groupChat = await Chat.create({
      chatName,
      isGroupChat: true,
      users: allUsers,
      groupAdmin: req.user._id,
    });

    const fullGroupChat = await Chat.findById(groupChat._id)
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    res.status(201).json({ chat: fullGroupChat });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  PUT /api/chats/group/rename
const renameGroup = async (req, res) => {
  try {
    const { chatId, chatName } = req.body;

    const chat = await Chat.findByIdAndUpdate(
      chatId,
      { chatName },
      { new: true }
    )
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    if (!chat) return res.status(404).json({ message: "Chat not found" });
    res.json({ chat });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  PUT /api/chats/group/add
const addToGroup = async (req, res) => {
  try {
    const { chatId, userId } = req.body;

    const chat = await Chat.findByIdAndUpdate(
      chatId,
      { $addToSet: { users: userId } },
      { new: true }
    )
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    if (!chat) return res.status(404).json({ message: "Chat not found" });
    res.json({ chat });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  PUT /api/chats/group/remove
const removeFromGroup = async (req, res) => {
  try {
    const { chatId, userId } = req.body;

    const chat = await Chat.findByIdAndUpdate(
      chatId,
      { $pull: { users: userId } },
      { new: true }
    )
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    if (!chat) return res.status(404).json({ message: "Chat not found" });
    res.json({ chat });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  PUT /api/chats/wallpaper
// Set a per-chat wallpaper (a CSS color/gradient string, or an uploaded image path)
const setWallpaper = async (req, res) => {
  try {
    const { chatId, wallpaper } = req.body;
    if (!chatId) return res.status(400).json({ message: "chatId is required" });

    const chat = await Chat.findByIdAndUpdate(
      chatId,
      { wallpaper: wallpaper || "" },
      { new: true }
    );
    if (!chat) return res.status(404).json({ message: "Chat not found" });

    res.json({ chatId: chat._id, wallpaper: chat.wallpaper });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  accessChat,
  getChats,
  createGroupChat,
  renameGroup,
  addToGroup,
  removeFromGroup,
  setWallpaper,
};

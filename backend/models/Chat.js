const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    isGroupChat: {
      type: Boolean,
      default: false,
    },
    chatName: {
      type: String,
      trim: true,
      // required only for group chats
    },
    groupPicture: {
      type: String,
      default: "",
    },
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    groupAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    latestMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    pinnedMessages: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
      },
    ],
    wallpaper: {
      // simple per-chat wallpaper: a CSS color/gradient or an uploaded image URL
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Chat", chatSchema);

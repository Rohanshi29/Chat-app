const express = require("express");
const {
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
} = require("../controllers/messageController");
const { protect } = require("../middleware/auth");
const upload = require("../config/upload");

const router = express.Router();

router.use(protect);

router.post("/", sendMessage);
router.post("/file", upload.single("file"), sendFileMessage);
router.post("/voice", upload.single("voice"), sendVoiceMessage);

router.get("/search/:chatId", searchMessages);
router.get("/pinned/:chatId", getPinnedMessages);
router.put("/read/:chatId", markChatRead);

router.put("/:id", editMessage);
router.delete("/:id", deleteMessage);
router.post("/:id/react", reactToMessage);
router.post("/:id/pin", togglePinMessage);

router.get("/:chatId", getMessages);

module.exports = router;

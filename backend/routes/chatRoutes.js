const express = require("express");
const {
  accessChat,
  getChats,
  createGroupChat,
  renameGroup,
  addToGroup,
  removeFromGroup,
  setWallpaper,
} = require("../controllers/chatController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect);

router.post("/", accessChat);
router.get("/", getChats);
router.post("/group", createGroupChat);
router.put("/group/rename", renameGroup);
router.put("/group/add", addToGroup);
router.put("/group/remove", removeFromGroup);
router.put("/wallpaper", setWallpaper);

module.exports = router;

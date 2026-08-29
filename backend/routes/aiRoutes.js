const express = require("express");
const {
  chatAssistant,
  summarizeChat,
  smartReply,
  translateText,
  analyzeSentiment,
} = require("../controllers/aiController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect);

router.post("/chat", chatAssistant);
router.post("/summarize", summarizeChat);
router.post("/smart-reply", smartReply);
router.post("/translate", translateText);
router.post("/sentiment", analyzeSentiment);

module.exports = router;

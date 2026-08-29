const { askClaude } = require("../utils/aiClient");
const Message = require("../models/Message");

const handleAiError = (res, error) => {
  const status = error.statusCode || 500;
  res.status(status).json({ message: error.message });
};

// @route  POST /api/ai/chat   body: { message, history? }
// Built-in AI assistant the user can chat with directly (not tied to a
// specific contact) - answers general questions.
const chatAssistant = async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ message: "message is required" });

    const messages = [
      ...history.slice(-10).map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ];

    const reply = await askClaude({
      system:
        "You are a helpful, concise AI assistant embedded in a chat app. Keep replies short and conversational.",
      messages,
    });

    res.json({ reply });
  } catch (error) {
    handleAiError(res, error);
  }
};

// @route  POST /api/ai/summarize   body: { chatId }
// Summarizes the recent conversation in a chat.
const summarizeChat = async (req, res) => {
  try {
    const { chatId } = req.body;
    if (!chatId) return res.status(400).json({ message: "chatId is required" });

    const messages = await Message.find({ chat: chatId, isDeleted: false })
      .populate("sender", "username")
      .sort({ createdAt: -1 })
      .limit(50);

    if (messages.length === 0) {
      return res.json({ summary: "There's nothing to summarize yet." });
    }

    const transcript = messages
      .reverse()
      .map((m) => `${m.sender?.username || "Unknown"}: ${m.content || `[${m.messageType}]`}`)
      .join("\n");

    const summary = await askClaude({
      system:
        "Summarize this chat conversation in 3-5 short bullet points, focused on decisions made and open questions.",
      messages: [{ role: "user", content: transcript }],
      maxTokens: 300,
    });

    res.json({ summary });
  } catch (error) {
    handleAiError(res, error);
  }
};

// @route  POST /api/ai/smart-reply   body: { chatId }
// Suggests 3 short quick-reply options based on the latest incoming message.
const smartReply = async (req, res) => {
  try {
    const { chatId } = req.body;
    if (!chatId) return res.status(400).json({ message: "chatId is required" });

    const recent = await Message.find({ chat: chatId, isDeleted: false, messageType: "text" })
      .populate("sender", "username")
      .sort({ createdAt: -1 })
      .limit(6);

    if (recent.length === 0) {
      return res.json({ suggestions: [] });
    }

    const transcript = recent
      .reverse()
      .map((m) => `${m.sender?.username || "Unknown"}: ${m.content}`)
      .join("\n");

    const raw = await askClaude({
      system:
        'Given the recent chat transcript, suggest 3 short, casual quick replies the last recipient could send. Return ONLY a JSON array of 3 strings, nothing else, e.g. ["Sounds good!","Can we do tomorrow?","Thanks!"]',
      messages: [{ role: "user", content: transcript }],
      maxTokens: 150,
    });

    let suggestions = [];
    try {
      suggestions = JSON.parse(raw.trim().replace(/^```json|```$/g, ""));
    } catch {
      suggestions = [];
    }

    res.json({ suggestions });
  } catch (error) {
    handleAiError(res, error);
  }
};

// @route  POST /api/ai/translate   body: { text, targetLanguage }
const translateText = async (req, res) => {
  try {
    const { text, targetLanguage } = req.body;
    if (!text || !targetLanguage) {
      return res.status(400).json({ message: "text and targetLanguage are required" });
    }

    const translation = await askClaude({
      system: `Translate the user's message into ${targetLanguage}. Reply with ONLY the translated text, no notes or quotes.`,
      messages: [{ role: "user", content: text }],
      maxTokens: 300,
    });

    res.json({ translation: translation.trim() });
  } catch (error) {
    handleAiError(res, error);
  }
};

// @route  POST /api/ai/sentiment   body: { text }
const analyzeSentiment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: "text is required" });

    const raw = await askClaude({
      system:
        'Classify the sentiment of the message. Reply with ONLY one word: "positive", "negative", or "neutral".',
      messages: [{ role: "user", content: text }],
      maxTokens: 10,
    });

    const sentiment = raw.trim().toLowerCase().replace(/[^a-z]/g, "");
    res.json({
      sentiment: ["positive", "negative", "neutral"].includes(sentiment)
        ? sentiment
        : "neutral",
    });
  } catch (error) {
    handleAiError(res, error);
  }
};

module.exports = { chatAssistant, summarizeChat, smartReply, translateText, analyzeSentiment };

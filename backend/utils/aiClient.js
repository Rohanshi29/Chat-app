// Thin wrapper around the Anthropic Messages API for the app's AI features
// (assistant, summarize, smart replies, translate, sentiment).
//
// Requires ANTHROPIC_API_KEY to be set in backend/.env - get one at
// https://console.anthropic.com. All AI routes return a clear 503 error if
// the key isn't configured, instead of crashing the server.

const MODEL = "claude-sonnet-5";

const isConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

const askClaude = async ({ system, messages, maxTokens = 500 }) => {
  if (!isConfigured()) {
    const err = new Error(
      "AI features are not configured: set ANTHROPIC_API_KEY in backend/.env"
    );
    err.statusCode = 503;
    throw err;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    const err = new Error(`Anthropic API error: ${text}`);
    err.statusCode = 502;
    throw err;
  }

  const data = await response.json();
  return data.content?.map((block) => block.text || "").join("") || "";
};

module.exports = { askClaude, isConfigured };

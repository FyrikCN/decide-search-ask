const axios = require('axios');

function getConfig() {
  const baseURL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY');
  }
  return {
    baseURL,
    apiKey,
    decisionModel: process.env.DECISION_MODEL || 'gpt-4o-mini',
    answerModel: process.env.ANSWER_MODEL || 'gpt-4o',
  };
}

async function chatCompletion({ model, messages, max_tokens = 500, temperature = 0.2 }) {
  const { baseURL, apiKey } = getConfig();
  const url = `${baseURL}/chat/completions`;
  try {
    const response = await axios.post(
      url,
      { model, messages, max_tokens, temperature },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 60000,
      }
    );
    return response.data.choices?.[0]?.message?.content?.trim() || '';
  } catch (error) {
    const status = error.response?.status;
    const body = error.response?.data;
    const detail =
      typeof body === 'string'
        ? body
        : body?.error?.message || body?.message || JSON.stringify(body || {});
    const err = new Error(
      `LLM request failed (${status || 'no-status'}) model=${model} url=${url}: ${detail || error.message}`
    );
    err.status = status && status >= 400 && status < 600 ? 502 : 500;
    throw err;
  }
}

/**
 * Decide whether web search is needed.
 * Expects model output like:
 *   SEARCH
 *   <optimized query>
 * or:
 *   NO_SEARCH
 */
async function decideSearch(question) {
  const { decisionModel } = getConfig();
  const content = await chatCompletion({
    model: decisionModel,
    max_tokens: 80,
    messages: [
      {
        role: 'system',
        content: `You decide whether a web search is needed to answer the user.
If current/realtime facts, news, sports, prices, FX rates, or unknown specifics are needed, reply exactly:
SEARCH
<short search query in English, specific and factual>
Examples of good queries: "NZD to CNY exchange rate today", "Fed funds rate July 2026"
Otherwise reply exactly:
NO_SEARCH`,
      },
      { role: 'user', content: question },
    ],
  });

  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const first = (lines[0] || '').toUpperCase();
  if (first.startsWith('SEARCH')) {
    const query = lines.slice(1).join(' ').trim() || question;
    return { needsSearch: true, searchQuery: query };
  }
  return { needsSearch: false, searchQuery: null };
}

async function generateAnswer(question, searchContext) {
  const { answerModel } = getConfig();
  const userContent = searchContext
    ? `Search results:\n${searchContext}\n\nUser question: ${question}\n\nExtract concrete numbers/facts from the sources above and answer. Prefer citing the source name.`
    : question;

  return chatCompletion({
    model: answerModel,
    max_tokens: 800,
    messages: [
      {
        role: 'system',
        content: `You are a helpful assistant.
- Answer directly and clearly.
- When search results contain numbers (rates, prices, dates), extract and report them; do not claim they are missing if they appear in the text.
- If sources disagree, show 2-3 values and note the source.
- Only say "not found" if the results truly lack the answer.`,
      },
      { role: 'user', content: userContent },
    ],
  });
}

module.exports = { decideSearch, generateAnswer };

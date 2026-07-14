require('dotenv').config();

const express = require('express');
const { ask } = require('./src/services/askService');

const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());

app.use((req, _res, next) => {
  if (req.path === '/health') return next();
  console.log(`\n--> ${req.method} ${req.path} ${new Date().toISOString()}`);
  next();
});

app.get('/', (_req, res) => {
  res.json({ ok: true, endpoints: ['POST /ask'] });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

/**
 * POST /ask
 * body: { "question": "..." }
 * response: { answer, searched, searchQuery }
 */
app.post('/ask', async (req, res) => {
  try {
    const question = req.body?.question ?? req.body?.q ?? req.body?.message;
    console.log('question:', String(question || '').slice(0, 200));
    const result = await ask(question);
    res.json(result);
  } catch (error) {
    const status = error.status || 500;
    console.error('Ask failed:', error.message);
    res.status(status).json({ error: error.message || 'Internal Server Error' });
  }
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  console.log('Try: POST /ask  { "question": "What is the current Fed funds rate?" }');
});

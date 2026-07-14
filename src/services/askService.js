const { decideSearch, generateAnswer } = require('../clients/llmClient');
const { performExaSearch } = require('../clients/exaClient');

async function ask(question) {
  if (!question || typeof question !== 'string' || !question.trim()) {
    const err = new Error('question is required');
    err.status = 400;
    throw err;
  }

  const trimmed = question.trim();
  const started = Date.now();

  console.log(`[1/3] Deciding whether search is needed...`);
  const decision = await decideSearch(trimmed);
  console.log(
    `[1/3] Done needsSearch=${decision.needsSearch}` +
      (decision.searchQuery ? ` query="${decision.searchQuery}"` : '')
  );

  let searchContext = '';
  if (decision.needsSearch) {
    if (!process.env.EXA_API_KEY) {
      const err = new Error('EXA_API_KEY is required when search is needed');
      err.status = 500;
      throw err;
    }
    console.log(`[2/3] Calling Exa search...`);
    searchContext = await performExaSearch(decision.searchQuery);
    console.log(`[2/3] Exa done, context length=${searchContext.length}`);
  } else {
    console.log(`[2/3] Skipping search`);
  }

  console.log(`[3/3] Generating answer...`);
  const answer = await generateAnswer(trimmed, searchContext);
  console.log(`[3/3] Done in ${Date.now() - started}ms, answer length=${answer.length}`);

  return {
    answer,
    searched: decision.needsSearch,
    searchQuery: decision.searchQuery,
  };
}

module.exports = { ask };

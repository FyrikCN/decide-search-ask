const axios = require('axios');

async function performExaSearch(query) {
  console.log('Exa search:', query);
  try {
    const response = await axios({
      method: 'post',
      url: 'https://api.exa.ai/search',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-api-key': process.env.EXA_API_KEY,
      },
      data: {
        query,
        // auto works better than pure neural for factual / FX-style queries
        type: 'auto',
        numResults: 5,
        contents: {
          text: { maxCharacters: 2000 },
        },
      },
      timeout: 30000,
    });

    const results = response.data?.results || [];
    if (!results.length) return '';

    return results
      .map((r, i) => {
        const title = r.title || `Result ${i + 1}`;
        const url = r.url || '';
        const text = (r.text || '').replace(/\s+/g, ' ').trim().slice(0, 1800);
        return `Source ${i + 1}: ${title}\nURL: ${url}\n${text}`;
      })
      .join('\n\n---\n\n');
  } catch (error) {
    console.error('Exa search failed:', error.response?.data || error.message);
    return '';
  }
}

module.exports = { performExaSearch };

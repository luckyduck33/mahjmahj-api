const { Client } = require('@notionhq/client');

let _client = null;

function getNotionClient() {
  if (!_client) {
    _client = new Client({ auth: process.env.NOTION_API_KEY });
  }
  return _client;
}

module.exports = { getNotionClient };

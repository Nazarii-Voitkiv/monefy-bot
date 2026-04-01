import 'dotenv/config';

const botToken = process.env.BOT_TOKEN;
const appBaseUrl = process.env.APP_BASE_URL?.replace(/\/$/, '');

if (!botToken) {
  throw new Error('BOT_TOKEN is required');
}

if (!appBaseUrl) {
  throw new Error('APP_BASE_URL is required');
}

const webhookUrl = `${appBaseUrl}/api/telegram/webhook`;
const endpoint = `https://api.telegram.org/bot${botToken}/setWebhook`;

const response = await fetch(endpoint, {
  body: JSON.stringify({ url: webhookUrl }),
  headers: {
    'Content-Type': 'application/json'
  },
  method: 'POST'
});

const payload = await response.json();
if (!response.ok || !payload.ok) {
  throw new Error(`Failed to set webhook: ${JSON.stringify(payload)}`);
}

console.log(`Webhook set to ${webhookUrl}`);

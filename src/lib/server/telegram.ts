import { env } from '../../config/env';

export async function sendTelegramMessage(
  chatId: string,
  text: string
): Promise<void> {
  const response = await fetch(
    `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`,
    {
      body: JSON.stringify({
        chat_id: chatId,
        text
      }),
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'POST'
    }
  );

  const payload = (await response.json()) as { description?: string; ok?: boolean };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.description ?? 'Failed to send Telegram message');
  }
}

import type { BotMiddleware } from '../context.js';
import { allowedUserIds } from '../../config/env.js';

const allowedIdsSet = new Set(allowedUserIds);

export const authorizeMiddleware: BotMiddleware = async (ctx, next) => {
  if (allowedIdsSet.size === 0) {
    return next();
  }

  const userId = ctx.from?.id?.toString();
  if (userId && allowedIdsSet.has(userId)) {
    return next();
  }

  await ctx.reply('Бот недоступний для цього користувача.');
};

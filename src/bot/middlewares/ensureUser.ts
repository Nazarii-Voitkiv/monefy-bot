import type { BotMiddleware } from '../context.js';
import { ensureDefaultCategories, listCategories } from '../../services/categories.js';
import { ensureUser } from '../../services/users.js';

export const ensureUserMiddleware: BotMiddleware = async (ctx, next) => {
  const tgUserId = ctx.from?.id?.toString();
  if (!tgUserId) {
    await ctx.reply('Не можу визначити користувача.');
    return;
  }

  const user = await ensureUser(tgUserId);
  ctx.state.user = user;

  await ensureDefaultCategories(user.tgUserId);
  ctx.state.categories = await listCategories(user.tgUserId);

  return next();
};

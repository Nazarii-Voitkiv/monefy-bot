import { ensureDefaultCategories, listCategories } from '../../services/categories';
import { ensureUser } from '../../services/users';
import type { BotMiddleware } from '../context';

export const ensureUserMiddleware: BotMiddleware = async (ctx, next) => {
  const tgUserId = ctx.from?.id?.toString();
  if (!tgUserId) {
    await ctx.reply('Не можу визначити користувача.');
    return;
  }

  // Optimized: returns { user, isNew } and uses cache internally
  const { user, isNew } = await ensureUser(tgUserId);
  ctx.state.user = user;

  // Only check default categories if user is newly created
  if (isNew) {
    await ensureDefaultCategories(user.tgUserId);
  }

  // cached call
  ctx.state.categories = await listCategories(user.tgUserId);

  return next();
};

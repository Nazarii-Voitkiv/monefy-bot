import type { Telegraf } from 'telegraf';

import type { BotContext } from '../context.js';
import {
  addCategory,
  listCategories,
  removeCategory
} from '../../services/categories.js';
import type { CategoryKind } from '../../types/index.js';

function parseKind(kind?: string): CategoryKind | null {
  if (!kind) {
    return null;
  }

  const normalized = kind.toLowerCase();
  if (normalized === 'income' || normalized === 'expense') {
    return normalized;
  }

  return null;
}

export function registerCategoryCommands(bot: Telegraf<BotContext>): void {
  bot.command('cat', async (ctx) => {
    const user = ctx.state.user;
    if (!user) {
      await ctx.reply('Користувач не знайдений.');
      return;
    }

    const args = ctx.message?.text?.split(' ').slice(1) ?? [];
    const action = args.shift();

    if (!action || action === 'list') {
      const categoriesList = await listCategories(user.tgUserId);
      if (categoriesList.length === 0) {
        await ctx.reply('Категорій поки немає. Додай через `/cat add food expense`.', {
          parse_mode: 'Markdown'
        });
        return;
      }

      const lines = ['Категорії:'];
      categoriesList.forEach((category) => {
        lines.push(`• ${category.name} (${category.kind})`);
      });
      await ctx.reply(lines.join('\n'));
      return;
    }

    if (action === 'add') {
      const [name, kindRaw] = args;
      const kind = parseKind(kindRaw);
      if (!name || !kind) {
        await ctx.reply('Використання: /cat add coffee expense|income');
        return;
      }

      await addCategory(user.tgUserId, name, kind);
      await ctx.reply(`Категорія ${name} (${kind}) додана.`);
      return;
    }

    if (action === 'rm' || action === 'remove' || action === 'del') {
      const [name] = args;
      if (!name) {
        await ctx.reply('Використання: /cat rm coffee');
        return;
      }
      const removed = await removeCategory(user.tgUserId, name.toLowerCase());
      if (removed === 0) {
        await ctx.reply(`Категорія ${name} не знайдена.`);
      } else {
        await ctx.reply(`Категорію ${name} видалено.`);
      }
      return;
    }

    await ctx.reply('Невідома команда. Використай /cat list, /cat add, /cat rm.');
  });
}

import type { Telegraf } from 'telegraf';

import type { BotContext } from '../context.js';
import { registerAddHelp } from './add.js';
import { registerCategoryCommands } from './categories.js';
import { registerRateCommand } from './rate.js';
import { registerStartCommand } from './start.js';
import { registerStatsCommands } from './stats.js';
import { registerTransactionMessages } from './transactions.js';

export function registerBotCommands(bot: Telegraf<BotContext>): void {
  registerStartCommand(bot);
  registerAddHelp(bot);
  registerStatsCommands(bot);
  registerCategoryCommands(bot);
  registerRateCommand(bot);
  registerTransactionMessages(bot);
}

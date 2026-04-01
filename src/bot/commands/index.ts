import type { Telegraf } from 'telegraf';

import type { BotContext } from '../context';
import { registerAddHelp } from './add';
import { registerCategoryCommands } from './categories';
import { registerHistoryCommand } from './history';
import { registerRateCommand } from './rate';
import { registerStartCommand } from './start';
import { registerStatsCommands } from './stats';
import { registerTransactionMessages } from './transactions';

export function registerBotCommands(bot: Telegraf<BotContext>): void {
  registerStartCommand(bot);
  registerAddHelp(bot);
  registerStatsCommands(bot);
  registerCategoryCommands(bot);
  registerRateCommand(bot);
  registerHistoryCommand(bot);
  registerTransactionMessages(bot);
}

import type { Context, MiddlewareFn } from 'telegraf';

import type { CategoryRecord } from '../services/categories.js';
import type { UserRecord } from '../services/users.js';

export interface BotState {
  user?: UserRecord;
  categories?: CategoryRecord[];
}

export type BotContext = Context & {
  state: BotState;
};

export type BotMiddleware = MiddlewareFn<BotContext>;

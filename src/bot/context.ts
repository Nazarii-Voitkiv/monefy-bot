import type { Context, MiddlewareFn } from 'telegraf';

import type { CategoryRecord } from '../services/categories';
import type { UserRecord } from '../services/users';

export interface BotState {
  user?: UserRecord;
  categories?: CategoryRecord[];
}

export type BotContext = Context & {
  state: BotState;
};

export type BotMiddleware = MiddlewareFn<BotContext>;

import { format } from 'date-fns';
import { Markup } from 'telegraf';

import { supabase } from '../../db/client';
import { listCategories } from '../../services/categories';
import { fxProvider } from '../../services/fxProvider';
import { deleteTransaction, getTransactions, updateTransaction } from '../../services/transactions';
import type { BotContext } from '../context';
import { userState, UserStateType } from '../state';

const PAGE_SIZE = 10;

export function registerHistoryCommand(bot: import('telegraf').Telegraf<BotContext>): void {
    bot.command('history', async (ctx) => {
        await sendHistoryPage(ctx, 1);
    });

    bot.action(/history:(\d+)/, async (ctx) => {
        const page = parseInt(ctx.match[1], 10);
        await sendHistoryPage(ctx, page, true);
    });

    bot.action(/txn_view:(\d+)/, async (ctx) => {
        const id = parseInt(ctx.match[1], 10);
        await sendTransactionDetails(ctx, id);
    });

    bot.action('txn_list_back', async (ctx) => {
        await sendHistoryPage(ctx, 1, true);
    });

    bot.action(/txn_del_ask:(\d+)/, async (ctx) => {
        const id = parseInt(ctx.match[1], 10);
        await ctx.editMessageText(
            'Ви дійсно хочете видалити цю транзакцію?',
            Markup.inlineKeyboard([
                [Markup.button.callback('Так, видалити', `txn_del_yes:${id} `)],
                [Markup.button.callback('Ні, назад', `txn_view:${id} `)]
            ])
        );
    });

    bot.action(/txn_del_yes:(\d+)/, async (ctx) => {
        const id = parseInt(ctx.match[1], 10);
        const user = ctx.state.user!;
        try {
            await deleteTransaction(id, user.tgUserId);
            await ctx.answerCbQuery('Транзакцію видалено');
            await sendHistoryPage(ctx, 1, true);
        } catch (error) {
            await ctx.answerCbQuery(`Помилка: ${(error as Error).message} `);
        }
    });

    bot.action(/txn_edit_amt:(\d+)/, async (ctx) => {
        const id = parseInt(ctx.match[1], 10);
        const user = ctx.state.user!;
        userState.set(user.tgUserId, { type: 'EDIT_TXN_AMOUNT', txnId: id });
        await ctx.reply('Введіть нову суму (число):', Markup.forceReply());
        await ctx.answerCbQuery();
    });

    bot.action(/txn_edit_note:(\d+)/, async (ctx) => {
        const id = parseInt(ctx.match[1], 10);
        const user = ctx.state.user!;
        userState.set(user.tgUserId, { type: 'EDIT_TXN_NOTE', txnId: id });
        await ctx.reply('Введіть нову нотатку:', Markup.forceReply());
        await ctx.answerCbQuery();
    });

    // --- Category Editing ---
    bot.action(/txn_edit_cat:(\d+)/, async (ctx) => {
        const id = parseInt(ctx.match[1], 10);
        await sendCategorySelection(ctx, id);
    });

    bot.action(/txn_set_cat:(\d+):(\d+)/, async (ctx) => {
        const id = parseInt(ctx.match[1], 10);
        const catId = parseInt(ctx.match[2], 10);
        const user = ctx.state.user!;
        try {
            await updateTransaction(id, user.tgUserId, { categoryId: catId }, fxProvider);
            await ctx.answerCbQuery('Категорію оновлено');
            await sendTransactionDetails(ctx, id);
        } catch (error) {
            await ctx.answerCbQuery(`Помилка: ${(error as Error).message}`);
        }
    });

    // --- Currency Editing ---
    bot.action(/txn_edit_curr:(\d+)/, async (ctx) => {
        const id = parseInt(ctx.match[1], 10);
        await ctx.editMessageText(
            'Оберіть нову валюту:',
            Markup.inlineKeyboard([
                [
                    Markup.button.callback('USD', `txn_set_curr:${id}:USD`),
                    Markup.button.callback('UAH', `txn_set_curr:${id}:UAH`),
                    Markup.button.callback('PLN', `txn_set_curr:${id}:PLN`)
                ],
                [Markup.button.callback('« Назад', `txn_view:${id}`)]
            ])
        );
    });

    bot.action(/txn_set_curr:(\d+):(\w+)/, async (ctx) => {
        const id = parseInt(ctx.match[1], 10);
        const currency = ctx.match[2] as 'USD' | 'UAH' | 'PLN';
        const user = ctx.state.user!;
        try {
            await updateTransaction(id, user.tgUserId, { currency }, fxProvider);
            await ctx.answerCbQuery('Валюту оновлено');
            await sendTransactionDetails(ctx, id);
        } catch (error) {
            await ctx.answerCbQuery(`Помилка: ${(error as Error).message}`);
        }
    });
}

async function sendHistoryPage(ctx: BotContext, page: number, isEdit = false) {
    const user = ctx.state.user!;
    try {
        const { data: globalTxns, total } = await getTransactions(user.tgUserId, page, PAGE_SIZE);
        const categories = await listCategories(user.tgUserId);
        const catMap = new Map(categories.map((c) => [c.id, c.name]));

        if (globalTxns.length === 0 && page === 1) {
            const msg = 'Список транзакцій порожній.';
            if (isEdit) await ctx.editMessageText(msg);
            else await ctx.reply(msg);
            return;
        }

        const buttons = globalTxns.map((t) => {
            const catName = catMap.get(t.categoryId) || '???';
            const icon = t.sign === 1 ? '🟢' : '🔴';
            const date = format(t.txnAt, 'dd.MM');
            const label = `${icon} ${date} | ${catName} | ${t.amount} ${t.currency} `;
            return [Markup.button.callback(label, `txn_view:${t.id} `)];
        });

        // Pagination buttons
        const navButtons = [];
        if (page > 1) {
            navButtons.push(Markup.button.callback('« Назад', `history:${page - 1} `));
        }
        const maxPage = Math.ceil(total / PAGE_SIZE);
        if (page < maxPage) {
            navButtons.push(Markup.button.callback('Далі »', `history:${page + 1} `));
        }
        if (navButtons.length > 0) buttons.push(navButtons);

        const text = `Історія транзакцій(стор.${page} / ${maxPage || 1}): `;
        if (isEdit) {
            await ctx.editMessageText(text, Markup.inlineKeyboard(buttons));
        } else {
            await ctx.reply(text, Markup.inlineKeyboard(buttons));
        }
    } catch (error) {
        console.error(error);
        await ctx.reply('Помилка завантаження історії.');
    }
}

async function sendTransactionDetails(ctx: BotContext, id: number) {
    const user = ctx.state.user!;
    try {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('id', id)
            .eq('tg_user_id', user.tgUserId)
            .single();

        if (error || !data) {
            await ctx.answerCbQuery('Транзакцію не знайдено.');
            return;
        }

        const t = {
            ...data,
            txnAt: new Date(data.txn_at),
            amount: Number(data.amount),
            amountUsd: Number(data.amount_usd),
            category_id: data.category_id
        };

        const categories = await listCategories(user.tgUserId);
        const catName = categories.find(c => c.id === t.category_id)?.name || 'Невідомо';

        const text = [
            `🆔 ID: ${t.id} `,
            `📅 Дата: ${format(t.txnAt, 'dd.MM.yyyy HH:mm')} `,
            `📂 Категорія: ${catName} `,
            `💰 Сума: ${t.amount} ${t.currency} `,
            `💵 USD екв.: ${t.amount_usd} $`,
            t.note ? `📝 Нотатка: ${t.note} ` : null
        ].filter(Boolean).join('\n');

        await ctx.editMessageText(
            text,
            Markup.inlineKeyboard([
                [
                    Markup.button.callback('✏️ Суму', `txn_edit_amt:${id}`),
                    Markup.button.callback('✏️ Валюту', `txn_edit_curr:${id}`),
                ],
                [
                    Markup.button.callback('✏️ Категорію', `txn_edit_cat:${id}`),
                    Markup.button.callback('✏️ Нотатку', `txn_edit_note:${id}`)
                ],
                [Markup.button.callback('🗑 Видалити', `txn_del_ask:${id}`)],
                [Markup.button.callback('« Назад до списку', 'txn_list_back')]
            ])
        );
    } catch (e) {
        console.error(e);
        await ctx.answerCbQuery('Помилка..');
    }
}

export async function handleTransactionEdit(ctx: BotContext, state: UserStateType, text: string) {
    if (state.type === 'IDLE') return;

    if (state.type === 'EDIT_TXN_AMOUNT') {
        const amount = parseFloat(text);
        if (isNaN(amount)) {
            await ctx.reply('Будь ласка, введіть коректне число.');
            return;
        }

        try {
            await updateTransaction(state.txnId, ctx.state.user!.tgUserId, { amount }, fxProvider);
            await ctx.reply(`✅ Суму оновлено: ${amount}`);
        } catch (e) {
            await ctx.reply(`Помилка оновлення: ${(e as Error).message} `);
        }
    } else if (state.type === 'EDIT_TXN_NOTE') {
        try {
            await updateTransaction(state.txnId, ctx.state.user!.tgUserId, { note: text }, fxProvider);
            await ctx.reply(`✅ Нотатку оновлено.`);
        } catch (e) {
            await ctx.reply(`Помилка оновлення: ${(e as Error).message} `);
        }
    }

    userState.delete(ctx.state.user!.tgUserId);
}

async function sendCategorySelection(ctx: BotContext, txnId: number) {
    const user = ctx.state.user!;
    try {
        const { data } = await supabase
            .from('transactions')
            .select('sign')
            .eq('id', txnId)
            .single();

        if (!data) {
            await ctx.answerCbQuery('Транзакція не знайдена');
            return;
        }

        const sign = data.sign; // 1 or -1
        const kind = sign === 1 ? 'income' : 'expense';

        const allCategories = await listCategories(user.tgUserId);
        const filtered = allCategories.filter(c => c.kind === kind);

        // Split into chunks of 2 for better layout
        const buttons = [];
        for (let i = 0; i < filtered.length; i += 2) {
            const row = [];
            row.push(Markup.button.callback(filtered[i].name, `txn_set_cat:${txnId}:${filtered[i].id}`));
            if (filtered[i + 1]) {
                row.push(Markup.button.callback(filtered[i + 1].name, `txn_set_cat:${txnId}:${filtered[i + 1].id}`));
            }
            buttons.push(row);
        }
        buttons.push([Markup.button.callback('« Назад', `txn_view:${txnId}`)]);

        await ctx.editMessageText('Оберіть нову категорію:', Markup.inlineKeyboard(buttons));
    } catch (e) {
        console.error(e);
        await ctx.answerCbQuery('Помилка завантаження категорій');
    }
}

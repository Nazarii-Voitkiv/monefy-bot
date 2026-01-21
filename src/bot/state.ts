export type UserStateType =
    | { type: 'IDLE' }
    | { type: 'EDIT_TXN_AMOUNT'; txnId: number }
    | { type: 'EDIT_TXN_NOTE'; txnId: number };

export const userState = new Map<string, UserStateType>();

// Why: sidebar primaries rotate labels as git/review state changes. Content-width
// reads better than full-bleed; min-width reduces jump between states; max-w-full
// plus a truncating label span caps overflow in long i18n strings.
export const RIGHT_SIDEBAR_SPLIT_ACTION_ROW_CLASS = 'inline-flex max-w-full items-stretch'

export const RIGHT_SIDEBAR_MORPHING_PRIMARY_BUTTON_CLASS = 'min-w-[10.5rem] max-w-full'

// Covers "Squash and merge" and "Disable auto-merge".
export const RIGHT_SIDEBAR_MERGE_PRIMARY_BUTTON_CLASS = 'min-w-[11.5rem] max-w-full'

export const RIGHT_SIDEBAR_PRIMARY_BUTTON_LABEL_CLASS = 'min-w-0 truncate'

// PR full-page and item-dialog asides share the same merge/state labels.
export const REVIEW_ACTION_MERGE_BUTTON_CLASS = RIGHT_SIDEBAR_MERGE_PRIMARY_BUTTON_CLASS

export const REVIEW_ACTION_STATE_BUTTON_CLASS = 'min-w-[11.5rem] max-w-full'

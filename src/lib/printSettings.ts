// Printed grid card height (cm); the width is fixed by the print layout
export const DEFAULT_CARD_HEIGHT = 6.33;
export const MIN_CARD_HEIGHT = 4;
export const MAX_CARD_HEIGHT = 12;
export const CARD_HEIGHT_KEY = 'print_card_height';

// The last height used, so a wristband size only has to be set once
export const loadCardHeight = () => {
    try {
        const stored = Number(localStorage.getItem(CARD_HEIGHT_KEY));
        return stored >= MIN_CARD_HEIGHT && stored <= MAX_CARD_HEIGHT ? stored : DEFAULT_CARD_HEIGHT;
    } catch {
        return DEFAULT_CARD_HEIGHT;
    }
};

export const clampHeight = (value: number) =>
    Number.isFinite(value) ? Math.min(MAX_CARD_HEIGHT, Math.max(MIN_CARD_HEIGHT, value)) : DEFAULT_CARD_HEIGHT;

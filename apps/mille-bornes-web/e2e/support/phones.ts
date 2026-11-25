import type { BrowserContextOptions } from "@playwright/test";


/** A portrait phone with a touch screen. */
export const phone: BrowserContextOptions = {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
};


/** The smallest phone the app supports. */
export const smallPhone: BrowserContextOptions = {
    ...phone,
    viewport: { width: 320, height: 568 }
};

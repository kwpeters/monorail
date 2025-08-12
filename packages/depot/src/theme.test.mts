type FormatterFn = (...text: unknown[]) => string;

export const nopFormatter: FormatterFn = (...text: unknown[]) => text.join(" ");

export type Theme = Record<string, FormatterFn>;

export type ThemeWith<TKeys extends string | number | symbol> = Record<TKeys, FormatterFn>;


/**
 * Creates a theme object where all formatter functions are replaced with nop
 * formatters.
 *
 * @param theme - The original theme object
 * @return A new theme object with the same properties as `theme` but with nop
 * formatters
 */
export function createNopTheme<TTheme extends Record<string, FormatterFn>>(
    theme: TTheme
): ThemeWith<keyof TTheme> {
    return Object.keys(theme).reduce(
        (acc, key) => {
            acc[key as keyof TTheme] = nopFormatter;
            return acc;
        },
        {} as ThemeWith<keyof TTheme>
    );
}

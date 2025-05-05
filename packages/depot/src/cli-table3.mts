import type { TableConstructorOptions } from "cli-table3";


export const optionsNoLines: TableConstructorOptions = {
    chars: {
        // eslint-disable-next-line object-property-newline, @typescript-eslint/naming-convention
        "top":          "", "top-mid":      "", "top-left":     "", "top-right":    "",
        // eslint-disable-next-line object-property-newline, @typescript-eslint/naming-convention
        "bottom":       "", "bottom-mid":   "", "bottom-left":  "", "bottom-right": "",
        // eslint-disable-next-line object-property-newline, @typescript-eslint/naming-convention
        "left":         "", "left-mid":     "", "mid":          "", "mid-mid":      "",
        // eslint-disable-next-line object-property-newline, @typescript-eslint/naming-convention
        "right":        "", "right-mid":    "", "middle":       "  "
    },
    // eslint-disable-next-line @typescript-eslint/naming-convention
    style: { "padding-left": 0, "padding-right": 0 }
};

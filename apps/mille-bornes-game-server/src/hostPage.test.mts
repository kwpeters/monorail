import { type AdminEntry } from "./hub.mjs";
import { escapeHtml, renderHostPage } from "./hostPage.mjs";


function entry(over: Record<string, unknown> = {}): AdminEntry {
    return {
        id:            "g-1",
        state:         "Running",
        organizerName: "Ann",
        seatNames:     ["Ann", "Bob"],
        phase:         "AwaitingPlay",
        ...over
    } as unknown as AdminEntry;
}


describe("hostPage", () => {

    describe("escapeHtml()", () => {

        it("escapes markup and quote characters", () => {
            expect(escapeHtml(`<script>alert(1)</script>`))
            .toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
            expect(escapeHtml(`a"b'c&d`)).toBe("a&quot;b&#39;c&amp;d");
        });


        it("leaves plain text alone", () => {
            expect(escapeHtml("Ann Lee")).toBe("Ann Lee");
        });

    });


    describe("renderHostPage()", () => {

        it("shows every URL and every QR code", () => {
            const html = renderHostPage({
                urls:  ["http://192.168.1.5:3000/", "http://10.0.0.2:3000/"],
                qrSvg: ["<svg id=\"one\"></svg>", "<svg id=\"two\"></svg>"],
                games: []
            });
            expect(html).toContain("http://192.168.1.5:3000/");
            expect(html).toContain("http://10.0.0.2:3000/");
            expect(html).toContain("<svg id=\"one\">");
            expect(html).toContain("<svg id=\"two\">");
        });


        it("makes only the first QR code large", () => {
            const html = renderHostPage({
                urls:  ["http://192.168.1.5:3000/", "http://10.0.0.2:3000/"],
                qrSvg: ["<svg id=\"one\"></svg>", "<svg id=\"two\"></svg>"],
                games: []
            });
            expect(html).toContain("<div class=\"qr qr-large\"><svg id=\"one\">");
            expect(html).toContain("<div class=\"qr\"><svg id=\"two\">");
            expect(html).toMatch(/\.qr-large svg \{[^}]*width: 320px/u);
        });


        it("lists each game with an End game form", () => {
            const html = renderHostPage({ urls: [], qrSvg: [], games: [entry()] });
            expect(html).toContain("Ann, Bob");
            expect(html).toContain("Running");
            expect(html).toContain("<form method=\"post\" action=\"/host/end/g-1\">");
            expect(html).toContain("End game");
        });


        it("says so when there are no games", () => {
            expect(renderHostPage({ urls: [], qrSvg: [], games: [] })).toContain("No games");
        });


        it("escapes player names (never a raw tag)", () => {
            const name = "<script>alert(1)</script>";
            const html = renderHostPage({
                urls: [], qrSvg: [], games: [entry({ organizerName: name, seatNames: [name] })]
            });
            expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
            expect(html).not.toContain("<script");
        });


        it("escapes a quote in an attribute context", () => {
            const html = renderHostPage({
                urls:  ["http://x/\"><b>"],
                qrSvg: [],
                games: [entry({ id: "g\"><b>" })]
            });
            expect(html).not.toContain("\"><b>");
            expect(html).toContain("g&quot;&gt;&lt;b&gt;");
        });

    });

});

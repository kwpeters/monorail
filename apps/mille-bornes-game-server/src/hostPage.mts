import { type AdminEntry } from "./hub.mjs";


/**
 * Escapes text for use in HTML content or in a quoted attribute.
 * @param text - The raw text
 * @returns The text with `&`, `<`, `>`, `"` and `'` replaced by entities
 */
export function escapeHtml(text: string): string {
    return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}


const css = `
body { font-family: sans-serif; margin: 1.5rem; }
.qr svg { width: 120px; height: 120px; }
.qr:first-child svg { width: 320px; height: 320px; }
table { border-collapse: collapse; }
th, td { border: 1px solid #999; padding: 0.3rem 0.6rem; text-align: left; }
`;


function gameRow(game: AdminEntry): string {
    const id = escapeHtml(game.id);
    return `<tr><td>${escapeHtml(game.state)}</td><td>${escapeHtml(game.phase)}</td>` +
        `<td>${escapeHtml(game.organizerName)}</td>` +
        `<td>${escapeHtml(game.seatNames.join(", "))}</td>` +
        `<td><form method="post" action="/host/end/${id}">` +
        `<button type="submit">End game</button></form></td></tr>`;
}


/**
 * Renders the host page: how to reach the server, and every game with a button
 * to end it.  The page is self-contained (no external assets), and all text
 * that came from a player or a URL is escaped.  The QR codes are trusted SVG.
 * @param info - The URLs, one QR code SVG per URL, and the games
 * @returns The HTML document
 */
export function renderHostPage(info: {
    urls:  ReadonlyArray<string>;
    qrSvg: ReadonlyArray<string>;
    games: ReadonlyArray<AdminEntry>;
}): string {
    const links = info.urls.map((u) => `<li>${escapeHtml(u)}</li>`).join("");
    const qrs = info.qrSvg.map((svg) => `<div class="qr">${svg}</div>`).join("");
    const games = info.games.length === 0 ?
        "<p>No games.</p>" :
        `<table><tr><th>State</th><th>Phase</th><th>Organizer</th><th>Players</th><th></th></tr>` +
        `${info.games.map(gameRow).join("")}</table>`;
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Mille Bornes host</title>
<style>${css}</style></head><body>
<h1>Mille Bornes</h1>
<p>Players on this network open:</p>
<ul>${links}</ul>
${qrs}
<h2>Games</h2>
${games}
</body></html>
`;
}

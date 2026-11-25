/**
 * Tells whether an IPv4 address is in a private range (10.0.0.0/8,
 * 172.16.0.0/12 or 192.168.0.0/16).  Link-local, loopback and public
 * addresses are not private.
 * @param addr - The address, in dotted-decimal form
 * @returns True for a private address; false for anything else, including text
 * that is not an IPv4 address
 */
export function isPrivateIpv4(addr: string): boolean {
    const parts = addr.split(".");
    if (parts.length !== 4 || !parts.every((p) => /^\d{1,3}$/u.test(p))) {
        return false;
    }
    const octets = parts.map(Number);
    if (octets.some((o) => o > 255)) {
        return false;
    }
    const [a, b] = octets as [number, number];
    return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}


// Home routers use 192.168.x.x; virtual adapters (WSL, Docker, VPNs) favour
// 172.16-31.x.x and 10.x.x.x, so the likeliest real one comes first.
function rank(ip: string): number {
    return ip.startsWith("192.168.") ? 0 : ip.startsWith("10.") ? 1 : 2;
}


/**
 * Makes the URLs a phone on the local network can use.
 * @param addresses - Network interface names mapped to their IPv4 addresses
 * @param port - The port the server listens on
 * @returns `http://<ip>:<port>/` for each private address: 192.168.x.x
 * first, then 10.x.x.x, then 172.16-31.x.x, each group by interface name
 */
export function lanUrls(addresses: Map<string, string>, port: number): ReadonlyArray<string> {
    return [...addresses]
    .filter(([, ip]) => isPrivateIpv4(ip))
    .sort(([nameA, a], [nameB, b]) => rank(a) - rank(b) || nameA.localeCompare(nameB))
    .map(([, ip]) => `http://${ip}:${port.toString()}/`);
}

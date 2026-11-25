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


/**
 * Makes the URLs a phone on the local network can use.
 * @param addresses - Network interface names mapped to their IPv4 addresses
 * @param port - The port the server listens on
 * @returns `http://<ip>:<port>/` for each private address
 */
export function lanUrls(addresses: Map<string, string>, port: number): ReadonlyArray<string> {
    return [...addresses.values()]
    .filter(isPrivateIpv4)
    .map((ip) => `http://${ip}:${port.toString()}/`);
}

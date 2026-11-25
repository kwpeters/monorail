import { useEffect, useState, type ReactElement } from "react";
import type { ConnectionStatus } from "../state/screenStore.mjs";


/** How long reconnecting may last before the banner says the link is lost. */
export const lostAfterMs = 10_000;


/** What `ConnectionBanner` needs. */
export interface ConnectionBannerProps {
    status: ConnectionStatus;
}


/**
 * A small banner that shows while the connection is being re-established,
 * and a stronger message once that has taken 10 seconds.
 * @param props - The connection status
 * @returns The banner, or nothing while connecting or live
 */
export function ConnectionBanner(props: ConnectionBannerProps): ReactElement | null {
    const reconnecting = props.status === "Reconnecting";
    const [lost, setLost] = useState(false);

    useEffect(() => {
        if (!reconnecting) {
            return undefined;
        }
        const timer = window.setTimeout(() => setLost(true), lostAfterMs);
        return () => {
            window.clearTimeout(timer);
            setLost(false);
        };
    }, [reconnecting]);

    if (!reconnecting) {
        return null;
    }
    return (
        <p className="banner">{lost ? "Lost connection, trying again" : "Reconnecting..."}</p>
    );
}

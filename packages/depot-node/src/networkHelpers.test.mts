import * as net from "node:net";
import * as _ from "lodash-es";
import { getExternalIpv4Addresses, isTcpPortAvailable, getAvailableTcpPort,
         selectAvailableTcpPort} from "./networkHelpers.mjs";


interface IServerInfo {
    server: net.Server;
    port:   number;
}

// A helper function to start a server.
function startServerAtFirstAvailablePort(): Promise<IServerInfo> {
    return new Promise<IServerInfo>((resolve, reject) => {
        const server = net.createServer();
        server.unref();    // So the server will not prevent the process from exiting
        server.on("error", reject);
        server.listen({port: 0}, () => {
            const address = server.address();

            if (!address ||
                typeof address === "string") {
                reject(new Error(`Server is listening but has invalid address ${address || "null"}.`));
            }
            else {
                resolve({server, port: address.port});
            }
        });
    });
}

// A helper function to shutdown a running server.
function shutdownServer(server: net.Server): Promise<void> {
    return new Promise((resolve) => {
        server.close(() => {
            resolve();
        });
    });
}


describe("getExternalIpv4Addresses()", () => {

    it("will return an object with at least one string key", () => {
        const networkAddresses = getExternalIpv4Addresses();
        const firstIpAddr = _.values(networkAddresses)[0];
        expect(_.isString(firstIpAddr)).toEqual(true);
    });


});


describe("isTcpPortAvailable()", () => {

    it("resolves to true when the port is available", async () => {
        expect(await isTcpPortAvailable(33279)).toEqual(true);
    });


    it("resolves to false when the port is not available", (done) => {
        const port = 33279;
        const server = net.createServer();
        server.unref();
        server.listen({port}, () => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            isTcpPortAvailable(port)
            .then((portIsAvailable) => {
                expect(portIsAvailable).toEqual(false);
                server.close(() => {
                    done();
                });
            });
        });
    });


});


describe("getAvailableTcpPort()", () => {

    it("resolves with an available port number", async () => {
        const port = await getAvailableTcpPort();
        expect(port).toBeGreaterThan(0);
        const isAvailable = await isTcpPortAvailable(port);
        expect(isAvailable).toEqual(true);
    });


});


describe("selectAvailableTcpPort()", () => {

    it("will select a preferred port when it is not in use", async () => {
        const serverInfo1 = await startServerAtFirstAvailablePort();

        // Start a second server to see what port it gets and then shut it down.
        // When selecting a port, we will list it as a preferred port and will
        // expect to get it.
        const serverInfo2 = await startServerAtFirstAvailablePort();
        await shutdownServer(serverInfo2.server);

        const selectedPort = await selectAvailableTcpPort(
            serverInfo1.port,    // should not get this one - still in use
            serverInfo2.port     // should get this one
        );

        expect(selectedPort).toBeGreaterThan(0);
        expect(selectedPort).not.toEqual(serverInfo1.port);
        expect(selectedPort).toEqual(serverInfo2.port);

        await shutdownServer(serverInfo1.server);
    });


    it("will return the first available port when all preferred ports are in use", async () => {
        const serverInfo1 = await startServerAtFirstAvailablePort();
        const serverInfo2 = await startServerAtFirstAvailablePort();

        const selectedPort = await selectAvailableTcpPort(serverInfo1.port, serverInfo2.port);

        expect(selectedPort).toBeGreaterThan(0);
        expect(selectedPort).not.toEqual(serverInfo1.port);
        expect(selectedPort).not.toEqual(serverInfo2.port);

        await Promise.all([
            shutdownServer(serverInfo1.server),
            shutdownServer(serverInfo2.server)
        ]);
    });


});

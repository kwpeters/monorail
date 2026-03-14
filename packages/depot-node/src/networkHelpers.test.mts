import * as net from "node:net";
import * as http from "node:http";
import * as _ from "lodash-es";
import { FailedResult, SucceededResult } from "@repo/depot/result";
import { getExternalIpv4Addresses, isTcpPortAvailable, getAvailableTcpPort,
         selectAvailableTcpPort, determinePort, urlIsGettable } from "./networkHelpers.mjs";


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
                reject(new Error(`Server is listening but has invalid address ${address ?? "null"}.`));
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

    it("will return a map with at least one key-value pair", () => {
        const networkAddresses = getExternalIpv4Addresses();
        const firstIpAddr = Array.from(networkAddresses.values())[0];
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


describe("urlIsGettable()", () => {

    it("returns true when the URL is reachable", async () => {
        const serverInfo = await startServerAtFirstAvailablePort();
        await shutdownServer(serverInfo.server);

        const server = http.createServer((_req, res) => {
            res.statusCode = 200;
            res.end("ok");
        });

        await new Promise<void>((resolve, reject) => {
            server.on("error", reject);
            server.listen({port: serverInfo.port}, () => {
                resolve();
            });
        });

        const gettable = await urlIsGettable(`http://127.0.0.1:${serverInfo.port}`);
        expect(gettable).toEqual(true);

        await new Promise<void>((resolve) => {
            server.close(() => {
                resolve();
            });
        });
    });


    it("returns false when the URL is unreachable", async () => {
        const serverInfo = await startServerAtFirstAvailablePort();
        await shutdownServer(serverInfo.server);

        const gettable = await urlIsGettable(`http://127.0.0.1:${serverInfo.port}`);
        expect(gettable).toEqual(false);
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


describe("determinePort()", () => {

    it("returns succeeded result with required port when it is available", async () => {
        const serverInfo = await startServerAtFirstAvailablePort();
        await shutdownServer(serverInfo.server);

        const result = await determinePort({requiredPort: serverInfo.port});

        expect(result).toEqual(new SucceededResult(serverInfo.port));
    });


    it("returns failed result when required port is not available", async () => {
        const serverInfo = await startServerAtFirstAvailablePort();

        const result = await determinePort({requiredPort: serverInfo.port});

        expect(result).toEqual(new FailedResult(`Required port ${serverInfo.port} is not available.`));

        await shutdownServer(serverInfo.server);
    });


    it("returns succeeded result with preferred port when it is available", async () => {
        const serverInfo = await startServerAtFirstAvailablePort();
        await shutdownServer(serverInfo.server);

        const result = await determinePort({preferredPort: serverInfo.port});

        expect(result).toEqual(new SucceededResult(serverInfo.port));
    });


});

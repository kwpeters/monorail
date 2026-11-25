import { isPrivateIpv4, lanUrls } from "./network.mjs";


describe("network", () => {

    describe("isPrivateIpv4()", () => {

        it("is true for the three private ranges", () => {
            for (const addr of ["192.168.1.5", "10.0.0.2", "172.16.0.1", "172.31.255.1"]) {
                expect(isPrivateIpv4(addr)).withContext(addr).toBeTrue();
            }
        });


        it("is false for other addresses and for garbage", () => {
            const others = [
                "172.32.0.1", "172.15.0.1", "169.254.1.1", "8.8.8.8", "127.0.0.1",
                "192.169.0.1", "10.0.0.256", "10.0.0", "10.0.0.1.1", "", "banana", "::1"
            ];
            for (const addr of others) {
                expect(isPrivateIpv4(addr)).withContext(addr).toBeFalse();
            }
        });

    });


    describe("lanUrls()", () => {

        it("keeps only private addresses and formats the port", () => {
            const addresses = new Map([
                ["Wi-Fi", "192.168.1.5"],
                ["VPN", "8.8.8.8"],
                ["Ethernet", "10.0.0.2"],
                ["Auto", "169.254.1.1"]
            ]);
            expect(lanUrls(addresses, 3000)).toEqual([
                "http://192.168.1.5:3000/",
                "http://10.0.0.2:3000/"
            ]);
        });


        it("lists 192.168 first, then 10, then 172.16-31, each by interface name", () => {
            const addresses = new Map([
                ["vEthernet (WSL)", "172.20.0.1"],
                ["VirtualBox", "10.0.2.2"],
                ["Wi-Fi", "192.168.1.5"],
                ["Ethernet", "10.0.0.2"],
                ["Docker", "172.17.0.1"],
                ["Bridge", "192.168.56.1"]
            ]);
            expect(lanUrls(addresses, 80)).toEqual([
                "http://192.168.56.1:80/",
                "http://192.168.1.5:80/",
                "http://10.0.0.2:80/",
                "http://10.0.2.2:80/",
                "http://172.17.0.1:80/",
                "http://172.20.0.1:80/"
            ]);
        });


        it("is empty when there are no private addresses", () => {
            expect(lanUrls(new Map(), 3000)).toEqual([]);
        });

    });

});

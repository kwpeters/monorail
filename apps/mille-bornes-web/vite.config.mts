import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";


export default defineConfig({
    plugins: [react()],
    server:  {
        proxy: {
            // The game server serves the tRPC API, including its SSE streams.
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "/trpc": {
                target:       "http://localhost:3000",
                changeOrigin: true,
                ws:           false
            }
        }
    },
    build: {
        outDir: "dist"
    },
    test: {
        environment: "jsdom",
        setupFiles:  ["./src/testSetup.mts"],
        include:     ["src/**/*.test.{ts,mts,tsx}"]
    }
});

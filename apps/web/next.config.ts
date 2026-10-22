import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
  transpilePackages: ["@lobby/core", "@lobby/db", "@lobby/ai", "@lobby/connectors", "@lobby/config"],
  serverExternalPackages: ["pg-boss"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  poweredByHeader: false,
  typedRoutes: false,
  experimental: { authInterrupts: true },
  devIndicators: false,
};

export default config;

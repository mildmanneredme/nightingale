import pino from "pino";
import { config } from "./config";

export const logger = pino({
  level: config.env === "production" ? "info" : "debug",
  ...(config.env === "development" && {
    transport: { target: "pino-pretty" },
  }),
});

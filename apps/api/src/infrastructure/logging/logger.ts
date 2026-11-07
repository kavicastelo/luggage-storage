import { pino } from "pino";
import { env } from "../../config/env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  formatters: {
    level: (label: string) => ({ level: label })
  },
  timestamp: pino.stdTimeFunctions.isoTime
});


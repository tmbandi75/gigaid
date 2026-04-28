import { logger } from "../lib/logger";

export interface JsonColumnContext {
  endpoint: string;
  rowId: unknown;
  column: string;
}

export function safeParseJsonColumn(
  raw: unknown,
  ctx: JsonColumnContext,
): unknown {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch (err) {
    logger.warn(
      `[Admin JSON] ${ctx.endpoint}: failed to JSON.parse ${ctx.column} for row ${String(ctx.rowId)}; returning null`,
      err,
    );
    return null;
  }
}

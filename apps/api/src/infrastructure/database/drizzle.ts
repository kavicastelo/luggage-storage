import { drizzle } from "drizzle-orm/node-postgres";
import { dbPool } from "./connection.js";
import * as schema from "./schema/index.js";

export const db = drizzle(dbPool, { schema });
export { schema };

import { drizzle } from "drizzle-orm/node-postgres";
import { dbPool } from "./connection.js";

export const db = drizzle(dbPool);

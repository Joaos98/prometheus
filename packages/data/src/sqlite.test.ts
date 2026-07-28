import { runDataStoreContract } from "./contract.js";
import { SqliteStore } from "./sqlite.js";

runDataStoreContract((path) => new SqliteStore(path));

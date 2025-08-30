import { fileURLToPath } from "url";
import path from "path";

/**
 * Returns the __dirname equivalent for ES modules
 */
export const getDirname = (metaUrl) => path.dirname(fileURLToPath(metaUrl));

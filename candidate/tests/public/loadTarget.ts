import path from "node:path";
import { pathToFileURL } from "node:url";

export async function importFromTarget<T = unknown>(modulePath: string): Promise<T> {
  const targetRoot = process.env.EVAL_TARGET ?? path.join(process.cwd(), ".");
  return import(pathToFileURL(path.join(targetRoot, modulePath)).href) as Promise<T>;
}


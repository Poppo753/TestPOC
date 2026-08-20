import { ConfigurationError } from "./errors";

export type CliArguments = Record<string, string | boolean>;

export function parseCliArguments(argv: string[]): CliArguments {
  const result: CliArguments = {};
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new ConfigurationError(`Unexpected positional argument: ${token}`);
    const withoutPrefix = token.slice(2);
    const equalsIndex = withoutPrefix.indexOf("=");
    if (equalsIndex >= 0) {
      const key = withoutPrefix.slice(0, equalsIndex);
      const value = withoutPrefix.slice(equalsIndex + 1);
      if (!key) throw new ConfigurationError("CLI option name cannot be empty");
      result[key] = value;
      continue;
    }
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      result[withoutPrefix] = next;
      index++;
    } else {
      result[withoutPrefix] = true;
    }
  }
  return result;
}

export function cliString(args: CliArguments, key: string, required = true): string | undefined {
  const value = args[key];
  if (typeof value === "string" && value.length > 0) return value;
  if (required) throw new ConfigurationError(`Missing CLI option --${key}`);
  return undefined;
}

export function cliBoolean(args: CliArguments, key: string, fallback = false): boolean {
  const value = args[key];
  if (value === undefined) return fallback;
  if (value === true) return true;
  if (value === false) return false;
  if (/^(true|1|yes)$/i.test(value)) return true;
  if (/^(false|0|no)$/i.test(value)) return false;
  throw new ConfigurationError(`--${key} must be true or false`);
}

export function stringifyForOutput(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => typeof item === "bigint" ? item.toString() : item, 2);
}

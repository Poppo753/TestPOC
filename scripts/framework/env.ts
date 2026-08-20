import { getAddress, isAddress } from "ethers";
import { ConfigurationError } from "./errors";
import type { Address } from "./types";

export type Environment = NodeJS.ProcessEnv;

export function envString(env: Environment, name: string, fallback?: string): string {
  const value = env[name]?.trim() || fallback;
  if (!value) throw new ConfigurationError(`Missing environment variable ${name}`, { name });
  return value;
}

export function envBoolean(env: Environment, name: string, fallback = false): boolean {
  const raw = env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  if (/^(true|1|yes)$/i.test(raw)) return true;
  if (/^(false|0|no)$/i.test(raw)) return false;
  throw new ConfigurationError(`${name} must be true or false`, { value: raw });
}

export function envInteger(env: Environment, name: string, fallback?: number): number {
  const raw = env[name];
  if ((raw === undefined || raw.trim() === "") && fallback !== undefined) return fallback;
  if (!raw || !/^-?\d+$/.test(raw)) throw new ConfigurationError(`${name} must be an integer`, { value: raw });
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) throw new ConfigurationError(`${name} is outside the safe integer range`);
  return value;
}

export function envBigInt(env: Environment, name: string, fallback?: bigint): bigint {
  const raw = env[name];
  if ((raw === undefined || raw.trim() === "") && fallback !== undefined) return fallback;
  if (!raw || !/^\d+$/.test(raw)) throw new ConfigurationError(`${name} must be an unsigned integer`, { value: raw });
  return BigInt(raw);
}

export function envAddress(env: Environment, name: string, fallback?: string): Address {
  const raw = envString(env, name, fallback);
  if (!isAddress(raw)) throw new ConfigurationError(`${name} is not a valid address`, { value: raw });
  return getAddress(raw) as Address;
}

export function envJson<T>(env: Environment, name: string, fallback?: T): T {
  const raw = env[name];
  if ((raw === undefined || raw.trim() === "") && fallback !== undefined) return fallback;
  if (!raw) throw new ConfigurationError(`Missing JSON environment variable ${name}`);
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new ConfigurationError(`${name} contains invalid JSON`, { cause: String(error) });
  }
}


import { FORMAT } from "../config/constants.js";

// ============================================
// FORMATTING UTILITIES
// ============================================

export function formatEth(value, decimals = FORMAT.DECIMALS.ETH) {
  const num = parseFloat(value);
  if (isNaN(num)) return "0";
  return num.toFixed(decimals);
}

export function formatUsd(value, decimals = FORMAT.DECIMALS.USD) {
  const num = parseFloat(value);
  if (isNaN(num)) return "$0.00";
  return `$${num.toLocaleString('en-US', { 
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals 
  })}`;
}

export function formatPercent(value, decimals = FORMAT.DECIMALS.PERCENT) {
  const num = parseFloat(value);
  if (isNaN(num)) return "0%";
  return `${num.toFixed(decimals)}%`;
}

export function formatAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTxHash(hash) {
  if (!hash) return "";
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

// ============================================
// VALIDATION
// ============================================

export function isValidAmount(value) {
  const num = parseFloat(value);
  return !isNaN(num) && num > 0;
}

export function isValidAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Single editorial source for the Interactive Demo.
 *
 * These are deliberately illustrative product profiles. They are not read from
 * a deployment, do not describe funds currently available to users, and must
 * never be imported by the real PoC transaction modules.
 */
export const DEMO_VAULTS = Object.freeze([
  Object.freeze({
    id: 'reserve',
    name: 'USDC Reserve',
    profile: 'Reserve',
    description: 'Prioritizes visible liquidity and a narrow allocation route.',
    apy: 0.032,
    risk: 'Lower',
    riskScore: 2,
    liquidity: 'Same-day target',
    accent: 'cyan',
    allocations: Object.freeze([
      Object.freeze({ name: 'Liquid reserve', percent: 45 }),
      Object.freeze({ name: 'Illustrative lending route', percent: 55 }),
    ]),
    risks: Object.freeze(['Smart-contract risk', 'USDC issuer risk', 'Lending-protocol risk']),
  }),
  Object.freeze({
    id: 'balanced',
    name: 'USDC Balanced',
    profile: 'Balanced',
    description: 'Illustrates a diversified route with a meaningful liquidity buffer.',
    apy: 0.051,
    risk: 'Moderate',
    riskScore: 3,
    liquidity: '1–3 day target',
    accent: 'violet',
    allocations: Object.freeze([
      Object.freeze({ name: 'Liquid reserve', percent: 25 }),
      Object.freeze({ name: 'Illustrative lending route A', percent: 45 }),
      Object.freeze({ name: 'Illustrative lending route B', percent: 30 }),
    ]),
    risks: Object.freeze(['Smart-contract risk', 'USDC issuer risk', 'Multiple protocol dependencies', 'Liquidity delay']),
  }),
  Object.freeze({
    id: 'growth',
    name: 'USDC Growth',
    profile: 'Growth',
    description: 'Shows how a more complex allocation can introduce more uncertainty.',
    apy: 0.078,
    risk: 'Higher',
    riskScore: 4,
    liquidity: '3–7 day target',
    accent: 'amber',
    allocations: Object.freeze([
      Object.freeze({ name: 'Liquid reserve', percent: 10 }),
      Object.freeze({ name: 'Illustrative lending route', percent: 40 }),
      Object.freeze({ name: 'Illustrative liquidity route', percent: 50 }),
    ]),
    risks: Object.freeze(['Smart-contract risk', 'USDC issuer risk', 'Liquidity-pool exposure', 'Withdrawal delay', 'Greater composability risk']),
  }),
]);

export const vaultById = (id) => DEMO_VAULTS.find((vault) => vault.id === id);


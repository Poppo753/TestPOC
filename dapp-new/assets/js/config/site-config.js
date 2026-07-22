/**
 * Cross-page information belongs here. Page-specific editorial copy remains in
 * HTML so it is readable without JavaScript and easy to review in source.
 */
export const SITE = Object.freeze({
  name: 'Jethos',
  positioning: 'Home banking, rebuilt around ownership.',
  navigation: [
    ['home', 'index.html', 'Home'],
    ['how', 'pages/how-it-works.html', 'How it works'],
    ['vaults', 'pages/vaults.html', 'Vaults'],
    ['risk', 'pages/risk-transparency.html', 'Risk'],
    ['trust', 'pages/trust-center.html', 'Trust'],
    ['roadmap', 'pages/roadmap.html', 'Roadmap'],
    ['docs', 'pages/docs.html', 'Docs'],
  ],
  footer: [
    ['Product', [['How it works', 'pages/how-it-works.html'], ['Vaults', 'pages/vaults.html'], ['Risk & transparency', 'pages/risk-transparency.html'], ['PoC console', 'app.html']]],
    ['Evidence', [['Trust Center', 'pages/trust-center.html'], ['Security', 'pages/security.html'], ['Protocol', 'pages/protocol.html'], ['Developers', 'pages/developers.html']]],
    ['Direction', [['Vision', 'pages/vision.html'], ['Roadmap', 'pages/roadmap.html'], ['FAQ', 'pages/faq.html'], ['Documentation', 'pages/docs.html']]],
  ],
  disclaimer: 'Private proof of concept. Jethos is not a bank, is not audited as a complete system, and does not guarantee returns, principal or immediate liquidity.',
});

export const STATUS_TAXONOMY = Object.freeze({
  live: 'Read from chain with a timestamp',
  recorded: 'Taken from a versioned deployment or content record',
  implemented: 'Present in the repository; not necessarily a public product',
  poc: 'Private deployment used for controlled validation',
  planned: 'Intended direction; not yet implemented',
  vision: 'Long-term possibility',
  illustrative: 'Explanatory example; not live account data',
});


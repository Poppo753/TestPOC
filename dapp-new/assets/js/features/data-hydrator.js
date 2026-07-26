/**
 * Same-origin JSON enhancement. Editorial HTML remains the visible fallback;
 * this module only refreshes small facts that benefit from structured sources.
 */
export async function fetchLocalJson(path, { timeout = 5000 } = {}) {
  const url = new URL(path, document.baseURI);
  if (url.origin !== location.origin) throw new Error('Only same-origin content data is allowed.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: 'same-origin' });
    if (!response.ok) throw new Error(`Content request failed with HTTP ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}

export async function hydrateStructuredFacts() {
  const root = document.documentElement.dataset.root || '.';
  const tasks = [];
  const protocolCount = document.querySelector('[data-protocol-record-count]');
  if (protocolCount) tasks.push(fetchLocalJson(`${root}/data/protocol/protocols.json`).then((data) => { protocolCount.textContent = String(data.protocols?.length ?? 'Unavailable'); }));
  const roadmapUpdated = document.querySelector('[data-roadmap-updated]');
  if (roadmapUpdated) tasks.push(fetchLocalJson(`${root}/data/product/roadmap.json`).then((data) => { roadmapUpdated.textContent = `Roadmap source updated ${data.updatedAt}`; }));
  const vaultCount = document.querySelector('[data-vault-poc-count]');
  if (vaultCount) tasks.push(fetchLocalJson(`${root}/data/product/vaults.json`).then((data) => { vaultCount.textContent = String(data.vaults?.filter((vault) => vault.status === 'poc').length ?? 'Unavailable'); }));
  const deploymentTargets = document.querySelectorAll('[data-deployment-fact], [data-deployment-contract]');
  if (deploymentTargets.length) tasks.push(fetchLocalJson(`${root}/data/protocol/deployments.json`).then((data) => {
    const deployment = data.deployments?.find((entry) => entry.status === 'poc');
    if (!deployment) return;
    document.querySelectorAll('[data-deployment-fact="id"]').forEach((target) => { target.textContent = deployment.id; });
    document.querySelectorAll('[data-deployment-fact="network"]').forEach((target) => { target.textContent = `${deployment.network} · chain ${deployment.chainId}`; });
    document.querySelectorAll('[data-deployment-fact="recordedAt"]').forEach((target) => { target.textContent = `Recorded ${new Date(data.recordedAt).toLocaleString()}`; });
    document.querySelectorAll('[data-deployment-contract]').forEach((target) => {
      const key = target.dataset.deploymentContract;
      const address = key === 'baseAsset' ? deployment.baseAsset?.address : deployment.contracts?.[key];
      if (!address) return;
      target.textContent = `${address.slice(0, 8)}…${address.slice(-6)}`;
      if (target instanceof HTMLAnchorElement) target.href = `https://arbiscan.io/address/${address}`;
    });
  }));
  await Promise.allSettled(tasks);
}

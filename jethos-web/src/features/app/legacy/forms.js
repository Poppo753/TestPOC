import { DEPLOYMENT } from '../web3/deployment-config.js';
import { parseBaseAmount, parseShareAmount, estimateDeposit, estimateWithdrawal } from '../web3/estimates.js';
import { byId } from './dom.js';

/** Form concerns: tabs, max buttons and read-only estimates. */
export class AppForms {
  constructor({ ethers, getVault, getUser, getAddress, onDeposit, onWithdraw }) {
    Object.assign(this, { ethers, getVault, getUser, getAddress, onDeposit, onWithdraw });
  }
  bind() {
    byId('deposit-form')?.addEventListener('submit', (event) => { event.preventDefault(); this.onDeposit(); });
    byId('withdraw-form')?.addEventListener('submit', (event) => { event.preventDefault(); this.onWithdraw(); });
    byId('deposit-amount')?.addEventListener('input', () => this.previewDeposit());
    byId('withdraw-shares')?.addEventListener('input', () => this.previewWithdraw());
    byId('max-deposit')?.addEventListener('click', () => this.setMaxDeposit());
    byId('max-withdraw')?.addEventListener('click', () => this.setMaxWithdraw());
    document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => this.selectTab(button.dataset.tab)));
  }
  selectTab(name) {
    document.querySelectorAll('[data-tab]').forEach((button) => button.setAttribute('aria-selected', String(button.dataset.tab === name)));
    document.querySelectorAll('[data-tab-panel]').forEach((panel) => { panel.hidden = panel.dataset.tabPanel !== name; });
  }
  setMaxDeposit() {
    const user = this.getUser();
    if (!user?.baseBalance?.ok) return;
    byId('deposit-amount').value = this.ethers.formatUnits(user.baseBalance.value, DEPLOYMENT.baseAsset.decimals);
    this.previewDeposit();
  }
  setMaxWithdraw() {
    const user = this.getUser(); const vault = this.getVault();
    if (!user?.shareBalance?.ok || !vault?.shareMeta?.ok) return;
    byId('withdraw-shares').value = this.ethers.formatUnits(user.shareBalance.value, vault.shareMeta.value.decimals);
    this.previewWithdraw();
  }
  async previewDeposit() {
    const output = byId('deposit-preview'); const error = byId('deposit-error'); const input = byId('deposit-amount')?.value;
    if (!output || !error) return; error.textContent = '';
    if (!input) { output.textContent = 'Enter an amount to request the current contract estimate.'; return; }
    try { const amount = await parseBaseAmount(input); const preview = await estimateDeposit(amount); output.textContent = `Estimated shares (raw units): ${preview.shares}. Contract view; not guaranteed at execution.`; }
    catch (reason) { error.textContent = reason.message; output.textContent = 'Estimate unavailable.'; }
  }
  async previewWithdraw() {
    const output = byId('withdraw-preview'); const error = byId('withdraw-error'); const input = byId('withdraw-shares')?.value; const address = this.getAddress();
    if (!output || !error) return; error.textContent = '';
    if (!input || !address) { output.textContent = 'Connect and enter shares to request the current contract estimate.'; return; }
    try { const decimals = this.getVault()?.shareMeta?.value?.decimals ?? 18; const shares = await parseShareAmount(input, decimals); const preview = await estimateWithdrawal(shares, address); output.textContent = `${this.ethers.formatUnits(preview.amount, 6)} USDC estimated · ${preview.allowed ? 'currently allowed' : preview.reason}. Not guaranteed at execution.`; }
    catch (reason) { error.textContent = reason.message; output.textContent = 'Estimate unavailable.'; }
  }
}


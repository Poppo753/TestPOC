import { DEPLOYMENT } from '../web3/deployment-config.js';
import { parseBaseAmount, parseShareAmount, estimateWithdrawal } from '../web3/estimates.js';
import { approveExact, revokeApproval, deposit, withdraw, explainTransactionError } from '../web3/transactions.js';
import { Modal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { byId, setText } from './dom.js';

/** Transaction workflow and confirmation boundary. */
export class AppWorkflow {
  constructor({ ethers, wallet, view, getVault, getUser, refresh }) {
    Object.assign(this, { ethers, wallet, view, getVault, getUser, refresh });
    this.modal = new Modal(document.querySelector('[data-confirm-backdrop]'));
    this.pendingConfirmation = null;
    this.busy = false;
  }
  bind() {
    byId('revoke-approval')?.addEventListener('click', () => this.prepareRevoke());
    byId('confirm-cancel')?.addEventListener('click', () => this.modal.close());
    byId('confirm-action')?.addEventListener('click', async () => {
      const action = this.pendingConfirmation; this.pendingConfirmation = null; this.modal.close(); if (action) await action();
    });
  }
  requireWallet() {
    if (!this.wallet.address) throw new Error('Connect a wallet first.');
    if (this.wallet.chainId !== DEPLOYMENT.chain.id) throw new Error(`Switch to ${DEPLOYMENT.chain.name}.`);
  }
  confirm(title, description, action) {
    setText('confirm-title', title); setText('confirm-description', description); this.pendingConfirmation = action; this.modal.open();
  }
  async runBusy(action) {
    if (this.busy) return;
    this.busy = true; this.view.busy = true; this.view.renderWallet(this.wallet.snapshot());
    try { await action(); showToast('Transaction workflow confirmed.'); await this.refresh(); }
    catch (error) { this.view.renderTransaction({ state: 'failed', label: explainTransactionError(error) }); showToast(explainTransactionError(error)); }
    finally { this.busy = false; this.view.busy = false; this.view.renderWallet(this.wallet.snapshot()); }
  }
  async prepareDeposit() {
    try {
      this.requireWallet();
      const amount = await parseBaseAmount(byId('deposit-amount').value); const user = this.getUser();
      if (!user?.baseBalance?.ok || user.baseBalance.value < amount) throw new Error('Insufficient USDC balance.');
      const needsApproval = !user.allowance.ok || user.allowance.value < amount;
      this.confirm('Confirm deposit workflow', `${this.ethers.formatUnits(amount, 6)} USDC will be ${needsApproval ? 'approved with an exact allowance, then ' : ''}deposited. ${needsApproval ? 'Expect two wallet requests.' : 'Expect one wallet request.'}`, () => this.runBusy(async () => {
        if (needsApproval) await approveExact(this.wallet, amount, (state) => this.view.renderTransaction(state));
        await deposit(this.wallet, amount, (state) => this.view.renderTransaction(state));
      }));
    } catch (error) { byId('deposit-error').textContent = explainTransactionError(error); }
  }
  async prepareWithdraw() {
    try {
      this.requireWallet(); const decimals = this.getVault()?.shareMeta?.value?.decimals ?? 18;
      const shares = await parseShareAmount(byId('withdraw-shares').value, decimals); const preview = await estimateWithdrawal(shares, this.wallet.address);
      if (!preview.allowed) throw new Error(preview.reason || 'Withdrawal is not currently allowed.');
      this.confirm('Confirm withdrawal', `Burn ${this.ethers.formatUnits(shares, decimals)} declared share tokens for an estimated ${this.ethers.formatUnits(preview.amount, 6)} USDC. The request uses a 20-minute deadline.`, () => this.runBusy(() => withdraw(this.wallet, shares, (state) => this.view.renderTransaction(state))));
    } catch (error) { byId('withdraw-error').textContent = explainTransactionError(error); }
  }
  prepareRevoke() {
    try { this.requireWallet(); this.confirm('Revoke USDC approval', 'Set the LiquidityManager allowance to zero. This does not withdraw an existing vault position.', () => this.runBusy(() => revokeApproval(this.wallet, (state) => this.view.renderTransaction(state)))); }
    catch (error) { showToast(explainTransactionError(error)); }
  }
}


// ============================================
// ORGANISM: Withdraw Form Component
// ============================================

import { Card } from '../molecules/Card.js';
import { Input } from '../atoms/Input.js';
import { Button } from '../atoms/Button.js';
import { web3Manager } from '../utils/web3.js';
import { toast } from '../molecules/Alert.js';
import { CONFIG } from '../config/contracts.js';
import { MESSAGES } from '../config/constants.js';
import { isValidAmount } from '../utils/formatting.js';

export class WithdrawForm {
  constructor(config = {}) {
    this.onSuccess = config.onSuccess || (() => {});
    this.amount = '';
    this.maxAmount = '0';
    this.loading = false;
    this.selectedPreset = 100; // default 100%
  }

  async updateMaxAmount() {
    try {
      this.maxAmount = await web3Manager.getLPBalance();
      this.updateAmountFromPreset();
    } catch (error) {
      console.error('Error getting LP balance:', error);
      this.maxAmount = '0';
    }
  }

  updateAmountFromPreset() {
    // For 100%, use exact balance to avoid rounding issues
    if (this.selectedPreset === 100) {
      this.amount = this.maxAmount;
    } else {
      const percentage = this.selectedPreset / 100;
      this.amount = (parseFloat(this.maxAmount) * percentage).toFixed(6);
    }
    this.update();
  }

  async handleWithdraw() {
    if (!isValidAmount(this.amount)) {
      toast.error(MESSAGES.ERRORS.INVALID_AMOUNT);
      return;
    }

    if (parseFloat(this.amount) > parseFloat(this.maxAmount)) {
      toast.error(MESSAGES.ERRORS.INSUFFICIENT_BALANCE);
      return;
    }

    this.loading = true;
    this.update();

    try {
      toast.info(MESSAGES.INFO.CONFIRMING);

      const tx = await web3Manager.withdraw(this.amount);
      
      toast.info(`Transaction sent! <a href="${CONFIG.BLOCK_EXPLORER}/tx/${tx.hash}" target="_blank" class="underline font-bold">View on Arbiscan</a>`);

      const receipt = await tx.wait();

      toast.success(`${MESSAGES.SUCCESS.WITHDRAW} <a href="${CONFIG.BLOCK_EXPLORER}/tx/${receipt.hash}" target="_blank" class="underline font-bold">View on Arbiscan</a>`);

      this.amount = '';
      await this.updateMaxAmount();
      this.onSuccess();

    } catch (error) {
      console.error('Withdraw error:', error);
      toast.error(`${MESSAGES.ERRORS.TRANSACTION_FAILED}: ${error.message}`);
    } finally {
      this.loading = false;
      this.update();
    }
  }

  renderContent() {
    const container = document.createElement('div');
    container.className = 'space-y-4';

    // Percentage Presets
    const presetsWrapper = document.createElement('div');
    presetsWrapper.className = 'grid grid-cols-4 gap-2';

    const presets = [25, 50, 75, 100];
    presets.forEach(preset => {
      const btn = new Button({
        label: `${preset}%`,
        variant: this.selectedPreset === preset ? 'primary' : 'outline',
        size: 'sm',
        disabled: this.loading,
        onClick: () => {
          this.selectedPreset = preset;
          this.updateAmountFromPreset();
        },
      });
      presetsWrapper.appendChild(btn.render());
    });
    container.appendChild(presetsWrapper);

    // Amount Input
    const input = new Input({
      type: 'number',
      label: 'LP Tokens to Withdraw',
      placeholder: '0.0',
      value: this.amount,
      suffix: 'LP',
      min: '0',
      step: '0.00001',
      disabled: this.loading,
      onChange: (value) => {
        this.amount = value;
        this.selectedPreset = null; // Clear preset selection when manually typing
      },
    });
    container.appendChild(input.render());

    // Balance Info
    const balanceInfo = document.createElement('div');
    balanceInfo.className = 'text-xs text-gray-500 dark:text-gray-400 text-center';
    balanceInfo.textContent = `Available: ${this.maxAmount} LP • Fee: ${CONFIG.PROTOCOL.WITHDRAW_FEE * 100}%`;
    container.appendChild(balanceInfo);

    // Withdraw Button
    const withdrawBtn = new Button({
      label: 'Withdraw',
      variant: 'primary',
      size: 'lg',
      fullWidth: true,
      loading: this.loading,
      disabled: !web3Manager.userAddress || this.loading || parseFloat(this.maxAmount) === 0,
      icon: '💸',
      onClick: () => this.handleWithdraw(),
    });
    container.appendChild(withdrawBtn.render());

    if (!web3Manager.userAddress) {
      const notice = document.createElement('p');
      notice.className = 'text-sm text-center text-gray-500 dark:text-gray-400';
      notice.textContent = 'Connect your wallet to withdraw';
      container.appendChild(notice);
    } else if (parseFloat(this.maxAmount) === 0) {
      const notice = document.createElement('p');
      notice.className = 'text-sm text-center text-yellow-600 dark:text-yellow-400';
      notice.textContent = 'No LP tokens to withdraw';
      container.appendChild(notice);
    }

    return container;
  }

  render() {
    const card = new Card({
      title: '💸 Withdraw',
      subtitle: 'Withdraw your LP tokens to receive ETH',
      content: () => this.renderContent(),
      variant: 'default',
      colSpan: 1,
      rowSpan: 1,
    });

    const element = card.render();
    element.setAttribute('data-withdraw-form', 'true');
    this.element = element;
    return element;
  }

  update() {
    console.log('🔄 Updating WithdrawForm');
    const oldElement = document.querySelector('[data-withdraw-form="true"]');
    
    if (oldElement && oldElement.parentElement) {
      const newElement = this.render();
      oldElement.replaceWith(newElement);
      console.log('✅ WithdrawForm UI updated!');
    }
  }
}

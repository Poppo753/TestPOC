// ============================================
// ORGANISM: Withdraw Form Component
// ============================================

import { Card } from '../molecules/Card.js';
import { Input } from '../atoms/Input.js';
import { Button } from '../atoms/Button.js';
import { PriceImpactDisplay } from '../molecules/PriceImpactDisplay.js';
import { web3Manager } from '../utils/web3.js';
import { transactionHistory } from './TransactionHistoryPanel.js';
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
    this.estimatedOutput = '0';
    this.priceImpact = 0;
    this.pricePreviewContainer = null; // Store reference to preview DOM element
    this.inputElement = null; // Store reference to input element
    this.poolImpact = 0; // % of pool being removed
    this.preRate = 0; // ETH per LP before
    this.postRate = 0; // ETH per LP after
    
    // Create price impact display
    this.priceImpactDisplay = new PriceImpactDisplay({
      inputAmount: '0',
      inputToken: 'LP',
      outputAmount: '0',
      outputToken: 'ETH',
      priceImpact: 0,
      fee: CONFIG.withdrawFee || '0.1',
      loading: false,
    });
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
    
    // Update the input field value directly using stored reference
    if (this.inputElement) {
      this.inputElement.value = this.amount;
    }
    
    // Update preset buttons visually
    this.updatePresetButtons();
    
    // Calculate estimated output (async but don't wait)
    this.calculateEstimatedOutput();
  }

  updatePresetButtons() {
    const presetButtons = document.querySelectorAll('[data-preset-button]');
    presetButtons.forEach(btn => {
      const preset = parseInt(btn.getAttribute('data-preset'));
      if (preset === this.selectedPreset) {
        btn.className = btn.className.replace('border-gray-300', 'border-purple-600');
        btn.className = btn.className.replace('text-gray-700', 'text-white');
        btn.className = btn.className.replace('bg-white', 'bg-purple-600');
        btn.className = btn.className.replace('hover:bg-gray-50', 'hover:bg-purple-700');
      } else {
        btn.className = btn.className.replace('border-purple-600', 'border-gray-300');
        btn.className = btn.className.replace('text-white', 'text-gray-700');
        btn.className = btn.className.replace('bg-purple-600', 'bg-white');
        btn.className = btn.className.replace('hover:bg-purple-700', 'hover:bg-gray-50');
      }
    });
  }

  async calculateEstimatedOutput() {
    const lpAmount = parseFloat(this.amount) || 0;
    
    if (lpAmount === 0) {
      this.estimatedOutput = '0';
      this.priceImpact = 0;
      this.updatePriceImpact();
      if (this.pricePreviewContainer) {
        this.pricePreviewContainer.style.display = 'none';
      }
      return;
    }

    try {
      // Get pool value (total ETH) and total LP supply
      const [poolValue, totalSupply] = await Promise.all([
        web3Manager.getPoolValue().catch(e => { console.error('getPoolValue error:', e); return '0'; }),
        web3Manager.getTotalLPSupply().catch(e => { console.error('getTotalLPSupply error:', e); return '0'; })
      ]);
      
      const poolValueNum = parseFloat(poolValue) || 0;
      const totalSupplyNum = parseFloat(totalSupply) || 0;
      
      if (totalSupplyNum === 0) {
        this.estimatedOutput = '0';
        this.priceImpact = 0;
        this.poolImpact = 0;
        this.preRate = 0;
        this.postRate = 0;
      } else {
        // Formula: ethReceived = (lpAmount / totalSupply) * poolValue
        const ethBeforeFee = (lpAmount / totalSupplyNum) * poolValueNum;

        // Subtract withdrawal fee
        const feePercentage = parseFloat(CONFIG.PROTOCOL.WITHDRAW_FEE) * 100 || 0.1;
        const feeAmount = ethBeforeFee * (feePercentage / 100);
        this.estimatedOutput = (ethBeforeFee - feeAmount).toFixed(8);

        // Pool impact: % of LP you're withdrawing
        this.poolImpact = ((lpAmount / totalSupplyNum) * 100).toFixed(2);

        // Price impact: change in ETH per LP rate
        this.preRate = poolValueNum / totalSupplyNum; // ETH per LP before
        const newTotalSupply = Math.max(totalSupplyNum - lpAmount, 0.000000000000000001);
        const newPoolValue = Math.max(poolValueNum - ethBeforeFee, 0);
        this.postRate = newPoolValue / newTotalSupply; // ETH per LP after
        const impactPercent = ((this.postRate - this.preRate) / this.preRate) * 100;
        this.priceImpact = impactPercent.toFixed(2);
        
        console.log('📊 Withdraw calculation:', {
          lpAmount,
          poolValueNum,
          totalSupplyNum,
          estimatedOutput: this.estimatedOutput,
          poolImpact: this.poolImpact + '%',
          preRate: this.preRate.toFixed(8),
          postRate: this.postRate.toFixed(8),
          priceImpact: this.priceImpact + '%'
        });
      }
      
      this.updatePriceImpact();
      if (this.pricePreviewContainer) {
        this.pricePreviewContainer.style.display = 'block';
      }
    } catch (error) {
      console.error('Error calculating output:', error);
      this.estimatedOutput = '0';
      this.priceImpact = 0;
      this.updatePriceImpact();
    }
  }

  updatePriceImpact() {
    // Update the display data
    this.priceImpactDisplay.inputAmount = parseFloat(this.amount || 0).toFixed(8);
    this.priceImpactDisplay.outputAmount = this.estimatedOutput;
    this.priceImpactDisplay.priceImpact = this.priceImpact;
    this.priceImpactDisplay.poolImpact = this.poolImpact;
    this.priceImpactDisplay.preRate = this.preRate;
    this.priceImpactDisplay.postRate = this.postRate;
    this.priceImpactDisplay.loading = false;
    
    console.log('📊 Withdraw preview data:', {
      input: this.priceImpactDisplay.inputAmount,
      output: this.priceImpactDisplay.outputAmount,
      priceImpact: this.priceImpactDisplay.priceImpact,
      poolImpact: this.priceImpactDisplay.poolImpact,
      preRate: this.preRate.toFixed(8),
      postRate: this.postRate.toFixed(8)
    });
    
    // Re-render the price preview if container exists
    if (this.pricePreviewContainer) {
      const newPreview = this.priceImpactDisplay.render();
      this.pricePreviewContainer.innerHTML = '';
      this.pricePreviewContainer.appendChild(newPreview);
    }
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
      
      // Add pending transaction to history
      transactionHistory.addTransaction({
        type: 'withdraw',
        amount: this.amount,
        token: 'LP',
        hash: tx.hash,
        status: 'pending',
      });
      
      toast.info(`Transaction sent! <a href="${CONFIG.BLOCK_EXPLORER}/tx/${tx.hash}" target="_blank" class="underline font-bold">View on Arbiscan</a>`);

      // Wait for confirmation and update status
      const receipt = await web3Manager.waitForTransaction(tx.hash, (status) => {
        transactionHistory.updateTransactionStatus(tx.hash, status);
      });

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
      const btnElement = btn.render();
      btnElement.setAttribute('data-preset-button', '');
      btnElement.setAttribute('data-preset', preset);
      presetsWrapper.appendChild(btnElement);
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
        this.calculateEstimatedOutput(); // Update price preview
      },
    });
    const inputElement = input.render();
    // Store reference to the actual input element
    this.inputElement = inputElement.querySelector('input');
    container.appendChild(inputElement);

    // Price Impact Preview (always render, hidden if amount is 0)
    const priceImpactWrapper = document.createElement('div');
    priceImpactWrapper.className = 'mt-4';
    priceImpactWrapper.style.display = parseFloat(this.amount) > 0 ? 'block' : 'none';
    this.pricePreviewContainer = priceImpactWrapper; // Store reference
    priceImpactWrapper.appendChild(this.priceImpactDisplay.render());
    container.appendChild(priceImpactWrapper);

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

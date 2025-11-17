// ============================================
// ORGANISM: Deposit Form Component
// ============================================

import { Card } from '../molecules/Card.js';
import { Input } from '../atoms/Input.js';
import { Button } from '../atoms/Button.js';
import { PriceImpactDisplay } from '../molecules/PriceImpactDisplay.js';
import { web3Manager } from '../utils/web3.js';
import { toast } from '../molecules/Alert.js';
import { CONFIG } from '../config/contracts.js';
import { MESSAGES } from '../config/constants.js';
import { isValidAmount, formatEth } from '../utils/formatting.js';

export class DepositForm {
  constructor(config = {}) {
    this.onSuccess = config.onSuccess || (() => {});
    this.amount = '';
    this.loading = false;
    this.estimatedOutput = '0';
    this.priceImpact = 0;
    this.pricePreviewContainer = null; // Store reference to preview DOM element
    
    // Create price impact display
    this.priceImpactDisplay = new PriceImpactDisplay({
      inputAmount: '0',
      inputToken: 'ETH',
      outputAmount: '0',
      outputToken: 'LP',
      priceImpact: 0,
      fee: '0',
      loading: false,
    });
  }

  async calculateEstimatedOutput() {
    const ethAmount = parseFloat(this.amount) || 0;
    
    if (ethAmount === 0) {
      this.estimatedOutput = '0';
      this.priceImpact = 0;
      this.updatePriceImpact();
      return;
    }

    try {
      // Get current LP balance (total supply) and pool value
      const [lpBalance, poolValue] = await Promise.all([
        web3Manager.getLPBalance(),
        web3Manager.getPoolValue()
      ]);
      
      const poolValueNum = parseFloat(poolValue) || 0;
      const totalSupply = parseFloat(lpBalance) || 0;
      
      // Calculate LP tokens based on pool ratio
      // Formula: lpTokens = (ethDeposited / poolValue) * totalSupply
      // If pool is empty, 1 ETH = 1 LP (initial ratio)
      if (poolValueNum === 0 || totalSupply === 0) {
        this.estimatedOutput = ethAmount.toFixed(8);
        this.priceImpact = 0;
      } else {
        // Calculate how many LP tokens you get for your ETH
        // If poolValue = 0.000225 ETH and you have 0.000100 LP total
        // Your share = (0.5 ETH / 0.000225 ETH) * 0.000100 LP = lots!
        // Actually: you own (yourLP / totalLP) * poolValue
        // So: newLP = (ethAmount / poolValue) * totalLP... wait that's still wrong
        
        // CORRECT: Pool value is per 100 LP tokens
        // So if pool value = 0.000225 ETH per 100 LP
        // Then: LP tokens = (ethAmount / poolValue) * 100
        this.estimatedOutput = ((ethAmount / poolValueNum) * 100).toFixed(8);
        
        // Price impact: how much your deposit affects the pool
        const impactPercent = (ethAmount / poolValueNum) * 100;
        this.priceImpact = impactPercent.toFixed(2);
      }
      
      this.updatePriceImpact();
    } catch (error) {
      console.error('Error calculating output:', error);
      this.estimatedOutput = '0';
      this.priceImpact = 0;
      this.updatePriceImpact();
    }
  }

  updatePriceImpact() {
    // Update the display data
    this.priceImpactDisplay.inputAmount = parseFloat(this.amount || 0).toFixed(6);
    this.priceImpactDisplay.outputAmount = this.estimatedOutput;
    this.priceImpactDisplay.priceImpact = this.priceImpact;
    this.priceImpactDisplay.loading = false;
    
    // Re-render the price preview if container exists
    if (this.pricePreviewContainer) {
      const newPreview = this.priceImpactDisplay.render();
      this.pricePreviewContainer.innerHTML = '';
      this.pricePreviewContainer.appendChild(newPreview);
    }
  }

  async handleDeposit() {
    if (!isValidAmount(this.amount)) {
      toast.error(MESSAGES.ERRORS.INVALID_AMOUNT);
      return;
    }

    if (parseFloat(this.amount) < parseFloat(CONFIG.PROTOCOL.MIN_DEPOSIT)) {
      toast.error(`Minimum deposit is ${CONFIG.PROTOCOL.MIN_DEPOSIT} ETH`);
      return;
    }

    this.loading = true;
    this.update();

    try {
      toast.info(MESSAGES.INFO.CONFIRMING);

      const tx = await web3Manager.deposit(this.amount);
      
      toast.info(`Transaction sent! <a href="${CONFIG.BLOCK_EXPLORER}/tx/${tx.hash}" target="_blank" class="underline font-bold">View on Arbiscan</a>`);

      const receipt = await tx.wait();

      toast.success(`${MESSAGES.SUCCESS.DEPOSIT} <a href="${CONFIG.BLOCK_EXPLORER}/tx/${receipt.hash}" target="_blank" class="underline font-bold">View on Arbiscan</a>`);

      this.amount = '';
      this.onSuccess();

    } catch (error) {
      console.error('Deposit error:', error);
      
      // Parse error message
      let errorMsg = error.message || 'Transaction failed';
      
      if (error.code === 4001) {
        errorMsg = 'Transaction rejected by user';
      } else if (error.code === -32603) {
        errorMsg = 'Transaction failed. Contract may have reverted. Check if deposits are enabled.';
      } else if (errorMsg.includes('insufficient funds')) {
        errorMsg = 'Insufficient ETH balance for transaction';
      }
      
      toast.error(`Deposit failed: ${errorMsg}`);
    } finally {
      this.loading = false;
      this.update();
    }
  }

  renderContent() {
    const container = document.createElement('div');
    container.className = 'space-y-4';

    // Amount Input
    const input = new Input({
      type: 'number',
      label: 'Amount',
      placeholder: '0.0',
      value: this.amount,
      suffix: 'ETH',
      min: CONFIG.PROTOCOL.MIN_DEPOSIT,
      step: '0.00001',
      disabled: this.loading,
      onChange: (value) => {
        this.amount = value;
        this.calculateEstimatedOutput(); // Update price preview
      },
    });
    container.appendChild(input.render());

    // Price Impact Preview (always render, hidden if amount is 0)
    const priceImpactWrapper = document.createElement('div');
    priceImpactWrapper.className = 'mt-4';
    priceImpactWrapper.style.display = parseFloat(this.amount) > 0 ? 'block' : 'none';
    this.pricePreviewContainer = priceImpactWrapper; // Store reference
    priceImpactWrapper.appendChild(this.priceImpactDisplay.render());
    container.appendChild(priceImpactWrapper);

    // Fee Info
    const feeInfo = document.createElement('div');
    feeInfo.className = 'text-xs text-gray-500 dark:text-gray-400 text-center';
    feeInfo.textContent = `Fee: ${CONFIG.PROTOCOL.DEPOSIT_FEE * 100}% • Minimum: ${CONFIG.PROTOCOL.MIN_DEPOSIT} ETH`;
    container.appendChild(feeInfo);

    // Quick Amount Buttons
    const quickAmounts = ['0.01', '0.1', '0.5', '1.0'];
    const quickButtonsWrapper = document.createElement('div');
    quickButtonsWrapper.className = 'grid grid-cols-4 gap-2';

    quickAmounts.forEach(amount => {
      const btn = new Button({
        label: `${amount} ETH`,
        variant: 'outline',
        size: 'sm',
        disabled: this.loading,
        onClick: () => {
          this.amount = amount;
          this.calculateEstimatedOutput(); // Update price preview
          this.update();
        },
      });
      quickButtonsWrapper.appendChild(btn.render());
    });
    container.appendChild(quickButtonsWrapper);

    // Deposit Button
    const depositBtn = new Button({
      label: 'Deposit ETH',
      variant: 'primary',
      size: 'lg',
      fullWidth: true,
      loading: this.loading,
      disabled: !web3Manager.userAddress || this.loading,
      icon: '💰',
      onClick: () => this.handleDeposit(),
    });
    container.appendChild(depositBtn.render());

    if (!web3Manager.userAddress) {
      const notice = document.createElement('p');
      notice.className = 'text-sm text-center text-gray-500 dark:text-gray-400';
      notice.textContent = 'Connect your wallet to deposit';
      container.appendChild(notice);
    }

    return container;
  }

  render() {
    const card = new Card({
      title: '💰 Deposit ETH',
      subtitle: 'Deposit ETH to receive LP tokens',
      content: () => this.renderContent(),
      variant: 'default',
      colSpan: 1,
      rowSpan: 1,
    });

    const element = card.render();
    element.setAttribute('data-deposit-form', 'true');
    this.element = element;
    return element;
  }

  update() {
    console.log('🔄 Updating DepositForm');
    const oldElement = document.querySelector('[data-deposit-form="true"]');
    
    if (oldElement && oldElement.parentElement) {
      const newElement = this.render();
      oldElement.replaceWith(newElement);
      console.log('✅ DepositForm UI updated!');
    }
  }
}

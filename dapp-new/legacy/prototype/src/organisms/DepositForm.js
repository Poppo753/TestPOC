// ============================================
// ORGANISM: Deposit Form Component
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
import { isValidAmount, formatEth } from '../utils/formatting.js';

export class DepositForm {
  constructor(config = {}) {
    this.onSuccess = config.onSuccess || (() => {});
    this.amount = '';
    this.loading = false;
    this.estimatedOutput = '0';
    this.priceImpact = 0;
    this.pricePreviewContainer = null; // Store reference to preview DOM element
    this.inputElement = null; // Store reference to input element
    this.poolImpact = 0; // % of pool being added
    this.preRate = 0; // ETH per LP before
    this.postRate = 0; // ETH per LP after
    
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
    console.log('🎯 calculateEstimatedOutput called, amount:', ethAmount);
    
    if (ethAmount === 0) {
      this.estimatedOutput = '0';
      this.priceImpact = 0;
      this.updatePriceImpact();
      if (this.pricePreviewContainer) {
        this.pricePreviewContainer.style.display = 'none';
      }
      return;
    }

    try {
      // Get pool value (total ETH in pool) and total LP supply
      const [poolValue, totalSupply] = await Promise.all([
        web3Manager.getPoolValue().catch(e => { console.error('getPoolValue error:', e); return '0'; }),
        web3Manager.getTotalLPSupply().catch(e => { console.error('getTotalLPSupply error:', e); return '0'; })
      ]);
      
      const poolValueNum = parseFloat(poolValue) || 0;
      const totalSupplyNum = parseFloat(totalSupply) || 0;
      
      // Calculate LP tokens you'll receive
      if (poolValueNum === 0 || totalSupplyNum === 0) {
        // Empty pool: 1 ETH = 1 LP token (initial ratio)
        this.estimatedOutput = ethAmount.toFixed(8);
        this.priceImpact = 0;
        this.poolImpact = 0;
        this.preRate = 1;
        this.postRate = 1;
      } else {
        // Formula: lpTokens = (ethDeposited / poolValue) * totalSupply
        this.estimatedOutput = ((ethAmount / poolValueNum) * totalSupplyNum).toFixed(8);

        // Pool impact: % of pool you're adding
        this.poolImpact = ((ethAmount / poolValueNum) * 100).toFixed(2);

        // Price impact: change in ETH per LP rate
        this.preRate = poolValueNum / totalSupplyNum; // ETH per LP before
        const newTotalSupply = totalSupplyNum + parseFloat(this.estimatedOutput);
        const newPoolValue = poolValueNum + ethAmount;
        this.postRate = newPoolValue / newTotalSupply; // ETH per LP after
        const impactPercent = ((this.postRate - this.preRate) / this.preRate) * 100;
        this.priceImpact = impactPercent.toFixed(2);
        
        console.log('📊 Deposit calculation:', {
          ethAmount,
          poolValueNum,
          totalSupplyNum,
          estimatedOutput: this.estimatedOutput,
          poolImpact: this.poolImpact + '%',
          preRate: this.preRate.toFixed(8),
          postRate: this.postRate.toFixed(8),
          priceImpact: this.priceImpact + '%'
        });
      }
      
      console.log('✅ Calculation complete - Output:', this.estimatedOutput, 'Impact:', this.priceImpact);
      this.updatePriceImpact();
      if (this.pricePreviewContainer) {
        this.pricePreviewContainer.style.display = 'block';
      }
    } catch (error) {
      console.error('Error calculating output:', error);
      this.estimatedOutput = '0';
      this.priceImpact = 0;
      this.updatePriceImpact();
      if (this.pricePreviewContainer) {
        this.pricePreviewContainer.style.display = 'none';
      }
    }
  }

  updatePriceImpact() {
    console.log('🔄 updatePriceImpact called');
    // Update the display data
    this.priceImpactDisplay.inputAmount = parseFloat(this.amount || 0).toFixed(6);
    this.priceImpactDisplay.outputAmount = this.estimatedOutput;
    this.priceImpactDisplay.priceImpact = this.priceImpact;
    this.priceImpactDisplay.poolImpact = this.poolImpact;
    this.priceImpactDisplay.preRate = this.preRate;
    this.priceImpactDisplay.postRate = this.postRate;
    this.priceImpactDisplay.loading = false;
    
    console.log('📊 Preview data:', {
      input: this.priceImpactDisplay.inputAmount,
      output: this.priceImpactDisplay.outputAmount,
      priceImpact: this.priceImpactDisplay.priceImpact,
      poolImpact: this.priceImpactDisplay.poolImpact,
      preRate: this.preRate.toFixed(8),
      postRate: this.postRate.toFixed(8)
    });
    
    // Re-render the price preview if container exists
    if (this.pricePreviewContainer) {
      console.log('✅ Container exists, re-rendering preview');
      const newPreview = this.priceImpactDisplay.render();
      this.pricePreviewContainer.innerHTML = '';
      this.pricePreviewContainer.appendChild(newPreview);
    } else {
      console.warn('⚠️ pricePreviewContainer is null!');
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
      
      // Add pending transaction to history
      transactionHistory.addTransaction({
        type: 'deposit',
        amount: this.amount,
        token: 'ETH',
        hash: tx.hash,
        status: 'pending',
      });
      
      toast.info(`Transaction sent! <a href="${CONFIG.BLOCK_EXPLORER}/tx/${tx.hash}" target="_blank" class="underline font-bold">View on Arbiscan</a>`);

      // Wait for confirmation and update status
      const receipt = await web3Manager.waitForTransaction(tx.hash, (status) => {
        transactionHistory.updateTransactionStatus(tx.hash, status);
      });

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
        console.log('🔢 Input onChange triggered, value:', value);
        this.amount = value;
        console.log('📊 Calling calculateEstimatedOutput...');
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
          
          // Update input field directly using stored reference
          if (this.inputElement) {
            this.inputElement.value = amount;
          }
          
          // Calculate and show price preview
          this.calculateEstimatedOutput();
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

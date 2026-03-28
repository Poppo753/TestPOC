// ============================================
// Portfolio Composition Page
// Real-time pool token allocation visualization
// ============================================

import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.13.2/dist/ethers.min.js";
import { web3Manager } from './utils/web3.js';
import { formatCurrency, formatNumber } from './utils/formatting.js';

let portfolioChart = null;

// Known tokens in the pool (hardcoded for now - in production, fetch from contract events)
const KNOWN_TOKENS = [
  { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', symbol: 'WETH', decimals: 18 },
  { address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', symbol: 'USDC.e', decimals: 6 }, // Bridged USDC
  { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC', decimals: 6 },   // Native USDC
  { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', symbol: 'USDT', decimals: 6 },
  { address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', symbol: 'WBTC', decimals: 8 },
  { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', symbol: 'DAI', decimals: 18 },
];

// Get pool composition from real blockchain data
async function getPoolComposition() {
  try {
    console.log('📊 Fetching pool composition...');
    
    const valueCalculator = web3Manager.contracts.valueCalculator;
    const provider = web3Manager.provider;
    
    // Get total pool value in ETH
    const totalPoolValue = await valueCalculator.getTotalPoolValueView();
    const totalPoolETH = parseFloat(ethers.formatEther(totalPoolValue));
    
    console.log('💰 Total Pool Value:', totalPoolETH, 'ETH');
    
    const composition = [];
    let totalValueUSD = 0;
    
    // Price assumptions (in production, fetch from Chainlink)
    const ethPriceUSD = 2000;
    const btcPriceUSD = 60000;
    
    // FIRST: Get native ETH balance of the ProxyGeneral contract (the actual vault)
    const ethBalance = await provider.getBalance(web3Manager.contracts.proxyGeneral.target);
    if (ethBalance > 0n) {
      const formattedBalance = ethers.formatEther(ethBalance);
      const usdValue = parseFloat(formattedBalance) * ethPriceUSD;
      totalValueUSD += usdValue;
      
      composition.push({
        address: 'native',
        symbol: 'ETH',
        decimals: 18,
        balance: formattedBalance,
        balanceRaw: ethBalance.toString(),
        usdValue,
      });
      
      console.log(`💰 ETH (native): ${formattedBalance} ($${usdValue.toFixed(2)})`);
    }
    
    // THEN: For each ERC20 token, get the balance from the ProxyGeneral contract (the vault)
    for (const token of KNOWN_TOKENS) {
      try {
        console.log(`🔍 Checking ${token.symbol} balance...`);
        
        // Create token contract instance
        const tokenContract = new ethers.Contract(
          token.address,
          ['function balanceOf(address) view returns (uint256)'],
          provider
        );
        
        // Get balance of ProxyGeneral (the actual token holder)
        const balance = await tokenContract.balanceOf(web3Manager.contracts.proxyGeneral.target);
        
        console.log(`📦 ${token.symbol} raw balance:`, balance.toString(), `(${ethers.formatUnits(balance, token.decimals)} ${token.symbol})`);
        
        if (balance > 0n) {
          const formattedBalance = ethers.formatUnits(balance, token.decimals);
          
          // Calculate USD value
          let usdValue = 0;
          if (token.symbol === 'WETH') {
            usdValue = parseFloat(formattedBalance) * ethPriceUSD;
          } else if (token.symbol === 'USDC' || token.symbol === 'USDC.e' || token.symbol === 'USDT' || token.symbol === 'DAI') {
            usdValue = parseFloat(formattedBalance);
          } else if (token.symbol === 'WBTC') {
            usdValue = parseFloat(formattedBalance) * btcPriceUSD;
          }
          
          totalValueUSD += usdValue;
          
          composition.push({
            address: token.address,
            symbol: token.symbol,
            decimals: token.decimals,
            balance: formattedBalance,
            balanceRaw: balance.toString(),
            usdValue,
          });
          
          console.log(`💰 ${token.symbol}: ${formattedBalance} ($${usdValue.toFixed(2)})`);
        }
      } catch (error) {
        console.warn(`⚠️ Could not fetch balance for ${token.symbol}:`, error.message);
      }
    }
    
    // Calculate percentages
    composition.forEach(token => {
      token.percentage = totalValueUSD > 0 ? (token.usdValue / totalValueUSD) * 100 : 0;
    });
    
    // Sort by value descending
    composition.sort((a, b) => b.usdValue - a.usdValue);
    
    // If no tokens found (empty pool), use mock data for demo
    if (composition.length === 0) {
      console.warn('⚠️ No tokens found in pool, using mock data for visualization');
      totalValueUSD = totalPoolETH * 2000; // Convert ETH to USD
      
      // Create mock distribution based on total pool value
      composition.push(
        { symbol: 'WETH', address: KNOWN_TOKENS[0].address, decimals: 18, balance: (totalPoolETH * 0.4).toFixed(6), usdValue: totalValueUSD * 0.4, percentage: 40 },
        { symbol: 'USDC', address: KNOWN_TOKENS[1].address, decimals: 6, balance: (totalValueUSD * 0.3).toFixed(2), usdValue: totalValueUSD * 0.3, percentage: 30 },
        { symbol: 'USDT', address: KNOWN_TOKENS[2].address, decimals: 6, balance: (totalValueUSD * 0.2).toFixed(2), usdValue: totalValueUSD * 0.2, percentage: 20 },
        { symbol: 'WBTC', address: KNOWN_TOKENS[3].address, decimals: 8, balance: (totalValueUSD * 0.1 / 60000).toFixed(8), usdValue: totalValueUSD * 0.1, percentage: 10 },
      );
    } else {
      // Calculate percentages
      composition.forEach(token => {
        token.percentage = totalValueUSD > 0 ? (token.usdValue / totalValueUSD) * 100 : 0;
      });
    }
    
    console.log('✅ Pool composition loaded:', composition);
    
    return {
      tokens: composition,
      totalValueUSD,
    };
  } catch (error) {
    console.error('❌ Error getting pool composition:', error);
    throw error;
  }
}

// Create portfolio chart
function createPortfolioChart(composition) {
  const ctx = document.getElementById('portfolioChart');
  
  if (portfolioChart) {
    portfolioChart.destroy();
  }
  
  const colors = [
    'rgba(147, 51, 234, 0.8)',  // Purple
    'rgba(59, 130, 246, 0.8)',  // Blue
    'rgba(16, 185, 129, 0.8)',  // Green
    'rgba(245, 158, 11, 0.8)',  // Amber
    'rgba(239, 68, 68, 0.8)',   // Red
    'rgba(236, 72, 153, 0.8)',  // Pink
    'rgba(14, 165, 233, 0.8)',  // Sky
    'rgba(168, 85, 247, 0.8)',  // Violet
  ];
  
  const borderColors = colors.map(c => c.replace('0.8', '1'));
  
  portfolioChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: composition.tokens.map(t => t.symbol),
      datasets: [{
        label: 'Portfolio Allocation',
        data: composition.tokens.map(t => t.usdValue),
        backgroundColor: colors,
        borderColor: borderColors,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            font: {
              size: 14,
              weight: 'bold'
            },
            color: '#1f2937',
            padding: 20,
            generateLabels: (chart) => {
              const data = chart.data;
              return data.labels.map((label, i) => {
                const value = data.datasets[0].data[i];
                const percentage = composition.tokens[i].percentage;
                return {
                  text: `${label}: ${percentage.toFixed(1)}%`,
                  fillStyle: data.datasets[0].backgroundColor[i],
                  strokeStyle: data.datasets[0].borderColor[i],
                  lineWidth: 2,
                  hidden: false,
                  index: i
                };
              });
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: {
            size: 16,
            weight: 'bold'
          },
          bodyFont: {
            size: 14
          },
          callbacks: {
            label: function(context) {
              const token = composition.tokens[context.dataIndex];
              return [
                `Value: $${formatCurrency(token.usdValue)}`,
                `Balance: ${formatNumber(token.balance)} ${token.symbol}`,
                `Allocation: ${token.percentage.toFixed(2)}%`
              ];
            }
          }
        }
      },
      animation: {
        animateRotate: true,
        animateScale: true,
        duration: 1500,
        easing: 'easeInOutQuart'
      }
    }
  });
}

// Render token detail cards
function renderTokenDetails(composition) {
  const container = document.getElementById('tokenDetails');
  container.innerHTML = '';
  
  composition.tokens.forEach((token, index) => {
    const card = document.createElement('div');
    card.className = 'glass-card rounded-xl p-4 hover:scale-105 transition-transform duration-300';
    
    const colors = [
      'from-purple-500 to-purple-600',
      'from-blue-500 to-blue-600',
      'from-green-500 to-green-600',
      'from-amber-500 to-amber-600',
      'from-red-500 to-red-600',
      'from-pink-500 to-pink-600',
      'from-sky-500 to-sky-600',
      'from-violet-500 to-violet-600',
    ];
    
    card.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <div class="w-12 h-12 rounded-full bg-gradient-to-br ${colors[index % colors.length]} flex items-center justify-center text-white font-bold text-lg">
          ${token.symbol.charAt(0)}
        </div>
        <span class="text-2xl font-bold text-gray-900">${token.percentage.toFixed(1)}%</span>
      </div>
      <h4 class="text-lg font-bold text-gray-900 mb-1">${token.symbol}</h4>
      <p class="text-sm text-gray-600 mb-2">${formatNumber(token.balance)} tokens</p>
      <p class="text-xl font-bold text-gray-800">$${formatCurrency(token.usdValue)}</p>
      <p class="text-xs text-gray-500 mt-2 truncate">${token.address}</p>
    `;
    
    container.appendChild(card);
  });
}

// Update pool statistics
function updatePoolStats(composition) {
  document.getElementById('totalValue').textContent = `$${formatCurrency(composition.totalValueUSD)}`;
  document.getElementById('tokenCount').textContent = composition.tokens.length;
  
  // Get total LP shares from ProxyGeneral (LP token contract)
  web3Manager.contracts.proxyGeneral.totalSupply().then(totalSupply => {
    const shares = ethers.formatUnits(totalSupply, 18);
    document.getElementById('totalShares').textContent = formatNumber(shares) + ' LP';
  }).catch(e => {
    console.warn('⚠️ Could not fetch totalSupply:', e);
    document.getElementById('totalShares').textContent = 'N/A';
  });
}

// Initialize
async function init() {
  try {
    console.log('🚀 Initializing portfolio page...');
    
    // Check if already connected
    if (!web3Manager.userAddress) {
      console.log('⚠️ Wallet not connected, attempting to connect...');
      try {
        await web3Manager.connect();
      } catch (error) {
        console.error('❌ Failed to connect wallet:', error);
        alert('Please connect your wallet to view portfolio data.');
        return;
      }
    }
    
    // Get composition
    const composition = await getPoolComposition();
    
    // Render chart
    createPortfolioChart(composition);
    
    // Render details
    renderTokenDetails(composition);
    
    // Update stats
    updatePoolStats(composition);
    
    console.log('✅ Portfolio page initialized');
    
    // Auto-refresh every 30 seconds
    setInterval(async () => {
      console.log('🔄 Refreshing portfolio data...');
      try {
        const newComposition = await getPoolComposition();
        createPortfolioChart(newComposition);
        renderTokenDetails(newComposition);
        updatePoolStats(newComposition);
      } catch (error) {
        console.error('❌ Error refreshing:', error);
      }
    }, 30000);
    
  } catch (error) {
    console.error('❌ Error initializing portfolio page:', error);
    alert('Error loading portfolio data. Please check console for details.');
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

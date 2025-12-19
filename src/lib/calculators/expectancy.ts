/**
 * Trading system expectancy and performance calculation utilities
 * Based on Champion Profitability Calculator spreadsheet structure
 * 
 * Three-section bucket system:
 * 1. Breakeven Buckets (typically ~10% of trades)
 * 2. Losing Buckets (typically ~50% of trades)
 * 3. Winning Buckets (typically ~40% of trades)
 */

export interface SectionBucket {
  id: string;
  rMultiple: number;
  percentageInSection: number; // Percentage within this section (must sum to 100%)
  trades: number; // Auto-calculated
}

export interface BucketSection {
  name: 'breakeven' | 'losing' | 'winning';
  sectionPercentage: number; // Percentage of total trades
  buckets: SectionBucket[];
  totalTrades: number; // Auto-calculated
}

export interface SystemMetrics {
  // Performance metrics
  winRate: number;
  avgWin: number; // Average gain for winners
  avgLoss: number; // Average loss for losers
  arr: number; // Average Risk Reward ratio (avgWin / |avgLoss|)
  avgLossBE: number; // Average loss for breakeven bucket
  expectancy: number; // Average R per trade
  
  // Profit calculations
  netGainR: number; // Net gain in R-multiples (simple)
  netGainCurrency: number; // Net gain in currency (simple)
  netGainCompoundedR: number; // Net gain with quarterly compounding
  netGainCompoundedCurrency: number; // Total profit with compounding
  
  // Trade distribution
  totalTrades: number;
  breakevenTrades: number;
  losingTrades: number;
  winningTrades: number;
  winnersAndLosers: number;
}

/**
 * Calculate system metrics from three bucket sections
 */
export function calculateSystemMetrics(
  breakevenSection: BucketSection,
  losingSection: BucketSection,
  winningSection: BucketSection,
  totalTrades: number,
  rValue: number,
  compoundQuarterly: boolean = false
): SystemMetrics {
  if (totalTrades <= 0) throw new Error('Total trades must be positive');
  if (rValue <= 0) throw new Error('R value must be positive');

  // Validate section percentages sum to 100%
  const totalSectionPercentage = 
    breakevenSection.sectionPercentage + 
    losingSection.sectionPercentage + 
    winningSection.sectionPercentage;
  
  if (Math.abs(totalSectionPercentage - 100) > 0.01) {
    throw new Error(`Section percentages must sum to 100% (current: ${totalSectionPercentage}%)`);
  }

  // Calculate trades for each section
  const breakevenTrades = Math.round((breakevenSection.sectionPercentage / 100) * totalTrades);
  const losingTrades = Math.round((losingSection.sectionPercentage / 100) * totalTrades);
  const winningTrades = Math.round((winningSection.sectionPercentage / 100) * totalTrades);
  const winnersAndLosers = losingTrades + winningTrades;

  // Update section totals
  breakevenSection.totalTrades = breakevenTrades;
  losingSection.totalTrades = losingTrades;
  winningSection.totalTrades = winningTrades;

  // Calculate individual bucket trades
  breakevenSection.buckets.forEach(bucket => {
    bucket.trades = Math.round((bucket.percentageInSection / 100) * breakevenTrades);
  });
  losingSection.buckets.forEach(bucket => {
    bucket.trades = Math.round((bucket.percentageInSection / 100) * losingTrades);
  });
  winningSection.buckets.forEach(bucket => {
    bucket.trades = Math.round((bucket.percentageInSection / 100) * winningTrades);
  });

  // Calculate average gain (winners only)
  let totalWinR = 0;
  let actualWinningTrades = 0;
  winningSection.buckets.forEach(bucket => {
    if (bucket.trades > 0) {
      totalWinR += bucket.rMultiple * bucket.trades;
      actualWinningTrades += bucket.trades;
    }
  });
  const avgWin = actualWinningTrades > 0 ? totalWinR / actualWinningTrades : 0;

  // Calculate average loss (losers only)
  let totalLossR = 0;
  let actualLosingTrades = 0;
  losingSection.buckets.forEach(bucket => {
    if (bucket.trades > 0) {
      totalLossR += Math.abs(bucket.rMultiple) * bucket.trades;
      actualLosingTrades += bucket.trades;
    }
  });
  const avgLoss = actualLosingTrades > 0 ? totalLossR / actualLosingTrades : 0;

  // Calculate average loss for breakeven
  let totalBER = 0;
  let actualBETrades = 0;
  breakevenSection.buckets.forEach(bucket => {
    if (bucket.trades > 0) {
      totalBER += Math.abs(bucket.rMultiple) * bucket.trades;
      actualBETrades += bucket.trades;
    }
  });
  const avgLossBE = actualBETrades > 0 ? totalBER / actualBETrades : 0;

  // Calculate ARR (Average Risk Reward)
  const arr = avgLoss > 0 ? avgWin / avgLoss : 0;

  // Calculate win rate
  const winRate = totalTrades > 0 ? (actualWinningTrades / totalTrades) * 100 : 0;

  // Calculate expectancy (average R per trade)
  let expectancy = 0;
  
  breakevenSection.buckets.forEach(bucket => {
    const absolutePercentage = (breakevenSection.sectionPercentage / 100) * (bucket.percentageInSection / 100);
    expectancy += bucket.rMultiple * absolutePercentage;
  });
  
  losingSection.buckets.forEach(bucket => {
    const absolutePercentage = (losingSection.sectionPercentage / 100) * (bucket.percentageInSection / 100);
    expectancy += bucket.rMultiple * absolutePercentage;
  });
  
  winningSection.buckets.forEach(bucket => {
    const absolutePercentage = (winningSection.sectionPercentage / 100) * (bucket.percentageInSection / 100);
    expectancy += bucket.rMultiple * absolutePercentage;
  });

  // Calculate net gain (simple - no compounding)
  const netGainR = expectancy * totalTrades;
  const netGainCurrency = netGainR * rValue;

  // Calculate compounded gain
  let netGainCompoundedR = netGainR;
  let netGainCompoundedCurrency = netGainCurrency;

  if (compoundQuarterly && totalTrades >= 4) {
    // Quarterly compounding: divide trades into 4 quarters
    const tradesPerQuarter = Math.floor(totalTrades / 4);
    const remainingTrades = totalTrades % 4;
    
    // Assume 1R represents a percentage of account (e.g., 1R = 1% risk)
    // Starting account = R value × 100 (if 1R = 1% of account)
    let accountValue = rValue * 100;
    let totalGain = 0;
    
    // Process 4 complete quarters
    for (let q = 0; q < 4; q++) {
      const quarterTrades = q < remainingTrades ? tradesPerQuarter + 1 : tradesPerQuarter;
      const currentR = accountValue / 100; // 1% of current account
      const quarterGain = expectancy * quarterTrades * currentR;
      accountValue += quarterGain;
      totalGain += quarterGain;
    }
    
    netGainCompoundedCurrency = totalGain;
    netGainCompoundedR = totalGain / rValue;
  }

  return {
    winRate,
    avgWin,
    avgLoss,
    arr,
    avgLossBE,
    expectancy,
    netGainR,
    netGainCurrency,
    netGainCompoundedR,
    netGainCompoundedCurrency,
    totalTrades,
    breakevenTrades,
    losingTrades,
    winningTrades,
    winnersAndLosers,
  };
}

/**
 * Validate bucket section data
 */
export function validateBucketSection(section: BucketSection): boolean {
  if (section.buckets.length === 0) {
    throw new Error(`${section.name} section must have at least one bucket`);
  }

  // Validate percentages within section sum to 100%
  const total = section.buckets.reduce((sum, b) => sum + b.percentageInSection, 0);
  if (Math.abs(total - 100) > 0.01) {
    throw new Error(
      `${section.name} section bucket percentages must sum to 100% (current: ${total}%)`
    );
  }

  // Validate individual buckets
  section.buckets.forEach((bucket, i) => {
    if (bucket.percentageInSection < 0 || bucket.percentageInSection > 100) {
      throw new Error(
        `${section.name} bucket ${i + 1}: Percentage must be between 0 and 100`
      );
    }
  });

  return true;
}

/**
 * Generate default bucket sections matching the spreadsheet
 */
export function getDefaultBucketSections(): {
  breakeven: BucketSection;
  losing: BucketSection;
  winning: BucketSection;
} {
  return {
    breakeven: {
      name: 'breakeven',
      sectionPercentage: 10,
      totalTrades: 0,
      buckets: [
        { id: 'be-1', rMultiple: -0.1, percentageInSection: 100, trades: 0 },
      ],
    },
    losing: {
      name: 'losing',
      sectionPercentage: 50,
      totalTrades: 0,
      buckets: [
        { id: 'loss-1', rMultiple: -1.0, percentageInSection: 90, trades: 0 },
        { id: 'loss-2', rMultiple: -0.5, percentageInSection: 10, trades: 0 },
      ],
    },
    winning: {
      name: 'winning',
      sectionPercentage: 40,
      totalTrades: 0,
      buckets: [
        { id: 'win-1', rMultiple: 1.0, percentageInSection: 30, trades: 0 },
        { id: 'win-2', rMultiple: 2.0, percentageInSection: 30, trades: 0 },
        { id: 'win-3', rMultiple: 3.0, percentageInSection: 30, trades: 0 },
        { id: 'win-4', rMultiple: 5.0, percentageInSection: 10, trades: 0 },
        { id: 'win-5', rMultiple: 7.0, percentageInSection: 0, trades: 0 },
        { id: 'win-6', rMultiple: 10.0, percentageInSection: 0, trades: 0 },
      ],
    },
  };
}

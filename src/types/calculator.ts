/**
 * Type definitions for trading calculators
 * Provides comprehensive types for position sizing, risk management, and system analysis
 */

// ============================================================================
// Shared Base Types
// ============================================================================

/**
 * Represents a monetary amount in a specific currency
 */
export interface CurrencyAmount {
  /** The numeric value */
  value: number;
  /** ISO 4217 currency code (e.g., "USD", "EUR", "INR") */
  currency: string;
}

/**
 * Represents a percentage value
 * @example { value: 2.5 } represents 2.5%
 */
export interface Percentage {
  /** The percentage value (e.g., 2.5 for 2.5%) */
  value: number;
}

/**
 * Risk/Reward ratio
 * @example { risk: 1, reward: 3 } represents a 1:3 risk-reward ratio
 */
export interface RiskRewardRatio {
  /** Risk units */
  risk: number;
  /** Reward units */
  reward: number;
}

/**
 * Date range for analysis
 */
export interface DateRange {
  /** Start date (ISO 8601 format) */
  startDate: string;
  /** End date (ISO 8601 format) */
  endDate: string;
}

// ============================================================================
// Position Calculator Types
// ============================================================================

/**
 * Account settings for position sizing calculations
 */
export interface AccountSettings {
  /** Total account capital */
  capital: CurrencyAmount;
  /** Maximum risk per trade as a percentage of capital */
  riskPerTrade: Percentage;
  /** Currency used for the account */
  baseCurrency: string;
  /** Optional: Maximum position size as percentage of capital */
  maxPositionSize?: Percentage;
  /** Optional: Maximum number of concurrent positions */
  maxConcurrentPositions?: number;
}

/**
 * Order type for position entry/exit
 */
export type OrderType = 'market' | 'limit' | 'stop' | 'stop-limit';

/**
 * Position side/direction
 */
export type PositionSide = 'long' | 'short';

/**
 * Single trading position with risk management parameters
 */
export interface Position {
  /** Unique identifier for the position */
  id: string;
  /** Trading symbol/ticker */
  symbol: string;
  /** Position direction */
  side: PositionSide;
  /** Entry price per unit */
  entryPrice: number;
  /** Stop loss price */
  stopLoss: number;
  /** Take profit price (optional for manual exits) */
  takeProfit?: number;
  /** Position size in units/shares */
  size: number;
  /** Order type for entry */
  orderType: OrderType;
  /** Risk amount for this position */
  riskAmount: CurrencyAmount;
  /** Potential profit if take profit is hit */
  potentialProfit?: CurrencyAmount;
  /** Risk/Reward ratio */
  riskRewardRatio?: RiskRewardRatio;
  /** Creation timestamp */
  createdAt: string;
  /** Optional: Additional notes or strategy details */
  notes?: string;
}

/**
 * Single entry in a pyramiding strategy
 */
export interface PyramidEntry {
  /** Entry number in the pyramid (1, 2, 3, etc.) */
  entryNumber: number;
  /** Price at this entry level */
  price: number;
  /** Size added at this entry */
  size: number;
  /** Capital allocated for this entry */
  capitalAllocated: CurrencyAmount;
  /** Risk amount for this entry */
  riskAmount: CurrencyAmount;
  /** Trigger condition for this entry (e.g., "Price breaks above 150") */
  triggerCondition?: string;
}

/**
 * Combined position with pyramiding entries
 * Represents an aggregated view of multiple entries into the same position
 */
export interface CombinedPosition {
  /** Position identifier */
  id: string;
  /** Trading symbol */
  symbol: string;
  /** Position direction */
  side: PositionSide;
  /** All pyramid entries */
  entries: PyramidEntry[];
  /** Weighted average entry price */
  averageEntryPrice: number;
  /** Total position size across all entries */
  totalSize: number;
  /** Current stop loss for the entire position */
  stopLoss: number;
  /** Current take profit (if set) */
  takeProfit?: number;
  /** Total capital invested */
  totalCapital: CurrencyAmount;
  /** Total risk across all entries */
  totalRisk: CurrencyAmount;
  /** Total potential profit */
  totalPotentialProfit?: CurrencyAmount;
  /** Overall risk/reward ratio */
  overallRiskReward?: RiskRewardRatio;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Position calculator input parameters
 */
export interface PositionCalculatorInput {
  /** Account settings */
  account: AccountSettings;
  /** Trading symbol */
  symbol: string;
  /** Position side */
  side: PositionSide;
  /** Entry price */
  entryPrice: number;
  /** Stop loss price */
  stopLoss: number;
  /** Optional: Take profit price */
  takeProfit?: number;
  /** Optional: Custom risk amount (overrides account risk per trade) */
  customRiskAmount?: CurrencyAmount;
}

/**
 * Result from position calculator
 */
export interface PositionCalculatorResult {
  /** Calculated position */
  position: Position;
  /** Percentage of capital allocated */
  capitalAllocation: Percentage;
  /** Distance from entry to stop loss */
  stopLossDistance: number;
  /** Distance from entry to take profit */
  takeProfitDistance?: number;
  /** Whether position exceeds max position size */
  exceedsMaxSize: boolean;
  /** Warning messages if any */
  warnings: string[];
}

// ============================================================================
// System Analyzer Types
// ============================================================================

/**
 * Status of a trade
 */
export type TradeStatus = 'open' | 'closed' | 'cancelled';

/**
 * Trade outcome
 */
export type TradeOutcome = 'win' | 'loss' | 'breakeven';

/**
 * Individual trade record for system analysis
 */
export interface Trade {
  /** Unique trade identifier */
  id: string;
  /** Trading symbol */
  symbol: string;
  /** Position side */
  side: PositionSide;
  /** Entry timestamp */
  entryDate: string;
  /** Entry price */
  entryPrice: number;
  /** Exit timestamp (if closed) */
  exitDate?: string;
  /** Exit price (if closed) */
  exitPrice?: number;
  /** Position size */
  size: number;
  /** Trade status */
  status: TradeStatus;
  /** Trade outcome (if closed) */
  outcome?: TradeOutcome;
  /** Profit/Loss amount */
  pnl?: CurrencyAmount;
  /** Profit/Loss percentage */
  pnlPercentage?: Percentage;
  /** Risk amount at entry */
  riskAmount: CurrencyAmount;
  /** R-multiple (profit as multiple of initial risk) */
  rMultiple?: number;
  /** Stop loss price */
  stopLoss: number;
  /** Take profit price */
  takeProfit?: number;
  /** Exit reason */
  exitReason?: string;
  /** Strategy or setup name */
  strategy?: string;
  /** Optional: Trade duration in milliseconds */
  duration?: number;
  /** Optional: Maximum favorable excursion (best price reached) */
  mfe?: number;
  /** Optional: Maximum adverse excursion (worst price reached) */
  mae?: number;
  /** Optional: Commission/fees paid */
  commission?: CurrencyAmount;
  /** Optional: Tags for categorization */
  tags?: string[];
  /** Optional: Trade notes */
  notes?: string;
}

/**
 * Trade bucket for grouping trades by criteria
 */
export interface TradeBucket {
  /** Bucket identifier */
  id: string;
  /** Bucket name/label */
  name: string;
  /** Criteria for this bucket (e.g., "Win Trades", "Loss Trades", "Strategy A") */
  criteria: string;
  /** Trades in this bucket */
  trades: Trade[];
  /** Number of trades */
  count: number;
  /** Total P&L for bucket */
  totalPnl: CurrencyAmount;
  /** Average P&L per trade */
  averagePnl: CurrencyAmount;
  /** Win rate */
  winRate: Percentage;
  /** Average win */
  averageWin?: CurrencyAmount;
  /** Average loss */
  averageLoss?: CurrencyAmount;
  /** Largest win */
  largestWin?: CurrencyAmount;
  /** Largest loss */
  largestLoss?: CurrencyAmount;
}

/**
 * Distribution of trades across a dimension
 */
export interface TradeDistribution {
  /** Dimension name (e.g., "Day of Week", "Hour of Day", "Hold Time") */
  dimension: string;
  /** Distribution buckets */
  buckets: {
    /** Label for this bucket (e.g., "Monday", "09:00-10:00") */
    label: string;
    /** Number of trades */
    count: number;
    /** Win rate for this bucket */
    winRate: Percentage;
    /** Average P&L for this bucket */
    averagePnl: CurrencyAmount;
  }[];
}

/**
 * Comprehensive system performance metrics
 */
export interface SystemMetrics {
  /** Total number of trades */
  totalTrades: number;
  /** Number of winning trades */
  winningTrades: number;
  /** Number of losing trades */
  losingTrades: number;
  /** Number of breakeven trades */
  breakevenTrades: number;
  /** Win rate percentage */
  winRate: Percentage;
  /** Total profit/loss */
  totalPnl: CurrencyAmount;
  /** Average profit/loss per trade */
  averagePnl: CurrencyAmount;
  /** Profit factor (gross profit / gross loss) */
  profitFactor: number;
  /** Expectancy (average expected profit per trade) */
  expectancy: CurrencyAmount;
  /** Average winning trade */
  averageWin: CurrencyAmount;
  /** Average losing trade */
  averageLoss: CurrencyAmount;
  /** Largest winning trade */
  largestWin: CurrencyAmount;
  /** Largest losing trade */
  largestLoss: CurrencyAmount;
  /** Average risk/reward ratio */
  averageRiskReward: RiskRewardRatio;
  /** Maximum consecutive wins */
  maxConsecutiveWins: number;
  /** Maximum consecutive losses */
  maxConsecutiveLosses: number;
  /** Average trade duration (in milliseconds) */
  averageTradeDuration?: number;
  /** Total commissions paid */
  totalCommissions?: CurrencyAmount;
  /** Net profit (total P&L - commissions) */
  netProfit?: CurrencyAmount;
  /** Return on investment */
  roi?: Percentage;
  /** Maximum drawdown */
  maxDrawdown?: CurrencyAmount;
  /** Maximum drawdown percentage */
  maxDrawdownPercentage?: Percentage;
  /** Sharpe ratio (if applicable) */
  sharpeRatio?: number;
  /** Date range of analysis */
  dateRange: DateRange;
}

/**
 * Drawdown information
 */
export interface Drawdown {
  /** Start date of drawdown */
  startDate: string;
  /** End date of drawdown (recovery date) */
  endDate?: string;
  /** Drawdown amount */
  amount: CurrencyAmount;
  /** Drawdown percentage */
  percentage: Percentage;
  /** Duration in milliseconds */
  duration?: number;
  /** Whether drawdown has recovered */
  recovered: boolean;
}

/**
 * Equity curve point
 */
export interface EquityPoint {
  /** Timestamp */
  timestamp: string;
  /** Cumulative P&L */
  equity: CurrencyAmount;
  /** Trade number */
  tradeNumber: number;
}

/**
 * System analyzer input
 */
export interface SystemAnalyzerInput {
  /** Array of trades to analyze */
  trades: Trade[];
  /** Initial capital for ROI calculation */
  initialCapital?: CurrencyAmount;
  /** Optional: Custom date range for analysis */
  dateRange?: DateRange;
  /** Optional: Strategies to include (empty = all) */
  strategies?: string[];
  /** Optional: Symbols to include (empty = all) */
  symbols?: string[];
}

/**
 * Complete system analysis result
 */
export interface SystemAnalysisResult {
  /** Overall system metrics */
  metrics: SystemMetrics;
  /** Trade distribution analysis */
  distributions: TradeDistribution[];
  /** Drawdown history */
  drawdowns: Drawdown[];
  /** Equity curve */
  equityCurve: EquityPoint[];
  /** Trade buckets by strategy */
  strategyBuckets?: TradeBucket[];
  /** Trade buckets by symbol */
  symbolBuckets?: TradeBucket[];
  /** Monthly performance breakdown */
  monthlyPerformance?: {
    month: string;
    pnl: CurrencyAmount;
    winRate: Percentage;
    tradeCount: number;
  }[];
}

// ============================================================================
// Export helpers for type guards
// ============================================================================

/**
 * Type guard to check if a value is a CurrencyAmount
 */
export function isCurrencyAmount(value: unknown): value is CurrencyAmount {
  return (
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    'currency' in value &&
    typeof (value as CurrencyAmount).value === 'number' &&
    typeof (value as CurrencyAmount).currency === 'string'
  );
}

/**
 * Type guard to check if a value is a Percentage
 */
export function isPercentage(value: unknown): value is Percentage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    typeof (value as Percentage).value === 'number'
  );
}

/**
 * Type guard to check if a trade is closed
 */
export function isClosedTrade(trade: Trade): trade is Trade & { 
  exitDate: string; 
  exitPrice: number; 
  outcome: TradeOutcome;
  pnl: CurrencyAmount;
} {
  return (
    trade.status === 'closed' &&
    trade.exitDate !== undefined &&
    trade.exitPrice !== undefined &&
    trade.outcome !== undefined &&
    trade.pnl !== undefined
  );
}

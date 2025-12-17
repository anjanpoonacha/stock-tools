// Stock data types for formula results

export interface Stock {
	symbol: string; // e.g. "NSE:RELIANCE"
	name: string; // e.g. "Reliance Industries"
	sector?: string; // e.g. "Energy" (optional if MIO doesn't provide)
	industry?: string; // e.g. "Oil & Gas"
	price?: number;
	priceChange?: number; // percentage
}

export interface FormulaResultsResponse {
	success: boolean;
	formulaName: string;
	stocks: Stock[];
	error?: string;
}

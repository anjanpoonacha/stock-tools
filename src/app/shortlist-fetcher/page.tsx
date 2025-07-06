import ShortlistFetcherClient from './ShortlistFetcherClient';

export const metadata = {
	title: 'Stock Format Converter – MarketInOut & TradingView',
	description: 'Convert stock symbol lists between MarketInOut and TradingView formats. Mobile-first, fast, and easy.',
};

export default function Page() {
	return <ShortlistFetcherClient />;
}

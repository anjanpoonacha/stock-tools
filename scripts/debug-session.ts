import { SessionResolver } from '../src/lib/SessionResolver.js';

async function main() {
	const sessionInfo = await SessionResolver.getLatestSession('tradingview');
	
	if (!sessionInfo) {
		console.log('No session found');
		return;
	}
	
	console.log('Full session data:');
	console.log(JSON.stringify(sessionInfo.sessionData, null, 2));
}

main().catch(console.error);

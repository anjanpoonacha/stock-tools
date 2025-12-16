import { getPlatformSession } from '../src/lib/sessionStore.js';

async function main() {
  const sessionId = process.argv[2];
  
  if (!sessionId) {
    console.error('Usage: tsx scripts/get-session.ts <session-id>');
    process.exit(1);
  }
  
  try {
    const session = await getPlatformSession(sessionId, 'marketinout');
    
    if (!session) {
      console.error('Session not found');
      process.exit(1);
    }
    
    console.log('Found session data');
    const keys = Object.keys(session).filter(k => k !== 'userEmail' && k !== 'userPassword' && k !== 'sessionId');
    
    if (keys.length > 0) {
      console.log(`export MIO_SESSION_KEY="${keys[0]}"`);
      console.log(`export MIO_SESSION_VALUE="${session[keys[0]]}"`);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

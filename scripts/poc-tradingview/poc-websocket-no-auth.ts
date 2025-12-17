#!/usr/bin/env tsx
/**
 * Test WebSocket without auth (anonymous access)
 * Some symbols might work without authentication
 */

import WebSocket from 'ws';
import { parseFrame, encodeMessage, generateSessionId, createSymbolSpec, createMessage } from './poc-protocol.js';

const chartSession = generateSessionId('cs_');
const wsUrl = `wss://prodata.tradingview.com/socket.io/websocket?from=chart/S09yY40x/&date=${new Date().toISOString()}&type=chart`;

console.log('🧪 Testing WebSocket WITHOUT JWT authentication\n');
console.log('Chart Session:', chartSession);
console.log('Connecting to:', wsUrl.substring(0, 80) + '...\n');

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  console.log('✅ Connected\n');
  
  // Skip auth, go straight to data requests
  setTimeout(() => {
    console.log('📤 Creating chart session (no auth)');
    ws.send(encodeMessage(createMessage('chart_create_session', [chartSession, ''])));
  }, 500);
  
  setTimeout(() => {
    console.log('📤 Setting locale');
    ws.send(encodeMessage(createMessage('set_locale', ['en', 'US'])));
  }, 700);
  
  setTimeout(() => {
    const symbolSpec = createSymbolSpec('NSE:JUNIPER');
    console.log('📤 Resolving symbol:', symbolSpec);
    ws.send(encodeMessage(createMessage('resolve_symbol', [chartSession, 'sds_sym_1', symbolSpec])));
  }, 1000);
  
  setTimeout(() => {
    console.log('📤 Creating series (requesting 10 bars)');
    ws.send(encodeMessage(createMessage('create_series', [chartSession, 'sds_1', 's1', 'sds_sym_1', '1D', 10, ''])));
  }, 1500);
  
  setTimeout(() => {
    console.log('\n⏰ Closing connection...');
    ws.close();
  }, 8000);
});

ws.on('message', (data) => {
  const { messages } = parseFrame(data.toString());
  messages.forEach(msg => {
    if ('session_id' in msg) {
      console.log('📥 Handshake:', (msg as any).session_id);
    } else if (msg.m === 'protocol_error') {
      console.log('❌ Protocol Error:', msg.p);
    } else if (msg.m === 'symbol_resolved') {
      console.log('✅ Symbol Resolved!');
      const [, , metadata] = msg.p as any;
      console.log('   Name:', metadata.name);
      console.log('   Exchange:', metadata.exchange);
      console.log('   Currency:', metadata.currency_code);
    } else if (msg.m === 'du') {
      console.log('📊 Data Update received!');
      const [, dataObj] = msg.p as any;
      for (const [studyId, study] of Object.entries(dataObj)) {
        if ((study as any).st) {
          console.log(`   Bars in study ${studyId}:`, (study as any).st.length);
          (study as any).st.slice(0, 3).forEach((bar: any, idx: number) => {
            const [time, o, h, l, c, v] = bar.v;
            console.log(`     ${idx + 1}. ${new Date(time * 1000).toISOString().split('T')[0]}: O=${o} H=${h} L=${l} C=${c}`);
          });
        }
      }
    } else if (msg.m) {
      console.log('📥 Message:', msg.m);
    }
  });
});

ws.on('error', (err) => console.error('❌ Error:', err.message));
ws.on('close', () => console.log('\n🔌 Connection closed'));

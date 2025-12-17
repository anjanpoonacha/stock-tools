#!/usr/bin/env tsx
// Extract user ID from JWT token response

const jwtResponse = '{"token":"eyJhbGciOiJSUzUxMiIsImtpZCI6InFGM2kiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJ0dl9jaGFydCIsImlhdCI6MTc2NTk1ODQwMCwiZXhwIjoxNzY2ODI2MDAwLCJ0eXBlIjoib3duZXIiLCJsYXlvdXRJZCI6IlMwOXlZNDB4Iiwib3duZXJJZCI6NjM2NDI5MjgsInNoYXJlZCI6ZmFsc2V9.HQ3Ly49DlYkYJ3_v3hgmQ5GURCx9_S0ANtgH-QHzzXlXBTvmltNd-k8wqc6XXdbx96rA3_aVPvKuqX5JBum3YDsbDUMdrssXy7qrDtbsajY9l5HbcsMwGYzMmyTFS43RQsLBev7Qq4dfpFLwndRhT9WylKRw9-2yTateYgHOg5oOVWvkmz6pkA8jHHT1b0C8UtfYvMMR5sW4bkceKkueAiSY8jVDE2cMzoadHAg3583ga8ikV1znIolY57d9ZFZUhyDRso90rMvgGXHjWLk_ORhYr4J09mUnjDbnkdT8C_ydnODMQJn-u44m8XLJsTOu6OV__hriYi93xBZxASXptA"}';

const data = JSON.parse(jwtResponse);
const jwt = data.token;
const parts = jwt.split('.');
const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

console.log('✅ JWT Token obtained and decoded!\n');
console.log('Payload:', JSON.stringify(payload, null, 2));
console.log('\n🎯 OWNER ID (User ID):', payload.ownerId);
console.log('📊 Chart ID:', payload.layoutId);
console.log('⏰ Expires:', new Date(payload.exp * 1000).toISOString());

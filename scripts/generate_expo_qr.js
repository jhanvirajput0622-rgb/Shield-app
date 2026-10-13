// scripts/generate_expo_qr.js
// Usage: node scripts/generate_expo_qr.js <expo-url>
// Generates a QR code PNG (expo_qr.png) for the given Expo development URL.
// If no URL is provided, the script will prompt for input.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const outputFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'expo_qr.png');

async function generate(url) {
  try {
    await QRCode.toFile(outputFile, url, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
    console.log(`✅ QR code saved to ${outputFile}`);
  } catch (err) {
    console.error('❌ Failed to generate QR code:', err);
    process.exit(1);
  }
}

function promptInput(query) {
  return new Promise((resolve) => {
    const rl = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

(async () => {
  let url = process.argv[2];
  if (!url) {
    url = await promptInput('Enter Expo development URL (e.g., exp://192.168.x.x:8081): ');
  }
  if (!url) {
    console.error('❌ No URL provided. Exiting.');
    process.exit(1);
  }
  await generate(url);
})();

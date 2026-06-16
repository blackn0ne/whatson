import fs from 'fs';
import path from 'path';
import readline from 'readline';
import AdmZip from 'adm-zip';

const API_URL = "https://license.saasfy.uk/api/validate-and-download";
const TARGET_DIR = path.join(process.cwd(), 'components');
const TEMP_ZIP_FILE = path.join(process.cwd(), 'components.zip');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

async function main() {
  console.clear();
  console.log("\x1b[1m Component Installation\x1b[0m");

  const licenseKey = await askQuestion("\x1b[33m Enter your license key:\x1b[0m ");

  if (!licenseKey || licenseKey.trim().length < 5) {
    console.error("\n\x1b[31m Error: Invalid license key.\x1b[0m");
    process.exit(1);
  }

  console.log(`\n\x1b[34m Validating license and downloading files...\x1b[0m`);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ licenseKey: licenseKey.trim() }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(TEMP_ZIP_FILE, buffer);

    console.log("\x1b[32m Download complete. Extracting...\x1b[0m");

    if (!fs.existsSync(TARGET_DIR)) {
      fs.mkdirSync(TARGET_DIR, { recursive: true });
    }

    const zip = new AdmZip(TEMP_ZIP_FILE);
    zip.extractAllTo(TARGET_DIR, true);

    console.log(`\x1b[32m Components installed successfully.\x1b[0m`);

    fs.unlinkSync(TEMP_ZIP_FILE);

  } catch (error: any) {
    console.error(`\n\x1b[31m Installation failed:\x1b[0m`);
    console.error(`\x1b[31m  ${error.message}\x1b[0m\n`);

    if (fs.existsSync(TEMP_ZIP_FILE)) {
      fs.unlinkSync(TEMP_ZIP_FILE);
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
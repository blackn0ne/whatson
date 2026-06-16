import { exec } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { promisify } from 'node:util';
import readline from 'node:readline';
import crypto from 'node:crypto';
import path from 'node:path';
import os from 'node:os';

const execAsync = promisify(exec);

function question(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

async function getSetupMode(): Promise<'local' | 'production'> {
  console.log('Step 1: Setup Mode');
  const answer = await question(
    'Is this setup for Local Development (L) or Production Deployment (P)? (L/P): '
  );
  return answer.toLowerCase() === 'p' ? 'production' : 'local';
}

async function getPostgresURL(): Promise<string> {
  console.log('Step 2: Database Setup');

  const dbChoice = await question(
    'Do you want to use a local Docker Postgres (L) or a remote Postgres URL (R)? (L/R): '
  );

  if (dbChoice.toLowerCase() === 'l') {
    console.log('Setting up local Postgres with Docker...');
    await setupLocalPostgres();
    return 'postgres://postgres:postgres@localhost:54322/postgres';
  } else {
    console.log(
      'You can find Postgres databases at: https://vercel.com/marketplace?category=databases'
    );
    return await question('Enter your Connection String (Postgres URL): ');
  }
}

async function setupLocalPostgres() {
  console.log('Checking for Docker...');
  try {
    await execAsync('docker --version');
    console.log('Docker is installed.');
  } catch (error) {
    console.error(
      'Docker is not installed. Please install Docker and try again.'
    );
    console.log(
      'To install Docker, visit: https://docs.docker.com/get-docker/'
    );
    process.exit(1);
  }

  console.log('Creating docker-compose.yml...');
  const dockerComposeContent = `
services:
  postgres:
    image: postgres:16.4-alpine
    container_name: next_saas_starter_postgres
    environment:
      POSTGRES_DB: postgres
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "54322:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
`;

  await fs.writeFile(
    path.join(process.cwd(), 'docker-compose.yml'),
    dockerComposeContent
  );
  console.log('docker-compose.yml created.');

  console.log('Starting Docker container...');
  try {
    await execAsync('docker compose up -d');
    console.log('Docker container started successfully.');
  } catch (error) {
    console.error(
      'Failed to start Docker container. Please check your Docker installation.'
    );
    process.exit(1);
  }
}

function generateSecret(label: string): string {
  console.log(`Generating random ${label}...`);
  return crypto.randomBytes(32).toString('hex');
}

async function getBaseUrl(mode: 'local' | 'production'): Promise<{ baseUrl: string; nextWebhookUrl: string }> {
  console.log('Step 4: Application URL');

  const defaultUrl = mode === 'local' ? 'http://localhost:3000' : '';
  const promptText = mode === 'local'
    ? 'Enter your website URL (Press Enter for "http://localhost:3000"): '
    : 'Enter your Production Website URL (e.g., https://myapp.com): ';

  const input = await question(promptText);

  const rawUrl = input.trim() || defaultUrl;

  if (!rawUrl) {
    console.error('Base URL is required for production.');
    process.exit(1);
  }

  const baseUrl = rawUrl.replace(/\/$/, '');
  const nextWebhookUrl = `${baseUrl}/api/webhook/evolution`;

  return { baseUrl, nextWebhookUrl };
}

async function getResendApiKey(): Promise<string> {
  console.log('Step 5: Resend Configuration (Email)');
  console.log('Get your API Key at: https://resend.com/api-keys');
  return await question('Enter your Resend API Key: ');
}

async function getPusherConfig(): Promise<Record<string, string>> {
  console.log('Step 6: Pusher Configuration (Realtime)');
  console.log('Find your credentials at: https://dashboard.pusher.com/');
  console.log('Go to: Channels -> Your App -> App Keys');

  const appId = await question('Enter App ID: ');
  const key = await question('Enter Key: ');
  const secret = await question('Enter Secret: ');
  const cluster = await question('Enter Cluster: ');

  return {
    PUSHER_APP_ID: appId,
    NEXT_PUBLIC_PUSHER_KEY: key,
    PUSHER_SECRET: secret,
    NEXT_PUBLIC_PUSHER_CLUSTER: cluster,
  };
}

async function getEvolutionConfig(): Promise<Record<string, string>> {
  console.log('Step 7: Evolution API Configuration (WhatsApp)');

  const apiUrlInput = await question('Enter Evolution API URL (e.g., https://api.yoursite.com): ');
  const apiUrl = apiUrlInput.trim().replace(/\/$/, '');

  const apiKey = await question('Enter Global API Key (Authentication): ');
  const webhookToken = await question('Enter Webhook Token (Secret): ');

  return {
    EVOLUTION_API_URL: apiUrl,
    NEXT_PUBLIC_EVOLUTION_WEBHOOK_URL: apiUrl,
    AUTHENTICATION_API_KEY: apiKey,
    NEXT_PUBLIC_EVOLUTION_WEBHOOK_TOKEN: webhookToken,
  };
}

async function writeEnvFile(envVars: Record<string, string>) {
  console.log('Step 8: Saving Configuration');
  const envContent = Object.entries(envVars)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  await fs.writeFile(path.join(process.cwd(), '.env'), envContent);
  console.log('.env file created successfully.');
}

async function main() {
  const mode = await getSetupMode();

  const POSTGRES_URL = await getPostgresURL();

  console.log('Step 3: Security');
  const AUTH_SECRET = generateSecret('AUTH_SECRET');
  const CRON_SECRET = generateSecret('CRON_SECRET');

  const { baseUrl: BASE_URL, nextWebhookUrl: NEXT_PUBLIC_WEBHOOK_URL } = await getBaseUrl(mode);
  const RESEND_API_KEY = await getResendApiKey();
  const pusherConfig = await getPusherConfig();
  const evolutionConfig = await getEvolutionConfig();

  await writeEnvFile({
    POSTGRES_URL,
    AUTH_SECRET,
    CRON_SECRET,
    BASE_URL,
    NEXT_PUBLIC_WEBHOOK_URL,
    RESEND_API_KEY,
    RESEND_FROM_EMAIL: 'onboarding@resend.dev',
    SUPPORT_EMAIL: '',
    ...pusherConfig,
    ...evolutionConfig,
  });

  console.log('');
  console.log('🎉 Setup completed successfully!');
  console.log('');
  console.log('📌 Next steps:');
  console.log('   1. Run migrations: pnpm db:migrate');
  console.log('   2. Start the app: pnpm dev');
  console.log('   3. Go to Admin Panel → Payment Gateways to configure Stripe, Razorpay or Offline payments');
  console.log('');
}

main().catch(console.error);

import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export async function connectDb() {
  try {
    await prisma.$connect();
    console.log('[+] Core Database connected successfully.');
  } catch (error) {
    console.error('[!] Core Database connection failed:', error);
    process.exit(1);
  }
}

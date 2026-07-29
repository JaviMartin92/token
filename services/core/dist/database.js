"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.connectDb = connectDb;
const client_1 = require("@prisma/client");
exports.prisma = new client_1.PrismaClient();
async function connectDb() {
    try {
        await exports.prisma.$connect();
        console.log('[+] Core Database connected successfully.');
    }
    catch (error) {
        console.error('[!] Core Database connection failed:', error);
        process.exit(1);
    }
}
//# sourceMappingURL=database.js.map
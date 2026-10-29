"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonFilePersistentStorage = exports.InMemoryLedgerStorage = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * In-memory storage driver for transient or test execution
 */
class InMemoryLedgerStorage {
    auditLog = new Map();
    blockHeaders = new Map();
    checkpoints = new Map();
    async hasKey(key) {
        return this.auditLog.has(key);
    }
    async saveTransaction(idempotencyKey, payload) {
        this.auditLog.set(idempotencyKey, payload);
    }
    async getTransaction(idempotencyKey) {
        return this.auditLog.get(idempotencyKey);
    }
    async getAllTransactions() {
        return new Map(this.auditLog);
    }
    async markTransactionsOrphaned(keys) {
        for (const k of keys) {
            const tx = this.auditLog.get(k);
            if (tx) {
                tx.status = 'ORPHANED';
                this.auditLog.set(k, tx);
            }
        }
    }
    async saveBlockHeader(blockNumber, header) {
        this.blockHeaders.set(blockNumber, header);
    }
    async getBlockHeader(blockNumber) {
        return this.blockHeaders.get(blockNumber);
    }
    async getAllBlockHeaders() {
        return new Map(this.blockHeaders);
    }
    async saveCheckpoint(key, value) {
        this.checkpoints.set(key, value);
    }
    async getCheckpoint(key) {
        return this.checkpoints.get(key);
    }
}
exports.InMemoryLedgerStorage = InMemoryLedgerStorage;
/**
 * Production-ready Atomic Persistent JSON Store with journaled disk synchronization
 */
class JsonFilePersistentStorage {
    filePath;
    checkpointsPath;
    headersPath;
    cache = new Map();
    blockHeaders = new Map();
    checkpoints = new Map();
    constructor(storageDir = './.data') {
        if (!fs.existsSync(storageDir)) {
            fs.mkdirSync(storageDir, { recursive: true });
        }
        this.filePath = path.join(storageDir, 'ledger_journal.json');
        this.checkpointsPath = path.join(storageDir, 'indexer_checkpoints.json');
        this.headersPath = path.join(storageDir, 'block_headers.json');
        this.loadFromDisk();
    }
    loadFromDisk() {
        try {
            if (fs.existsSync(this.filePath)) {
                const raw = fs.readFileSync(this.filePath, 'utf-8');
                const parsed = JSON.parse(raw);
                for (const [k, v] of Object.entries(parsed)) {
                    this.cache.set(k, v);
                }
            }
            if (fs.existsSync(this.checkpointsPath)) {
                const raw = fs.readFileSync(this.checkpointsPath, 'utf-8');
                const parsed = JSON.parse(raw);
                for (const [k, v] of Object.entries(parsed)) {
                    this.checkpoints.set(k, String(v));
                }
            }
            if (fs.existsSync(this.headersPath)) {
                const raw = fs.readFileSync(this.headersPath, 'utf-8');
                const parsed = JSON.parse(raw);
                for (const [k, v] of Object.entries(parsed)) {
                    this.blockHeaders.set(k, v);
                }
            }
        }
        catch (err) {
            console.warn('[JsonFilePersistentStorage] Failed to read existing journal from disk, starting fresh:', err);
        }
    }
    persistToDisk() {
        try {
            const obj = {};
            for (const [k, v] of this.cache.entries()) {
                obj[k] = v;
            }
            const tmpPath = `${this.filePath}.tmp`;
            fs.writeFileSync(tmpPath, JSON.stringify(obj, null, 2), 'utf-8');
            fs.renameSync(tmpPath, this.filePath);
        }
        catch (err) {
            console.error('[JsonFilePersistentStorage] Error persisting ledger journal to disk:', err);
        }
    }
    persistHeadersToDisk() {
        try {
            const obj = {};
            for (const [k, v] of this.blockHeaders.entries()) {
                obj[k] = v;
            }
            const tmpPath = `${this.headersPath}.tmp`;
            fs.writeFileSync(tmpPath, JSON.stringify(obj, null, 2), 'utf-8');
            fs.renameSync(tmpPath, this.headersPath);
        }
        catch (err) {
            console.error('[JsonFilePersistentStorage] Error persisting headers to disk:', err);
        }
    }
    persistCheckpointsToDisk() {
        try {
            const obj = {};
            for (const [k, v] of this.checkpoints.entries()) {
                obj[k] = v;
            }
            const tmpPath = `${this.checkpointsPath}.tmp`;
            fs.writeFileSync(tmpPath, JSON.stringify(obj, null, 2), 'utf-8');
            fs.renameSync(tmpPath, this.checkpointsPath);
        }
        catch (err) {
            console.error('[JsonFilePersistentStorage] Error persisting checkpoints to disk:', err);
        }
    }
    async hasKey(key) {
        return this.cache.has(key);
    }
    async saveTransaction(idempotencyKey, payload) {
        this.cache.set(idempotencyKey, payload);
        this.persistToDisk();
    }
    async getTransaction(idempotencyKey) {
        return this.cache.get(idempotencyKey);
    }
    async getAllTransactions() {
        return new Map(this.cache);
    }
    async markTransactionsOrphaned(keys) {
        for (const k of keys) {
            const tx = this.cache.get(k);
            if (tx) {
                tx.status = 'ORPHANED';
                this.cache.set(k, tx);
            }
        }
        this.persistToDisk();
    }
    async saveBlockHeader(blockNumber, header) {
        this.blockHeaders.set(blockNumber, header);
        this.persistHeadersToDisk();
    }
    async getBlockHeader(blockNumber) {
        return this.blockHeaders.get(blockNumber);
    }
    async getAllBlockHeaders() {
        return new Map(this.blockHeaders);
    }
    async saveCheckpoint(key, value) {
        this.checkpoints.set(key, value);
        this.persistCheckpointsToDisk();
    }
    async getCheckpoint(key) {
        return this.checkpoints.get(key);
    }
}
exports.JsonFilePersistentStorage = JsonFilePersistentStorage;
//# sourceMappingURL=PersistentLedgerStorage.js.map
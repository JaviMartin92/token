import { PublicClient } from 'viem';
import type { Address } from 'viem';
import { ContractRegistry } from './ContractRegistry';
export declare const ADMIN_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
export declare const ALICE_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
export declare const BOB_KEY = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
export declare const EVE_KEY = "0x47e179ec3464565e38874f239296a6e821e21e680fb301dd607147430d8cf4e0";
export declare const ERC20_ABI: readonly [{
    readonly name: "mint";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "to";
        readonly type: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "approve";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "spender";
        readonly type: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
    }];
}, {
    readonly name: "balanceOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "account";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
}, {
    readonly name: "allowance";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "owner";
        readonly type: "address";
    }, {
        readonly name: "spender";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
}, {
    readonly name: "transfer";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "to";
        readonly type: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
    }];
}];
export interface InvariantResult {
    name: string;
    passed: boolean;
    metric: string;
    error?: string;
}
export declare class DeFiAgentEnv {
    publicClient: PublicClient;
    adminClient: any;
    contracts: Record<string, Address>;
    registry: ContractRegistry;
    constructor(rpcUrl?: string);
    getWalletClient(privateKey: `0x${string}`): any;
    setupInitialLiquidity(agentAddress: Address, initialUsdc?: number, initialAlpha?: number): Promise<void>;
    createSnapshot(): Promise<string>;
    revertSnapshot(snapshotId: string): Promise<boolean>;
    getAgentState(agentAddress: Address): Promise<{
        agentAddress: `0x${string}`;
        blockNumber: number;
        balances: {
            USDC: number;
            ALPHA: number;
            ETH: number;
            stALPHA: number;
            earnedYieldUSDC: number;
            positionBondsCount: number;
        };
        protocol: {
            navPerShareUSD: number;
            circuitBreakerFrozen: boolean;
            totalLoansCreated: number;
        };
    }>;
    formatArgsForAbi(inputs: Array<{
        name: string;
        type: string;
    }>, rawArgs: any, funcName?: string): any[];
    executeArbitraryCall(client: any, contractKey: string, functionName: string, args?: any, value?: bigint): Promise<{
        success: boolean;
        txHash?: string;
        result?: any;
        error?: string;
    }>;
    warpTime(seconds: number): Promise<void>;
    executeAction(client: any, action: string, params: Record<string, any>): Promise<{
        success: boolean;
        txHash?: string;
        message: string;
    }>;
    checkInvariants(): Promise<InvariantResult[]>;
}

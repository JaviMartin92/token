import type { Address } from 'viem';
export interface FunctionSpec {
    name: string;
    stateMutability: string;
    inputs: Array<{
        name: string;
        type: string;
    }>;
    outputs?: Array<{
        name: string;
        type: string;
    }>;
}
export declare class ContractRegistry {
    private contracts;
    private abis;
    private abiMapping;
    constructor();
    private loadAllAbis;
    private findFileRecursive;
    getContractAddress(name: string): Address;
    getContractAbi(name: string): any[];
    getCallableFunctions(name: string): FunctionSpec[];
    getAllWriteFunctionNames(contractName: string): string[];
    getProtocolManifest(filterContracts?: string[]): Record<string, any>;
}

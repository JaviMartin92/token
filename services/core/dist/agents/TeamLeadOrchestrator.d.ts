import { OllamaClient } from './OllamaClient';
export interface ActionLog {
    agent: string;
    round: number;
    contract: string;
    function: string;
    args: any[];
    hypothesis: string;
    result: 'SUCCESS' | 'REVERT';
    detail: string;
    timestamp: string;
}
export interface TacticalDirective {
    focusAreas: string[];
    bannedFunctions: string[];
    guidance: string;
    overallScore: number;
}
export declare class TeamLeadOrchestrator {
    private ollama;
    private actionHistory;
    private currentDirective;
    private contractCoverage;
    private reportPath;
    constructor(ollama: OllamaClient);
    recordAction(action: ActionLog): void;
    getSaturatedFunctions(agentName?: string): string[];
    isRepetitiveAction(agentName: string, contract: string, functionName: string): {
        repetitive: boolean;
        reason?: string;
    };
    filterManifest(rawManifest: Record<string, any>, agentName: string): Record<string, any>;
    getUncoveredFunctions(assignedContracts: string[], registry: any): Array<{
        contract: string;
        function: string;
    }>;
    evaluateAndIssueDirective(allContracts: string[]): Promise<TacticalDirective>;
    getCurrentDirective(): TacticalDirective;
    saveLiveMarkdownReport(): void;
}

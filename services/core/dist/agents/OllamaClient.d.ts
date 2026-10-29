export interface AgentDecision {
    action: string;
    parameters: Record<string, any>;
    reasoning: string;
    confidence: number;
}
export interface OpenEndedDecision {
    contract: string;
    function: string;
    args: any[];
    hypothesis: string;
    confidence: number;
}
export declare class OllamaClient {
    private endpoint;
    private model;
    constructor(endpoint?: string, model?: string);
    decideAction(params: {
        personaName: string;
        personaRole: string;
        personaObjective: string;
        currentState: Record<string, any>;
        availableActions: Array<{
            name: string;
            description: string;
            parameters: Record<string, any>;
        }>;
    }): Promise<AgentDecision>;
    decideOpenEndedAction(params: {
        personaName: string;
        personaRole: string;
        personaObjective: string;
        currentState: Record<string, any>;
        protocolManifest: Record<string, any>;
        recentHistory: Array<{
            action: string;
            result: string;
        }>;
    }): Promise<OpenEndedDecision>;
}

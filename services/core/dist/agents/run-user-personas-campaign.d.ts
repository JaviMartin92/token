export interface PersonaLog {
    round: number;
    personaName: string;
    role: string;
    action: string;
    parameters: Record<string, any>;
    reasoning: string;
    success: boolean;
    message: string;
    navBefore: number;
    navAfter: number;
    balanceChange: string;
    timestamp: string;
}

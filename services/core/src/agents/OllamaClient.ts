export interface AgentDecision {
  action: string;
  parameters: Record<string, any>;
  reasoning: string;
  confidence: number;
}

export class OllamaClient {
  private endpoint: string;
  private model: string;

  constructor(endpoint: string = 'http://127.0.0.1:11434', model: string = 'qwen3:8b') {
    this.endpoint = endpoint;
    this.model = model;
  }

  async decideAction(params: {
    personaName: string;
    personaRole: string;
    personaObjective: string;
    currentState: Record<string, any>;
    availableActions: Array<{
      name: string;
      description: string;
      parameters: Record<string, string>;
    }>;
  }): Promise<AgentDecision> {
    const systemPrompt = `Eres "${params.personaName}", un agente autónomo de pruebas especial en un protocolo DeFi descentralizado.
Rol: ${params.personaRole}
Objetivo: ${params.personaObjective}

Analiza el estado actual de la blockchain y del protocolo, y selecciona UNA acción concreta a ejecutar entre las disponibles.
DEBES responder EXCLUSIVAMENTE con un objeto JSON válido (sin markdown adicional, sin comillas invertidas, solo JSON) con la siguiente estructura exacta:
{
  "action": "<nombre de la acción seleccionada>",
  "parameters": { <parámetros de la acción con valores numéricos o strings según corresponda> },
  "reasoning": "<explicación breve y técnica de por qué tomas esta decisión según tu objetivo>",
  "confidence": <número entre 0.0 y 1.0>
}`;

    const userPrompt = `ESTADO ACTUAL DE LA BLOCKCHAIN / PROTOCOLO:
${JSON.stringify(params.currentState, null, 2)}

ACCIONES DISPONIBLES:
${JSON.stringify(params.availableActions, null, 2)}

¿Cuál es tu siguiente acción? Responde únicamente con el JSON:`;

    const response = await fetch(`${this.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        format: 'json',
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 1500
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Error en Ollama API (${response.status}): ${await response.text()}`);
    }

    const data = await response.json();
    let rawContent = data.message?.content || data.response || '';

    // Clean potential markdown code blocks if the model outputs ```json ... ```
    rawContent = rawContent.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();

    // If the model wrapped in <think> tags, extract the final JSON outside of thinking
    if (rawContent.includes('</think>')) {
      rawContent = rawContent.split('</think>').pop()?.trim() || rawContent;
    }

    try {
      const parsed = JSON.parse(rawContent);
      return {
        action: parsed.action,
        parameters: parsed.parameters || {},
        reasoning: parsed.reasoning || 'Sin razonamiento provisto',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9
      };
    } catch (err) {
      // Fallback regex extraction if JSON is slightly irregular
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            action: parsed.action,
            parameters: parsed.parameters || {},
            reasoning: parsed.reasoning || rawContent,
            confidence: parsed.confidence || 0.8
          };
        } catch {}
      }
      throw new Error(`No se pudo parsear el JSON de la respuesta de Qwen3: ${rawContent}`);
    }
  }
}

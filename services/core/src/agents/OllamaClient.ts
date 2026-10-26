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
          temperature: 0.2,
          num_ctx: 8192,
          num_predict: 1500
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Error en Ollama API (${response.status}): ${await response.text()}`);
    }

    const data = await response.json();
    let rawContent = data.message?.content || data.response || '';
    rawContent = rawContent.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();

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

  async decideOpenEndedAction(params: {
    personaName: string;
    personaRole: string;
    personaObjective: string;
    currentState: Record<string, any>;
    protocolManifest: Record<string, any>;
    recentHistory: Array<{ action: string; result: string }>;
  }): Promise<OpenEndedDecision> {
    const systemPrompt = `Eres "${params.personaName}", un agente hacker y auditor DeFi autónomo.
Rol: ${params.personaRole}
Objetivo: ${params.personaObjective}

Elige CUALQUIER contrato y función del protocolo para interactuar o avanzar el tiempo.
DEBES responder directamente con el objeto JSON sin etiquetas <think> ni texto previo, empezando directamente con { y cerrando con }:
{
  "contract": "<nombre del contrato exacto o 'BLOCKCHAIN'>",
  "function": "<nombre exacto de la función o 'warp_time'>",
  "args": [ <lista de argumentos ordenados requeridos> ],
  "hypothesis": "<explicación breve de lo que buscas probar o verificar>"
}`;

    const userPrompt = `HISTORIAL RECIENTE:
${JSON.stringify(params.recentHistory, null, 2)}

ESTADO DE TU CUENTA Y BLOCKCHAIN:
${JSON.stringify(params.currentState, null, 2)}

CATÁLOGO DE CONTRATOS Y MÉTODOS DISPONIBLES:
${JSON.stringify(params.protocolManifest, null, 2)}

Selecciona tu siguiente acción exploratoria y responde únicamente con el JSON:`;

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
          temperature: 0.5,
          repeat_penalty: 1.15,
          top_p: 0.9,
          num_ctx: 8192,
          num_predict: 500
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Error en Ollama API (${response.status}): ${await response.text()}`);
    }

    const data = await response.json();
    let rawContent = data.message?.content || data.response || '';
    rawContent = rawContent.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();

    if (rawContent.includes('</think>')) {
      rawContent = rawContent.split('</think>').pop()?.trim() || rawContent;
    }

    const manifestKeys = Object.keys(params.protocolManifest || {});
    const fallbackContract = manifestKeys.length > 0 ? manifestKeys[Math.floor(Math.random() * manifestKeys.length)] : 'TREASURY';
    const fallbackFuncList = params.protocolManifest[fallbackContract]?.functions || ['deposit'];
    const fallbackFunc = (fallbackFuncList[Math.floor(Math.random() * fallbackFuncList.length)] || 'deposit').split('(')[0];

    if (!rawContent) {
      return {
        contract: fallbackContract,
        function: fallbackFunc,
        args: [],
        hypothesis: `Exploración dinámica asignada sobre ${fallbackContract}::${fallbackFunc}`,
        confidence: 0.8
      };
    }

    try {
      const parsed = JSON.parse(rawContent);
      return {
        contract: parsed.contract || parsed.contractName || parsed.target || fallbackContract,
        function: parsed.function || parsed.functionName || parsed.method || fallbackFunc,
        args: Array.isArray(parsed.args) ? parsed.args : Object.values(parsed.args || {}),
        hypothesis: parsed.hypothesis || parsed.reasoning || parsed.thought || 'Hipótesis exploratoria',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9
      };
    } catch (err) {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            contract: parsed.contract || parsed.contractName || fallbackContract,
            function: parsed.function || parsed.functionName || fallbackFunc,
            args: Array.isArray(parsed.args) ? parsed.args : Object.values(parsed.args || {}),
            hypothesis: parsed.hypothesis || parsed.reasoning || rawContent,
            confidence: parsed.confidence || 0.8
          };
        } catch {}
      }
      return {
        contract: fallbackContract,
        function: fallbackFunc,
        args: [],
        hypothesis: `Fallback sintáctico sobre ${fallbackContract}::${fallbackFunc}`,
        confidence: 0.7
      };
    }
  }
}

import fs from 'fs';
import path from 'path';
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
  overallScore: number; // 0 a 100 evaluando la calidad y diversidad del equipo
}

export class TeamLeadOrchestrator {
  private ollama: OllamaClient;
  private actionHistory: ActionLog[] = [];
  private currentDirective: TacticalDirective;
  private contractCoverage: Map<string, Set<string>> = new Map();
  private reportPath: string;

  constructor(ollama: OllamaClient) {
    this.ollama = ollama;
    this.reportPath = path.resolve(__dirname, 'reports/campaign_audit_report.md');
    this.currentDirective = {
      focusAreas: ['TREASURY', 'STAKING', 'P2P_MARKET', 'DISCOUNT_BUYBACK_ENGINE'],
      bannedFunctions: [],
      guidance: 'Fase de reconocimiento inicial. Explorar funcionalidades básicas y verificar permisos de acceso.',
      overallScore: 85
    };
  }

  recordAction(action: ActionLog) {
    this.actionHistory.push(action);

    if (!this.contractCoverage.has(action.contract)) {
      this.contractCoverage.set(action.contract, new Set());
    }
    this.contractCoverage.get(action.contract)!.add(action.function);

    this.saveLiveMarkdownReport();
  }

  getSaturatedFunctions(agentName?: string): string[] {
    const saturated = new Set<string>();

    // 1. Funciones baneadas explícitamente por la directiva de Orion
    for (const b of this.currentDirective.bannedFunctions) {
      saturated.add(b.toLowerCase());
    }

    // 2. Funciones ejecutadas >= 2 veces en las últimas 10 acciones del equipo
    const recent = this.actionHistory.slice(-10);
    const counts = new Map<string, number>();
    for (const a of recent) {
      const key = `${a.contract.toLowerCase()}::${a.function.toLowerCase()}`;
      counts.set(key, (counts.get(key) || 0) + 1);
      if (counts.get(key)! >= 2) {
        saturated.add(key);
      }
    }

    // 3. La función inmediatamente anterior ejecutada por el mismo agente
    if (agentName) {
      const agentRecent = this.actionHistory.filter(a => a.agent === agentName).slice(-1);
      if (agentRecent.length > 0) {
        saturated.add(`${agentRecent[0].contract.toLowerCase()}::${agentRecent[0].function.toLowerCase()}`);
      }
    }

    return Array.from(saturated);
  }

  isRepetitiveAction(agentName: string, contract: string, functionName: string): { repetitive: boolean; reason?: string } {
    const key = `${contract.toLowerCase()}::${functionName.toLowerCase()}`;
    const saturated = this.getSaturatedFunctions(agentName);

    if (saturated.includes(key)) {
      return {
        repetitive: true,
        reason: `La función ${contract}::${functionName} está saturada o restringida por Orion. El Jefe de Equipo exige explorar funciones o contratos diferentes.`
      };
    }

    return { repetitive: false };
  }

  filterManifest(rawManifest: Record<string, any>, agentName: string): Record<string, any> {
    const saturated = this.getSaturatedFunctions(agentName);
    const filtered: Record<string, any> = {};

    for (const [contract, data] of Object.entries(rawManifest)) {
      const remainingFunctions = (data.functions || []).filter((fStr: string) => {
        const funcName = fStr.split('(')[0].trim().toLowerCase();
        const key = `${contract.toLowerCase()}::${funcName}`;
        return !saturated.includes(key);
      });

      if (remainingFunctions.length > 0) {
        filtered[contract] = {
          address: data.address,
          functions: remainingFunctions
        };
      }
    }

    // Si todos los contratos fueron filtrados por saturación extrema, devolver el manifiesto original con al menos una opción
    if (Object.keys(filtered).length === 0) {
      return rawManifest;
    }

    return filtered;
  }

  getUncoveredFunctions(assignedContracts: string[], registry: any): Array<{ contract: string; function: string }> {
    const uncovered: Array<{ contract: string; function: string }> = [];

    for (const contract of assignedContracts) {
      if (contract === 'BLOCKCHAIN') {
        if (!this.contractCoverage.has('BLOCKCHAIN') || !this.contractCoverage.get('BLOCKCHAIN')!.has('warp_time')) {
          uncovered.push({ contract: 'BLOCKCHAIN', function: 'warp_time' });
        }
        continue;
      }

      const allWriteFuncs: string[] = registry.getAllWriteFunctionNames ? registry.getAllWriteFunctionNames(contract) : [];
      const covered = this.contractCoverage.get(contract) || new Set();

      for (const fn of allWriteFuncs) {
        if (!covered.has(fn)) {
          uncovered.push({ contract, function: fn });
        }
      }
    }

    return uncovered;
  }

  async evaluateAndIssueDirective(allContracts: string[]): Promise<TacticalDirective> {
    const totalCalls = this.actionHistory.length;
    const coveredContracts = Array.from(this.contractCoverage.keys());
    const uncoveredContracts = allContracts.filter(c => !this.contractCoverage.has(c));

    const recentCalls = this.actionHistory.slice(-10).map(a => `${a.agent} -> ${a.contract}::${a.function} (${a.result})`);

    const prompt = `Actúa como "Orion", el Jefe de Equipo y Arquitecto Jefe de Seguridad en una campaña de auditoría de contratos inteligentes DeFi.
Tu trabajo es SUPERVISAR a los 3 agentes tester bajo tu mando (Cipher, Apex y Echo) y asegurar que:
1. No se queden estancados haciendo siempre las mismas pruebas (anti-repetición).
2. Exploren contratos no probados o funciones de alto riesgo financiero/lógico.
3. Se coordinen de forma agresiva para buscar vulnerabilidades reales.

MÉTRICAS ACTUALES:
- Total de acciones ejecutadas: ${totalCalls}
- Contratos probados hasta ahora: ${coveredContracts.join(', ') || 'Ninguno'}
- Contratos pendientes de prueba: ${uncoveredContracts.join(', ')}
- Últimas 10 acciones del equipo:
${recentCalls.join('\n') || 'Ninguna'}

Evalúa el desempeño de tu equipo y emite una nueva Directiva Táctica respondiendo ÚNICAMENTE con un JSON con este formato exacto:
{
  "overallScore": <puntuación de 0 a 100 de la diversidad y calidad del equipo>,
  "focusAreas": [ <lista de 2 o 3 contratos prioritarios para las próximas rondas> ],
  "bannedFunctions": [ <lista de funciones que consideres sobre-probadas en formato 'CONTRATO::funcion'> ],
  "guidance": "<instrucción estratégica clara y exigente a los agentes sobre qué vectores explorar a continuación>"
}`;

    try {
      const response = await fetch('http://127.0.0.1:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen3:8b',
          messages: [{ role: 'system', content: prompt }],
          format: 'json',
          stream: false,
          options: { temperature: 0.2, num_predict: 800 }
        })
      });

      if (response.ok) {
        const data = await response.json();
        let content = data.message?.content || data.response || '{}';
        if (content.includes('</think>')) {
          content = content.split('</think>').pop()?.trim() || content;
        }
        const parsed = JSON.parse(content);
        this.currentDirective = {
          focusAreas: Array.isArray(parsed.focusAreas) && parsed.focusAreas.length > 0 ? parsed.focusAreas : ['P2P_MARKET', 'DISCOUNT_BUYBACK_ENGINE'],
          bannedFunctions: Array.isArray(parsed.bannedFunctions) ? parsed.bannedFunctions : [],
          guidance: parsed.guidance || 'Intensificar pruebas en los contratos con menor cobertura.',
          overallScore: typeof parsed.overallScore === 'number' ? parsed.overallScore : 80
        };
      }
    } catch (e: any) {
      console.warn(`[TeamLead] Usando directiva de respaldo: ${e.message}`);
    }

    return this.currentDirective;
  }

  getCurrentDirective(): TacticalDirective {
    return this.currentDirective;
  }

  saveLiveMarkdownReport() {
    const total = this.actionHistory.length;
    const reverts = this.actionHistory.filter(a => a.result === 'REVERT').length;
    const successes = this.actionHistory.filter(a => a.result === 'SUCCESS').length;

    let md = `# 🛡️ Informe de Campaña de Seguridad Autónoma (Qwen3:8B)
*Generado en tiempo real por el Jefe de Equipo (Orion)*

---

## 📊 Métricas Generales
* **Total de Acciones Ejecutadas:** ${total}
* **Ataques / Mutaciones Legítimas Exitosas:** ${successes}
* **Intentos de Ataque Defendidos por el Protocolo (Reverts):** ${reverts}
* **Puntuación de Eficacia y Diversidad del Equipo:** **${this.currentDirective.overallScore}/100**

---

## 🎯 Directiva Táctica Actual del Jefe de Equipo
> **Guía Estratégica:** ${this.currentDirective.guidance}

* **Contratos Prioritarios Asignados:** \`${this.currentDirective.focusAreas.join('`, `')}\`
* **Funciones Restringidas Temporalmente (Sobre-probadas):** ${this.currentDirective.bannedFunctions.length > 0 ? `\`${this.currentDirective.bannedFunctions.join('`, `')}\`` : '*Ninguna*'}

---

## 🗺️ Matriz de Cobertura de Contratos
| Contrato | Funciones Probadas | Estado |
| :--- | :--- | :--- |
`;

    for (const [contract, funcs] of this.contractCoverage.entries()) {
      md += `| **${contract}** | \`${Array.from(funcs).join('`, `')}\` | ✅ Auditado (${funcs.size} métodos) |\n`;
    }

    md += `\n---\n\n## 📜 Registro de Acciones Recientes (Últimas 15)\n`;
    md += `| Ronda | Agente | Acción | Hipótesis / Razón | Resultado |\n`;
    md += `| :---: | :--- | :--- | :--- | :---: |\n`;

    const recent = this.actionHistory.slice(-15).reverse();
    for (const a of recent) {
      const resIcon = a.result === 'SUCCESS' ? '✅ Éxito' : '🛡️ Defendido (Revert)';
      md += `| R${a.round} | **${a.agent}** | \`${a.contract}::${a.function}\` | *"${a.hypothesis.slice(0, 80)}..."* | ${resIcon} |\n`;
    }

    try {
      fs.writeFileSync(this.reportPath, md, 'utf8');
    } catch {}
  }
}

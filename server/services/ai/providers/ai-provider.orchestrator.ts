import {
  AIProviderMode,
  AIProviderName,
  AIProviderResult,
  AIRequestOptions,
  IAIProvider,
} from '../../../types/ai-provider.types';
import { aiConfig } from '../../../config/ai.config';
import { GroqProvider } from './groq.provider';
import { CerebrasProvider } from './cerebras.provider';
import { GeminiProvider } from './gemini.provider';

export class AIProviderOrchestrator {
  private providers: Map<AIProviderName, IAIProvider> = new Map();
  private mode: AIProviderMode;

  constructor() {
    this.mode = aiConfig.mode;
    this.initializeDefaultProviders();
  }

  private initializeDefaultProviders(): void {
    this.providers.set('groq', new GroqProvider());
    this.providers.set('cerebras', new CerebrasProvider());
    this.providers.set('gemini', new GeminiProvider());
  }

  public getMode(): AIProviderMode {
    return this.mode;
  }

  public setMode(mode: AIProviderMode): void {
    this.mode = mode;
  }

  public getProvider(name: AIProviderName): IAIProvider | undefined {
    return this.providers.get(name);
  }

  public registerProvider(name: AIProviderName, provider: IAIProvider): void {
    this.providers.set(name, provider);
  }

  public resetProviders(): void {
    this.initializeDefaultProviders();
  }

  public resetCooldowns(): void {
    for (const provider of this.providers.values()) {
      provider.clearCooldown();
    }
  }

  /**
   * Resolves the ordered fallback list of providers based on the active mode.
   * Priority: Groq -> Cerebras -> Gemini
   */
  private getCandidateQueue(): AIProviderName[] {
    switch (this.mode) {
      case 'deterministic':
        return [];
      case 'groq':
        return ['groq'];
      case 'cerebras':
        return ['cerebras'];
      case 'gemini':
        return ['gemini'];
      case 'auto':
      default:
        return ['groq', 'cerebras', 'gemini'];
    }
  }

  /**
   * Executes a structured JSON LLM request with quota-efficient fallback:
   * Groq -> Cerebras -> Gemini -> Deterministic (returns null).
   *
   * GUARANTEES:
   * 1. Single call on success (never double-calls when a provider succeeds).
   * 2. Missing provider keys are skipped safely.
   * 3. 429 quota exhaustion puts provider on cooldown to prevent repeated quota hits.
   * 4. Returns null if all providers fail/exhausted, allowing deterministic fallback.
   */
  async generateJson<T = any>(
    prompt: string,
    options?: AIRequestOptions
  ): Promise<AIProviderResult<T> | null> {
    const queue = this.getCandidateQueue();
    const op = options?.operationName || 'operation';

    if (queue.length === 0) {
      // Deterministic mode explicitly enabled or empty queue
      return null;
    }

    for (let i = 0; i < queue.length; i++) {
      const providerName = queue[i];
      const provider = this.providers.get(providerName);

      if (!provider) {
        continue;
      }

      // Check if provider is configured with an API key
      if (!provider.isConfigured()) {
        continue;
      }

      // Check if provider is currently in cooldown due to a recent 429 / quota error
      if (!provider.isAvailable()) {
        const nextProviderName = i + 1 < queue.length ? queue[i + 1] : 'deterministic';
        console.warn(`[AI] ${this.formatProviderName(providerName)} ${op} skipped: quota exhausted (cooldown active). Falling back to ${this.formatProviderName(nextProviderName)}`);
        continue;
      }

      // Attempt generation with current provider
      try {
        const data = await provider.generateJson<T>(prompt, options);
        if (data !== null && data !== undefined) {
          // Success! Return immediately without touching subsequent providers (NO DOUBLE CALL)
          const model = options?.overrideModel || this.getModelNameForProvider(providerName);
          return {
            data,
            provider: providerName,
            model,
          };
        }

        // Provider returned null without throwing
        const nextProviderName = i + 1 < queue.length ? queue[i + 1] : 'deterministic';
        console.warn(`[AI] ${this.formatProviderName(providerName)} ${op} returned null. Falling back to ${this.formatProviderName(nextProviderName)}`);
      } catch (err: any) {
        const statusStr = err.status ? `${err.status}` : (err.message || 'error');
        const nextProviderName = i + 1 < queue.length ? queue[i + 1] : 'deterministic';

        console.warn(`[AI] ${this.formatProviderName(providerName)} ${op} failed: ${statusStr}`);
        console.warn(`[AI] Falling back to ${this.formatProviderName(nextProviderName)}`);
      }
    }

    // All available providers failed or were exhausted
    return null;
  }

  private formatProviderName(name: string): string {
    if (name === 'groq') return 'Groq';
    if (name === 'cerebras') return 'Cerebras';
    if (name === 'gemini') return 'Gemini';
    if (name === 'deterministic') return 'Deterministic';
    return name;
  }

  private getModelNameForProvider(name: AIProviderName): string {
    switch (name) {
      case 'groq':
        return aiConfig.groq.model;
      case 'cerebras':
        return aiConfig.cerebras.model;
      case 'gemini':
        return aiConfig.gemini.model;
    }
  }
}

export const aiProviderOrchestrator = new AIProviderOrchestrator();

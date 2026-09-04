export type AIProviderName = 'groq' | 'cerebras' | 'gemini';

export type AIProviderMode = 'auto' | 'deterministic' | 'groq' | 'cerebras' | 'gemini';

export interface AIRequestOptions {
  systemInstruction?: string;
  responseSchema?: any; // Structured schema for Gemini or providers supporting json schema
  temperature?: number;
  timeoutMs?: number;
  operationName?: string; // e.g. 'intent extraction', 'product ranking', 'sales reasoning', 'description generation'
  overrideModel?: string;
}

export interface AIProviderResult<T = any> {
  data: T;
  provider: AIProviderName;
  model: string;
}

export interface IAIProvider {
  readonly name: AIProviderName;
  isConfigured(): boolean;
  isAvailable(): boolean;
  generateJson<T = any>(prompt: string, options?: AIRequestOptions): Promise<T | null>;
  markQuotaExhausted(retryAfterSeconds?: number): void;
  clearCooldown(): void;
}

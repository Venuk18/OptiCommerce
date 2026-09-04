import { AIProviderName, AIRequestOptions, IAIProvider } from '../../../types/ai-provider.types';
import { aiConfig } from '../../../config/ai.config';

export abstract class BaseAIProvider implements IAIProvider {
  abstract readonly name: AIProviderName;
  protected quotaExhaustedUntil: number = 0;

  abstract isConfigured(): boolean;

  isAvailable(): boolean {
    if (!this.isConfigured()) {
      return false;
    }
    if (this.isInCooldown()) {
      return false;
    }
    return true;
  }

  isInCooldown(): boolean {
    return Date.now() < this.quotaExhaustedUntil;
  }

  getCooldownRemainingSeconds(): number {
    const remainingMs = this.quotaExhaustedUntil - Date.now();
    return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
  }

  markQuotaExhausted(retryAfterSeconds?: number): void {
    const durationMs = retryAfterSeconds && retryAfterSeconds > 0
      ? retryAfterSeconds * 1000
      : aiConfig.cooldownMs;
    this.quotaExhaustedUntil = Date.now() + durationMs;
  }

  clearCooldown(): void {
    this.quotaExhaustedUntil = 0;
  }

  abstract generateJson<T = any>(prompt: string, options?: AIRequestOptions): Promise<T | null>;

  /**
   * Safely parses JSON from LLM responses, stripping code fences or stray markdown wrappers.
   */
  protected extractJson<T = any>(rawText: string): T | null {
    if (!rawText || typeof rawText !== 'string') {
      return null;
    }
    const trimmed = rawText.trim();
    if (!trimmed) {
      return null;
    }

    // 1. Direct parse attempt
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      // Continue to cleanup strategies
    }

    // 2. Strip ```json ... ``` or ``` ... ``` code blocks
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenceMatch && fenceMatch[1]) {
      try {
        return JSON.parse(fenceMatch[1].trim()) as T;
      } catch {
        // Continue
      }
    }

    // 3. Find outer boundaries for JSON object { ... }
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as T;
      } catch {
        // Continue
      }
    }

    // 4. Find outer boundaries for JSON array [ ... ]
    const firstBracket = trimmed.indexOf('[');
    const lastBracket = trimmed.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      try {
        return JSON.parse(trimmed.slice(firstBracket, lastBracket + 1)) as T;
      } catch {
        // Continue
      }
    }

    return null;
  }

  /**
   * Checks if an error indicates rate limiting, 429, or quota exhaustion.
   */
  protected isQuotaOrRateLimitError(err: any): boolean {
    if (!err) return false;
    const status = err.status || err.statusCode || err.response?.status;
    if (status === 429 || status === 402) return true;

    const message = (err.message || String(err)).toLowerCase();
    return (
      message.includes('429') ||
      message.includes('402') ||
      message.includes('quota') ||
      message.includes('rate limit') ||
      message.includes('payment required') ||
      message.includes('billing') ||
      message.includes('resource_exhausted') ||
      message.includes('too many requests') ||
      message.includes('exceeded your current quota')
    );
  }
}

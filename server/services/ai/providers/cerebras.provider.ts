import { BaseAIProvider } from './base.provider';
import { AIProviderName, AIRequestOptions } from '../../../types/ai-provider.types';
import { aiConfig } from '../../../config/ai.config';

export class CerebrasProvider extends BaseAIProvider {
  readonly name: AIProviderName = 'cerebras';

  isConfigured(): boolean {
    const key = aiConfig.cerebras.apiKey;
    return Boolean(key && key.trim() !== '' && key !== 'MY_CEREBRAS_API_KEY');
  }

  async generateJson<T = any>(prompt: string, options?: AIRequestOptions): Promise<T | null> {
    if (!this.isConfigured()) {
      return null;
    }

    const op = options?.operationName || 'request';
    const timeoutMs = options?.timeoutMs || aiConfig.cerebras.timeoutMs;
    const model = options?.overrideModel || aiConfig.cerebras.model;
    const endpoint = aiConfig.cerebras.endpoint || 'https://api.cerebras.ai/v1/chat/completions';

    const systemInstruction = (options?.systemInstruction || 'You are an expert commerce AI assistant. Output valid JSON.')
      .concat('\nYou must respond with strictly valid JSON.');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${aiConfig.cerebras.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          temperature: options?.temperature ?? 0.1,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const status = response.status;
        let errorBody = '';
        try {
          errorBody = await response.text();
        } catch {
          // ignore
        }

        if (status === 429 || status === 402) {
          const retryAfterHeader = response.headers.get('retry-after');
          const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
          this.markQuotaExhausted(retryAfterSec);
        }

        if (status === 404 && model !== 'gpt-oss-120b' && (errorBody.includes('model_not_found') || errorBody.includes('does not exist') || errorBody.includes('not found'))) {
          return this.generateJson<T>(prompt, {
            ...options,
            overrideModel: 'gpt-oss-120b',
          });
        }

        const error: any = new Error(`Cerebras API returned HTTP ${status}: ${errorBody.slice(0, 200)}`);
        error.status = status;
        throw error;
      }

      const json = await response.json();
      const rawContent = json?.choices?.[0]?.message?.content;
      if (!rawContent) {
        throw new Error('Cerebras returned empty response content');
      }

      const parsed = this.extractJson<T>(rawContent);
      if (!parsed) {
        throw new Error('Failed to parse JSON from Cerebras response content');
      }

      return parsed;
    } catch (err: any) {
      if (this.isQuotaOrRateLimitError(err)) {
        this.markQuotaExhausted();
      }
      throw err;
    }
  }
}

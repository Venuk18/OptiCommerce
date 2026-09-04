import { BaseAIProvider } from './base.provider';
import { AIProviderName, AIRequestOptions } from '../../../types/ai-provider.types';
import { aiConfig } from '../../../config/ai.config';
import { getGeminiClient } from '../gemini.client';

export class GeminiProvider extends BaseAIProvider {
  readonly name: AIProviderName = 'gemini';

  isConfigured(): boolean {
    const key = aiConfig.gemini.apiKey || process.env.GEMINI_API_KEY;
    if (!key || key.trim() === '' || key === 'MY_GEMINI_API_KEY') {
      return false;
    }
    return Boolean(getGeminiClient());
  }

  async generateJson<T = any>(prompt: string, options?: AIRequestOptions): Promise<T | null> {
    if (!this.isConfigured()) {
      return null;
    }

    const aiClient = getGeminiClient();
    if (!aiClient) {
      return null;
    }

    const timeoutMs = options?.timeoutMs || aiConfig.gemini.timeoutMs;
    const model = options?.overrideModel || aiConfig.gemini.model;

    try {
      const config: any = {
        responseMimeType: 'application/json',
      };
      if (options?.systemInstruction) {
        config.systemInstruction = options.systemInstruction;
      }
      if (options?.responseSchema) {
        config.responseSchema = options.responseSchema;
      }
      if (typeof options?.temperature === 'number') {
        config.temperature = options.temperature;
      }

      const generatePromise = aiClient.models.generateContent({
        model,
        contents: prompt,
        config,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API call timed out')), timeoutMs)
      );

      const response = await Promise.race([generatePromise, timeoutPromise]);
      const rawText = response?.text;

      if (!rawText) {
        throw new Error('Gemini returned empty text response');
      }

      const parsed = this.extractJson<T>(rawText);
      if (!parsed) {
        throw new Error('Failed to parse JSON from Gemini response');
      }

      return parsed;
    } catch (err: any) {
      const errMsg = String(err?.message || '');
      const is404 = err?.status === 404 || errMsg.includes('404') || errMsg.includes('NOT_FOUND') || errMsg.includes('no longer available');

      if (is404 && model !== 'gemini-3.6-flash') {
        return this.generateJson<T>(prompt, {
          ...options,
          overrideModel: 'gemini-3.6-flash',
        });
      }

      if (this.isQuotaOrRateLimitError(err)) {
        this.markQuotaExhausted();
      }
      throw err;
    }
  }
}

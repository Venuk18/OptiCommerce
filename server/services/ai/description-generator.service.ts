import { Type } from '@google/genai';
import { getGeminiClient } from './gemini.client';
import { aiProviderOrchestrator } from './providers/ai-provider.orchestrator';

export interface GenerateDescriptionInput {
  name: string;
  category: string;
  brand?: string | null;
  tags?: string[];
  features?: string[];
  specifications?: Record<string, any>;
}

export interface GenerateDescriptionResult {
  description: string;
  source: 'ai' | 'fallback';
}

const GEMINI_TIMEOUT_MS = 6000;

export class DescriptionGeneratorService {
  /**
   * Deterministic fallback that synthesizes a clean, informative description
   * using strictly the provided factual attributes without inventing anything.
   */
  public generateDeterministicFallback(input: GenerateDescriptionInput): string {
    const brandPrefix = input.brand?.trim() ? `${input.brand.trim()} ` : '';
    const name = input.name.trim();
    const category = input.category.trim();

    const cleanFeatures = (input.features || [])
      .map((f) => (typeof f === 'string' ? f.trim() : ''))
      .filter((f) => f.length > 0);

    const cleanTags = (input.tags || [])
      .map((t) => (typeof t === 'string' ? t.trim() : ''))
      .filter((t) => t.length > 0);

    const specParts: string[] = [];
    if (input.specifications && typeof input.specifications === 'object' && !Array.isArray(input.specifications)) {
      for (const [key, val] of Object.entries(input.specifications)) {
        if (val !== undefined && val !== null && String(val).trim()) {
          specParts.push(`${key}: ${String(val).trim()}`);
        }
      }
    }

    let description = `${brandPrefix}${name} is a ${category} product`;

    if (cleanFeatures.length > 0) {
      description += ` featuring ${cleanFeatures.slice(0, 3).join(', ')}.`;
    } else if (cleanTags.length > 0) {
      description += ` designed for ${cleanTags.slice(0, 4).join(', ')}.`;
    } else {
      description += ` designed for reliable everyday performance.`;
    }

    const extra: string[] = [];
    if (cleanFeatures.length > 3) {
      extra.push(`Key highlights include ${cleanFeatures.slice(3, 6).join(', ')}.`);
    }
    if (specParts.length > 0) {
      extra.push(`Key specifications: ${specParts.slice(0, 4).join(', ')}.`);
    }

    if (extra.length > 0) {
      description += ` ${extra.join(' ')}`;
    }

    return description.trim();
  }

  /**
   * Generate an AI-assisted product description.
   * Executes strictly ONE Gemini call with a 6000ms timeout.
   * If Gemini fails or is unavailable, falls back deterministically.
   * Never throws unhandled errors that break product creation.
   */
  public async generateDescription(
    input: GenerateDescriptionInput,
    aiClientOverride?: ReturnType<typeof getGeminiClient> | any
  ): Promise<GenerateDescriptionResult> {
    const fallback = this.generateDeterministicFallback(input);

    const sanitizedAttributes: Record<string, any> = {
      name: input.name.trim(),
      category: input.category.trim(),
    };
    if (input.brand?.trim()) sanitizedAttributes.brand = input.brand.trim();
    if (Array.isArray(input.tags) && input.tags.length > 0) {
      sanitizedAttributes.tags = input.tags.slice(0, 10);
    }
    if (Array.isArray(input.features) && input.features.length > 0) {
      sanitizedAttributes.features = input.features.slice(0, 10);
    }
    if (input.specifications && typeof input.specifications === 'object') {
      sanitizedAttributes.specifications = input.specifications;
    }

    const prompt = `PRODUCT ATTRIBUTES:
${JSON.stringify(sanitizedAttributes, null, 2)}

INSTRUCTIONS:
Write a concise, factual, and engaging ecommerce product description (2-3 sentences, 40-80 words).
Focus on product utility and key features based strictly on the provided attributes.
Do not invent unsupported technical specifications, prices, discounts, certifications, or warranty claims.
Return strictly structured JSON:
{
  "description": "..."
}`;

    const systemInstruction =
      'You are an expert ecommerce product copywriter. Output strictly structured JSON according to the schema. Generate a concise, factual description based ONLY on the provided attributes. NEVER invent unsupported specifications or claims. NEVER mention cost price, margins, or discounts.';

    // If explicit override provided (e.g. In unit tests), use it directly
    if (aiClientOverride !== undefined) {
      if (!aiClientOverride) {
        return { description: fallback, source: 'fallback' };
      }
      try {
        const aiCallPromise = aiClientOverride.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                description: {
                  type: Type.STRING,
                  description: 'A concise, factual ecommerce product description.',
                },
              },
              required: ['description'],
            },
          },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Gemini description generation timed out')), GEMINI_TIMEOUT_MS)
        );

        const response = await Promise.race([aiCallPromise, timeoutPromise]);
        const responseText = response.text;

        if (!responseText) {
          return { description: fallback, source: 'fallback' };
        }

        const parsed = JSON.parse(responseText);
        if (parsed && typeof parsed.description === 'string' && parsed.description.trim().length > 0) {
          return { description: parsed.description.trim(), source: 'ai' };
        }

        return { description: fallback, source: 'fallback' };
      } catch (err) {
        console.warn('[DescriptionGeneratorService] AI override call failed, using deterministic fallback:', (err as any)?.message);
        return { description: fallback, source: 'fallback' };
      }
    }

    // Default: Multi-provider quota-efficient orchestrator (Groq -> Cerebras -> Gemini)
    try {
      const result = await aiProviderOrchestrator.generateJson<{ description: string }>(prompt, {
        operationName: 'description generation',
        systemInstruction,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: {
              type: Type.STRING,
              description: 'A concise, factual ecommerce product description.',
            },
          },
          required: ['description'],
        },
        timeoutMs: GEMINI_TIMEOUT_MS,
      });

      if (result?.data && typeof result.data.description === 'string' && result.data.description.trim().length > 0) {
        return { description: result.data.description.trim(), source: 'ai' };
      }

      return { description: fallback, source: 'fallback' };
    } catch (err) {
      console.warn('[DescriptionGeneratorService] AI provider call failed, using deterministic fallback:', (err as any)?.message);
      return { description: fallback, source: 'fallback' };
    }
  }
}

export const descriptionGeneratorService = new DescriptionGeneratorService();

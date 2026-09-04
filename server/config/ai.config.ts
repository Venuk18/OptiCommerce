import dotenv from 'dotenv';
import { AIProviderMode } from '../types/ai-provider.types';

dotenv.config();

export interface AIProviderConfig {
  apiKey: string;
  model: string;
  endpoint?: string;
  timeoutMs: number;
}

export interface AIConfig {
  mode: AIProviderMode;
  providerOrder: readonly ['groq', 'cerebras', 'gemini'];
  groq: AIProviderConfig;
  cerebras: AIProviderConfig;
  gemini: AIProviderConfig;
  cooldownMs: number;
}

function getProviderMode(): AIProviderMode {
  const envMode = (process.env.AI_PROVIDER_MODE || 'auto').trim().toLowerCase();
  if (['deterministic', 'groq', 'cerebras', 'gemini', 'auto'].includes(envMode)) {
    return envMode as AIProviderMode;
  }
  return 'auto';
}

export const aiConfig: AIConfig = {
  mode: getProviderMode(),
  providerOrder: ['groq', 'cerebras', 'gemini'] as const,
  groq: {
    apiKey: process.env.GROQ_API_KEY?.trim() || '',
    model: process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-120b',
    endpoint: process.env.GROQ_ENDPOINT?.trim() || 'https://api.groq.com/openai/v1/chat/completions',
    timeoutMs: 6000,
  },
  cerebras: {
    apiKey: process.env.CEREBRAS_API_KEY?.trim() || '',
    model: process.env.CEREBRAS_MODEL?.trim() || 'gpt-oss-120b',
    endpoint: process.env.CEREBRAS_ENDPOINT?.trim() || 'https://api.cerebras.ai/v1/chat/completions',
    timeoutMs: 6000,
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY?.trim() || '',
    model: process.env.GEMINI_MODEL?.trim() || 'gemini-3.6-flash',
    timeoutMs: 6000,
  },
  cooldownMs: 60000, // 60s cooldown on 429 quota exhaustion
};

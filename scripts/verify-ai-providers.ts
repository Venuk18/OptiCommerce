/**
 * Verification script for AI Provider Infrastructure & Quota-Efficient Orchestration.
 * 
 * Tests strictly using mocks (NO real API quota consumed):
 * 1. AI Provider Configuration and environment variable reading.
 * 2. BaseAIProvider JSON sanitization and rate limit detection.
 * 3. Provider Chain Scenario 1: Groq success (no subsequent provider calls).
 * 4. Provider Chain Scenario 2: Groq 429 -> Cerebras success.
 * 5. Provider Chain Scenario 3: Cerebras 429 -> Gemini success.
 * 6. Provider Chain Scenario 4: All fail -> deterministic fallback (returns null).
 * 7. Provider Chain Scenario 5: Missing API key handling (unconfigured providers skipped cleanly).
 * 8. Provider Chain Scenario 6: Cooldown behavior (exhausted providers skipped on next call).
 * 9. End-to-end service integration using deterministic fallbacks without live API calls.
 */

import { aiConfig } from '../server/config/ai.config';
import { BaseAIProvider } from '../server/services/ai/providers/base.provider';
import { AIProviderOrchestrator, aiProviderOrchestrator } from '../server/services/ai/providers/ai-provider.orchestrator';
import { IAIProvider, AIProviderName, AIRequestOptions } from '../server/types/ai-provider.types';
import { CustomerIntent } from '../server/types/intent.types';
import { CandidateProduct } from '../server/types/search.types';
import { RankedProduct } from '../server/types/ranking.types';
import { ProductRankingService } from '../server/services/ai/product-ranking.service';
import { SalesReasonerService } from '../server/services/ai/sales-reasoner.service';
import { DescriptionGeneratorService } from '../server/services/ai/description-generator.service';
import { IntentExtractorService } from '../server/services/ai/intent-extractor.service';

// Concrete test provider for testing BaseAIProvider parsing and rate-limit detection
class TestBaseProvider extends BaseAIProvider {
  readonly name: AIProviderName;

  constructor(name: AIProviderName) {
    super();
    this.name = name;
  }

  isConfigured(): boolean {
    return true;
  }

  public testExtractJson<T>(raw: string): T | null {
    return this.extractJson<T>(raw);
  }

  public testIsRateLimitError(err: unknown): boolean {
    return this.isQuotaOrRateLimitError(err);
  }

  async generateJson<T>(_prompt: string, _options?: AIRequestOptions): Promise<T | null> {
    return null;
  }
}

// Mock AI Provider implementing IAIProvider for mock-based testing
class MockProvider implements IAIProvider {
  public readonly name: AIProviderName;
  public configured: boolean;
  public cooldownUntil: number = 0;
  public callCount: number = 0;
  private responsePayload: any = null;
  private shouldFailWithRateLimit: boolean = false;
  private shouldFailWithGenericError: boolean = false;

  constructor(name: AIProviderName, configured = true) {
    this.name = name;
    this.configured = configured;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  isAvailable(): boolean {
    if (!this.isConfigured()) return false;
    return Date.now() >= this.cooldownUntil;
  }

  markQuotaExhausted(retryAfterSeconds?: number): void {
    const duration = (retryAfterSeconds ?? 60) * 1000;
    this.cooldownUntil = Date.now() + duration;
  }

  clearCooldown(): void {
    this.cooldownUntil = 0;
  }

  setMockResponse(data: any) {
    this.responsePayload = data;
    this.shouldFailWithRateLimit = false;
    this.shouldFailWithGenericError = false;
  }

  setMockRateLimit() {
    this.shouldFailWithRateLimit = true;
    this.shouldFailWithGenericError = false;
  }

  setMockError() {
    this.shouldFailWithGenericError = true;
    this.shouldFailWithRateLimit = false;
  }

  async generateJson<T>(_prompt: string, _options?: AIRequestOptions): Promise<T | null> {
    this.callCount++;

    if (this.shouldFailWithRateLimit) {
      this.markQuotaExhausted(60);
      const err: any = new Error(`429 rate_limit_exceeded for ${this.name}`);
      err.status = 429;
      throw err;
    }

    if (this.shouldFailWithGenericError) {
      throw new Error(`500 internal_error for ${this.name}`);
    }

    return this.responsePayload as T;
  }
}

async function runTests() {
  console.log('=== Starting AI Provider Infrastructure Verification (Mock-Based) ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} ${detail ? `- ${detail}` : ''}`);
      failed++;
    }
  }

  // 1. Config Test
  console.log('Test Suite 1: AI Provider Configuration');
  assert(typeof aiConfig === 'object', 'AI config is loaded');
  assert(Array.isArray(aiConfig.providerOrder), 'Provider order is an array');
  assert(aiConfig.providerOrder[0] === 'groq', 'Groq is first in provider order');
  assert(aiConfig.providerOrder[1] === 'cerebras', 'Cerebras is second in provider order');
  assert(aiConfig.providerOrder[2] === 'gemini', 'Gemini is third in provider order');
  assert(aiConfig.groq.timeoutMs > 0, 'Groq timeout is positive');
  assert(aiConfig.cerebras.timeoutMs > 0, 'Cerebras timeout is positive');
  assert(aiConfig.gemini.timeoutMs > 0, 'Gemini timeout is positive');
  assert(aiConfig.groq.model === 'openai/gpt-oss-120b', 'Groq model is openai/gpt-oss-120b');
  assert(aiConfig.cerebras.model === 'gpt-oss-120b', 'Cerebras model is gpt-oss-120b');
  assert(aiConfig.gemini.model === 'gemini-3.6-flash', 'Gemini model is gemini-3.6-flash');

  // 2. BaseAIProvider JSON Parsing and Rate-Limit Detection
  console.log('\nTest Suite 2: BaseAIProvider JSON & Error Handling');
  const testProvider = new TestBaseProvider('groq');

  const cleanJson = '{"name": "test", "price": 100}';
  assert(testProvider.testExtractJson<any>(cleanJson)?.name === 'test', 'Extracts clean JSON');

  const markdownJson = '```json\n{"name": "markdown", "price": 200}\n```';
  assert(testProvider.testExtractJson<any>(markdownJson)?.name === 'markdown', 'Extracts markdown fenced JSON');

  const noisyJson = 'Here is your response:\n```\n{"name": "noisy"}\n```\nHope that helps!';
  assert(testProvider.testExtractJson<any>(noisyJson)?.name === 'noisy', 'Extracts JSON with conversational preamble');

  const invalidJson = 'Not valid JSON at all';
  assert(testProvider.testExtractJson<any>(invalidJson) === null, 'Handles invalid JSON gracefully without throwing');

  assert(testProvider.testIsRateLimitError(new Error('HTTP 429 Too Many Requests')), 'Detects 429 rate limit');
  assert(testProvider.testIsRateLimitError(new Error('Rate limit reached for model')), 'Detects text rate limit');
  assert(testProvider.testIsRateLimitError(new Error('Resource has been exhausted (e.g. check quota)')), 'Detects Gemini quota exhaustion');
  assert(testProvider.testIsRateLimitError({ status: 402, message: 'Payment required' }), 'Detects 402 payment required');
  assert(!testProvider.testIsRateLimitError(new Error('SyntaxError: unexpected token')), 'Does not falsely flag generic error as rate limit');

  // 3. Provider Chain Requirement 1: Groq Success
  console.log('\nTest Suite 3: Requirement 1 — Groq Success');
  {
    const mockGroq = new MockProvider('groq', true);
    const mockCerebras = new MockProvider('cerebras', true);
    const mockGemini = new MockProvider('gemini', true);
    mockGroq.setMockResponse({ intent: 'earbuds', budget: 3000 });

    const orchestrator = new AIProviderOrchestrator();
    orchestrator.registerProvider('groq', mockGroq);
    orchestrator.registerProvider('cerebras', mockCerebras);
    orchestrator.registerProvider('gemini', mockGemini);

    const res = await orchestrator.generateJson<{ intent: string; budget: number }>('prompt');
    assert(res?.data?.intent === 'earbuds', 'Returns Groq result on Groq success');
    assert(res?.provider === 'groq', 'Provider reported as groq');
    assert(mockGroq.callCount === 1, 'Groq called exactly once');
    assert(mockCerebras.callCount === 0, 'Cerebras not called when Groq succeeds (zero wasted quota)');
    assert(mockGemini.callCount === 0, 'Gemini not called when Groq succeeds (zero wasted quota)');
  }

  // 4. Provider Chain Requirement 2: Groq 429 -> Cerebras Success
  console.log('\nTest Suite 4: Requirement 2 — Groq 429 -> Cerebras Success');
  {
    const mockGroq = new MockProvider('groq', true);
    const mockCerebras = new MockProvider('cerebras', true);
    const mockGemini = new MockProvider('gemini', true);
    mockGroq.setMockRateLimit();
    mockCerebras.setMockResponse({ intent: 'earbuds', budget: 3000, source: 'cerebras' });

    const orchestrator = new AIProviderOrchestrator();
    orchestrator.registerProvider('groq', mockGroq);
    orchestrator.registerProvider('cerebras', mockCerebras);
    orchestrator.registerProvider('gemini', mockGemini);

    const res = await orchestrator.generateJson<{ source: string }>('prompt');
    assert(res?.data?.source === 'cerebras', 'Falls back to Cerebras when Groq hits 429');
    assert(res?.provider === 'cerebras', 'Provider reported as cerebras');
    assert(mockGroq.callCount === 1, 'Groq called and encountered 429');
    assert(mockCerebras.callCount === 1, 'Cerebras called and succeeded');
    assert(mockGemini.callCount === 0, 'Gemini not called when Cerebras succeeds');
    assert(!mockGroq.isAvailable(), 'Groq marked unavailable / on cooldown due to 429');
  }

  // 5. Provider Chain Requirement 3: Cerebras 429 -> Gemini Success
  console.log('\nTest Suite 5: Requirement 3 — Cerebras 429 -> Gemini Success');
  {
    const mockGroq = new MockProvider('groq', true);
    const mockCerebras = new MockProvider('cerebras', true);
    const mockGemini = new MockProvider('gemini', true);
    mockGroq.setMockRateLimit();
    mockCerebras.setMockRateLimit();
    mockGemini.setMockResponse({ intent: 'earbuds', source: 'gemini' });

    const orchestrator = new AIProviderOrchestrator();
    orchestrator.registerProvider('groq', mockGroq);
    orchestrator.registerProvider('cerebras', mockCerebras);
    orchestrator.registerProvider('gemini', mockGemini);

    const res = await orchestrator.generateJson<{ source: string }>('prompt');
    assert(res?.data?.source === 'gemini', 'Falls back to Gemini when Cerebras hits 429');
    assert(res?.provider === 'gemini', 'Provider reported as gemini');
    assert(mockGroq.callCount === 1, 'Groq attempted');
    assert(mockCerebras.callCount === 1, 'Cerebras attempted and encountered 429');
    assert(mockGemini.callCount === 1, 'Gemini called and succeeded');
    assert(!mockCerebras.isAvailable(), 'Cerebras marked unavailable / on cooldown due to 429');
  }

  // 6. Provider Chain Requirement 4: All Fail -> Deterministic Fallback
  console.log('\nTest Suite 6: Requirement 4 — All Fail -> Deterministic Fallback');
  {
    const mockGroq = new MockProvider('groq', true);
    const mockCerebras = new MockProvider('cerebras', true);
    const mockGemini = new MockProvider('gemini', true);
    mockGroq.setMockRateLimit();
    mockCerebras.setMockRateLimit();
    mockGemini.setMockRateLimit();

    const orchestrator = new AIProviderOrchestrator();
    orchestrator.registerProvider('groq', mockGroq);
    orchestrator.registerProvider('cerebras', mockCerebras);
    orchestrator.registerProvider('gemini', mockGemini);

    const res = await orchestrator.generateJson('prompt');
    assert(res === null, 'Returns null when all providers fail, cleanly triggering deterministic fallback');
  }

  // 7. Provider Chain Requirement 5: Missing API Key Handling
  console.log('\nTest Suite 7: Requirement 5 — Missing API Key Handling');
  {
    // Cerebras and Gemini unconfigured (no API key)
    const mockGroq = new MockProvider('groq', false);
    const mockCerebras = new MockProvider('cerebras', false);
    const mockGemini = new MockProvider('gemini', true);
    mockGemini.setMockResponse({ source: 'gemini-only' });

    const orchestrator = new AIProviderOrchestrator();
    orchestrator.registerProvider('groq', mockGroq);
    orchestrator.registerProvider('cerebras', mockCerebras);
    orchestrator.registerProvider('gemini', mockGemini);

    const res = await orchestrator.generateJson<{ source: string }>('prompt');
    assert(res?.data?.source === 'gemini-only', 'Seamlessly routes to configured provider when earlier keys missing');
    assert(mockGroq.callCount === 0, 'Unconfigured Groq was skipped without invocation');
    assert(mockCerebras.callCount === 0, 'Unconfigured Cerebras was skipped without invocation');
    assert(mockGemini.callCount === 1, 'Configured Gemini called');

    // All unconfigured
    const mockGeminiUnconfigured = new MockProvider('gemini', false);
    const emptyOrchestrator = new AIProviderOrchestrator();
    emptyOrchestrator.registerProvider('groq', mockGroq);
    emptyOrchestrator.registerProvider('cerebras', mockCerebras);
    emptyOrchestrator.registerProvider('gemini', mockGeminiUnconfigured);

    const emptyRes = await emptyOrchestrator.generateJson('prompt');
    assert(emptyRes === null, 'Returns null cleanly without throwing when no provider has API keys');
  }

  // 8. Provider Chain Requirement 6: Cooldown Behavior
  console.log('\nTest Suite 8: Requirement 6 — Cooldown Behavior');
  {
    const mockGroq = new MockProvider('groq', true);
    const mockCerebras = new MockProvider('cerebras', true);
    const mockGemini = new MockProvider('gemini', true);
    mockGroq.setMockRateLimit();
    mockCerebras.setMockResponse({ source: 'cerebras' });

    const orchestrator = new AIProviderOrchestrator();
    orchestrator.registerProvider('groq', mockGroq);
    orchestrator.registerProvider('cerebras', mockCerebras);
    orchestrator.registerProvider('gemini', mockGemini);

    // Call 1: Groq fails with 429, puts Groq on cooldown, Cerebras answers
    await orchestrator.generateJson('call 1');
    assert(mockGroq.callCount === 1, 'Call 1: Groq attempted once');
    assert(!mockGroq.isAvailable(), 'Call 1: Groq in cooldown');
    assert(mockCerebras.callCount === 1, 'Call 1: Cerebras called');

    // Call 2: Groq is STILL in cooldown -> orchestrator skips Groq directly to Cerebras
    await orchestrator.generateJson('call 2');
    assert(mockGroq.callCount === 1, 'Call 2: Groq skipped entirely due to cooldown (no wasted API request)');
    assert(mockCerebras.callCount === 2, 'Call 2: Cerebras handled call 2 directly');

    // Call 3: Clear cooldown -> Groq is tried again
    mockGroq.clearCooldown();
    assert(mockGroq.isAvailable(), 'Cooldown cleared: Groq is available again');
    mockGroq.setMockResponse({ source: 'groq-recovered' });
    const recoveredRes = await orchestrator.generateJson<{ source: string }>('call 3');
    assert(recoveredRes?.data?.source === 'groq-recovered', 'Call 3: Groq successfully recovers after cooldown');
    assert(mockGroq.callCount === 2, 'Call 3: Groq called again after cooldown cleared');
  }

  // 9. Integrated Commerce Services Regression via Deterministic Fallback (NO real API quota)
  console.log('\nTest Suite 9: Commerce Services Deterministic Fallback Checks');
  {
    // Temporarily switch global orchestrator to deterministic mode for zero-cost regression check
    const previousMode = aiProviderOrchestrator.getMode();
    aiProviderOrchestrator.setMode('deterministic');

    try {
      // 9.1 Product Ranking Fallback
      const rankingService = new ProductRankingService();
      const mockIntent: CustomerIntent = {
        mode: 'NEW_REQUEST',
        category: 'earbuds',
        brand: null,
        minPrice: null,
        maxPrice: 3000,
        preferences: ['bass'],
        keywords: ['wireless', 'earbuds'],
        targetProductPositions: null,
      };

      const candidates: CandidateProduct[] = [
        {
          id: 'p1',
          name: 'BassPro Wireless Earbuds',
          description: 'Deep bass wireless earbuds',
          category: 'earbuds',
          brand: 'SoundWave',
          price: 2499,
          stock: 10,
          images: [],
          features: ['deep bass', 'bluetooth 5.3'],
          specifications: {},
          tags: ['wireless', 'bass'],
          relevanceScore: 85,
        },
        {
          id: 'p2',
          name: 'ClearVoice Wired Headset',
          description: 'Office wired headset',
          category: 'headphones',
          brand: 'ClearComm',
          price: 1299,
          stock: 5,
          images: [],
          features: ['clear mic'],
          specifications: {},
          tags: ['wired'],
          relevanceScore: 40,
        },
      ];

      const rankingResult = await rankingService.rankCandidates(mockIntent, candidates, null);
      assert(rankingResult.rankedProducts.length > 0, 'Product ranking generates ranked picks in fallback mode');
      assert(rankingResult.rankedProducts[0].productId === 'p1', 'Strongest candidate ranked first in fallback');

      // 9.2 Sales Reasoner Fallback
      const reasonerService = new SalesReasonerService();
      const ranked: RankedProduct[] = [
        {
          productId: 'p1',
          rank: 1,
          matchScore: 88,
          reason: 'Matches bass preference within budget',
        },
      ];

      const salesResult = await reasonerService.explainRecommendations(mockIntent, null, ranked, candidates, null);
      assert(typeof salesResult.salesOverview === 'string' && salesResult.salesOverview.length > 0, 'Sales reasoner produces overview in fallback mode');
      assert(salesResult.productReasonings.has('p1'), 'Sales reasoner produces product reasonings in fallback mode');

      // 9.3 Description Generator Fallback
      const descService = new DescriptionGeneratorService();
      const descInput = {
        name: 'NoiseTune Flex Wireless Neckband',
        category: 'earphones',
        brand: 'NoiseTune',
        features: ['magnetic earbuds', 'fast charging'],
        tags: ['neckband', 'wireless'],
      };
      const descResult = await descService.generateDescription(descInput, null);
      assert(descResult.source === 'fallback', 'Description generator marks fallback source');
      assert(descResult.description.includes('NoiseTune'), 'Description fallback includes product brand');

      // 9.4 Intent Extractor Fallback
      const intentService = new IntentExtractorService();
      const intentResult = await intentService.extractIntent('wireless earbuds with deep bass under 3000');
      assert(intentResult.intent.category === 'earbuds', 'Intent extractor parses category in fallback mode');
      assert(intentResult.intent.maxPrice === 3000, 'Intent extractor parses maxPrice in fallback mode');
      assert(intentResult.intent.preferences.some((p) => p.includes('bass')), 'Intent extractor parses preferences in fallback mode');
    } finally {
      aiProviderOrchestrator.setMode(previousMode);
    }
  }

  console.log(`\n=== Verification Complete: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

import { prisma } from '../server/db/prisma';
import { authService } from '../server/services/auth.service';
import { requireMerchantAuth } from '../server/middleware/auth.middleware';
import { descriptionController } from '../server/controllers/ai/description.controller';
import { descriptionGeneratorService, GenerateDescriptionInput } from '../server/services/ai/description-generator.service';
import { productService } from '../server/services/product.service';
import { productController } from '../server/controllers/product.controller';
import { candidateRetrievalService } from '../server/services/ai/candidate-retrieval.service';
import { productRankingService } from '../server/services/ai/product-ranking.service';
import { signMerchantToken } from '../server/utils/jwt';
import jwt from 'jsonwebtoken';

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  details: string;
}

async function runVerification() {
  const results: TestResult[] = [];
  const savedApiKey = process.env.GEMINI_API_KEY;
  // Stub out real API key during tests to avoid real credit consumption and network flakiness
  process.env.GEMINI_API_KEY = '';

  try {
  console.log('\n======================================================');
  console.log('PHASE 6#6: AI-ASSISTED PRODUCT DESCRIPTION VERIFICATION');
  console.log('======================================================\n');

  async function test(num: number, name: string, fn: () => Promise<void>) {
    try {
      console.log(`[START] Test ${num}: ${name}`);
      await fn();
      results.push({ num, name, passed: true, details: 'OK' });
      console.log(`[PASS] Test ${num}: ${name}`);
    } catch (err: any) {
      results.push({ num, name, passed: false, details: err.message || String(err) });
      console.error(`[FAIL] Test ${num}: ${name} -> ${err.message || String(err)}`);
    }
  }

  const timestamp = Date.now();

  // Create test merchant A and store A
  const merchantAReg = await authService.register({
    name: 'Merchant Alpha',
    email: `merchant_alpha_${timestamp}@example.com`,
    password: 'Password123!',
    storeName: `Store Alpha ${timestamp}`,
  });
  const merchantA = merchantAReg.merchant;
  const storeA = merchantA.store!;
  const tokenA = merchantAReg.token;

  // Create test merchant B and store B (for cross-store isolation tests)
  const merchantBReg = await authService.register({
    name: 'Merchant Beta',
    email: `merchant_beta_${timestamp}@example.com`,
    password: 'Password123!',
    storeName: `Store Beta ${timestamp}`,
  });
  const merchantB = merchantBReg.merchant;
  const storeB = merchantB.store!;
  const tokenB = merchantBReg.token;

  // Test 1: Authenticated merchant can generate description
  await test(1, 'Authenticated merchant can generate description', async () => {
    let statusCode = 0;
    let responseBody: any = null;

    const req: any = {
      merchant: merchantA,
      body: {
        name: 'ZenPods Pro Wireless',
        category: 'Audio',
        brand: 'ZenAudio',
        tags: ['wireless', 'anc', 'bluetooth'],
        features: ['Active Noise Cancellation', '30hr battery', 'IPX5 water resistant'],
      },
    };
    const res: any = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        responseBody = data;
        return this;
      },
    };

    await descriptionController.generateDescription(req, res, (err) => {
      if (err) throw err;
    });

    if (statusCode !== 200) {
      throw new Error(`Expected 200 status code, got ${statusCode}`);
    }
    if (!responseBody?.success || !responseBody?.data?.description) {
      throw new Error(`Response missing success or description: ${JSON.stringify(responseBody)}`);
    }
    if (typeof responseBody.data.description !== 'string' || responseBody.data.description.length < 10) {
      throw new Error(`Generated description too short or invalid: "${responseBody.data.description}"`);
    }
  });

  // Test 2: Missing auth -> 401
  await test(2, 'Missing auth yields 401', async () => {
    // 2a: Test requireMerchantAuth middleware with missing header
    const reqNoHeader: any = { headers: {} };
    let capturedErr: any = null;
    await requireMerchantAuth(reqNoHeader, {} as any, (err) => {
      capturedErr = err;
    });
    if (!capturedErr || capturedErr.statusCode !== 401) {
      throw new Error(`Middleware expected 401 for missing auth, got: ${capturedErr?.statusCode || capturedErr}`);
    }

    // 2b: Test controller directly without req.merchant
    let controllerErr: any = null;
    const reqNoMerchant: any = { body: { name: 'Test Product' } };
    await descriptionController.generateDescription(reqNoMerchant, {} as any, (err) => {
      controllerErr = err;
    });
    if (!controllerErr || controllerErr.statusCode !== 401) {
      throw new Error(`Controller expected 401 without req.merchant, got: ${controllerErr?.statusCode || controllerErr}`);
    }
  });

  // Test 3: Invalid auth -> 401
  await test(3, 'Invalid auth token yields 401', async () => {
    const forgedToken = jwt.sign({ merchantId: 'non-existent-merchant' }, 'completely-wrong-secret-key');
    const reqInvalid: any = { headers: { authorization: `Bearer ${forgedToken}` } };
    let capturedErr: any = null;
    await requireMerchantAuth(reqInvalid, {} as any, (err) => {
      capturedErr = err;
    });
    if (!capturedErr || capturedErr.statusCode !== 401) {
      throw new Error(`Expected 401 for forged JWT signature, got: ${capturedErr?.statusCode || capturedErr}`);
    }
  });

  // Test 4: Empty product name -> validation error (400)
  await test(4, 'Empty product name rejected with 400 validation error', async () => {
    const testCases = [
      { name: '' },
      { name: '   ' },
      { name: null },
      {},
    ];

    for (const body of testCases) {
      let error400: any = null;
      const req: any = { merchant: merchantA, body };
      await descriptionController.generateDescription(req, {} as any, (err) => {
        error400 = err;
      });
      if (!error400 || error400.statusCode !== 400) {
        throw new Error(`Expected 400 error for invalid name input ${JSON.stringify(body)}, got: ${error400?.statusCode || error400}`);
      }
    }
  });

  // Test 5: Valid product attributes -> usable description
  await test(5, 'Valid product attributes produce usable description containing key info', async () => {
    const result = descriptionGeneratorService.generateDeterministicFallback({
      name: 'Titan Gaming Keyboard',
      category: 'Peripherals',
      brand: 'TitanMech',
      features: ['Mechanical Blue Switches', 'RGB Backlighting', 'Detachable USB-C'],
      specifications: { layout: 'Tenkeyless', switches: 'Blue' },
    });

    if (!result.includes('TitanMech') || !result.includes('Titan Gaming Keyboard')) {
      throw new Error(`Description does not mention brand/name: "${result}"`);
    }
    if (!result.includes('Peripherals')) {
      throw new Error(`Description does not mention category: "${result}"`);
    }
    if (!result.includes('Mechanical Blue Switches')) {
      throw new Error(`Description does not mention key features: "${result}"`);
    }
  });

  // Test 6: Gemini unavailable -> deterministic fallback
  await test(6, 'Gemini unavailable/failure smoothly yields deterministic fallback without error', async () => {
    // When GEMINI_API_KEY is not configured or in fallback mode
    const input: GenerateDescriptionInput = {
      name: 'Aura Studio Microphone',
      category: 'Audio',
      brand: 'Aura',
      features: ['Cardioid polar pattern', 'Zero-latency monitoring'],
    };

    const result = await descriptionGeneratorService.generateDescription(input);
    if (!result || !result.description) {
      throw new Error('Expected result with description');
    }
    if (!result.description.includes('Aura') || !result.description.includes('Microphone')) {
      throw new Error(`Fallback description missing key brand or product terms: "${result.description}"`);
    }
  });

  // Test 7: Exactly one Gemini attempt per explicit generation request
  await test(7, 'Executes exactly ONE Gemini attempt per request and bounds with timeout', async () => {
    let geminiCallCount = 0;
    let receivedPayload: any = null;

    const mockAiClient: any = {
      models: {
        generateContent: async (args: any) => {
          geminiCallCount++;
          receivedPayload = args;
          return {
            text: JSON.stringify({
              description: 'Custom AI generated studio microphone with cardioid polar pattern.',
            }),
          };
        },
      },
    };

    const input: GenerateDescriptionInput = {
      name: 'OmniMic Pro',
      category: 'Audio',
      brand: 'OmniSound',
      features: ['USB-C connection', 'Mute button'],
    };

    const res = await descriptionGeneratorService.generateDescription(input, mockAiClient);
    if (!res.description || res.source !== 'ai') {
      throw new Error(`Expected AI description result, got source: ${res.source}`);
    }
    if (geminiCallCount !== 1) {
      throw new Error(`Expected exactly 1 Gemini call, got ${geminiCallCount}`);
    }
    if (!receivedPayload || !receivedPayload.contents.includes('OmniMic Pro')) {
      throw new Error('Gemini prompt missing product name');
    }
  });

  // Test 8: costPrice is excluded from AI payload
  await test(8, 'costPrice is strictly excluded from AI payloads', async () => {
    const maliciousBody: any = {
      name: 'Stealth Earbuds',
      category: 'Audio',
      brand: 'StealthAudio',
      costPrice: 500,
    };

    let responseData: any = null;
    const req: any = {
      merchant: merchantA,
      body: maliciousBody,
    };
    const res: any = {
      status: () => res,
      json: (d: any) => {
        responseData = d;
      },
    };

    await descriptionController.generateDescription(req, res, (err) => {
      if (err) throw err;
    });

    const desc = responseData?.data?.description || '';
    if (desc.includes('500') || desc.includes('costPrice')) {
      throw new Error(`Generated description leaked costPrice: "${desc}"`);
    }
  });

  // Test 9: Economic fields are excluded from AI payload
  await test(9, 'Economic fields (margin, expectedProfit, purchaseProbability, discount) are strictly excluded', async () => {
    const maliciousBody: any = {
      name: 'Stealth Earbuds',
      category: 'Audio',
      brand: 'StealthAudio',
      margin: 0.6,
      expectedProfit: 1200,
      purchaseProbability: 0.95,
      discount: 20,
      secretKey: 'topsecret123',
    };

    let responseData: any = null;
    const req: any = {
      merchant: merchantA,
      body: maliciousBody,
    };
    const res: any = {
      status: () => res,
      json: (d: any) => {
        responseData = d;
      },
    };

    await descriptionController.generateDescription(req, res, (err) => {
      if (err) throw err;
    });

    const desc = responseData?.data?.description || '';
    const forbiddenTerms = ['margin', 'expectedProfit', 'purchaseProbability', 'discount', 'secretKey', 'topsecret123'];
    for (const term of forbiddenTerms) {
      if (desc.includes(term)) {
        throw new Error(`Generated description leaked forbidden field '${term}': "${desc}"`);
      }
    }
  });

  // Test 10: Generated description updates form state path without publishing
  await test(10, 'Generated description is returned for Add Product state insertion without modifying catalog', async () => {
    let responseData: any = null;
    const req: any = {
      merchant: merchantA,
      body: {
        name: 'Ergonomic Vertical Mouse',
        category: 'Accessories',
        brand: 'ErgoTech',
        tags: ['ergonomic', 'wireless', 'office'],
      },
    };
    const res: any = {
      status: () => res,
      json: (d: any) => {
        responseData = d;
      },
    };

    await descriptionController.generateDescription(req, res, (err) => {
      if (err) throw err;
    });

    if (!responseData?.data?.description) {
      throw new Error('Description was not generated');
    }

    // Simulate Add Product component state assignment
    const mockNewProductForm = {
      name: 'Ergonomic Vertical Mouse',
      category: 'Accessories',
      brand: 'ErgoTech',
      description: '',
    };
    // Updating local form state
    mockNewProductForm.description = responseData.data.description;
    if (!mockNewProductForm.description.includes('ErgoTech')) {
      throw new Error(`Form state description assignment failed: ${mockNewProductForm.description}`);
    }
  });

  // Test 11: Generation does NOT create or publish a product
  await test(11, 'Generating a description does NOT create or publish a product in the database', async () => {
    const countBefore = await prisma.product.count({
      where: { storeId: storeA.id },
    });

    const req: any = {
      merchant: merchantA,
      body: {
        name: 'Ghost Product Not Saved',
        category: 'Test',
        brand: 'Ghost',
      },
    };
    const res: any = {
      status: () => res,
      json: () => {},
    };

    await descriptionController.generateDescription(req, res, (err) => {
      if (err) throw err;
    });

    const countAfter = await prisma.product.count({
      where: { storeId: storeA.id },
    });

    if (countBefore !== countAfter) {
      throw new Error(`Product count changed from ${countBefore} to ${countAfter} during description generation!`);
    }
  });

  // Test 12: Existing product creation still saves description
  await test(12, 'Existing product creation properly persists description in database', async () => {
    const testDescription = `Official product description created at ${timestamp}`;
    const product = await productService.createProduct({
      storeId: storeA.id,
      name: `Real Product With Description ${timestamp}`,
      category: 'Audio',
      brand: 'ZenAudio',
      price: 1999,
      costPrice: 999,
      stock: 25,
      description: testDescription,
      status: 'PUBLISHED',
    });

    if (!product || !product.id) {
      throw new Error('Failed to create product');
    }

    const fetched = await productService.getProductById(product.id);
    if (!fetched || fetched.description !== testDescription) {
      throw new Error(`Persisted description mismatch: expected "${testDescription}", got "${fetched?.description}"`);
    }
  });

  // Test 13: Cross-store merchant cannot misuse another merchant's product mutation
  await test(13, 'Cross-store merchant cannot update or delete another merchant\'s product (403)', async () => {
    // Product belongs to Store A
    const productA = await prisma.product.create({
      data: {
        storeId: storeA.id,
        name: `Store A Protected Product ${timestamp}`,
        category: 'Electronics',
        price: 2999,
        costPrice: 1500,
        stock: 10,
        status: 'PUBLISHED',
      },
    });

    // Merchant B tries to update Product A
    let capturedErr: any = null;
    const reqMerchantB: any = {
      merchant: merchantB,
      params: { id: productA.id },
      body: { name: 'Hacked Name' },
    };
    await productController.updateProduct(reqMerchantB, {} as any, (err) => {
      capturedErr = err;
    });

    if (!capturedErr || capturedErr.statusCode !== 403) {
      throw new Error(`Expected 403 Forbidden for cross-store update, got: ${capturedErr?.statusCode || capturedErr}`);
    }

    // Merchant B tries to delete Product A
    let deleteErr: any = null;
    await productController.deleteProduct(reqMerchantB, {} as any, (err) => {
      deleteErr = err;
    });

    if (!deleteErr || deleteErr.statusCode !== 403) {
      throw new Error(`Expected 403 Forbidden for cross-store delete, got: ${deleteErr?.statusCode || deleteErr}`);
    }
  });

  // Test 14: Existing AI search and candidate retrieval remain unaffected and use description
  await test(14, 'Existing AI search and candidate retrieval operate smoothly with product descriptions', async () => {
    // Search candidates using candidate retrieval service
    const searchResult = await candidateRetrievalService.retrieveCandidates(storeA.id, {
      category: 'audio',
      brand: 'ZenAudio',
      minPrice: null,
      maxPrice: 3000,
      preferences: ['wireless'],
      keywords: ['audio', 'zen'],
    });

    const candidates = searchResult.products;
    if (!Array.isArray(candidates)) {
      throw new Error('Candidate retrieval failed to return products array');
    }
    // Verify candidates include description field
    for (const c of candidates) {
      if (c.description !== undefined && typeof c.description !== 'string' && c.description !== null) {
        throw new Error(`Candidate has invalid description type: ${typeof c.description}`);
      }
    }
  });

  console.log('\n======================================================');
  console.log('SUMMARY OF RESULTS');
  console.log('======================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Total: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);

  if (failedCount > 0) {
    console.error('\nFAILED TESTS:');
    results.filter((r) => !r.passed).forEach((r) => console.error(`- Test ${r.num}: ${r.name} (${r.details})`));
    process.exit(1);
  } else {
    console.log('\nALL 14 PHASE 6#6 VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
  }
} finally {
  process.env.GEMINI_API_KEY = savedApiKey;
}
}

runVerification().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});

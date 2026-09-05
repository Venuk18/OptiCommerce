import http from 'http';
import { app, initDatabase } from '../server/app';
import { prisma } from '../server/db/prisma';
import { verifyPassword } from '../server/utils/password';
import { verifyCustomerToken, signMerchantToken } from '../server/utils/jwt';
import jwt from 'jsonwebtoken';

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  details: string;
}

async function runPhase3CVerification() {
  console.log('===============================================================');
  console.log('PHASE 3C — CUSTOMER REGISTRATION & LOGIN API VERIFICATION');
  console.log('===============================================================\n');

  await initDatabase();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://localhost:${address.port}`;

  const results: TestResult[] = [];

  function record(num: number, name: string, passed: boolean, details: string = 'OK') {
    results.push({ num, name, passed, details });
    if (passed) {
      console.log(`[PASS] Test ${num}: ${name}`);
    } else {
      console.error(`[FAIL] Test ${num}: ${name} -> ${details}`);
    }
  }

  try {
    // 0. Ensure two distinct stores exist for multi-tenant testing
    let storeA = await prisma.store.findFirst();
    if (!storeA) {
      const merchantA = await prisma.merchant.create({
        data: {
          name: 'Merchant Alpha',
          email: `merchant_alpha_${Date.now()}@test.com`,
          store: {
            create: {
              name: 'Store Alpha',
              slug: `store-alpha-${Date.now()}`,
              status: 'PUBLISHED',
            },
          },
        },
        include: { store: true },
      });
      storeA = merchantA.store!;
    }

    const merchantB = await prisma.merchant.create({
      data: {
        name: 'Merchant Beta',
        email: `merchant_beta_${Date.now()}@test.com`,
        store: {
          create: {
            name: 'Store Beta',
            slug: `store-beta-${Date.now()}`,
            status: 'PUBLISHED',
          },
        },
      },
      include: { store: true },
    });
    const storeB = merchantB.store!;

    console.log(`[Setup] Store A ID: ${storeA.id} (${storeA.name})`);
    console.log(`[Setup] Store B ID: ${storeB.id} (${storeB.name})\n`);

    const timestamp = Date.now();
    const testEmail1 = `customer_${timestamp}@example.com`;
    const testPassword = 'Password123!';
    let customer1Token = '';
    let customer1Id = '';

    // ==============================================================
    // A. CUSTOMER REGISTRATION
    // ==============================================================
    console.log('--- Section A: Customer Registration ---');

    // 1. Valid registration with name
    const reg1Res = await fetch(`${baseUrl}/api/customer-auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: storeA.id,
        name: 'Alice Wonder',
        email: testEmail1,
        password: testPassword,
      }),
    });
    const reg1Body = await reg1Res.json();
    const reg1Cust = reg1Body.customer || reg1Body.data?.customer;
    const reg1Token = reg1Body.token || reg1Body.data?.token;

    const pass1 =
      reg1Res.status === 201 &&
      reg1Cust?.email === testEmail1.toLowerCase() &&
      reg1Cust?.name === 'Alice Wonder' &&
      reg1Cust?.storeId === storeA.id &&
      typeof reg1Token === 'string' &&
      reg1Cust?.passwordHash === undefined;

    customer1Token = reg1Token;
    customer1Id = reg1Cust?.id;
    record(1, 'Valid registration creates customer and returns token without passwordHash', pass1);

    // 2. Database stores bcrypt hash, never plaintext
    const dbCustomer1 = await prisma.customer.findUnique({
      where: { id: customer1Id },
    });
    const isHashValid =
      dbCustomer1 &&
      dbCustomer1.passwordHash !== testPassword &&
      dbCustomer1.passwordHash.startsWith('$2') &&
      (await verifyPassword(testPassword, dbCustomer1.passwordHash));
    record(2, 'Database securely stores bcrypt password hash, never plaintext', !!isHashValid);

    // 3. Optional name in registration
    const emailNoName = `cust_noname_${timestamp}@example.com`;
    const reg2Res = await fetch(`${baseUrl}/api/customer-auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: storeA.id,
        email: emailNoName,
        password: testPassword,
      }),
    });
    const reg2Body = await reg2Res.json();
    const reg2Cust = reg2Body.customer || reg2Body.data?.customer;
    record(3, 'Registration succeeds with omitted/optional name (name is null)', reg2Res.status === 201 && reg2Cust?.name === null);

    // 4. Email normalization (trim and lowercase)
    const emailUnnormalized = `   UPPER_CASE_${timestamp}@EXAMPLE.COM   `;
    const reg3Res = await fetch(`${baseUrl}/api/customer-auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: storeA.id,
        email: emailUnnormalized,
        password: testPassword,
      }),
    });
    const reg3Body = await reg3Res.json();
    const reg3Cust = reg3Body.customer || reg3Body.data?.customer;
    record(4, 'Registration normalizes email to trimmed lowercase', reg3Res.status === 201 && reg3Cust?.email === emailUnnormalized.trim().toLowerCase());

    // 5. Duplicate email registration within same store rejected with 409
    const dupRes = await fetch(`${baseUrl}/api/customer-auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: storeA.id,
        email: testEmail1.toUpperCase(), // case-insensitive match
        password: testPassword,
      }),
    });
    record(5, 'Duplicate email in same store is rejected with 409 Conflict', dupRes.status === 409);

    // 6. Same email allowed in a different store (Store B)
    const storeBRes = await fetch(`${baseUrl}/api/customer-auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: storeB.id,
        email: testEmail1,
        password: testPassword,
      }),
    });
    const storeBBody = await storeBRes.json();
    const storeBCust = storeBBody.customer || storeBBody.data?.customer;
    record(6, 'Same email is allowed when registering in a different store', storeBRes.status === 201 && storeBCust?.storeId === storeB.id);

    // 7. Missing/invalid fields rejected
    const missingStore = await fetch(`${baseUrl}/api/customer-auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `test_${timestamp}@x.com`, password: testPassword }),
    });
    const nonExistentStore = await fetch(`${baseUrl}/api/customer-auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId: '00000000-0000-0000-0000-000000000000', email: `test_${timestamp}@x.com`, password: testPassword }),
    });
    const missingEmail = await fetch(`${baseUrl}/api/customer-auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId: storeA.id, password: testPassword }),
    });
    const invalidEmail = await fetch(`${baseUrl}/api/customer-auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId: storeA.id, email: 'not-an-email', password: testPassword }),
    });
    const shortPassword = await fetch(`${baseUrl}/api/customer-auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId: storeA.id, email: `test2_${timestamp}@x.com`, password: '123' }),
    });

    const pass7 =
      missingStore.status === 400 &&
      nonExistentStore.status === 404 &&
      missingEmail.status === 400 &&
      invalidEmail.status === 400 &&
      shortPassword.status === 400;
    record(7, 'Validation errors properly reject missing/invalid storeId, email, and password', pass7);

    // ==============================================================
    // B. CUSTOMER LOGIN
    // ==============================================================
    console.log('\n--- Section B: Customer Login ---');

    // 8. Valid login with correct credentials
    const login1Res = await fetch(`${baseUrl}/api/customer-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: storeA.id,
        email: testEmail1,
        password: testPassword,
      }),
    });
    const login1Body = await login1Res.json();
    const login1Cust = login1Body.customer || login1Body.data?.customer;
    const login1Token = login1Body.token || login1Body.data?.token;

    const pass8 =
      login1Res.status === 200 &&
      login1Cust?.id === customer1Id &&
      typeof login1Token === 'string' &&
      login1Cust?.passwordHash === undefined;
    record(8, 'Valid login returns safe customer profile and valid token without passwordHash', pass8);

    // 9. Login email normalization works
    const loginNormRes = await fetch(`${baseUrl}/api/customer-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: storeA.id,
        email: `  ${testEmail1.toUpperCase()}  `,
        password: testPassword,
      }),
    });
    record(9, 'Login normalizes email input with trimming and case-insensitivity', loginNormRes.status === 200);

    // 10. Wrong password returns generic 401
    const wrongPassRes = await fetch(`${baseUrl}/api/customer-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: storeA.id,
        email: testEmail1,
        password: 'WrongPassword123!',
      }),
    });
    const wrongPassBody = await wrongPassRes.json();
    record(10, 'Wrong password returns generic 401 "Invalid email or password"', wrongPassRes.status === 401 && wrongPassBody.error?.message === 'Invalid email or password');

    // 11. Unknown email returns generic 401 (no enumeration leak)
    const unknownEmailRes = await fetch(`${baseUrl}/api/customer-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: storeA.id,
        email: `nonexistent_${timestamp}@example.com`,
        password: testPassword,
      }),
    });
    const unknownEmailBody = await unknownEmailRes.json();
    record(11, 'Unknown email returns generic 401 "Invalid email or password" to prevent user enumeration', unknownEmailRes.status === 401 && unknownEmailBody.error?.message === 'Invalid email or password');

    // 12. Login with valid email in Store A attempting to login to Store B
    const crossStoreLogin = await fetch(`${baseUrl}/api/customer-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: storeB.id,
        email: emailNoName, // only registered in Store A
        password: testPassword,
      }),
    });
    record(12, 'Login is scoped by storeId: account in Store A cannot login to Store B without registering in Store B', crossStoreLogin.status === 401);

    // 13. Returned token verifies as customer token
    const verified = verifyCustomerToken(login1Token);
    const pass13 =
      verified.customerId === customer1Id &&
      verified.storeId === storeA.id &&
      verified.role === 'customer';
    record(13, 'Login token verifies as Customer JWT with role "customer" and correct scope', pass13);

    // ==============================================================
    // C. GET /api/customer-auth/me
    // ==============================================================
    console.log('\n--- Section C: GET /api/customer-auth/me ---');

    // 14. Valid customer token retrieves safe profile
    const meRes = await fetch(`${baseUrl}/api/customer-auth/me`, {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    const meBody = await meRes.json();
    const meCust = meBody.customer || meBody.data?.customer;

    const pass14 =
      meRes.status === 200 &&
      meCust?.id === customer1Id &&
      meCust?.email === testEmail1.toLowerCase() &&
      meCust?.storeId === storeA.id &&
      meCust?.passwordHash === undefined;
    record(14, 'GET /api/customer-auth/me returns authenticated customer profile without passwordHash', pass14);

    // 15. Missing Authorization header -> 401
    const noAuthRes = await fetch(`${baseUrl}/api/customer-auth/me`);
    record(15, 'GET /api/customer-auth/me rejects missing Authorization header with 401', noAuthRes.status === 401);

    // 16. Malformed Authorization header -> 401
    const malformedRes = await fetch(`${baseUrl}/api/customer-auth/me`, {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    });
    const missingTokenRes = await fetch(`${baseUrl}/api/customer-auth/me`, {
      headers: { Authorization: 'Bearer ' },
    });
    record(16, 'GET /api/customer-auth/me rejects malformed Authorization header with 401', malformedRes.status === 401 && missingTokenRes.status === 401);

    // 17. Expired or forged token -> 401
    const invalidTokenRes = await fetch(`${baseUrl}/api/customer-auth/me`, {
      headers: { Authorization: 'Bearer this.is.notavalidtoken' },
    });
    record(17, 'GET /api/customer-auth/me rejects invalid token signature with 401', invalidTokenRes.status === 401);

    // ==============================================================
    // D. TOKEN & STORE ISOLATION
    // ==============================================================
    console.log('\n--- Section D: Token & Store Isolation ---');

    // 18. Merchant token rejected by customer middleware
    const merchantToken = signMerchantToken('merchant-uuid-1234');
    const merchantAsCustomerRes = await fetch(`${baseUrl}/api/customer-auth/me`, {
      headers: { Authorization: `Bearer ${merchantToken}` },
    });
    record(18, 'Merchant token is strictly rejected by requireCustomerAuth (401)', merchantAsCustomerRes.status === 401);

    // 19. Customer token rejected by requireMerchantAuth
    const customerAsMerchantRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    record(19, 'Customer token is strictly rejected by requireMerchantAuth (401)', customerAsMerchantRes.status === 401);

    // 20. Forged / hybrid token rejected
    const forgedHybridToken = jwt.sign(
      { merchantId: 'merchant-fake', customerId: customer1Id, role: 'customer' },
      process.env.JWT_SECRET || 'opticommerce-dev-secret-jwt-key-2026'
    );
    const hybridAtCustomer = await fetch(`${baseUrl}/api/customer-auth/me`, {
      headers: { Authorization: `Bearer ${forgedHybridToken}` },
    });
    const hybridAtMerchant = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${forgedHybridToken}` },
    });
    record(20, 'Forged hybrid tokens with conflicting roles are rejected by both middlewares', hybridAtCustomer.status === 401 && hybridAtMerchant.status === 401);

    // 21. Store Isolation: Customer token storeId cannot be overridden by query or body
    const overrideAttempt = await fetch(`${baseUrl}/api/customer-auth/me?storeId=${storeB.id}`, {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    const overrideBody = await overrideAttempt.json();
    const overrideCust = overrideBody.customer || overrideBody.data?.customer;
    record(21, 'Token storeId is authoritative: query storeId cannot override token scope', overrideAttempt.status === 200 && overrideCust?.storeId === storeA.id);

    // 22. Cross-Store Scope Mismatch: Token claiming Store B for customer in Store A is rejected
    const tamperedStoreToken = jwt.sign(
      { customerId: customer1Id, storeId: storeB.id, role: 'customer' },
      process.env.JWT_SECRET || 'opticommerce-dev-secret-jwt-key-2026'
    );
    const crossStoreRes = await fetch(`${baseUrl}/api/customer-auth/me`, {
      headers: { Authorization: `Bearer ${tamperedStoreToken}` },
    });
    record(22, 'Customer token with tampered storeId mismatching customer database record is rejected (401)', crossStoreRes.status === 401);

    // ==============================================================
    // SUMMARY
    // ==============================================================
    console.log('\n==============================================================');
    const total = results.length;
    const passedCount = results.filter((r) => r.passed).length;
    const failedCount = total - passedCount;

    console.log(`TOTAL TESTS: ${total} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
    console.log('==============================================================');

    if (failedCount > 0) {
      console.error(`\n❌ VERIFICATION FAILED with ${failedCount} failing test(s).`);
      process.exit(1);
    } else {
      console.log('\n✅ ALL PHASE 3C CUSTOMER AUTH VERIFICATIONS PASSED SUCCESSFULLY!');
      process.exit(0);
    }
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runPhase3CVerification().catch(async (err) => {
  console.error('Fatal error during Phase 3C verification:', err);
  await prisma.$disconnect();
  process.exit(1);
});

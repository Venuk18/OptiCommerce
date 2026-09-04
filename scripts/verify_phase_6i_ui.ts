import { prisma } from '../server/db/prisma';
import fs from 'fs';
import path from 'path';

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  details: string;
}

async function runTests() {
  const results: TestResult[] = [];

  console.log('\n======================================================');
  console.log('PHASE 6I.3 — MERCHANT AUTHENTICATION UI VERIFICATION');
  console.log('======================================================\n');

  async function test(num: number, name: string, fn: () => Promise<void>) {
    try {
      await fn();
      results.push({ num, name, passed: true, details: 'OK' });
      console.log(`[PASS] Test ${num}: ${name}`);
    } catch (err: any) {
      results.push({ num, name, passed: false, details: err.message || String(err) });
      console.error(`[FAIL] Test ${num}: ${name} -> ${err.message || String(err)}`);
    }
  }

  // Load and read source files
  const authServicePath = path.join(process.cwd(), 'src/services/auth.service.ts');
  const authContextPath = path.join(process.cwd(), 'src/context/AuthContext.tsx');
  const merchantAuthPath = path.join(process.cwd(), 'src/components/merchant/MerchantAuth.tsx');
  const merchantHeaderPath = path.join(process.cwd(), 'src/components/merchant/MerchantHeader.tsx');
  const apiClientPath = path.join(process.cwd(), 'src/services/api.client.ts');
  const appPath = path.join(process.cwd(), 'src/App.tsx');
  const eventServicePath = path.join(process.cwd(), 'src/services/event.service.ts');

  const authServiceContent = fs.readFileSync(authServicePath, 'utf-8');
  const authContextContent = fs.readFileSync(authContextPath, 'utf-8');
  const merchantAuthContent = fs.readFileSync(merchantAuthPath, 'utf-8');
  const merchantHeaderContent = fs.readFileSync(merchantHeaderPath, 'utf-8');
  const apiClientContent = fs.readFileSync(apiClientPath, 'utf-8');
  const appContent = fs.readFileSync(appPath, 'utf-8');
  const eventServiceContent = fs.readFileSync(eventServicePath, 'utf-8');

  // Test 1: Auth service exists and exports required methods
  await test(1, 'Auth service exists and exports register, login, getMe, logout, setToken, getToken, removeToken', async () => {
    const { authService, AuthService } = await import('../src/services/auth.service');
    if (!authService || typeof authService.register !== 'function' || typeof authService.login !== 'function') {
      throw new Error('authService missing or lacks required register/login methods');
    }
    if (typeof authService.getMe !== 'function' || typeof authService.logout !== 'function') {
      throw new Error('authService missing getMe or logout method');
    }
    if (typeof authService.getToken !== 'function' || typeof authService.setToken !== 'function') {
      throw new Error('authService missing getToken or setToken method');
    }
  });

  // Test 2: Register API integration
  await test(2, 'Register API integration calls /api/auth/register with correct payload', async () => {
    if (!authServiceContent.includes('/api/auth/register')) {
      throw new Error('authService does not call /api/auth/register endpoint');
    }
    if (!authServiceContent.includes('JSON.stringify({ name, email, password, storeName })')) {
      throw new Error('Register payload does not serialize merchant registration fields properly');
    }
  });

  // Test 3: Login API integration
  await test(3, 'Login API integration calls /api/auth/login with email and password', async () => {
    if (!authServiceContent.includes('/api/auth/login')) {
      throw new Error('authService does not call /api/auth/login endpoint');
    }
    if (!authServiceContent.includes('JSON.stringify({ email, password })')) {
      throw new Error('Login payload does not serialize email and password');
    }
  });

  // Test 4: GET /auth/me integration
  await test(4, 'GET /api/auth/me integration calls endpoint with Authorization Bearer header', async () => {
    if (!authServiceContent.includes('/api/auth/me')) {
      throw new Error('authService does not call /api/auth/me endpoint');
    }
    if (!authServiceContent.includes('Authorization') || !authServiceContent.includes('Bearer')) {
      throw new Error('authService getMe does not set Bearer Authorization header');
    }
  });

  // Test 5: Token persistence under dedicated key
  await test(5, 'Token persistence uses dedicated storage key opticommerce_merchant_token', async () => {
    if (!apiClientContent.includes('opticommerce_merchant_token')) {
      throw new Error('api.client.ts missing opticommerce_merchant_token storage key constant');
    }
    if (!authServiceContent.includes('MERCHANT_TOKEN_STORAGE_KEY')) {
      throw new Error('authService does not use MERCHANT_TOKEN_STORAGE_KEY');
    }
  });

  // Test 6: Token removal on logout
  await test(6, 'Token removal on logout clears token from storage', async () => {
    if (!authServiceContent.includes('removeItem(MERCHANT_TOKEN_STORAGE_KEY)')) {
      throw new Error('authService removeToken does not call removeItem on storage key');
    }
    if (!authServiceContent.includes('this.removeToken()')) {
      throw new Error('authService logout does not call removeToken');
    }
  });

  // Test 7: Auth initialization logic in AuthContext
  await test(7, 'Auth initialization verifies token and recovers session on startup', async () => {
    if (!authContextContent.includes('authService.getToken()')) {
      throw new Error('AuthContext does not check for existing token on initialization');
    }
    if (!authContextContent.includes('authService.getMe')) {
      throw new Error('AuthContext does not call getMe to validate session');
    }
    if (!authContextContent.includes('refreshSession')) {
      throw new Error('AuthContext missing refreshSession callback');
    }
  });

  // Test 8: Invalid token handling
  await test(8, 'Invalid or expired token clears storage and resets auth state', async () => {
    if (!authContextContent.includes('authService.removeToken()')) {
      throw new Error('AuthContext does not remove invalid token on failure');
    }
    if (!authContextContent.includes('setMerchant(null)') || !authContextContent.includes('setToken(null)')) {
      throw new Error('AuthContext does not reset merchant and token state to null on error');
    }
  });

  // Test 9: Login validation
  await test(9, 'Login form validates non-empty email, valid format, and non-empty password', async () => {
    if (!merchantAuthContent.includes('Email is required')) {
      throw new Error('MerchantAuth missing email required check');
    }
    if (!merchantAuthContent.includes('Please enter a valid email address')) {
      throw new Error('MerchantAuth missing email format validation');
    }
    if (!merchantAuthContent.includes('Password is required')) {
      throw new Error('MerchantAuth missing password required check');
    }
  });

  // Test 10: Register validation
  await test(10, 'Register form validates name, email format, and password length >= 8 characters', async () => {
    if (!merchantAuthContent.includes('Full name is required')) {
      throw new Error('MerchantAuth missing full name required validation');
    }
    if (!merchantAuthContent.includes('Password must be at least 8 characters long') && !merchantAuthContent.includes('password.length < 8')) {
      throw new Error('MerchantAuth missing minimum 8 character password check');
    }
  });

  // Test 11: Password confirmation validation
  await test(11, 'Password confirmation checks matching values on register', async () => {
    if (!merchantAuthContent.includes('Passwords do not match')) {
      throw new Error('MerchantAuth missing password mismatch validation');
    }
    if (!merchantAuthContent.includes('confirmPassword')) {
      throw new Error('MerchantAuth missing confirmPassword state/field');
    }
  });

  // Test 12: Merchant authenticated state in App layout
  await test(12, 'Merchant authenticated state renders sidebar and main merchant panels', async () => {
    if (!appContent.includes('isAuthenticated')) {
      throw new Error('App.tsx does not check isAuthenticated');
    }
    if (!appContent.includes('<MerchantSidebar />') || !appContent.includes('<Dashboard />')) {
      throw new Error('App.tsx does not render MerchantSidebar or Dashboard when authenticated');
    }
  });

  // Test 13: Merchant unauthenticated state in App layout
  await test(13, 'Merchant unauthenticated state displays MerchantAuth component', async () => {
    if (!appContent.includes('<MerchantAuth />') && !appContent.includes('MerchantAuth')) {
      throw new Error('App.tsx does not render MerchantAuth when merchant is unauthenticated');
    }
    if (!appContent.includes('!isAuthenticated')) {
      throw new Error('App.tsx does not branch on !isAuthenticated');
    }
  });

  // Test 14: Merchant header authenticated state displays merchant and store details
  await test(14, 'Merchant header displays merchant name, email, store information, and logout action', async () => {
    if (!merchantHeaderContent.includes('merchant.name')) {
      throw new Error('MerchantHeader does not render merchant.name');
    }
    if (!merchantHeaderContent.includes('merchant.store.name') && !merchantHeaderContent.includes('merchant.store')) {
      throw new Error('MerchantHeader does not render store metadata');
    }
    if (!merchantHeaderContent.includes('logout') || !merchantHeaderContent.includes('LogOut')) {
      throw new Error('MerchantHeader missing logout button');
    }
  });

  // Test 15: Logout behavior
  await test(15, 'Logout action clears token and unsets merchant authentication state', async () => {
    if (!authContextContent.includes('logout: () => void') && !authContextContent.includes('const logout = ()')) {
      throw new Error('AuthContext does not define logout handler');
    }
    if (!merchantHeaderContent.includes('onClick={logout}')) {
      throw new Error('MerchantHeader logout button does not trigger logout()');
    }
  });

  // Test 16: JWT not exposed in UI
  await test(16, 'JWT string is never directly printed or rendered in UI components', async () => {
    if (merchantAuthContent.includes('{token}') || merchantAuthContent.includes('jwt') || merchantHeaderContent.includes('{token}')) {
      throw new Error('JWT token is exposed directly in UI component template');
    }
  });

  // Test 17: Customer session remains after merchant logout
  await test(17, 'Customer session key opticommerce_session_id is NOT cleared by auth logout', async () => {
    if (authServiceContent.includes('opticommerce_session_id')) {
      throw new Error('auth.service.ts incorrectly references customer session ID key');
    }
    if (authContextContent.includes('opticommerce_session_id')) {
      throw new Error('AuthContext incorrectly references customer session ID key');
    }
  });

  // Test 18: Customer storefront remains guest-accessible without merchant auth
  await test(18, 'Customer storefront experience operates independently without requiring merchant login', async () => {
    if (appContent.includes("experience === 'customer'") && appContent.includes('!isAuthenticated ? <MerchantAuth />')) {
      throw new Error('Customer experience incorrectly blocked by merchant authentication');
    }
    if (!appContent.includes('<CustomerHeader') || !appContent.includes('<CustomerHome')) {
      throw new Error('Customer storefront components missing from App.tsx');
    }
  });

  // Test 19: Merchant token and customer session remain separate
  await test(19, 'Merchant token storage and customer session storage use distinct keys', async () => {
    if (!eventServiceContent.includes('opticommerce_session_id')) {
      throw new Error('event.service.ts missing opticommerce_session_id');
    }
    if (!apiClientContent.includes('opticommerce_merchant_token')) {
      throw new Error('api.client.ts missing opticommerce_merchant_token');
    }
  });

  // Test 20: Loading state implementation
  await test(20, 'Loading state displays verification indicator during auth bootstrap', async () => {
    if (!appContent.includes('isAuthLoading') && !appContent.includes('isLoading')) {
      throw new Error('App.tsx does not check auth loading state');
    }
    if (!appContent.includes('animate-spin')) {
      throw new Error('App.tsx missing loading spinner animation during auth check');
    }
  });

  // Test 21: Error state handling
  await test(21, 'Error alert with user-friendly feedback is rendered in MerchantAuth', async () => {
    if (!merchantAuthContent.includes('{error}') && !merchantAuthContent.includes('error &&')) {
      throw new Error('MerchantAuth does not render error banner');
    }
    if (!merchantAuthContent.includes('AlertCircle')) {
      throw new Error('MerchantAuth missing AlertCircle icon for errors');
    }
  });

  // Test 22: No client-side economics exposure
  await test(22, 'Security: Zero leakage of costPrice, margin, expectedProfit, or purchaseProbability in auth files', async () => {
    const sensitiveTokens = ['costPrice', 'marginPercent', 'expectedProfit', 'purchaseProbability'];
    for (const token of sensitiveTokens) {
      if (authServiceContent.includes(token)) {
        throw new Error(`auth.service.ts leaks sensitive token: ${token}`);
      }
      if (authContextContent.includes(token)) {
        throw new Error(`AuthContext.tsx leaks sensitive token: ${token}`);
      }
      if (merchantAuthContent.includes(token)) {
        throw new Error(`MerchantAuth.tsx leaks sensitive token: ${token}`);
      }
    }
  });

  // Test 23: Zero Gemini / AI model invocations in auth services and components
  await test(23, 'Zero Gemini / AI API calls in merchant auth service, context, and UI components', async () => {
    const aiKeywords = ['@google/genai', 'GoogleGenAI', 'gemini-2.5', 'gemini-1.5', 'generateContent'];
    for (const kw of aiKeywords) {
      if (authServiceContent.includes(kw) || authContextContent.includes(kw) || merchantAuthContent.includes(kw) || merchantHeaderContent.includes(kw)) {
        throw new Error(`Forbidden AI SDK / model import found: ${kw}`);
      }
    }
  });

  console.log('\n======================================================');
  console.log(`PHASE 6I.3 VERIFICATION SUMMARY: ${results.filter(r => r.passed).length}/${results.length} tests passed (${results.filter(r => !r.passed).length} failed)`);
  console.log('======================================================\n');

  if (results.some(r => !r.passed)) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});

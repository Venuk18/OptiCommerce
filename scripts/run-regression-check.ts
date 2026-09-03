import { prisma } from '../server/db/prisma';
import { signMerchantToken } from '../server/utils/jwt';

async function runRegression() {
  const baseUrl = 'http://localhost:3000';
  console.log('=== RUNNING PHASE 3B REGRESSION CHECK ON PORT 3000 ===\n');

  // 1. Health Check
  console.log('1. Testing GET /api/health ...');
  const healthRes = await fetch(`${baseUrl}/api/health`);
  const health = await healthRes.json();
  console.log('   Status:', healthRes.status, health);
  if (healthRes.status !== 200 || !health.success) throw new Error('Health check failed');

  // 2. Merchant API (Create & Get)
  console.log('\n2. Testing Merchant APIs (POST /api/merchants & GET /api/merchants/:id) ...');
  const testMerchantEmail = `reg_${Date.now()}@opticommerce.io`;
  const createMerchantRes = await fetch(`${baseUrl}/api/merchants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Regression Merchant', email: testMerchantEmail }),
  });
  const createdMerchant = await createMerchantRes.json();
  console.log('   Create Merchant Status:', createMerchantRes.status, createdMerchant.data?.id);
  if (createMerchantRes.status !== 201 || !createdMerchant.success) throw new Error('Create Merchant failed');
  const merchantId = createdMerchant.data.id;

  const merchantToken = signMerchantToken(merchantId);
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${merchantToken}`,
  };

  const getMerchantRes = await fetch(`${baseUrl}/api/merchants/${merchantId}`, {
    headers: authHeaders,
  });
  const getMerchant = await getMerchantRes.json();
  console.log('   Get Merchant Status:', getMerchantRes.status, getMerchant.data?.name);
  if (getMerchantRes.status !== 200 || !getMerchant.success) throw new Error('Get Merchant failed');

  // 3. Store API (Create, Get by Slug, Update, Status Update)
  console.log('\n3. Testing Store APIs (POST, GET :slug, PUT :id, PATCH :id/status) ...');
  const storeSlug = `reg-store-${Date.now()}`;
  const createStoreRes = await fetch(`${baseUrl}/api/stores`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      merchantId,
      name: 'Regression Store',
      slug: storeSlug,
      description: 'Store for unified server regression',
    }),
  });
  const createdStore = await createStoreRes.json();
  console.log('   Create Store Status:', createStoreRes.status, createdStore.data?.id);
  if (createStoreRes.status !== 201 || !createdStore.success) throw new Error('Create Store failed');
  const storeId = createdStore.data.id;

  const getStoreSlugRes = await fetch(`${baseUrl}/api/stores/${storeSlug}`);
  const getStoreSlug = await getStoreSlugRes.json();
  console.log('   Get Store by Slug Status:', getStoreSlugRes.status, getStoreSlug.data?.name);
  if (getStoreSlugRes.status !== 200 || !getStoreSlug.success) throw new Error('Get Store by slug failed');

  const updateStoreRes = await fetch(`${baseUrl}/api/stores/${storeId}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ name: 'Regression Store Updated', description: 'Updated description' }),
  });
  const updatedStore = await updateStoreRes.json();
  console.log('   Update Store Status:', updateStoreRes.status, updatedStore.data?.name);
  if (updateStoreRes.status !== 200 || !updatedStore.success) throw new Error('Update Store failed');

  const patchStoreStatusRes = await fetch(`${baseUrl}/api/stores/${storeId}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'PUBLISHED' }),
  });
  const patchedStore = await patchStoreStatusRes.json();
  console.log('   Patch Store Status:', patchStoreStatusRes.status, patchedStore.data?.status);
  if (patchStoreStatusRes.status !== 200 || patchedStore.data?.status !== 'PUBLISHED') throw new Error('Patch Store status failed');

  // 4. Product API (POST, GET, GET :id, PUT :id, PATCH :id/status, DELETE :id)
  console.log('\n4. Testing Product APIs ...');
  const createProductRes = await fetch(`${baseUrl}/api/products`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      storeId,
      name: 'Regression Product',
      description: 'Testing unified server',
      category: 'Electronics',
      price: 1999.99,
      costPrice: 1200.0,
      stock: 30,
      images: ['https://example.com/p1.png'],
      features: ['Wireless', 'ANC'],
      specifications: { weight: '200g' },
      tags: ['gadget', 'audio'],
      status: 'DRAFT',
    }),
  });
  const createdProduct = await createProductRes.json();
  console.log('   Create Product Status:', createProductRes.status, createdProduct.data?.id);
  if (createProductRes.status !== 201 || !createdProduct.success) throw new Error('Create Product failed');
  const productId = createdProduct.data.id;

  const getProductsRes = await fetch(`${baseUrl}/api/products?storeId=${storeId}`);
  const getProducts = await getProductsRes.json();
  console.log('   Get Products (Filter by storeId) Count:', getProducts.data?.length);
  if (getProductsRes.status !== 200 || getProducts.data?.length !== 1) throw new Error('Get Products failed');

  const getProductByIdRes = await fetch(`${baseUrl}/api/products/${productId}`);
  const getProductById = await getProductByIdRes.json();
  console.log('   Get Product By ID Status:', getProductByIdRes.status, getProductById.data?.name);
  if (getProductByIdRes.status !== 200 || !getProductById.success) throw new Error('Get Product by ID failed');

  const updateProductRes = await fetch(`${baseUrl}/api/products/${productId}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ name: 'Regression Product Updated', price: 2199.99 }),
  });
  const updatedProduct = await updateProductRes.json();
  console.log('   Update Product Status:', updateProductRes.status, updatedProduct.data?.name, updatedProduct.data?.price);
  if (updateProductRes.status !== 200 || Number(updatedProduct.data?.price) !== 2199.99) throw new Error('Update Product failed');

  const patchProductStatusRes = await fetch(`${baseUrl}/api/products/${productId}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'PUBLISHED' }),
  });
  const patchedProduct = await patchProductStatusRes.json();
  console.log('   Patch Product Status:', patchProductStatusRes.status, patchedProduct.data?.status);
  if (patchProductStatusRes.status !== 200 || patchedProduct.data?.status !== 'PUBLISHED') throw new Error('Patch Product status failed');

  const deleteProductRes = await fetch(`${baseUrl}/api/products/${productId}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  const deleteProduct = await deleteProductRes.json();
  console.log('   Delete Product Status:', deleteProductRes.status, deleteProduct.data?.deleted);
  if (deleteProductRes.status !== 200 || !deleteProduct.success) throw new Error('Delete Product failed');

  // 5. Existing Flagship Data Reading
  console.log('\n5. Testing Existing Flagship Data in Supabase ...');
  const flagshipStoreRes = await fetch(`${baseUrl}/api/stores/opticommerce-flagship-electronics`);
  const flagshipStore = await flagshipStoreRes.json();
  console.log('   Flagship Store:', flagshipStore.success, flagshipStore.data?.name);
  if (!flagshipStore.success || !flagshipStore.data?.id) throw new Error('Flagship Store fetch failed');

  // 6. Frontend HTML loading
  console.log('\n6. Testing Frontend HTML delivery ...');
  const frontendRes = await fetch(`${baseUrl}/`);
  const html = await frontendRes.text();
  console.log('   Frontend Status:', frontendRes.status, 'Has DOCTYPE/root:', html.toLowerCase().includes('<!doctype html>') || html.includes('id="root"'));
  if (frontendRes.status !== 200 || !html.toLowerCase().includes('<!doctype html>')) throw new Error('Frontend delivery failed');

  // Cleanup regression test store & merchant
  console.log('\n7. Cleaning up test data ...');
  await prisma.store.deleteMany({ where: { id: storeId } });
  await prisma.merchant.deleteMany({ where: { id: merchantId } });
  await prisma.$disconnect();

  console.log('\n========================================================');
  console.log('ALL REGRESSION CHECKS PASSED ON PORT 3000!');
  console.log('========================================================');
}

runRegression().catch(async (err) => {
  console.error('REGRESSION FAILURE:', err);
  await prisma.$disconnect();
  process.exit(1);
});

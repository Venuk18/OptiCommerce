import { DbProduct, Product } from '../types';

export function mapDbProductToProduct(dbProduct: DbProduct): Product {
  const price = Number(dbProduct.price) || 0;
  const costPrice = Number(dbProduct.costPrice) || 0;
  const marginPercent = price > 0 ? Math.round(((price - costPrice) / price) * 100) : 0;
  const image =
    dbProduct.images && dbProduct.images.length > 0 && dbProduct.images[0]
      ? dbProduct.images[0]
      : 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80';

  const specs: Record<string, string> = {};
  if (dbProduct.specifications && typeof dbProduct.specifications === 'object') {
    Object.entries(dbProduct.specifications).forEach(([k, v]) => {
      if (v !== null && v !== undefined) {
        specs[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
      }
    });
  }

  return {
    id: dbProduct.id,
    name: dbProduct.name,
    category: dbProduct.category,
    brand: dbProduct.brand || null,
    basePrice: price,
    costPrice,
    marginPercent,
    stock: dbProduct.stock,
    rating: 4.8,
    ratingCount: 24,
    image,
    images: dbProduct.images && dbProduct.images.length > 0 ? dbProduct.images : [image],
    description: dbProduct.description || '',
    features: dbProduct.features || [],
    specifications: dbProduct.specifications || null,
    specs: Object.keys(specs).length > 0 ? specs : undefined,
    tags: dbProduct.tags || [],
    status: dbProduct.status,
    aiDiscountEligible: true,
    activeDiscountPercent: 0,
    isLive: dbProduct.status === 'PUBLISHED' && dbProduct.stock > 0,
    storeId: dbProduct.storeId,
    matchScore: 95,
    matchReason: dbProduct.description || 'Optimal match for your specifications.',
    matchBadge: '95% Match',
  };
}

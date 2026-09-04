import { prisma } from '../db/prisma';
import { AppError } from '../errors/app.error';
import { AddCartItemInput, UpdateCartItemInput, CartResponseData, CartItemResponse } from '../types/cart.types';

export class CartService {
  /**
   * Helper to format a Cart record with its items into customer-safe CartResponseData
   */
  private formatCart(cart: any, sessionId: string, storeId: string, lastAddedProductId?: string): CartResponseData {
    if (!cart) {
      return {
        id: null,
        sessionId,
        storeId,
        items: [],
        subtotal: 0,
        discount: 0,
        total: 0,
        itemCount: 0,
        lastAddedProductId: lastAddedProductId || null,
      };
    }

    const items: CartItemResponse[] = (cart.items || []).map((item: any) => {
      const product = item.product;
      const unitPrice = Number(product.price);
      const quantity = item.quantity;
      const lineTotal = Math.round(unitPrice * quantity);
      const isPurchasableStatus = product.status === 'PUBLISHED' || product.status === 'LOW_STOCK';
      const inStock = isPurchasableStatus && product.stock >= quantity && product.stock > 0;

      return {
        id: item.id,
        productId: product.id,
        name: product.name,
        quantity,
        unitPrice,
        lineTotal,
        image: Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : '',
        category: product.category,
        inStock,
        availableStock: product.stock,
        status: product.status,
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const discount = 0; // Baseline server-authoritative discount
    const total = Math.max(0, subtotal - discount);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      id: cart.id,
      sessionId: cart.sessionId,
      storeId: cart.storeId,
      items,
      subtotal,
      discount,
      total,
      itemCount,
      lastAddedProductId: lastAddedProductId || null,
    };
  }

  /**
   * GET /api/cart - Retrieve customer cart by sessionId and storeId
   */
  async getCart(sessionId: string, storeId: string): Promise<CartResponseData> {
    if (!sessionId || !sessionId.trim()) {
      throw new AppError('sessionId is required', 400);
    }
    if (!storeId || !storeId.trim()) {
      throw new AppError('storeId is required', 400);
    }

    const cart = await prisma.cart.findUnique({
      where: {
        sessionId_storeId: {
          sessionId: sessionId.trim(),
          storeId: storeId.trim(),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    return this.formatCart(cart, sessionId.trim(), storeId.trim());
  }

  /**
   * POST /api/cart/items - Add a product to the cart
   */
  async addItem(input: AddCartItemInput): Promise<CartResponseData> {
    const { sessionId, storeId, productId, quantity = 1 } = input;

    if (!sessionId || !sessionId.trim()) {
      throw new AppError('sessionId is required', 400);
    }
    if (!storeId || !storeId.trim()) {
      throw new AppError('storeId is required', 400);
    }
    if (!productId || !productId.trim()) {
      throw new AppError('productId is required', 400);
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new AppError('Quantity must be a positive integer', 400);
    }

    // 1. Verify store exists
    const store = await prisma.store.findUnique({
      where: { id: storeId.trim() },
    });
    if (!store) {
      throw new AppError(`Store '${storeId}' not found`, 404);
    }

    // 2. Verify product exists and belongs to store
    const product = await prisma.product.findUnique({
      where: { id: productId.trim() },
    });
    if (!product) {
      throw new AppError(`Product '${productId}' not found`, 404);
    }
    if (product.storeId !== store.id) {
      throw new AppError(`Product does not belong to the requested store`, 400);
    }

    // 3. Verify product purchasability
    if (product.status === 'OUT_OF_STOCK' || product.stock <= 0) {
      throw new AppError(`Product '${product.name}' is currently out of stock`, 400);
    }
    if (product.status === 'DRAFT' || product.status === 'ARCHIVED') {
      throw new AppError(`Product '${product.name}' is not available for purchase`, 400);
    }

    // 4. Ensure Cart exists for sessionId + storeId
    const cart = await prisma.cart.upsert({
      where: {
        sessionId_storeId: {
          sessionId: sessionId.trim(),
          storeId: store.id,
        },
      },
      update: {},
      create: {
        sessionId: sessionId.trim(),
        storeId: store.id,
      },
    });

    // 5. Check if item already exists in this cart
    const existingItem = await prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: product.id,
        },
      },
    });

    const targetQuantity = (existingItem?.quantity || 0) + quantity;

    // 6. Verify total quantity against available stock
    if (targetQuantity > product.stock) {
      throw new AppError(
        `Requested quantity (${targetQuantity}) exceeds available stock (${product.stock}) for '${product.name}'`,
        400
      );
    }

    // 7. Upsert CartItem
    if (existingItem) {
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: targetQuantity },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: product.id,
          quantity: targetQuantity,
        },
      });
    }

    // 8. Return refreshed cart
    return this.getCartWithLastAdded(sessionId.trim(), store.id, product.id);
  }

  /**
   * PATCH /api/cart/items/:itemId - Update quantity for a cart item
   */
  async updateItemQuantity(itemId: string, input: UpdateCartItemInput): Promise<CartResponseData> {
    const { sessionId, storeId, quantity } = input;

    if (!itemId || !itemId.trim()) {
      throw new AppError('itemId is required', 400);
    }
    if (!sessionId || !sessionId.trim()) {
      throw new AppError('sessionId is required', 400);
    }
    if (!storeId || !storeId.trim()) {
      throw new AppError('storeId is required', 400);
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new AppError('Quantity must be a positive integer (>= 1). Use DELETE to remove the item.', 400);
    }

    // 1. Locate CartItem and verify ownership through cart
    const cartItem = await prisma.cartItem.findUnique({
      where: { id: itemId.trim() },
      include: {
        cart: true,
        product: true,
      },
    });

    if (!cartItem) {
      throw new AppError(`Cart item '${itemId}' not found`, 404);
    }

    const cart = cartItem.cart || (await prisma.cart.findUnique({ where: { id: cartItem.cartId } }));
    if (!cart) {
      throw new AppError('Cart not found for item', 404);
    }

    if (cart.sessionId !== sessionId.trim() || cart.storeId !== storeId.trim()) {
      throw new AppError(`Cart item does not belong to the active session and store`, 404);
    }

    // 2. Validate product stock and status
    const product = cartItem.product;
    if (product.status === 'OUT_OF_STOCK' || product.stock <= 0) {
      throw new AppError(`Product '${product.name}' is currently out of stock`, 400);
    }
    if (product.status === 'DRAFT' || product.status === 'ARCHIVED') {
      throw new AppError(`Product '${product.name}' is no longer available`, 400);
    }
    if (quantity > product.stock) {
      throw new AppError(
        `Requested quantity (${quantity}) exceeds available stock (${product.stock}) for '${product.name}'`,
        400
      );
    }

    // 3. Update quantity
    await prisma.cartItem.update({
      where: { id: cartItem.id },
      data: { quantity },
    });

    return this.getCart(sessionId.trim(), storeId.trim());
  }

  /**
   * DELETE /api/cart/items/:itemId - Remove single item from cart
   */
  async removeItem(itemId: string, sessionId: string, storeId: string): Promise<CartResponseData> {
    if (!itemId || !itemId.trim()) {
      throw new AppError('itemId is required', 400);
    }
    if (!sessionId || !sessionId.trim()) {
      throw new AppError('sessionId is required', 400);
    }
    if (!storeId || !storeId.trim()) {
      throw new AppError('storeId is required', 400);
    }

    const cartItem = await prisma.cartItem.findUnique({
      where: { id: itemId.trim() },
      include: {
        cart: true,
      },
    });

    if (!cartItem) {
      throw new AppError(`Cart item '${itemId}' not found`, 404);
    }

    const cart = cartItem.cart || (await prisma.cart.findUnique({ where: { id: cartItem.cartId } }));
    if (!cart) {
      throw new AppError('Cart not found for item', 404);
    }

    if (cart.sessionId !== sessionId.trim() || cart.storeId !== storeId.trim()) {
      throw new AppError(`Cart item does not belong to the active session and store`, 404);
    }

    await prisma.cartItem.delete({
      where: { id: cartItem.id },
    });

    return this.getCart(sessionId.trim(), storeId.trim());
  }

  /**
   * DELETE /api/cart - Clear all items for session and store
   */
  async clearCart(sessionId: string, storeId: string): Promise<CartResponseData> {
    if (!sessionId || !sessionId.trim()) {
      throw new AppError('sessionId is required', 400);
    }
    if (!storeId || !storeId.trim()) {
      throw new AppError('storeId is required', 400);
    }

    const cart = await prisma.cart.findUnique({
      where: {
        sessionId_storeId: {
          sessionId: sessionId.trim(),
          storeId: storeId.trim(),
        },
      },
    });

    if (cart) {
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id },
      });
    }

    return this.getCart(sessionId.trim(), storeId.trim());
  }

  private async getCartWithLastAdded(sessionId: string, storeId: string, lastAddedProductId: string): Promise<CartResponseData> {
    const cart = await prisma.cart.findUnique({
      where: {
        sessionId_storeId: {
          sessionId,
          storeId,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    return this.formatCart(cart, sessionId, storeId, lastAddedProductId);
  }
}

export const cartService = new CartService();

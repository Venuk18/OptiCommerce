import { prisma } from '../db/prisma';
import { AppError } from '../errors/app.error';
import { AddCartItemInput, UpdateCartItemInput, MergeCartInput, CartResponseData, CartItemResponse } from '../types/cart.types';

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
        customerId: null,
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
      customerId: cart.customerId || null,
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
   * If customerId is provided, resolves customer-owned cart first.
   * If guest requests a customer-owned cart without customer auth, returns an empty guest cart.
   */
  async getCart(sessionId: string, storeId: string, customerId?: string | null): Promise<CartResponseData> {
    if (!storeId || !storeId.trim()) {
      throw new AppError('storeId is required', 400);
    }

    const cleanStoreId = storeId.trim();
    const cleanSessionId = (sessionId || '').trim();
    const cleanCustomerId = customerId && customerId.trim() ? customerId.trim() : null;

    // 1. If authenticated customer, resolve customer-owned cart first
    if (cleanCustomerId) {
      const customerCart = await prisma.cart.findFirst({
        where: {
          customerId: cleanCustomerId,
          storeId: cleanStoreId,
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

      if (customerCart) {
        return this.formatCart(customerCart, cleanSessionId || customerCart.sessionId, cleanStoreId);
      }
    }

    // 2. Otherwise look up cart by sessionId and storeId
    if (cleanSessionId) {
      const sessionCart = await prisma.cart.findUnique({
        where: {
          sessionId_storeId: {
            sessionId: cleanSessionId,
            storeId: cleanStoreId,
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

      if (sessionCart) {
        // Customer Cart Authorization:
        // A guest session cannot access a customer-owned cart merely by knowing a cart/session identifier
        if (sessionCart.customerId) {
          if (!cleanCustomerId || sessionCart.customerId !== cleanCustomerId) {
            return this.formatCart(null, cleanSessionId, cleanStoreId);
          }
        }
        return this.formatCart(sessionCart, cleanSessionId, cleanStoreId);
      }
    }

    return this.formatCart(null, cleanSessionId, cleanStoreId);
  }

  /**
   * POST /api/cart/items - Add a product to the cart
   */
  async addItem(input: AddCartItemInput): Promise<CartResponseData> {
    const { sessionId, storeId, productId, quantity = 1, customerId } = input;

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

    const cleanCustomerId = customerId && customerId.trim() ? customerId.trim() : null;

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

    // 4. Resolve active Cart
    let cart = cleanCustomerId
      ? await prisma.cart.findFirst({
          where: {
            customerId: cleanCustomerId,
            storeId: store.id,
          },
        })
      : null;

    if (!cart) {
      const existingSessionCart = await prisma.cart.findUnique({
        where: {
          sessionId_storeId: {
            sessionId: sessionId.trim(),
            storeId: store.id,
          },
        },
      });

      if (existingSessionCart) {
        if (existingSessionCart.customerId && cleanCustomerId && existingSessionCart.customerId !== cleanCustomerId) {
          throw new AppError('Unauthorized: Cart belongs to another customer', 403);
        }
        if (existingSessionCart.customerId && !cleanCustomerId) {
          throw new AppError('Unauthorized: Cannot modify a customer-owned cart without customer authentication', 403);
        }
        if (!existingSessionCart.customerId && cleanCustomerId) {
          cart = await prisma.cart.update({
            where: { id: existingSessionCart.id },
            data: { customerId: cleanCustomerId },
          });
        } else {
          cart = existingSessionCart;
        }
      } else {
        cart = await prisma.cart.create({
          data: {
            sessionId: sessionId.trim(),
            storeId: store.id,
            customerId: cleanCustomerId,
          },
        });
      }
    }

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
    return this.getCartWithLastAdded(sessionId.trim(), store.id, product.id, cleanCustomerId);
  }

  /**
   * PATCH /api/cart/items/:itemId - Update quantity for a cart item
   */
  async updateItemQuantity(itemId: string, input: UpdateCartItemInput): Promise<CartResponseData> {
    const { sessionId, storeId, quantity, customerId } = input;

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

    const cleanCustomerId = customerId && customerId.trim() ? customerId.trim() : null;

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

    if (cart.storeId !== storeId.trim()) {
      throw new AppError(`Cart item does not belong to the requested store`, 404);
    }

    // Cart Authorization
    if (cart.customerId) {
      if (!cleanCustomerId || cart.customerId !== cleanCustomerId) {
        throw new AppError(`Unauthorized: Cannot modify a cart belonging to another customer`, 403);
      }
    } else {
      if (cart.sessionId !== sessionId.trim()) {
        throw new AppError(`Cart item does not belong to the active session and store`, 404);
      }
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

    return this.getCart(sessionId.trim(), storeId.trim(), cleanCustomerId);
  }

  /**
   * DELETE /api/cart/items/:itemId - Remove single item from cart
   */
  async removeItem(itemId: string, sessionId: string, storeId: string, customerId?: string | null): Promise<CartResponseData> {
    if (!itemId || !itemId.trim()) {
      throw new AppError('itemId is required', 400);
    }
    if (!sessionId || !sessionId.trim()) {
      throw new AppError('sessionId is required', 400);
    }
    if (!storeId || !storeId.trim()) {
      throw new AppError('storeId is required', 400);
    }

    const cleanCustomerId = customerId && customerId.trim() ? customerId.trim() : null;

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

    if (cart.storeId !== storeId.trim()) {
      throw new AppError(`Cart item does not belong to the requested store`, 404);
    }

    // Cart Authorization
    if (cart.customerId) {
      if (!cleanCustomerId || cart.customerId !== cleanCustomerId) {
        throw new AppError(`Unauthorized: Cannot modify a cart belonging to another customer`, 403);
      }
    } else {
      if (cart.sessionId !== sessionId.trim()) {
        throw new AppError(`Cart item does not belong to the active session and store`, 404);
      }
    }

    await prisma.cartItem.delete({
      where: { id: cartItem.id },
    });

    return this.getCart(sessionId.trim(), storeId.trim(), cleanCustomerId);
  }

  /**
   * DELETE /api/cart - Clear all items for session and store
   */
  async clearCart(sessionId: string, storeId: string, customerId?: string | null): Promise<CartResponseData> {
    if (!sessionId || !sessionId.trim()) {
      throw new AppError('sessionId is required', 400);
    }
    if (!storeId || !storeId.trim()) {
      throw new AppError('storeId is required', 400);
    }

    const cleanCustomerId = customerId && customerId.trim() ? customerId.trim() : null;

    const cart = cleanCustomerId
      ? await prisma.cart.findFirst({
          where: { customerId: cleanCustomerId, storeId: storeId.trim() },
        })
      : await prisma.cart.findUnique({
          where: {
            sessionId_storeId: {
              sessionId: sessionId.trim(),
              storeId: storeId.trim(),
            },
          },
        });

    if (cart) {
      if (cart.customerId && (!cleanCustomerId || cart.customerId !== cleanCustomerId)) {
        throw new AppError(`Unauthorized: Cannot clear a cart belonging to another customer`, 403);
      }
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id },
      });
    }

    return this.getCart(sessionId.trim(), storeId.trim(), cleanCustomerId);
  }

  /**
   * POST /api/cart/merge - Merge guest session cart into customer cart.
   * Atomically handles Case A (adoption) and Case B (quantity merge + stock capping).
   * Fully idempotent across repeated calls.
   */
  async mergeCart(input: MergeCartInput): Promise<CartResponseData> {
    const { customerId, storeId, sessionId } = input;

    if (!customerId || typeof customerId !== 'string' || !customerId.trim()) {
      throw new AppError('Unauthorized: customerId is required', 401);
    }
    if (!storeId || typeof storeId !== 'string' || !storeId.trim()) {
      throw new AppError('storeId is required', 400);
    }
    if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
      throw new AppError('sessionId is required', 400);
    }

    const cleanCustomerId = customerId.trim();
    const cleanStoreId = storeId.trim();
    const cleanSessionId = sessionId.trim();

    // 1. Verify store exists
    const store = await prisma.store.findUnique({
      where: { id: cleanStoreId },
    });
    if (!store) {
      throw new AppError('Store not found', 404);
    }

    // 2. Cross-store security check (Store A customer cannot merge Store B guest cart)
    const crossStoreCart = await prisma.cart.findFirst({
      where: {
        sessionId: cleanSessionId,
        storeId: { not: cleanStoreId },
      },
    });

    // 3. Find guest cart for (cleanSessionId, cleanStoreId)
    const guestCart = await prisma.cart.findUnique({
      where: {
        sessionId_storeId: {
          sessionId: cleanSessionId,
          storeId: cleanStoreId,
        },
      },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (crossStoreCart && !guestCart) {
      throw new AppError('Cross-store cart merge is not allowed', 403);
    }

    // 4. Validate guest cart ownership
    if (guestCart && guestCart.customerId && guestCart.customerId !== cleanCustomerId) {
      throw new AppError('Unauthorized: Cart belongs to another customer', 403);
    }

    // 5. Look up existing customer cart for (cleanCustomerId, cleanStoreId)
    const customerCart = await prisma.cart.findFirst({
      where: {
        customerId: cleanCustomerId,
        storeId: cleanStoreId,
      },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    // 6. Idempotency Checks
    // 6a. Customer already adopted this guest cart
    if (guestCart && guestCart.customerId === cleanCustomerId) {
      return this.formatCart(guestCart, cleanSessionId, cleanStoreId);
    }
    // 6b. Customer cart and guest cart are identical
    if (customerCart && guestCart && customerCart.id === guestCart.id) {
      return this.formatCart(customerCart, cleanSessionId, cleanStoreId);
    }
    // 6c. No guest cart to merge
    if (!guestCart) {
      if (customerCart) {
        return this.formatCart(customerCart, customerCart.sessionId, cleanStoreId);
      }
      return this.formatCart(null, cleanSessionId, cleanStoreId);
    }

    // 7. Atomic Merge via transaction
    await prisma.$transaction(async (tx: any) => {
      if (!customerCart) {
        // ==============================================================
        // CASE A: Customer has NO existing cart in this store -> Adopt guest cart
        // ==============================================================
        for (const item of guestCart.items) {
          const product = item.product;
          const isPurchasable =
            product &&
            product.storeId === cleanStoreId &&
            (product.status === 'PUBLISHED' || product.status === 'LOW_STOCK') &&
            product.stock > 0;

          if (!isPurchasable) {
            // Drop out-of-stock or unpurchasable item
            await tx.cartItem.delete({ where: { id: item.id } });
          } else if (item.quantity > product.stock) {
            // Cap quantity to available inventory
            await tx.cartItem.update({
              where: { id: item.id },
              data: { quantity: product.stock },
            });
          }
        }

        // Adopt guest cart by assigning customerId
        await tx.cart.update({
          where: { id: guestCart.id },
          data: { customerId: cleanCustomerId },
        });
      } else {
        // ==============================================================
        // CASE B: Customer ALREADY HAS a cart in this store -> Merge items into customer cart
        // ==============================================================
        for (const guestItem of guestCart.items) {
          const product = guestItem.product;
          const isPurchasable =
            product &&
            product.storeId === cleanStoreId &&
            (product.status === 'PUBLISHED' || product.status === 'LOW_STOCK') &&
            product.stock > 0;

          if (!isPurchasable) {
            continue; // Skip invalid or out-of-stock products
          }

          const existingCustItem = customerCart.items.find((ci: any) => ci.productId === guestItem.productId);
          if (existingCustItem) {
            // Combine quantities and cap at available stock
            const combinedQty = existingCustItem.quantity + guestItem.quantity;
            const finalQty = Math.min(combinedQty, product.stock);
            await tx.cartItem.update({
              where: { id: existingCustItem.id },
              data: { quantity: finalQty },
            });
          } else {
            // Add new product item capped at available stock
            const finalQty = Math.min(guestItem.quantity, product.stock);
            await tx.cartItem.create({
              data: {
                cartId: customerCart.id,
                productId: guestItem.productId,
                quantity: finalQty,
              },
            });
          }
        }

        // Delete redundant guest cart and items
        await tx.cartItem.deleteMany({ where: { cartId: guestCart.id } });
        await tx.cart.delete({ where: { id: guestCart.id } });
      }
    });

    // 8. Return authoritative resulting cart
    return this.getCart(cleanSessionId, cleanStoreId, cleanCustomerId);
  }

  private async getCartWithLastAdded(
    sessionId: string,
    storeId: string,
    lastAddedProductId: string,
    customerId?: string | null
  ): Promise<CartResponseData> {
    const formatted = await this.getCart(sessionId, storeId, customerId);
    return {
      ...formatted,
      lastAddedProductId,
    };
  }
}

export const cartService = new CartService();


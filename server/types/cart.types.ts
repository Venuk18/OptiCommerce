export interface AddCartItemInput {
  sessionId: string;
  storeId: string;
  productId: string;
  quantity?: number;
  customerId?: string | null;
}

export interface UpdateCartItemInput {
  sessionId: string;
  storeId: string;
  quantity: number;
  customerId?: string | null;
}

export interface MergeCartInput {
  customerId: string;
  storeId: string;
  sessionId: string;
}

export interface CartItemResponse {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  image: string;
  category: string;
  inStock: boolean;
  availableStock: number;
  status: string;
}

export interface CartResponseData {
  id: string | null;
  sessionId: string;
  storeId: string;
  customerId?: string | null;
  items: CartItemResponse[];
  subtotal: number;
  discount: number;
  total: number;
  itemCount: number;
  lastAddedProductId?: string | null;
}

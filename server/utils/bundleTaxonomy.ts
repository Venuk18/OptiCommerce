/**
 * Deterministic Category Normalization & Complementary Taxonomy
 * Phase 6B: Pure TypeScript + PostgreSQL (0 Gemini / AI calls)
 */

export enum ProductCategoryFamily {
  // Mobile / Phone
  MOBILE_PHONE = 'MOBILE_PHONE',
  PHONE_CASE = 'PHONE_CASE',
  SCREEN_PROTECTOR = 'SCREEN_PROTECTOR',
  CHARGER = 'CHARGER',
  CHARGING_CABLE = 'CHARGING_CABLE',
  POWER_BANK = 'POWER_BANK',
  PHONE_STAND = 'PHONE_STAND',

  // Laptop / Computer
  LAPTOP = 'LAPTOP',
  MOUSE = 'MOUSE',
  LAPTOP_BAG = 'LAPTOP_BAG',
  KEYBOARD = 'KEYBOARD',
  USB_HUB = 'USB_HUB',
  COOLING_PAD = 'COOLING_PAD',
  LAPTOP_STAND = 'LAPTOP_STAND',

  // Tablet
  TABLET = 'TABLET',
  TABLET_CASE = 'TABLET_CASE',
  STYLUS = 'STYLUS',
  TABLET_STAND = 'TABLET_STAND',

  // Camera
  CAMERA = 'CAMERA',
  MEMORY_CARD = 'MEMORY_CARD',
  CAMERA_BAG = 'CAMERA_BAG',
  TRIPOD = 'TRIPOD',
  CAMERA_STRAP = 'CAMERA_STRAP',
  SPARE_BATTERY = 'SPARE_BATTERY',

  // Audio / Earbuds / Headphones
  EARBUDS_HEADPHONES = 'EARBUDS_HEADPHONES',
  PROTECTIVE_CASE = 'PROTECTIVE_CASE',
  EAR_TIPS = 'EAR_TIPS',
  HEADPHONE_STAND = 'HEADPHONE_STAND',

  // Gaming
  GAMING_CONSOLE = 'GAMING_CONSOLE',
  CONTROLLER = 'CONTROLLER',
  GAMING_HEADSET = 'GAMING_HEADSET',
  CHARGING_DOCK = 'CHARGING_DOCK',
  GAMING_ACCESSORY = 'GAMING_ACCESSORY',

  // Footwear / Shoes
  SHOES = 'SHOES',
  SOCKS = 'SOCKS',
  INSOLES = 'INSOLES',
  SHOE_CARE = 'SHOE_CARE',
  LACES = 'LACES',

  // Clothing / Apparel
  CLOTHING = 'CLOTHING',
  BELT = 'BELT',
  WALLET = 'WALLET',
  ACCESSORIES = 'ACCESSORIES',
  MATCHING_GARMENTS = 'MATCHING_GARMENTS',

  // General / Fallback
  GENERIC_ACCESSORY = 'GENERIC_ACCESSORY',
  OTHER = 'OTHER',
}

interface RelationshipTarget {
  targetFamily: ProductCategoryFamily;
  strength: number; // 0.0 to 1.0
  defaultReason: string;
}

export const COMPLEMENTARY_RELATIONSHIP_MAP: Record<ProductCategoryFamily, RelationshipTarget[]> = {
  [ProductCategoryFamily.MOBILE_PHONE]: [
    { targetFamily: ProductCategoryFamily.SCREEN_PROTECTOR, strength: 1.0, defaultReason: 'Protects your new phone screen' },
    { targetFamily: ProductCategoryFamily.PHONE_CASE, strength: 0.95, defaultReason: 'Designed to protect your phone' },
    { targetFamily: ProductCategoryFamily.CHARGER, strength: 0.90, defaultReason: 'Useful for fast charging your device' },
    { targetFamily: ProductCategoryFamily.CHARGING_CABLE, strength: 0.85, defaultReason: 'Durable fast-charging cable for your phone' },
    { targetFamily: ProductCategoryFamily.POWER_BANK, strength: 0.80, defaultReason: 'Portable battery backup for on-the-go power' },
    { targetFamily: ProductCategoryFamily.PHONE_STAND, strength: 0.75, defaultReason: 'Ergonomic hands-free viewing stand' },
    { targetFamily: ProductCategoryFamily.EARBUDS_HEADPHONES, strength: 0.70, defaultReason: 'Pairs seamlessly for wireless calls and music' },
    { targetFamily: ProductCategoryFamily.GENERIC_ACCESSORY, strength: 0.50, defaultReason: 'Useful companion for your mobile device' },
  ],

  [ProductCategoryFamily.LAPTOP]: [
    { targetFamily: ProductCategoryFamily.MOUSE, strength: 1.0, defaultReason: 'Essential precision pointer for your laptop' },
    { targetFamily: ProductCategoryFamily.LAPTOP_BAG, strength: 0.95, defaultReason: 'Protects and carries your laptop safely' },
    { targetFamily: ProductCategoryFamily.USB_HUB, strength: 0.90, defaultReason: 'Expands your laptop ports for multi-device setup' },
    { targetFamily: ProductCategoryFamily.KEYBOARD, strength: 0.85, defaultReason: 'Ergonomic typing for your workstation' },
    { targetFamily: ProductCategoryFamily.COOLING_PAD, strength: 0.80, defaultReason: 'Keeps your laptop cool under heavy workload' },
    { targetFamily: ProductCategoryFamily.LAPTOP_STAND, strength: 0.80, defaultReason: 'Elevates your screen to an ergonomic eye level' },
    { targetFamily: ProductCategoryFamily.CHARGER, strength: 0.75, defaultReason: 'High-power travel or backup charger' },
    { targetFamily: ProductCategoryFamily.GENERIC_ACCESSORY, strength: 0.50, defaultReason: 'Complements your laptop setup' },
  ],

  [ProductCategoryFamily.TABLET]: [
    { targetFamily: ProductCategoryFamily.TABLET_CASE, strength: 1.0, defaultReason: 'Protective folio cover for your tablet' },
    { targetFamily: ProductCategoryFamily.SCREEN_PROTECTOR, strength: 0.95, defaultReason: 'Guards your tablet display from scratches' },
    { targetFamily: ProductCategoryFamily.STYLUS, strength: 0.90, defaultReason: 'Precision writing and sketching stylus' },
    { targetFamily: ProductCategoryFamily.KEYBOARD, strength: 0.85, defaultReason: 'Transforms your tablet into a productive laptop' },
    { targetFamily: ProductCategoryFamily.CHARGER, strength: 0.80, defaultReason: 'Fast charging adapter for your tablet' },
    { targetFamily: ProductCategoryFamily.TABLET_STAND, strength: 0.75, defaultReason: 'Hands-free stand for video watching and notes' },
    { targetFamily: ProductCategoryFamily.GENERIC_ACCESSORY, strength: 0.50, defaultReason: 'Enhances your tablet experience' },
  ],

  [ProductCategoryFamily.CAMERA]: [
    { targetFamily: ProductCategoryFamily.MEMORY_CARD, strength: 1.0, defaultReason: 'High-speed storage for RAW photos and 4K video' },
    { targetFamily: ProductCategoryFamily.CAMERA_BAG, strength: 0.95, defaultReason: 'Padded protective case for camera and lenses' },
    { targetFamily: ProductCategoryFamily.TRIPOD, strength: 0.90, defaultReason: 'Stabilizes your camera for crisp photos and video' },
    { targetFamily: ProductCategoryFamily.SPARE_BATTERY, strength: 0.85, defaultReason: 'Extra power for extended all-day shooting' },
    { targetFamily: ProductCategoryFamily.CAMERA_STRAP, strength: 0.80, defaultReason: 'Comfortable and secure strap for active shooting' },
    { targetFamily: ProductCategoryFamily.GENERIC_ACCESSORY, strength: 0.50, defaultReason: 'Pairs well with your camera gear' },
  ],

  [ProductCategoryFamily.EARBUDS_HEADPHONES]: [
    { targetFamily: ProductCategoryFamily.PROTECTIVE_CASE, strength: 1.0, defaultReason: 'Protective case for your audio device' },
    { targetFamily: ProductCategoryFamily.EAR_TIPS, strength: 0.95, defaultReason: 'Comfortable replacement tips for noise isolation' },
    { targetFamily: ProductCategoryFamily.CHARGER, strength: 0.85, defaultReason: 'Fast and safe charging adapter for your audio gear' },
    { targetFamily: ProductCategoryFamily.HEADPHONE_STAND, strength: 0.80, defaultReason: 'Clean desk display and storage for your headphones' },
    { targetFamily: ProductCategoryFamily.CHARGING_CABLE, strength: 0.75, defaultReason: 'Reliable fast-charging cable' },
    { targetFamily: ProductCategoryFamily.GENERIC_ACCESSORY, strength: 0.50, defaultReason: 'Useful accessory for your headphones' },
  ],

  [ProductCategoryFamily.GAMING_CONSOLE]: [
    { targetFamily: ProductCategoryFamily.CONTROLLER, strength: 1.0, defaultReason: 'Extra wireless controller for multiplayer gaming' },
    { targetFamily: ProductCategoryFamily.GAMING_HEADSET, strength: 0.95, defaultReason: 'Immersive spatial audio and team chat' },
    { targetFamily: ProductCategoryFamily.CHARGING_DOCK, strength: 0.90, defaultReason: 'Keeps your controllers charged and organized' },
    { targetFamily: ProductCategoryFamily.GAMING_ACCESSORY, strength: 0.80, defaultReason: 'Precision grips and console accessories' },
    { targetFamily: ProductCategoryFamily.GENERIC_ACCESSORY, strength: 0.50, defaultReason: 'Level up your gaming setup' },
  ],

  [ProductCategoryFamily.SHOES]: [
    { targetFamily: ProductCategoryFamily.SOCKS, strength: 1.0, defaultReason: 'Breathable cushioned socks for your new footwear' },
    { targetFamily: ProductCategoryFamily.INSOLES, strength: 0.95, defaultReason: 'All-day comfort and arch support inserts' },
    { targetFamily: ProductCategoryFamily.SHOE_CARE, strength: 0.90, defaultReason: 'Keeps your footwear fresh and protected' },
    { targetFamily: ProductCategoryFamily.LACES, strength: 0.80, defaultReason: 'Durable replacement shoelaces' },
    { targetFamily: ProductCategoryFamily.ACCESSORIES, strength: 0.50, defaultReason: 'Complements your active footwear' },
  ],

  [ProductCategoryFamily.CLOTHING]: [
    { targetFamily: ProductCategoryFamily.BELT, strength: 1.0, defaultReason: 'Classic matching belt to complete your outfit' },
    { targetFamily: ProductCategoryFamily.WALLET, strength: 0.90, defaultReason: 'Sleek matching wallet accessory' },
    { targetFamily: ProductCategoryFamily.ACCESSORIES, strength: 0.85, defaultReason: 'Stylish complementary fashion accessory' },
    { targetFamily: ProductCategoryFamily.MATCHING_GARMENTS, strength: 0.80, defaultReason: 'Comfortable coordinating layer' },
  ],

  // Inverted relationships for accessories
  [ProductCategoryFamily.PHONE_CASE]: [
    { targetFamily: ProductCategoryFamily.SCREEN_PROTECTOR, strength: 1.0, defaultReason: 'Complete 360-degree protection with a screen guard' },
    { targetFamily: ProductCategoryFamily.CHARGER, strength: 0.85, defaultReason: 'Useful for charging your phone' },
    { targetFamily: ProductCategoryFamily.CHARGING_CABLE, strength: 0.80, defaultReason: 'Fast-charging cable' },
  ],
  [ProductCategoryFamily.SCREEN_PROTECTOR]: [
    { targetFamily: ProductCategoryFamily.PHONE_CASE, strength: 1.0, defaultReason: 'Complete device protection with a matching case' },
    { targetFamily: ProductCategoryFamily.CHARGER, strength: 0.85, defaultReason: 'Fast charging adapter' },
  ],
  [ProductCategoryFamily.CHARGER]: [
    { targetFamily: ProductCategoryFamily.CHARGING_CABLE, strength: 1.0, defaultReason: 'High-speed compatible cable' },
    { targetFamily: ProductCategoryFamily.POWER_BANK, strength: 0.85, defaultReason: 'Portable backup battery' },
  ],
  [ProductCategoryFamily.CHARGING_CABLE]: [
    { targetFamily: ProductCategoryFamily.CHARGER, strength: 1.0, defaultReason: 'High-speed fast wall adapter' },
    { targetFamily: ProductCategoryFamily.POWER_BANK, strength: 0.85, defaultReason: 'Portable backup power' },
  ],
  [ProductCategoryFamily.POWER_BANK]: [
    { targetFamily: ProductCategoryFamily.CHARGING_CABLE, strength: 1.0, defaultReason: 'Durable short travel cable' },
    { targetFamily: ProductCategoryFamily.PHONE_CASE, strength: 0.70, defaultReason: 'Protective case for your phone' },
  ],
  [ProductCategoryFamily.PHONE_STAND]: [
    { targetFamily: ProductCategoryFamily.CHARGING_CABLE, strength: 0.90, defaultReason: 'Keep your device powered on the stand' },
    { targetFamily: ProductCategoryFamily.CHARGER, strength: 0.85, defaultReason: 'Fast charging adapter' },
  ],
  [ProductCategoryFamily.MOUSE]: [
    { targetFamily: ProductCategoryFamily.KEYBOARD, strength: 0.95, defaultReason: 'Matching ergonomic keyboard' },
    { targetFamily: ProductCategoryFamily.USB_HUB, strength: 0.90, defaultReason: 'USB multi-port adapter for your desktop' },
  ],
  [ProductCategoryFamily.LAPTOP_BAG]: [
    { targetFamily: ProductCategoryFamily.MOUSE, strength: 0.90, defaultReason: 'Compact travel mouse for your laptop bag' },
    { targetFamily: ProductCategoryFamily.USB_HUB, strength: 0.85, defaultReason: 'Portable USB hub for travel' },
  ],
  [ProductCategoryFamily.KEYBOARD]: [
    { targetFamily: ProductCategoryFamily.MOUSE, strength: 0.95, defaultReason: 'Matching precision mouse' },
    { targetFamily: ProductCategoryFamily.USB_HUB, strength: 0.85, defaultReason: 'Multi-port connectivity hub' },
  ],
  [ProductCategoryFamily.USB_HUB]: [
    { targetFamily: ProductCategoryFamily.MOUSE, strength: 0.85, defaultReason: 'Plug-and-play USB mouse' },
    { targetFamily: ProductCategoryFamily.KEYBOARD, strength: 0.80, defaultReason: 'Desktop keyboard' },
  ],
  [ProductCategoryFamily.COOLING_PAD]: [
    { targetFamily: ProductCategoryFamily.MOUSE, strength: 0.85, defaultReason: 'Ergonomic workstation mouse' },
  ],
  [ProductCategoryFamily.LAPTOP_STAND]: [
    { targetFamily: ProductCategoryFamily.KEYBOARD, strength: 0.95, defaultReason: 'External keyboard for elevated laptop' },
    { targetFamily: ProductCategoryFamily.MOUSE, strength: 0.90, defaultReason: 'Precision wireless mouse' },
  ],
  [ProductCategoryFamily.TABLET_CASE]: [
    { targetFamily: ProductCategoryFamily.SCREEN_PROTECTOR, strength: 1.0, defaultReason: 'Complete tablet screen protection' },
    { targetFamily: ProductCategoryFamily.STYLUS, strength: 0.90, defaultReason: 'Precision stylus pen' },
  ],
  [ProductCategoryFamily.STYLUS]: [
    { targetFamily: ProductCategoryFamily.TABLET_CASE, strength: 0.90, defaultReason: 'Folio case with stylus holder' },
    { targetFamily: ProductCategoryFamily.SCREEN_PROTECTOR, strength: 0.85, defaultReason: 'Paper-feel or tempered screen protector' },
  ],
  [ProductCategoryFamily.TABLET_STAND]: [
    { targetFamily: ProductCategoryFamily.KEYBOARD, strength: 0.90, defaultReason: 'Bluetooth keyboard for desktop tablet use' },
  ],
  [ProductCategoryFamily.MEMORY_CARD]: [
    { targetFamily: ProductCategoryFamily.CAMERA_BAG, strength: 0.90, defaultReason: 'Protective travel camera bag' },
    { targetFamily: ProductCategoryFamily.TRIPOD, strength: 0.85, defaultReason: 'Sturdy camera tripod' },
  ],
  [ProductCategoryFamily.CAMERA_BAG]: [
    { targetFamily: ProductCategoryFamily.MEMORY_CARD, strength: 0.90, defaultReason: 'High-speed memory storage' },
    { targetFamily: ProductCategoryFamily.TRIPOD, strength: 0.85, defaultReason: 'Compact travel tripod' },
  ],
  [ProductCategoryFamily.TRIPOD]: [
    { targetFamily: ProductCategoryFamily.CAMERA_BAG, strength: 0.85, defaultReason: 'Padded carrying case' },
  ],
  [ProductCategoryFamily.CAMERA_STRAP]: [
    { targetFamily: ProductCategoryFamily.CAMERA_BAG, strength: 0.85, defaultReason: 'Padded camera bag' },
  ],
  [ProductCategoryFamily.SPARE_BATTERY]: [
    { targetFamily: ProductCategoryFamily.MEMORY_CARD, strength: 0.90, defaultReason: 'Extra memory card for long shoots' },
  ],
  [ProductCategoryFamily.PROTECTIVE_CASE]: [
    { targetFamily: ProductCategoryFamily.EAR_TIPS, strength: 0.85, defaultReason: 'Comfortable replacement ear tips' },
    { targetFamily: ProductCategoryFamily.CHARGER, strength: 0.80, defaultReason: 'Fast audio charging adapter' },
  ],
  [ProductCategoryFamily.EAR_TIPS]: [
    { targetFamily: ProductCategoryFamily.PROTECTIVE_CASE, strength: 0.85, defaultReason: 'Silicone protective case' },
  ],
  [ProductCategoryFamily.HEADPHONE_STAND]: [
    { targetFamily: ProductCategoryFamily.CHARGING_CABLE, strength: 0.80, defaultReason: 'Audio charging cable' },
  ],
  [ProductCategoryFamily.CONTROLLER]: [
    { targetFamily: ProductCategoryFamily.CHARGING_DOCK, strength: 0.95, defaultReason: 'Dual controller charging dock' },
    { targetFamily: ProductCategoryFamily.GAMING_HEADSET, strength: 0.90, defaultReason: 'Spatial audio gaming headset' },
  ],
  [ProductCategoryFamily.GAMING_HEADSET]: [
    { targetFamily: ProductCategoryFamily.CONTROLLER, strength: 0.85, defaultReason: 'Wireless gaming controller' },
  ],
  [ProductCategoryFamily.CHARGING_DOCK]: [
    { targetFamily: ProductCategoryFamily.CONTROLLER, strength: 0.90, defaultReason: 'Compatible gaming controller' },
  ],
  [ProductCategoryFamily.GAMING_ACCESSORY]: [
    { targetFamily: ProductCategoryFamily.CONTROLLER, strength: 0.85, defaultReason: 'Wireless controller' },
  ],
  [ProductCategoryFamily.SOCKS]: [
    { targetFamily: ProductCategoryFamily.SHOE_CARE, strength: 0.80, defaultReason: 'Footwear care and cleaner' },
  ],
  [ProductCategoryFamily.INSOLES]: [
    { targetFamily: ProductCategoryFamily.SOCKS, strength: 0.90, defaultReason: 'Breathable cushioned socks' },
  ],
  [ProductCategoryFamily.SHOE_CARE]: [
    { targetFamily: ProductCategoryFamily.LACES, strength: 0.80, defaultReason: 'Replacement shoelaces' },
  ],
  [ProductCategoryFamily.LACES]: [
    { targetFamily: ProductCategoryFamily.SHOE_CARE, strength: 0.80, defaultReason: 'Shoe cleaner and polish kit' },
  ],
  [ProductCategoryFamily.BELT]: [
    { targetFamily: ProductCategoryFamily.WALLET, strength: 0.90, defaultReason: 'Matching leather wallet' },
  ],
  [ProductCategoryFamily.WALLET]: [
    { targetFamily: ProductCategoryFamily.BELT, strength: 0.90, defaultReason: 'Classic matching belt' },
  ],
  [ProductCategoryFamily.ACCESSORIES]: [
    { targetFamily: ProductCategoryFamily.WALLET, strength: 0.80, defaultReason: 'Matching wallet accessory' },
  ],
  [ProductCategoryFamily.MATCHING_GARMENTS]: [
    { targetFamily: ProductCategoryFamily.ACCESSORIES, strength: 0.75, defaultReason: 'Fashion accessories' },
  ],
  [ProductCategoryFamily.GENERIC_ACCESSORY]: [],
  [ProductCategoryFamily.OTHER]: [],
};

// Standalone primary device families that should never recommend their own family
export const STANDALONE_DEVICE_FAMILIES = new Set<ProductCategoryFamily>([
  ProductCategoryFamily.MOBILE_PHONE,
  ProductCategoryFamily.LAPTOP,
  ProductCategoryFamily.TABLET,
  ProductCategoryFamily.CAMERA,
  ProductCategoryFamily.EARBUDS_HEADPHONES,
  ProductCategoryFamily.GAMING_CONSOLE,
  ProductCategoryFamily.SHOES,
]);

/**
 * Normalizes any product into a canonical ProductCategoryFamily using category, name, tags, and features.
 */
export function normalizeProductCategory(product: {
  category?: string | null;
  name?: string | null;
  description?: string | null;
  tags?: string[] | null;
  features?: string[] | null;
}): ProductCategoryFamily {
  const combined = [
    product.category || '',
    product.name || '',
    product.description || '',
    ...(Array.isArray(product.tags) ? product.tags : []),
    ...(Array.isArray(product.features) ? product.features : []),
  ]
    .join(' ')
    .toLowerCase();

  // 1. Specific Accessories first to avoid false classification as main device
  if (
    combined.includes('screen protector') ||
    combined.includes('tempered glass') ||
    combined.includes('screen guard') ||
    combined.includes('display guard') ||
    combined.includes('glass protector')
  ) {
    return ProductCategoryFamily.SCREEN_PROTECTOR;
  }

  if (
    combined.includes('phone case') ||
    combined.includes('mobile cover') ||
    combined.includes('protective case') ||
    combined.includes('back cover') ||
    combined.includes('phone cover') ||
    combined.includes('bumper case') ||
    combined.includes('silicone case for phone')
  ) {
    return ProductCategoryFamily.PHONE_CASE;
  }

  if (
    combined.includes('tablet case') ||
    combined.includes('ipad case') ||
    combined.includes('folio cover') ||
    combined.includes('smart cover')
  ) {
    return ProductCategoryFamily.TABLET_CASE;
  }

  if (
    combined.includes('cooling pad') ||
    combined.includes('laptop cooler') ||
    combined.includes('chill mat')
  ) {
    return ProductCategoryFamily.COOLING_PAD;
  }

  if (
    combined.includes('laptop stand') ||
    combined.includes('laptop riser') ||
    combined.includes('notebook stand')
  ) {
    return ProductCategoryFamily.LAPTOP_STAND;
  }

  if (
    combined.includes('laptop bag') ||
    combined.includes('laptop sleeve') ||
    combined.includes('laptop backpack') ||
    combined.includes('messenger bag')
  ) {
    return ProductCategoryFamily.LAPTOP_BAG;
  }

  if (
    combined.includes('usb hub') ||
    combined.includes('usb-c hub') ||
    combined.includes('docking station') ||
    combined.includes('type-c hub') ||
    combined.includes('multiport adapter')
  ) {
    return ProductCategoryFamily.USB_HUB;
  }

  if (
    combined.includes('wireless mouse') ||
    combined.includes('gaming mouse') ||
    combined.includes('bluetooth mouse') ||
    combined.includes('trackpad') ||
    (combined.includes('mouse') && !combined.includes('pad'))
  ) {
    return ProductCategoryFamily.MOUSE;
  }

  if (
    combined.includes('mechanical keyboard') ||
    combined.includes('wireless keyboard') ||
    combined.includes('bluetooth keyboard') ||
    (combined.includes('keyboard') && !combined.includes('cover'))
  ) {
    return ProductCategoryFamily.KEYBOARD;
  }

  if (
    combined.includes('power bank') ||
    combined.includes('portable charger') ||
    combined.includes('battery pack') ||
    combined.includes('powerbank')
  ) {
    return ProductCategoryFamily.POWER_BANK;
  }

  if (
    combined.includes('charging cable') ||
    combined.includes('type-c cable') ||
    combined.includes('lightning cable') ||
    combined.includes('usb-c cable') ||
    (combined.includes('cable') && (combined.includes('usb') || combined.includes('charge') || combined.includes('fast')))
  ) {
    return ProductCategoryFamily.CHARGING_CABLE;
  }

  if (
    combined.includes('fast charger') ||
    combined.includes('charging adapter') ||
    combined.includes('wall charger') ||
    combined.includes('gan charger') ||
    combined.includes('power adapter') ||
    combined.includes('gan 100w') ||
    (combined.includes('charger') && !combined.includes('laptop') && !combined.includes('phone'))
  ) {
    return ProductCategoryFamily.CHARGER;
  }

  if (
    combined.includes('phone stand') ||
    combined.includes('mobile holder') ||
    combined.includes('phone mount') ||
    combined.includes('car mount')
  ) {
    return ProductCategoryFamily.PHONE_STAND;
  }

  if (
    combined.includes('stylus') ||
    combined.includes('apple pencil') ||
    combined.includes('s pen') ||
    combined.includes('digital pen')
  ) {
    return ProductCategoryFamily.STYLUS;
  }

  if (
    combined.includes('memory card') ||
    combined.includes('sd card') ||
    combined.includes('microsd') ||
    combined.includes('cfexpress') ||
    combined.includes('sdxc')
  ) {
    return ProductCategoryFamily.MEMORY_CARD;
  }

  if (
    combined.includes('camera bag') ||
    combined.includes('lens bag') ||
    combined.includes('camera pouch')
  ) {
    return ProductCategoryFamily.CAMERA_BAG;
  }

  if (
    combined.includes('tripod') ||
    combined.includes('monopod') ||
    combined.includes('gorillapod')
  ) {
    return ProductCategoryFamily.TRIPOD;
  }

  if (
    combined.includes('camera strap') ||
    combined.includes('neck strap') ||
    combined.includes('wrist strap')
  ) {
    return ProductCategoryFamily.CAMERA_STRAP;
  }

  if (
    combined.includes('spare battery') ||
    combined.includes('camera battery') ||
    combined.includes('replacement battery')
  ) {
    return ProductCategoryFamily.SPARE_BATTERY;
  }

  if (
    combined.includes('ear tips') ||
    combined.includes('foam tips') ||
    combined.includes('replacement tips')
  ) {
    return ProductCategoryFamily.EAR_TIPS;
  }

  if (
    combined.includes('headphone stand') ||
    combined.includes('headset stand') ||
    combined.includes('headphone hanger')
  ) {
    return ProductCategoryFamily.HEADPHONE_STAND;
  }

  if (
    combined.includes('earbuds case') ||
    combined.includes('airpods case') ||
    combined.includes('silicone case')
  ) {
    return ProductCategoryFamily.PROTECTIVE_CASE;
  }

  if (
    combined.includes('game controller') ||
    combined.includes('gamepad') ||
    combined.includes('dualsense') ||
    combined.includes('dualshock') ||
    combined.includes('joystick')
  ) {
    return ProductCategoryFamily.CONTROLLER;
  }

  if (
    combined.includes('gaming headset')
  ) {
    return ProductCategoryFamily.GAMING_HEADSET;
  }

  if (
    combined.includes('charging dock') ||
    combined.includes('controller dock')
  ) {
    return ProductCategoryFamily.CHARGING_DOCK;
  }

  if (
    combined.includes('socks') ||
    combined.includes('ankle socks') ||
    combined.includes('crew socks')
  ) {
    return ProductCategoryFamily.SOCKS;
  }

  if (
    combined.includes('insoles') ||
    combined.includes('shoe inserts')
  ) {
    return ProductCategoryFamily.INSOLES;
  }

  if (
    combined.includes('shoe care') ||
    combined.includes('shoe cleaner') ||
    combined.includes('shoe polish') ||
    combined.includes('waterproof spray')
  ) {
    return ProductCategoryFamily.SHOE_CARE;
  }

  if (
    combined.includes('laces') ||
    combined.includes('shoelaces')
  ) {
    return ProductCategoryFamily.LACES;
  }

  if (
    combined.includes('belt') ||
    combined.includes('leather belt')
  ) {
    return ProductCategoryFamily.BELT;
  }

  if (
    combined.includes('wallet') ||
    combined.includes('card holder')
  ) {
    return ProductCategoryFamily.WALLET;
  }

  // 2. Primary devices & apparel
  if (
    combined.includes('smartphone') ||
    combined.includes('mobile phone') ||
    combined.includes('galaxy phone') ||
    combined.includes('iphone') ||
    combined.includes('android phone') ||
    combined.includes('cell phone') ||
    combined.includes('mobile') ||
    combined.includes('phone')
  ) {
    return ProductCategoryFamily.MOBILE_PHONE;
  }

  if (
    combined.includes('laptop') ||
    combined.includes('notebook computer') ||
    combined.includes('macbook') ||
    combined.includes('ultrabook') ||
    combined.includes('chromebook') ||
    combined.includes('novabook')
  ) {
    return ProductCategoryFamily.LAPTOP;
  }

  if (
    combined.includes('tablet') ||
    combined.includes('ipad') ||
    combined.includes('android tablet')
  ) {
    return ProductCategoryFamily.TABLET;
  }

  if (
    combined.includes('camera') ||
    combined.includes('mirrorless') ||
    combined.includes('dslr') ||
    combined.includes('alphavision')
  ) {
    return ProductCategoryFamily.CAMERA;
  }

  if (
    combined.includes('earbuds') ||
    combined.includes('headphones') ||
    combined.includes('earphones') ||
    combined.includes('headset') ||
    combined.includes('airpods') ||
    combined.includes('zenpods') ||
    combined.includes('zenaudio') ||
    combined.includes('aurasound') ||
    combined.includes('bassmaster')
  ) {
    return ProductCategoryFamily.EARBUDS_HEADPHONES;
  }

  if (
    combined.includes('gaming console') ||
    combined.includes('playstation') ||
    combined.includes('xbox') ||
    combined.includes('nintendo switch') ||
    combined.includes('console')
  ) {
    return ProductCategoryFamily.GAMING_CONSOLE;
  }

  if (
    combined.includes('shoes') ||
    combined.includes('sneakers') ||
    combined.includes('running shoes') ||
    combined.includes('footwear') ||
    combined.includes('boots') ||
    combined.includes('loafers')
  ) {
    return ProductCategoryFamily.SHOES;
  }

  if (
    combined.includes('shirt') ||
    combined.includes('t-shirt') ||
    combined.includes('pants') ||
    combined.includes('trousers') ||
    combined.includes('jacket') ||
    combined.includes('hoodie') ||
    combined.includes('dress') ||
    combined.includes('jeans') ||
    combined.includes('clothing') ||
    combined.includes('apparel')
  ) {
    return ProductCategoryFamily.CLOTHING;
  }

  if (
    combined.includes('accessory') ||
    combined.includes('accessories')
  ) {
    return ProductCategoryFamily.GENERIC_ACCESSORY;
  }

  return ProductCategoryFamily.OTHER;
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'with', 'for', 'in', 'on', 'at', 'to', 'of',
  'by', 'from', 'is', 'are', 'was', 'were', 'it', 'this', 'that', 'these', 'those',
  'pro', 'max', 'plus', 'ultra', 'edition', 'new', 'best', 'top', 'all', 'any'
]);

/**
 * Tokenizes text into cleaned distinct terms
 */
export function extractCleanTokens(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));
}

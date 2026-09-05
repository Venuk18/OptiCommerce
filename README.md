# 🚀 OptiCommerce

> AI-Native Commerce & Revenue Engine for Merchants

🌐 **Live Demo:** https://opticommerce.onrender.com

📦 **GitHub:** https://github.com/Venuk18/OptiCommerce
## Table of Contents

- [1. Overview](#1-overview)
- [2. Problem Being Solved](#2-problem-being-solved)
- [3. Why It Is Different from Normal AI Product Search](#3-why-it-is-different-from-normal-ai-product-search)
- [4. AI Recommendation Pipeline](#4-ai-recommendation-pipeline)
- [5. Natural-Language Shopping](#5-natural-language-shopping)
- [6. Conversation Context & Multi-Turn State](#6-conversation-context--multi-turn-state)
- [7. AI Sales Reasoning & Honest Trade-Offs](#7-ai-sales-reasoning--honest-trade-offs)
- [8. In-Chat Product Comparison](#8-in-chat-product-comparison)
- [9. Dissatisfaction Detection & Refinement](#9-dissatisfaction-detection--refinement)
- [10. Budget-Aware Recommendations & Controlled Relaxation](#10-budget-aware-recommendations--controlled-relaxation)
- [11. Cart-Aware Cross-Selling](#11-cart-aware-cross-selling)
- [12. Intelligent Bundling](#12-intelligent-bundling)
- [13. Contextual Price-Reduction Requests & Negotiation](#13-contextual-price-reduction-requests--negotiation)
- [14. Merchant Revenue Intelligence](#14-merchant-revenue-intelligence)
- [15. Razorpay Checkout Integration](#15-razorpay-checkout-integration)
- [16. AI Provider Architecture & Fallback](#16-ai-provider-architecture--fallback)
- [17. AI & Commercial Safety Guardrails](#17-ai--commercial-safety-guardrails)
- [18. Separate Customer & Merchant Experiences](#18-separate-customer--merchant-experiences)
- [19. System Architecture](#19-system-architecture)
- [20. Technology Stack](#20-technology-stack)
- [21. Project Structure](#21-project-structure)
- [22. Local Setup Instructions](#22-local-setup-instructions)
- [23. Verification & Testing](#23-verification--testing)
- [24. Customer Demo Flow](#24-customer-demo-flow)
- [25. Merchant Demo Flow](#25-merchant-demo-flow)
- [26. Razorpay Buildathon Relevance](#26-razorpay-buildathon-relevance)
- [27. Future Vision](#27-future-vision)
- [28. Author](#28-author)

---

## 1. Overview

**OptiCommerce** is an enterprise-grade AI commerce engine built from first principles. It delivers two tightly synchronized systems:

1. **Customer AI Storefront (`/`)**: A conversational shopping assistant where buyers express natural queries, compare technical specifications side-by-side, refine preferences across turns, explore cart-aware cross-sells, request bundle incentives, and check out securely via Razorpay.
2. **Merchant Intelligence Suite (`/merchant`)**: A revenue analytics dashboard providing real-time attribution for AI-generated GMV, margin tracking, discount impact analysis, order stream monitoring, a 100-product catalog manager with CSV import, and AI product description generation.

```
+-----------------------------------------------------------------------------+
|                                OPTICOMMERCE                                 |
+--------------------------------------+--------------------------------------+
|        CUSTOMER EXPERIENCE           |         MERCHANT INTELLIGENCE        |
|  - Natural language search & intents |  - AI-Attributed Revenue Analytics   |
|  - 3-candidate disciplined shortlist |  - Gross Margin & AOV Optimization   |
|  - Honest sales trade-off reasoning  |  - Automated Commercial Policy Guard |
|  - Side-by-side spec comparison      |  - 100-Product Catalog & AI Copy     |
|  - Cart-aware cross-sell & bundles   |  - Real-Time Orders & Event Streams  |
|  - Seamless Razorpay payments        |  - Dedicated Merchant Landing & Auth |
+--------------------------------------+--------------------------------------+
|                     MULTI-PROVIDER ORCHESTRATION LAYER                      |
|       Groq (Llama 3.3) -> Cerebras -> Gemini 2.5/3.0 -> Deterministic       |
+-----------------------------------------------------------------------------+
```

---

## 2. Problem Being Solved

Traditional online shopping search is fundamentally broken for modern consumer intent:

- **Brittle Keyword Matching**: Searching *"wireless headphones under ₹5,000 with strong bass for gym"* either produces zero results or surfaces phone cases and auxiliary cables because traditional filters fail on compound intent.
- **Hallucinating Chatbots**: Generic LLM shopping bots invent non-existent products, hallucinate specs, quote fake prices, and have zero integration with active merchant inventory or margins.
- **Margin Erosion & Discount Leakage**: Merchants blindly offer sitewide coupons to curb cart abandonment, giving away unnecessary discounts to customers who would have bought at full price.
- **Dead-End Constraints**: When a customer's budget is slightly below the catalog's entry product (e.g., asking for a laptop under ₹60,000 when the cheapest laptop is ₹64,999), traditional search returns *"0 products found"*, immediately killing conversion.

---

## 3. Why It Is Different from Normal AI Product Search

| Feature | Standard AI Chatbot / Search | OptiCommerce Engine |
|---|---|---|
| **Product Grounding** | Generates text freely; hallucinates unverified SKUs | 100% strict whitelist against active catalog database |
| **Recommendation Volume** | Floods user with 10-20 loosely matched products | Disciplined shortlist of at most **3** primary options |
| **Catalog Constraints** | Recommends laptop sleeves when user asks for a laptop | Hard separation between Primary Device and Accessory categories |
| **Explanation Depth** | Generic marketing fluff ("This is the best product") | Honest sales reasoning: standout advantage + honest trade-off |
| **Budget Handling** | Binary failure when budget is ₹1 below lowest price | Controlled 20% budget buffer with transparent trade-off explanation |
| **Merchant Economics** | Zero margin awareness | Real-time margin preservation, cross-sell, and bundling |
| **Checkout Flow** | External link or abandoned chat | Native **Razorpay** modal integrated directly into cart state |
| **AI Reliability** | Crashes on 429 quota exhaustion or API downtime | Multi-tier fallback (Groq -> Cerebras -> Gemini -> Deterministic) |

---

## 4. AI Recommendation Pipeline

Every customer query moves through a strict 7-stage pipeline:

```
[Customer Query]
       │
       ▼
1. Intent Extraction & Reference Resolution
   ├── Extracts category, price boundaries, use-case, brand, preferences
   └── Resolves context ("second one", "cheaper option", "compare 1 and 3")
       │
       ▼
2. Deterministic Candidate Retrieval
   ├── PostgreSQL query via Prisma (category synonyms, stock > 0, status = PUBLISHED)
   ├── Strict separation: primary devices vs. accessories (sleeves/stands excluded)
   └── Controlled Budget Fallback: +20% tolerance if 0 in-budget primary products exist
       │
       ▼
3. Deterministic Relevance Scoring
   └── Scores structured weights (Category: +30, Brand: +25, Specs/Prefs: +10 to +30)
       │
       ▼
4. AI Product Ranking & Whitelist Validation
   ├── Orchestrator: Groq -> Cerebras -> Gemini -> Deterministic fallback
   ├── Caps at MAXIMUM 3 primary recommendations
   └── Strict anti-hallucination validation against DB candidate IDs
       │
       ▼
5. AI Sales Reasoner & Honest Trade-offs
   ├── Generates standout key advantage from verified specs
   ├── States honest trade-off (price difference, weight, or budget ceiling)
   └── Synthesizes comparative sales overview with zero marketing hyperbole
       │
       ▼
6. Response DTO Assembly
   └── Returns query, intent, recommendations, products, message, and state
       │
       ▼
7. Frontend Card Rendering
   └── Renders interactive cards, trade-off tags, fit role badges, and compare action
```

---

## 5. Natural-Language Shopping

Customers can search using conversational sentences, complex criteria, or direct questions:

- *"Show me wireless noise-cancelling headphones for long flights under ₹6000"*
- *"I need a lightweight laptop for coding with at least 16GB RAM"*
- *"What is a good compact mechanical keyboard for Mac?"*
- *"Waterproof portable speakers for outdoor pool parties"*

The intent extractor parses these into structured schemas without requiring the customer to touch filter dropdowns.

---

## 6. Conversation Context & Multi-Turn State

OptiCommerce maintains persistent conversational state across turns within a session:

```typescript
export interface ConversationState {
  goal: string | null;
  category: string | null;
  budget: { min: number | null; max: number | null };
  preferences: string[];
  exclusions: string[];
  useCase: string | null;
  discussedProducts: DiscussedProduct[]; // Exactly tracked positions 1, 2, 3
  rejectedProducts: string[];
  selectedProductId: string | null;
  stage: 'DISCOVERY' | 'CLARIFYING' | 'EVALUATING' | 'COMPARING' | 'READY_TO_BUY';
}
```

### Reference Resolution Examples:
- **Positional Reference**: User says *"Tell me more about the second one"* -> Resolves to the exact product at position 2.
- **Attribute Reference**: User says *"Which of these has the longest battery?"* -> Compares battery specifications across discussed items.
- **Specification Question**: User asks *"Does the first one have Active Noise Cancellation?"* -> Verifies authoritative product specs and answers factually.

---

## 7. AI Sales Reasoning & Honest Trade-Offs

Rather than generating superficial marketing claims, the **Sales Reasoner** (`sales-reasoner.service.ts`) assigns an objective role and an honest trade-off to every recommendation:

- **Fit Role**: `Strongest Overall Fit`, `Best Budget Choice`, `Premium Pick`, `Closest Available Option`, or `Balanced Alternative`.
- **Key Advantage**: Derived strictly from verified features (e.g., *"14\" 2.8K 120Hz OLED Display"*, *"Hybrid Active Noise Cancelling"*).
- **Honest Trade-off**: Transparently warns the buyer (e.g., *"Costs ₹3,500 more than the top-ranked option"*, *"Lacks active noise cancellation found on higher-tier models"*, or *"Costs ₹4,999 above your ₹60,000 budget target"*).
- **Zero Hyperbole**: Banned words like *"absolutely perfect"*, *"unbeatable"*, or *"revolutionary"* are automatically rejected by anti-hallucination guardrails.

---

## 8. In-Chat Product Comparison

When 2 or 3 recommendations are surfaced, customers can trigger an instant comparison focus view:

```
+-----------------------------------------------------------------------+
|  ✨ Compare these 3 & suggest me the best                             |
+-----------------------------------------------------------------------+
|  🏆 TOP RECOMMENDATION: SoundCore Space One (Best Balance for Travel)  |
+-----------------------------------+-----------------------------------+
| SoundCore Space One (₹4,499)      | JBL Tune 760NC (₹4,999)           |
| - 40h ANC Playtime                | - 35h Battery with BT+NC          |
| - LDAC Hi-Res Audio               | - JBL Pure Bass Sound             |
| - Trade-off: Plastic headband     | - Trade-off: Smaller ear cushions |
+-----------------------------------+-----------------------------------+
```

The comparison service evaluates specifications, highlights the winning SKU based on the user's specific use case, and provides clear decision guidance without navigating away from the chat.

---

## 9. Dissatisfaction Detection & Refinement

If a customer expresses dissatisfaction with the recommendations, OptiCommerce identifies the underlying reason and pivots dynamically:

- **Price Dissatisfaction**: *"Too expensive"*, *"Can you show cheaper ones?"* -> Retains category, lowers budget ceiling, rejects previously shown products.
- **Brand Dissatisfaction**: *"I don't like JBL"*, *"Show me Sony instead"* -> Adds brand exclusion, preserves category and use case.
- **Feature Dissatisfaction**: *"I need something with longer battery"* -> Adds battery life to preference constraints.
- **Clarification State**: If intent is ambiguous, transitions to `CLARIFYING` stage to ask a focused question.

---

## 10. Budget-Aware Recommendations & Controlled Relaxation

A classic conversion killer in e-commerce occurs when a customer's stated budget is slightly below the catalog's entry-level SKU.

**The Solution: Controlled 20% Budget Buffer**
1. **Strict In-Budget First**: The engine always attempts strict in-budget retrieval (`price <= maxPrice`).
2. **Accessory Protection**: Accessories (sleeves, mice, cooling pads) are never returned as substitutes for primary devices (laptops, phones, headphones).
3. **Controlled Fallback**: If and only if zero primary devices match within budget, the engine queries up to **20% above budget** (`maxPrice < price <= maxPrice * 1.20`).
4. **Honest Explanation**: Transparently states the stretch to the user:
   > *"We don't have a laptop strictly within ₹60,000. The closest available option is the AeroBook Air 14\" at ₹64,999 (₹4,999 above your budget)."*
5. **No Absurd Stretching**: A query like *"laptop under 10000"* will never stretch to ₹64,999 and returns a graceful no-match notice.

---

## 11. Cart-Aware Cross-Selling

When a customer adds an item to their cart, OptiCommerce dynamically analyzes the cart's contents to surface high-margin complementary accessories:

- Customer adds **HP Pavilion Laptop** -> Recommends **ArmorPack Laptop Sleeve** and **AlumaStand Laptop Stand**.
- Customer adds **Smartphone** -> Recommends **Anker GaN Fast Charger** and **Protective Case**.

Recommendations respect merchant margins, avoid duplicate categories already in cart, and carry direct *"Add to Cart"* CTAs.

---

## 12. Intelligent Bundling

OptiCommerce detects bundling opportunities that increase Average Order Value (AOV) while offering genuine value to the customer:

```
+--------------------------------------------------------------------+
|  🎁 BUNDLE OPPORTUNITY: Creator Audio Studio Setup                 |
|  Combine: SoundCore Space One + Rode PodMic + AcousticShield Arm    |
|  Total: ₹17,688  ───>  Bundle Deal: ₹15,919 (Save 10%)             |
|  [Add Complete Bundle to Cart]                                     |
+--------------------------------------------------------------------+
```

Bundles enforce a **merchant margin safety floor**—discounts are dynamically constrained so merchant profitability is never compromised.

---

## 13. Contextual Price-Reduction Requests & Negotiation

When a customer exhibits checkout hesitation or asks:
- *"Can I get a discount on this?"*
- *"Is there any price reduction available?"*
- *"Can you make this cheaper?"*

The **Commercial Engine** evaluates:
1. **Margin Room**: `(price - costPrice) / price`
2. **Product Stock**: Higher discounts allowed for overstocked items; zero discounts for low-stock SKUs.
3. **Store Discount Policy**: Respects merchant-configured maximum discount caps (e.g., max 10%).
4. **Time-Limited Incentive**: Issues a personalized commercial offer with an expiration timer (e.g., 10 minutes) directly redeemable in cart.

---

## 14. Merchant Revenue Intelligence

Merchants access an analytics cockpit at `/merchant/dashboard`:

- **Total Revenue & Gross Margin**: Track total revenue, product costs, and gross profit in real time.
- **AI-Attributed Revenue**: Exact tracking of revenue originated through AI recommendations, comparisons, cross-sells, bundles, and offers.
- **AOV & Margin Tracking**: Compare organic basket sizes versus AI-recommended basket sizes.
- **Interactive SVG Charts**: Revenue trends, attribution distribution, and order volume visualizations.
- **100-Product Catalog**: Manage inventory, stock status, CSV imports, and one-click AI copy generation.
- **Commercial Offer Rules**: Configurable margin floors and discount limits.

---

## 15. Razorpay Checkout Integration

OptiCommerce features seamless end-to-end checkout powered by **Razorpay**:

```
[Customer Cart]
       │
       ▼ Click "Proceed to Checkout"
[POST /api/payments/create-order]
       ├── Validates line items & active discounts
       ├── Resolves amount in Indian currency subunits (paise)
       ├── Invokes Razorpay Orders API: instance.orders.create(...)
       └── Returns orderId, keyId, amount, currency
       │
       ▼
[Frontend: Razorpay Standard Checkout Modal]
       ├── Customer selects UPI, Card, NetBanking, or Wallet
       └── Payment processed securely on Razorpay gateway
       │
       ▼
[POST /api/payments/verify]
       ├── Verifies HMAC-SHA256 signature using RAZORPAY_KEY_SECRET:
       │   generated_signature = hmac_sha256(order_id + "|" + payment_id, secret)
       ├── Validates signature authenticity
       ├── Updates Order status to PAID
       └── Emits PURCHASE commerce event with attribution metadata
```

---

## 16. AI Provider Architecture & Fallback

To prevent API outages or rate limits from disrupting commerce, OptiCommerce implements an **orchestrated multi-provider hierarchy**:

```
+--------------------------------------------------------------+
|                     AI PROVIDER RESOLVER                     |
+--------------------------------------------------------------+
| Priority 1: Groq (Llama 3.3 70B / Qwen 2.5 32B)             |
|   └── Ultra-fast inference (<400ms), structured JSON mode    |
| Priority 2: Cerebras (gpt-oss-120b)                          |
|   └── Instant failover if Groq encounters 429 quota limits   |
| Priority 3: Google Gemini (Gemini 2.5 / 3.0 Flash)          |
|   └── Multimodal fallover with native schema validation      |
| Priority 4: Deterministic Rule Engine                        |
|   └── 100% offline, zero-network, sub-5ms mathematical logic |
+--------------------------------------------------------------+
```

### Resilience Guarantees:
- **No Double-Calling**: If a provider succeeds, subsequent providers are not called.
- **Quota Cooldown**: When a provider returns HTTP 429, it enters cooldown to prevent repeated quota hits.
- **Zero-Downtime Deterministic Fallback**: If all third-party providers are unavailable or credentials are omitted, the application operates completely via deterministic ranking, relevance scoring, and trade-off synthesis.

---

## 17. AI & Commercial Safety Guardrails

| Guardrail | Enforcement Mechanism |
|---|---|
| **Anti-Hallucination Whitelist** | LLMs receive pre-filtered DB candidates. Output IDs are strictly checked against candidate IDs; unknown IDs are discarded. |
| **Grounded Price Checks** | Output prices must match the database `product.price`. LLMs cannot invent prices or claim fake discounts. |
| **Grounded Specifications** | Numerical specs (e.g. "40h", "16GB", "120Hz") must exist in product features/specifications before being cited. |
| **Banned Marketing Terms** | Rejects hyperbolic claims ("absolutely perfect", "unbeatable", "miraculous", "revolutionary"). |
| **Margin Preservation** | Automated commercial offers enforce `minimumMarginThreshold` to guarantee transactions remain profitable. |
| **Accessory Separation** | Primary device categories (laptops, phones) strictly filter out accessories to prevent irrelevant substitutions. |

---

## 18. Separate Customer & Merchant Experiences

```
                    ┌─────────────────────────┐
                    │       OptiCommerce       │
                    └────────────┬────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
       Customer Storefront               Merchant Suite
             (/)                           (/merchant)
       - AI Chat Assistant               - Landing Page (/merchant)
       - Catalog Grid                    - Dedicated Auth (/merchant/login)
       - In-Chat Comparison              - Revenue Analytics
       - Bundle Recommendations          - 100-Product Catalog Manager
       - Razorpay Checkout               - AI Description Generator
```

---

## 19. System Architecture

```
+───────────────────────────────────────────────────────────────────────────+
│                             REACT FRONTEND (Vite)                         │
│  AIChatShoppingView │ ProductCatalog │ RevenueCharts │ CartDrawer │ Auth  │
+─────────────────────────────────────┬─────────────────────────────────────+
                                      │ HTTP / JSON API
+─────────────────────────────────────▼─────────────────────────────────────+
│                           EXPRESS APPLICATION                             │
│  Routes: /api/ai │ /api/payments │ /api/products │ /api/revenue │ /stores  │
+─────────────────────────────────────┬─────────────────────────────────────+
          │                           │                           │
          ▼                           ▼                           ▼
+───────────────────+       +───────────────────+       +───────────────────+
│   AI PIPELINE     │       │  COMMERCE ENGINE  │       │  PAYMENTS (SDK)   │
│ - Intent Extractor│       │ - Bundle Service  │       │ - Razorpay Order  │
│ - Candidate Search│       │ - Commercial Eng. │       │ - HMAC Signature  │
│ - Product Ranking │       │ - Event Tracking  │       │   Verification    │
│ - Sales Reasoner  │       │ - Margin Guard    │       │                   │
+─────────┬─────────+       +─────────┬─────────+       +───────────────────+
          │                           │
          ▼                           ▼
+───────────────────────────────────────────────────────────────────────────+
│                       PRISMA DATA LAYER (Dual Mode)                       │
│     PostgreSQL Database  <── OR ──>  Robust In-Memory Mock Store          │
│               (100 Realistic Electronics Catalog Products)                │
+───────────────────────────────────────────────────────────────────────────+
```

---

## 20. Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide React, Motion
- **Backend**: Node.js, Express, TypeScript, `tsx` runtime
- **Database & ORM**: Prisma ORM, PostgreSQL schema with in-memory fallback proxy
- **Payments**: Razorpay Node.js SDK (`razorpay`), Razorpay Standard Checkout JS
- **AI Providers**: `@google/genai` (Gemini), Groq API, Cerebras API, Deterministic Rules
- **Authentication**: JSON Web Tokens (`jsonwebtoken`), `bcryptjs`

---

## 21. Project Structure

```
opticommerce/
├── prisma/
│   └── schema.prisma                  # PostgreSQL schema (Stores, Products, Orders, Events)
├── server/
│   ├── api/                           # Route dispatchers
│   ├── config/                        # Environment, AI, and auth configuration
│   ├── controllers/                   # Controller handlers (AI, payments, stores, products)
│   ├── db/
│   │   ├── in-memory-db.ts            # Zero-config in-memory database proxy
│   │   ├── prisma.ts                  # Dual-mode Prisma client manager
│   │   └── seed-catalog.ts            # 100-product realistic electronics catalog
│   ├── middleware/                    # Auth guards and error handling
│   ├── routes/                        # Express routers (/ai, /payments, /revenue, /stores)
│   ├── services/
│   │   ├── ai/                        # Intent, retrieval, ranking, sales reasoning, providers
│   │   ├── revenue/                   # Commercial engine, hesitation detector, analytics
│   │   ├── bundle.service.ts          # Cross-sell and bundling logic
│   │   ├── comparison.service.ts      # Side-by-side specification comparison
│   │   └── payment.service.ts         # Razorpay order generation & signature verification
│   ├── types/                         # TypeScript interfaces (search, ranking, commercial)
│   └── app.ts                         # Express app configuration
├── src/
│   ├── components/
│   │   ├── customer/                  # AI chat shopping, product cards, comparison focus, cart
│   │   └── merchant/                  # Landing page, dashboard, revenue charts, catalog modal
│   ├── context/                       # CommerceContext (cart, chat turns, state)
│   ├── services/                      # Client-side API fetchers (recommendation, payment, analytics)
│   ├── types/                         # Client types
│   ├── App.tsx                        # Master layout and view routing
│   └── main.tsx                       # React application root
├── scripts/                           # Comprehensive test and verification suites
├── server.ts                          # Unified development and production server entry
├── package.json
└── README.md
```

---

## 22. Local Setup Instructions

### Prerequisites
- **Node.js** >= 18.0.0
- **npm** >= 9.0.0

### Step 1: Clone the Repository
```bash
git clone https://github.com/Venuk18/OptiCommerce.git
cd OptiCommerce
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
Create or inspect `.env` in the project root:

```env
SERVER_PORT=3000
NODE_ENV=development

# AI Provider Configuration (Optional: runs 100% deterministically if keys are omitted)
AI_PROVIDER_MODE=auto
GROQ_API_KEY=your_groq_api_key_here
CEREBRAS_API_KEY=your_cerebras_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

# Database Configuration (Optional: falls back to in-memory store if unset)
DATABASE_URL=

# Authentication Secret
JWT_SECRET=your_jwt_secret_here

# Razorpay Test Credentials (Optional: test checkout works out of the box)
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
```

> **Note on Zero-Config Run**: If `DATABASE_URL` is left empty, OptiCommerce automatically runs on its built-in in-memory database pre-seeded with all 100 realistic catalog items. If AI keys are omitted, it operates seamlessly via its deterministic fallback engine.

### Step 4: Run the Development Server
```bash
npm run dev
```

Open your browser at:
- Customer Storefront: **`http://localhost:3000`**
- Merchant Landing Page: **`http://localhost:3000/merchant`**
- Merchant Suite Login: **`http://localhost:3000/merchant/login`**

---

## 23. Verification & Testing

OptiCommerce includes a robust automated test harness covering recommendation precision, budget relaxation, AI provider fallbacks, and regression checks.

### Run Budget-Constrained Recommendation Tests
```bash
npx tsx scripts/verify-budget-recommendations.ts
```

### Run Full Regression Suite
```bash
npx tsx scripts/run-regression-check.ts
```

### Run Sales Reasoner & Honest Trade-off Suite
```bash
npx tsx scripts/verify-phase4.ts
```

### Run AI Recommendation Quality & Precision Suite
```bash
npx tsx scripts/verify_ai_recommendation_quality.ts
```

### Run TypeScript Compilation & Linting
```bash
npm run lint
```

---

## 24. Customer Demo Flow

Try this step-by-step walkthrough in the customer chat at `http://localhost:3000`:

1. **Initial Search**:
   > *"I need a laptop for coding under 60000"*
   - **Observe**: The engine detects no laptops exist strictly under ₹60,000, applies the controlled 20% budget buffer, returns the **AeroBook Air 14"** (₹64,999), and honestly explains:
     *"We don't have a laptop strictly within ₹60,000. The closest available option is ₹64,999 (₹4,999 above your budget)."*
     *(0 accessories substituted).*

2. **Broad Category Query**:
   > *"Show me wireless noise-cancelling headphones under 5000"*
   - **Observe**: Returns 3 top recommendations (SoundCore Space One, JBL Tune 760NC, Audio-Technica ATH-M20xBT) strictly under ₹5,000 with detailed trade-off explanations.

3. **In-Chat Comparison**:
   - Click **"✨ Compare these 3 & suggest me the best"**.
   - **Observe**: An in-chat comparison focus view opens, evaluating ANC strength, battery runtime, and highlighting the winner SKU.

4. **Reference Resolution**:
   > *"Tell me more about the first one"*
   - **Observe**: Accurately resolves Option 1 and provides a breakdown of its 40mm drivers and ANC capabilities.

5. **Cart-Aware Recommendations**:
   - Click **"Add"** on any headphone card.
   - Open the **Cart Drawer**.
   - **Observe**: Dynamic cross-sell surfaces matching audio accessories (e.g. Gold Plated Aux Cable, AcousticShield Pop Filter).

6. **Razorpay Checkout**:
   - In the cart, click **"Proceed to Checkout"**.
   - **Observe**: The native Razorpay checkout modal opens with the exact subtotal in INR.

---

## 25. Merchant Demo Flow

Explore the merchant intelligence suite:

1. **Public Landing Page**:
   - Navigate to `http://localhost:3000/merchant`.
   - **Observe**: B2B SaaS landing page articulating OptiCommerce's revenue optimization value proposition.
2. **Dedicated Authentication**:
   - Click **"Continue as Merchant"** or visit `/merchant/login`.
   - Sign in using the pre-seeded demo merchant credentials:
     - **Email**: `merchant@opticommerce.io`
     - **Password**: `Merchant@2026`
3. **Revenue Analytics Dashboard**:
   - Inspect total revenue, gross margin percentage, and AI-attributed revenue share.
   - Review SVG order charts and revenue attribution breakdown.
4. **Product Catalog Management**:
   - Navigate to **Products** in the sidebar.
   - Browse the 100 seeded catalog products with live stock indicators.
   - Click **"Add Product"** or **"Upload CSV"** to inspect portal-backed modal dialogs.
   - Test the **"Generate with AI"** button to automatically produce structured product copy from basic keywords.

---

## 26. Razorpay Buildathon Relevance

| Buildathon Theme | OptiCommerce Implementation |
|---|---|
| **Frictionless Commerce** | Replaces multi-step search filters with conversational shopping that transitions directly into cart creation. |
| **Native Razorpay Integration** | Implements secure server-side order generation (`orders.create`), client-side checkout popup (`checkout.js`), and server-side HMAC-SHA256 signature verification. |
| **Revenue & AOV Growth** | Increases cart size and merchant revenue using margin-aware cross-sells, intelligent bundles, and contextual commercial offers. |
| **Real-World Merchant Utility** | Provides small and medium merchants with enterprise-grade AI intelligence without expensive infrastructure or data science teams. |
| **Production-Ready Engineering** | Built with multi-provider fallbacks, anti-hallucination guardrails, and deterministic resilience ensuring 100% uptime. |

---

## 27. Future Vision

- **Automated WhatsApp Checkout**: Extending the conversational engine to WhatsApp Business API with direct Razorpay payment links.
- **Voice Commerce**: Natural spoken queries in regional Indian languages (Hindi, Tamil, Telugu, Kannada) translated directly into catalog intents.
- **Predictive Restocking**: Connecting commercial hesitation signals to merchant supplier workflows for just-in-time inventory replenishment.
- **Dynamic Pricing Engine**: Automated pricing optimization that adapts SKU prices based on real-time competitor data and category demand elasticity.

---

## 28. Author

**OptiCommerce** was designed and built for the **Razorpay Buildathon**.

- **GitHub**: [@Venuk18](https://github.com/Venuk18)
- **Repository**: [https://github.com/Venuk18/OptiCommerce](https://github.com/Venuk18/OptiCommerce)

---
*Built with passion for AI-native commerce, honest recommendations, and merchant profitability.*

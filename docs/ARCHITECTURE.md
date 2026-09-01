# OptiCommerce Architecture Documentation

## 1. End-to-End Customer Flow

```
CUSTOMER QUERY
      │
      ▼
PHASE 4A: Intent Extraction [AI / LLM — Max 1 Gemini Call]
      │
      ▼
PHASE 4B: Candidate Retrieval [Deterministic PostgreSQL Query — 0 Gemini Calls]
      │
      ▼
PHASE 4C: Candidate Ranking [AI / LLM — Max 1 Gemini Call]
      │
      ▼
PHASE 4D: Recommendation UI & Commerce Events [Client / Server — 0 Gemini Calls]
      │
      ▼
PHASE 5A: Anonymous Event Ingestion (SEARCH, PRODUCT_VIEW, etc.) [0 Gemini Calls]
      │
      ▼
PHASE 5B: Purchase Probability Engine [Deterministic Behavioral Scoring — 0 Gemini Calls]
      │
      ▼
PHASE 5C: Revenue & Discount Optimizer [Deterministic Expected Profit Maximization — 0 Gemini Calls]
      │
      ▼
PHASE 5D: Customer Personalized Offer Experience [0 Gemini Calls]
      │
      ├── ACCEPT ──► OFFER_ACCEPTED ──► ADD_TO_CART ──► CART
      │
      └── REJECT ──► OFFER_REJECTED
                           │
                           ▼
                     PHASE 5E: Sale Recovery [Deterministic Multi-Factor Re-Ranking — 0 Gemini Calls]
                           │
                           ▼
                     Alternative Products Displayed
                           │
                           ▼
                     RECOMMENDATION_CLICK ──► PRODUCT_VIEW ──► ADD_TO_CART ──► CART
```

---

## 2. Stage Breakdown & AI vs. Deterministic Classification

| Stage | Phase | Classification | Description & Gemini Call Budget |
| :--- | :--- | :--- | :--- |
| **Intent Extraction** | Phase 4A | **AI (Gemini)** | Parses natural language query into structured entity constraints (`category`, `brand`, `minPrice`, `maxPrice`, `preferences`, `keywords`). Max 1 Gemini call (with deterministic regex/pattern fallback). |
| **Candidate Retrieval** | Phase 4B | **Deterministic** | Executes scoped PostgreSQL query filtered by store, status (`PUBLISHED`), stock (`> 0`), and price boundary. **0 Gemini Calls**. |
| **Product Ranking** | Phase 4C | **AI (Gemini)** | Semantic match scoring and justification generator for candidate set. Max 1 Gemini call (with deterministic fallback). |
| **Storefront Recommendations** | Phase 4D | **Deterministic UI** | Renders ranked cards, match scores, why-it-matches highlights, and feedback pills. **0 Gemini Calls**. |
| **Anonymous Event Tracking** | Phase 5A | **Deterministic** | Ingests client commerce events keyed by RFC4122 v4 anonymous session UUID and store ID. **0 Gemini Calls**. |
| **Purchase Probability Engine** | Phase 5B | **Deterministic** | Chronological behavioral signal accumulator calculating purchase likelihood ($P_{\text{base}} \in [0.05, 0.95]$) and confidence score. **0 Gemini Calls**. |
| **Revenue Optimizer** | Phase 5C | **Deterministic** | Evaluates discrete candidate discount actions ($0\%, 5\%, 10\%, 15\%$) to maximize expected profit $E[\Pi] = (\text{Price} \cdot (1-d) - \text{Cost}) \cdot P(\text{buy}\mid d)$ subject to margin floors and merchant limits. **0 Gemini Calls**. |
| **Customer Offer Experience** | Phase 5D | **Deterministic UI** | Fetches server-calculated offer, displays non-intrusive savings tray, tracks `OFFER_VIEW`, `OFFER_ACCEPTED`, or `OFFER_REJECTED`. **0 Gemini Calls**. |
| **Sale Recovery Engine** | Phase 5E | **Deterministic** | Multi-factor re-ranking ($30\%$ Category, $15\%$ Tags, $15\%$ Features, $15\%$ Intent, $20\%$ Value Recovery/Savings, $5\%$ Brand) to recover rejected sale with in-stock alternatives. Excludes rejected product. **0 Gemini Calls**. |
| **Cart Integration** | Standard | **Deterministic** | Retains applied offer discount in cart calculation without modifying persistent product catalog price. **0 Gemini Calls**. |

---

## 3. Security & Merchant Safety Guarantees

1. **Zero Exposure of Merchant Economics**:
   - `costPrice`, internal profit calculations (`expectedProfit`, `baselineExpectedProfit`), merchant floor margins, and internal `purchaseProbability` are strictly stripped from all customer-facing API responses (`/api/revenue/optimize`, `/api/revenue/recover-sale`).
2. **Store Scoping Isolation**:
   - All operations strictly check `product.storeId === requestedStoreId`. Cross-store access attempts are rejected with `400 Bad Request`.
3. **Session Continuity & Privacy**:
   - Customer tracking relies exclusively on an anonymous client-generated session identifier (`opticommerce_session_id`). Zero customer PII or authentication is collected or required.
4. **Database Non-Destructiveness**:
   - Real product catalog pricing (`Product.price`) is immutable during dynamic discounting sessions; temporary discounts are applied purely at checkout/cart item scope.

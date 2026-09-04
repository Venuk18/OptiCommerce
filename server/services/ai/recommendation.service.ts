import { AppError } from '../../errors/app.error';
import { prisma } from '../../db/prisma';
import {
  RecommendProductsResult,
  ConversationContextInput,
  ConversationState,
  DiscussedProduct,
  ConversationStage,
} from '../../types/recommendation.types';
import { intentExtractorService } from './intent-extractor.service';
import { candidateRetrievalService } from './candidate-retrieval.service';
import { productRankingService } from './product-ranking.service';
import { dissatisfactionDetectorService } from './dissatisfaction-detector.service';
import { salesReasonerService } from './sales-reasoner.service';
import { comparisonService } from './comparison.service';
import { ProductComparisonResult } from '../../types/comparison.types';
import { bundleService } from '../bundle.service';
import { commercialEngineService } from '../revenue/commercial-engine.service';
import { hesitationDetectorService } from '../revenue/hesitation-detector.service';
import { CommercialOffer } from '../../types/commercial.types';

const MAX_PRIMARY_RECOMMENDATIONS = 3;

export class RecommendationService {
  /**
   * Orchestrates the context-aware AI commerce recommendation pipeline:
   * 1. Context-Aware Intent Extraction & Reference Resolution (Phase 2)
   *    - Retains existing constraints unless explicitly changed
   *    - Resolves product references ("second one", "cheaper one", "compare 1 and 3")
   *    - Handles invalid references without hallucination
   * 2. Candidate Retrieval - Deterministic DB query with hard filters based on merged constraints
   * 3. AI Candidate Ranking - Enforces strict MAXIMUM 3 recommendations with anti-hallucination validation
   */
  async getRecommendations(
    storeId: string,
    query: string,
    options?: {
      conversationContext?: ConversationContextInput;
      cartProductIds?: string[];
      focusedProductId?: string;
      sessionId?: string;
    }
  ): Promise<RecommendProductsResult> {
    // 1. Input validations
    if (!storeId || typeof storeId !== 'string' || !storeId.trim()) {
      throw new AppError('storeId is required and must be a non-empty string', 400);
    }
    if (!query || typeof query !== 'string' || !query.trim()) {
      throw new AppError('query is required and must be a non-empty string', 400);
    }

    const cleanStoreId = storeId.trim();
    const cleanQuery = query.trim();
    const prevState = options?.conversationContext?.state;
    const prevDiscussed = prevState?.discussedProducts || [];

    // 2. Step 1: Context-Aware Intent Extraction & Reference Resolution
    const intentResult = await intentExtractorService.extractIntent(cleanQuery, {
      state: prevState,
      history: options?.conversationContext?.history,
      focusedProductId: options?.focusedProductId,
    });

    const intent = intentResult.intent;
    const mode = intentResult.mode;
    const refResolution = intentResult.referenceResolution;

    // Helper to build updated ConversationState
    const buildConversationState = (
      discussed: DiscussedProduct[],
      isMatchFound: boolean,
      resolvedProductId?: string | null,
      stageOverride?: ConversationStage
    ): ConversationState => {
      const mergedPreferences = Array.from(
        new Set([
          ...(prevState?.preferences || []),
          ...(intent.preferences || []),
        ])
      );

      let stage: ConversationStage = prevState?.stage || 'DISCOVERY';
      if (stageOverride) {
        stage = stageOverride;
      } else if (mode === 'COMPARISON_REQUEST') {
        stage = 'COMPARING';
      } else if (mode === 'PRODUCT_QUESTION' || mode === 'PRODUCT_REFERENCE') {
        stage = 'EVALUATING';
      } else if (isMatchFound) {
        stage = 'EVALUATING';
      }

      return {
        goal: prevState?.goal || null,
        category: intent.category || prevState?.category || null,
        budget: {
          min: intent.minPrice !== null ? intent.minPrice : (prevState?.budget?.min ?? null),
          max: intent.maxPrice !== null ? intent.maxPrice : (prevState?.budget?.max ?? null),
        },
        preferences: mergedPreferences,
        exclusions: intent.exclusions || prevState?.exclusions || [],
        useCase: intent.useCase || prevState?.useCase || null,
        discussedProducts: discussed.length > 0 ? discussed : prevDiscussed,
        rejectedProducts: intent.rejectedProductIds || prevState?.rejectedProducts || [],
        selectedProductId: resolvedProductId || options?.focusedProductId || prevState?.selectedProductId || null,
        stage,
        pendingClarification: null,
      };
    };

    // 3. Handle Case: Invalid Product Reference (e.g. "Tell me about the fourth one" when only 3 options exist)
    if (refResolution?.mode === 'invalid') {
      const state = buildConversationState(prevDiscussed, prevDiscussed.length > 0, null, 'EVALUATING');
      return {
        query: cleanQuery,
        intent,
        recommendations: prevDiscussed.map((p) => ({
          productId: p.id,
          rank: p.position,
          matchScore: 90 - (p.position - 1) * 5,
          reason: `Previously recommended option ${p.position}`,
        })),
        message: refResolution.unresolvedMessage || `I only showed you ${prevDiscussed.length} options. Did you mean the first, second, or third one?`,
        conversationState: state,
        mode,
      };
    }

    // 4. Handle Case: Product Reference or Question about already discussed products
    // (e.g. "Tell me about the second one", "Why this one?", "Does the first one have ANC?")
    if ((mode === 'PRODUCT_REFERENCE' || mode === 'PRODUCT_QUESTION') && refResolution?.resolved && prevDiscussed.length > 0) {
      const targetPos = refResolution.referencedPositions[0] || 1;
      const targetProd = prevDiscussed.find((p) => p.position === targetPos) || prevDiscussed[0];
      const targetId = targetProd.id;

      // Fetch candidates to supply rich product details without doing a broad new search
      const candidatesResult = await candidateRetrievalService.retrieveCandidates(cleanStoreId, intent);
      const targetCandidate = candidatesResult.products.find((p) => p.id === targetId);

      const resolvedProds = [targetProd];
      const state = buildConversationState(prevDiscussed, true, targetId, 'EVALUATING');

      let detailMessage = `Option ${targetProd.position} is the **${targetProd.name}** priced at ₹${targetProd.price.toLocaleString('en-IN')}.`;

      const isYesNoQuestion = /\b(does\s+(it|the\s+\w+)|is\s+(it|the\s+\w+)|has\s+it|support|have\b)/i.test(cleanQuery);
      if (mode === 'PRODUCT_QUESTION' && isYesNoQuestion && targetCandidate) {
        const prodDataText = [
          targetCandidate.name,
          targetCandidate.description || '',
          ...(targetCandidate.features || []),
          ...(targetCandidate.tags || []),
          JSON.stringify(targetCandidate.specifications || {}),
        ]
          .join(' ')
          .toLowerCase();

        const queryLower = cleanQuery.toLowerCase();
        let queryFeature = '';
        let featureLabel = '';

        if (/\b(anc|active noise cancel|noise cancellation)\b/i.test(queryLower)) {
          queryFeature = 'anc';
          featureLabel = 'Active Noise Cancellation (ANC)';
        } else if (/\b(waterproof|water resistant|ipx\d?)\b/i.test(queryLower)) {
          queryFeature = 'water';
          featureLabel = 'water resistance';
        } else if (/\b(wireless|bluetooth)\b/i.test(queryLower)) {
          queryFeature = 'wireless';
          featureLabel = 'wireless Bluetooth connectivity';
        } else if (/\b(backlit|rgb)\b/i.test(queryLower)) {
          queryFeature = 'backlit';
          featureLabel = 'backlit keys';
        } else if (/\b(mic|microphone)\b/i.test(queryLower)) {
          queryFeature = 'mic';
          featureLabel = 'a built-in microphone';
        }

        if (queryFeature) {
          const hasFeature =
            queryFeature === 'anc'
              ? /\b(anc|active noise cancel|noise cancel)\b/i.test(prodDataText)
              : prodDataText.includes(queryFeature);

          if (hasFeature) {
            detailMessage = `Yes, Option ${targetProd.position} (**${targetProd.name}**) includes ${featureLabel}.`;
          } else {
            detailMessage = `I can't confirm that from the product information available for Option ${targetProd.position} (**${targetProd.name}**).`;
          }
        } else if (targetCandidate.description) {
          detailMessage += ` ${targetCandidate.description}`;
        } else if (targetCandidate.features && targetCandidate.features.length > 0) {
          detailMessage += ` Key highlights: ${targetCandidate.features.slice(0, 3).join(', ')}.`;
        }
      } else if (targetCandidate?.description) {
        detailMessage += ` ${targetCandidate.description}`;
      } else if (targetCandidate?.features && targetCandidate.features.length > 0) {
        detailMessage += ` Key highlights: ${targetCandidate.features.slice(0, 3).join(', ')}.`;
      }

      return {
        query: cleanQuery,
        intent,
        recommendations: prevDiscussed.map((p) => ({
          productId: p.id,
          rank: p.position,
          matchScore: p.id === targetId ? 95 : 85,
          reason: p.id === targetId ? `Customer requested details for option ${p.position}` : `Option ${p.position}`,
        })),
        products: candidatesResult.products.filter((p) => prevDiscussed.some((dp) => dp.id === p.id)),
        message: detailMessage,
        conversationState: state,
        mode,
        resolvedProducts: resolvedProds,
      };
    }

    // 5. Handle Case: Comparison Request about discussed products
    // (e.g. "Which one is cheaper?", "Compare the first and third", "Which one has the best battery?")
    if (mode === 'COMPARISON_REQUEST' && prevDiscussed.length > 0) {
      // Fetch candidates to inspect details (price, battery, specs)
      const candidatesResult = await candidateRetrievalService.retrieveCandidates(cleanStoreId, intent);
      const matchedCandidates = candidatesResult.products.filter((p) => prevDiscussed.some((dp) => dp.id === p.id));

      let compMessage = '';
      let selectedId: string | null = null;
      let resolvedProds: DiscussedProduct[] = [];

      // Sub-case: Cheaper / price comparison
      if (refResolution?.comparisonAttribute === 'price' || /\b(cheaper|cheapest|lowest\s+price)\b/i.test(cleanQuery)) {
        const sorted = [...prevDiscussed].sort((a, b) => a.price - b.price);
        const cheapest = sorted[0];
        selectedId = cheapest.id;
        resolvedProds = [cheapest];
        compMessage = `Between the options shown, Option ${cheapest.position} (**${cheapest.name}**) is the most affordable at ₹${cheapest.price.toLocaleString('en-IN')}.`;
      } else if (/\b(more\s+expensive|most\s+expensive|highest\s+price|pricier)\b/i.test(cleanQuery)) {
        const sorted = [...prevDiscussed].sort((a, b) => b.price - a.price);
        const mostExpensive = sorted[0];
        selectedId = mostExpensive.id;
        resolvedProds = [mostExpensive];
        compMessage = `Between the options shown, Option ${mostExpensive.position} (**${mostExpensive.name}**) is the highest-tier at ₹${mostExpensive.price.toLocaleString('en-IN')}.`;
      } else if (/\b(best\s+battery|battery\s+life|more\s+battery|battery)\b/i.test(cleanQuery)) {
        // Battery comparison: look for battery numbers in features / specs / description
        const getBatteryScore = (pId: string): number => {
          const cand = matchedCandidates.find((c) => c.id === pId);
          if (!cand) return 0;
          const text = [cand.name, cand.description || '', ...(cand.features || [])].join(' ');
          const match = text.match(/(\d+)\s*(?:h|hr|hours?)/i);
          return match ? parseInt(match[1], 10) : 0;
        };

        const sortedByBattery = [...prevDiscussed].sort((a, b) => getBatteryScore(b.id) - getBatteryScore(a.id));
        const bestBattery = sortedByBattery[0];
        const batteryHrs = getBatteryScore(bestBattery.id);
        selectedId = bestBattery.id;
        resolvedProds = [bestBattery];
        compMessage = batteryHrs > 0
          ? `Option ${bestBattery.position} (**${bestBattery.name}**) offers the strongest battery life with up to ${batteryHrs} hours of playback.`
          : `Option ${bestBattery.position} (**${bestBattery.name}**) is rated highest for extended battery endurance.`;
      } else if (refResolution?.referencedPositions && refResolution.referencedPositions.length > 1) {
        // Multi-product comparison (e.g. "Compare the first and third")
        const targetProds = prevDiscussed.filter((p) => refResolution.referencedPositions.includes(p.position));
        resolvedProds = targetProds;
        compMessage = `Comparing ${targetProds.map((p) => `Option ${p.position} (**${p.name}** at ₹${p.price.toLocaleString('en-IN')})`).join(' and ')}.`;
      } else {
        compMessage = `Comparing the ${prevDiscussed.length} recommended options based on your preferences.`;
      }

      let comparisonData: ProductComparisonResult | undefined;
      if (prevDiscussed.length >= 2 && prevDiscussed.length <= 3) {
        try {
          const compResult = await comparisonService.compareProducts({
            storeId: cleanStoreId,
            productIds: prevDiscussed.map((p) => p.id),
            conversationState: prevState,
            query: cleanQuery,
          });
          comparisonData = compResult.comparison;
          if (!selectedId && compResult.comparison.winnerProductId) {
            selectedId = compResult.comparison.winnerProductId;
          }
          if (compMessage === '' || compMessage.startsWith('Comparing the')) {
            compMessage = compResult.message;
          }
        } catch {
          // Keep existing comparison message if comparison fails
        }
      }

      const state = buildConversationState(prevDiscussed, true, selectedId, 'COMPARING');

      return {
        query: cleanQuery,
        intent,
        recommendations: prevDiscussed.map((p) => ({
          productId: p.id,
          rank: p.position,
          matchScore: p.id === selectedId ? 95 : 88,
          reason: `Option ${p.position} in comparison`,
        })),
        products: matchedCandidates,
        message: compMessage,
        conversationState: state,
        mode,
        resolvedProducts: resolvedProds,
        comparison: comparisonData,
      };
    }

    // 5.4 Handle Case: Phase 6 Cart-Aware Cross-Sell & Intelligent Bundling Requests
    if (mode === 'CROSS_SELL_REQUEST' || mode === 'BUNDLE_REQUEST') {
      const sessionId = options?.sessionId || (prevState as any)?.sessionId || '';
      if (sessionId) {
        const crossSellResult = await bundleService.getCartCrossSell({
          sessionId,
          storeId,
          focusedProductId: options?.focusedProductId,
          query: cleanQuery,
          conversationState: prevState,
        });

        if (crossSellResult.suggestions.length > 0) {
          // Map complementary suggestions to discussedProducts so that follow-up turns
          // (e.g. "tell me about the cheaper one", "show me the second one") resolve naturally!
          const discussed: DiscussedProduct[] = crossSellResult.suggestions.map((s, idx) => ({
            id: s.productId,
            name: s.name,
            price: s.price,
            category: s.category,
            position: idx + 1,
          }));

          const candidateProducts = crossSellResult.suggestions.map((s) => ({
            id: s.productId,
            name: s.name,
            description: s.reason,
            category: s.category,
            brand: s.brand,
            price: s.price,
            stock: s.stock,
            images: s.image ? [s.image] : [],
            features: [],
            specifications: null,
            tags: [],
            relevanceScore: s.bundleScore,
          }));

          const state = buildConversationState(discussed, true, discussed[0].id, 'EVALUATING');

          let message = crossSellResult.explanation || 'Here are the recommended complementary items for your setup:';
          if (mode === 'BUNDLE_REQUEST' && crossSellResult.bundleOpportunity) {
            message = `${crossSellResult.explanation}\n\n${crossSellResult.bundleOpportunity.bundleSummary}`;
          }

          return {
            query: cleanQuery,
            intent,
            recommendations: crossSellResult.suggestions.map((s, idx) => ({
              productId: s.productId,
              rank: idx + 1,
              matchScore: s.bundleScore,
              reason: s.reason,
            })),
            products: candidateProducts,
            message,
            conversationState: state,
            mode,
            resolvedProducts: discussed,
            crossSell: crossSellResult,
            bundleOpportunity: crossSellResult.bundleOpportunity,
          };
        } else if (!crossSellResult.hasCartItems) {
          const state = buildConversationState(prevDiscussed, prevDiscussed.length > 0);
          return {
            query: cleanQuery,
            intent,
            recommendations: [],
            products: [],
            message: 'Your cart is currently empty. Once you add an item, I can recommend matching accessories and complete setups for you!',
            conversationState: state,
            mode,
            crossSell: crossSellResult,
            bundleOpportunity: null,
          };
        }
      }
    }

    // 5.5 Handle Case: Phase 7 UX Explicit Offer / Price Reduction Request
    // Triggered ONLY when customer explicitly asks for a price reduction or offer:
    // e.g. "Is there any price reduction on this?", "Can I get this cheaper?", "Can you reduce the price?"
    if (mode === 'OFFER_REQUEST') {
      let targetProd: DiscussedProduct | undefined = undefined;
      let targetId: string | undefined = undefined;
      let targetName = 'this product';

      // 1. Focused product (e.g., from Product Details modal) takes absolute precedence
      if (options?.focusedProductId) {
        targetId = options.focusedProductId;
        const found = prevDiscussed.find((p) => p.id === options.focusedProductId);
        if (found) {
          targetProd = found;
          targetName = found.name;
        } else {
          const directProd = await prisma.product.findUnique({
            where: { id: options.focusedProductId },
          });
          if (directProd) {
            targetName = directProd.name;
            targetProd = {
              id: directProd.id,
              name: directProd.name,
              price: Number(directProd.price),
              category: directProd.category || 'general',
              position: 1,
            };
          }
        }
      } else if (refResolution?.resolved && refResolution.referencedPositions.length > 0) {
        const pos = refResolution.referencedPositions[0];
        const found = prevDiscussed.find((p) => p.position === pos);
        if (found) {
          targetProd = found;
          targetId = found.id;
          targetName = found.name;
        }
      } else if (prevState?.selectedProductId) {
        const found = prevDiscussed.find((p) => p.id === prevState.selectedProductId);
        if (found) {
          targetProd = found;
          targetId = found.id;
          targetName = found.name;
        }
      } else if (prevDiscussed.length > 0) {
        targetProd = prevDiscussed[0];
        targetId = targetProd.id;
        targetName = targetProd.name;
      }

      // 2. Only retrieve candidates if no target product was identified
      let candidatesResult: { products: any[] } = { products: [] };
      if (!targetId) {
        candidatesResult = await candidateRetrievalService.retrieveCandidates(cleanStoreId, intent);
        if (candidatesResult.products.length > 0) {
          targetId = candidatesResult.products[0].id;
          targetName = candidatesResult.products[0].name;
          targetProd = {
            id: targetId,
            name: targetName,
            price: candidatesResult.products[0].price,
            category: candidatesResult.products[0].category || 'general',
            position: 1,
          };
        }
      }

      let commercialOffer: CommercialOffer | undefined = undefined;
      let responseMessage = `I couldn't find an eligible price reduction for ${targetName} right now.`;

      if (targetId) {
        try {
          const commResult = await commercialEngineService.evaluateCommercialDecision({
            storeId: cleanStoreId,
            sessionId: options?.sessionId || 'session-default',
            query: cleanQuery,
            productId: targetId,
            conversationState: prevState,
            cartProductIds: options?.cartProductIds,
            triggerEvent: 'DIRECT_REQUEST',
          });

          // Check if an authorized offer with a discount was produced and not suppressed
          if (
            commResult.decision !== 'NO_OFFER' &&
            commResult.offer &&
            (commResult.offer.discountPercent || 0) > 0 &&
            commResult.decision !== 'NON_PRICE_INCENTIVE' &&
            commResult.decision !== 'SALE_RECOVERY'
          ) {
            commercialOffer = commResult.offer;
            // Clean natural message: "I found an eligible price reduction for this product."
            responseMessage = `I found an eligible price reduction for ${commResult.offer.productName || targetName}.`;
          } else {
            responseMessage = `I couldn't find an eligible price reduction for ${targetName} right now.`;
          }
        } catch {
          responseMessage = `I couldn't find an eligible price reduction for ${targetName} right now.`;
        }
      }

      // Display products: if focused or targetId exists, ensure it is in display products
      let displayProducts: any[] = [];
      if (targetId) {
        const p = await prisma.product.findUnique({ where: { id: targetId } });
        if (p) {
          displayProducts = [{
            id: p.id,
            storeId: p.storeId,
            name: p.name,
            description: p.description,
            price: Number(p.price),
            stock: p.stock,
            category: p.category,
            brand: p.brand,
            images: p.images || [],
            specifications: p.specifications || {},
            tags: p.tags || [],
            rating: Number(p.rating || 4.5),
            ratingCount: p.ratingCount || 10,
          }];
        }
      }
      if (displayProducts.length === 0 && candidatesResult.products.length > 0) {
        displayProducts = candidatesResult.products.slice(0, 3);
      }

      const activeDiscussed = targetProd
        ? [targetProd, ...prevDiscussed.filter((dp) => dp.id !== targetProd?.id)]
        : prevDiscussed;
      const state = buildConversationState(activeDiscussed, true, targetId, 'EVALUATING');

      return {
        query: cleanQuery,
        intent,
        recommendations: activeDiscussed.map((p) => ({
          productId: p.id,
          rank: p.position,
          matchScore: p.id === targetId ? 95 : 85,
          reason: p.id === targetId ? `Customer requested price reduction for option ${p.position}` : `Option ${p.position}`,
        })),
        products: displayProducts.length > 0 ? displayProducts : candidatesResult.products.slice(0, 3),
        message: responseMessage,
        conversationState: state,
        mode: 'OFFER_REQUEST',
        commercialOffer,
      };
    }

    // 5.6 Handle Case: Customer Dissatisfaction (Phase 3)
    // - If reason is UNKNOWN: Ask exactly ONE targeted clarification question and pause (stage = CLARIFYING).
    // - If reason is CLEAR: Do NOT ask clarification. Refine constraints, avoid rejected products, and recommend better options.
    if (mode === 'DISSATISFACTION') {
      const dissat =
        intentResult.dissatisfactionResult ||
        dissatisfactionDetectorService.detectDissatisfaction(cleanQuery, prevState, prevDiscussed);

      // Case A: Reason is UNKNOWN -> Ask ONE targeted clarification question
      if (dissat.reason === 'UNKNOWN') {
        const updatedRejected = Array.from(
          new Set([...(prevState?.rejectedProducts || []), ...prevDiscussed.map((p) => p.id)])
        );
        const clarification =
          dissat.suggestedClarificationQuestion ||
          dissatisfactionDetectorService.generateTargetedClarification(prevState).question;
        const options = dissat.clarificationOptions || ['price', 'performance', 'brand', 'features'];

        const state: ConversationState = {
          goal: prevState?.goal || null,
          category: intent.category || prevState?.category || null,
          budget: {
            min: intent.minPrice !== null ? intent.minPrice : (prevState?.budget?.min ?? null),
            max: intent.maxPrice !== null ? intent.maxPrice : (prevState?.budget?.max ?? null),
          },
          preferences: prevState?.preferences || [],
          exclusions: prevState?.exclusions || [],
          useCase: intent.useCase || prevState?.useCase || null,
          discussedProducts: prevDiscussed,
          rejectedProducts: updatedRejected,
          selectedProductId: null,
          stage: 'CLARIFYING',
          pendingClarification: {
            question: clarification,
            options,
          },
        };

        return {
          query: cleanQuery,
          intent,
          recommendations: prevDiscussed.map((p) => ({
            productId: p.id,
            rank: p.position,
            matchScore: 85,
            reason: `Option ${p.position}`,
          })),
          products: [],
          message: clarification,
          conversationState: state,
          mode,
        };
      }

      // Case B: Reason is CLEAR -> Refine constraints, do NOT ask clarification question
      const updatedRejected = Array.from(
        new Set([...(prevState?.rejectedProducts || []), ...prevDiscussed.map((p) => p.id)])
      );
      intent.rejectedProductIds = updatedRejected;

      let customMessage = '';
      if (dissat.reason === 'PRICE') {
        customMessage = intent.maxPrice
          ? `Got it — looking for options under ₹${intent.maxPrice.toLocaleString('en-IN')} for you.`
          : 'Got it — looking for more affordable options for you.';
      } else if (dissat.reason === 'BRAND') {
        const excluded = dissat.extractedConstraint?.excludedBrand;
        customMessage = excluded
          ? `Got it — I'll exclude ${excluded} and show other options for you.`
          : 'Got it — searching for options from other brands for you.';
      } else if (dissat.reason === 'FEATURE') {
        customMessage = 'Understood — searching for options with better features for you.';
      } else if (dissat.reason === 'PERFORMANCE') {
        customMessage = 'Understood — focusing on higher performance options for you.';
      } else if (dissat.reason === 'SIZE') {
        customMessage = 'Got it — finding more compact and lightweight options for you.';
      } else {
        customMessage = 'Got it — refined recommendations based on your feedback.';
      }

      const candidatesResult = await candidateRetrievalService.retrieveCandidates(cleanStoreId, intent);
      const candidateProducts = candidatesResult.products;

      if (!candidateProducts || candidateProducts.length === 0) {
        const emptyState = buildConversationState([], false, null, 'EVALUATING');
        return {
          query: cleanQuery,
          intent,
          recommendations: [],
          products: [],
          message: `No published products matched your criteria after refining for "${cleanQuery}".`,
          conversationState: emptyState,
          mode,
        };
      }

      const rankingResult = await productRankingService.rankCandidates(intent, candidateProducts);
      const primaryRanked = rankingResult.rankedProducts
        .slice(0, MAX_PRIMARY_RECOMMENDATIONS)
        .map((r, idx) => ({ ...r, rank: idx + 1 }));

      const recommendedProductIds = new Set(primaryRanked.map((r) => r.productId));
      const recommendedCandidateProducts = candidateProducts.filter((p) => recommendedProductIds.has(p.id));

      // Phase 4: Sales Reasoner & Honest Trade-Off Explanations
      const salesReasoning = await salesReasonerService.explainRecommendations(
        intent,
        prevState,
        primaryRanked,
        recommendedCandidateProducts
      );

      const augmentedRanked = primaryRanked.map((r) => {
        const reasoning = salesReasoning.productReasonings.get(r.productId);
        return {
          ...r,
          whyRecommended: reasoning?.whyRecommended || r.reason,
          keyAdvantage: reasoning?.keyAdvantage,
          tradeoff: reasoning?.tradeoff || null,
          fitRole: reasoning?.fitRole,
          bestFor: reasoning?.bestFor || reasoning?.fitRole,
          reason: reasoning?.whyRecommended || r.reason,
        };
      });

      const discussedProducts: DiscussedProduct[] = augmentedRanked.map((r, index) => {
        const prod = recommendedCandidateProducts.find((p) => p.id === r.productId);
        return {
          id: r.productId,
          name: prod?.name || r.productId,
          price: prod?.price || 0,
          category: prod?.category || intent.category || '',
          position: index + 1,
        };
      });

      const conversationState = buildConversationState(discussedProducts, true, null, 'EVALUATING');

      return {
        query: cleanQuery,
        intent,
        recommendations: augmentedRanked,
        products: recommendedCandidateProducts,
        message: customMessage || salesReasoning.salesOverview || undefined,
        salesOverview: salesReasoning.salesOverview,
        conversationState,
        mode,
      };
    }

    // 5.6 Handle Case: Answer to Pending Clarification (Phase 3)
    if (mode === 'CLARIFICATION_ANSWER') {
      const dissat =
        intentResult.dissatisfactionResult ||
        dissatisfactionDetectorService.resolveClarificationAnswer(cleanQuery, prevState, prevDiscussed);

      const updatedRejected = Array.from(
        new Set([...(prevState?.rejectedProducts || []), ...prevDiscussed.map((p) => p.id)])
      );
      intent.rejectedProductIds = updatedRejected;

      let customMessage = '';
      if (dissat.reason === 'PRICE') {
        customMessage = intent.maxPrice
          ? `Got it — looking for options under ₹${intent.maxPrice.toLocaleString('en-IN')} for you.`
          : 'Got it — looking for more affordable options for you.';
      } else if (dissat.reason === 'BRAND') {
        customMessage = intent.brand
          ? `Got it — focusing on ${intent.brand} options for you.`
          : 'Got it — searching for options from your preferred brand.';
      } else if (dissat.reason === 'FEATURE') {
        customMessage = 'Understood — searching for options with better features for you.';
      } else if (dissat.reason === 'PERFORMANCE') {
        customMessage = 'Understood — focusing on higher performance options for you.';
      } else {
        customMessage = 'Got it — here are refined options based on your preferences.';
      }

      const candidatesResult = await candidateRetrievalService.retrieveCandidates(cleanStoreId, intent);
      const candidateProducts = candidatesResult.products;

      if (!candidateProducts || candidateProducts.length === 0) {
        const emptyState = buildConversationState([], false, null, 'EVALUATING');
        return {
          query: cleanQuery,
          intent,
          recommendations: [],
          products: [],
          message: `No published products matched your criteria after refining for "${cleanQuery}".`,
          conversationState: emptyState,
          mode,
        };
      }

      const rankingResult = await productRankingService.rankCandidates(intent, candidateProducts);
      const primaryRanked = rankingResult.rankedProducts
        .slice(0, MAX_PRIMARY_RECOMMENDATIONS)
        .map((r, idx) => ({ ...r, rank: idx + 1 }));

      const recommendedProductIds = new Set(primaryRanked.map((r) => r.productId));
      const recommendedCandidateProducts = candidateProducts.filter((p) => recommendedProductIds.has(p.id));

      // Phase 4: Sales Reasoner & Honest Trade-Off Explanations
      const salesReasoning = await salesReasonerService.explainRecommendations(
        intent,
        prevState,
        primaryRanked,
        recommendedCandidateProducts
      );

      const augmentedRanked = primaryRanked.map((r) => {
        const reasoning = salesReasoning.productReasonings.get(r.productId);
        return {
          ...r,
          whyRecommended: reasoning?.whyRecommended || r.reason,
          keyAdvantage: reasoning?.keyAdvantage,
          tradeoff: reasoning?.tradeoff || null,
          fitRole: reasoning?.fitRole,
          bestFor: reasoning?.bestFor || reasoning?.fitRole,
          reason: reasoning?.whyRecommended || r.reason,
        };
      });

      const discussedProducts: DiscussedProduct[] = augmentedRanked.map((r, index) => {
        const prod = recommendedCandidateProducts.find((p) => p.id === r.productId);
        return {
          id: r.productId,
          name: prod?.name || r.productId,
          price: prod?.price || 0,
          category: prod?.category || intent.category || '',
          position: index + 1,
        };
      });

      const conversationState = buildConversationState(discussedProducts, true, null, 'EVALUATING');

      return {
        query: cleanQuery,
        intent,
        recommendations: augmentedRanked,
        products: recommendedCandidateProducts,
        message: customMessage || salesReasoning.salesOverview || undefined,
        salesOverview: salesReasoning.salesOverview,
        conversationState,
        mode,
      };
    }

    // 6. Step 2: Retrieve candidate products from database using MERGED intent constraints
    // (For NEW_REQUEST or FOLLOW_UP_REFINEMENT)
    const candidatesResult = await candidateRetrievalService.retrieveCandidates(cleanStoreId, intent);
    const candidateProducts = candidatesResult.products;

    // 7. Edge case: No candidates match hard constraints (Category, price range, store scoping, stock > 0, status = PUBLISHED)
    if (!candidateProducts || candidateProducts.length === 0) {
      const emptyState = buildConversationState([], false);
      return {
        query: cleanQuery,
        intent,
        recommendations: [],
        products: [],
        message: `No published products matched your search for "${cleanQuery}".`,
        conversationState: emptyState,
        mode,
      };
    }

    // 8. Step 3: AI Product Ranking (Phase 4C)
    const rankingResult = await productRankingService.rankCandidates(intent, candidateProducts);

    // Enforce MAXIMUM 3 primary recommendations
    const primaryRanked = rankingResult.rankedProducts
      .slice(0, MAX_PRIMARY_RECOMMENDATIONS)
      .map((r, idx) => ({
        ...r,
        rank: idx + 1,
      }));

    const recommendedProductIds = new Set(primaryRanked.map((r) => r.productId));
    const recommendedCandidateProducts = candidateProducts.filter((p) => recommendedProductIds.has(p.id));

    // Phase 4: Sales Reasoner & Honest Trade-Off Explanations
    const salesReasoning = await salesReasonerService.explainRecommendations(
      intent,
      prevState,
      primaryRanked,
      recommendedCandidateProducts
    );

    const augmentedRanked = primaryRanked.map((r) => {
      const reasoning = salesReasoning.productReasonings.get(r.productId);
      return {
        ...r,
        whyRecommended: reasoning?.whyRecommended || r.reason,
        keyAdvantage: reasoning?.keyAdvantage,
        tradeoff: reasoning?.tradeoff || null,
        fitRole: reasoning?.fitRole,
        bestFor: reasoning?.bestFor || reasoning?.fitRole,
        reason: reasoning?.whyRecommended || r.reason,
      };
    });

    // Map discussed products with exact positions (1, 2, 3)
    const discussedProducts: DiscussedProduct[] = augmentedRanked.map((r, index) => {
      const prod = recommendedCandidateProducts.find((p) => p.id === r.productId);
      return {
        id: r.productId,
        name: prod?.name || r.productId,
        price: prod?.price || 0,
        category: prod?.category || intent.category || '',
        position: index + 1,
      };
    });

    const isMatchFound = augmentedRanked.length > 0;
    const conversationState = buildConversationState(discussedProducts, isMatchFound);

    // Phase 7 UX: Do NOT automatically present commercialOffer simply due to hesitation signals.
    // Commercial offers require an explicit OFFER_REQUEST from the customer.
    const commercialOffer: CommercialOffer | undefined = undefined;

    const message = augmentedRanked.length === 0
      ? `No published products matched your search for "${cleanQuery}".`
      : salesReasoning.salesOverview || undefined;

    return {
      query: cleanQuery,
      intent,
      recommendations: augmentedRanked,
      products: recommendedCandidateProducts,
      message,
      salesOverview: salesReasoning.salesOverview,
      conversationState,
      mode,
      commercialOffer,
    };
  }
}

export const recommendationService = new RecommendationService();


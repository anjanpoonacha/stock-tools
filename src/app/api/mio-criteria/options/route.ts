// src/app/api/mio-criteria/options/route.ts
/**
 * API Route: Fetch Criterion Options
 * 
 * Proxy endpoint for fetching enum criterion options from MarketInOut
 * Implements server-side caching via KV store
 * Handles CORS by making server-to-server requests
 * 
 * GET /api/mio-criteria/options?criterionId=<id>
 */

import { NextRequest, NextResponse } from 'next/server';
import { CriteriaKVStore } from '@/lib/mio/criteriaStore.kv';
import { fetchCriterionOptions, isValidCriterionId } from '@/lib/mio/server/criteriaOptionsFetcher';
import type { CriterionOption } from '@/types/mioCriteria';

/**
 * API Response structure
 */
interface APIResponse {
  success: boolean;
  criterionId?: string;
  options?: CriterionOption[];
  cached?: boolean;
  timestamp?: string;
  error?: string;
}

/**
 * GET handler - Fetch options for a specific criterion
 * 
 * Query Parameters:
 * - criterionId: The criterion ID to fetch options for (e.g., 'sector', 'industry')
 * 
 * Response:
 * - 200: Success with options data
 * - 400: Invalid request (missing or invalid criterionId)
 * - 500: Server error (failed to fetch from external API)
 */
export async function GET(request: NextRequest): Promise<NextResponse<APIResponse>> {
  const startTime = Date.now();
  
  // Extract criterion ID from query parameters
  const criterionId = request.nextUrl.searchParams.get('criterionId');
  
  // Validate criterion ID
  if (!criterionId) {

    return NextResponse.json(
      {
        success: false,
        error: 'Missing required parameter: criterionId',
      },
      { status: 400 }
    );
  }
  
  // Validate criterion ID format (prevent injection)
  if (!isValidCriterionId(criterionId)) {

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid criterionId format. Only alphanumeric characters and underscores allowed.',
        criterionId,
      },
      { status: 400 }
    );
  }

  try {
    const kvStore = new CriteriaKVStore();
    let options: CriterionOption[] | null = null;
    let cached = false;
    
    // Step 1: Check KV cache
    try {
      options = await kvStore.getOptions(criterionId);
      if (options && options.length > 0) {
        cached = true;

      }
    } catch (kvError) {
      // KV might not be configured, log warning and continue to API fetch

    }
    
    // Step 2: If not in cache, fetch from MarketInOut API
    if (!options) {

      options = await fetchCriterionOptions(criterionId);
      
      // Step 3: Save to KV cache (24h TTL)
      if (options.length > 0) {
        try {
          await kvStore.saveOptions(criterionId, options);

        } catch (kvError) {
          // Non-fatal: Cache save failed, but we have the data

        }
      }
    }
    
    const duration = Date.now() - startTime;

    // Return success response
    return NextResponse.json({
      success: true,
      criterionId,
      options,
      cached,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Return error response
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        criterionId,
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS handler - CORS preflight support
 */
export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  );
}

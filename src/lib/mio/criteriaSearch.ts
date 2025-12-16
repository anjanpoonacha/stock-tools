// src/lib/mio/criteriaSearch.ts
// Fuzzy search algorithm for MarketInOut criteria

import type {
  CriterionMetadata,
  CriterionMatch,
  CriteriaSearchResult,
} from '@/types/mioCriteria';

/**
 * Search criteria by ID and name with relevance scoring
 * 
 * @param query - Search term entered by user
 * @param allCriteria - Complete list of criteria to search through
 * @returns Search result with matched criteria sorted by relevance
 * 
 * @example
 * searchCriteria('sector', allCriteria)
 * // → { query: 'sector', matches: [{ criterion: {...}, matchType: 'both', relevanceScore: 100 }], ... }
 * 
 * @example
 * searchCriteria('sec', allCriteria)
 * // → { query: 'sec', matches: [
 * //     { criterion: {id: 'sector'}, matchType: 'id', relevanceScore: 80 },
 * //     { criterion: {name: 'Security Type'}, matchType: 'name', relevanceScore: 60 }
 * //   ], ... }
 */
export function searchCriteria(
  query: string,
  allCriteria: CriterionMetadata[]
): CriteriaSearchResult {
  // Normalize and validate query
  const normalizedQuery = query.trim().toLowerCase();
  
  // Empty query returns empty matches
  if (!normalizedQuery) {
    return {
      query,
      matches: [],
      timestamp: new Date(),
    };
  }
  
  // Calculate relevance for each criterion
  const matches: CriterionMatch[] = [];
  
  for (const criterion of allCriteria) {
    const scoreResult = calculateRelevanceScore(normalizedQuery, criterion);
    
    if (scoreResult) {
      matches.push({
        criterion,
        matchType: scoreResult.matchType,
        relevanceScore: scoreResult.score,
      });
    }
  }
  
  // Sort by relevance score (highest first), then alphabetically by name for ties
  matches.sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }
    return a.criterion.name.localeCompare(b.criterion.name);
  });
  
  return {
    query,
    matches,
    timestamp: new Date(),
  };
}

/**
 * Calculate relevance score for a criterion match
 * 
 * Scoring algorithm:
 * - Exact ID match: 100
 * - Exact name match: 90
 * - ID starts with query: 80
 * - Name starts with query: 70
 * - Name contains query (word boundary): 60
 * - ID contains query: 50
 * - No match: null
 * 
 * @param query - Normalized search query (lowercase, trimmed)
 * @param criterion - Criterion to evaluate
 * @returns Score result or null if no match
 * 
 * @example
 * calculateRelevanceScore('sector', { id: 'sector', name: 'Sector' })
 * // → { score: 100, matchType: 'both' }
 * 
 * @example
 * calculateRelevanceScore('sec', { id: 'sector', name: 'Sector' })
 * // → { score: 80, matchType: 'id' }
 */
function calculateRelevanceScore(
  query: string,
  criterion: CriterionMetadata
): { score: number; matchType: 'id' | 'name' | 'both' } | null {
  // Normalize criterion data
  const normalizedId = criterion.id.toLowerCase();
  const normalizedName = criterion.name.toLowerCase();
  
  // Strip non-alphanumeric from query for matching
  const cleanQuery = query.replace(/[^a-z0-9]/g, '');
  if (!cleanQuery) {
    return null; // Query only had special characters
  }
  
  // Check for exact matches first (highest priority)
  const idExactMatch = normalizedId === cleanQuery;
  const nameExactMatch = normalizedName === cleanQuery;
  
  if (idExactMatch && nameExactMatch) {
    return { score: 100, matchType: 'both' };
  }
  
  if (idExactMatch) {
    return { score: 100, matchType: 'id' };
  }
  
  if (nameExactMatch) {
    return { score: 90, matchType: 'name' };
  }
  
  // Check for prefix matches
  const idStartsWith = normalizedId.startsWith(cleanQuery);
  const nameStartsWith = normalizedName.startsWith(cleanQuery);
  
  if (idStartsWith && nameStartsWith) {
    return { score: 80, matchType: 'both' };
  }
  
  if (idStartsWith) {
    return { score: 80, matchType: 'id' };
  }
  
  if (nameStartsWith) {
    return { score: 70, matchType: 'name' };
  }
  
  // Check for word boundary matches in name
  // Match at start of any word (after space, hyphen, etc.)
  const wordBoundaryRegex = new RegExp(`\\b${cleanQuery}`, 'i');
  const nameWordBoundaryMatch = wordBoundaryRegex.test(criterion.name);
  
  // Check for contains matches
  const idContains = normalizedId.includes(cleanQuery);
  const nameContains = normalizedName.includes(cleanQuery);
  
  // Prioritize word boundary match over simple contains
  if (nameWordBoundaryMatch) {
    if (idContains) {
      return { score: 60, matchType: 'both' };
    }
    return { score: 60, matchType: 'name' };
  }
  
  // Simple contains matches (lowest score)
  if (idContains && nameContains) {
    return { score: 50, matchType: 'both' };
  }
  
  if (idContains) {
    return { score: 50, matchType: 'id' };
  }
  
  if (nameContains) {
    return { score: 50, matchType: 'name' };
  }
  
  // No match found
  return null;
}

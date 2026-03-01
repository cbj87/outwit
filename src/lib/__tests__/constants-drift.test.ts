import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  EVENT_SCORES,
  ICKY_PICK_SCORES,
  PROPHECY_POINTS,
  getSurvivalPoints,
} from '@/lib/constants';

/**
 * Constants drift test
 *
 * The Edge Function (supabase/functions/calculate-scores/index.ts) has its own
 * copy of scoring constants because it runs in Deno and can't import from src/.
 * This test ensures the two copies stay in sync.
 */
describe('Edge Function constants drift detection', () => {
  const edgeFunctionPath = resolve(__dirname, '../../../supabase/functions/calculate-scores/index.ts');
  const edgeFunctionSource = readFileSync(edgeFunctionPath, 'utf-8');

  /**
   * Parse a Record<string, number> from the Edge Function source.
   * Matches patterns like:  key: value, or 'key': value,
   */
  function parseRecord(varName: string): Record<string, number> {
    // Match: const VAR_NAME: Record<...> = { ... };
    const regex = new RegExp(
      `const ${varName}[^=]*=\\s*\\{([^}]+)\\}`,
      's',
    );
    const match = edgeFunctionSource.match(regex);
    if (!match) throw new Error(`Could not find ${varName} in Edge Function`);

    const body = match[1];
    const entries: Record<string, number> = {};

    // Match: key: value  or  'key': value
    const entryRegex = /['"]?(\w+)['"]?\s*:\s*(-?\d+)/g;
    let entryMatch;
    while ((entryMatch = entryRegex.exec(body)) !== null) {
      entries[entryMatch[1]] = parseInt(entryMatch[2], 10);
    }

    return entries;
  }

  /**
   * Parse getSurvivalPoints function thresholds from Edge Function.
   */
  function parseGetSurvivalPoints(): (episodeNumber: number) => number {
    // The function follows this exact pattern in both client and server:
    // if (episodeNumber <= 3) return 1;
    // if (episodeNumber <= 6) return 2;
    // ...
    const regex = /function getSurvivalPoints\(episodeNumber:\s*number\):\s*number\s*\{([^}]+)\}/s;
    const match = edgeFunctionSource.match(regex);
    if (!match) throw new Error('Could not find getSurvivalPoints in Edge Function');

    const body = match[1];
    const thresholds: Array<{ threshold: number; points: number }> = [];
    let defaultPoints = 0;

    // Match: if (episodeNumber <= N) return M;
    const ifRegex = /if\s*\(\s*episodeNumber\s*<=\s*(\d+)\s*\)\s*return\s*(\d+)/g;
    let ifMatch;
    while ((ifMatch = ifRegex.exec(body)) !== null) {
      thresholds.push({ threshold: parseInt(ifMatch[1], 10), points: parseInt(ifMatch[2], 10) });
    }

    // Match: return N; (the default at the end)
    const defaultRegex = /return\s+(\d+)\s*;/g;
    let lastReturn;
    while ((lastReturn = defaultRegex.exec(body)) !== null) {
      defaultPoints = parseInt(lastReturn[1], 10);
    }

    return (episodeNumber: number) => {
      for (const { threshold, points } of thresholds) {
        if (episodeNumber <= threshold) return points;
      }
      return defaultPoints;
    };
  }

  it('EVENT_SCORES match between client and Edge Function', () => {
    const edgeEventScores = parseRecord('EVENT_SCORES');

    // Client has survived_episode: 0 which may not be in Edge Function's record
    const clientWithoutSurvived = { ...EVENT_SCORES };
    delete (clientWithoutSurvived as Record<string, number>).survived_episode;
    const edgeWithoutSurvived = { ...edgeEventScores };
    delete edgeWithoutSurvived.survived_episode;

    // Check all client keys exist in edge with same values
    for (const [key, value] of Object.entries(clientWithoutSurvived)) {
      expect(edgeWithoutSurvived[key], `EVENT_SCORES.${key} mismatch`).toBe(value);
    }

    // Check edge doesn't have extra keys
    for (const key of Object.keys(edgeWithoutSurvived)) {
      expect(clientWithoutSurvived).toHaveProperty(key);
    }
  });

  it('ICKY_PICK_SCORES match between client and Edge Function', () => {
    const edgeIckyScores = parseRecord('ICKY_PICK_SCORES');

    for (const [key, value] of Object.entries(ICKY_PICK_SCORES)) {
      expect(edgeIckyScores[key], `ICKY_PICK_SCORES.${key} mismatch`).toBe(value);
    }

    for (const key of Object.keys(edgeIckyScores)) {
      expect(ICKY_PICK_SCORES).toHaveProperty(key);
    }
  });

  it('PROPHECY_POINTS match between client and Edge Function', () => {
    const edgeProphecyPoints = parseRecord('PROPHECY_POINTS');

    for (const [key, value] of Object.entries(PROPHECY_POINTS)) {
      expect(edgeProphecyPoints[key], `PROPHECY_POINTS[${key}] mismatch`).toBe(value);
    }

    expect(Object.keys(edgeProphecyPoints)).toHaveLength(Object.keys(PROPHECY_POINTS).length);
  });

  it('getSurvivalPoints match between client and Edge Function', () => {
    const edgeGetSurvivalPoints = parseGetSurvivalPoints();

    // Test every episode number from 0 to 20
    for (let ep = 0; ep <= 20; ep++) {
      expect(
        edgeGetSurvivalPoints(ep),
        `getSurvivalPoints(${ep}) mismatch`,
      ).toBe(getSurvivalPoints(ep));
    }
  });
});

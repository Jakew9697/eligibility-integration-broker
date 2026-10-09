/** 2026 HHS (ASPE) poverty guideline, 48 contiguous states, annual dollars. */
const GUIDELINE_2026 = [15960, 21640, 27320, 33000, 38680, 44360, 50040, 55720] as const;
const GUIDELINE_EACH_ADDITIONAL = 5680;

function assertSize(size: number) {
  if (!Number.isInteger(size) || size < 1) throw new RangeError(`Household size must be a positive whole number, got ${size}`);
}

export function annualGuideline(size: number): number {
  assertSize(size);
  const base = GUIDELINE_2026[Math.min(size, 8) - 1] as number;
  return base + Math.max(0, size - 8) * GUIDELINE_EACH_ADDITIONAL;
}

/** Integer ceiling division, so 130% is computed as annual * 13 / 120 without float error. */
const ceilDiv = (a: number, b: number) => Math.floor((a + b - 1) / b);

/** RFT 250 "each additional member" row. Published as whole dollars, not derived from the guideline. */
const FAP_EACH_ADDITIONAL = { gross130: 616, net100: 474, categorical200: 948 } as const;

export interface FapLimits {
  gross130: number;
  net100: number;
  categorical200: number;
}

/**
 * Monthly FAP limits, RFT 250 effective 10-1-2026.
 * Rows 1 to 8 come from the guideline. The published 200% column is twice the 100% column
 * (not a separate rounding of 200%). Larger groups add the published per-person amounts to row 8.
 */
export function fapLimits(size: number): FapLimits {
  assertSize(size);
  const base = Math.min(size, 8);
  const annual = annualGuideline(base);
  const net = ceilDiv(annual, 12);
  const extra = size - base;
  return {
    gross130: ceilDiv(annual * 13, 120) + extra * FAP_EACH_ADDITIONAL.gross130,
    net100: net + extra * FAP_EACH_ADDITIONAL.net100,
    categorical200: 2 * net + extra * FAP_EACH_ADDITIONAL.categorical200,
  };
}

/**
 * Healthy Michigan Plan monthly income limit: 133% of the guideline plus the standard
 * 5 percentage point MAGI disregard, so 138%. Rounded up to the next dollar like RFT 250.
 */
export function hmpMonthlyLimit(size: number): number {
  return ceilDiv(annualGuideline(size) * 138, 1200);
}

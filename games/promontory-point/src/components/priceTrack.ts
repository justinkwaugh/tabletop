// R-1.2
export const PRICE_TRACK_LENGTH = 30
export const MIN_PRICE_INDEX = 0
export const MAX_PRICE_INDEX = PRICE_TRACK_LENGTH - 1
export const ZERO_PRICE_SPACES = 5

// R-1.3
export const START_PRICE_INDEX = 9

export const PRICE_INDICES: readonly number[] = Array.from(
    { length: PRICE_TRACK_LENGTH },
    (_, index) => index
)

export function sharePriceAt(priceIndex: number): number {
    return Math.max(0, priceIndex - (ZERO_PRICE_SPACES - 1))
}

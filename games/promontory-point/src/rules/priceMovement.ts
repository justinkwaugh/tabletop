import { MAX_PRICE_INDEX, MIN_PRICE_INDEX } from '../components/priceTrack.js'

export type PriceMovement = {
    priceIndex: number
    capped: boolean
}

// R-1.2: a price never moves past 25 or past the last 0; movement beyond is lost.
export function movePrice(priceIndex: number, priceChange: number): PriceMovement {
    const unclamped = priceIndex + priceChange
    const clamped = Math.min(MAX_PRICE_INDEX, Math.max(MIN_PRICE_INDEX, unclamped))
    return { priceIndex: clamped, capped: clamped !== unclamped }
}

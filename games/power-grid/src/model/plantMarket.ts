import * as Type from 'typebox'
import { DISCOUNT_MINIMUM_BID, Step, auctionableCount } from '../components/rules.js'

export const STEP_3_CARD = 'step3'

export type DeckCard = Type.Static<typeof DeckCard>
export const DeckCard = Type.Union([Type.Integer({ minimum: 3 }), Type.Literal(STEP_3_CARD)])

export function isStep3Card(card: DeckCard): card is typeof STEP_3_CARD {
    return card === STEP_3_CARD
}

export function isPlant(card: DeckCard): card is number {
    return typeof card === 'number'
}

/** The market in ascending order, the Step 3 card counting as the highest plant. */
export function sortMarket(cards: readonly DeckCard[]): DeckCard[] {
    const plants = cards.filter(isPlant).toSorted((a, b) => a - b)
    return cards.some(isStep3Card) ? [...plants, STEP_3_CARD] : plants
}

export function marketPlants(cards: readonly DeckCard[]): number[] {
    return cards.filter(isPlant)
}

/** Plants players may put up for auction: the current market, or all six in Step 3. */
export function auctionablePlants(market: readonly DeckCard[], step: Step): number[] {
    return market.slice(0, auctionableCount(step)).filter(isPlant)
}

export function futurePlants(market: readonly DeckCard[], step: Step): DeckCard[] {
    return market.slice(auctionableCount(step))
}

export function lowestPlant(market: readonly DeckCard[]): number | undefined {
    return marketPlants(market)[0]
}

export function highestPlant(market: readonly DeckCard[]): number | undefined {
    return marketPlants(market).at(-1)
}

export function minimumBid(plant: number, discountPlant: number | undefined): number {
    return plant === discountPlant ? DISCOUNT_MINIMUM_BID : plant
}

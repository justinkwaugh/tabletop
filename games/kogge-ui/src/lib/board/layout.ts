import type { Point } from '@tabletop/common'
import { LAYOUT as layout } from './layoutData.js'

export type CardSide = 'top' | 'right' | 'bottom' | 'left'

export interface Rect {
    x: number
    y: number
    width: number
    height: number
}

export interface CityPlacement {
    number: number
    card: Rect
    side: CardSide
    harbour: Point
}

export const BOARD_WIDTH = layout.width
export const BOARD_HEIGHT = layout.height
export const CARD_WIDTH = layout.card.width
export const CARD_HEIGHT = layout.card.height
export const SEA_CENTRE: Point = { x: 800, y: 560 }

function isCardSide(side: string): side is CardSide {
    return side === 'top' || side === 'right' || side === 'bottom' || side === 'left'
}

function harbourOf(card: Rect, side: CardSide): Point {
    const offset = layout.harbourOffset
    switch (side) {
        case 'top':
            return { x: card.x + card.width / 2, y: card.y + card.height + offset }
        case 'bottom':
            return { x: card.x + card.width / 2, y: card.y - offset }
        case 'left':
            return { x: card.x + card.width + offset, y: card.y + card.height / 2 }
        case 'right':
            return { x: card.x - offset, y: card.y + card.height / 2 }
    }
}

export const CITY_PLACEMENTS: readonly CityPlacement[] = layout.cities.map((city) => {
    if (!isCardSide(city.side)) {
        throw Error(`Unknown card side ${city.side}`)
    }
    const card = { x: city.x, y: city.y, width: CARD_WIDTH, height: CARD_HEIGHT }
    return { number: city.number, card, side: city.side, harbour: harbourOf(card, city.side) }
})

export function cityPlacement(city: number): CityPlacement {
    const placement = CITY_PLACEMENTS[city]
    if (!placement) {
        throw Error(`No placement for city ${city}`)
    }
    return placement
}

// The card edge facing the sea, where the pier runs down to the harbour.
export function pierStart(placement: CityPlacement): Point {
    const { card, harbour, side } = placement
    switch (side) {
        case 'top':
            return { x: harbour.x, y: card.y + card.height }
        case 'bottom':
            return { x: harbour.x, y: card.y }
        case 'left':
            return { x: card.x + card.width, y: harbour.y }
        case 'right':
            return { x: card.x, y: harbour.y }
    }
}

export const MARKET_AREA: Rect = { x: 24, y: 806, width: 404, height: 270 }
export const WAREHOUSE_AREA: Rect = { x: 1314, y: 806, width: 266, height: 270 }
export const TITLE_AREA: Rect = { x: 752, y: 912, width: 240, height: 164 }

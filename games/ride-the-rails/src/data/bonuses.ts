import type { MapId } from './maps.js'

export type BonusId = 'bonus.usa.chicago' | 'bonus.usa.five-dollar' | 'bonus.usa.transcontinental'

export type FixedBonus = {
    readonly id: BonusId
    readonly printedName: string
    readonly amount: number
}

export type JunctionPricedBonus = {
    readonly id: BonusId
    readonly printedName: string
    readonly cityHexAmount: number
    readonly otherHexAmount: number
}

export type BonusDefinition = FixedBonus | JunctionPricedBonus

// R-4.3.1
export const CHICAGO_BONUS: FixedBonus = {
    id: 'bonus.usa.chicago',
    printedName: 'Chicago',
    amount: 2
}

// R-4.3.2
export const FIVE_DOLLAR_BONUS: FixedBonus = {
    id: 'bonus.usa.five-dollar',
    printedName: '$5 cities',
    amount: 5
}

// R-4.3.3
export const TRANSCONTINENTAL_BONUS: JunctionPricedBonus = {
    id: 'bonus.usa.transcontinental',
    printedName: 'Transcontinental',
    cityHexAmount: 12,
    otherHexAmount: 8
}

// R-4.3; R-8: an expansion map adds its own row.
export const BONUSES: Readonly<Record<MapId, readonly BonusDefinition[]>> = {
    'map.usa': [CHICAGO_BONUS, FIVE_DOLLAR_BONUS, TRANSCONTINENTAL_BONUS]
}

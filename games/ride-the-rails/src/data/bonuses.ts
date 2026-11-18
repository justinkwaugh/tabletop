import type { CityId } from './boardMap.js'
import type { MapId } from './maps.js'

export type BonusId =
    | 'bonus.usa.chicago'
    | 'bonus.usa.five-dollar'
    | 'bonus.usa.transcontinental'
    | 'bonus.au.perth'
    | 'bonus.au.brisbane'
    | 'bonus.ca.toronto'
    | 'bonus.ca.intercolonial'
    | 'bonus.fr.paris'
    | 'bonus.de.berlin'
    | 'bonus.de.greater-germany'

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

// R-8 (Toronto): one price for a railroad's first locomotive in the city, another for every
// other placement there.
export type StartPricedBonus = {
    readonly id: BonusId
    readonly printedName: string
    readonly startAmount: number
    readonly buildInAmount: number
}

// R-8 (Intercolonial, Greater Germany): once, when the named cities are first one network.
export type ConnectionBonus = {
    readonly id: BonusId
    readonly printedName: string
    readonly amount: number
    readonly cityIds: readonly CityId[]
}

export type BonusDefinition = FixedBonus | JunctionPricedBonus | StartPricedBonus | ConnectionBonus

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

// R-8.2: the board prints dollars, paid for each placement in the city; it holds one locomotive.
export const PERTH_BONUS: FixedBonus = {
    id: 'bonus.au.perth',
    printedName: 'Perth',
    amount: 50
}

// R-8.2, as Perth.
export const BRISBANE_BONUS: FixedBonus = {
    id: 'bonus.au.brisbane',
    printedName: 'Brisbane',
    amount: 20
}

// R-8.3: $2 for a railroad's start in Toronto, $3 for every other placement there.
export const TORONTO_BONUS: StartPricedBonus = {
    id: 'bonus.ca.toronto',
    printedName: 'Toronto',
    startAmount: 2,
    buildInAmount: 3
}

// R-8.3: once, to the placement after which the three link cities are one network.
export const INTERCOLONIAL_BONUS: ConnectionBonus = {
    id: 'bonus.ca.intercolonial',
    printedName: 'Intercolonial',
    amount: 8,
    cityIds: ['city.ca.sault-ste-marie', 'city.ca.windsor', 'city.ca.quebec-city']
}

// R-8.4: $10 for each placement in Paris, a start included.
export const PARIS_BONUS: FixedBonus = {
    id: 'bonus.fr.paris',
    printedName: 'Paris',
    amount: 10
}

// R-8.5: $3 for each placement in Berlin, a start included.
export const BERLIN_BONUS: FixedBonus = {
    id: 'bonus.de.berlin',
    printedName: 'Berlin',
    amount: 3
}

// R-8.5: once, to the placement after which the five link cities are one network.
export const GREATER_GERMANY_BONUS: ConnectionBonus = {
    id: 'bonus.de.greater-germany',
    printedName: 'Greater Germany',
    amount: 12,
    cityIds: [
        'city.de.berlin',
        'city.de.hamburg',
        'city.de.koln',
        'city.de.dresden',
        'city.de.munchen'
    ]
}

// R-4.3; R-8: an expansion map adds its own row.
export const BONUSES: Readonly<Record<MapId, readonly BonusDefinition[]>> = {
    'map.usa': [CHICAGO_BONUS, FIVE_DOLLAR_BONUS, TRANSCONTINENTAL_BONUS],
    'map.au': [PERTH_BONUS, BRISBANE_BONUS],
    'map.ca': [TORONTO_BONUS, INTERCOLONIAL_BONUS],
    'map.fr': [PARIS_BONUS],
    'map.de': [BERLIN_BONUS, GREATER_GERMANY_BONUS]
}

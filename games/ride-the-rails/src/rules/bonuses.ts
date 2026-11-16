import {
    CHICAGO_BONUS,
    FIVE_DOLLAR_BONUS,
    TRANSCONTINENTAL_BONUS,
    type BonusDefinition,
    type BonusId
} from '../data/bonuses.js'
import type { MapId } from '../data/maps.js'
import { cityIn, type CityId } from '../data/usaMap.js'
import type { Track, TranscontinentalClaim } from '../model/gameState.js'
import type { LegalPlacement } from './placement.js'
import { railroadsIn, trackWith } from './track.js'
import { transcontinentalLine, type TranscontinentalLine } from './transcontinental.js'

// R-3.2.5: paid to the placing player.
export type BonusPayment = {
    bonusId: BonusId
    amount: number
    cityId?: CityId
}

export type BonusEvaluation = (
    placement: LegalPlacement,
    trackBefore: Track,
    transcontinental: TranscontinentalClaim | undefined
) => BonusPayment | undefined

export type BonusRule = {
    readonly bonus: BonusDefinition
    readonly evaluate: BonusEvaluation
}

// R-4.3.3
export function transcontinentalAmount(line: TranscontinentalLine): number {
    return line.changesRailroadOnlyInCities
        ? TRANSCONTINENTAL_BONUS.cityHexAmount
        : TRANSCONTINENTAL_BONUS.otherHexAmount
}

// R-4.3.1: every placement in Chicago, a start included.
const CHICAGO_RULE: BonusRule = {
    bonus: CHICAGO_BONUS,
    evaluate: (placement) => {
        const city = cityIn(placement.hexId)
        if (city?.bonus !== CHICAGO_BONUS.id) {
            return undefined
        }
        return { bonusId: CHICAGO_BONUS.id, amount: CHICAGO_BONUS.amount, cityId: city.id }
    }
}

// R-4.3.2: the first locomotive in the city takes the bonus; a start uses it up unpaid.
const FIVE_DOLLAR_RULE: BonusRule = {
    bonus: FIVE_DOLLAR_BONUS,
    evaluate: (placement, trackBefore) => {
        const city = cityIn(placement.hexId)
        if (
            city?.bonus !== FIVE_DOLLAR_BONUS.id ||
            railroadsIn(trackBefore, placement.hexId).length > 0 ||
            placement.isStart
        ) {
            return undefined
        }
        return { bonusId: FIVE_DOLLAR_BONUS.id, amount: FIVE_DOLLAR_BONUS.amount, cityId: city.id }
    }
}

// R-4.3.3: once, to the placement that first completes any line.
const TRANSCONTINENTAL_RULE: BonusRule = {
    bonus: TRANSCONTINENTAL_BONUS,
    evaluate: (placement, trackBefore, transcontinental) => {
        if (transcontinental) {
            return undefined
        }
        const line = transcontinentalLine(trackWith(trackBefore, placement))
        if (!line || transcontinentalLine(trackBefore)) {
            return undefined
        }
        return { bonusId: TRANSCONTINENTAL_BONUS.id, amount: transcontinentalAmount(line) }
    }
}

// R-4.3, R-3.2.5: evaluated in this order; R-8: an expansion map adds its own row.
export const BONUS_RULES: Readonly<Record<MapId, readonly BonusRule[]>> = {
    'map.usa': [CHICAGO_RULE, FIVE_DOLLAR_RULE, TRANSCONTINENTAL_RULE]
}

// R-4.3, R-3.2.5: every bonus a placement pays, in table order.
export function placementBonuses(
    mapId: MapId,
    placement: LegalPlacement,
    trackBefore: Track,
    transcontinental: TranscontinentalClaim | undefined
): BonusPayment[] {
    return BONUS_RULES[mapId].flatMap((rule) => {
        const payment = rule.evaluate(placement, trackBefore, transcontinental)
        return payment ? [payment] : []
    })
}

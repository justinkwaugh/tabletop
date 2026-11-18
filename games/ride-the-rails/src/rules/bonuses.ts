import {
    BERLIN_BONUS,
    BRISBANE_BONUS,
    CHICAGO_BONUS,
    FIVE_DOLLAR_BONUS,
    GREATER_GERMANY_BONUS,
    INTERCOLONIAL_BONUS,
    PARIS_BONUS,
    PERTH_BONUS,
    TORONTO_BONUS,
    TRANSCONTINENTAL_BONUS,
    type BonusDefinition,
    type BonusId,
    type ConnectionBonus,
    type FixedBonus,
    type StartPricedBonus
} from '../data/bonuses.js'
import type { BoardMap, City, CityId } from '../data/boardMap.js'
import { boardMap } from '../data/boardMaps.js'
import type { MapId } from '../data/maps.js'
import type { ConnectionClaim, Track, TranscontinentalClaim } from '../model/gameState.js'
import { citiesConnected } from './connection.js'
import type { LegalPlacement } from './placement.js'
import { railroadsIn, trackWith } from './track.js'
import { transcontinentalLine, type TranscontinentalLine } from './transcontinental.js'

// R-3.2.5: paid to the placing player.
export type BonusPayment = {
    bonusId: BonusId
    amount: number
    cityId?: CityId
}

// What a bonus rule reads about a placement: the map, the track before it, and the claims of the
// bonuses paid once.
export type BonusContext = {
    map: BoardMap
    placement: LegalPlacement
    trackBefore: Track
    transcontinental: TranscontinentalClaim | undefined
    connectionClaim: ConnectionClaim | undefined
}

export type BonusEvaluation = (context: BonusContext) => BonusPayment | undefined

export type BonusRule = {
    readonly bonus: BonusDefinition
    readonly evaluate: BonusEvaluation
    // R-4.3.3, R-8: the state claim a payment of a once-only bonus records.
    readonly claims?: 'transcontinental' | 'connection'
}

// The city the placement is in, when it prints this bonus.
function bonusCity({ map, placement }: BonusContext, bonusId: BonusId): City | undefined {
    const city = map.cityIn(placement.hexId)
    return city?.bonus === bonusId ? city : undefined
}

// R-4.3.1, R-8: every placement in the city, a start included (Chicago; on their maps, Paris and
// Berlin; Perth and Brisbane, where no railroad starts).
export function everyPlacementRule(bonus: FixedBonus): BonusRule {
    return {
        bonus,
        evaluate: (context) => {
            const city = bonusCity(context, bonus.id)
            return city && { bonusId: bonus.id, amount: bonus.amount, cityId: city.id }
        }
    }
}

// R-4.3.2, R-8: the first locomotive in the city takes the bonus; a start uses it up unpaid.
export function firstPlacementRule(bonus: FixedBonus): BonusRule {
    return {
        bonus,
        evaluate: (context) => {
            const city = bonusCity(context, bonus.id)
            if (
                !city ||
                railroadsIn(context.trackBefore, context.placement.hexId).length > 0 ||
                context.placement.isStart
            ) {
                return undefined
            }
            return { bonusId: bonus.id, amount: bonus.amount, cityId: city.id }
        }
    }
}

// R-8 (Toronto): every placement in the city, priced by whether it is the railroad's start.
export function startPricedRule(bonus: StartPricedBonus): BonusRule {
    return {
        bonus,
        evaluate: (context) => {
            const city = bonusCity(context, bonus.id)
            const amount = context.placement.isStart ? bonus.startAmount : bonus.buildInAmount
            return city && { bonusId: bonus.id, amount, cityId: city.id }
        }
    }
}

// R-8 (Intercolonial, Greater Germany): once, to the placement after which the named cities are
// first one network of complete links.
export function connectionRule(bonus: ConnectionBonus): BonusRule {
    return {
        bonus,
        claims: 'connection',
        evaluate: ({ map, placement, trackBefore, connectionClaim }) => {
            if (
                connectionClaim ||
                citiesConnected(map, trackBefore, bonus.cityIds) ||
                !citiesConnected(map, trackWith(trackBefore, placement), bonus.cityIds)
            ) {
                return undefined
            }
            return { bonusId: bonus.id, amount: bonus.amount }
        }
    }
}

// R-4.3.3
export function transcontinentalAmount(line: TranscontinentalLine): number {
    return line.changesRailroadOnlyInCities
        ? TRANSCONTINENTAL_BONUS.cityHexAmount
        : TRANSCONTINENTAL_BONUS.otherHexAmount
}

// R-4.3.3: once, to the placement that first completes any line.
const TRANSCONTINENTAL_RULE: BonusRule = {
    bonus: TRANSCONTINENTAL_BONUS,
    claims: 'transcontinental',
    evaluate: ({ placement, trackBefore, transcontinental }) => {
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
    'map.usa': [
        everyPlacementRule(CHICAGO_BONUS),
        firstPlacementRule(FIVE_DOLLAR_BONUS),
        TRANSCONTINENTAL_RULE
    ],
    // R-8.2: no Transcontinental.
    'map.au': [everyPlacementRule(PERTH_BONUS), everyPlacementRule(BRISBANE_BONUS)],
    // R-8.3: no Transcontinental.
    'map.ca': [startPricedRule(TORONTO_BONUS), connectionRule(INTERCOLONIAL_BONUS)],
    // R-8.4: no Transcontinental.
    'map.fr': [everyPlacementRule(PARIS_BONUS)],
    // R-8.5: no Transcontinental.
    'map.de': [everyPlacementRule(BERLIN_BONUS), connectionRule(GREATER_GERMANY_BONUS)]
}

// R-4.3, R-3.2.5: every bonus a placement pays, in table order.
export function placementBonuses(
    mapId: MapId,
    placement: LegalPlacement,
    trackBefore: Track,
    transcontinental: TranscontinentalClaim | undefined,
    connectionClaim: ConnectionClaim | undefined
): BonusPayment[] {
    const context = {
        map: boardMap(mapId),
        placement,
        trackBefore,
        transcontinental,
        connectionClaim
    }
    return BONUS_RULES[mapId].flatMap((rule) => {
        const payment = rule.evaluate(context)
        return payment ? [payment] : []
    })
}

// R-4.3.3, R-8: the claim a paid bonus records, if it is paid once.
export function claimOf(mapId: MapId, payment: BonusPayment): BonusRule['claims'] {
    return BONUS_RULES[mapId].find((rule) => rule.bonus.id === payment.bonusId)?.claims
}

import type { GameAction } from '@tabletop/common'
import {
    BONUSES,
    RAILROAD_IDS,
    RAILROADS,
    isEndBuilding,
    isEndGame,
    isEndRound,
    isFinishBuilding,
    isPassJourney,
    isPlaceLocomotive,
    isRideJourney,
    isSkipShare,
    isTakeShare,
    usaCity,
    usaHex,
    type CityId,
    type FinishBuildingReason,
    type HexId,
    type JourneyPayment,
    type LinksPerRailroad,
    type PaidBonus,
    type PlayerMoney,
    type RailroadId
} from '@tabletop/ride-the-rails'

// One piece of a history line. A seat is drawn as its name ("you" for the reader) and a railroad
// as its colour chip, so the same description reads right for every seat and for a spectator.
export type DescriptionSegment = string | { playerId: string } | { railroadId: RailroadId }
export type Description = DescriptionSegment[]

export function railroadName(railroadId: RailroadId): string {
    return RAILROADS.find(({ id }) => id === railroadId)?.printedName ?? railroadId
}

export function cityName(cityId: CityId): string {
    return usaCity(cityId).name
}

function hexName(hexId: HexId): string {
    const hex = usaHex(hexId)
    if (hex.terrain === 'city') {
        return `in ${cityName(hex.cityId)}`
    }
    return hex.terrain === 'mountain' ? 'in a mountain hex' : 'in a plain hex'
}

function joined(segments: readonly Description[], separator = ', '): Description {
    return segments.flatMap((segment, index) => (index === 0 ? segment : [separator, ...segment]))
}

function andJoined(segments: readonly Description[]): Description {
    if (segments.length < 2) {
        return segments.flat()
    }
    return [...joined(segments.slice(0, -1)), ' and ', ...segments[segments.length - 1]]
}

function placedCount(placed: number): string {
    return placed === 0 ? 'nothing placed' : `${placed} placed`
}

// R-3.2.5, R-4.3: a city bonus is named by its city ("Denver $5"), the Transcontinental by itself.
export function bonusLabel(bonus: PaidBonus): string {
    if (bonus.cityId !== undefined) {
        return `${cityName(bonus.cityId)} $${bonus.amount}`
    }
    const definition = Object.values(BONUSES)
        .flat()
        .find(({ id }) => id === bonus.bonusId)
    return `${definition?.printedName ?? 'Bonus'} $${bonus.amount}`
}

// R-3.3.5: link counts in R-1.4 railroad order ("Red ×2, Blue ×1").
export function linkCounts(linksPerRailroad: LinksPerRailroad): Description {
    return joined(
        RAILROAD_IDS.flatMap((railroadId) => {
            const links = linksPerRailroad[railroadId]
            return links === undefined ? [] : [[{ railroadId }, ` ×${links}`]]
        })
    )
}

// R-3.3.4: each seat's dividends ("you +$3"); a seat that earned none is left out.
export function dividendLines(payments: readonly JourneyPayment[]): Description[] {
    return payments
        .filter(({ dividends }) => dividends > 0)
        .map(({ playerId, dividends }) => [{ playerId }, ` +$${dividends}`])
}

function moneyList(money: readonly PlayerMoney[]): Description {
    return joined(money.map(({ playerId, money }) => [{ playerId }, ` $${money}`]))
}

export const FINISH_BUILDING_REASONS: Record<FinishBuildingReason, string> = {
    limit: 'placement limit reached',
    'nothing-legal': 'no legal placement left'
}

// R-3.1
function shareDescription(action: GameAction): Description | undefined {
    if (isTakeShare(action)) {
        return [{ playerId: action.playerId }, ' took ', { railroadId: action.railroadId }]
    }
    if (isSkipShare(action)) {
        // R-1.1-H1: the seat's own turn, which takes nothing.
        const empty = action.metadata?.railroadIds ?? []
        return empty.length === 0
            ? [{ playerId: action.playerId }, ' took no share']
            : [
                  { playerId: action.playerId },
                  ' took no share: ',
                  ...andJoined(empty.map((railroadId) => [{ railroadId }])),
                  empty.length === 1 ? ' has none left' : ' have none left'
              ]
    }
    return undefined
}

// R-3.2
function buildingDescription(action: GameAction): Description | undefined {
    if (isPlaceLocomotive(action)) {
        const metadata = action.metadata
        return [
            { playerId: action.playerId },
            metadata?.isStart ? ' started ' : ' placed ',
            { railroadId: action.railroadId },
            ` ${hexName(action.hexId)}`,
            ...(metadata?.bonuses ?? []).map((bonus) => ` · ${bonusLabel(bonus)}`)
        ]
    }
    if (isEndBuilding(action)) {
        const placed = action.metadata ? ` · ${placedCount(action.metadata.placed)}` : ''
        return [{ playerId: action.playerId }, ` ended building${placed}`]
    }
    if (isFinishBuilding(action)) {
        // R-3.2.1, R-3.2.3, R-3.2.4: the turn ended by itself, so its reason is shown.
        const metadata = action.metadata
        const facts = metadata
            ? ` · ${placedCount(metadata.placed)} · ${FINISH_BUILDING_REASONS[metadata.reason]}`
            : ''
        return [{ playerId: action.playerId }, ` finished building${facts}`]
    }
    return undefined
}

// R-3.3
function ridingDescription(action: GameAction): Description | undefined {
    if (isRideJourney(action)) {
        const metadata = action.metadata
        if (!metadata) {
            return [{ playerId: action.playerId }, ' made a journey']
        }
        const fare = metadata.payments.find(({ playerId }) => playerId === action.playerId)
        return [
            { playerId: action.playerId },
            ` made a journey: ${metadata.cityIds.map(cityName).join(' → ')} · `,
            ...linkCounts(metadata.linksPerRailroad),
            ...(fare ? [` · fare $${fare.fare}`] : []),
            ...dividendLines(metadata.payments).flatMap((line) => [' · ', ...line])
        ]
    }
    if (isPassJourney(action)) {
        // R-3.3.1-H1: a pass is open only when no journey exists.
        return [{ playerId: action.playerId }, ' passed: no journey was possible']
    }
    return undefined
}

// R-2.5, R-6.2
function endDescription(action: GameAction): Description | undefined {
    if (isEndRound(action)) {
        const metadata = action.metadata
        if (!metadata) {
            return ['The round ended']
        }
        return [
            `Round ${metadata.round} ended · new order: `,
            ...moneyList(metadata.money),
            ...(metadata.railroadId
                ? [' · ', { railroadId: metadata.railroadId }, ' is now available']
                : [])
        ]
    }
    if (isEndGame(action)) {
        const metadata = action.metadata
        if (!metadata) {
            return ['The game ended']
        }
        // R-6.2-H1: every seat tied for the most money wins.
        const winners = metadata.winningPlayerIds
        const ranked = metadata.money.toSorted((a, b) => b.money - a.money)
        return [
            'Game over: ',
            ...moneyList(ranked),
            winners.length === 1 ? ' · winner: ' : ' · winners: ',
            ...andJoined(winners.map((playerId) => [{ playerId }]))
        ]
    }
    return undefined
}

export function describeAction(action: GameAction): Description {
    return (
        shareDescription(action) ??
        buildingDescription(action) ??
        ridingDescription(action) ??
        endDescription(action) ?? [action.type]
    )
}

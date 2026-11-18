import type { GameAction } from '@tabletop/common'
import {
    PLACEMENT_LIMITS,
    PhaseName,
    RAILROAD_IDS,
    isPassJourney,
    isRideJourney,
    isSkipShare,
    isTakeShare,
    legalPlacements,
    moneyOf,
    paymentTotal,
    phaseTurnOrder,
    placementLimit,
    richestPlayerIds,
    type HydratedRideTheRailsGameState,
    type JourneyPayment,
    type LinksPerRailroad,
    type PlayerMoney,
    type RailroadId
} from '@tabletop/ride-the-rails'
import { routeSummary, type Description } from '$lib/utils/describeAction.js'

// R-2.2: phase 1 runs in reverse turn order.
export function shareOrder(state: HydratedRideTheRailsGameState): string[] {
    return phaseTurnOrder(state.turnManager.turnOrder, PhaseName.TakeShare)
}

// R-2.2: the seats after the deciding one in phase 1.
export function stillToTakeShare(state: HydratedRideTheRailsGameState, playerId: string): string[] {
    const order = shareOrder(state)
    return order.slice(order.indexOf(playerId) + 1)
}

export type BuildProgress = {
    placed: number
    limit: number
    usedMountain: boolean
    /** R-3.2.4, R-8: how far the map's mountain lowers the limit. */
    mountainReduction: number
}

// R-3.2.3, R-3.2.4: placements so far against the limit, which a mountain lowers.
export function buildProgress(state: HydratedRideTheRailsGameState): BuildProgress | undefined {
    const building = state.building
    if (!building) {
        return undefined
    }
    return {
        placed: building.placed,
        limit: placementLimit(state.mapId, state.players.length, building.usedMountain),
        usedMountain: building.usedMountain,
        mountainReduction: PLACEMENT_LIMITS[state.mapId].mountainReduction
    }
}

export function placedText(progress: BuildProgress): string {
    return `${progress.placed} of ${progress.limit} placed`
}

// The phone's one-line build panel: "0/5", or "1/4" once a mountain lowers the limit.
export function placedCount(progress: BuildProgress): string {
    return `${progress.placed}/${progress.limit}`
}

// R-3.2.4: once a mountain has lowered the limit.
export function mountainNote(progress: BuildProgress): string | undefined {
    return progress.usedMountain && progress.mountainReduction > 0
        ? `Mountain used: limit ${progress.limit}`
        : undefined
}

// R-3.2.4, R-8: the mountain's cost as the panel marks it, "−1" on the USA.
export function mountainCost(progress: BuildProgress): string {
    return `−${progress.mountainReduction}`
}

// R-3.2.1: the turn may end before its first placement.
export function endBuildingLabel(progress: BuildProgress): string {
    return progress.placed === 0 ? 'Skip' : 'Done'
}

// R-3.2, R-4.1, R-4.2: the railroads the builder may place now, in railroad order.
export function buildableRailroads(
    state: HydratedRideTheRailsGameState,
    playerId: string
): RailroadId[] {
    const placeable = new Set(legalPlacements(state, playerId).map(({ railroadId }) => railroadId))
    return RAILROAD_IDS.filter((railroadId) => placeable.has(railroadId))
}

export function totalLinks(linksPerRailroad: LinksPerRailroad): number {
    return Object.values(linksPerRailroad).reduce((sum, links) => sum + (links ?? 0), 0)
}

function linksText(links: number): string {
    return links === 1 ? '1 link' : `${links} links`
}

// R-3.3.3
export function linksAndFareText(links: number, fare: number): string {
    return `${linksText(links)} · fare $${fare}`
}

export type SeatGain = { playerId: string; amount: number }

// R-3.3.4, R-3.3.5: one chip per seat a payment reaches, in turn order; the rider's holds the fare.
export function seatGains(
    payments: readonly JourneyPayment[],
    turnOrder: readonly string[]
): SeatGain[] {
    return turnOrder.flatMap((playerId): SeatGain[] => {
        const payment = payments.find((candidate) => candidate.playerId === playerId)
        const amount = payment ? paymentTotal(payment) : 0
        return amount > 0 ? [{ playerId, amount }] : []
    })
}

// R-2.5.1: money decides the next round's order, so every waiting view shows it.
export function seatMoney(state: HydratedRideTheRailsGameState): PlayerMoney[] {
    return moneyOf(state, state.turnManager.turnOrder)
}

// A phase's actions run together, so the latest action is this phase's only when it is of its kind.
function latestInPhase(
    actions: readonly GameAction[],
    belongs: (action: GameAction) => boolean
): GameAction | undefined {
    const latest = actions.at(-1)
    return latest && belongs(latest) ? latest : undefined
}

// R-3.1, R-1.1
export function latestShare(actions: readonly GameAction[]): GameAction | undefined {
    return latestInPhase(actions, (action) => isTakeShare(action) || isSkipShare(action))
}

// R-3.3
export function latestJourney(actions: readonly GameAction[]): GameAction | undefined {
    return latestInPhase(actions, (action) => isRideJourney(action) || isPassJourney(action))
}

// Contract, Watching: "Ben: Seattle → Chicago, 6 links, fare $7; you +$3".
export function journeyLine(
    action: GameAction,
    viewerId: string | undefined
): Description | undefined {
    if (!isRideJourney(action) || !action.metadata) {
        return undefined
    }
    const { cityIds, linksPerRailroad, payments } = action.metadata
    const rider = payments.find(({ playerId }) => playerId === action.playerId)
    const viewer = payments.find(({ playerId }) => playerId === viewerId)
    const viewerGain = viewer ? paymentTotal(viewer) : 0
    return [
        { playerId: action.playerId },
        `: ${routeSummary(cityIds)}, ${linksText(totalLinks(linksPerRailroad))}`,
        ...(rider ? [`, fare $${rider.fare}`] : []),
        ...(viewerGain > 0 ? [`; you +$${viewerGain}`] : [])
    ]
}

export type HeldShares = { railroadId: RailroadId; count: number }

export type FinalStanding = {
    playerId: string
    money: number
    winner: boolean
    shares: HeldShares[]
}

// R-6.2: most money first, ties in turn order; every seat tied for the most wins.
export function finalStandings(state: HydratedRideTheRailsGameState): FinalStanding[] {
    const winners = new Set(richestPlayerIds(state))
    return seatMoney(state)
        .toSorted((a, b) => b.money - a.money)
        .map(({ playerId, money }) => {
            const player = state.getPlayerState(playerId)
            return {
                playerId,
                money,
                winner: winners.has(playerId),
                shares: RAILROAD_IDS.flatMap((railroadId): HeldShares[] => {
                    const count = player.sharesOf(railroadId)
                    return count > 0 ? [{ railroadId, count }] : []
                })
            }
        })
}

// R-6.2: "Silas wins with $146", or "Silas and Ezra share the win with $146".
export function winnersHeadline(names: readonly string[], money: number): string {
    if (names.length === 1) {
        return `${names[0]} wins with $${money}`
    }
    return `${names.slice(0, -1).join(', ')} and ${names.at(-1)} share the win with $${money}`
}

// R-6.2: "both win" for two tied seats, "all three win" for three.
export function sharedWinNote(winnerCount: number): string {
    const all = ['', '', 'both', 'all three', 'all four', 'all five'][winnerCount] ?? 'all'
    return `tied for most money: ${all} win`
}

export const PHASE_LABELS: Readonly<Record<PhaseName, string>> = {
    [PhaseName.TakeShare]: 'Shares',
    [PhaseName.Build]: 'Build',
    [PhaseName.Ride]: 'Ride'
}

// R-2.2: the seat whose decision the table waits on.
export function decidingPlayerId(state: HydratedRideTheRailsGameState): string | undefined {
    return state.activePlayerIds[0] ?? state.turnManager.currentTurn()?.playerId
}

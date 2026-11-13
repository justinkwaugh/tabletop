import type { Point } from '@tabletop/common'
import {
    RAILROAD_IDS,
    TRANSCONTINENTAL_BONUS,
    hasTrack,
    transcontinentalLine,
    usaCity,
    type HexId,
    type PaidBonus,
    type RailroadId
} from '@tabletop/ride-the-rails'
import { hexCenter } from '$lib/utils/boardGeometry.js'
import { locomotivePieces, type LocomotivePiece } from '$lib/utils/boardPieces.js'
import type { State } from './motion.js'

/** A locomotive on one state's map and not the other's; `isStart` when it began its railroad. */
export type PlacementChange = LocomotivePiece & { isStart: boolean }

// R-3.2, R-4.1: the locomotives the transition adds and the ones it takes away (an Undo).
export function placementChanges(
    from: State,
    to: State
): { arriving: PlacementChange[]; leaving: PlacementChange[] } {
    const before = locomotivePieces(from.track)
    const after = locomotivePieces(to.track)
    const beforeKeys = new Set(before.map((piece) => piece.key))
    const afterKeys = new Set(after.map((piece) => piece.key))
    return {
        arriving: after
            .filter((piece) => !beforeKeys.has(piece.key))
            .map((piece) => ({ ...piece, isStart: !hasTrack(from.track, piece.railroadId) })),
        leaving: before
            .filter((piece) => !afterKeys.has(piece.key))
            .map((piece) => ({ ...piece, isStart: !hasTrack(to.track, piece.railroadId) }))
    }
}

export type ShareChange = { playerId: string; railroadId: RailroadId; shares: number }

// R-3.1: the shares the transition hands out, with the seat's count after it.
export function shareChanges(from: State, to: State): ShareChange[] {
    return to.players.flatMap((player) =>
        RAILROAD_IDS.flatMap((railroadId) => {
            const shares = player.sharesOf(railroadId)
            const before = from.getPlayerState(player.playerId).sharesOf(railroadId)
            return shares > before ? [{ playerId: player.playerId, railroadId, shares }] : []
        })
    )
}

export type CoinFlight = { key: string; amount: number; from: Point }

// R-3.2.5, R-4.3: the Chicago and $5 bonuses a placement paid rise from where they were earned.
// The Transcontinental pays through its own animator, after its line is shown.
export function bonusCoins(placementHexId: HexId, bonuses: readonly PaidBonus[]): CoinFlight[] {
    return bonuses
        .filter((bonus) => bonus.bonusId !== TRANSCONTINENTAL_BONUS.id)
        .map((bonus, index) => ({
            key: `coin:${index}:${bonus.bonusId}`,
            amount: bonus.amount,
            from: hexCenter(bonus.cityId ? usaCity(bonus.cityId).hexId : placementHexId)
        }))
}

/** The money a seat shows once each coin has landed, in order. */
export function moneyAfterEach(start: number, coins: readonly { amount: number }[]): number[] {
    let money = start
    return coins.map((coin) => (money += coin.amount))
}

// R-4.3.3: the line a transition claims, when it is the one that claims the Transcontinental.
export function claimedLine(from: State, to: State): HexId[] | undefined {
    if (from.transcontinental || !to.transcontinental) return undefined
    return transcontinentalLine(to.track)?.hexIds
}

/** Contract, Animation plan: the line's hexes outline one after another within 900 ms. */
export const OUTLINE_TOTAL = 0.9
const OUTLINE_STEP = 0.12

export function outlineStep(hexCount: number): number {
    return hexCount === 0 ? 0 : Math.min(OUTLINE_STEP, OUTLINE_TOTAL / hexCount)
}

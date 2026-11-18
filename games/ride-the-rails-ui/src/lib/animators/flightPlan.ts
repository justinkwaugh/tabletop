import type { Point } from '@tabletop/common'
import {
    BONUS_RULES,
    RAILROAD_IDS,
    transcontinentalLine,
    cityById,
    type CityId,
    type HexId,
    type MapId,
    type PaidBonus,
    type RailroadId
} from '@tabletop/ride-the-rails'
import { hexCenter } from '$lib/utils/boardGeometry.js'
import { connectionBonus } from '$lib/utils/linkBonus.js'
import { locomotivePieces, type LocomotivePiece } from '$lib/utils/boardPieces.js'
import type { TrackSlot } from '$lib/utils/trackLayout.js'
import type { State } from './motion.js'

// R-3.2, R-4.1: the locomotives the transition adds and the ones it takes away (an Undo).
export function placementChanges(
    from: State,
    to: State
): { arriving: LocomotivePiece[]; leaving: LocomotivePiece[] } {
    const before = locomotivePieces(from.track)
    const after = locomotivePieces(to.track)
    const beforeKeys = new Set(before.map((piece) => piece.key))
    const afterKeys = new Set(after.map((piece) => piece.key))
    return {
        arriving: after.filter((piece) => !beforeKeys.has(piece.key)),
        leaving: before.filter((piece) => !afterKeys.has(piece.key))
    }
}

export type Regrouping = { key: string; from: TrackSlot; to: TrackSlot }

// R-4.1.3: the locomotives that stay while their hex gains or loses one, each from the slot it held
// to the slot the hex's new count gives it (a lone cube stands aside, Chicago regroups).
export function regroupings(from: State, to: State): Regrouping[] {
    const before = new Map(locomotivePieces(from.track).map((piece) => [piece.key, piece.slot]))
    return locomotivePieces(to.track).flatMap((piece): Regrouping[] => {
        const was = before.get(piece.key)
        if (!was) return []
        const moved =
            was.x !== piece.slot.x || was.y !== piece.slot.y || was.width !== piece.slot.width
        return moved ? [{ key: piece.key, from: was, to: piece.slot }] : []
    })
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

// R-3.2.5, R-4.3, R-8: the bonuses a placement paid each time (Chicago, $5, a city's own) rise from
// where they were earned. One paid once and claimed (the Transcontinental, a connection bonus) pays
// through its own animator, after its hexes are shown.
export function bonusCoins(
    mapId: MapId,
    placementHexId: HexId,
    bonuses: readonly PaidBonus[]
): CoinFlight[] {
    const claimed = (bonusId: string) =>
        BONUS_RULES[mapId].some((rule) => rule.claims !== undefined && rule.bonus.id === bonusId)
    return bonuses
        .filter((bonus) => !claimed(bonus.bonusId))
        .map((bonus, index) => ({
            key: `coin:${index}:${bonus.bonusId}`,
            amount: bonus.amount,
            from: hexCenter(bonus.cityId ? cityById(bonus.cityId).hexId : placementHexId)
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

// R-8: the link cities a transition joins, when it is the one that claims the map's connection
// bonus.
export function claimedConnection(from: State, to: State): readonly CityId[] | undefined {
    if (from.connectionClaim || !to.connectionClaim) return undefined
    return connectionBonus(to.mapId)?.cityIds
}

/** Contract, Animation plan: the line's hexes outline one after another within 900 ms. */
export const OUTLINE_TOTAL = 0.9
const OUTLINE_STEP = 0.12

export function outlineStep(hexCount: number): number {
    return hexCount === 0 ? 0 : Math.min(OUTLINE_STEP, OUTLINE_TOTAL / hexCount)
}

import { MachineState, type HydratedSantiagoGameState } from '@tabletop/santiago'
import {
    canRevealTiles,
    isNeutralPlacementTurn,
    isOverseerDecisionPhase,
    isPlantTurn,
    isSpringPlacementTurn,
    projectedOverseerId,
    rejectPenalty,
    type Viewer
} from './turnRules.js'

export type BidRow = { playerId: string; bid: number | undefined }
export type BribeRow = { playerId: string; hasActed: boolean; amount: number | undefined }
export type CanalRole = 'proposer' | 'overseer' | 'observer'

export type ActionBarView =
    | { kind: 'none' }
    | { kind: 'placeSpring' }
    // A closed table shows the round's final bids; the bidder's controls keep their place, hidden, so
    // the table does not move.
    | { kind: 'bidding'; canBid: boolean; closed: boolean; rows: BidRow[]; overseerId: string | undefined }
    | { kind: 'revealTiles' }
    | { kind: 'plant' }
    | { kind: 'placeNeutral' }
    | {
          kind: 'canalBuilding'
          role: CanalRole
          bribeSpotChosen: boolean
          rows: BribeRow[]
          overseerId: string | undefined
          rejectPenalty: number
      }
    | { kind: 'extraIrrigation'; hasPersonalCanal: boolean }

export type ActionBarViewer = Viewer & { isViewingHistory: boolean; bribeSpotChosen: boolean }

const NONE: ActionBarView = { kind: 'none' }

export function actionBarView(state: HydratedSantiagoGameState, viewer: ActionBarViewer): ActionBarView {
    if (viewer.isViewingHistory) return NONE
    const { playerId, isMyTurn } = viewer
    if (isSpringPlacementTurn(state, playerId)) return { kind: 'placeSpring' }
    if (state.machineState === MachineState.Bidding) return biddingView(state, isMyTurn)
    if (canRevealTiles(state, viewer)) return { kind: 'revealTiles' }
    if (isPlantTurn(state, playerId)) return { kind: 'plant' }
    if (isNeutralPlacementTurn(state, playerId)) return { kind: 'placeNeutral' }
    if (state.machineState === MachineState.CanalBuilding) return canalBuildingView(state, viewer)
    if (state.machineState === MachineState.ExtraIrrigation && isMyTurn) {
        const hasPersonalCanal = state.players.find((p) => p.playerId === playerId)?.hasPersonalCanal ?? false
        return { kind: 'extraIrrigation', hasPersonalCanal }
    }
    return NONE
}

function biddingView(state: HydratedSantiagoGameState, canBid: boolean): ActionBarView {
    const rows = state.biddingOrder.flatMap((id) => {
        const player = state.players.find((p) => p.playerId === id)
        return player ? [{ playerId: id, bid: player.bid }] : []
    })
    if (!canBid && rows.length === 0) return NONE
    return { kind: 'bidding', canBid, closed: false, rows, overseerId: projectedOverseerId(state) }
}

function canalBuildingView(state: HydratedSantiagoGameState, viewer: ActionBarViewer): ActionBarView {
    const role: CanalRole = !viewer.isMyTurn ? 'observer' : isOverseerDecisionPhase(state) ? 'overseer' : 'proposer'
    const rows = state.canalProposalOrder.map((id, i) => ({
        playerId: id,
        hasActed: i < state.canalProposalIndex,
        amount: state.canalProposals.find((c) => c.playerId === id)?.amount
    }))
    if (role === 'observer' && rows.length === 0) return NONE
    return {
        kind: 'canalBuilding',
        role,
        bribeSpotChosen: role === 'proposer' && viewer.bribeSpotChosen,
        rows,
        overseerId: projectedOverseerId(state),
        rejectPenalty: rejectPenalty(state)
    }
}

export function sameActionBarView(a: ActionBarView, b: ActionBarView): boolean {
    if (a.kind === 'bidding' && b.kind === 'bidding') {
        return (
            a.canBid === b.canBid &&
            a.closed === b.closed &&
            a.overseerId === b.overseerId &&
            sameRows(a.rows, b.rows, (x, y) => x.playerId === y.playerId && x.bid === y.bid)
        )
    }
    if (a.kind === 'canalBuilding' && b.kind === 'canalBuilding') {
        return (
            a.role === b.role &&
            a.bribeSpotChosen === b.bribeSpotChosen &&
            a.overseerId === b.overseerId &&
            a.rejectPenalty === b.rejectPenalty &&
            sameRows(
                a.rows,
                b.rows,
                (x, y) => x.playerId === y.playerId && x.hasActed === y.hasActed && x.amount === y.amount
            )
        )
    }
    if (a.kind === 'extraIrrigation' && b.kind === 'extraIrrigation') {
        return a.hasPersonalCanal === b.hasPersonalCanal
    }
    return a.kind === b.kind
}

function sameRows<T>(a: T[], b: T[], same: (x: T, y: T) => boolean): boolean {
    return a.length === b.length && a.every((row, i) => same(row, b[i]))
}

// The bidding table as the round's last bid leaves it: the state that bid produces has already
// moved past bidding, so its own bar no longer shows the bids.
export function closingBidsView(
    shown: ActionBarView,
    bid: { playerId: string; amount: number },
    overseerId: string | undefined
): ActionBarView | undefined {
    if (shown.kind !== 'bidding') return undefined
    const rows = shown.rows.map((row) => (row.playerId === bid.playerId ? { playerId: row.playerId, bid: bid.amount } : row))
    return { ...shown, closed: true, rows, overseerId }
}

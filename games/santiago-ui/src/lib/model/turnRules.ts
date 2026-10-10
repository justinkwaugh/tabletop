import {
    HydratedRevealTiles,
    MachineState,
    validCanalPlacements,
    type CanalProposal,
    type CanalSegment,
    type HydratedSantiagoGameState
} from '@tabletop/santiago'
import { segmentKey } from '$lib/utils/canalGeometry.js'

export type Viewer = {
    playerId: string | undefined
    isMyTurn: boolean
}

export type SegmentProposal = {
    segment: CanalSegment
    total: number
    contributions: Array<{ playerId: string; amount: number }>
}

// Mid-bidding only a bid of 0 is certain to make its bidder the overseer: it can be tied but not
// undercut, and ties at 0 go to the earliest bidder in this round's bidding order (see
// BiddingStateHandler.resolveBids). Any nonzero leader could still be undercut by a later bidder.
export function projectedOverseerId(state: HydratedSantiagoGameState): string | undefined {
    if (state.machineState !== MachineState.Bidding) return state.canalOverseerId
    const zeroBidders = state.players
        .filter((p) => p.bid === 0)
        .sort((a, b) => state.biddingOrder.indexOf(a.playerId) - state.biddingOrder.indexOf(b.playerId))
    return zeroBidders[0]?.playerId
}

export function isSpringPlacementTurn(state: HydratedSantiagoGameState, playerId: string | undefined): boolean {
    return state.machineState === MachineState.SpringPlacement && playerId === state.seatOrder[0]
}

export function isPlantTurn(state: HydratedSantiagoGameState, playerId: string | undefined): boolean {
    return (
        state.machineState === MachineState.PlantingPhase &&
        state.plantersOrder[state.planterIndex] === playerId
    )
}

export function isNeutralPlacementStage(state: HydratedSantiagoGameState): boolean {
    return (
        state.machineState === MachineState.PlantingPhase &&
        state.planterIndex >= state.plantersOrder.length &&
        state.players.length === 3 &&
        state.revealedTiles.length > 0
    )
}

export function isNeutralPlacementTurn(state: HydratedSantiagoGameState, playerId: string | undefined): boolean {
    return isNeutralPlacementStage(state) && playerId === state.plantersOrder[0]
}

export function canRevealTiles(state: HydratedSantiagoGameState, viewer: Viewer): boolean {
    return viewer.isMyTurn && !!viewer.playerId && HydratedRevealTiles.canRevealTiles(state, viewer.playerId)
}

export function isOverseerDecisionPhase(state: HydratedSantiagoGameState): boolean {
    if (state.machineState !== MachineState.CanalBuilding) return false
    return state.canalProposalIndex >= state.canalProposalOrder.length
}

export function canalProposals(state: HydratedSantiagoGameState): CanalProposal[] {
    if (state.machineState !== MachineState.CanalBuilding) return []
    return state.canalProposals ?? []
}

export function segmentProposals(state: HydratedSantiagoGameState): SegmentProposal[] {
    return groupProposalsBySegment(canalProposals(state))
}

export function groupProposalsBySegment(proposals: CanalProposal[]): SegmentProposal[] {
    const byKey = new Map<string, SegmentProposal>()
    for (const p of proposals) {
        const key = segmentKey(p.segment)
        let entry = byKey.get(key)
        if (!entry) {
            entry = { segment: p.segment, total: 0, contributions: [] }
            byKey.set(key, entry)
        }
        entry.total += p.amount
        entry.contributions.push({ playerId: p.playerId, amount: p.amount })
    }
    return [...byKey.values()]
}

export function rejectPenalty(state: HydratedSantiagoGameState): number {
    const proposals = segmentProposals(state)
    if (proposals.length === 0) return 0
    return Math.max(...proposals.map((s) => s.total)) + 1
}

// Canal spots drawn on the board. Through the whole canal-building (bribe) phase everyone sees
// them, since bribe labels are pinned to the spots they bid on; extra irrigation stays private to
// the player holding the personal canal.
export function visibleCanalSegments(state: HydratedSantiagoGameState, viewer: Viewer): CanalSegment[] {
    if (state.machineState === MachineState.CanalBuilding) return validCanalPlacements(state.board)
    if (state.machineState !== MachineState.ExtraIrrigation || !viewer.isMyTurn) return []
    const hasPersonalCanal = state.players.find((p) => p.playerId === viewer.playerId)?.hasPersonalCanal
    return hasPersonalCanal ? validCanalPlacements(state.board) : []
}

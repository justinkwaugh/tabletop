import { AnimationContext, GameSession } from '@tabletop/frontend-components'
import {
    ActionType,
    MachineState,
    HydratedSantiagoGameState,
    PlaceSpring,
    PlaceBid,
    PlaceField,
    PlaceNeutralTile,
    BuildCanal,
    Pass,
    ProposeCanal,
    OverseerDecision,
    isProposeCanal,
    isOverseerDecision,
    isSameSegment,
    type CanalProposal,
    type SantiagoGameState,
    type CanalSegment,
    type CropType,
    isValidFieldPlacement,
    isIrrigated,
    connectedSpringIntersections,
    validCanalPlacements,
    validNeutralTilePlacements,
    validSpringPlacements
} from '@tabletop/santiago'
import { type GameAction } from '@tabletop/common'

export class SantiagoGameSession extends GameSession<
    SantiagoGameState,
    HydratedSantiagoGameState
> {
    chosenAction: string | undefined = $state(undefined)
    bidValue: number = $state(0)
    proposalAmount: number = $state(1)
    selectedTileIndex: number = $state(-1)

    override async onGameStateChange({
        to: _to,
        from: _from,
        action: _action,
        animationContext: _animationContext
    }: {
        to: HydratedSantiagoGameState
        from?: HydratedSantiagoGameState
        action?: GameAction
        animationContext: AnimationContext
    }) {
        this.chosenAction = undefined
        this.bidValue = 0
        this.proposalAmount = 1
        this.selectedTileIndex = -1
    }

    override willUndo(_action: GameAction) {
        this.proposalAmount = 1
        this.selectedTileIndex = -1
    }

    get mySantiagoPlayer() {
        const id = this.myPlayer?.id
        return id ? this.gameState.players.find((p) => p.playerId === id) : undefined
    }

    get maxBid(): number {
        return this.mySantiagoPlayer?.money ?? 0
    }

    get takenBids(): number[] {
        const myId = this.myPlayer?.id
        return this.gameState.players
            .filter((p) => p.bid !== undefined && p.bid > 0 && p.playerId !== myId)
            .map((p) => p.bid!)
    }

    get bidIsInvalid(): boolean {
        return this.bidValue > 0 && this.takenBids.includes(this.bidValue)
    }

    // Who currently holds (or, mid-bidding, is projected to hold) the canal overseer role —
    // shown as an "Overseer" tag. During bidding, canalOverseerId is cleared until all bids
    // resolve, so this projects from bids placed so far (lowest bid, ties broken by bidding
    // order — same rule BiddingStateHandler.resolveBids uses for the real result). Before
    // anyone has bid, the previous overseer nominally still holds the role until someone
    // bids lower — biddingOrder starts right after them, so they're always its last entry
    // (this also covers round 1, where "previous overseer" is the game's randomly-chosen
    // initial one, seeded into canalOverseerId before bidding ever begins).
    get projectedOverseerId(): string | undefined {
        const state = this.gameState
        if (state.machineState !== MachineState.Bidding) return state.canalOverseerId
        const biddedPlayers = state.players.filter((p) => p.bid !== undefined)
        if (!biddedPlayers.length) {
            return state.biddingOrder[state.biddingOrder.length - 1]
        }
        const minBid = Math.min(...biddedPlayers.map((p) => p.bid!))
        const candidates = biddedPlayers
            .filter((p) => p.bid === minBid)
            .sort((a, b) => state.biddingOrder.indexOf(a.playerId) - state.biddingOrder.indexOf(b.playerId))
        return candidates[0]?.playerId
    }

    // True when the local player is the first player and must place the spring
    // (one-time setup step, only reached when the game isn't randomizing the spring).
    get isSpringPlacementTurn(): boolean {
        return (
            this.gameState.machineState === MachineState.SpringPlacement &&
            this.myPlayer?.id === this.gameState.seatOrder[0]
        )
    }

    // Valid spring locations (all intersections except the four corners). Set of "col,row" keys.
    get validSpringSpots(): Set<string> {
        if (this.gameState.machineState !== MachineState.SpringPlacement) return new Set()
        return new Set(validSpringPlacements().map((p) => `${p.col},${p.row}`))
    }

    // True when the local player is the highest bidder who must place the neutral tile (3-player only).
    get isNeutralPlacementTurn(): boolean {
        const state = this.gameState
        if (state.machineState !== MachineState.PlantingPhase) return false
        if (state.planterIndex < state.plantersOrder.length) return false
        if (state.players.length !== 3 || state.revealedTiles.length === 0) return false
        return this.myPlayer?.id === state.plantersOrder[0]
    }

    // Valid squares for neutral tile placement. Set of "col,row" keys.
    get validNeutralPlacements(): Set<string> {
        if (!this.isNeutralPlacementTurn) return new Set()
        return new Set(
            validNeutralTilePlacements(this.gameState.board).map((p) => `${p.col},${p.row}`)
        )
    }

    // Valid placements for the current player's selected planting tile.
    // Map key is "col,row"; value is true if the square is irrigated.
    get validFieldPlacements(): Map<string, boolean> {
        const state = this.gameState
        const tile = this.selectedTileIndex >= 0 ? state.revealedTiles[this.selectedTileIndex] : undefined
        const myId = this.myPlayer?.id
        if (!tile || !myId) return new Map()
        if (state.machineState !== MachineState.PlantingPhase) return new Map()
        if (state.plantersOrder[state.planterIndex] !== myId) return new Map()

        const connected = connectedSpringIntersections(state.board)
        const result = new Map<string, boolean>()
        for (let col = 0; col < 8; col++) {
            for (let row = 0; row < 6; row++) {
                if (isValidFieldPlacement(state.board, col, row, myId, tile.crop)) {
                    result.set(`${col},${row}`, isIrrigated(state.board, col, row, connected))
                }
            }
        }
        return result
    }

    // Valid canal segments to show as clickable
    get validSegments(): CanalSegment[] {
        const state = this.gameState
        if (state.machineState === MachineState.ExtraIrrigation) {
            if (!this.isMyTurn) return []
            const me = this.mySantiagoPlayer
            if (!me?.hasPersonalCanal) return []
            return validCanalPlacements(state.board)
        }
        if (state.machineState !== MachineState.CanalBuilding) return []
        if (!this.isMyTurn) return []
        return validCanalPlacements(state.board)
    }

    get currentPlantingCrop(): CropType | undefined {
        return this.selectedTileIndex >= 0
            ? this.gameState.revealedTiles[this.selectedTileIndex]?.crop
            : undefined
    }

    setBidValue(v: number) {
        this.bidValue = Math.max(0, Math.min(this.maxBid, v))
    }

    setProposalAmount(v: number) {
        const max = this.mySantiagoPlayer?.money ?? 0
        this.proposalAmount = Math.max(1, Math.min(max, v))
    }

    get canalProposals(): CanalProposal[] {
        if (this.gameState.machineState !== MachineState.CanalBuilding) return []
        return this.gameState.canalProposals ?? []
    }

    get segmentProposals(): Array<{
        segment: CanalSegment
        total: number
        contributions: Array<{ playerId: string; amount: number }>
    }> {
        const byKey = new Map<string, {
            segment: CanalSegment
            total: number
            contributions: Array<{ playerId: string; amount: number }>
        }>()
        for (const p of this.canalProposals) {
            const key = `${p.segment.orientation},${p.segment.col},${p.segment.row}`
            if (!byKey.has(key)) byKey.set(key, { segment: p.segment, total: 0, contributions: [] })
            const entry = byKey.get(key)!
            entry.total += p.amount
            entry.contributions.push({ playerId: p.playerId, amount: p.amount })
        }
        return [...byKey.values()]
    }

    get rejectPenalty(): number {
        const sp = this.segmentProposals
        if (sp.length === 0) return 0
        return Math.max(...sp.map((s) => s.total)) + 1
    }

    get isOverseerDecisionPhase(): boolean {
        const state = this.gameState
        if (state.machineState !== MachineState.CanalBuilding) return false
        return state.canalProposalIndex >= state.canalProposalOrder.length
    }

    // Dispatches a board click on a canal segment to the right action for the current phase.
    // (Overseer decisions go through acceptProposal/rejectAndBuild directly from their labels.)
    async clickSegment(seg: CanalSegment) {
        const state = this.gameState
        if (state.machineState === MachineState.CanalBuilding) {
            if (this.isOverseerDecisionPhase) {
                const hasBribe = this.canalProposals.some((p) => isSameSegment(p.segment, seg))
                if (hasBribe) {
                    await this.acceptProposal(seg)
                } else {
                    await this.rejectAndBuild(seg)
                }
                return
            }
            await this.proposeCanal(seg)
            return
        }
        if (state.machineState === MachineState.ExtraIrrigation) {
            await this.usePersonalCanal(seg)
        }
    }

    nameForActionType(actionType: string): string {
        switch (actionType) {
            case ActionType.PlaceBid:
                return 'Place Bid'
            case ActionType.PlaceField:
                return 'Plant Field'
            case ActionType.BuildCanal:
                return 'Build Canal'
            case ActionType.Pass:
                return 'Pass'
            default:
                return actionType
        }
    }

    async placeSpring(col: number, row: number) {
        const action = this.createPlayerAction(PlaceSpring, { col, row })
        await this.applyAction(action)
    }

    selectTile(tileIndex: number) {
        this.selectedTileIndex = tileIndex
    }

    async placeBid() {
        const action = this.createPlaceBidAction(this.bidValue)
        await this.applyAction(action)
    }

    async placeField(col: number, row: number) {
        const action = this.createPlaceFieldAction(col, row)
        await this.applyAction(action)
        this.selectedTileIndex = -1
    }

    async placeNeutralField(col: number, row: number) {
        const action = this.createPlayerAction(PlaceNeutralTile, { col, row })
        await this.applyAction(action)
    }

    async passPersonalCanal() {
        const action = this.createPlayerAction(Pass, {})
        await this.applyAction(action)
    }

    async proposeCanal(segment: CanalSegment) {
        const action = this.createPlayerAction(ProposeCanal, {
            segment,
            amount: this.proposalAmount
        })
        await this.applyAction(action)
    }

    async passProposal() {
        const action = this.createPlayerAction(Pass, {})
        await this.applyAction(action)
    }

    async acceptProposal(segment: CanalSegment) {
        const action = this.createPlayerAction(OverseerDecision, {
            segment,
            accepting: true
        })
        await this.applyAction(action)
    }

    async rejectAndBuild(segment: CanalSegment) {
        const action = this.createPlayerAction(OverseerDecision, {
            segment,
            accepting: false
        })
        await this.applyAction(action)
    }

    async usePersonalCanal(segment: CanalSegment) {
        const action = this.createBuildCanalAction(segment)
        await this.applyAction(action)
    }

    createPlaceBidAction(amount: number): PlaceBid {
        return this.createPlayerAction(PlaceBid, { amount })
    }

    createPlaceFieldAction(col: number, row: number): PlaceField {
        return this.createPlayerAction(PlaceField, { tileIndex: this.selectedTileIndex, col, row })
    }

    createBuildCanalAction(segment: CanalSegment): BuildCanal {
        return this.createPlayerAction(BuildCanal, { segment })
    }
}

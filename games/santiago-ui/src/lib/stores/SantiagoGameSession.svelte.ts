import { AnimationContext, GameSession } from '@tabletop/frontend-components'
import {
    ActionType,
    MachineState,
    HydratedSantiagoGameState,
    PlaceBid,
    SelectTile,
    PlaceField,
    BuildCanal,
    Pass,
    ProposeCanal,
    OverseerDecision,
    isProposeCanal,
    isOverseerDecision,
    type CanalProposal,
    type SantiagoGameState,
    type CanalSegment,
    type CropType,
    isSameSegment,
    isValidFieldPlacement,
    isIrrigated,
    connectedSpringIntersections,
    validCanalPlacements
} from '@tabletop/santiago'
import { type GameAction } from '@tabletop/common'

export class SantiagoGameSession extends GameSession<
    SantiagoGameState,
    HydratedSantiagoGameState
> {
    chosenAction: string | undefined = $state(undefined)
    selectedSegment: CanalSegment | undefined = $state(undefined)
    bidValue: number = $state(0)
    proposalAmount: number = $state(1)

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
        this.selectedSegment = undefined
        this.bidValue = 0
        this.proposalAmount = 1
    }

    override willUndo(_action: GameAction) {
        this.selectedSegment = undefined
        this.proposalAmount = 1
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

    // Valid placements for the current player's planting tile.
    // Map key is "col,row"; value is true if the square is irrigated.
    get validFieldPlacements(): Map<string, boolean> {
        const state = this.gameState
        const tile = state.currentPlantingTile
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
        return this.gameState.currentPlantingTile?.crop
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

    selectSegment(seg: CanalSegment) {
        if (this.selectedSegment && isSameSegment(this.selectedSegment, seg)) {
            this.selectedSegment = undefined
        } else {
            this.selectedSegment = seg
        }
    }

    isSegmentSelected(seg: CanalSegment): boolean {
        return !!this.selectedSegment && isSameSegment(this.selectedSegment, seg)
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

    async selectTile(tileIndex: number) {
        const action = this.createPlayerAction(SelectTile, { tileIndex })
        await this.applyAction(action)
    }

    async placeBid() {
        const action = this.createPlaceBidAction(this.bidValue)
        await this.applyAction(action)
    }

    async placeField(col: number, row: number) {
        const action = this.createPlaceFieldAction(col, row)
        await this.applyAction(action)
    }

    async buildCanal() {
        if (!this.selectedSegment) return
        const action = this.createBuildCanalAction(this.selectedSegment)
        await this.applyAction(action)
    }

    async passPersonalCanal() {
        const action = this.createPlayerAction(Pass, {})
        await this.applyAction(action)
    }

    async proposeCanal() {
        if (!this.selectedSegment) return
        const action = this.createPlayerAction(ProposeCanal, {
            segment: this.selectedSegment,
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

    async rejectAndBuild() {
        if (!this.selectedSegment) return
        const action = this.createPlayerAction(OverseerDecision, {
            segment: this.selectedSegment,
            accepting: false
        })
        await this.applyAction(action)
    }

    async usePersonalCanal() {
        if (!this.selectedSegment) return
        const action = this.createBuildCanalAction(this.selectedSegment)
        await this.applyAction(action)
    }

    createPlaceBidAction(amount: number): PlaceBid {
        return this.createPlayerAction(PlaceBid, { amount })
    }

    createPlaceFieldAction(col: number, row: number): PlaceField {
        return this.createPlayerAction(PlaceField, { col, row })
    }

    createBuildCanalAction(segment: CanalSegment): BuildCanal {
        return this.createPlayerAction(BuildCanal, { segment })
    }
}

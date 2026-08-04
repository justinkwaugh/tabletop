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
    // Canal location picked (but not yet submitted) while proposing a bribe — lets the
    // player choose where before dialing in how much, and change their mind by clicking
    // a different location, rather than the click itself submitting the bribe.
    selectedBribeSegment: CanalSegment | undefined = $state(undefined)

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
        this.selectedBribeSegment = undefined
    }

    override willUndo(_action: GameAction) {
        this.proposalAmount = 1
        this.selectedTileIndex = -1
        this.selectedBribeSegment = undefined
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

    // Who currently holds the canal overseer role — shown as an "Overseer" tag. Once bids
    // resolve that's simply canalOverseerId.
    //
    // Mid-bidding it used to project the role onto whoever was lowest so far, which was
    // misleading: any nonzero bid can still be undercut by someone yet to bid, so the tag
    // moved from player to player as the round went on. The one bid that CAN'T be beaten is
    // 0 — it can only be tied, and ties at 0 go to the earliest bidder in this round's
    // bidding order (see BiddingStateHandler.resolveBids). So the first player to bid 0 is
    // already certain to be the overseer and gets the tag; until then nobody does.
    get projectedOverseerId(): string | undefined {
        const state = this.gameState
        if (state.machineState !== MachineState.Bidding) return state.canalOverseerId
        const zeroBidders = state.players
            .filter((p) => p.bid === 0)
            .sort((a, b) => state.biddingOrder.indexOf(a.playerId) - state.biddingOrder.indexOf(b.playerId))
        return zeroBidders[0]?.playerId
    }

    // True when the local player is the first player and must place the spring
    // (one-time setup step, only reached when the game isn't randomizing the spring).
    get isSpringPlacementTurn(): boolean {
        return (
            this.gameState.machineState === MachineState.SpringPlacement &&
            this.myPlayer?.id === this.gameState.seatOrder[0]
        )
    }

    // Valid spring locations (every intersection, corners included). Set of "col,row" keys.
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

    // Canal segments to DRAW as dashed lines. Through the whole canal-building (bribe)
    // phase these show for everyone, not just whoever is acting: bribe labels are pinned to
    // the segment they're bidding on, so an observer who couldn't see the dashed canals had
    // labels floating free of anything. Extra irrigation stays private to the player who
    // holds the personal canal - nobody else has a decision to read there.
    get visibleSegments(): CanalSegment[] {
        const state = this.gameState
        if (state.machineState === MachineState.CanalBuilding) {
            return validCanalPlacements(state.board)
        }
        if (state.machineState === MachineState.ExtraIrrigation) {
            if (!this.isMyTurn) return []
            if (!this.mySantiagoPlayer?.hasPersonalCanal) return []
            return validCanalPlacements(state.board)
        }
        return []
    }

    // Canal segments the local player can actually CLICK - the drawn set, but only while
    // it's their turn to act on one. Separate from visibleSegments so observers can follow
    // the bribing without the lines inviting a click that would be rejected.
    get validSegments(): CanalSegment[] {
        if (!this.isMyTurn) return []
        return this.visibleSegments
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
            this.selectedBribeSegment = seg
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

    async confirmProposal() {
        if (!this.selectedBribeSegment) return
        await this.proposeCanal(this.selectedBribeSegment)
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

import { tick } from 'svelte'
import { AnimationContext, GameSession } from '@tabletop/frontend-components'
import {
    ActionType,
    MachineState,
    HydratedSantiagoGameState,
    PlaceSpring,
    RevealTiles,
    PlaceBid,
    PlaceField,
    PlaceNeutralTile,
    BuildCanal,
    Pass,
    ProposeCanal,
    OverseerDecision,
    isSameSegment,
    type CanalProposal,
    type SantiagoProjectedState,
    type CanalSegment,
    type CropType,
    isValidFieldPlacement,
    isIrrigated,
    connectedSpringIntersections,
    validNeutralTilePlacements,
    validSpringPlacements
} from '@tabletop/santiago'
import { type GameAction } from '@tabletop/common'
import { TileDealAnimator } from '$lib/animators/tileDealAnimator.svelte.js'
import { ActionBarAnimator } from '$lib/animators/actionBarAnimator.svelte.js'
import { CanalBuildAnimator } from '$lib/animators/canalBuildAnimator.svelte.js'
import { BribePopAnimator } from '$lib/animators/bribePopAnimator.svelte.js'
import { FieldPopAnimator } from '$lib/animators/fieldPopAnimator.svelte.js'
import { BoardPreview } from '$lib/model/boardPreview.svelte.js'
import { DroughtDustAnimator } from '$lib/animators/droughtDustAnimator.svelte.js'
import { actionBarView, type ActionBarView } from '$lib/model/actionBarView.js'
import { landMood, type LandMood } from '$lib/model/landMood.js'
import {
    canalProposals,
    canRevealTiles,
    isNeutralPlacementTurn,
    isOverseerDecisionPhase,
    isSpringPlacementTurn,
    projectedOverseerId,
    rejectPenalty,
    segmentProposals,
    visibleCanalSegments,
    type SegmentProposal,
    type Viewer
} from '$lib/model/turnRules.js'
import { BirdDirector } from '$lib/birds/birdDirector.js'

export class SantiagoGameSession extends GameSession<
    SantiagoProjectedState,
    HydratedSantiagoGameState
> {
    override get canExplore(): boolean {
        return (
            this.game.config?.publicMoney !== false &&
            this.gameState.publicMoney !== false &&
            super.canExplore
        )
    }

    readonly tileDeal = new TileDealAnimator(this)
    readonly actionBar = new ActionBarAnimator(this)
    readonly canalBuild = new CanalBuildAnimator(this)
    readonly bribePop = new BribePopAnimator(this)
    readonly fieldPop = new FieldPopAnimator(this)
    readonly boardPreview = new BoardPreview()
    readonly droughtDust = new DroughtDustAnimator(this)
    readonly birds = new BirdDirector(this)

    chosenAction: string | undefined = $state(undefined)
    bidValue: number = $state(0)
    proposalAmount: number = $state(1)
    selectedTileIndex: number = $state(-1)
    // Canal location picked (but not yet submitted) while proposing a bribe — lets the
    // player choose where before dialing in how much, and change their mind by clicking
    // a different location, rather than the click itself submitting the bribe.
    selectedBribeSegment: CanalSegment | undefined = $state(undefined)

    // Ambient changes that follow a transition the animators ran, such as the land's mood or newly
    // offered canal spots, ease in; a silent restoration runs no animators, so they snap.
    easesAmbientChanges = $state(false)
    // Set from the developer harness's mood tuner to preview the light on any board.
    moodOverride: LandMood | undefined = $state(undefined)

    get landMood(): LandMood {
        return this.moodOverride ?? landMood(this.gameState)
    }

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
        this.easesAmbientChanges = true
        this.chosenAction = undefined
        this.bidValue = 0
        this.proposalAmount = 1
        this.selectedTileIndex = -1
    }

    // The chosen bribe spot lasts until the next state publishes, so the bar and the spot's twine
    // hold still while the proposal animates.
    override beforeNewState() {
        super.beforeNewState()
        this.selectedBribeSegment = undefined
        this.clearAnimationPreviews()
        void tick().then(() => {
            this.easesAmbientChanges = false
        })
    }

    // A failed transition never reaches beforeNewState, which would leave the previews, and the
    // inert bar, in place.
    override async notifyStateChangeListeners(
        newState: HydratedSantiagoGameState,
        oldState?: HydratedSantiagoGameState
    ) {
        try {
            await super.notifyStateChangeListeners(newState, oldState)
        } catch (error) {
            this.clearAnimationPreviews()
            throw error
        }
    }

    private clearAnimationPreviews() {
        this.boardPreview.clear()
        this.tileDeal.clearPreview()
        this.actionBar.clearPreview()
        this.canalBuild.clearPreview()
        this.bribePop.clearPreview()
        this.fieldPop.clearPreview()
        this.droughtDust.clearPreview()
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

    // Who holds, or is already certain to hold, the canal overseer role; shown as an "Overseer" tag.
    // See projectedOverseerId in turnRules for why mid-bidding only a bid of 0 settles it.
    get projectedOverseerId(): string | undefined {
        return projectedOverseerId(this.gameState)
    }

    // Last round's overseer, shown as a "Previous Overseer" tag while this round's bidding
    // is still undetermined (see projectedOverseerId above). They no longer hold the role,
    // but they're why this round's bidding order starts where it does — biddingOrder runs
    // clockwise from the player to their left (see BiddingStateHandler.enter).
    get previousOverseerHoldoverId(): string | undefined {
        const state = this.gameState
        if (state.machineState !== MachineState.Bidding) return undefined
        if (this.projectedOverseerId) return undefined
        return state.previousOverseerId
    }

    // True when the local player is the first player and must place the spring
    // (one-time setup step, only reached when the game isn't randomizing the spring).
    get isSpringPlacementTurn(): boolean {
        return isSpringPlacementTurn(this.gameState, this.myPlayer?.id)
    }

    // Valid spring locations (every intersection, corners included). Set of "col,row" keys.
    get validSpringSpots(): Set<string> {
        if (this.gameState.machineState !== MachineState.SpringPlacement) return new Set()
        return new Set(validSpringPlacements().map((p) => `${p.col},${p.row}`))
    }

    get canRevealTiles(): boolean {
        return !this.isViewingHistory && canRevealTiles(this.gameState, this.viewer)
    }

    // True when the local player is the highest bidder who must place the neutral tile (3-player only).
    get isNeutralPlacementTurn(): boolean {
        return isNeutralPlacementTurn(this.gameState, this.myPlayer?.id)
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

    // Canal spots to stake out on the board; see visibleCanalSegments for who sees them when.
    get visibleSegments(): CanalSegment[] {
        return visibleCanalSegments(this.gameState, this.viewer)
    }

    visibleSegmentsIn(state: HydratedSantiagoGameState): CanalSegment[] {
        return visibleCanalSegments(state, this.viewerIn(state))
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
        return canalProposals(this.gameState)
    }

    get segmentProposals(): SegmentProposal[] {
        return segmentProposals(this.gameState)
    }

    get rejectPenalty(): number {
        return rejectPenalty(this.gameState)
    }

    get isOverseerDecisionPhase(): boolean {
        return isOverseerDecisionPhase(this.gameState)
    }

    // What the action bar shows: a preview of the incoming state while an action animates in,
    // otherwise the visible state from the current perspective.
    get actionBarView(): ActionBarView {
        return (
            this.actionBar.preview ??
            actionBarView(this.gameState, {
                ...this.viewer,
                isViewingHistory: this.isViewingHistory,
                bribeSpotChosen: this.selectedBribeSegment !== undefined
            })
        )
    }

    // The bar `state` will show once published, from the perspective the session will present then.
    actionBarViewIn(state: HydratedSantiagoGameState): ActionBarView {
        return actionBarView(state, { ...this.viewerIn(state), isViewingHistory: this.isViewingHistory, bribeSpotChosen: false })
    }

    get viewer(): Viewer {
        return { playerId: this.myPlayer?.id, isMyTurn: this.isMyTurn }
    }

    // Who the session will present, and whether it will be their turn, once `state` is visible.
    viewerIn(state: HydratedSantiagoGameState): Viewer {
        const { player, isMyTurn } = this.perspectiveIn(state)
        return { playerId: player?.id, isMyTurn }
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
            case ActionType.RevealTiles:
                return 'Reveal Fields'
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

    // The draw reads the concealed bag, so the host must execute it; revealsInfo skips the
    // optimistic local attempt and marks the undo barrier.
    async revealTiles() {
        if (!this.canRevealTiles) return
        const action = this.createPlayerAction(RevealTiles, { revealsInfo: true })
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

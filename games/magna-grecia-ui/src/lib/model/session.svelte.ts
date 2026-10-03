import { GameSession, type AnimationContext } from '@tabletop/frontend-components'
import { sameCoordinates, type AxialCoordinates, type GameAction } from '@tabletop/common'
import {
    ActionType,
    BOARD_GRID,
    BuildMarket,
    CityPlacementKind,
    EndTurn,
    EndTurnOutcome,
    MachineState,
    PendingCityKind,
    PlaceCity,
    PlaceRoad,
    Resupply,
    RoadShape,
    SellMarket,
    legalRoadEnds,
    marketCost,
    marketValue,
    spaceKey,
    type Allowance,
    type CityPlacementPlan,
    type HydratedMagnaGreciaGameState,
    type MagnaGreciaProjectedState,
    type Place,
    type PlaceId,
    type RoadEnds,
    type SpaceKey
} from '@tabletop/magna-grecia'
import { legalRoadShapeChoices, roadPlacement, type RoadShapeChoice } from './roadLay.js'
import { BuildTool } from './buildTool.js'
import {
    askToConfirmEndTurn,
    carryTool,
    chooseRoadShape,
    chooseRoadSpace,
    chooseTool,
    clearRoadLay,
    closeResupply,
    draftConfirmingEndTurn,
    draftResupplyOpen,
    dropEndTurnConfirm,
    draftRoadShape,
    draftRoadSpace,
    draftTilesSkipped,
    draftTool,
    emptyDraft,
    hasManualDraft,
    rotateRoad,
    skipTiles,
    toggleResupply,
    undoDraft,
    type TurnDraft
} from './turnDraft.js'

const NO_ALLOWANCE: Allowance = { basic: 0, bonus: 0 }

export type RoadTarget = { coords: AxialCoordinates; options: RoadEnds[] }
export type MarketTarget = { place: Place; amount: number }
export type SellTarget = { coords: AxialCoordinates; amount: number }
export type CityTarget = {
    coords: AxialCoordinates
    joinsCityId?: string
    startsClaim: boolean
    startsFounding: boolean
}

export class MagnaGreciaGameSession extends GameSession<
    MagnaGreciaProjectedState,
    HydratedMagnaGreciaGameState
> {
    private draft: TurnDraft = $state(emptyDraft())
    flipPlayerOrder = $state(false)
    private stateChangeAnimated = false

    roadSpace: AxialCoordinates | undefined = $derived(draftRoadSpace(this.draft))

    resupplyOpen = $derived(draftResupplyOpen(this.draft))

    tilesSkipped = $derived(draftTilesSkipped(this.draft))

    myPlayerId = $derived(this.myPlayer?.id)

    canAct = $derived(
        this.isMyTurn &&
            !this.isViewingHistory &&
            this.gameState.machineState === MachineState.TakingTurn
    )

    private turnKey = $derived(`${this.gameState.round}:${this.gameState.turnIndex}`)

    private pendingCity = $derived(this.canAct ? this.gameState.turn?.pendingCity : undefined)

    pendingClaim = $derived(this.pendingCity?.kind === PendingCityKind.Claim)

    pendingFounding = $derived(this.pendingCity?.kind === PendingCityKind.Founding)

    cityUnfinished = $derived(this.pendingCity !== undefined)

    private joinedCityId(plan: CityPlacementPlan): string | undefined {
        switch (plan.kind) {
            case CityPlacementKind.Expand:
                return plan.cityIds[0]
            case CityPlacementKind.CompleteClaim:
                return plan.cityId
            case CityPlacementKind.Found:
                return undefined
        }
    }

    private canTarget(actionType: ActionType): string | undefined {
        const playerId = this.myPlayerId
        return this.canAct && playerId && this.validActionTypes.includes(actionType)
            ? playerId
            : undefined
    }

    availableTools: BuildTool[] = $derived.by(() => {
        if (!this.canAct) {
            return []
        }
        const roadPlayer = this.canTarget(ActionType.PlaceRoad)
        const cityPlayer = this.canTarget(ActionType.PlaceCity)
        const hasTargets: Record<BuildTool, boolean> = {
            [BuildTool.Road]: !!roadPlayer && this.gameState.hasRoadTarget(roadPlayer),
            [BuildTool.City]: !!cityPlayer && this.gameState.hasCityTarget(cityPlayer),
            [BuildTool.Market]: this.validActionTypes.includes(ActionType.BuildMarket),
            [BuildTool.Sell]: this.validActionTypes.includes(ActionType.SellMarket)
        }
        return Object.values(BuildTool).filter((tool) => hasTargets[tool])
    })

    activeTool: BuildTool | undefined = $derived.by(() => {
        if (this.cityUnfinished) {
            return BuildTool.City
        }
        if (this.resupplyOpen) {
            return undefined
        }
        const chosen = draftTool(this.draft)
        if (
            chosen &&
            chosen.turnKey === this.turnKey &&
            this.availableTools.includes(chosen.tool)
        ) {
            return chosen.tool
        }
        return undefined
    })

    roadTargets: Map<SpaceKey, RoadTarget> = $derived.by(() => {
        const playerId = this.canTarget(ActionType.PlaceRoad)
        if (this.activeTool !== BuildTool.Road || !playerId) {
            return new Map()
        }
        return new Map(
            [...BOARD_GRID]
                .map((space) => ({
                    coords: space.coords,
                    options: legalRoadEnds(this.gameState.board, playerId, space.coords)
                }))
                .filter((target) => target.options.length > 0)
                .map((target) => [spaceKey(target.coords), target])
        )
    })

    cityTargets: CityTarget[] = $derived.by(() => {
        const playerId = this.canTarget(ActionType.PlaceCity)
        if (this.activeTool !== BuildTool.City || !playerId) {
            return []
        }
        return [...BOARD_GRID].flatMap((space) => {
            const plan = this.gameState.cityPlacementPlan(playerId, space.coords)
            if (!plan) {
                return []
            }
            const startsClaim = plan.kind !== CityPlacementKind.CompleteClaim && !!plan.claimVillage
            const startsFounding = plan.kind === CityPlacementKind.Found && !!plan.awaitsVillage
            return [
                {
                    coords: space.coords,
                    joinsCityId: this.joinedCityId(plan),
                    startsClaim,
                    startsFounding
                }
            ]
        })
    })

    marketTargets: MarketTarget[] = $derived.by(() => {
        const playerId = this.myPlayerId
        if (this.activeTool !== BuildTool.Market || !playerId) {
            return []
        }
        return this.gameState.marketSites(playerId).map((place) => ({
            place,
            amount: marketCost(this.gameState.board, playerId, place)
        }))
    })

    sellTargets: SellTarget[] = $derived.by(() => {
        const playerId = this.myPlayerId
        if (this.activeTool !== BuildTool.Sell || !playerId) {
            return []
        }
        const board = this.gameState.board
        const network = board.network()
        return this.gameState.sellableMarkets(playerId).map((market) => ({
            coords: market.coords,
            amount: marketValue(board, network, market)
        }))
    })

    roadOptions: RoadEnds[] = $derived.by(() => {
        const space = this.roadSpace
        return space ? (this.roadTargets.get(spaceKey(space))?.options ?? []) : []
    })

    roadShapeChoices: RoadShapeChoice[] = $derived(legalRoadShapeChoices(this.roadOptions))

    roadShape: RoadShape | undefined = $derived.by(() => {
        const chosen = draftRoadShape(this.draft)
        if (chosen && this.roadShapeChoices.some((choice) => choice.shape === chosen)) {
            return chosen
        }
        return this.roadShapeChoices.length === 1 ? this.roadShapeChoices[0].shape : undefined
    })

    roadPlacements: RoadEnds[] = $derived(
        this.roadShapeChoices.find((choice) => choice.shape === this.roadShape)?.placements ?? []
    )

    roadPreview: RoadEnds | undefined = $derived(
        roadPlacement(this.roadPlacements, this.draft.rotation)
    )

    resupplyAllowance = $derived(
        this.canAct && this.myPlayerId ? this.gameState.resupplyAllowance(this.myPlayerId) : 0
    )

    roadAllowance: Allowance = $derived(
        this.canAct && this.myPlayerId
            ? this.gameState.roadAllowance(this.myPlayerId)
            : NO_ALLOWANCE
    )

    cityAllowance: Allowance = $derived(
        this.canAct && this.myPlayerId
            ? this.gameState.cityAllowance(this.myPlayerId)
            : NO_ALLOWANCE
    )

    resupplySplit: Allowance = $derived(
        this.canAct && this.myPlayerId
            ? this.gameState.resupplySplit(this.myPlayerId)
            : NO_ALLOWANCE
    )

    enhancedAction = $derived(
        this.canAct && this.myPlayerId ? this.gameState.enhancedAction(this.myPlayerId) : undefined
    )

    canEndTurn = $derived(this.canAct && this.validActionTypes.includes(ActionType.EndTurn))

    // Roads, cities and resupply are the turn's tile actions; a market action closes them.
    tileActionsOpen = $derived(
        this.availableTools.some((tool) => tool === BuildTool.Road || tool === BuildTool.City) ||
            this.resupplyAllowance > 0
    )

    marketActionsOpen = $derived(
        this.availableTools.some((tool) => tool === BuildTool.Market || tool === BuildTool.Sell)
    )

    onlyEndTurnLeft = $derived(this.canEndTurn && !this.tileActionsOpen && !this.marketActionsOpen)

    endTurnOutcome: EndTurnOutcome = $derived(this.gameState.endTurnOutcome())

    // Revealing a card or ending the game cannot be undone, so End turn asks first.
    endTurnIsFinal = $derived(
        this.endTurnOutcome === EndTurnOutcome.RevealsCard ||
            this.endTurnOutcome === EndTurnOutcome.EndsGame
    )

    confirmingEndTurn = $derived(
        this.canEndTurn && this.endTurnIsFinal && draftConfirmingEndTurn(this.draft)
    )

    upcomingCard = $derived(this.gameState.result ? undefined : this.gameState.upcomingCard())

    chooseTool(tool: BuildTool) {
        this.draft = chooseTool(this.draft, tool, this.turnKey)
    }

    chooseRoadSpace(coords: AxialCoordinates) {
        if (this.roadSpace && sameCoordinates(this.roadSpace, coords)) {
            if (this.roadPreview) {
                this.rotateRoad()
            }
            return
        }
        this.draft = chooseRoadSpace(this.draft, coords)
    }

    chooseRoadShape(shape: RoadShape) {
        if (!this.roadShapeChoices.some((choice) => choice.shape === shape)) {
            return
        }
        this.draft = chooseRoadShape(this.draft, shape)
    }

    rotateRoad() {
        this.draft = rotateRoad(this.draft, this.roadPlacements.length)
    }

    async confirmRoad() {
        const space = this.roadSpace
        const ends = this.roadPreview
        if (!space || !ends) {
            return
        }
        await this.placeRoad(space, ends)
    }

    cancelRoad() {
        this.draft = clearRoadLay(this.draft)
    }

    skipTiles() {
        this.draft = skipTiles(this.draft)
    }

    toggleResupply() {
        this.draft = toggleResupply(this.draft)
    }

    hasManualSelection(): boolean {
        return hasManualDraft(this.draft)
    }

    override async undo() {
        if (this.hasManualSelection()) {
            this.draft = undoDraft(this.draft)
            return
        }
        await super.undo()
    }

    resetAction() {
        this.draft = carryTool(this.draft, this.turnKey)
    }

    override beforeNewState(): void {
        this.flipPlayerOrder = this.stateChangeAnimated
        this.stateChangeAnimated = false
        this.resetAction()
    }

    override async onGameStateChange({
        action,
        animationContext
    }: {
        to: HydratedMagnaGreciaGameState
        from?: HydratedMagnaGreciaGameState
        action?: GameAction
        animationContext: AnimationContext
    }) {
        this.stateChangeAnimated = true
        if (!action || this.processingActions || this.isExploring) {
            return
        }
        animationContext.ensureDuration(0.5)
    }

    async placeRoad(coords: AxialCoordinates, ends: RoadEnds) {
        if (!this.validActionTypes.includes(ActionType.PlaceRoad)) {
            return
        }
        this.draft = clearRoadLay(this.draft)
        await this.applyAction(this.createPlayerAction(PlaceRoad, { coords, ends }))
    }

    async placeCity(coords: AxialCoordinates) {
        if (!this.validActionTypes.includes(ActionType.PlaceCity)) {
            return
        }
        await this.applyAction(this.createPlayerAction(PlaceCity, { coords }))
    }

    async resupply(roads: number, cities: number) {
        if (!this.validActionTypes.includes(ActionType.Resupply)) {
            return
        }
        this.draft = closeResupply(this.draft)
        await this.applyAction(this.createPlayerAction(Resupply, { roads, cities }))
    }

    async buildMarket(placeId: PlaceId) {
        if (!this.validActionTypes.includes(ActionType.BuildMarket)) {
            return
        }
        await this.applyAction(this.createPlayerAction(BuildMarket, { placeId }))
    }

    async sellMarket(coords: AxialCoordinates) {
        if (!this.validActionTypes.includes(ActionType.SellMarket)) {
            return
        }
        await this.applyAction(this.createPlayerAction(SellMarket, { coords }))
    }

    async requestEndTurn() {
        if (!this.canEndTurn) {
            return
        }
        if (this.endTurnIsFinal) {
            this.draft = askToConfirmEndTurn(this.draft)
            return
        }
        await this.endTurn()
    }

    cancelEndTurn() {
        this.draft = dropEndTurnConfirm(this.draft)
    }

    async endTurn() {
        if (!this.validActionTypes.includes(ActionType.EndTurn)) {
            return
        }
        await this.applyAction(this.createPlayerAction(EndTurn, {}))
    }
}

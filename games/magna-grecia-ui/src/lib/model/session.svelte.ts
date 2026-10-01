import { GameSession, type AnimationContext } from '@tabletop/frontend-components'
import {
    assertExists,
    sameCoordinates,
    type AxialCoordinates,
    type GameAction
} from '@tabletop/common'
import {
    ActionType,
    BOARD_GRID,
    BuildMarket,
    CityPlacementKind,
    EndTurn,
    EndTurnOutcome,
    MachineState,
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
    type HydratedMagnaGreciaGameState,
    type MagnaGreciaProjectedState,
    type Place,
    type PlaceId,
    type RoadEnds,
    type SpaceKey
} from '@tabletop/magna-grecia'
import { legalRoadShapeChoices, roadPlacement, type RoadShapeChoice } from './roadLay.js'
import {
    backDraft,
    chooseRoadShape,
    chooseRoadSpace,
    clearRoadLay,
    draftRoadShape,
    draftRoadSpace,
    emptyDraft,
    hasManualDraft,
    rotateRoad,
    toggleResupply,
    type TurnDraft
} from './turnDraft.js'

export enum BuildTool {
    Road = 'Road',
    City = 'City',
    Market = 'Market',
    Sell = 'Sell'
}

const NO_ALLOWANCE: Allowance = { basic: 0, bonus: 0 }

export type RoadTarget = { coords: AxialCoordinates; options: RoadEnds[] }
export type MarketTarget = { place: Place; amount: number }
export type CityTarget = { coords: AxialCoordinates; startsClaim: boolean; startsFounding: boolean }

export class MagnaGreciaGameSession extends GameSession<
    MagnaGreciaProjectedState,
    HydratedMagnaGreciaGameState
> {
    private chosenTool: { tool: BuildTool; turnKey: string } | undefined = $state()
    private draft: TurnDraft = $state(emptyDraft())
    flipPlayerOrder = $state(false)
    private stateChangeAnimated = false

    roadSpace: AxialCoordinates | undefined = $derived(draftRoadSpace(this.draft))

    resupplyOpen = $derived(this.draft.resupplyOpen)

    myPlayerId = $derived(this.myPlayer?.id)

    canAct = $derived(
        this.isMyTurn &&
            !this.isViewingHistory &&
            this.gameState.machineState === MachineState.TakingTurn
    )

    private turnKey = $derived(`${this.gameState.round}:${this.gameState.turnIndex}`)

    pendingClaim = $derived(this.canAct ? this.gameState.turn?.pendingClaim : undefined)

    pendingFounding = $derived(this.canAct ? this.gameState.turn?.pendingFounding : undefined)

    cityUnfinished = $derived(!!this.pendingClaim || !!this.pendingFounding)

    private legalRoadTargets: Map<SpaceKey, RoadTarget> = $derived.by(() => {
        const playerId = this.myPlayerId
        if (!this.canAct || !playerId || !this.validActionTypes.includes(ActionType.PlaceRoad)) {
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

    private legalCityTargets: CityTarget[] = $derived.by(() => {
        const playerId = this.myPlayerId
        if (!this.canAct || !playerId || !this.validActionTypes.includes(ActionType.PlaceCity)) {
            return []
        }
        return [...BOARD_GRID].flatMap((space) => {
            const plan = this.gameState.cityPlacementPlan(playerId, space.coords)
            if (!plan) {
                return []
            }
            const startsClaim = plan.kind !== CityPlacementKind.CompleteClaim && !!plan.claimVillage
            const startsFounding = plan.kind === CityPlacementKind.Found && !!plan.awaitsVillage
            return [{ coords: space.coords, startsClaim, startsFounding }]
        })
    })

    availableTools: BuildTool[] = $derived.by(() => {
        if (!this.canAct) {
            return []
        }
        const hasTargets: Record<BuildTool, boolean> = {
            [BuildTool.Road]: this.legalRoadTargets.size > 0,
            [BuildTool.City]: this.legalCityTargets.length > 0,
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
        const chosen = this.chosenTool
        if (
            chosen &&
            chosen.turnKey === this.turnKey &&
            this.availableTools.includes(chosen.tool)
        ) {
            return chosen.tool
        }
        return undefined
    })

    roadTargets: Map<SpaceKey, RoadTarget> = $derived(
        this.activeTool === BuildTool.Road ? this.legalRoadTargets : new Map()
    )

    cityTargets: CityTarget[] = $derived(
        this.activeTool === BuildTool.City ? this.legalCityTargets : []
    )

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

    sellTargets: MarketTarget[] = $derived.by(() => {
        const playerId = this.myPlayerId
        if (this.activeTool !== BuildTool.Sell || !playerId) {
            return []
        }
        const board = this.gameState.board
        const network = board.network()
        const byPlace = new Map<PlaceId, MarketTarget>()
        for (const market of this.gameState.sellableMarkets(playerId)) {
            const place = board.place(market.placeId)
            assertExists(place, `Market stands on unknown place ${market.placeId}`)
            byPlace.set(place.id, { place, amount: marketValue(board, network, market) })
        }
        return [...byPlace.values()]
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

    chooseTool(tool: BuildTool) {
        this.draft = emptyDraft()
        this.chosenTool = { tool, turnKey: this.turnKey }
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

    toggleResupply() {
        this.draft = toggleResupply(this.draft)
    }

    hasManualSelection(): boolean {
        return hasManualDraft(this.draft)
    }

    back() {
        this.draft = backDraft(this.draft)
    }

    resetAction() {
        this.draft = emptyDraft()
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
        this.draft = emptyDraft()
        await this.applyAction(this.createPlayerAction(Resupply, { roads, cities }))
    }

    async buildMarket(placeId: PlaceId) {
        if (!this.validActionTypes.includes(ActionType.BuildMarket)) {
            return
        }
        await this.applyAction(this.createPlayerAction(BuildMarket, { placeId }))
    }

    async sellMarket(placeId: PlaceId) {
        if (!this.validActionTypes.includes(ActionType.SellMarket)) {
            return
        }
        await this.applyAction(this.createPlayerAction(SellMarket, { placeId }))
    }

    async endTurn() {
        if (!this.validActionTypes.includes(ActionType.EndTurn)) {
            return
        }
        await this.applyAction(this.createPlayerAction(EndTurn, {}))
    }
}

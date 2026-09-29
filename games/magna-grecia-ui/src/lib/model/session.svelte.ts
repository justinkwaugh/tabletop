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
    MachineState,
    PlaceCity,
    PlaceRoad,
    Resupply,
    SellMarket,
    legalRoadEnds,
    marketCost,
    marketValue,
    spaceKey,
    type HydratedMagnaGreciaGameState,
    type MagnaGreciaGameState,
    type Place,
    type PlaceId,
    type RoadEnds,
    type SpaceKey
} from '@tabletop/magna-grecia'

export enum BuildTool {
    Road = 'Road',
    City = 'City',
    Market = 'Market',
    Sell = 'Sell'
}

export type RoadTarget = { coords: AxialCoordinates; options: RoadEnds[] }
export type MarketTarget = { place: Place; amount: number }
export type CityTarget = { coords: AxialCoordinates; startsClaim: boolean }

export class MagnaGreciaGameSession extends GameSession<
    MagnaGreciaGameState,
    HydratedMagnaGreciaGameState
> {
    private chosenTool: { tool: BuildTool; turnKey: string } | undefined = $state()
    roadSpace: AxialCoordinates | undefined = $state()
    resupplyOpen = $state(false)

    myPlayerId = $derived(this.myPlayer?.id)

    canAct = $derived(
        this.isMyTurn &&
            !this.isViewingHistory &&
            this.gameState.machineState === MachineState.TakingTurn
    )

    private turnKey = $derived(`${this.gameState.round}:${this.gameState.turnIndex}`)

    pendingClaim = $derived(this.canAct ? this.gameState.turn?.pendingClaim : undefined)

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
            return [{ coords: space.coords, startsClaim }]
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
        if (this.pendingClaim) {
            return BuildTool.City
        }
        const chosen = this.chosenTool
        if (
            chosen &&
            chosen.turnKey === this.turnKey &&
            this.availableTools.includes(chosen.tool)
        ) {
            return chosen.tool
        }
        return this.availableTools.find(
            (tool) => tool === BuildTool.Road || tool === BuildTool.City
        )
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

    resupplyAllowance = $derived(
        this.canAct && this.myPlayerId ? this.gameState.resupplyAllowance(this.myPlayerId) : 0
    )

    chooseTool(tool: BuildTool) {
        this.roadSpace = undefined
        this.resupplyOpen = false
        this.chosenTool = { tool, turnKey: this.turnKey }
    }

    async chooseRoadSpace(coords: AxialCoordinates) {
        const options = this.roadTargets.get(spaceKey(coords))?.options ?? []
        if (options.length === 1) {
            await this.placeRoad(coords, options[0])
            return
        }
        this.roadSpace =
            this.roadSpace && sameCoordinates(this.roadSpace, coords) ? undefined : coords
    }

    hasManualSelection(): boolean {
        return this.roadSpace !== undefined || this.resupplyOpen
    }

    back() {
        this.roadSpace = undefined
        this.resupplyOpen = false
    }

    resetAction() {
        this.roadSpace = undefined
        this.resupplyOpen = false
    }

    override beforeNewState(): void {
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
        if (!action || this.processingActions || this.isExploring) {
            return
        }
        animationContext.ensureDuration(0.5)
    }

    async placeRoad(coords: AxialCoordinates, ends: RoadEnds) {
        if (!this.validActionTypes.includes(ActionType.PlaceRoad)) {
            return
        }
        this.roadSpace = undefined
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
        this.resupplyOpen = false
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

import {
    GameSession,
    type AnimationContext,
    type PresentedTransition
} from '@tabletop/frontend-components'
import type { GameAction } from '@tabletop/common'
import {
    BuildCities,
    BuyResources,
    ChoosePlant,
    HydratedChoosePlant,
    HydratedScrapPlant,
    MachineState,
    PassAuction,
    PlaceTrustHouse,
    PassBid,
    PowerCities,
    RaiseBid,
    ScrapPlant,
    ActionType,
    bestPowerPlan,
    citiesSupplied,
    forcedReturn,
    fuelFor,
    fuelNeeds,
    hybridCoalIn,
    isPowerCities,
    isTrust,
    noResources,
    payment,
    plantsOf,
    powerPlant,
    type BuildQuote,
    type HydratedPowerGridGameState,
    type PowerGridProjectedState,
    type Resource,
    type ResourceAmounts
} from '@tabletop/power-grid'
import { basketOf, cartFits } from './cart.js'
import {
    hasManualPowerGridSelection,
    popPowerGridSelection,
    setPowerGridSelection,
    type PowerGridSelection,
    type PowerGridSelectionValues
} from './stagedSelection.js'
import type { BoardArea } from '$lib/utils/boardLayout.js'
import { HousesAnimator, type ArrivingHouse } from '$lib/animators/housesAnimator.js'
import { MarketAnimator, type MarketView } from '$lib/animators/marketAnimator.js'

export const TRUST_COLOR = '#5f7283'

export type PowerPreview = {
    plants: number[]
    fuel: ResourceAmounts
    hybridCoal: number
    powered: number
    earned: number
    valid: boolean
}

export class PowerGridGameSession extends GameSession<
    PowerGridProjectedState,
    HydratedPowerGridGameState
> {
    myPlayerId = $derived(this.myPlayer?.id)

    arrivingHouses: ArrivingHouse[] = $state([])

    housesAnimator = new HousesAnimator({
        showArrivals: (houses) => {
            this.arrivingHouses = houses
        },
        clearArrivals: () => {
            this.arrivingHouses = []
        }
    })

    animatedMarket: MarketView | undefined = $state()

    marketAnimator = new MarketAnimator({
        showMarket: (view) => {
            this.animatedMarket = view
        },
        clearMarket: () => {
            this.animatedMarket = undefined
        }
    })

    private selection: PowerGridSelection = $state({})

    readonly hasManualSelection = $derived(hasManualPowerGridSelection(this.selection))

    override async onGameStateChange({
        to,
        from,
        action,
        animationContext
    }: {
        to: HydratedPowerGridGameState
        from?: HydratedPowerGridGameState
        action?: GameAction
        animationContext: AnimationContext
    }) {
        await Promise.all([
            this.housesAnimator.onGameStateChange({ to, from, action, animationContext }),
            this.marketAnimator.onGameStateChange({ to, from, action, animationContext })
        ])
    }

    // Everyone powers at once, so other players' power choices leave this player's draft alone.
    override beforeNewState(transition: PresentedTransition) {
        const othersPowering =
            (transition.kind === 'other-action' || transition.kind === 'reconciliation') &&
            transition.actions.every((action) => isPowerCities(action))
        if (!othersPowering) {
            this.selection = {}
        }
    }

    override async undo() {
        if (this.hasManualSelection) {
            this.selection = popPowerGridSelection(this.selection)
            return
        }
        await super.undo()
    }

    private select<TStage extends keyof PowerGridSelectionValues>(
        stage: TStage,
        value: PowerGridSelectionValues[TStage] | undefined
    ) {
        this.selection = setPowerGridSelection(this.selection, stage, value)
    }

    machineState = $derived(this.gameState.machineState)

    canAct = $derived(
        !this.isViewingHistory &&
            this.myPlayerId !== undefined &&
            this.gameState.activePlayerIds.includes(this.myPlayerId)
    )

    choosingPlant = $derived(this.canAct && this.machineState === MachineState.ChoosingPlant)

    bidding = $derived(this.canAct && this.machineState === MachineState.Bidding)

    choosablePlants: number[] = $derived.by(() => {
        const playerId = this.myPlayerId
        if (!this.choosingPlant || !playerId) {
            return []
        }
        return this.gameState
            .auctionablePlants()
            .filter((plant) => this.gameState.canAfford(playerId, this.gameState.minimumBid(plant)))
    })

    chosenPlant: number | undefined = $derived.by(() => {
        const plant = this.selection.plant?.value
        return plant !== undefined && this.choosablePlants.includes(plant) ? plant : undefined
    })

    myMoney = $derived(this.myPlayerState?.money ?? 0)

    bidMinimum: number = $derived.by(() => {
        if (this.bidding) {
            return (this.gameState.bidding()?.highBid ?? 0) + 1
        }
        return this.chosenPlant === undefined ? 0 : this.gameState.minimumBid(this.chosenPlant)
    })

    bidMaximum: number = $derived.by(() => {
        const playerId = this.myPlayerId
        if (
            this.chosenPlant !== undefined &&
            playerId &&
            this.gameState.choosesUnopposed(playerId)
        ) {
            return this.bidMinimum
        }
        return this.myMoney
    })

    currentBid: number = $derived.by(() => {
        const bid = this.selection.bid?.value
        return bid !== undefined && bid >= this.bidMinimum && bid <= this.bidMaximum
            ? bid
            : this.bidMinimum
    })

    choosePlant(plant: number) {
        if (this.choosablePlants.includes(plant)) {
            this.select('plant', this.chosenPlant === plant ? undefined : plant)
        }
    }

    setBid(amount: number) {
        this.select('bid', Math.min(Math.max(amount, this.bidMinimum), this.bidMaximum))
    }

    async confirmPlantChoice() {
        const plant = this.chosenPlant
        const playerId = this.myPlayerId
        const bid = this.currentBid
        if (
            plant === undefined ||
            !playerId ||
            !HydratedChoosePlant.isValidChoice(this.gameState, playerId, plant, bid)
        ) {
            return
        }
        this.selection = {}
        await this.applyAction(this.createPlayerAction(ChoosePlant, { plant, bid }))
    }

    async passAuction() {
        if (!this.validActionTypes.includes(ActionType.PassAuction)) {
            return
        }
        this.selection = {}
        await this.applyAction(this.createPlayerAction(PassAuction, {}))
    }

    async raiseBid() {
        if (!this.validActionTypes.includes(ActionType.RaiseBid)) {
            return
        }
        const amount = this.currentBid
        this.selection = {}
        await this.applyAction(this.createPlayerAction(RaiseBid, { amount }))
    }

    async passBid() {
        if (!this.validActionTypes.includes(ActionType.PassBid)) {
            return
        }
        this.selection = {}
        await this.applyAction(this.createPlayerAction(PassBid, {}))
    }

    scrapping = $derived(this.canAct && this.machineState === MachineState.ScrappingPlant)

    scrappablePlants: number[] = $derived(
        this.scrapping && this.myPlayerId
            ? HydratedScrapPlant.scrappablePlants(this.gameState, this.myPlayerId)
            : []
    )

    scrapChoice: number | undefined = $derived.by(() => {
        const plant = this.selection.scrap?.value
        return plant !== undefined && this.scrappablePlants.includes(plant) ? plant : undefined
    })

    dropOilFirst: boolean = $derived(this.selection.dropOilFirst?.value ?? false)

    scrapReturned: ResourceAmounts | undefined = $derived.by(() => {
        const playerId = this.myPlayerId
        const plant = this.scrapChoice
        if (plant === undefined || !playerId) {
            return undefined
        }
        return forcedReturn(
            HydratedScrapPlant.remainingPlants(this.gameState, playerId, plant),
            this.gameState.getPlayerState(playerId).resources,
            this.dropOilFirst
        )
    })

    chooseScrap(plant: number) {
        if (this.scrappablePlants.includes(plant)) {
            this.select('scrap', this.scrapChoice === plant ? undefined : plant)
        }
    }

    toggleDropOil() {
        if (this.scrapChoice !== undefined) {
            this.select('dropOilFirst', !this.dropOilFirst)
        }
    }

    async confirmScrap() {
        const plant = this.scrapChoice
        const returned = this.scrapReturned
        if (plant === undefined || !returned) {
            return
        }
        this.selection = {}
        await this.applyAction(this.createPlayerAction(ScrapPlant, { plant, returned }))
    }

    buying = $derived(this.canAct && this.machineState === MachineState.BuyingResources)

    cart: Resource[] = $derived(this.buying ? (this.selection.cart?.value ?? []) : [])

    basket: ResourceAmounts = $derived(basketOf(this.cart))

    basketCost = $derived(this.gameState.resourceCost(this.basket))

    canAddToCart(resource: Resource): boolean {
        const playerId = this.myPlayerId
        return (
            this.buying &&
            playerId !== undefined &&
            cartFits(this.gameState, playerId, [...this.cart, resource])
        )
    }

    addToCart(resource: Resource) {
        if (this.canAddToCart(resource)) {
            this.select('cart', [...this.cart, resource])
        }
    }

    removeFromCart(resource: Resource) {
        const index = this.cart.lastIndexOf(resource)
        if (index >= 0) {
            const cart = this.cart.toSpliced(index, 1)
            this.select('cart', cart.length > 0 ? cart : undefined)
        }
    }

    async buyResources() {
        if (!this.buying) {
            return
        }
        const resources = this.basket
        this.selection = {}
        await this.applyAction(this.createPlayerAction(BuyResources, { resources }))
    }

    building = $derived(this.canAct && this.machineState === MachineState.Building)

    buildDraft: string[] = $derived(this.building ? (this.selection.cities?.value ?? []) : [])

    buildQuote: BuildQuote | undefined = $derived(
        this.building && this.myPlayerId
            ? this.gameState.buildQuote(this.myPlayerId, this.buildDraft)
            : undefined
    )

    buildCost = $derived(this.buildQuote?.total ?? 0)

    // What adding each further city would cost on top of the cities chosen so far.
    buildTargets: Map<string, number> = $derived.by(() => {
        const playerId = this.myPlayerId
        if (!this.building || !playerId) {
            return new Map()
        }
        const targets = new Map<string, number>()
        for (const cityId of this.gameState.area().cityIds) {
            if (this.buildDraft.includes(cityId)) {
                continue
            }
            const quote = this.gameState.buildQuote(playerId, [...this.buildDraft, cityId])
            if (quote && quote.total <= this.myMoney) {
                targets.set(cityId, quote.total - this.buildCost)
            }
        }
        return targets
    })

    toggleCity(cityId: string) {
        if (this.buildDraft.includes(cityId)) {
            const cities = this.buildDraft.filter((chosen) => chosen !== cityId)
            this.select('cities', cities.length > 0 ? cities : undefined)
        } else if (this.buildTargets.has(cityId)) {
            this.select('cities', [...this.buildDraft, cityId])
        }
    }

    async buildCities() {
        if (!this.building || (this.buildDraft.length > 0 && !this.buildQuote)) {
            return
        }
        const cityIds = this.buildDraft
        this.selection = {}
        await this.applyAction(this.createPlayerAction(BuildCities, { cityIds }))
    }

    powering = $derived(this.canAct && this.machineState === MachineState.Powering)

    bestPlan = $derived.by(() => {
        const player = this.myPlayerState
        if (!player || !this.myPlayerId) {
            return undefined
        }
        return bestPowerPlan(
            player.plants,
            player.resources,
            this.gameState.cityCount(this.myPlayerId)
        )
    })

    powerPreview: PowerPreview | undefined = $derived.by(() => {
        const player = this.myPlayerState
        const playerId = this.myPlayerId
        const best = this.bestPlan
        if (!player || !playerId || !best) {
            return undefined
        }
        const choice = this.powering ? this.selection.power?.value : undefined
        const plants = choice?.plants ?? best.plants
        const chosen = plantsOf(plants)
        const fuel = choice ? fuelFor(chosen, player.resources, choice.hybridCoal) : best.fuel
        const powered = Math.min(citiesSupplied(chosen), this.gameState.cityCount(playerId))
        return {
            plants,
            fuel: fuel ?? noResources(),
            hybridCoal: choice?.hybridCoal ?? (fuel ? hybridCoalIn(chosen, fuel) : 0),
            powered,
            earned: payment(powered),
            valid: fuel !== undefined
        }
    })

    hybridNeed = $derived(fuelNeeds(plantsOf(this.powerPreview?.plants ?? [])).hybrid)

    canRun(plant: number): boolean {
        const player = this.myPlayerState
        return !!player && fuelFor([powerPlant(plant)], player.resources) !== undefined
    }

    togglePowerPlant(plant: number) {
        const preview = this.powerPreview
        if (!this.powering || !preview) {
            return
        }
        const plants = preview.plants.includes(plant)
            ? preview.plants.filter((chosen) => chosen !== plant)
            : [...preview.plants, plant].toSorted((a, b) => a - b)
        this.select('power', { plants })
    }

    setHybridCoal(hybridCoal: number) {
        const preview = this.powerPreview
        if (this.powering && preview) {
            this.select('power', { plants: preview.plants, hybridCoal })
        }
    }

    async powerCities() {
        const preview = this.powerPreview
        if (!this.powering || !preview?.valid) {
            return
        }
        this.selection = {}
        await this.applyAction(
            this.createPlayerAction(PowerCities, {
                plants: preview.plants,
                fuel: preview.fuel,
                simultaneousGroupId: `power-${this.gameState.round}`
            })
        )
    }

    placingTrust = $derived(this.canAct && this.machineState === MachineState.PlacingTrust)

    trustTargets: Set<string> = $derived(
        new Set(this.placingTrust ? this.gameState.trustPlacementTargets() : [])
    )

    async placeTrustHouse(cityId: string) {
        if (!this.trustTargets.has(cityId)) {
            return
        }
        await this.applyAction(this.createPlayerAction(PlaceTrustHouse, { cityId }))
    }

    ownerColor(ownerId: string): string {
        return isTrust(ownerId) ? TRUST_COLOR : this.colors.getPlayerUiColor(ownerId)
    }

    decisionArea: BoardArea | undefined = $derived.by(() => {
        if (this.choosingPlant || this.bidding) return 'plants'
        if (this.buying) return 'resources'
        if (this.building || this.placingTrust) return 'map'
        return undefined
    })
}

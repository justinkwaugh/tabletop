import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedPhaseManager,
    HydratedRoundManager,
    HydratedTurnManager,
    PhaseManager,
    PrngState,
    RoundManager,
    PassableBidding,
    SimpleAuction,
    Visibility,
    assertExists,
    shuffle,
    type RandomState
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { MapId, type GameMap } from '../components/maps/gameMap.js'
import { gameMap } from '../components/maps/maps.js'
import { PlantBack, plantBack } from '../components/plants.js'
import {
    HOUSES_PER_PLAYER,
    HOUSE_COSTS,
    MAX_PLANTS,
    Step,
    houseSlots,
    playerCountRules
} from '../components/rules.js'
import {
    RESOURCES,
    RESOURCE_TOTALS,
    ResourceAmounts,
    addResources,
    basketCost,
    coversResources,
    marketCapacity,
    type Resource
} from '../components/resources.js'
import { bestPowerPlan, canStore } from './fuel.js'
import { PlayArea, connectionPlan, type ConnectionStep } from './network.js'
import {
    DeckCard,
    STEP_3_CARD,
    auctionablePlants,
    isStep3Card,
    lowestPlant,
    minimumBid,
    sortMarket
} from './plantMarket.js'
import { HydratedPowerGridPlayerState, PowerGridPlayerState } from './playerState.js'

export enum PhaseName {
    Auction = 'Auction',
    Resources = 'Resources',
    Building = 'Building',
    Bureaucracy = 'Bureaucracy'
}

export type PlantAuction = Type.Static<typeof PlantAuction>
export const PlantAuction = Type.Object({
    plant: Type.Integer(),
    bidding: SimpleAuction
})

/** The neutral blocker of a two-player game ("Against the Trust", Recharged pp. 9–10). */
export type Trust = Type.Static<typeof Trust>
export const Trust = Type.Object({
    plants: Type.Array(Type.Integer()),
    resources: ResourceAmounts,
    housesLeft: Type.Integer({ minimum: 0 }),
    startingCities: Type.Array(Type.String()),
    tookPlant: Type.Boolean()
})

/** The Trust's stable ID wherever it stands in for a player: as a house owner or a buyer. */
export const TRUST = 'trust'

export function isTrust(ownerId: string): boolean {
    return ownerId === TRUST
}
export const TRUST_HOUSES = 16

// Recharged p. 9: the starting player places one Trust house, the other two, then two and one.
const TRUST_PLACING_SEATS = [0, 1, 1, 0, 0, 1]

/** A player over the plant limit, who must scrap one plant other than the one just bought. */
export type Scrapping = Type.Static<typeof Scrapping>
export const Scrapping = Type.Object({
    playerId: Type.String(),
    boughtPlant: Type.Integer()
})

export type PowerGridGameState = Type.Static<typeof PowerGridGameState>
export const PowerGridGameState = Type.Object({
    ...Type.Omit(GameState, ['players', 'machineState']).properties,
    players: Type.Array(PowerGridPlayerState),
    machineState: Type.Enum(MachineState),
    roundManager: RoundManager,
    phaseManager: PhaseManager,
    mapId: Type.Enum(MapId),
    regions: Type.Array(Type.String()),
    seatOrder: Type.Array(Type.String()),
    step: Type.Enum(Step),
    plantDeck: Visibility.protect(Type.Array(DeckCard), {
        policy: Visibility.Policy.HostOnly
    }),
    deckCount: Type.Integer({ minimum: 0 }),
    deckTopBack: Type.Optional(Type.Enum(PlantBack)),
    underStack: Type.Array(Type.Integer()),
    market: Type.Array(DeckCard),
    outOfGame: Type.Array(Type.Integer()),
    discountPlant: Type.Optional(Type.Integer()),
    step3Drawn: Type.Boolean(),
    resourceMarket: ResourceAmounts,
    uraniumPhasedOut: Type.Boolean(),
    cities: Type.Record(Type.String(), Type.Array(Type.String())),
    auction: Type.Optional(PlantAuction),
    phaseDone: Type.Array(Type.String()),
    scrapping: Type.Optional(Scrapping),
    trust: Type.Optional(Trust)
})

export const PowerGridGameStateValidator = Compile(PowerGridGameState)
export const PowerGridProjectedState = Visibility.createProjectionSchema(PowerGridGameState)
export type PowerGridProjectedState = Type.Static<typeof PowerGridProjectedState>
export const PowerGridProjectedStateValidator = Compile(PowerGridProjectedState)

export type BuildQuote = {
    steps: (ConnectionStep & { houseCost: number })[]
    total: number
}

export type AuctionOutcome = {
    withdrawn: string[]
    winner?: { playerId: string; amount: number }
}

export type FinalStanding = { playerId: string; powered: number; money: number; cities: number }

export class HydratedPowerGridGameState
    extends HydratableGameState<typeof PowerGridProjectedState, HydratedPowerGridPlayerState>
    implements PowerGridProjectedState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare protectedPrng?: RandomState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedPowerGridPlayerState[]
    declare turnManager: HydratedTurnManager
    declare roundManager: HydratedRoundManager
    declare phaseManager: HydratedPhaseManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare mapId: MapId
    declare regions: string[]
    declare seatOrder: string[]
    declare step: Step
    declare plantDeck?: DeckCard[]
    declare deckCount: number
    declare deckTopBack?: PlantBack
    declare underStack: number[]
    declare market: DeckCard[]
    declare outOfGame: number[]
    declare discountPlant?: number
    declare step3Drawn: boolean
    declare resourceMarket: ResourceAmounts
    declare uraniumPhasedOut: boolean
    declare cities: Record<string, string[]>
    declare auction?: PlantAuction
    declare phaseDone: string[]
    declare scrapping?: Scrapping
    declare trust?: Trust

    private playArea?: PlayArea

    constructor(data: PowerGridProjectedState) {
        super(data, PowerGridProjectedStateValidator)
        this.players = data.players.map((player) => new HydratedPowerGridPlayerState(player))
        this.roundManager = new HydratedRoundManager(data.roundManager)
        this.phaseManager = new HydratedPhaseManager(data.phaseManager)
    }

    get map(): GameMap {
        return gameMap(this.mapId)
    }

    area(): PlayArea {
        this.playArea ??= new PlayArea(this.map, this.regions)
        return this.playArea
    }

    get playerOrder(): string[] {
        return this.turnManager.turnOrder
    }

    get round(): number {
        const round = this.roundManager.currentRound
        assertExists(round, 'A round is always under way')
        return round.number
    }

    citiesOf(playerId: string): string[] {
        return Object.entries(this.cities)
            .filter(([, owners]) => owners.includes(playerId))
            .map(([cityId]) => cityId)
    }

    cityCount(playerId: string): number {
        return this.citiesOf(playerId).length
    }

    mostCities(): number {
        return Math.max(0, ...this.players.map((player) => this.cityCount(player.playerId)))
    }

    occupants(cityId: string): string[] {
        return this.cities[cityId] ?? []
    }

    // Recharged p. 5: a player's first house goes in an empty city.
    canBuildIn(playerId: string, cityId: string, startsNetwork: boolean): boolean {
        const occupants = this.occupants(cityId)
        return (
            this.area().contains(cityId) &&
            !occupants.includes(playerId) &&
            occupants.length < (startsNetwork ? 1 : houseSlots(this.step))
        )
    }

    /** The cheapest way to add `cityIds` to the player's network, or undefined if not allowed. */
    buildQuote(playerId: string, cityIds: readonly string[]): BuildQuote | undefined {
        const network = this.citiesOf(playerId)
        const ordered = network.length > 0 ? cityIds : this.startingInEmptyCity(cityIds)
        if (
            new Set(ordered).size !== ordered.length ||
            !ordered.every((cityId, index) =>
                this.canBuildIn(playerId, cityId, network.length === 0 && index === 0)
            ) ||
            network.length + ordered.length > HOUSES_PER_PLAYER
        ) {
            return undefined
        }
        const steps = connectionPlan(this.area(), network, ordered).map((step) => ({
            ...step,
            houseCost: HOUSE_COSTS[this.occupants(step.cityId).length]
        }))
        if (steps.some((step) => !Number.isFinite(step.connectionCost))) {
            return undefined
        }
        return {
            steps,
            total: steps.reduce((sum, step) => sum + step.connectionCost + step.houseCost, 0)
        }
    }

    private startingInEmptyCity(cityIds: readonly string[]): readonly string[] {
        const start = cityIds.find((cityId) => this.occupants(cityId).length === 0)
        return start === undefined
            ? cityIds
            : [start, ...cityIds.filter((cityId) => cityId !== start)]
    }

    /** Most cities first; ties go to the larger biggest plant. */
    rankPlayers(): string[] {
        return this.players
            .toSorted(
                (a, b) =>
                    this.cityCount(b.playerId) - this.cityCount(a.playerId) ||
                    b.largestPlant() - a.largestPlant()
            )
            .map((player) => player.playerId)
    }

    reversedOrder(): string[] {
        return this.playerOrder.toReversed()
    }

    nextUndone(order: readonly string[]): string | undefined {
        return order.find((playerId) => !this.phaseDone.includes(playerId))
    }

    enterPhase(name: PhaseName): boolean {
        if (this.phaseManager.currentPhase?.name === name) {
            return false
        }
        this.startPhase(name)
        return true
    }

    private startPhase(name: PhaseName) {
        if (this.phaseManager.currentPhase) {
            this.phaseManager.endPhase(this.actionCount)
        }
        this.phaseManager.startPhase(name, this.actionCount)
        this.phaseDone = []
    }

    startTurn(playerId: string) {
        this.turnManager.startTurn(playerId, this.actionCount)
        this.activePlayerIds = [playerId]
    }

    endTurn(playerId: string) {
        if (this.turnManager.currentTurn()?.playerId === playerId) {
            this.turnManager.endTurn(this.actionCount)
        }
        this.phaseDone.push(playerId)
    }

    auctionablePlants(): number[] {
        return auctionablePlants(this.market, this.step)
    }

    minimumBid(plant: number): number {
        return minimumBid(plant, this.discountPlant)
    }

    isFirstRound(): boolean {
        return this.round === 1
    }

    /** Players who may still bid this phase, in seat order. */
    auctionEligible(): string[] {
        return this.seatOrder.filter((playerId) => !this.phaseDone.includes(playerId))
    }

    canAfford(playerId: string, amount: number): boolean {
        return this.getPlayerState(playerId).money >= amount
    }

    mustScrap(playerId: string): boolean {
        return this.getPlayerState(playerId).plants.length > MAX_PLANTS
    }

    bidding(): PassableBidding | undefined {
        return this.auction ? new PassableBidding(this.auction.bidding) : undefined
    }

    currentBidderId(): string | undefined {
        return this.bidding()?.currentBidderId
    }

    /** Whether the chooser has nobody left to bid against and so pays the minimum. */
    choosesUnopposed(playerId: string): boolean {
        return this.auctionEligible().every((other) => other === playerId)
    }

    openAuction(id: string, playerId: string, plant: number, bid: number): AuctionOutcome {
        this.auction = {
            plant,
            bidding: PassableBidding.open(id, this.auctionEligible(), playerId, bid)
        }
        return this.settleBidding()
    }

    raiseBid(playerId: string, amount: number): AuctionOutcome {
        const auction = this.auction
        assertExists(auction, 'Raising a bid requires an auction')
        auction.bidding = new PassableBidding(auction.bidding).bid(playerId, amount)
        return this.settleBidding()
    }

    passBid(playerId: string): AuctionOutcome {
        const auction = this.auction
        assertExists(auction, 'Passing requires an auction')
        auction.bidding = new PassableBidding(auction.bidding).pass(playerId)
        return this.settleBidding()
    }

    /** Players who cannot top the high bid drop out; the last one left buys the plant. */
    private settleBidding(): AuctionOutcome {
        const auction = this.auction
        assertExists(auction, 'Settling requires an auction')
        const before = new PassableBidding(auction.bidding).remainingPlayerIds
        const highBid = new PassableBidding(auction.bidding).highBid
        auction.bidding = new PassableBidding(auction.bidding).withdrawBelow(
            highBid + 1,
            (playerId) => this.getPlayerState(playerId).money
        )
        const bidding = new PassableBidding(auction.bidding)
        const withdrawn = before.filter(
            (playerId) => !bidding.remainingPlayerIds.includes(playerId)
        )
        const winner = bidding.winner
        if (winner) {
            this.awardPlant(winner.playerId, auction.plant, winner.amount)
        }
        return { withdrawn, winner }
    }

    private awardPlant(playerId: string, plant: number, price: number) {
        const player = this.getPlayerState(playerId)
        player.money -= price
        player.plants.push(plant)
        player.plants.sort((a, b) => a - b)
        this.takeFromMarket(plant)
        if (plant === this.map.rules.nuclearPhaseOutPlant) {
            this.uraniumPhasedOut = true
        }
        this.auction = undefined
        this.scrapping = this.mustScrap(playerId) ? { playerId, boughtPlant: plant } : undefined
        this.endTurn(playerId)
    }

    private drawCard(): DeckCard | undefined {
        const deck = this.plantDeck
        assertExists(deck, 'Drawing a power plant requires the plant stack')
        const card = deck.shift()
        this.deckCount = deck.length
        const next = deck[0]
        this.deckTopBack = next === undefined || isStep3Card(next) ? undefined : plantBack(next)
        if (card !== undefined && isStep3Card(card)) {
            this.shuffleUnderStack()
        }
        return card
    }

    private shuffleUnderStack() {
        const deck = this.plantDeck
        assertExists(deck, 'Shuffling the stack requires the plant stack')
        const stack = [...this.underStack]
        shuffle(stack, this.getProtectedPrng().random)
        deck.push(...stack)
        this.underStack = []
        this.deckCount = deck.length
        this.deckTopBack = stack.length ? plantBack(stack[0]) : undefined
    }

    /**
     * Fills one market space from the stack. While the discount token is out, the first plant
     * drawn below the discounted one is removed with the token and another is drawn.
     */
    refillMarket(): RefillResult {
        const result: RefillResult = { drawn: [], removed: [] }
        for (let card = this.drawCard(); card !== undefined; card = this.drawCard()) {
            result.drawn.push(card)
            if (isStep3Card(card)) {
                this.step3Drawn = true
                this.market = sortMarket([...this.market, STEP_3_CARD])
                return result
            }
            if (this.discountPlant !== undefined && card < this.discountPlant) {
                result.removed.push(card)
                this.retirePlant(card)
                result.discountLost = true
                this.discountPlant = undefined
                continue
            }
            this.market = sortMarket([...this.market, card])
            return result
        }
        return result
    }

    removeFromMarket(card: DeckCard) {
        const index = this.market.indexOf(card)
        if (index >= 0) {
            this.market.splice(index, 1)
        }
    }

    takeFromMarket(plant: number) {
        this.removeFromMarket(plant)
        if (plant === this.discountPlant) {
            this.discountPlant = undefined
        }
    }

    retirePlant(plant: number) {
        this.outOfGame.push(plant)
    }

    retireFromMarket(plant: number) {
        this.removeFromMarket(plant)
        this.retirePlant(plant)
    }

    removeLowestPlant(): number | undefined {
        const lowest = lowestPlant(this.market)
        if (lowest !== undefined) {
            this.retireFromMarket(lowest)
        }
        return lowest
    }

    placeUnderStack(plant: number) {
        this.removeFromMarket(plant)
        this.underStack.push(plant)
    }

    /** The Step 3 card leaves the market with the lowest plant, neither replaced. */
    removeStep3Card(): number | undefined {
        this.removeFromMarket(STEP_3_CARD)
        return this.removeLowestPlant()
    }

    beginStep3() {
        this.step = Step.Three
        this.step3Drawn = false
    }

    setDiscount() {
        this.discountPlant = this.auctionablePlants()[0]
    }

    held(resource: Resource): number {
        return (
            this.players.reduce((sum, player) => sum + player.resources[resource], 0) +
            (this.trust?.resources[resource] ?? 0)
        )
    }

    supply(resource: Resource): number {
        return RESOURCE_TOTALS[resource] - this.resourceMarket[resource] - this.held(resource)
    }

    resourceCost(basket: ResourceAmounts): number {
        return basketCost(this.resourceMarket, basket)
    }

    canBuyResources(playerId: string, basket: ResourceAmounts): boolean {
        const player = this.getPlayerState(playerId)
        return (
            coversResources(this.resourceMarket, basket) &&
            canStore(player.ownedPlants(), addResources(player.resources, basket)) &&
            this.resourceCost(basket) <= player.money
        )
    }

    resupplyAmounts(): ResourceAmounts {
        const table = this.map.rules.resupply[this.players.length]
        assertExists(
            table,
            `${this.map.name} has no refill card for ${this.players.length} players`
        )
        const wanted = table[this.step]
        const amounts = { ...wanted }
        for (const resource of RESOURCES) {
            const room = marketCapacity(resource) - this.resourceMarket[resource]
            amounts[resource] = Math.max(0, Math.min(wanted[resource], this.supply(resource), room))
        }
        if (this.uraniumPhasedOut) {
            amounts.uranium = 0
        }
        return amounts
    }

    /** Phase 3 order with the Trust, always second in player order, among the players. */
    buyingOrder(): string[] {
        const order = this.trust
            ? [this.playerOrder[0], TRUST, ...this.playerOrder.slice(1)]
            : this.playerOrder
        return order.toReversed()
    }

    trustPlacer(): string | undefined {
        const placed = this.trust?.startingCities.length
        const seat = placed === undefined ? undefined : TRUST_PLACING_SEATS[placed]
        return seat === undefined ? undefined : this.seatOrder[seat]
    }

    trustDue(): boolean {
        return !!this.trust && !this.trust.tookPlant && this.phaseDone.length > 0
    }

    /** Cities a Trust house may go on at setup: any empty city first, then one next to a Trust city. */
    trustPlacementTargets(): string[] {
        const trust = this.trust
        if (!trust) {
            return []
        }
        const area = this.area()
        return [...area.cityIds].filter(
            (cityId) =>
                this.occupants(cityId).length === 0 &&
                (trust.startingCities.length === 0 ||
                    trust.startingCities.some((placed) => area.isAdjacent(placed, cityId)))
        )
    }

    /** A player opening an empty city gives the Trust its 15 space while it has houses. */
    blockForTrust(cityIds: readonly string[]) {
        const trust = this.trust
        for (const cityId of cityIds) {
            if (trust && trust.housesLeft > 0 && this.occupants(cityId).length === 1) {
                this.cities[cityId] = [...this.occupants(cityId), TRUST]
                trust.housesLeft -= 1
            }
        }
    }

    poweredCapacity(playerId: string): number {
        const player = this.getPlayerState(playerId)
        return bestPowerPlan(player.plants, player.resources, this.cityCount(playerId)).supplied
    }

    canBurn(playerId: string, plants: readonly number[], fuel: ResourceAmounts): boolean {
        const player = this.getPlayerState(playerId)
        return (
            new Set(plants).size === plants.length &&
            plants.every((plant) => player.plants.includes(plant)) &&
            coversResources(player.resources, fuel)
        )
    }

    finalStandings(): FinalStanding[] {
        return this.players
            .map((player) => ({
                playerId: player.playerId,
                powered: this.poweredCapacity(player.playerId),
                money: player.money,
                cities: this.cityCount(player.playerId)
            }))
            .toSorted((a, b) => b.powered - a.powered || b.money - a.money)
    }

    gameEndTriggered(): boolean {
        return this.mostCities() >= playerCountRules(this.players.length).endCities
    }

    step2Triggered(): boolean {
        return (
            this.step === Step.One &&
            this.mostCities() >= playerCountRules(this.players.length).step2Cities
        )
    }
}

export type RefillResult = { drawn: DeckCard[]; removed: number[]; discountLost?: boolean }

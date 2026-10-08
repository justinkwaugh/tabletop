import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedRoundManager,
    HydratedTurnManager,
    PrngState,
    RoundManager,
    Visibility,
    assertExists,
    type RandomFunction,
    type RandomState
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { BonusChit, GOODS_PER_BONUS_CHIT } from '../components/bonusChits.js'
import { cityGood, goodsForeignTo } from '../components/cities.js'
import { GOODS, GoodCounts, addGoods, goodCounts, noGoods, type Good } from '../components/goods.js'
import { HydratedRouteMarkerReserve, RouteMarkerReserve } from '../components/routeMarkerReserve.js'
import {
    OFFER_GROUP_COUNT,
    OFFER_GROUP_SIZE,
    containsMarkers,
    countOfMarker,
    markerGood
} from '../components/routeMarkers.js'
import { duplicatesBid, hasLegalBid } from './bids.js'
import {
    CityState,
    hasOfficeRoom,
    knownDestination,
    slotDestination,
    type ProjectedCityState
} from './city.js'
import { canAffordPayment, canPayAnyItems, paymentSize, type Payment } from './payment.js'
import { HydratedKoggePlayerState, KoggePlayerState } from './playerState.js'
import {
    DEVELOPMENT_POINTS_TO_WIN,
    developmentPoints,
    officeCount,
    scoreBreakdown,
    type ScoreBreakdown
} from './scoring.js'
import {
    BASE_TRADE_RATIO,
    BONUS_TRADE_RATIO,
    hasTradeOpportunity,
    isValidTrade
} from './trading.js'
import {
    Bid,
    GuildMaster,
    OfferGroup,
    RaidProgress,
    StartChoice,
    TurnAction,
    TurnProgress,
    newTurn
} from './turn.js'

export const OFFICES_PER_PLAYER = 4
export const IDENTICAL_MARKERS_FOR_RAID = 3

export enum SailRouteKind {
    Route = 'Route',
    SecretPassage = 'SecretPassage'
}

export type SailRoute = Type.Static<typeof SailRoute>
export const SailRoute = Type.Union([
    Type.Object({
        kind: Type.Literal(SailRouteKind.Route),
        slot: Type.Integer({ minimum: 0, maximum: 1 })
    }),
    Type.Object({ kind: Type.Literal(SailRouteKind.SecretPassage) })
])

export interface SailOption {
    route: SailRoute
    cost: number
    destination?: number
    hidden: boolean
    blocked: boolean
}

export type KoggeGameState = Type.Static<typeof KoggeGameState>
export const KoggeGameState = Type.Object({
    ...Type.Omit(GameState, ['players', 'machineState']).properties,
    players: Type.Array(KoggePlayerState),
    machineState: Type.Enum(MachineState),
    cities: Type.Array(CityState),
    supply: GoodCounts,
    reserve: RouteMarkerReserve,
    offer: Type.Array(OfferGroup),
    bonusSupply: Type.Array(Type.Enum(BonusChit)),
    guildMaster: GuildMaster,
    startChoices: Type.Optional(Type.Array(StartChoice)),
    bids: Type.Array(Bid),
    rounds: RoundManager,
    turnIndex: Type.Integer({ minimum: 0 }),
    turn: Type.Optional(TurnProgress),
    raid: Type.Optional(RaidProgress)
})

export const KoggeGameStateValidator = Compile(KoggeGameState)
export const KoggeProjectedState = Visibility.createProjectionSchema(KoggeGameState)
export type KoggeProjectedState = Type.Static<typeof KoggeProjectedState>
export const KoggeProjectedStateValidator = Compile(KoggeProjectedState)

type ProjectedStartChoice = NonNullable<KoggeProjectedState['startChoices']>[number]

export class HydratedKoggeGameState
    extends HydratableGameState<typeof KoggeProjectedState, HydratedKoggePlayerState>
    implements KoggeProjectedState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare protectedPrng?: RandomState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedKoggePlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare cities: ProjectedCityState[]
    declare supply: GoodCounts
    declare reserve: HydratedRouteMarkerReserve
    declare offer: OfferGroup[]
    declare bonusSupply: BonusChit[]
    declare guildMaster: GuildMaster
    declare startChoices?: ProjectedStartChoice[]
    declare bids: Bid[]
    declare rounds: HydratedRoundManager
    declare turnIndex: number
    declare turn?: TurnProgress
    declare raid?: RaidProgress

    constructor(data: KoggeProjectedState) {
        super(data, KoggeProjectedStateValidator)
        this.players = data.players.map((player) => new HydratedKoggePlayerState(player))
        this.reserve = new HydratedRouteMarkerReserve(data.reserve)
        this.rounds = new HydratedRoundManager(data.rounds)
    }

    city(number: number): ProjectedCityState {
        const city = this.cities[number]
        assertExists(city, `No city numbered ${number}`)
        return city
    }

    cogCity(playerId: string): ProjectedCityState {
        return this.city(this.getPlayerState(playerId).location())
    }

    playersInCity(city: number): HydratedKoggePlayerState[] {
        return this.players.filter((player) => player.city === city)
    }

    isBanned(playerId: string, city: number): boolean {
        return this.city(city).raiders.includes(playerId)
    }

    // ---- Start cities

    startChoice(playerId: string): ProjectedStartChoice | undefined {
        return this.startChoices?.find((choice) => choice.playerId === playerId)
    }

    pendingStartChoosers(): string[] {
        return (this.startChoices ?? [])
            .filter((choice) => !choice.submitted)
            .map((choice) => choice.playerId)
    }

    startCityOptions(playerId: string): number[] {
        const choice = this.startChoice(playerId)
        if (!choice || choice.submitted) {
            return []
        }
        return this.cities
            .filter((city) => hasOfficeRoom(city) && !choice.excluded.includes(city.number))
            .map((city) => city.number)
    }

    // ---- Rounds

    refillOffer(random: RandomFunction): number[][] {
        this.reserve.returnMarkers(
            this.offer.flatMap((group) => (group.boughtBy ? [] : group.markers))
        )
        this.offer = []
        const groups = Math.min(
            OFFER_GROUP_COUNT,
            Math.floor(this.reserve.count() / OFFER_GROUP_SIZE)
        )
        for (let group = 0; group < groups; group++) {
            this.offer.push({ markers: this.reserve.drawRandom(OFFER_GROUP_SIZE, random) })
        }
        return this.offer.map((group) => group.markers)
    }

    // ---- Bidding

    nextBidderId(): string | undefined {
        return this.turnManager.turnOrder[this.bids.length]
    }

    madeBids(): number[][] {
        return this.bids.map((bid) => bid.markers)
    }

    isValidBid(playerId: string, markers: readonly number[]): boolean {
        const player = this.getPlayerState(playerId)
        return (
            this.nextBidderId() === playerId &&
            markers.length > 0 &&
            containsMarkers(player.hand(), markers) &&
            !duplicatesBid(markers, this.madeBids())
        )
    }

    mustPass(playerId: string): boolean {
        const player = this.getPlayerState(playerId)
        return player.markerCount === 0 || !hasLegalBid(player.hand(), this.madeBids())
    }

    // ---- Turns

    currentTurnPlayerId(): string | undefined {
        return this.turnManager.turnOrder[this.turnIndex]
    }

    beginTurn(): string {
        const playerId = this.currentTurnPlayerId()
        assertExists(playerId, `No player for turn ${this.turnIndex}`)
        const player = this.getPlayerState(playerId)
        this.turn = newTurn(playerId, player.location())
        this.collectOfficeGoods(player)
        return playerId
    }

    activeTurn(playerId: string): TurnProgress {
        const turn = this.turn
        assertExists(turn, 'No turn in progress')
        if (turn.playerId !== playerId) {
            throw Error(`It is not ${playerId}'s turn`)
        }
        return turn
    }

    isTurnOf(playerId: string): boolean {
        return this.turn?.playerId === playerId && this.raid === undefined
    }

    canTakeTurnAction(playerId: string, action: TurnAction): boolean {
        return this.isTurnOf(playerId) && !this.activeTurn(playerId).actionsTaken.includes(action)
    }

    recordTurnAction(playerId: string, action: TurnAction) {
        const turn = this.activeTurn(playerId)
        if (turn.actionsTaken.includes(action)) {
            throw Error(`${action} has already been taken this turn`)
        }
        turn.actionsTaken.push(action)
        turn.movementDone = true
    }

    isLastTurnOfRound(): boolean {
        return this.turnIndex >= this.turnManager.turnOrder.length - 1
    }

    // ---- Movement

    sailOptions(playerId: string): SailOption[] {
        if (!this.isTurnOf(playerId) || this.activeTurn(playerId).movementDone) {
            return []
        }
        const player = this.getPlayerState(playerId)
        const city = this.city(player.location())
        const options: SailOption[] = city.routes.map((slot, index) => {
            const destination = knownDestination(slot, playerId)
            return {
                route: { kind: SailRouteKind.Route, slot: index },
                cost: this.moveCost(playerId, false),
                destination,
                hidden: slot.hidden !== undefined,
                blocked:
                    destination !== undefined && this.isBlockedDestination(playerId, destination)
            }
        })
        if (
            player.hasBonus(BonusChit.SecretPassage) &&
            this.guildMaster.city !== player.location()
        ) {
            options.push({
                route: { kind: SailRouteKind.SecretPassage },
                cost: this.moveCost(playerId, true),
                destination: this.guildMaster.city,
                hidden: false,
                blocked: this.isBanned(playerId, this.guildMaster.city)
            })
        }
        return options.filter((option) => !option.blocked && canPayAnyItems(player, option.cost))
    }

    sailOption(playerId: string, route: SailRoute): SailOption | undefined {
        return this.sailOptions(playerId).find(
            (option) =>
                option.route.kind === route.kind &&
                (route.kind === SailRouteKind.SecretPassage ||
                    (option.route.kind === SailRouteKind.Route && option.route.slot === route.slot))
        )
    }

    // Rulebook 3A: the first move is free, every further move costs a good or a route
    // marker; "2 Felder gehen" makes the second free and the secret passage costs one more.
    moveCost(playerId: string, secretPassage: boolean): number {
        const moves = this.activeTurn(playerId).moves
        const player = this.getPlayerState(playerId)
        const freeMoves = player.hasBonus(BonusChit.MoveTwo) ? 2 : 1
        return (moves < freeMoves ? 0 : 1) + (secretPassage ? 1 : 0)
    }

    isBlockedDestination(playerId: string, destination: number): boolean {
        return (
            destination === this.getPlayerState(playerId).location() ||
            this.isBanned(playerId, destination)
        )
    }

    followRoute(city: number, slot: number): number {
        const route = this.city(city).routes[slot]
        assertExists(route, `No route ${slot} in city ${city}`)
        const destination = slotDestination(route)
        route.value = destination
        delete route.hidden
        return destination
    }

    collectOfficeGoods(player: HydratedKoggePlayerState): number {
        const city = this.city(player.location())
        const good = cityGood(city.number)
        let collected = 0
        for (const office of city.offices.filter((office) => office.playerId === player.playerId)) {
            collected += office.goods
            player.goods[good] += office.goods
            office.goods = 0
        }
        return collected
    }

    pay(player: HydratedKoggePlayerState, payment: Payment) {
        if (!canAffordPayment(player, payment)) {
            throw Error('The payment cannot be afforded')
        }
        for (const good of GOODS) {
            player.goods[good] -= payment.goods[good]
            this.supply[good] += payment.goods[good]
        }
        player.giveMarkers(payment.markers)
        this.reserve.returnMarkers(payment.markers)
    }

    isValidPayment(playerId: string, payment: Payment, cost: number): boolean {
        return (
            paymentSize(payment) === cost &&
            canAffordPayment(this.getPlayerState(playerId), payment)
        )
    }

    // ---- Offices

    officeCost(city: number): { goods: GoodCounts; markers: number[] } {
        const markers = Array<number>(this.city(city).offices.length === 0 ? 1 : 2).fill(city)
        return {
            goods: goodCounts(Object.fromEntries(goodsForeignTo(city).map((good) => [good, 1]))),
            markers
        }
    }

    canBuildOffice(playerId: string): boolean {
        if (!this.canTakeTurnAction(playerId, TurnAction.BuildOffice)) {
            return false
        }
        const player = this.getPlayerState(playerId)
        const city = this.city(player.location())
        const cost = this.officeCost(city.number)
        const hasOfficeLeft =
            officeCount(this.cities, playerId) < OFFICES_PER_PLAYER ||
            developmentPoints(this.cities, player) + 1 >= DEVELOPMENT_POINTS_TO_WIN
        return hasOfficeRoom(city) && hasOfficeLeft && canAffordPayment(player, cost)
    }

    // ---- Route markers for sale

    canBuyRouteMarkers(playerId: string): boolean {
        return (
            this.canTakeTurnAction(playerId, TurnAction.BuyRouteMarkers) &&
            this.getPlayerState(playerId).cargoCount() > 0 &&
            this.offer.some((group) => group.boughtBy === undefined)
        )
    }

    // ---- Trading in the city

    tradeRatio(playerId: string): number {
        return this.getPlayerState(playerId).hasBonus(BonusChit.ThreeForOne)
            ? BONUS_TRADE_RATIO
            : BASE_TRADE_RATIO
    }

    hasSailedAway(playerId: string): boolean {
        const turn = this.activeTurn(playerId)
        return turn.moves > 0 && this.getPlayerState(playerId).location() !== turn.startCity
    }

    canTradeGoods(playerId: string): boolean {
        if (
            !this.canTakeTurnAction(playerId, TurnAction.TradeGoods) ||
            !this.hasSailedAway(playerId)
        ) {
            return false
        }
        const player = this.getPlayerState(playerId)
        return hasTradeOpportunity(player.goods, this.city(player.location()).goods)
    }

    isValidTrade(playerId: string, give: GoodCounts, take: GoodCounts): boolean {
        const player = this.getPlayerState(playerId)
        return (
            this.canTradeGoods(playerId) &&
            isValidTrade({
                cargo: player.goods,
                market: this.city(player.location()).goods,
                give,
                take,
                ratio: this.tradeRatio(playerId)
            })
        )
    }

    // ---- Changing routes

    canChangeRoute(playerId: string): boolean {
        if (!this.canTakeTurnAction(playerId, TurnAction.ChangeRoute)) {
            return false
        }
        const player = this.getPlayerState(playerId)
        return (
            player.markerCount > 0 &&
            this.city(player.location()).routes.some((slot) => slot.value !== undefined)
        )
    }

    isValidRouteChange(playerId: string, slot: number, marker: number): boolean {
        const player = this.getPlayerState(playerId)
        const route = this.city(player.location()).routes[slot]
        return (
            this.canChangeRoute(playerId) &&
            route?.value !== undefined &&
            marker !== player.location() &&
            player.hand().includes(marker)
        )
    }

    // ---- Guild master

    isWithGuildMaster(playerId: string): boolean {
        return this.getPlayerState(playerId).city === this.guildMaster.city
    }

    canTradeWithGuildMaster(playerId: string): boolean {
        return (
            this.canTakeTurnAction(playerId, TurnAction.GuildMasterTrade) &&
            this.isWithGuildMaster(playerId)
        )
    }

    claimableRaidMarkerValues(playerId: string): number[] {
        const player = this.getPlayerState(playerId)
        if (!this.canTradeWithGuildMaster(playerId) || player.claimedSecondRaid) {
            return []
        }
        const hand = player.hand()
        return [...new Set(hand)].filter(
            (value) => countOfMarker(hand, value) >= IDENTICAL_MARKERS_FOR_RAID
        )
    }

    canClaimRaidMarker(playerId: string, value: number): boolean {
        return this.claimableRaidMarkerValues(playerId).includes(value)
    }

    bonusChitGoods(playerId: string): Good[] {
        if (!this.canTradeWithGuildMaster(playerId)) {
            return []
        }
        const goods = this.getPlayerState(playerId).goods
        return GOODS.filter((good) => goods[good] >= GOODS_PER_BONUS_CHIT)
    }

    canClaimBonusChit(playerId: string, good: Good, chit: BonusChit): boolean {
        return this.bonusChitGoods(playerId).includes(good) && this.bonusSupply.includes(chit)
    }

    canExchangeGoodForMarker(playerId: string, good: Good, value: number): boolean {
        return (
            this.canTradeWithGuildMaster(playerId) &&
            this.getPlayerState(playerId).goods[good] > 0 &&
            markerGood(value) === good &&
            this.reserve.contains(value)
        )
    }

    canExchangeMarkerForGood(playerId: string, value: number): boolean {
        return (
            this.canTradeWithGuildMaster(playerId) &&
            this.getPlayerState(playerId).hand().includes(value) &&
            this.supply[markerGood(value)] > 0
        )
    }

    // ---- Raids

    canRaid(playerId: string): boolean {
        return this.isTurnOf(playerId) && this.getPlayerState(playerId).raidMarkers > 0
    }

    raidableCogs(playerId: string): string[] {
        if (!this.canRaid(playerId)) {
            return []
        }
        const city = this.getPlayerState(playerId).location()
        return this.playersInCity(city)
            .filter((player) => player.playerId !== playerId)
            .map((player) => player.playerId)
    }

    beginRaid(raiderId: string): RaidProgress {
        const raider = this.getPlayerState(raiderId)
        raider.raidMarkers -= 1
        this.city(raider.location()).raiders.push(raiderId)
        this.raid = {
            raiderId,
            city: raider.location(),
            expellerId: this.turnManager.nextPlayer(raiderId)
        }
        return this.raid
    }

    lootCity(raiderId: string): GoodCounts {
        const raider = this.getPlayerState(raiderId)
        const city = this.city(raider.location())
        const good = cityGood(city.number)
        const loot = structuredClone(city.goods)
        for (const office of city.offices) {
            loot[good] += office.goods
            office.goods = 0
        }
        city.goods = noGoods()
        addGoods(raider.goods, loot)
        return loot
    }

    expulsionRoutes(raiderId: string): number[] {
        const city = this.cogCity(raiderId)
        return city.routes
            .map((slot, index) => ({ slot, index }))
            .filter(({ slot }) => slot.value === undefined || !this.isBanned(raiderId, slot.value))
            .map(({ index }) => index)
    }

    // ---- Scoring

    developmentPoints(playerId: string): number {
        return developmentPoints(this.cities, this.getPlayerState(playerId))
    }

    hasWon(playerId: string): boolean {
        return this.developmentPoints(playerId) >= DEVELOPMENT_POINTS_TO_WIN
    }

    scores(): Record<string, ScoreBreakdown> {
        return Object.fromEntries(
            this.players.map((player) => [player.playerId, scoreBreakdown(this.cities, player)])
        )
    }
}

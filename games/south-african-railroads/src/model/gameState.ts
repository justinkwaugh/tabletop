import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PassableBidding,
    PrngState,
    assertExists,
    type RandomState
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { sarMap, type SarMap } from '../maps/maps.js'
import {
    MapId,
    RailroadId,
    SettlementKind,
    type ExternalConnectionDefinition,
    type WarDefinition
} from '../maps/types.js'
import {
    ACTION_BOXES,
    ACTION_TRACK_ADVANCE,
    ACTION_TRACK_LIMIT,
    ActionBox,
    boxCapacity
} from './actionBoxes.js'
import { ShareAuction, goesFreeToOpener } from './auction.js'
import {
    developmentIncomeGains,
    developmentLevel,
    dividendPerShare,
    linkIncome,
    finalPayoffPerShare,
    SHARES_PER_RAILROAD,
    minimumBid,
    railroadIncome,
    recoveryDividendPerShare,
    settlementIncome,
    specialDividendPerShare,
    type IncomeGain
} from './economy.js'
import { HydratedSarPlayerState, SarPlayerState } from './playerState.js'
import { BuiltConnection, BuiltLink, RailroadState } from './railroadState.js'
import {
    DOUBLE_LINK_COST,
    LINK_COST,
    connectionBuilds,
    doubleBuilds,
    isSettlementConnected,
    railroadSettlements,
    singleBuilds,
    trackValue
} from './track.js'
import { Delegation, FreeBuildDue } from './turn.js'

export const SECOND_DEVELOPMENT_COST = 3
export const LEAVE_TOWN_PAYOUT = 3
const DEVELOPMENTS_PER_ACTION = 2

export type SarGameState = Type.Static<typeof SarGameState>
export const SarGameState = Type.Object({
    ...Type.Omit(GameState, ['players', 'machineState']).properties,
    players: Type.Array(SarPlayerState),
    machineState: Type.Enum(MachineState),
    mapId: Type.Enum(MapId),
    railroads: Type.Array(RailroadState),
    track: Type.Array(BuiltLink),
    connections: Type.Array(BuiltConnection),
    developments: Type.Record(Type.String(), Type.Number()),
    actionTrack: Type.Number(),
    dividendsPaid: Type.Number(),
    developmentsThisTurn: Type.Number(),
    // The two railroads that founded the map's special connection: the founder, then its partner.
    specialConnection: Type.Optional(Type.Array(Type.Enum(RailroadId))),
    auction: Type.Optional(ShareAuction),
    freeBuild: Type.Optional(FreeBuildDue),
    delegation: Type.Optional(Delegation)
})

export const SarGameStateValidator = Compile(SarGameState)

export type ShareHolding = { railroadId: RailroadId; shares: number }

export class HydratedSarGameState
    extends HydratableGameState<typeof SarGameState, HydratedSarPlayerState>
    implements SarGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare protectedPrng?: RandomState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedSarPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare mapId: MapId
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare railroads: RailroadState[]
    declare track: BuiltLink[]
    declare connections: BuiltConnection[]
    declare developments: Record<string, number>
    declare actionTrack: number
    declare dividendsPaid: number
    declare developmentsThisTurn: number
    declare specialConnection?: RailroadId[]
    declare auction?: ShareAuction
    declare freeBuild?: FreeBuildDue
    declare delegation?: Delegation

    constructor(data: SarGameState) {
        super(data, SarGameStateValidator)
        this.players = data.players.map((player) => new HydratedSarPlayerState(player))
    }

    get map(): SarMap {
        return sarMap(this.mapId)
    }

    railroad(railroadId: RailroadId): RailroadState {
        const railroad = this.railroads.find((candidate) => candidate.id === railroadId)
        assertExists(railroad, `Unknown railroad ${railroadId}`)
        return railroad
    }

    // A railroad opens when its first share is sold.
    isOpen(railroadId: RailroadId): boolean {
        return this.railroad(railroadId).owners.length > 0
    }

    openRailroads(): RailroadState[] {
        return this.railroads.filter((railroad) => this.isOpen(railroad.id))
    }

    nextInitialOffering(): RailroadId | undefined {
        return this.map.initialOffering.find((railroadId) => !this.isOpen(railroadId))
    }

    turnPlayerId(): string {
        const playerId = this.turnManager.currentTurn()?.playerId
        assertExists(playerId, 'No turn in progress')
        return playerId
    }

    settlementIncome(settlementId: string): number {
        return settlementIncome(this, settlementId)
    }

    developmentLevel(settlementId: string): number {
        return developmentLevel(this, settlementId)
    }

    buildIncomeGain(linkId: string): number {
        return linkIncome(this, linkId)
    }

    developmentIncomeGains(settlementId: string): IncomeGain[] {
        return developmentIncomeGains(this, settlementId)
    }

    income(railroadId: RailroadId): number {
        return railroadIncome(this, railroadId)
    }

    value(railroadId: RailroadId): number {
        return trackValue(this, railroadId)
    }

    minimumBid(railroadId: RailroadId): number {
        return minimumBid(this.value(railroadId))
    }

    sharesHeld(railroadId: RailroadId, playerId: string): number {
        return this.railroad(railroadId).owners.filter((owner) => owner === playerId).length
    }

    unsoldShares(railroadId: RailroadId): number {
        return SHARES_PER_RAILROAD - this.railroad(railroadId).owners.length
    }

    holdings(playerId: string): ShareHolding[] {
        return this.map.railroads
            .map((railroad) => ({
                railroadId: railroad.id,
                shares: this.sharesHeld(railroad.id, playerId)
            }))
            .filter((holding) => holding.shares > 0)
    }

    controllers(railroadId: RailroadId): string[] {
        const counts = this.players.map((player) => ({
            playerId: player.playerId,
            shares: this.sharesHeld(railroadId, player.playerId)
        }))
        const most = Math.max(...counts.map((count) => count.shares))
        return most === 0
            ? []
            : counts.filter((count) => count.shares === most).map((count) => count.playerId)
    }

    controls(railroadId: RailroadId, playerId: string): boolean {
        return this.controllers(railroadId).includes(playerId)
    }

    locomotivesIn(box: ActionBox, exceptPlayerId?: string): number {
        return this.players.filter(
            (player) => player.locomotive === box && player.playerId !== exceptPlayerId
        ).length
    }

    availableBoxes(playerId: string): ActionBox[] {
        const player = this.getPlayerState(playerId)
        return ACTION_BOXES.filter(
            (box) =>
                (box === ActionBox.ConstructTrack || box !== player.locomotive) &&
                this.locomotivesIn(box, playerId) < this.boxCapacity(box)
        )
    }

    // Choosing the box pays dividends at once: Pay Dividends, or a box whose advance takes the
    // action track past its limit.
    triggersDividends(box: ActionBox): boolean {
        return (
            box === ActionBox.PayDividends ||
            this.actionTrack + ACTION_TRACK_ADVANCE[box] > ACTION_TRACK_LIMIT
        )
    }

    boxCapacity(box: ActionBox): number {
        return boxCapacity(box, this.players.length, this.map)
    }

    // The map's war, while its round is being played.
    war(): WarDefinition | undefined {
        const war = this.map.definition.war
        return war?.round === this.round() ? war : undefined
    }

    inRecovery(): boolean {
        return this.map.definition.recoveryRound === this.round()
    }

    // Whether the railroad's track shares a settlement with another railroad's.
    meetsAnotherRailroad(railroadId: RailroadId): boolean {
        const network = railroadSettlements(this, railroadId)
        return this.map.railroads.some(
            (other) =>
                other.id !== railroadId &&
                [...railroadSettlements(this, other.id)].some((place) => network.has(place))
        )
    }

    // The metro railroad pays a multiple for building until its track meets another railroad's.
    costMultiplier(railroadId: RailroadId): number {
        const metro = this.map.definition.metroRailroad
        return metro?.railroadId === railroadId && !this.meetsAnotherRailroad(railroadId)
            ? metro.costMultiplier
            : 1
    }

    linkCost(railroadId: RailroadId): number {
        return (this.war()?.linkCost ?? LINK_COST) * this.costMultiplier(railroadId)
    }

    doubleLinkCost(railroadId: RailroadId): number {
        return DOUBLE_LINK_COST * this.costMultiplier(railroadId)
    }

    connectionPrice(railroadId: RailroadId, connection: ExternalConnectionDefinition): number {
        return connection.price * this.costMultiplier(railroadId)
    }

    singleBuilds(railroadId: RailroadId): string[] {
        if (this.war()?.haltedRailroad === railroadId) {
            return []
        }
        return this.railroad(railroadId).treasury >= this.linkCost(railroadId)
            ? singleBuilds(this, railroadId)
            : []
    }

    // Wartime allows single links only.
    doubleBuilds(railroadId: RailroadId) {
        return !this.war() && this.railroad(railroadId).treasury >= this.doubleLinkCost(railroadId)
            ? doubleBuilds(this, railroadId)
            : []
    }

    connectionBuilds(railroadId: RailroadId) {
        if (this.war()) {
            return []
        }
        const treasury = this.railroad(railroadId).treasury
        return connectionBuilds(this, railroadId).filter(
            (connection) => this.connectionPrice(railroadId, connection) <= treasury
        )
    }

    // The railroads other than the metro railroad whose track reaches its home, and whether the
    // metro railroad's track meets another's: the milestones that pay special dividends.
    metroMilestones(): { reachedHome: RailroadId[]; met: boolean } {
        const metro = this.map.definition.metroRailroad
        if (!metro) {
            return { reachedHome: [], met: false }
        }
        const home = this.map.home(metro.railroadId)
        return {
            reachedHome: this.map.railroads
                .filter(
                    (railroad) =>
                        railroad.id !== metro.railroadId &&
                        railroadSettlements(this, railroad.id).has(home)
                )
                .map((railroad) => railroad.id),
            met: this.meetsAnotherRailroad(metro.railroadId)
        }
    }

    // The railroads a build earns a special dividend for, given the milestones before it.
    metroSpecialDividendEarners(before: { reachedHome: RailroadId[]; met: boolean }): RailroadId[] {
        const metro = this.map.definition.metroRailroad
        if (!metro) {
            return []
        }
        const after = this.metroMilestones()
        const reached = after.reachedHome.filter(
            (railroadId) => !before.reachedHome.includes(railroadId)
        )
        const met = !before.met && after.met && after.reachedHome.length === 0
        return met ? [...reached, metro.railroadId] : reached
    }

    // The metro railroad, closed, once its home's income reaches the opening level.
    railroadOpenedByIncome(): RailroadId | undefined {
        const metro = this.map.definition.metroRailroad
        if (!metro || this.isOpen(metro.railroadId)) {
            return undefined
        }
        return this.settlementIncome(this.map.home(metro.railroadId)) >= metro.opensAtIncome
            ? metro.railroadId
            : undefined
    }

    // The railroads this one may found the map's special connection with, paying its cost.
    specialConnectionPartners(railroadId: RailroadId): RailroadId[] {
        const special = this.map.definition.specialConnection
        if (
            !special ||
            this.specialConnection ||
            !this.isOpen(railroadId) ||
            this.railroad(railroadId).treasury < special.cost
        ) {
            return []
        }
        const partners = special.northern.includes(railroadId)
            ? special.southern
            : special.southern.includes(railroadId)
              ? special.northern
              : []
        const network = railroadSettlements(this, railroadId)
        return partners.filter(
            (partnerId) =>
                this.isOpen(partnerId) &&
                [...railroadSettlements(this, partnerId)].some((place) => network.has(place))
        )
    }

    specialConnectionBonus(railroadId: RailroadId): number {
        const special = this.map.definition.specialConnection
        return special && this.specialConnection?.includes(railroadId) ? special.valueBonus : 0
    }

    canBuild(railroadId: RailroadId): boolean {
        return (
            this.isOpen(railroadId) &&
            (this.singleBuilds(railroadId).length > 0 ||
                this.connectionBuilds(railroadId).length > 0 ||
                this.specialConnectionPartners(railroadId).length > 0)
        )
    }

    buildableRailroads(): RailroadId[] {
        return this.map.railroads
            .map((railroad) => railroad.id)
            .filter((railroadId) => this.canBuild(railroadId))
    }

    // The railroads the acting player may build with directly; empty when they must hand the
    // build to the controller of another railroad.
    ownBuildableRailroads(playerId: string): RailroadId[] {
        return this.buildableRailroads().filter((railroadId) => this.controls(railroadId, playerId))
    }

    builderRailroads(playerId: string): RailroadId[] {
        if (this.delegation) {
            return this.delegation.builderId === playerId ? [this.delegation.railroadId] : []
        }
        return this.ownBuildableRailroads(playerId)
    }

    // A closed railroad outside the initial offering opens once track reaches its home.
    railroadOpenedBy(linkIds: readonly string[]): RailroadId | undefined {
        const reached = new Set(linkIds.flatMap((linkId) => this.map.link(linkId).ends))
        return this.map.railroads.find(
            (railroad) =>
                !this.map.opensInInitialOffering(railroad.id) &&
                !this.isOpen(railroad.id) &&
                reached.has(railroad.homeId)
        )?.id
    }

    // On maps with a free metro area, the one Automatic Metro Development would raise next.
    freeDevelopmentTarget(): string | undefined {
        return this.map.definition.freeMetroDevelopment
            ? this.automaticDevelopmentTarget()
            : undefined
    }

    developableSettlements(): string[] {
        const free = this.freeDevelopmentTarget()
        return this.map.settlements
            .filter(
                (candidate) =>
                    this.developmentLevel(candidate.id) < this.map.maxDevelopments(candidate.id) &&
                    (candidate.id === free || isSettlementConnected(this, candidate.id))
            )
            .map((candidate) => candidate.id)
    }

    // Wartime allows more developments; all but the last are free.
    developmentsPerAction(): number {
        return this.war()?.developments ?? DEVELOPMENTS_PER_ACTION
    }

    freeDevelopments(): number {
        return this.developmentsPerAction() - 1
    }

    developmentCost(settlementId: string): number {
        return this.developmentsThisTurn < this.freeDevelopments() ||
            settlementId === this.freeDevelopmentTarget()
            ? 0
            : SECOND_DEVELOPMENT_COST
    }

    affordableDevelopments(playerId: string): string[] {
        const cash = this.getPlayerState(playerId).cash
        return this.developableSettlements().filter(
            (settlementId) => this.developmentCost(settlementId) <= cash
        )
    }

    // Declining the paid development develops the next metro area automatically. A player with
    // nothing left to develop before then finishes too.
    mayFinishDeveloping(): boolean {
        return (
            this.developmentsThisTurn === this.freeDevelopments() ||
            (this.developmentsThisTurn > 0 && this.developableSettlements().length === 0)
        )
    }

    // The metro area Automatic Metro Development would raise now, if any is not full.
    automaticDevelopmentTarget(): string | undefined {
        return this.map.definition.automaticDevelopment.find(
            (settlementId) =>
                this.developmentLevel(settlementId) < this.map.maxDevelopments(settlementId)
        )
    }

    // Developed settlements the player may take a cube from: never a natural resource, and only
    // where a railroad they control has track.
    leaveTownOptions(playerId: string): string[] {
        if (!this.map.definition.leaveTown || this.developmentsThisTurn > 0) {
            return []
        }
        const served = new Set(
            this.map.railroads
                .filter((railroad) => this.controls(railroad.id, playerId))
                .flatMap((railroad) => [...railroadSettlements(this, railroad.id)])
        )
        return this.map.settlements
            .filter(
                (place) =>
                    place.kind !== SettlementKind.NaturalResource &&
                    this.developmentLevel(place.id) > 0 &&
                    served.has(place.id)
            )
            .map((place) => place.id)
    }

    settlementName(settlementId: string): string {
        return this.map.settlement(settlementId).name
    }

    bidding(): PassableBidding {
        const auction = this.auction
        assertExists(auction, 'No auction in progress')
        return new PassableBidding(auction.bidding)
    }

    // Initial and opening offerings start at nothing; offered stock starts at a fifth of the
    // railroad's value, which no build can change while the auction runs.
    auctionMinimum(): number {
        const auction = this.auction
        assertExists(auction, 'No auction in progress')
        return goesFreeToOpener(auction.kind) ? 0 : this.minimumBid(auction.railroadId)
    }

    smallestBid(): number {
        const auction = this.auction
        assertExists(auction, 'No auction in progress')
        const bidding = new PassableBidding(auction.bidding)
        return bidding.hasBid ? bidding.highBid + 1 : this.auctionMinimum()
    }

    unsoldOffers(): RailroadId[] {
        return this.openRailroads()
            .filter((railroad) => this.unsoldShares(railroad.id) > 0)
            .map((railroad) => railroad.id)
    }

    dividendPerShare(railroadId: RailroadId): number {
        const income = this.income(railroadId)
        return this.inRecovery() ? recoveryDividendPerShare(income) : dividendPerShare(income)
    }

    specialDividendPerShare(railroadId: RailroadId): number {
        const income = this.income(railroadId)
        if (this.inRecovery()) {
            return recoveryDividendPerShare(income)
        }
        return this.map.definition.specialDividendsRoundUp
            ? dividendPerShare(income)
            : specialDividendPerShare(income)
    }

    finalPayoffPerShare(railroadId: RailroadId): number {
        return finalPayoffPerShare(
            this.value(railroadId) + this.specialConnectionBonus(railroadId),
            this.income(railroadId),
            this.railroad(railroadId).owners.length
        )
    }

    // Each round ends in a payout; the last ends in the final payoff.
    rounds(): number {
        return this.map.definition.dividendsBeforeFinal + 1
    }

    round(): number {
        return Math.min(this.dividendsPaid, this.map.definition.dividendsBeforeFinal) + 1
    }

    isFinalPayoffNext(): boolean {
        return this.dividendsPaid >= this.map.definition.dividendsBeforeFinal
    }

    // What the next dividend pays per share at current incomes; the last is the final payoff.
    nextDividendPerShare(railroadId: RailroadId): number {
        return this.isFinalPayoffNext()
            ? this.finalPayoffPerShare(railroadId)
            : this.dividendPerShare(railroadId)
    }

    leaveTownPayout(playerId: string): number {
        return this.getPlayerState(playerId).leaveTownCubes * LEAVE_TOWN_PAYOUT
    }

    nextDividend(playerId: string): number {
        return this.holdings(playerId).reduce(
            (sum, holding) => sum + holding.shares * this.nextDividendPerShare(holding.railroadId),
            this.leaveTownPayout(playerId)
        )
    }

    // Cash if the game ended now: the final payout for every share and Leave Town cube held.
    // Once it has ended, the final payoff is already in cash.
    projectedFinalCash(playerId: string): number {
        const cash = this.getPlayerState(playerId).cash
        if (this.result) {
            return cash
        }
        return (
            cash +
            this.leaveTownPayout(playerId) +
            this.holdings(playerId).reduce(
                (sum, holding) =>
                    sum + holding.shares * this.finalPayoffPerShare(holding.railroadId),
                0
            )
        )
    }
}

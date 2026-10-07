import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState,
    assertExists,
    type AxialCoordinates,
    type RandomState
} from '@tabletop/common'
import { PassableBidding } from '@tabletop/18xx'
import { MachineState } from '../definition/states.js'
import {
    COMPANIES,
    CompanyId,
    companyDefinition,
    isGrocer,
    sharesPerCompany
} from '../components/companies.js'
import { CITIES, city, developmentCapacity } from '../components/map.js'
import { ACTION_SPACES, ActionSpace } from './actionSpaces.js'
import { ShareAuction } from './auction.js'
import { BonusCube, CompanyState, PlacedCube } from './companyState.js'
import {
    buildCost,
    companiesIn,
    cubesPerBuild,
    cubesRemaining,
    isPlacementSequenceLegal,
    placeableHexes,
    type BuildCost
} from './network.js'
import { HcgPlayerState, HydratedHcgPlayerState } from './playerState.js'
import {
    companyValue,
    companyValueBreakdown,
    markersIn,
    markersPlaced,
    valuePerShare,
    type ValueBreakdown
} from './valuation.js'

export const COMPANIES_EXHAUSTED_TO_END = 2

export type HcgGameState = Type.Static<typeof HcgGameState>
export const HcgGameState = Type.Object({
    ...Type.Omit(GameState, ['players', 'machineState']).properties,
    players: Type.Array(HcgPlayerState),
    machineState: Type.Enum(MachineState),
    companies: Type.Array(CompanyState),
    initialAuctionOrder: Type.Array(Type.Enum(CompanyId)),
    cubes: Type.Array(PlacedCube),
    developments: Type.Record(Type.String(), Type.Number()),
    roundTrack: Type.Array(Type.String()),
    dividendsPaid: Type.Number(),
    turnDevelopments: Type.Array(Type.String()),
    auction: Type.Optional(ShareAuction),
    bonusCube: Type.Optional(BonusCube)
})

export const HcgGameStateValidator = Compile(HcgGameState)

export type ShareHolding = { companyId: CompanyId; shares: number }

export class HydratedHcgGameState
    extends HydratableGameState<typeof HcgGameState, HydratedHcgPlayerState>
    implements HcgGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare protectedPrng?: RandomState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedHcgPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare companies: CompanyState[]
    declare initialAuctionOrder: CompanyId[]
    declare cubes: PlacedCube[]
    declare developments: Record<string, number>
    declare roundTrack: string[]
    declare dividendsPaid: number
    declare turnDevelopments: string[]
    declare auction?: ShareAuction
    declare bonusCube?: BonusCube

    constructor(data: HcgGameState) {
        super(data, HcgGameStateValidator)
        this.players = data.players.map((player) => new HydratedHcgPlayerState(player))
    }

    company(companyId: CompanyId): CompanyState {
        const company = this.companies.find((candidate) => candidate.id === companyId)
        assertExists(company, `Unknown company ${companyId}`)
        return company
    }

    turnPlayerId(): string {
        const playerId = this.turnManager.currentTurn()?.playerId
        assertExists(playerId, 'No turn in progress')
        return playerId
    }

    nextInitialAuction(): CompanyId | undefined {
        return this.initialAuctionOrder.find(
            (companyId) => this.company(companyId).owners.length === 0
        )
    }

    // The richest player after the initial auctions; ties go to the earliest seat from the
    // first player.
    firstActingPlayerId(): string {
        const [first] = this.turnManager.turnOrder
        return this.turnManager.turnOrder.reduce(
            (best, playerId) =>
                this.getPlayerState(playerId).cash > this.getPlayerState(best).cash
                    ? playerId
                    : best,
            first
        )
    }

    sharesPerCompany(): number {
        return sharesPerCompany(this.players.length)
    }

    sharesHeld(companyId: CompanyId, playerId: string): number {
        return this.company(companyId).owners.filter((owner) => owner === playerId).length
    }

    unsoldShares(companyId: CompanyId): number {
        return this.sharesPerCompany() - this.company(companyId).owners.length
    }

    auctionableCompanies(): CompanyId[] {
        return COMPANIES.map((company) => company.id).filter(
            (companyId) => this.unsoldShares(companyId) > 0
        )
    }

    holdings(playerId: string): ShareHolding[] {
        return COMPANIES.map((company) => ({
            companyId: company.id,
            shares: this.sharesHeld(company.id, playerId)
        })).filter((holding) => holding.shares > 0)
    }

    totalShares(playerId: string): number {
        return this.holdings(playerId).reduce((sum, holding) => sum + holding.shares, 0)
    }

    // The pawn must move to a new space every turn; when none of them can be carried out it
    // still moves, and the action does nothing.
    availableSpaces(playerId: string): ActionSpace[] {
        const player = this.getPlayerState(playerId)
        const newSpaces = ACTION_SPACES.filter((space) => space !== player.actionSpace)
        const playable = newSpaces.filter((space) => this.canTake(space, playerId))
        return playable.length > 0 ? playable : newSpaces
    }

    canTake(space: ActionSpace, playerId: string): boolean {
        switch (space) {
            case ActionSpace.BuildNetwork:
                return this.buildableCompanies(playerId).length > 0
            case ActionSpace.DevelopTowns:
                return this.developableCities().length > 0
            case ActionSpace.AuctionShare:
                return this.auctionableCompanies().length > 0
        }
    }

    cubesRemaining(companyId: CompanyId): number {
        return cubesRemaining(this, companyId)
    }

    companiesIn(coords: AxialCoordinates): CompanyId[] {
        return companiesIn(this, coords)
    }

    maxCubes(companyId: CompanyId): number {
        return Math.min(cubesPerBuild(companyId), this.cubesRemaining(companyId))
    }

    buildCost(companyId: CompanyId, hexes: readonly AxialCoordinates[]): BuildCost {
        return buildCost(this, companyId, hexes)
    }

    nextCubeHexes(
        companyId: CompanyId,
        chosen: readonly AxialCoordinates[] = []
    ): AxialCoordinates[] {
        if (chosen.length >= this.maxCubes(companyId)) {
            return []
        }
        const treasury = this.company(companyId).treasury
        return placeableHexes(this, companyId, chosen).filter(
            (coords) => this.buildCost(companyId, [...chosen, coords]).total <= treasury
        )
    }

    isLegalBuild(companyId: CompanyId, hexes: readonly AxialCoordinates[]): boolean {
        return (
            hexes.length > 0 &&
            hexes.length <= this.maxCubes(companyId) &&
            isPlacementSequenceLegal(this, companyId, hexes) &&
            this.buildCost(companyId, hexes).total <= this.company(companyId).treasury
        )
    }

    buildableCompanies(playerId: string): CompanyId[] {
        return this.holdings(playerId)
            .map((holding) => holding.companyId)
            .filter((companyId) => isGrocer(companyId) && this.nextCubeHexes(companyId).length > 0)
    }

    markersIn(cityId: string): number {
        return markersIn(this, cityId)
    }

    markersRemaining(): number {
        return companyDefinition(CompanyId.Balcones).supply - markersPlaced(this)
    }

    developableCities(): string[] {
        if (this.markersRemaining() === 0) {
            return []
        }
        return CITIES.map((candidate) => candidate.id).filter(
            (cityId) =>
                !this.turnDevelopments.includes(cityId) &&
                this.markersIn(cityId) < developmentCapacity(cityId)
        )
    }

    grocersInCity(cityId: string): CompanyId[] {
        return this.companiesIn(city(cityId).coords)
    }

    // How many grocers Balcones Builders can pay when developing the city; the active player
    // chooses who is paid when it cannot pay them all.
    builderPaymentsDue(cityId: string): number {
        return Math.min(
            this.grocersInCity(cityId).length,
            this.company(CompanyId.Balcones).treasury
        )
    }

    mustChooseBuilderPayees(cityId: string): boolean {
        const due = this.builderPaymentsDue(cityId)
        return due > 0 && due < this.grocersInCity(cityId).length
    }

    bidding(): PassableBidding {
        const auction = this.auction
        assertExists(auction, 'No auction in progress')
        return new PassableBidding(auction.bidding)
    }

    smallestBid(): number {
        const bidding = this.bidding()
        return bidding.hasBid ? bidding.highBid + 1 : 0
    }

    value(companyId: CompanyId): number {
        return companyValue(this, companyId)
    }

    valueBreakdown(companyId: CompanyId): ValueBreakdown {
        return companyValueBreakdown(this, companyId)
    }

    perShare(companyId: CompanyId): number {
        return valuePerShare(this.value(companyId), this.company(companyId).owners.length)
    }

    projectedDividend(playerId: string): number {
        return this.holdings(playerId).reduce(
            (sum, holding) => sum + holding.shares * this.perShare(holding.companyId),
            0
        )
    }

    supplyRemaining(companyId: CompanyId): number {
        return isGrocer(companyId) ? this.cubesRemaining(companyId) : this.markersRemaining()
    }

    companiesSoldOut(): CompanyId[] {
        return COMPANIES.map((company) => company.id).filter(
            (companyId) => this.unsoldShares(companyId) === 0
        )
    }

    companiesOutOfSupply(): CompanyId[] {
        return COMPANIES.map((company) => company.id).filter(
            (companyId) => this.supplyRemaining(companyId) === 0
        )
    }

    isGameEndTriggered(): boolean {
        return (
            this.companiesSoldOut().length >= COMPANIES_EXHAUSTED_TO_END ||
            this.companiesOutOfSupply().length >= COMPANIES_EXHAUSTED_TO_END
        )
    }
}

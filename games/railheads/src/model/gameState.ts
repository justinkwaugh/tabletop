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
    assert,
    assertExists,
    sameCoordinates,
    type AxialCoordinates,
    type RandomState
} from '@tabletop/common'
import { PassableBidding } from '@tabletop/18xx'
import { MachineState } from '../definition/states.js'
import { edition, type Edition } from '../editions/editions.js'
import {
    ACTION_SPACES,
    ActionSpaceId,
    CompanyId,
    EditionId,
    HexKind,
    INDUSTRIES,
    Industry,
    isLayTrackSpace,
    type CompanyDefinition,
    type LayTrackRules,
    type LayTrackSpace
} from '../editions/types.js'
import {
    ActionSpaceState,
    CompanyState,
    IndustryAuction,
    IndustryState,
    InitialOffer,
    ShareAuction,
    TrackHex
} from './components.js'
import {
    dividendPerShare,
    finalRoundReduction,
    halfPrice,
    minimumShareBid,
    pileCoins,
    selectionCost
} from './economy.js'
import type { PayoutRates } from './payouts.js'
import { HydratedRailheadsPlayerState, RailheadsPlayerState } from './playerState.js'
import {
    IndustryBoost,
    PlacementKind,
    cubesPlaced,
    discsPlaced,
    isConnected,
    placementKind,
    trackAt,
    type Placement,
    type PlacementContext,
    type PlacementEffect,
    type PlacementTarget
} from './track.js'

export type RailheadsGameState = Type.Static<typeof RailheadsGameState>
export const RailheadsGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(RailheadsPlayerState),
            machineState: Type.Enum(MachineState),
            editionId: Type.Enum(EditionId),
            offTheRails: Type.Boolean(),
            rounds: RoundManager,
            startPlayerId: Type.Optional(Type.String()),
            companies: Type.Array(CompanyState),
            track: Type.Array(TrackHex),
            industries: Type.Array(IndustryState),
            actionSpaces: Type.Array(ActionSpaceState),
            roundTimer: Type.Number(),
            activeSpace: Type.Optional(Type.Enum(ActionSpaceId)),
            initialOffers: Type.Array(InitialOffer),
            shareAuction: Type.Optional(ShareAuction),
            industryAuction: Type.Optional(IndustryAuction)
        })
    ])
)

export const RailheadsGameStateValidator = Compile(RailheadsGameState)

export const RailheadsProjectedState = Visibility.createProjectionSchema(RailheadsGameState)
export type RailheadsProjectedState = Type.Static<typeof RailheadsProjectedState>
export const RailheadsProjectedStateValidator = Compile(RailheadsProjectedState)

export class HydratedRailheadsGameState
    extends HydratableGameState<typeof RailheadsProjectedState, HydratedRailheadsPlayerState>
    implements RailheadsProjectedState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare protectedPrng?: RandomState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedRailheadsPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare editionId: EditionId
    declare offTheRails: boolean
    declare rounds: HydratedRoundManager
    declare startPlayerId?: string
    declare companies: CompanyState[]
    declare track: TrackHex[]
    declare industries: IndustryState[]
    declare actionSpaces: ActionSpaceState[]
    declare roundTimer: number
    declare activeSpace?: ActionSpaceId
    declare initialOffers: InitialOffer[]
    declare shareAuction?: ShareAuction
    declare industryAuction?: RailheadsProjectedState['industryAuction']

    constructor(data: RailheadsProjectedState) {
        super(data, RailheadsProjectedStateValidator)
        this.players = data.players.map((player) => new HydratedRailheadsPlayerState(player))
        this.rounds = new HydratedRoundManager(data.rounds)
    }

    get edition(): Edition {
        return edition(this.editionId)
    }

    get playerCount(): number {
        return this.players.length
    }

    round(): number {
        return this.rounds.series.length
    }

    isFinalRound(): boolean {
        return this.round() === this.edition.definition.rounds
    }

    turnPlayerId(): string {
        const playerId = this.turnManager.currentTurn()?.playerId
        assertExists(playerId, 'No turn in progress')
        return playerId
    }

    company(companyId: CompanyId): CompanyState {
        const found = this.companies.find((company) => company.id === companyId)
        assertExists(found, `Unknown company ${companyId}`)
        return found
    }

    companyDefinition(companyId: CompanyId): CompanyDefinition {
        return this.edition.company(companyId)
    }

    sharesSold(companyId: CompanyId): number {
        return this.company(companyId).owners.length
    }

    unsoldShares(companyId: CompanyId): number {
        return this.companyDefinition(companyId).shares - this.sharesSold(companyId)
    }

    sharesHeld(companyId: CompanyId, playerId: string): number {
        return this.company(companyId).owners.filter((owner) => owner === playerId).length
    }

    holdsShare(companyId: CompanyId, playerId: string): boolean {
        return this.sharesHeld(companyId, playerId) > 0
    }

    minimumBid(companyId: CompanyId): number {
        return minimumShareBid(this.company(companyId).revenue, this.sharesSold(companyId))
    }

    dividendPerShare(companyId: CompanyId): number {
        return dividendPerShare(this.company(companyId).revenue, this.sharesSold(companyId))
    }

    industry(industry: Industry): IndustryState {
        const found = this.industries.find((candidate) => candidate.industry === industry)
        assertExists(found, `Unknown industry ${industry}`)
        return found
    }

    tokensHeld(industry: Industry): number {
        return this.players.reduce((sum, player) => sum + player.tokensOf(industry), 0)
    }

    raisedLevel(industry: Industry, steps: number): number {
        return Math.min(
            this.industry(industry).level + steps,
            this.edition.definition.developmentTrackLength
        )
    }

    actionSpace(space: ActionSpaceId): ActionSpaceState {
        const found = this.actionSpaces.find((candidate) => candidate.id === space)
        assertExists(found, `Unknown action space ${space}`)
        return found
    }

    spaceCost(space: ActionSpaceId): number {
        return selectionCost(this.actionSpace(space).selections, this.playerCount)
    }

    spaceCoins(space: ActionSpaceId): number {
        return pileCoins(this.actionSpace(space).selections, this.playerCount)
    }

    canTakeAction(space: ActionSpaceId, playerId: string): boolean {
        switch (space) {
            case ActionSpaceId.IssueShare:
                return this.issuableCompanies(playerId).length > 0
            case ActionSpaceId.IndustryInvestment:
                return this.investableIndustries(playerId).length > 0
            default:
                return this.buildableCompanies(playerId, space).length > 0
        }
    }

    availableSpaces(playerId: string): ActionSpaceId[] {
        return ACTION_SPACES.filter(
            (space) =>
                this.spaceCost(space) <= this.roundTimer && this.canTakeAction(space, playerId)
        )
    }

    consolidatableSpaces(): ActionSpaceId[] {
        return ACTION_SPACES.filter((space) => this.actionSpace(space).selections > 0)
    }

    roundTimerSize(round: number): number {
        const size = this.edition.definition.roundTimer[this.playerCount]
        if (round !== this.edition.definition.rounds) {
            return size
        }
        return (
            size -
            finalRoundReduction(this.companies.map((company) => this.unsoldShares(company.id)))
        )
    }

    issuableCompanies(playerId: string): CompanyId[] {
        const cash = this.getPlayerState(playerId).cash
        return this.companies
            .filter(
                (company) =>
                    this.unsoldShares(company.id) > 0 && this.minimumBid(company.id) <= cash
            )
            .map((company) => company.id)
    }

    bidding(): PassableBidding {
        const auction = this.shareAuction
        assertExists(auction, 'No share auction in progress')
        return new PassableBidding(auction.bidding)
    }

    smallestBid(): number {
        const auction = this.shareAuction
        assertExists(auction, 'No share auction in progress')
        const bidding = this.bidding()
        return bidding.hasBid ? bidding.highBid + 1 : auction.minimum
    }

    investableIndustries(playerId: string): Industry[] {
        const cash = this.getPlayerState(playerId).cash
        return INDUSTRIES.filter(
            (industry) =>
                this.industry(industry).available > 0 && this.raisedLevel(industry, 1) <= cash
        )
    }

    layTrackRules(space: LayTrackSpace): LayTrackRules {
        return this.edition.definition.layTrack[space]
    }

    buildableCompanies(playerId: string, space: LayTrackSpace): CompanyId[] {
        const rules = this.layTrackRules(space)
        return this.companies
            .map((company) => company.id)
            .filter((companyId) => !rules.requiresShare || this.holdsShare(companyId, playerId))
    }

    siteCapacity(): number {
        return this.edition.definition.siteCapacity(this.round())
    }

    private placementContext(companyId: CompanyId, space: LayTrackSpace): PlacementContext {
        const definition = this.companyDefinition(companyId)
        return {
            track: this.track,
            companyId,
            rules: this.layTrackRules(space),
            siteCapacity: this.siteCapacity(),
            discsLeft: definition.discs - discsPlaced(this.track, companyId),
            cubesLeft: definition.crossingCubes - cubesPlaced(this.track, companyId),
            neighbours: (coords) => this.edition.map.neighbourCoords(coords)
        }
    }

    discsLeft(companyId: CompanyId): number {
        return this.companyDefinition(companyId).discs - discsPlaced(this.track, companyId)
    }

    cubesLeft(companyId: CompanyId): number {
        return this.companyDefinition(companyId).crossingCubes - cubesPlaced(this.track, companyId)
    }

    placementCost(
        playerId: string,
        space: LayTrackSpace,
        companyId: CompanyId,
        coords: AxialCoordinates,
        kind: PlacementKind
    ): number {
        if (kind === PlacementKind.Cube) {
            return this.edition.definition.crossingCubeCost
        }
        const cost = this.edition.definition.trackCost[this.edition.map.hex(coords).kind]
        return this.layTrackRules(space).halfPriceWithoutShare &&
            !this.holdsShare(companyId, playerId)
            ? halfPrice(cost)
            : cost
    }

    // Every hex where the company could put its next piece, with what it would cost.
    placementTargets(
        playerId: string,
        space: LayTrackSpace,
        companyId: CompanyId
    ): PlacementTarget[] {
        const context = this.placementContext(companyId, space)
        const treasury = this.company(companyId).treasury
        return this.edition.map.hexes().flatMap((place) => {
            const kind = placementKind(context, place)
            if (kind === undefined || !isConnected(context, place.coords)) {
                return []
            }
            const cost = this.placementCost(playerId, space, companyId, place.coords, kind)
            return cost <= treasury
                ? [
                      {
                          coords: place.coords,
                          kind,
                          cost,
                          ...(place.industry ? { industry: place.industry } : {})
                      }
                  ]
                : []
        })
    }

    needsBoostChoice(coords: AxialCoordinates): boolean {
        return this.offTheRails && this.edition.map.hex(coords).kind === HexKind.Industry
    }

    // Lays one piece, checking it against the action space and the board as it stands.
    placeTrack(playerId: string, space: LayTrackSpace, placement: Placement): PlacementEffect {
        const { companyId, coords, kind } = placement
        const target = this.placementTargets(playerId, space, companyId).find((candidate) =>
            sameCoordinates(candidate.coords, coords)
        )
        assert(target !== undefined && target.kind === kind, 'That piece cannot be placed there')
        assert(
            (placement.boost !== undefined) ===
                (kind === PlacementKind.Disc && this.needsBoostChoice(coords)),
            'Off the Rails asks how an Industry Site develops'
        )
        const company = this.company(companyId)
        company.treasury -= target.cost
        const hex = trackAt(this.track, coords) ?? this.addTrackHex(coords)
        if (kind === PlacementKind.Cube) {
            const [crossedCompanyId] = hex.discs
            hex.cube = companyId
            this.company(crossedCompanyId).treasury += target.cost
            return { companyId, kind, cost: target.cost, crossedCompanyId, revenueGain: 0 }
        }
        hex.discs.push(companyId)
        const place = this.edition.map.hex(coords)
        if (place.industry) {
            const industry = this.industry(place.industry)
            const development = placement.boost === IndustryBoost.Development
            industry.level = this.raisedLevel(place.industry, development ? 2 : 1)
            const revenueGain = development ? 0 : industry.level
            company.revenue += revenueGain
            return {
                companyId,
                kind,
                cost: target.cost,
                revenueGain,
                industry: place.industry,
                level: industry.level
            }
        }
        const revenueGain = place.siteId
            ? this.edition.definition.siteRevenue[this.edition.site(place.siteId).kind]
            : 0
        company.revenue += revenueGain
        return { companyId, kind, cost: target.cost, revenueGain }
    }

    private addTrackHex(coords: AxialCoordinates): TrackHex {
        const hex: TrackHex = { coords, discs: [] }
        this.track.push(hex)
        return hex
    }

    roundPayouts(): PayoutRates {
        return {
            companies: this.companies.map((company) => ({
                companyId: company.id,
                perShare: this.dividendPerShare(company.id)
            })),
            industries: INDUSTRIES.map((industry) => ({
                industry,
                perToken: this.industry(industry).level
            }))
        }
    }

    // A company's Railroad Bonus: for every site where its disc is on top, the discs beneath it.
    railroadBonus(companyId: CompanyId): number {
        return this.track
            .filter(
                (hex) =>
                    this.edition.map.hex(hex.coords).kind !== HexKind.Countryside &&
                    hex.discs.at(-1) === companyId
            )
            .reduce((sum, hex) => sum + hex.discs.length - 1, 0)
    }

    industrySitesReached(industry: Industry): number {
        return this.edition.definition.map.industrySites.filter(
            (site) =>
                site.industry === industry && (trackAt(this.track, site.hex)?.discs.length ?? 0) > 0
        ).length
    }

    industryBonusPerToken(industry: Industry): number {
        const tokens = this.tokensHeld(industry)
        if (tokens === 0) {
            return 0
        }
        const total =
            this.industrySitesReached(industry) * this.edition.definition.industryBonusPerSite
        return Math.ceil(total / tokens)
    }

    finalPayouts(): PayoutRates {
        return {
            companies: this.companies.map((company) => ({
                companyId: company.id,
                perShare: this.railroadBonus(company.id)
            })),
            industries: INDUSTRIES.map((industry) => ({
                industry,
                perToken: this.industryBonusPerToken(industry)
            }))
        }
    }

    playerIncome(playerId: string, payouts: PayoutRates): number {
        const player = this.getPlayerState(playerId)
        return (
            payouts.companies.reduce(
                (sum, rate) => sum + rate.perShare * this.sharesHeld(rate.companyId, playerId),
                0
            ) +
            payouts.industries.reduce(
                (sum, rate) => sum + rate.perToken * player.tokensOf(rate.industry),
                0
            )
        )
    }

    isLayTrackTurn(): boolean {
        return this.activeSpace !== undefined && isLayTrackSpace(this.activeSpace)
    }
}

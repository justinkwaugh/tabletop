import {
    ActionSource,
    assert,
    assertExists,
    turnOrderFrom,
    type HydratedAction,
    type MachineContext
} from '@tabletop/common'
import * as Type from 'typebox'
import type { ActionDefinition } from '../actions/actionDefinition.js'
import { systemAction, titleAction } from '../actions/titleAction.js'
import { AssetTransfer, transferCompanyAssets } from '../company/companyMerger.js'
import { CompanyClosure, closeShareCompany } from '../company/companyClosure.js'
import { startCompanyAtPar } from '../company/companyStart.js'
import { ConnectedTrack } from '../construction/connectedTrack.js'
import type { ValuationRules } from '../ending/finalWealth.js'
import { RoundEnd, roundEnd } from '../ending/roundEnd.js'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import {
    finiteCashOwnedBy,
    getCompany,
    presidentOf,
    treasuryPoolId,
    type OpenShare
} from '../finance/finance.js'
import type { HydratedEighteenXXState } from '../game/eighteenXXState.js'
import type { EighteenXXStateHandler } from '../game/eighteenXXTitleRules.js'
import { SystemActionFirstHandler } from '../game/systemActionFirstHandler.js'
import type { RailwayMap } from '../map/map.js'
import { RailwayMapState } from '../map/mapState.js'
import { cityBlockedForCompanies, replaceStation, type PlacedStation } from '../map/station.js'
import { exportAwaited } from '../operating/exportTrains.js'
import { nextOperatingCompany, type OperatingRules } from '../operating/operatingSet.js'
import { applyPresidencyChange, evaluatePresidency } from '../stock/presidency.js'
import {
    removeStockMarker,
    type StockMarketChart,
    type StockMarketSpace
} from '../stock/stockMarket.js'
import { stockCertificateCount, type StockRules } from '../stock/stockRules.js'
import type { TileSet } from '../tiles/inventory.js'
import { releaseTrains, trainsOwnedBy } from '../trains/train.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import {
    MergerRoundMachineState,
    type MergerProposal,
    type MergerRound,
    type MergerRoundState,
    type ShareAllotment
} from './mergerRoundState.js'

const Id = Type.String({ minLength: 1 })

type State = HydratedEighteenXXState & MergerRoundState

/**
 * A title's merger rounds, in which each minor in turn may convert to a major company or merge
 * with connected minors into one (1861 §12, 1867 GTG §9).
 */
export interface MergerRoundRules {
    market: StockMarketChart
    map: RailwayMap
    tileSet: TileSet
    operatingRules: OperatingRules
    trainRules: Pick<TrainRules, 'trainLimit'>
    stockRules: StockRules
    majorIds: readonly string[]
    /** The phases after whose operating rounds a merger round follows. */
    phaseIds: readonly string[]
    /** Whether a minor on this space may convert. */
    convertible(space: StockMarketSpace): boolean
    /** The major's start space for a price: the minor's, or the highest and lowest added. */
    startSpace(price: number): StockMarketSpace
    /** The lowest price a merger may start its major at. */
    minimumPrice: number
    currency: string
    /** How many minors merge: at least, at most, and at most of one player's. */
    limits: { minimum: number; maximum: number; perPlayer: number }
    majorShareCount: number
    /** The shares the director's certificate counts and a director must hold. */
    directorShares: number
    certificateLimit(state: State): number
    ownershipLimitPercent(state: State): number
    /** How players' net worth is valued as the round ends. */
    valuationRules: ValuationRules
}

export type MergerRequest = {
    kind: 'convert' | 'merge'
    minorId: string
    minorIds: readonly string[]
    majorId: string
}

/** What a proposal would make: its price, its director-to-be and each player's shares. */
export type MergerPreview = {
    marketSpaceId: string
    price: number
    directorId: string
    allotments: readonly ShareAllotment[]
}

export type MergerChoices = {
    minorId: string
    majorIds: string[]
    convertible: boolean
    partnerIds: string[]
}

export const MergerFormation = Type.Object(
    {
        majorId: Id,
        marketSpaceId: Id,
        directorId: Id,
        payments: Type.Array(CashPayment),
        assets: Type.Array(AssetTransfer),
        stationIds: Type.Array(Id),
        closures: Type.Array(CompanyClosure)
    },
    { additionalProperties: false }
)
export type MergerFormation = Type.Static<typeof MergerFormation>

const StartMergerRoundAction = systemAction('StartMergerRound', {
    metadata: Type.Optional(
        Type.Object({ minorIds: Type.Array(Id) }, { additionalProperties: false })
    )
})
export const StartMergerRound = StartMergerRoundAction.schema
export const isStartMergerRound = StartMergerRoundAction.is

const EndMergerRoundAction = systemAction('EndMergerRound', {
    metadata: Type.Optional(Type.Object({ roundEnd: RoundEnd }, { additionalProperties: false }))
})
export const EndMergerRound = EndMergerRoundAction.schema
export const isEndMergerRound = EndMergerRoundAction.is

const ProposeMergerAction = titleAction('ProposeMerger', {
    kind: Type.Union([Type.Literal('convert'), Type.Literal('merge')]),
    minorId: Id,
    minorIds: Type.Array(Id, { minItems: 1 }),
    majorId: Id,
    metadata: Type.Optional(
        Type.Object(
            {
                formation: Type.Optional(MergerFormation),
                lapsed: Type.Optional(Type.Literal(true))
            },
            { additionalProperties: false }
        )
    )
})
export const ProposeMerger = ProposeMergerAction.schema
export type ProposeMerger = Type.Static<typeof ProposeMerger>
export const isProposeMerger = ProposeMergerAction.is

const PassMergerAction = titleAction('PassMerger', { minorId: Id })
export const PassMerger = PassMergerAction.schema
export type PassMerger = Type.Static<typeof PassMerger>
export const isPassMerger = PassMergerAction.is

const AnswerMergerAction = titleAction('AnswerMerger', { accept: Type.Boolean() })
export const AnswerMerger = AnswerMergerAction.schema
export type AnswerMerger = Type.Static<typeof AnswerMerger>
export const isAnswerMerger = AnswerMergerAction.is

/** The director keeps two stations (1861 §12.3, 1867 GTG §9.2E). */
const KeptStations = 2

const ChooseMergerStationsAction = titleAction('ChooseMergerStations', {
    stationIds: Type.Array(Id, { minItems: 1, maxItems: KeptStations })
})
export const ChooseMergerStations = ChooseMergerStationsAction.schema
export type ChooseMergerStations = Type.Static<typeof ChooseMergerStations>
export const isChooseMergerStations = ChooseMergerStationsAction.is

const BuyMergerSharesAction = titleAction('BuyMergerShares', {
    shares: Type.Integer({ minimum: 0, maximum: 10 }),
    metadata: Type.Optional(
        Type.Object(
            {
                payment: Type.Optional(CashPayment),
                formation: Type.Optional(MergerFormation),
                lapsed: Type.Optional(Type.Literal(true))
            },
            { additionalProperties: false }
        )
    )
})
export const BuyMergerShares = BuyMergerSharesAction.schema
export type BuyMergerShares = Type.Static<typeof BuyMergerShares>
export const isBuyMergerShares = BuyMergerSharesAction.is

const DiscardMergerTrainAction = titleAction('DiscardMergerTrain', { trainId: Id })
export const DiscardMergerTrain = DiscardMergerTrainAction.schema
export type DiscardMergerTrain = Type.Static<typeof DiscardMergerTrain>
export const isDiscardMergerTrain = DiscardMergerTrainAction.is

export type MergerRoundActionType =
    | 'ProposeMerger'
    | 'PassMerger'
    | 'AnswerMerger'
    | 'ChooseMergerStations'
    | 'BuyMergerShares'
    | 'DiscardMergerTrain'

/** A title's merger round: its queries, its actions and its handler. */
export class MergerRounds {
    constructor(readonly rules: MergerRoundRules) {}

    /** The lowest and highest prices a minor converts at, from the market's convertible spaces. */
    convertPrices(): { minimum: number; maximum: number } {
        const prices = this.rules.market.spaces
            .filter((space) => this.rules.convertible(space))
            .map((space) => space.price)
        assert(prices.length, 'Some market space allows conversion')
        return { minimum: Math.min(...prices), maximum: Math.max(...prices) }
    }

    /** The player whose decision the round waits for. */
    playerId(state: State): string | undefined {
        const round = state.mergerRound
        if (!round || round.completed) return undefined
        if (round.proposal) return round.proposal.pendingPlayerIds[0]
        const [minorId] = round.minorIds
        return minorId ? this.ownerOf(state, minorId) : undefined
    }

    /** The actions the player may take in the merger round now. */
    choices(state: State, playerId: string): MergerRoundActionType[] {
        if (this.playerId(state) !== playerId) return []
        const proposal = state.mergerRound?.proposal
        if (!proposal) return ['ProposeMerger', 'PassMerger']
        switch (proposal.stage) {
            case 'consent':
                return ['AnswerMerger']
            case 'stations':
                return ['ChooseMergerStations']
            case 'shareholders':
            case 'open':
                return ['BuyMergerShares']
            case 'discard':
                return ['DiscardMergerTrain']
        }
    }

    /** The majors a proposal may start, and the minors the deciding minor could merge with. */
    mergerChoices(state: State): MergerChoices | undefined {
        const round = state.mergerRound
        const minorId = round?.minorIds[0]
        if (!round || round.completed || round.proposal || !minorId) return undefined
        return {
            minorId,
            majorIds: this.unstartedMajors(state),
            convertible: this.rules.convertible(this.minorSpace(state, minorId)),
            partnerIds: this.eligibleMinors(state).filter((id) => id !== minorId)
        }
    }

    preview(state: State, request: Pick<MergerRequest, 'kind' | 'minorId' | 'minorIds'>) {
        const minorIds = this.operatingOrderOf(state, request.minorIds)
        const shares = this.baseAllotments(state, request.kind, minorIds)
        const space = this.startSpace(state, minorIds)
        const preview: MergerPreview = {
            marketSpaceId: space.id,
            price: space.price,
            directorId: this.firstDirector(state, minorIds, shares),
            allotments: shares
        }
        return preview
    }

    /** A conversion starts the major at the minor's price; a merger at the highest and lowest added. */
    startSpace(state: State, minorIds: readonly string[]): StockMarketSpace {
        return this.rules.startSpace(this.price(state, minorIds))
    }

    reason(state: State, playerId: string, request: MergerRequest): string | undefined {
        const { rules } = this
        const round = state.mergerRound
        if (!round || round.completed || round.proposal || round.minorIds[0] !== request.minorId)
            return 'This minor is not deciding.'
        if (this.ownerOf(state, request.minorId) !== playerId)
            return 'Only the minor’s owner decides.'
        if (!this.unstartedMajors(state).includes(request.majorId))
            return 'Choose a major company that has not been started.'
        if (request.kind === 'convert') {
            if (request.minorIds.length !== 1 || request.minorIds[0] !== request.minorId)
                return 'A conversion is of the deciding minor alone.'
            if (!rules.convertible(this.minorSpace(state, request.minorId))) {
                const { minimum, maximum } = this.convertPrices()
                return `A minor converts only at ${rules.currency}${minimum} to ${rules.currency}${maximum}.`
            }
            return undefined
        }
        const { minorIds } = request
        const { limits } = rules
        if (!minorIds.includes(request.minorId)) return 'The merger includes the deciding minor.'
        if (new Set(minorIds).size !== minorIds.length) return 'Name each minor once.'
        if (minorIds.length < limits.minimum || minorIds.length > limits.maximum)
            return `Between ${limits.minimum} and ${limits.maximum} minors merge.`
        if (
            minorIds.some(
                (id) =>
                    getCompany(state, id).kind !== 'minor' ||
                    getCompany(state, id).closed ||
                    !getCompany(state, id).started
            )
        )
            return 'Only open minors merge.'
        const owners = minorIds.map((id) => this.ownerOf(state, id))
        if (
            owners.some(
                (owner) => owners.filter((other) => other === owner).length > limits.perPlayer
            )
        )
            return `No more than ${limits.perPlayer} of one player’s minors merge.`
        if (!this.connected(state, minorIds)) return 'The minors must be connected by track.'
        if (this.price(state, minorIds) < rules.minimumPrice)
            return `A merger starts its major company at ${rules.currency}${rules.minimumPrice} at least.`
        const shares = this.allotments(state, minorIds)
        if (!this.directorPossible(state, shares, this.startSpace(state, minorIds).price))
            return 'No player could hold the director’s certificate.'
        return undefined
    }

    /**
     * Whether one of the minors traces routes to all the others, the merging companies' stations
     * not blocking; stations in the same hex must still be joined by track (1861 §12.3, 1867 GTG
     * §9.2).
     */
    connected(state: State, minorIds: readonly string[]): boolean {
        const stations = minorIds.map((id) => this.stationOf(state, id))
        if (stations.some((station) => !station)) return false
        const placed = stations.flatMap((station) => (station ? [station] : []))
        const mapState = new RailwayMapState(
            this.rules.map,
            this.rules.tileSet,
            state.tileInventory
        )
        return placed.some((hub) => {
            const track = new ConnectedTrack(mapState, [hub.position], (locationId, node) =>
                cityBlockedForCompanies(state, this.rules.map, minorIds, locationId, node)
            )
            return placed.every(
                (other) =>
                    other === hub ||
                    (other.position.locationId === hub.position.locationId &&
                        other.position.nodeId === hub.position.nodeId) ||
                    track.reaches(other.position.locationId, {
                        kind: 'node',
                        nodeId: other.position.nodeId
                    })
            )
        })
    }

    /** The stations the director may keep: two of the minors', in different hexes. */
    stationChoiceReason(state: State, stationIds: readonly string[]): string | undefined {
        const proposal = this.requireProposal(state)
        const placed = proposal.minorIds.flatMap((id) => this.stationOf(state, id) ?? [])
        const chosen = stationIds.map((id) => placed.find((station) => station.id === id))
        if (chosen.some((station) => !station)) return 'Keep stations of the merging minors.'
        const hexes = new Set(chosen.map((station) => station?.position.locationId))
        if (hexes.size !== chosen.length) return 'The kept stations are in different hexes.'
        const available = new Set(placed.map((station) => station.position.locationId)).size
        if (chosen.length !== Math.min(KeptStations, available)) return 'Keep two stations.'
        return undefined
    }

    /** How many more shares the player may buy: the ownership limit, the certificate limit and cash. */
    sharesAvailable(state: State, playerId: string): number {
        const { rules } = this
        const proposal = this.requireProposal(state)
        const price = rules.market.space(proposal.marketSpaceId).price
        const player = { kind: 'player' as const, playerId }
        const cash = Math.floor(finiteCashOwnedBy(state, player) / price)
        const treasury =
            proposal.stage === 'open'
                ? this.shareCertificates(state, proposal.majorId, false).length
                : rules.majorShareCount -
                  proposal.allotments.reduce((sum, entry) => sum + entry.shares, 0)
        const held =
            proposal.stage === 'open'
                ? state.certificates
                      .filter(
                          (certificate): certificate is OpenShare =>
                              certificate.kind === 'share' &&
                              certificate.companyId === proposal.majorId &&
                              certificate.owner.kind === 'player' &&
                              certificate.owner.playerId === playerId
                      )
                      .reduce((sum, certificate) => sum + certificate.shares, 0)
                : this.shareTotal(proposal, playerId)
        // Before the company forms, the player's minors become its shares: the director's two on
        // one certificate, everyone else's one apiece.
        const formedCertificates =
            held - (playerId === proposal.directorId && held >= rules.directorShares ? 1 : 0)
        const certificates =
            stockCertificateCount(state, player, rules.stockRules) -
            (proposal.stage === 'open'
                ? 0
                : proposal.minorIds.filter((id) => this.ownerOf(state, id) === playerId).length -
                  formedCertificates)
        const room = rules.certificateLimit(state) - certificates
        return Math.max(
            0,
            Math.min(
                cash,
                treasury,
                (rules.majorShareCount * rules.ownershipLimitPercent(state)) / 100 - held,
                room
            )
        )
    }

    /** The merger round's actions. */
    actions(): ActionDefinition[] {
        return MergerRounds.actionsOf(this)
    }

    private static actionsOf(rounds: MergerRounds): ActionDefinition[] {
        class HydratedStartMergerRound extends StartMergerRoundAction.Base {
            declare type: 'StartMergerRound'
            declare metadata?: Type.Static<typeof StartMergerRound>['metadata']
            apply(state: State): void {
                assert(
                    this.source === ActionSource.System && rounds.due(state),
                    'A merger round is due'
                )
                const set = state.operatingSet
                assertExists(set, 'A merger round follows an operating round')
                const minorIds = rounds.eligibleMinors(state)
                state.mergerRound = {
                    set: set.number,
                    round: set.roundNumber,
                    minorIds,
                    completed: false
                }
                state.activePlayerIds = []
                this.metadata = { minorIds }
            }
        }

        class HydratedEndMergerRound extends EndMergerRoundAction.Base {
            declare type: 'EndMergerRound'
            declare metadata?: Type.Static<typeof EndMergerRound>['metadata']
            apply(state: State): void {
                const round = rounds.requireRound(state)
                assert(
                    this.source === ActionSource.System &&
                        !round.minorIds.length &&
                        !round.proposal,
                    'The merger round ends once every minor has decided'
                )
                round.completed = true
                state.activePlayerIds = []
                this.metadata = {
                    roundEnd: roundEnd(state, rounds.rules.valuationRules, 'title')
                }
            }
        }

        class HydratedProposeMerger extends ProposeMergerAction.Base implements ProposeMerger {
            declare type: 'ProposeMerger'
            declare playerId: string
            declare kind: 'convert' | 'merge'
            declare minorId: string
            declare minorIds: string[]
            declare majorId: string
            declare metadata?: ProposeMerger['metadata']
            apply(state: State): void {
                assert(this.source === ActionSource.User, 'Players propose mergers')
                const reason = rounds.reason(state, this.playerId, this)
                assert(!reason, reason ?? 'Invalid merger')
                const round = rounds.requireRound(state)
                const minorIds = rounds.operatingOrderOf(state, this.minorIds)
                const shares = rounds.baseAllotments(state, this.kind, minorIds)
                const directorId = rounds.firstDirector(state, minorIds, shares)
                const proposal: MergerProposal = {
                    kind: this.kind,
                    minorId: this.minorId,
                    minorIds,
                    majorId: this.majorId,
                    marketSpaceId: rounds.startSpace(state, minorIds).id,
                    stage: 'consent',
                    directorId,
                    pendingPlayerIds: rounds
                        .clockwiseFrom(state, this.playerId)
                        .filter(
                            (playerId) =>
                                playerId !== this.playerId &&
                                minorIds.some(
                                    (minorId) => rounds.ownerOf(state, minorId) === playerId
                                )
                        ),
                    allotments: shares
                }
                round.proposal = proposal
                if (!proposal.pendingPlayerIds.length) rounds.afterConsents(state, proposal)
            }
        }

        class HydratedPassMerger extends PassMergerAction.Base implements PassMerger {
            declare type: 'PassMerger'
            declare playerId: string
            declare minorId: string
            apply(state: State): void {
                const round = rounds.requireRound(state)
                assert(
                    this.source === ActionSource.User &&
                        !round.proposal &&
                        round.minorIds[0] === this.minorId &&
                        rounds.ownerOf(state, this.minorId) === this.playerId,
                    'The minor’s owner passes'
                )
                round.minorIds = round.minorIds.slice(1)
            }
        }

        class HydratedAnswerMerger extends AnswerMergerAction.Base implements AnswerMerger {
            declare type: 'AnswerMerger'
            declare playerId: string
            declare accept: boolean
            apply(state: State): void {
                const proposal = rounds.requireProposal(state)
                assert(
                    this.source === ActionSource.User &&
                        proposal.stage === 'consent' &&
                        proposal.pendingPlayerIds[0] === this.playerId,
                    'The minors’ owners answer the proposal in turn'
                )
                if (!this.accept) {
                    delete rounds.requireRound(state).proposal
                    return
                }
                proposal.pendingPlayerIds = proposal.pendingPlayerIds.slice(1)
                if (!proposal.pendingPlayerIds.length) rounds.afterConsents(state, proposal)
            }
        }

        class HydratedChooseMergerStations
            extends ChooseMergerStationsAction.Base
            implements ChooseMergerStations
        {
            declare type: 'ChooseMergerStations'
            declare playerId: string
            declare stationIds: string[]
            apply(state: State): void {
                const proposal = rounds.requireProposal(state)
                assert(
                    this.source === ActionSource.User &&
                        proposal.stage === 'stations' &&
                        proposal.pendingPlayerIds[0] === this.playerId,
                    'The director chooses the stations'
                )
                const reason = rounds.stationChoiceReason(state, this.stationIds)
                assert(!reason, reason ?? 'Invalid stations')
                proposal.stationIds = [...this.stationIds]
                rounds.beginShareholders(state, proposal)
            }
        }

        class HydratedBuyMergerShares
            extends BuyMergerSharesAction.Base
            implements BuyMergerShares
        {
            declare type: 'BuyMergerShares'
            declare playerId: string
            declare shares: number
            declare metadata?: BuyMergerShares['metadata']
            apply(state: State): void {
                const proposal = rounds.requireProposal(state)
                assert(
                    this.source === ActionSource.User &&
                        (proposal.stage === 'shareholders' || proposal.stage === 'open') &&
                        proposal.pendingPlayerIds[0] === this.playerId,
                    'Shares are offered to each player in turn'
                )
                const limit =
                    proposal.stage === 'open'
                        ? Math.min(1, rounds.sharesAvailable(state, this.playerId))
                        : rounds.sharesAvailable(state, this.playerId)
                assert(this.shares <= limit, 'The player cannot buy so many shares')
                proposal.pendingPlayerIds = proposal.pendingPlayerIds.slice(1)
                if (proposal.stage === 'open') {
                    this.metadata = this.shares
                        ? { payment: rounds.buyOpenShare(state, proposal, this.playerId) }
                        : {}
                    rounds.skipOpenBuyers(state, proposal)
                    return
                }
                const entry = proposal.allotments.find(
                    (allotment) => allotment.playerId === this.playerId
                )
                assertExists(entry, 'Shareholders buy first')
                entry.shares += this.shares
                proposal.directorId = rounds.directorAfterPurchase(proposal, this.playerId)
                if (!proposal.pendingPlayerIds.length)
                    this.metadata = rounds.afterShareholders(state, proposal)
            }
        }

        class HydratedDiscardMergerTrain
            extends DiscardMergerTrainAction.Base
            implements DiscardMergerTrain
        {
            declare type: 'DiscardMergerTrain'
            declare playerId: string
            declare trainId: string
            apply(state: State): void {
                const proposal = rounds.requireProposal(state)
                assert(
                    this.source === ActionSource.User &&
                        proposal.stage === 'discard' &&
                        proposal.pendingPlayerIds[0] === this.playerId,
                    'The director discards the trains over the limit'
                )
                assert(
                    trainsOwnedBy(state, { kind: 'company', companyId: proposal.majorId }).some(
                        (train) => train.id === this.trainId
                    ),
                    'The company owns the train'
                )
                releaseTrains(state.trainInventory, [this.trainId], 'market')
                if (rounds.trainsOverLimit(state, proposal.majorId) <= 0)
                    rounds.closeProposal(state, proposal)
            }
        }

        return [
            StartMergerRoundAction.define((action) => new HydratedStartMergerRound(action)),
            EndMergerRoundAction.define((action) => new HydratedEndMergerRound(action)),
            ProposeMergerAction.define((action) => new HydratedProposeMerger(action)),
            PassMergerAction.define((action) => new HydratedPassMerger(action)),
            AnswerMergerAction.define((action) => new HydratedAnswerMerger(action)),
            ChooseMergerStationsAction.define((action) => new HydratedChooseMergerStations(action)),
            BuyMergerSharesAction.define((action) => new HydratedBuyMergerShares(action)),
            DiscardMergerTrainAction.define((action) => new HydratedDiscardMergerTrain(action))
        ]
    }

    /** The merger round's own machine state. */
    handler<S extends State>(continuation: string): EighteenXXStateHandler<S> {
        return MergerRounds.handlerOf<S>(this, continuation)
    }

    private static handlerOf<S extends State>(
        rounds: MergerRounds,
        continuation: string
    ): EighteenXXStateHandler<S> {
        return {
            isValidAction(action: HydratedAction, context: MachineContext<S>): boolean {
                if (isEndMergerRound(action)) return action.source === ActionSource.System
                return (
                    !!action.playerId &&
                    rounds
                        .choices(context.gameState, action.playerId)
                        .some((type) => type === action.type)
                )
            },
            validActionsForPlayer: (playerId: string, context: MachineContext<S>): string[] =>
                rounds.choices(context.gameState, playerId),
            enter(context: MachineContext<S>): void {
                const state = context.gameState
                const round = rounds.requireRound(state)
                if (!round.proposal && !round.minorIds.length) {
                    context.addSystemAction(EndMergerRound, {})
                    return
                }
                const playerId = rounds.playerId(state)
                state.activePlayerIds = playerId ? [playerId] : []
            },
            onAction: (action: HydratedAction): string =>
                isEndMergerRound(action) ? continuation : MergerRoundMachineState
        }
    }

    /** Opens the merger round once an operating round's companies are done. */
    starts<S extends State>(handler: EighteenXXStateHandler<S>): EighteenXXStateHandler<S> {
        return new SystemActionFirstHandler(
            handler,
            StartMergerRound,
            (state) => (this.due(state) ? {} : undefined),
            MergerRoundMachineState
        )
    }

    /** A merger round follows each operating round in the title's merger phases. */
    due(state: State): boolean {
        const set = state.operatingSet
        const latest = state.mergerRound
        return (
            !!set &&
            !set.completed &&
            set.privateIncomePaid &&
            !nextOperatingCompany(state) &&
            this.rules.phaseIds.includes(state.phaseId) &&
            !exportAwaited(state, this.rules.operatingRules) &&
            !state.gameEnding?.finalOperatingRound &&
            !(latest?.set === set.number && latest.round === set.roundNumber)
        )
    }

    private requireRound(state: State): MergerRound {
        const round = state.mergerRound
        assert(round && !round.completed, 'A merger round is under way')
        return round
    }

    private requireProposal(state: State): MergerProposal {
        const proposal = this.requireRound(state).proposal
        assertExists(proposal, 'A proposal is under way')
        return proposal
    }

    private ownerOf(state: State, companyId: string): string {
        const owner = presidentOf(state, companyId)
        assert(owner?.kind === 'player', 'A minor company has a player for its owner')
        return owner.playerId
    }

    private clockwiseFrom(state: State, playerId: string): string[] {
        return turnOrderFrom(state.turnManager.turnOrder, playerId)
    }

    /** The open minors, in operating order: each is offered to its owner in turn. */
    private eligibleMinors(state: State): string[] {
        return this.rules.operatingRules.companyOrder(state).filter((companyId) => {
            const company = getCompany(state, companyId)
            return company.kind === 'minor' && !company.closed
        })
    }

    private unstartedMajors(state: State): string[] {
        return this.rules.majorIds.filter((companyId) => {
            const company = getCompany(state, companyId)
            return !company.started && !company.closed
        })
    }

    private minorSpace(state: State, companyId: string): StockMarketSpace {
        return this.rules.market.companySpace(state.stockMarket, companyId)
    }

    private price(state: State, minorIds: readonly string[]): number {
        const prices = minorIds.map((id) => this.minorSpace(state, id).price)
        return minorIds.length === 1 ? prices[0] : Math.max(...prices) + Math.min(...prices)
    }

    private stationOf(state: State, companyId: string): PlacedStation | undefined {
        return state.stations.find(
            (station): station is PlacedStation =>
                station.companyId === companyId && station.status === 'placed'
        )
    }

    /** One share for each minor merging. */
    private allotments(state: State, minorIds: readonly string[]): ShareAllotment[] {
        const result: ShareAllotment[] = []
        for (const minorId of minorIds) {
            const playerId = this.ownerOf(state, minorId)
            const entry = result.find((allotment) => allotment.playerId === playerId)
            if (entry) entry.shares++
            else result.push({ playerId, shares: 1 })
        }
        return result
    }

    /**
     * The player with the most shares directs, even with only one; a tie goes to the owner of
     * the merging minor earliest in operating order. The designer rules each title's Rules of
     * Play definitive over Grand Trunk's §9.2C (1861 v2.0 §12.3, 1867 RoP §12.3).
     */
    private firstDirector(
        state: State,
        minorIds: readonly string[],
        shares: readonly ShareAllotment[]
    ): string {
        const most = Math.max(...shares.map((entry) => entry.shares))
        const directorId = minorIds
            .map((minorId) => this.ownerOf(state, minorId))
            .find((playerId) =>
                shares.some((entry) => entry.playerId === playerId && entry.shares === most)
            )
        assertExists(directorId, 'A merging minor’s owner holds the most shares')
        return directorId
    }

    /** A buyer who comes to hold more shares than the director takes over (1861 §12.3). */
    private directorAfterPurchase(proposal: MergerProposal, buyerId: string): string {
        const held = (playerId: string) => this.shareTotal(proposal, playerId)
        return held(buyerId) > held(proposal.directorId) ? buyerId : proposal.directorId
    }

    /** Whether some player could come to hold the director's shares. */
    private directorPossible(
        state: State,
        shares: readonly ShareAllotment[],
        price: number
    ): boolean {
        const needed = this.rules.directorShares
        return shares.some(
            (entry) =>
                entry.shares >= needed ||
                finiteCashOwnedBy(state, { kind: 'player', playerId: entry.playerId }) >=
                    (needed - entry.shares) * price
        )
    }

    /** The minors merging in operating order. */
    private operatingOrderOf(state: State, minorIds: readonly string[]): string[] {
        return this.eligibleMinors(state).filter((id) => minorIds.includes(id))
    }

    /** Where the minors' stations leave the major more than it keeps, the director chooses. */
    private stationChoiceNeeded(state: State, minorIds: readonly string[]): boolean {
        const placed = minorIds.flatMap((id) => this.stationOf(state, id) ?? [])
        const hexes = new Set(placed.map((station) => station.position.locationId))
        return placed.length > KeptStations || hexes.size < placed.length
    }

    private defaultStations(state: State, minorIds: readonly string[]): string[] {
        return minorIds.flatMap((id) => this.stationOf(state, id)?.id ?? [])
    }

    private afterConsents(state: State, proposal: MergerProposal): void {
        if (proposal.kind === 'merge' && this.stationChoiceNeeded(state, proposal.minorIds)) {
            proposal.stage = 'stations'
            proposal.pendingPlayerIds = [proposal.directorId]
            return
        }
        proposal.stationIds = this.defaultStations(state, proposal.minorIds)
        this.beginShareholders(state, proposal)
    }

    private beginShareholders(state: State, proposal: MergerProposal): void {
        proposal.stage = 'shareholders'
        proposal.pendingPlayerIds = this.clockwiseFrom(state, proposal.directorId).filter(
            (playerId) =>
                proposal.allotments.some((entry) => entry.playerId === playerId && entry.shares > 0)
        )
    }

    private shareCertificates(state: State, companyId: string, president: boolean) {
        return state.certificates.filter(
            (certificate): certificate is OpenShare =>
                certificate.kind === 'share' &&
                certificate.companyId === companyId &&
                certificate.poolId === treasuryPoolId(companyId) &&
                !!certificate.president === president
        )
    }

    /** Takes treasury shares to a player: the director's certificate where it counts. */
    private takeShares(
        state: State,
        companyId: string,
        playerId: string,
        shares: number,
        president: boolean
    ): void {
        const owner = { kind: 'player' as const, playerId }
        let left = shares
        if (president) {
            const [certificate] = this.shareCertificates(state, companyId, true)
            assertExists(certificate, 'The director’s certificate is in the treasury')
            certificate.owner = owner
            delete certificate.poolId
            left -= certificate.shares
        }
        for (const certificate of this.shareCertificates(state, companyId, false).slice(0, left)) {
            certificate.owner = owner
            delete certificate.poolId
        }
    }

    /**
     * The minors' assets, loans included, go to the major, which takes the chosen stations; the
     * minors close, and the shares are given and paid for.
     */
    private form(state: State, proposal: MergerProposal): MergerFormation {
        const { rules } = this
        const { majorId, directorId } = proposal
        const space = rules.market.space(proposal.marketSpaceId)
        startCompanyAtPar(state, rules.market, majorId, proposal.marketSpaceId)
        const major = getCompany(state, majorId)
        major.floated = true
        major.funded = true
        const assets = proposal.minorIds.map((minorId) =>
            transferCompanyAssets(state, minorId, majorId, { loans: true })
        )
        const majorStations = state.stations.filter(
            (station) => station.companyId === majorId && station.status === 'available'
        )
        const kept = proposal.stationIds ?? []
        kept.forEach((stationId, index) => {
            const target = majorStations[index]
            assertExists(target, 'The major company has a station for each kept')
            replaceStation(state, stationId, target.id)
        })
        const payments: CashPayment[] = this.minorBuyIns(state, proposal).flatMap(
            ({ playerId, bought }) =>
                bought
                    ? [
                          {
                              from: { kind: 'player' as const, playerId },
                              to: { kind: 'company' as const, companyId: majorId },
                              amount: bought * space.price
                          }
                      ]
                    : []
        )
        const closures = proposal.minorIds.map((minorId) => {
            const closure = closeShareCompany(state, minorId, 'market')
            removeStockMarker(state.stockMarket, minorId)
            return closure
        })
        settleCashPayments(state, payments)
        this.takeShares(state, majorId, directorId, this.shareTotal(proposal, directorId), true)
        for (const { playerId, shares } of proposal.allotments)
            if (playerId !== directorId && shares)
                this.takeShares(state, majorId, playerId, shares, false)
        return {
            majorId,
            marketSpaceId: proposal.marketSpaceId,
            directorId,
            payments,
            assets,
            stationIds: kept,
            closures
        }
    }

    private shareTotal(proposal: MergerProposal, playerId: string): number {
        return proposal.allotments.find((entry) => entry.playerId === playerId)?.shares ?? 0
    }

    /** The shares the minors become: the director's for a converted minor, one a merging minor. */
    private baseAllotments(
        state: State,
        kind: MergerProposal['kind'],
        minorIds: readonly string[]
    ): ShareAllotment[] {
        return kind === 'convert'
            ? [{ playerId: this.ownerOf(state, minorIds[0]), shares: this.rules.directorShares }]
            : this.allotments(state, minorIds)
    }

    /** What each player committed to buy, beyond the shares their minors became. */
    private minorBuyIns(state: State, proposal: MergerProposal) {
        const given = this.baseAllotments(state, proposal.kind, proposal.minorIds)
        return proposal.allotments.map((entry) => ({
            playerId: entry.playerId,
            bought:
                entry.shares -
                (given.find((other) => other.playerId === entry.playerId)?.shares ?? 0)
        }))
    }

    private afterShareholders(state: State, proposal: MergerProposal) {
        const round = this.requireRound(state)
        if (!proposal.allotments.some((entry) => entry.shares >= this.rules.directorShares)) {
            delete round.proposal
            return { lapsed: true as const }
        }
        const formation = this.form(state, proposal)
        proposal.directorId = formation.directorId
        proposal.stage = 'open'
        proposal.pendingPlayerIds = this.clockwiseFrom(state, formation.directorId)
        this.skipOpenBuyers(state, proposal)
        return { formation }
    }

    private skipOpenBuyers(state: State, proposal: MergerProposal): void {
        while (
            proposal.pendingPlayerIds.length &&
            this.shareCertificates(state, proposal.majorId, false).length &&
            this.sharesAvailable(state, proposal.pendingPlayerIds[0]) === 0
        )
            proposal.pendingPlayerIds = proposal.pendingPlayerIds.slice(1)
        if (!this.shareCertificates(state, proposal.majorId, false).length)
            proposal.pendingPlayerIds = []
        if (!proposal.pendingPlayerIds.length) this.finishFormation(state, proposal)
    }

    private trainsOverLimit(state: State, companyId: string): number {
        return (
            trainsOwnedBy(state, { kind: 'company', companyId }).length -
            this.rules.trainRules.trainLimit(state, companyId)
        )
    }

    private finishFormation(state: State, proposal: MergerProposal): void {
        if (this.trainsOverLimit(state, proposal.majorId) > 0) {
            proposal.stage = 'discard'
            proposal.pendingPlayerIds = [proposal.directorId]
            return
        }
        this.closeProposal(state, proposal)
    }

    private closeProposal(state: State, proposal: MergerProposal): void {
        const round = this.requireRound(state)
        round.minorIds = round.minorIds.filter((id) => !proposal.minorIds.includes(id))
        delete round.proposal
    }

    private buyOpenShare(state: State, proposal: MergerProposal, playerId: string): CashPayment {
        const price = this.rules.market.space(proposal.marketSpaceId).price
        const [certificate] = this.shareCertificates(state, proposal.majorId, false)
        assertExists(certificate, 'A treasury share remains')
        const payment: CashPayment = {
            from: { kind: 'player', playerId },
            to: { kind: 'company', companyId: proposal.majorId },
            amount: price
        }
        settleCashPayments(state, [payment])
        certificate.owner = { kind: 'player', playerId }
        delete certificate.poolId
        const change = evaluatePresidency(
            state,
            proposal.majorId,
            this.rules.stockRules.presidencyCandidates(state, proposal.majorId)
        ).change
        if (change) applyPresidencyChange(state, change)
        const director = presidentOf(state, proposal.majorId)
        if (director?.kind === 'player') proposal.directorId = director.playerId
        return payment
    }
}

import {
    ActionSource,
    assert,
    assertExists,
    turnOrderFrom,
    type HydratedAction,
    type MachineContext
} from '@tabletop/common'
import {
    AssetTransfer,
    CashPayment,
    CompanyClosure,
    ConnectedTrack,
    RailwayMapState,
    SystemActionFirstHandler,
    applyPresidencyChange,
    closeShareCompany,
    evaluatePresidency,
    finiteCashOwnedBy,
    getCompany,
    nextOperatingCompany,
    releaseTrains,
    removeStockMarker,
    replaceStation,
    settleCashPayments,
    startCompanyAtPar,
    stockCertificateCount,
    systemAction,
    titleAction,
    trainsAwaitingExport,
    transferCompanyAssets,
    trainsOwnedBy,
    treasuryPoolId,
    type OpenShare,
    type PlacedStation,
    type StockMarketSpace
} from '@tabletop/18xx'
import * as Type from 'typebox'
import {
    MajorIds1861,
    MajorShareCount,
    ownershipLimitPercent1861,
    certificateLimit1861,
    isMinor1861
} from './companies.js'
import { Map1861 } from './map.js'
import {
    MergerRoundState1861,
    type MergerProposal1861,
    type MergerRound1861,
    type ShareAllotment1861
} from './mergerState.js'
import { OperatingRules1861, TrainRules1861 } from './operating.js'
import type { HydratedState1861, StateHandler1861 } from './state.js'
import { blockedFor1861 } from './stations.js'
import { StockRules1861 } from './stock.js'
import { Market1861, convertible, majorStartSpaceAtOrBelow } from './stockMarket.js'
import { TileSet1861 } from './tiles.js'
import { MergerRoundPhaseIds } from './trains.js'

const Id = Type.String({ minLength: 1 })
/** Between two and ten minors merge, no more than six of one player's (§12). */
const MergeLimits = { minimum: 2, maximum: 10, perPlayer: 6 } as const
/** A public company's director holds at least two shares (§12.3). */
const DirectorShares = 2

function requireRound(state: HydratedState1861): MergerRound1861 {
    const round = state.mergerRound
    assert(round && !round.completed, 'A merger round is under way')
    return round
}

function requireProposal(state: HydratedState1861): MergerProposal1861 {
    const proposal = requireRound(state).proposal
    assertExists(proposal, 'A proposal is under way')
    return proposal
}

function ownerOf(state: HydratedState1861, companyId: string): string {
    const owner = getCompany(state, companyId).president
    assert(owner?.kind === 'player', 'A minor company has a player for its owner')
    return owner.playerId
}

/** The player whose decision the round waits for. */
export function mergerRoundPlayerId(state: HydratedState1861): string | undefined {
    const round = state.mergerRound
    if (!round || round.completed) return undefined
    if (round.proposal) return round.proposal.pendingPlayerIds[0]
    const [minorId] = round.minorIds
    return minorId ? ownerOf(state, minorId) : undefined
}

function clockwiseFrom(state: HydratedState1861, playerId: string): string[] {
    return turnOrderFrom(state.turnManager.turnOrder, playerId)
}

/** The open minors, in operating order: each is offered to its owner in turn (§12.1). */
function eligibleMinors(state: HydratedState1861): string[] {
    return OperatingRules1861.companyOrder(state).filter(
        (companyId) => isMinor1861(companyId) && !getCompany(state, companyId).closed
    )
}

/** A merger round follows each operating round in phases 3 to 7 (§12). */
function mergerRoundDue(state: HydratedState1861): boolean {
    const set = state.operatingSet
    const latest = state.mergerRound
    return (
        !!set &&
        !set.completed &&
        set.privateIncomePaid &&
        !nextOperatingCompany(state) &&
        MergerRoundPhaseIds.includes(state.phaseId) &&
        !trainsAwaitingExport(state, OperatingRules1861).length &&
        !state.gameEnding?.finalOperatingRound &&
        !(latest?.set === set.number && latest.round === set.roundNumber)
    )
}

export type MergerRequest1861 = {
    kind: 'convert' | 'merge'
    minorId: string
    minorIds: readonly string[]
    majorId: string
}

function unstartedMajors(state: HydratedState1861): string[] {
    return MajorIds1861.filter((companyId) => {
        const company = getCompany(state, companyId)
        return !company.started && !company.closed
    })
}

function minorSpace(state: HydratedState1861, companyId: string): StockMarketSpace {
    return Market1861.companySpace(state.stockMarket, companyId)
}

/**
 * A conversion starts the public company at the minor's price; a merger at the highest and lowest
 * merging prices added, at most R200; each rounded down to a start space (§12.2, §12.3).
 */
export function mergerStartSpace(state: HydratedState1861, minorIds: readonly string[]) {
    return majorStartSpaceAtOrBelow(mergerPrice(state, minorIds))
}

function mergerPrice(state: HydratedState1861, minorIds: readonly string[]): number {
    const prices = minorIds.map((id) => minorSpace(state, id).price)
    return minorIds.length === 1 ? prices[0] : Math.max(...prices) + Math.min(...prices)
}

/** The designer rules a merger worth less than R100 illegal. */
const MinimumMergerPrice = 100

function stationOf(state: HydratedState1861, companyId: string): PlacedStation | undefined {
    return state.stations.find(
        (station): station is PlacedStation =>
            station.companyId === companyId && station.status === 'placed'
    )
}

/**
 * Whether one of the minors traces routes to all the others, the merging companies' stations
 * not blocking; stations in the same hex must still be joined by track (§12.3).
 */
export function mergersConnected(state: HydratedState1861, minorIds: readonly string[]): boolean {
    const stations = minorIds.map((id) => stationOf(state, id))
    if (stations.some((station) => !station)) return false
    const placed = stations.flatMap((station) => (station ? [station] : []))
    const mapState = new RailwayMapState(Map1861, TileSet1861, state.tileInventory)
    return placed.some((hub) => {
        const track = new ConnectedTrack(mapState, [hub.position], (locationId, node) =>
            blockedFor1861(state, minorIds, locationId, node)
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

/** One share for each minor merging (§12.3). */
function allotments(state: HydratedState1861, minorIds: readonly string[]): ShareAllotment1861[] {
    const result: ShareAllotment1861[] = []
    for (const minorId of minorIds) {
        const playerId = ownerOf(state, minorId)
        const entry = result.find((allotment) => allotment.playerId === playerId)
        if (entry) entry.shares++
        else result.push({ playerId, shares: 1 })
    }
    return result
}

/**
 * The minors are exchanged for shares from the active minor's owner clockwise; the first player
 * to hold two shares is director. Until anyone does, the active minor's owner decides (GTG §9.2C).
 */
function firstDirector(
    state: HydratedState1861,
    activeOwnerId: string,
    shares: readonly ShareAllotment1861[]
): string {
    return (
        clockwiseFrom(state, activeOwnerId).find(
            (playerId) =>
                (shares.find((entry) => entry.playerId === playerId)?.shares ?? 0) >= DirectorShares
        ) ?? activeOwnerId
    )
}

/**
 * After a purchase the buyer directs if no one yet holds two shares and they do, or if they now
 * hold more than the director (GTG §3.3, §9.2C).
 */
function directorAfterPurchase(proposal: MergerProposal1861, buyerId: string): string {
    const held = (playerId: string) => shareTotal(proposal, playerId)
    const director = proposal.directorId
    const bought = held(buyerId)
    if (held(director) < DirectorShares) return bought >= DirectorShares ? buyerId : director
    return bought > held(director) ? buyerId : director
}

/** Whether some player could come to hold the director's two shares (§12.4). */
function directorPossible(
    state: HydratedState1861,
    shares: readonly ShareAllotment1861[],
    price: number
): boolean {
    return shares.some(
        (entry) =>
            entry.shares >= DirectorShares ||
            finiteCashOwnedBy(state, { kind: 'player', playerId: entry.playerId }) >=
                (DirectorShares - entry.shares) * price
    )
}

export function mergerReason(
    state: HydratedState1861,
    playerId: string,
    request: MergerRequest1861
): string | undefined {
    const round = state.mergerRound
    if (!round || round.completed || round.proposal || round.minorIds[0] !== request.minorId)
        return 'This minor is not deciding.'
    if (ownerOf(state, request.minorId) !== playerId) return 'Only the minor’s owner decides.'
    if (!unstartedMajors(state).includes(request.majorId))
        return 'Choose a public company that has not been started.'
    if (request.kind === 'convert') {
        if (request.minorIds.length !== 1 || request.minorIds[0] !== request.minorId)
            return 'A conversion is of the deciding minor alone.'
        if (!convertible(minorSpace(state, request.minorId)))
            return 'A minor converts only from the seventh column, R100 to R165.'
        return undefined
    }
    const { minorIds } = request
    if (!minorIds.includes(request.minorId)) return 'The merger includes the deciding minor.'
    if (new Set(minorIds).size !== minorIds.length) return 'Name each minor once.'
    if (minorIds.length < MergeLimits.minimum || minorIds.length > MergeLimits.maximum)
        return 'Between two and ten minors merge.'
    if (
        minorIds.some(
            (id) =>
                !isMinor1861(id) || getCompany(state, id).closed || !getCompany(state, id).started
        )
    )
        return 'Only open minors merge.'
    const owners = minorIds.map((id) => ownerOf(state, id))
    if (
        owners.some(
            (owner) => owners.filter((other) => other === owner).length > MergeLimits.perPlayer
        )
    )
        return 'No more than six of one player’s minors merge.'
    if (!mergersConnected(state, minorIds)) return 'The minors must be connected by track.'
    if (mergerPrice(state, minorIds) < MinimumMergerPrice)
        return 'A merger starts its public company at R100 at least.'
    const shares = allotments(state, minorIds)
    if (!directorPossible(state, shares, mergerStartSpace(state, minorIds).price))
        return 'No player could hold the director’s two shares.'
    return undefined
}

/** What a proposal would make: its price, its director-to-be and each player's shares (§12). */
export type MergerPreview1861 = {
    marketSpaceId: string
    price: number
    directorId: string
    allotments: readonly ShareAllotment1861[]
}

export function mergerPreview1861(
    state: HydratedState1861,
    request: Pick<MergerRequest1861, 'kind' | 'minorId' | 'minorIds'>
): MergerPreview1861 {
    const minorIds = operatingOrderOf(state, request.minorIds)
    const shares = baseAllotments(state, request.kind, minorIds)
    const space = mergerStartSpace(state, minorIds)
    return {
        marketSpaceId: space.id,
        price: space.price,
        directorId: firstDirector(state, ownerOf(state, request.minorId), shares),
        allotments: shares
    }
}

/** The majors a proposal may start, and the minors the deciding minor could merge with. */
export function mergerChoices1861(state: HydratedState1861):
    | {
          minorId: string
          majorIds: string[]
          convertible: boolean
          partnerIds: string[]
      }
    | undefined {
    const round = state.mergerRound
    const minorId = round?.minorIds[0]
    if (!round || round.completed || round.proposal || !minorId) return undefined
    return {
        minorId,
        majorIds: unstartedMajors(state),
        convertible: convertible(minorSpace(state, minorId)),
        partnerIds: eligibleMinors(state).filter((id) => id !== minorId)
    }
}

/** The minors merging in operating order. */
function operatingOrderOf(state: HydratedState1861, minorIds: readonly string[]): string[] {
    return eligibleMinors(state).filter((id) => minorIds.includes(id))
}

/** Where the minors' stations leave the public company more than its two, the director chooses (§12.3). */
function stationChoiceNeeded(state: HydratedState1861, minorIds: readonly string[]): boolean {
    const placed = minorIds.flatMap((id) => stationOf(state, id) ?? [])
    const hexes = new Set(placed.map((station) => station.position.locationId))
    return placed.length > DirectorShares || hexes.size < placed.length
}

function defaultStations(state: HydratedState1861, minorIds: readonly string[]): string[] {
    return minorIds.flatMap((id) => stationOf(state, id)?.id ?? [])
}

function proposalAfterConsents(state: HydratedState1861, proposal: MergerProposal1861): void {
    if (proposal.kind === 'merge' && stationChoiceNeeded(state, proposal.minorIds)) {
        proposal.stage = 'stations'
        proposal.pendingPlayerIds = [proposal.directorId]
        return
    }
    proposal.stationIds = defaultStations(state, proposal.minorIds)
    beginShareholders(state, proposal)
}

function beginShareholders(state: HydratedState1861, proposal: MergerProposal1861): void {
    proposal.stage = 'shareholders'
    proposal.pendingPlayerIds = clockwiseFrom(state, ownerOf(state, proposal.minorId)).filter(
        (playerId) =>
            proposal.allotments.some((entry) => entry.playerId === playerId && entry.shares > 0)
    )
}

const Formation = Type.Object(
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
export type Formation1861 = Type.Static<typeof Formation>

function shareCertificates(state: HydratedState1861, companyId: string, president: boolean) {
    return state.certificates.filter(
        (certificate): certificate is OpenShare =>
            certificate.kind === 'share' &&
            certificate.companyId === companyId &&
            certificate.poolId === treasuryPoolId(companyId) &&
            !!certificate.president === president
    )
}

/** Takes treasury shares to a player: the director's certificate where it counts. */
function takeShares(
    state: HydratedState1861,
    companyId: string,
    playerId: string,
    shares: number,
    president: boolean
): void {
    const owner = { kind: 'player' as const, playerId }
    let left = shares
    if (president) {
        const [certificate] = shareCertificates(state, companyId, true)
        assertExists(certificate, 'The director’s certificate is in the treasury')
        certificate.owner = owner
        delete certificate.poolId
        left -= certificate.shares
    }
    for (const certificate of shareCertificates(state, companyId, false).slice(0, left)) {
        certificate.owner = owner
        delete certificate.poolId
    }
}

/**
 * The minors' assets, loans included, go to the public company, which takes two of their
 * stations; the minors close, and the shares are given and paid for (§12.4).
 */
function form(state: HydratedState1861, proposal: MergerProposal1861): Formation1861 {
    const { majorId } = proposal
    const space = Market1861.space(proposal.marketSpaceId)
    const { directorId } = proposal
    startCompanyAtPar(state, Market1861, majorId, proposal.marketSpaceId, {
        kind: 'player',
        playerId: directorId
    })
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
        assertExists(target, 'The public company has a station for each kept')
        replaceStation(state, stationId, target.id)
    })
    const original = minorBuyIns(state, proposal)
    const payments: CashPayment[] = original.flatMap(({ playerId, bought }) =>
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
    takeShares(state, majorId, directorId, shareTotal(proposal, directorId), true)
    for (const { playerId, shares } of proposal.allotments)
        if (playerId !== directorId && shares) takeShares(state, majorId, playerId, shares, false)
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

function shareTotal(proposal: MergerProposal1861, playerId: string): number {
    return proposal.allotments.find((entry) => entry.playerId === playerId)?.shares ?? 0
}

/** The shares the minors become: two for a converted minor's owner, one a minor merging (§12). */
function baseAllotments(
    state: HydratedState1861,
    kind: MergerProposal1861['kind'],
    minorIds: readonly string[]
): ShareAllotment1861[] {
    return kind === 'convert'
        ? [{ playerId: ownerOf(state, minorIds[0]), shares: DirectorShares }]
        : allotments(state, minorIds)
}

/** What each player committed to buy, beyond the shares their minors became. */
function minorBuyIns(state: HydratedState1861, proposal: MergerProposal1861) {
    const given = baseAllotments(state, proposal.kind, proposal.minorIds)
    return proposal.allotments.map((entry) => ({
        playerId: entry.playerId,
        bought:
            entry.shares - (given.find((other) => other.playerId === entry.playerId)?.shares ?? 0)
    }))
}

/** How many more shares the player may buy: 60%, the certificate limit and cash (§12.4). */
export function sharesAvailable(state: HydratedState1861, playerId: string): number {
    const proposal = requireProposal(state)
    const price = Market1861.space(proposal.marketSpaceId).price
    const player = { kind: 'player' as const, playerId }
    const cash = Math.floor(finiteCashOwnedBy(state, player) / price)
    const treasury =
        proposal.stage === 'open'
            ? shareCertificates(state, proposal.majorId, false).length
            : MajorShareCount - proposal.allotments.reduce((sum, entry) => sum + entry.shares, 0)
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
            : shareTotal(proposal, playerId)
    // Before the company forms, the player's minors become its shares: the director's two on
    // one certificate, everyone else's one apiece (§9, §12.4).
    const formedCertificates =
        held - (playerId === proposal.directorId && held >= DirectorShares ? 1 : 0)
    const certificates =
        stockCertificateCount(state, player, StockRules1861) -
        (proposal.stage === 'open'
            ? 0
            : proposal.minorIds.filter((id) => ownerOf(state, id) === playerId).length -
              formedCertificates)
    const room = certificateLimit1861(state.players.length) - certificates
    return Math.max(
        0,
        Math.min(
            cash,
            treasury,
            (MajorShareCount * ownershipLimitPercent1861(state.players.length)) / 100 - held,
            room
        )
    )
}

function afterShareholders(state: HydratedState1861, proposal: MergerProposal1861) {
    const round = requireRound(state)
    if (!proposal.allotments.some((entry) => entry.shares >= DirectorShares)) {
        delete round.proposal
        return { lapsed: true as const }
    }
    const formation = form(state, proposal)
    proposal.directorId = formation.directorId
    proposal.stage = 'open'
    proposal.pendingPlayerIds = clockwiseFrom(state, formation.directorId)
    skipOpenBuyers(state, proposal)
    return { formation }
}

function skipOpenBuyers(state: HydratedState1861, proposal: MergerProposal1861): void {
    while (
        proposal.pendingPlayerIds.length &&
        shareCertificates(state, proposal.majorId, false).length &&
        sharesAvailable(state, proposal.pendingPlayerIds[0]) === 0
    )
        proposal.pendingPlayerIds = proposal.pendingPlayerIds.slice(1)
    if (!shareCertificates(state, proposal.majorId, false).length) proposal.pendingPlayerIds = []
    if (!proposal.pendingPlayerIds.length) finishFormation(state, proposal)
}

function trainsOverLimit(state: HydratedState1861, companyId: string): number {
    return (
        trainsOwnedBy(state, { kind: 'company', companyId }).length -
        TrainRules1861.trainLimit(state, companyId)
    )
}

function finishFormation(state: HydratedState1861, proposal: MergerProposal1861): void {
    if (trainsOverLimit(state, proposal.majorId) > 0) {
        proposal.stage = 'discard'
        proposal.pendingPlayerIds = [proposal.directorId]
        return
    }
    closeProposal(state, proposal)
}

function closeProposal(state: HydratedState1861, proposal: MergerProposal1861): void {
    const round = requireRound(state)
    round.minorIds = round.minorIds.filter((id) => !proposal.minorIds.includes(id))
    delete round.proposal
}

function buyOpenShare(state: HydratedState1861, proposal: MergerProposal1861, playerId: string) {
    const price = Market1861.space(proposal.marketSpaceId).price
    const [certificate] = shareCertificates(state, proposal.majorId, false)
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
        StockRules1861.presidencyCandidates(state, proposal.majorId)
    ).change
    if (change) applyPresidencyChange(state, change)
    const director = getCompany(state, proposal.majorId).president
    if (director?.kind === 'player') proposal.directorId = director.playerId
    return payment
}

const StartMergerRoundAction = systemAction('StartMergerRound', {
    metadata: Type.Optional(
        Type.Object({ minorIds: Type.Array(Id) }, { additionalProperties: false })
    )
})
export const StartMergerRound = StartMergerRoundAction.schema
export const isStartMergerRound = StartMergerRoundAction.is

class HydratedStartMergerRound extends StartMergerRoundAction.Base {
    declare type: 'StartMergerRound'
    declare metadata?: Type.Static<typeof StartMergerRound>['metadata']
    apply(state: HydratedState1861): void {
        assert(
            this.source === ActionSource.System && mergerRoundDue(state),
            'A merger round is due'
        )
        const set = state.operatingSet
        assertExists(set, 'A merger round follows an operating round')
        const minorIds = eligibleMinors(state)
        state.mergerRound = { set: set.number, round: set.roundNumber, minorIds, completed: false }
        state.activePlayerIds = []
        this.metadata = { minorIds }
    }
}

const EndMergerRoundAction = systemAction('EndMergerRound', {})
export const EndMergerRound = EndMergerRoundAction.schema
export const isEndMergerRound = EndMergerRoundAction.is

class HydratedEndMergerRound extends EndMergerRoundAction.Base {
    declare type: 'EndMergerRound'
    apply(state: HydratedState1861): void {
        const round = requireRound(state)
        assert(
            this.source === ActionSource.System && !round.minorIds.length && !round.proposal,
            'The merger round ends once every minor has decided'
        )
        round.completed = true
        state.activePlayerIds = []
    }
}

const ProposeMergerAction = titleAction('ProposeMerger', {
    kind: Type.Union([Type.Literal('convert'), Type.Literal('merge')]),
    minorId: Id,
    minorIds: Type.Array(Id, { minItems: 1 }),
    majorId: Id,
    metadata: Type.Optional(
        Type.Object(
            { formation: Type.Optional(Formation), lapsed: Type.Optional(Type.Literal(true)) },
            { additionalProperties: false }
        )
    )
})
export const ProposeMerger = ProposeMergerAction.schema
export type ProposeMerger = Type.Static<typeof ProposeMerger>
export const isProposeMerger = ProposeMergerAction.is

class HydratedProposeMerger extends ProposeMergerAction.Base implements ProposeMerger {
    declare type: 'ProposeMerger'
    declare playerId: string
    declare kind: 'convert' | 'merge'
    declare minorId: string
    declare minorIds: string[]
    declare majorId: string
    declare metadata?: ProposeMerger['metadata']
    apply(state: HydratedState1861): void {
        assert(this.source === ActionSource.User, 'Players propose mergers')
        const reason = mergerReason(state, this.playerId, this)
        assert(!reason, reason ?? 'Invalid merger')
        const round = requireRound(state)
        const minorIds = operatingOrderOf(state, this.minorIds)
        const shares = baseAllotments(state, this.kind, minorIds)
        const directorId = firstDirector(state, this.playerId, shares)
        const proposal: MergerProposal1861 = {
            kind: this.kind,
            minorId: this.minorId,
            minorIds,
            majorId: this.majorId,
            marketSpaceId: mergerStartSpace(state, minorIds).id,
            stage: 'consent',
            directorId,
            pendingPlayerIds: clockwiseFrom(state, this.playerId).filter(
                (playerId) =>
                    playerId !== this.playerId &&
                    minorIds.some((minorId) => ownerOf(state, minorId) === playerId)
            ),
            allotments: shares
        }
        round.proposal = proposal
        if (!proposal.pendingPlayerIds.length) proposalAfterConsents(state, proposal)
    }
}

const PassMergerAction = titleAction('PassMerger', { minorId: Id })
export const PassMerger = PassMergerAction.schema
export type PassMerger = Type.Static<typeof PassMerger>
export const isPassMerger = PassMergerAction.is

class HydratedPassMerger extends PassMergerAction.Base implements PassMerger {
    declare type: 'PassMerger'
    declare playerId: string
    declare minorId: string
    apply(state: HydratedState1861): void {
        const round = requireRound(state)
        assert(
            this.source === ActionSource.User &&
                !round.proposal &&
                round.minorIds[0] === this.minorId &&
                ownerOf(state, this.minorId) === this.playerId,
            'The minor’s owner passes'
        )
        round.minorIds = round.minorIds.slice(1)
    }
}

const AnswerMergerAction = titleAction('AnswerMerger', { accept: Type.Boolean() })
export const AnswerMerger = AnswerMergerAction.schema
export type AnswerMerger = Type.Static<typeof AnswerMerger>
export const isAnswerMerger = AnswerMergerAction.is

class HydratedAnswerMerger extends AnswerMergerAction.Base implements AnswerMerger {
    declare type: 'AnswerMerger'
    declare playerId: string
    declare accept: boolean
    apply(state: HydratedState1861): void {
        const proposal = requireProposal(state)
        assert(
            this.source === ActionSource.User &&
                proposal.stage === 'consent' &&
                proposal.pendingPlayerIds[0] === this.playerId,
            'The minors’ owners answer the proposal in turn'
        )
        if (!this.accept) {
            delete requireRound(state).proposal
            return
        }
        proposal.pendingPlayerIds = proposal.pendingPlayerIds.slice(1)
        if (!proposal.pendingPlayerIds.length) proposalAfterConsents(state, proposal)
    }
}

const ChooseMergerStationsAction = titleAction('ChooseMergerStations', {
    stationIds: Type.Array(Id, { minItems: 1, maxItems: DirectorShares })
})
export const ChooseMergerStations = ChooseMergerStationsAction.schema
export type ChooseMergerStations = Type.Static<typeof ChooseMergerStations>
export const isChooseMergerStations = ChooseMergerStationsAction.is

/** The stations the director may keep: two of the minors', in different hexes (§12.3). */
export function stationChoiceReason(
    state: HydratedState1861,
    stationIds: readonly string[]
): string | undefined {
    const proposal = requireProposal(state)
    const placed = proposal.minorIds.flatMap((id) => stationOf(state, id) ?? [])
    const chosen = stationIds.map((id) => placed.find((station) => station.id === id))
    if (chosen.some((station) => !station)) return 'Keep stations of the merging minors.'
    const hexes = new Set(chosen.map((station) => station?.position.locationId))
    if (hexes.size !== chosen.length) return 'The kept stations are in different hexes.'
    const available = new Set(placed.map((station) => station.position.locationId)).size
    if (chosen.length !== Math.min(DirectorShares, available)) return 'Keep two stations.'
    return undefined
}

class HydratedChooseMergerStations
    extends ChooseMergerStationsAction.Base
    implements ChooseMergerStations
{
    declare type: 'ChooseMergerStations'
    declare playerId: string
    declare stationIds: string[]
    apply(state: HydratedState1861): void {
        const proposal = requireProposal(state)
        assert(
            this.source === ActionSource.User &&
                proposal.stage === 'stations' &&
                proposal.pendingPlayerIds[0] === this.playerId,
            'The director chooses the stations'
        )
        const reason = stationChoiceReason(state, this.stationIds)
        assert(!reason, reason ?? 'Invalid stations')
        proposal.stationIds = [...this.stationIds]
        beginShareholders(state, proposal)
    }
}

const BuyMergerSharesAction = titleAction('BuyMergerShares', {
    shares: Type.Integer({ minimum: 0, maximum: MajorShareCount }),
    metadata: Type.Optional(
        Type.Object(
            {
                payment: Type.Optional(CashPayment),
                formation: Type.Optional(Formation),
                lapsed: Type.Optional(Type.Literal(true))
            },
            { additionalProperties: false }
        )
    )
})
export const BuyMergerShares = BuyMergerSharesAction.schema
export type BuyMergerShares = Type.Static<typeof BuyMergerShares>
export const isBuyMergerShares = BuyMergerSharesAction.is

class HydratedBuyMergerShares extends BuyMergerSharesAction.Base implements BuyMergerShares {
    declare type: 'BuyMergerShares'
    declare playerId: string
    declare shares: number
    declare metadata?: BuyMergerShares['metadata']
    apply(state: HydratedState1861): void {
        const proposal = requireProposal(state)
        assert(
            this.source === ActionSource.User &&
                (proposal.stage === 'shareholders' || proposal.stage === 'open') &&
                proposal.pendingPlayerIds[0] === this.playerId,
            'Shares are offered to each player in turn'
        )
        const limit =
            proposal.stage === 'open'
                ? Math.min(1, sharesAvailable(state, this.playerId))
                : sharesAvailable(state, this.playerId)
        assert(this.shares <= limit, 'The player cannot buy so many shares')
        proposal.pendingPlayerIds = proposal.pendingPlayerIds.slice(1)
        if (proposal.stage === 'open') {
            this.metadata = this.shares
                ? { payment: buyOpenShare(state, proposal, this.playerId) }
                : {}
            skipOpenBuyers(state, proposal)
            return
        }
        const entry = proposal.allotments.find((allotment) => allotment.playerId === this.playerId)
        assertExists(entry, 'Shareholders buy first')
        entry.shares += this.shares
        proposal.directorId = directorAfterPurchase(proposal, this.playerId)
        if (!proposal.pendingPlayerIds.length) this.metadata = afterShareholders(state, proposal)
    }
}

const DiscardMergerTrainAction = titleAction('DiscardMergerTrain', { trainId: Id })
export const DiscardMergerTrain = DiscardMergerTrainAction.schema
export type DiscardMergerTrain = Type.Static<typeof DiscardMergerTrain>
export const isDiscardMergerTrain = DiscardMergerTrainAction.is

class HydratedDiscardMergerTrain
    extends DiscardMergerTrainAction.Base
    implements DiscardMergerTrain
{
    declare type: 'DiscardMergerTrain'
    declare playerId: string
    declare trainId: string
    apply(state: HydratedState1861): void {
        const proposal = requireProposal(state)
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
        if (trainsOverLimit(state, proposal.majorId) <= 0) closeProposal(state, proposal)
    }
}

export const MergerActions1861 = [
    StartMergerRoundAction.define((action) => new HydratedStartMergerRound(action)),
    EndMergerRoundAction.define((action) => new HydratedEndMergerRound(action)),
    ProposeMergerAction.define((action) => new HydratedProposeMerger(action)),
    PassMergerAction.define((action) => new HydratedPassMerger(action)),
    AnswerMergerAction.define((action) => new HydratedAnswerMerger(action)),
    ChooseMergerStationsAction.define((action) => new HydratedChooseMergerStations(action)),
    BuyMergerSharesAction.define((action) => new HydratedBuyMergerShares(action)),
    DiscardMergerTrainAction.define((action) => new HydratedDiscardMergerTrain(action))
]

/** The actions the player may take in the merger round now. */
export function mergerChoices(state: HydratedState1861, playerId: string): string[] {
    if (mergerRoundPlayerId(state) !== playerId) return []
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

export class MergerRoundHandler implements StateHandler1861 {
    isValidAction(action: HydratedAction, context: MachineContext<HydratedState1861>): boolean {
        if (isEndMergerRound(action)) return action.source === ActionSource.System
        return (
            !!action.playerId &&
            mergerChoices(context.gameState, action.playerId).includes(action.type)
        )
    }
    validActionsForPlayer(playerId: string, context: MachineContext<HydratedState1861>): string[] {
        return mergerChoices(context.gameState, playerId)
    }
    enter(context: MachineContext<HydratedState1861>): void {
        const state = context.gameState
        const round = requireRound(state)
        if (!round.proposal && !round.minorIds.length) {
            context.addSystemAction(EndMergerRound, {})
            return
        }
        const playerId = mergerRoundPlayerId(state)
        state.activePlayerIds = playerId ? [playerId] : []
    }
    onAction(action: HydratedAction, _context: MachineContext<HydratedState1861>): string {
        return isEndMergerRound(action) ? 'OperatingSet' : MergerRoundState1861
    }
}

/** Opens the merger round once an operating round's companies are done. */
export function startsMergerRounds(handler: StateHandler1861): StateHandler1861 {
    return new SystemActionFirstHandler(
        handler,
        StartMergerRound,
        (state) => (mergerRoundDue(state) ? {} : undefined),
        MergerRoundState1861
    )
}

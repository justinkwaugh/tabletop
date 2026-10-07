import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    PlayerAction,
    assert,
    assertExists,
    type HydratedAction,
    type MachineContext
} from '@tabletop/common'
import {
    CashPayment,
    ShareSaleDetails,
    StationTransfer,
    SystemActionFirstHandler,
    TrackNetwork,
    applyShareSale,
    companyMarketSpace,
    controllingOwner,
    evaluateShareDisposal,
    finiteCashOwnedBy,
    getCompany,
    moveCompanyStations,
    reorderPendingOperatingCompanies,
    removeStockMarker,
    sameOwner,
    settleCashPayments,
    sharesOwned,
    transferCompanyAssets,
    trainsCountingForLimit,
    unownedTrain,
    type PlacedStation
} from '@tabletop/18xx'
import { coalFieldsOpen } from './coalAccess.js'
import { EighteenThirtyTwoOperatingRules } from './roundRules.js'
import type {
    EighteenThirtyTwoState,
    EighteenThirtyTwoStateHandler,
    HydratedEighteenThirtyTwoState
} from './state.js'
import { EighteenThirtyTwoShareTrading, EighteenThirtyTwoStockRules } from './stockRules.js'
import { SystemFormation, formSystem, isSystem, nextSystemId, systemPresident } from './systems.js'
import { eighteenThirtyTwoMapState } from './tileState.js'
import { MergerKind, MergingState, type MergerProposal } from './titleState.js'
import { EighteenThirtyTwoPhases, EighteenThirtyTwoTrainRules } from './trains.js'

const Id = Type.String({ minLength: 1 })

/** Mergers begin with the first 4-train and end after the phase following the first 6-train. */
function mergersAllowed(state: EighteenThirtyTwoState): boolean {
    return EighteenThirtyTwoPhases.isAtLeast(state.phaseId, '4') && !state.mergersEnded
}

function presidentId(state: EighteenThirtyTwoState, companyId: string): string | undefined {
    return controllingOwner(state, companyId)?.playerId
}

// A System begins with its components' takeover (§11.5).
function involvedIn(state: EighteenThirtyTwoState, companyId: string, kind: MergerKind) {
    const ids = [companyId, ...(state.systems[companyId] ?? [])]
    return state.mergers.some(
        (merger) => merger.kind === kind && merger.companyIds.some((id) => ids.includes(id))
    )
}

function placedStations(state: EighteenThirtyTwoState, companyId: string): PlacedStation[] {
    return state.stations.flatMap((station) =>
        station.status === 'placed' && station.companyId === companyId ? [station] : []
    )
}

/**
 * Whether two companies can reach each other: a legal run of unlimited length from one to the
 * other's station, or stations sharing a city (§11.5).
 */
export function companiesConnect(state: EighteenThirtyTwoState, first: string, second: string) {
    const firstStations = placedStations(state, first)
    const secondStations = placedStations(state, second)
    const sameCity = (a: PlacedStation, b: PlacedStation) =>
        a.position.locationId === b.position.locationId && a.position.nodeId === b.position.nodeId
    if (firstStations.some((a) => secondStations.some((b) => sameCity(a, b)))) return true
    const mapState = eighteenThirtyTwoMapState(state)
    const reaches = (from: string, targets: readonly PlacedStation[]) => {
        const network = new TrackNetwork(
            mapState,
            state,
            from,
            undefined,
            undefined,
            (locationId, nodeId) => !coalFieldsOpen(state, from, { locationId, nodeId })
        )
        return targets.some((target) =>
            network.reaches(target.position.locationId, {
                kind: 'node',
                nodeId: target.position.nodeId
            })
        )
    }
    return reaches(first, secondStations) || reaches(second, firstStations)
}

/**
 * What the buyer pays for the other company's shares: players' and open-market shares at the
 * market price, unsold shares at par; the company's own redeemed shares are its assets (§11.7).
 */
export function takeoverPayments(
    state: EighteenThirtyTwoState,
    buyerId: string,
    targetId: string
): CashPayment[] {
    const target = getCompany(state, targetId)
    const price = companyMarketSpace(state.stockMarket, targetId).price
    const payments: CashPayment[] = []
    for (const certificate of state.certificates) {
        if (
            certificate.retired ||
            certificate.kind !== 'share' ||
            certificate.companyId !== targetId ||
            certificate.owner.kind === 'company'
        )
            continue
        const unsold = certificate.poolId === 'initial-offering'
        assertExists(target.parPrice, 'A started company has a par price')
        const amount = (unsold ? target.parPrice : price) * certificate.shares
        const to =
            certificate.owner.kind === 'player' ? certificate.owner : { kind: 'bank' as const }
        const previous = payments.find((payment) => sameOwner(payment.to, to))
        if (previous) previous.amount += amount
        else payments.push({ from: { kind: 'company', companyId: buyerId }, to, amount })
    }
    return payments
}

function takeoverCost(state: EighteenThirtyTwoState, buyerId: string, targetId: string) {
    return takeoverPayments(state, buyerId, targetId).reduce(
        (total, payment) => total + payment.amount,
        0
    )
}

/** What the buyer's treasury and its president's cash leave to raise by selling shares. */
export function takeoverShortfall(
    state: EighteenThirtyTwoState,
    buyerId: string,
    targetId: string,
    playerId: string
): number {
    return Math.max(
        0,
        takeoverCost(state, buyerId, targetId) -
            finiteCashOwnedBy(state, { kind: 'company', companyId: buyerId }) -
            finiteCashOwnedBy(state, { kind: 'player', playerId })
    )
}

/**
 * The sales a president may make to fund a takeover: shares of any company but the one bought,
 * within the open market's limit (§11.7).
 */
export function takeoverSales(
    state: EighteenThirtyTwoState,
    playerId: string,
    targetId: string
): ShareSaleDetails[] {
    const seller = { kind: 'player' as const, playerId }
    return state.companies.flatMap((company) => {
        if (company.id === targetId || company.kind === 'private') return []
        const results: ShareSaleDetails[] = []
        for (let shares = 1; shares <= sharesOwned(state, company.id, seller); shares++) {
            const result = evaluateShareDisposal(
                state,
                seller,
                [{ companyId: company.id, shares }],
                {
                    ...EighteenThirtyTwoStockRules,
                    saleTerms: EighteenThirtyTwoShareTrading.emergencySaleTerms
                }
            )
            if (result.details) results.push(result.details)
        }
        return results
    })
}

// A president who cannot raise the price may not take the company over (§11.7).
function fundable(state: EighteenThirtyTwoState, buyerId: string, targetId: string) {
    const playerId = presidentId(state, buyerId)
    if (!playerId) return false
    const shortfall = takeoverShortfall(state, buyerId, targetId, playerId)
    if (!shortfall) return true
    const best = new Map<string, number>()
    for (const sale of takeoverSales(state, playerId, targetId)) {
        const companyId = sale.sales[0].companyId
        best.set(companyId, Math.max(best.get(companyId) ?? 0, sale.proceeds))
    }
    return [...best.values()].reduce((total, proceeds) => total + proceeds, 0) >= shortfall
}

function mergeable(state: EighteenThirtyTwoState, companyId: string) {
    const company = getCompany(state, companyId)
    return (
        company.kind === 'major' &&
        !company.closed &&
        !!company.operated &&
        !!presidentId(state, companyId)
    )
}

export type MergerOption = Omit<MergerProposal, 'proposerPlayerId'>

/**
 * The mergers a player may propose between a company they preside and a partner that has
 * operated and that one of them can reach; in the last phase both must be theirs (§11.1,
 * §11.5).
 */
export function mergerOptions(state: EighteenThirtyTwoState, playerId: string): MergerOption[] {
    const phase = state.mergerPhase
    if (!phase || !mergersAllowed(state)) return []
    const options: MergerOption[] = []
    for (const company of state.companies) {
        if (!mergeable(state, company.id) || presidentId(state, company.id) !== playerId) continue
        for (const partner of state.companies) {
            if (partner.id === company.id || !mergeable(state, partner.id)) continue
            const partnerPresident = presidentId(state, partner.id)
            if (phase.final && partnerPresident !== playerId) continue
            if (
                phase.refused.some(
                    (entry) => entry.companyId === company.id && entry.partnerId === partner.id
                ) ||
                !companiesConnect(state, company.id, partner.id)
            )
                continue
            const yields = partnerPresident === playerId ? [false] : [false, true]
            for (const yielded of yields) {
                const initiator = yielded ? partnerPresident : playerId
                assertExists(initiator, 'A mergeable company has a president')
                if (
                    !isSystem(state, company.id) &&
                    !isSystem(state, partner.id) &&
                    nextSystemId(state) &&
                    systemPresident(state, [company.id, partner.id], initiator)
                )
                    options.push({
                        companyId: company.id,
                        partnerId: partner.id,
                        kind: 'system',
                        yielded
                    })
                const [buyerId, targetId] = yielded
                    ? [partner.id, company.id]
                    : [company.id, partner.id]
                if (
                    !involvedIn(state, buyerId, 'takeover') &&
                    !involvedIn(state, targetId, 'takeover') &&
                    fundable(state, buyerId, targetId)
                )
                    options.push({
                        companyId: company.id,
                        partnerId: partner.id,
                        kind: 'takeover',
                        yielded
                    })
            }
        }
    }
    return options
}

function sameOption(option: MergerOption, other: MergerOption) {
    return (
        option.companyId === other.companyId &&
        option.partnerId === other.partnerId &&
        option.kind === other.kind &&
        option.yielded === other.yielded
    )
}

type Decision =
    | { kind: 'discard'; playerId: string; companyId: string }
    | { kind: 'fund'; playerId: string }
    | { kind: 'answer'; playerId: string; proposal: MergerProposal }
    | { kind: 'propose'; playerId: string; index: number }

/** Who acts next in the merger phase, and on what. */
export function mergerDecision(state: EighteenThirtyTwoState): Decision | undefined {
    const phase = state.mergerPhase
    if (!phase) return undefined
    if (phase.discardCompanyId) {
        const playerId = presidentId(state, phase.discardCompanyId)
        assertExists(playerId, 'A company over its train limit has a president')
        return { kind: 'discard', playerId, companyId: phase.discardCompanyId }
    }
    if (phase.funding) return { kind: 'fund', playerId: phase.funding.playerId }
    if (phase.proposal) {
        const playerId = presidentId(state, phase.proposal.partnerId)
        assertExists(playerId, 'A proposed partner has a president')
        return { kind: 'answer', playerId, proposal: phase.proposal }
    }
    for (let index = phase.index; index < phase.playerIds.length; index++) {
        const playerId = phase.playerIds[index]
        if (mergerOptions(state, playerId).length) return { kind: 'propose', playerId, index }
    }
    return undefined
}

export const MergerOutcome = Type.Object(
    {
        kind: MergerKind,
        survivorId: Id,
        system: Type.Optional(SystemFormation),
        payments: Type.Optional(Type.Array(CashPayment)),
        stations: Type.Optional(StationTransfer),
        returnedCoalRight: Type.Optional(Type.Boolean())
    },
    { additionalProperties: false }
)
export type MergerOutcome = Type.Static<typeof MergerOutcome>

function takeoverSides(proposal: MergerOption) {
    return proposal.yielded
        ? { buyerId: proposal.partnerId, targetId: proposal.companyId }
        : { buyerId: proposal.companyId, targetId: proposal.partnerId }
}

function overTrainLimit(state: EighteenThirtyTwoState, companyId: string) {
    return (
        trainsCountingForLimit(state, EighteenThirtyTwoTrainRules, companyId).length >
        EighteenThirtyTwoTrainRules.trainLimit(state, companyId)
    )
}

/**
 * The buyer pays for every outside share, its president making up what its treasury lacks; it
 * takes the bought company's money, trains, privates, rights, tokens and placed stations, and
 * the bought company closes (§11.7, §11.7.1).
 */
function completeTakeover(
    state: HydratedEighteenThirtyTwoState,
    buyerId: string,
    targetId: string
): MergerOutcome {
    const playerId = presidentId(state, buyerId)
    assertExists(playerId, 'A buying company has a president')
    const payments = takeoverPayments(state, buyerId, targetId)
    const cost = payments.reduce((total, payment) => total + payment.amount, 0)
    const contribution = Math.max(
        0,
        cost - finiteCashOwnedBy(state, { kind: 'company', companyId: buyerId })
    )
    const settled: CashPayment[] = [
        ...(contribution
            ? [
                  {
                      from: { kind: 'player' as const, playerId },
                      to: { kind: 'company' as const, companyId: buyerId },
                      amount: contribution
                  }
              ]
            : []),
        ...payments
    ]
    settleCashPayments(state, settled)
    state.certificates = state.certificates.map((certificate) => {
        if (certificate.retired || certificate.companyId !== targetId) return certificate
        const { owner: _owner, poolId: _poolId, ...retired } = certificate
        return { ...retired, retired: true }
    })
    transferCompanyAssets(state, targetId, buyerId, { loans: false })
    // The bought company's unplaced stations are discarded; placed ones stay (§11.7.1).
    state.stations = state.stations.map((station) =>
        station.companyId === targetId && station.status === 'available'
            ? { id: station.id, companyId: targetId, status: 'removed' }
            : station
    )
    const stations = moveCompanyStations(state, targetId, buyerId)
    state.stationReservations = state.stationReservations.filter(
        (reservation) => reservation.companyId !== targetId
    )
    const returnedCoalRight =
        state.coalRights.includes(buyerId) && state.coalRights.includes(targetId)
    state.coalRights = [
        ...new Set(
            state.coalRights.map((companyId) => (companyId === targetId ? buyerId : companyId))
        )
    ]
    state.revenueTokens = state.revenueTokens.map((token) =>
        token.companyId === targetId ? { ...token, companyId: buyerId } : token
    )
    if (state.londonCompanyId === targetId) state.londonCompanyId = buyerId
    state.ownershipLimitExemptions = state.ownershipLimitExemptions.filter(
        (exemption) => exemption.companyId !== targetId
    )
    removeStockMarker(state.stockMarket, targetId)
    const target = getCompany(state, targetId)
    target.closed = true
    delete target.president
    const set = state.operatingSet
    if (set && !set.completed) {
        // A merged company that had already operated this round does not operate again (§11.8).
        if (
            set.completedCompanyIds.includes(targetId) &&
            !set.completedCompanyIds.includes(buyerId)
        )
            set.completedCompanyIds = [...set.completedCompanyIds, buyerId]
        reorderPendingOperatingCompanies(state, EighteenThirtyTwoOperatingRules.companyOrder(state))
    }
    state.mergers = [
        ...state.mergers,
        { kind: 'takeover', companyIds: [buyerId, targetId], survivorId: buyerId }
    ]
    const phase = state.mergerPhase
    assertExists(phase, 'A takeover happens in a merger phase')
    delete phase.funding
    if (overTrainLimit(state, buyerId)) phase.discardCompanyId = buyerId
    return {
        kind: 'takeover',
        survivorId: buyerId,
        payments: settled,
        stations,
        returnedCoalRight
    }
}

/** Carries out an agreed merger, or begins the buyer's president's sales for a takeover. */
function executeMerger(
    state: HydratedEighteenThirtyTwoState,
    proposal: MergerProposal
): MergerOutcome | undefined {
    const partnerPresident = presidentId(state, proposal.partnerId)
    assertExists(partnerPresident, 'A merger partner has a president')
    if (proposal.kind === 'system') {
        const initiator = proposal.yielded ? partnerPresident : proposal.proposerPlayerId
        const system = formSystem(state, [proposal.companyId, proposal.partnerId], initiator)
        state.mergers = [
            ...state.mergers,
            {
                kind: 'system',
                companyIds: [proposal.companyId, proposal.partnerId],
                survivorId: system.systemId
            }
        ]
        return { kind: 'system', survivorId: system.systemId, system }
    }
    const { buyerId, targetId } = takeoverSides(proposal)
    const playerId = presidentId(state, buyerId)
    assertExists(playerId, 'A buying company has a president')
    if (takeoverShortfall(state, buyerId, targetId, playerId)) {
        const phase = state.mergerPhase
        assertExists(phase, 'A takeover happens in a merger phase')
        phase.funding = { buyerId, targetId, playerId }
        return undefined
    }
    return completeTakeover(state, buyerId, targetId)
}

function currentDecision<Kind extends Decision['kind']>(
    state: EighteenThirtyTwoState,
    kind: Kind,
    playerId: string
): Extract<Decision, { kind: Kind }> | undefined {
    const decision = mergerDecision(state)
    return decision && isDecision(decision, kind) && decision.playerId === playerId
        ? decision
        : undefined
}

function isDecision<Kind extends Decision['kind']>(
    decision: Decision,
    kind: Kind
): decision is Extract<Decision, { kind: Kind }> {
    return decision.kind === kind
}

const StartFields = Type.Object({
    type: Type.Literal('StartMergerPhase'),
    final: Type.Boolean(),
    metadata: Type.Optional(Type.Object({ held: Type.Boolean() }, { additionalProperties: false }))
})
export const StartMergerPhase: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof StartFields.properties
> = Type.Object(
    { ...GameAction.properties, ...StartFields.properties },
    { additionalProperties: false }
)
export type StartMergerPhase = Type.Static<typeof StartMergerPhase>
const StartValidator = Compile(StartMergerPhase)
export function isStartMergerPhase(action: GameAction): action is StartMergerPhase {
    return (
        action instanceof HydratedStartMergerPhase ||
        (action.type === 'StartMergerPhase' && StartValidator.Check(action))
    )
}

function phaseFor(state: EighteenThirtyTwoState, final: boolean) {
    return { final, playerIds: [...state.turnManager.turnOrder], index: 0, refused: [] }
}

function anyOptions(state: EighteenThirtyTwoState, final: boolean) {
    const probe = { ...state, mergerPhase: phaseFor(state, final) }
    return state.players.some((player) => mergerOptions(probe, player.playerId).length > 0)
}

/** Whether a merger phase begins: after a phase 4 or 5 stock round, or the first 6-train. */
export function mergerPhaseDue(state: EighteenThirtyTwoState): { final: boolean } | undefined {
    if (!mergersAllowed(state) || state.mergerPhase) return undefined
    if (EighteenThirtyTwoPhases.isAtLeast(state.phaseId, '6'))
        return state.machineState === 'OperatingSet' ? { final: true } : undefined
    return state.machineState === 'StartingOperatingSet' &&
        state.mergedAfterStockRound !== state.stockRound.number &&
        anyOptions(state, false)
        ? { final: false }
        : undefined
}

/** Opens the merger phase, or ends mergers when the last phase has nothing to merge. */
export class HydratedStartMergerPhase
    extends HydratableAction<typeof StartMergerPhase>
    implements StartMergerPhase
{
    declare type: 'StartMergerPhase'
    declare final: boolean
    declare metadata?: StartMergerPhase['metadata']
    constructor(data: StartMergerPhase) {
        super(data instanceof HydratedStartMergerPhase ? data.dehydrate() : data, StartValidator)
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        assert(
            this.source === ActionSource.System && mergerPhaseDue(state)?.final === this.final,
            'A merger phase begins after a stock round in phases 4 and 5, or the first 6-train'
        )
        const held = anyOptions(state, this.final)
        if (held) state.mergerPhase = phaseFor(state, this.final)
        else state.mergersEnded = true
        this.metadata = { held }
    }
}

const CompleteFields = Type.Object({
    type: Type.Literal('CompleteMergerPhase'),
    metadata: Type.Optional(Type.Object({ final: Type.Boolean() }, { additionalProperties: false }))
})
export const CompleteMergerPhase: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof CompleteFields.properties
> = Type.Object(
    { ...GameAction.properties, ...CompleteFields.properties },
    { additionalProperties: false }
)
export type CompleteMergerPhase = Type.Static<typeof CompleteMergerPhase>
const CompleteValidator = Compile(CompleteMergerPhase)
export function isCompleteMergerPhase(action: GameAction): action is CompleteMergerPhase {
    return (
        action instanceof HydratedCompleteMergerPhase ||
        (action.type === 'CompleteMergerPhase' && CompleteValidator.Check(action))
    )
}

export class HydratedCompleteMergerPhase
    extends HydratableAction<typeof CompleteMergerPhase>
    implements CompleteMergerPhase
{
    declare type: 'CompleteMergerPhase'
    declare metadata?: CompleteMergerPhase['metadata']
    constructor(data: CompleteMergerPhase) {
        super(
            data instanceof HydratedCompleteMergerPhase ? data.dehydrate() : data,
            CompleteValidator
        )
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        const phase = state.mergerPhase
        assert(
            this.source === ActionSource.System && phase && !mergerDecision(state),
            'A merger phase ends once every player has passed'
        )
        if (phase.final) state.mergersEnded = true
        else state.mergedAfterStockRound = state.stockRound.number
        delete state.mergerPhase
        this.metadata = { final: phase.final }
    }
}

export const ProposeMerger = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('ProposeMerger'),
        companyId: Id,
        partnerId: Id,
        kind: MergerKind,
        yielded: Type.Boolean(),
        metadata: Type.Optional(
            Type.Object({ outcome: Type.Optional(MergerOutcome) }, { additionalProperties: false })
        )
    },
    { additionalProperties: false }
)
export type ProposeMerger = Type.Static<typeof ProposeMerger>
const ProposeValidator = Compile(ProposeMerger)
export function isProposeMerger(action: GameAction): action is ProposeMerger {
    return (
        action instanceof HydratedProposeMerger ||
        (action.type === 'ProposeMerger' && ProposeValidator.Check(action))
    )
}

/** A player proposes a merger; one between their own companies happens at once. */
export class HydratedProposeMerger
    extends HydratableAction<typeof ProposeMerger>
    implements ProposeMerger
{
    declare type: 'ProposeMerger'
    declare playerId: string
    declare companyId: string
    declare partnerId: string
    declare kind: MergerKind
    declare yielded: boolean
    declare metadata?: ProposeMerger['metadata']
    constructor(data: ProposeMerger) {
        super(data instanceof HydratedProposeMerger ? data.dehydrate() : data, ProposeValidator)
    }
    isValid(state: HydratedEighteenThirtyTwoState): boolean {
        return (
            this.source === ActionSource.User &&
            !!currentDecision(state, 'propose', this.playerId) &&
            mergerOptions(state, this.playerId).some((option) => sameOption(option, this))
        )
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        assert(this.isValid(state), 'This merger cannot be proposed')
        const phase = state.mergerPhase
        assertExists(phase, 'Mergers are proposed in a merger phase')
        const proposal: MergerProposal = {
            proposerPlayerId: this.playerId,
            companyId: this.companyId,
            partnerId: this.partnerId,
            kind: this.kind,
            yielded: this.yielded
        }
        if (presidentId(state, this.partnerId) !== this.playerId) {
            phase.proposal = proposal
            this.metadata = {}
            return
        }
        const outcome = executeMerger(state, proposal)
        this.metadata = outcome ? { outcome } : {}
    }
}

export const AnswerMerger = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('AnswerMerger'),
        accept: Type.Boolean(),
        metadata: Type.Optional(
            Type.Object(
                {
                    proposal: Type.Object(
                        {
                            proposerPlayerId: Id,
                            companyId: Id,
                            partnerId: Id,
                            kind: MergerKind,
                            yielded: Type.Boolean()
                        },
                        { additionalProperties: false }
                    ),
                    outcome: Type.Optional(MergerOutcome)
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type AnswerMerger = Type.Static<typeof AnswerMerger>
const AnswerValidator = Compile(AnswerMerger)
export function isAnswerMerger(action: GameAction): action is AnswerMerger {
    return (
        action instanceof HydratedAnswerMerger ||
        (action.type === 'AnswerMerger' && AnswerValidator.Check(action))
    )
}

/** The partner's president agrees to the proposed merger, or refuses it for this phase. */
export class HydratedAnswerMerger
    extends HydratableAction<typeof AnswerMerger>
    implements AnswerMerger
{
    declare type: 'AnswerMerger'
    declare playerId: string
    declare accept: boolean
    declare metadata?: AnswerMerger['metadata']
    constructor(data: AnswerMerger) {
        super(data instanceof HydratedAnswerMerger ? data.dehydrate() : data, AnswerValidator)
    }
    isValid(state: HydratedEighteenThirtyTwoState): boolean {
        return (
            this.source === ActionSource.User && !!currentDecision(state, 'answer', this.playerId)
        )
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        assert(this.isValid(state), 'Only the partner’s president answers a merger')
        const phase = state.mergerPhase
        assertExists(phase, 'Mergers are answered in a merger phase')
        const proposal = phase.proposal
        assertExists(proposal, 'An answer requires a proposal')
        delete phase.proposal
        if (!this.accept) {
            phase.refused.push({ companyId: proposal.companyId, partnerId: proposal.partnerId })
            this.metadata = { proposal }
            return
        }
        const outcome = executeMerger(state, proposal)
        this.metadata = { proposal, ...(outcome ? { outcome } : {}) }
    }
}

export const PassMerger = Type.Object(
    { ...PlayerAction.properties, type: Type.Literal('PassMerger') },
    { additionalProperties: false }
)
export type PassMerger = Type.Static<typeof PassMerger>
const PassValidator = Compile(PassMerger)
export function isPassMerger(action: GameAction): action is PassMerger {
    return (
        action instanceof HydratedPassMerger ||
        (action.type === 'PassMerger' && PassValidator.Check(action))
    )
}

export class HydratedPassMerger extends HydratableAction<typeof PassMerger> implements PassMerger {
    declare type: 'PassMerger'
    declare playerId: string
    constructor(data: PassMerger) {
        super(data instanceof HydratedPassMerger ? data.dehydrate() : data, PassValidator)
    }
    isValid(state: HydratedEighteenThirtyTwoState): boolean {
        return (
            this.source === ActionSource.User && !!currentDecision(state, 'propose', this.playerId)
        )
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        const decision = currentDecision(state, 'propose', this.playerId)
        assert(this.source === ActionSource.User && decision, 'Only the proposing player passes')
        const phase = state.mergerPhase
        assertExists(phase, 'Players pass in a merger phase')
        phase.index = decision.index + 1
    }
}

export const SellTakeoverShares = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('SellTakeoverShares'),
        companyId: Id,
        shares: Type.Integer({ minimum: 1 }),
        metadata: Type.Optional(ShareSaleDetails)
    },
    { additionalProperties: false }
)
export type SellTakeoverShares = Type.Static<typeof SellTakeoverShares>
const SellValidator = Compile(SellTakeoverShares)
export function isSellTakeoverShares(action: GameAction): action is SellTakeoverShares {
    return (
        action instanceof HydratedSellTakeoverShares ||
        (action.type === 'SellTakeoverShares' && SellValidator.Check(action))
    )
}

function takeoverSale(
    state: EighteenThirtyTwoState,
    playerId: string,
    companyId: string,
    shares: number
) {
    const funding = state.mergerPhase?.funding
    if (!funding || funding.playerId !== playerId) return undefined
    return takeoverSales(state, playerId, funding.targetId).find(
        (sale) => sale.sales[0].companyId === companyId && sale.sales[0].shares === shares
    )
}

/** The buyer's president sells shares to raise the takeover's price (§11.7). */
export class HydratedSellTakeoverShares
    extends HydratableAction<typeof SellTakeoverShares>
    implements SellTakeoverShares
{
    declare type: 'SellTakeoverShares'
    declare playerId: string
    declare companyId: string
    declare shares: number
    declare metadata?: SellTakeoverShares['metadata']
    constructor(data: SellTakeoverShares) {
        super(data instanceof HydratedSellTakeoverShares ? data.dehydrate() : data, SellValidator)
    }
    isValid(state: HydratedEighteenThirtyTwoState): boolean {
        return (
            this.source === ActionSource.User &&
            !!currentDecision(state, 'fund', this.playerId) &&
            !!takeoverSale(state, this.playerId, this.companyId, this.shares)
        )
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        assert(this.isValid(state), 'This sale cannot fund the takeover')
        const details = takeoverSale(state, this.playerId, this.companyId, this.shares)
        assertExists(details, 'A valid takeover sale has its details')
        applyShareSale(state, details)
        EighteenThirtyTwoStockRules.afterSale?.(state, details)
        this.metadata = details
    }
}

const CompleteTakeoverFields = Type.Object({
    type: Type.Literal('CompleteTakeover'),
    metadata: Type.Optional(MergerOutcome)
})
export const CompleteTakeover: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof CompleteTakeoverFields.properties
> = Type.Object(
    { ...GameAction.properties, ...CompleteTakeoverFields.properties },
    { additionalProperties: false }
)
export type CompleteTakeover = Type.Static<typeof CompleteTakeover>
const CompleteTakeoverValidator = Compile(CompleteTakeover)
export function isCompleteTakeover(action: GameAction): action is CompleteTakeover {
    return (
        action instanceof HydratedCompleteTakeover ||
        (action.type === 'CompleteTakeover' && CompleteTakeoverValidator.Check(action))
    )
}

function fundingCovered(state: EighteenThirtyTwoState) {
    const funding = state.mergerPhase?.funding
    return (
        !!funding && !takeoverShortfall(state, funding.buyerId, funding.targetId, funding.playerId)
    )
}

/** Completes a takeover once its buyer's president has raised the price. */
export class HydratedCompleteTakeover
    extends HydratableAction<typeof CompleteTakeover>
    implements CompleteTakeover
{
    declare type: 'CompleteTakeover'
    declare metadata?: CompleteTakeover['metadata']
    constructor(data: CompleteTakeover) {
        super(
            data instanceof HydratedCompleteTakeover ? data.dehydrate() : data,
            CompleteTakeoverValidator
        )
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        const funding = state.mergerPhase?.funding
        assert(
            this.source === ActionSource.System && funding && fundingCovered(state),
            'A takeover completes once its price is raised'
        )
        this.metadata = completeTakeover(state, funding.buyerId, funding.targetId)
    }
}

export const DiscardMergedTrain = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('DiscardMergedTrain'),
        trainId: Id
    },
    { additionalProperties: false }
)
export type DiscardMergedTrain = Type.Static<typeof DiscardMergedTrain>
const DiscardValidator = Compile(DiscardMergedTrain)
export function isDiscardMergedTrain(action: GameAction): action is DiscardMergedTrain {
    return (
        action instanceof HydratedDiscardMergedTrain ||
        (action.type === 'DiscardMergedTrain' && DiscardValidator.Check(action))
    )
}

/** The trains a buyer over its limit may discard to the open market. */
export function discardableMergedTrains(state: EighteenThirtyTwoState, playerId: string) {
    const decision = mergerDecision(state)
    if (decision?.kind !== 'discard' || decision.playerId !== playerId) return []
    return trainsCountingForLimit(state, EighteenThirtyTwoTrainRules, decision.companyId)
}

/** The president discards a train of their choice to the open market, uncompensated (§11.7.1). */
export class HydratedDiscardMergedTrain
    extends HydratableAction<typeof DiscardMergedTrain>
    implements DiscardMergedTrain
{
    declare type: 'DiscardMergedTrain'
    declare playerId: string
    declare trainId: string
    constructor(data: DiscardMergedTrain) {
        super(
            data instanceof HydratedDiscardMergedTrain ? data.dehydrate() : data,
            DiscardValidator
        )
    }
    isValid(state: HydratedEighteenThirtyTwoState): boolean {
        return (
            this.source === ActionSource.User &&
            discardableMergedTrains(state, this.playerId).some((train) => train.id === this.trainId)
        )
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        assert(this.isValid(state), 'This train cannot be discarded')
        const phase = state.mergerPhase
        assertExists(phase, 'Trains are discarded in a merger phase')
        const companyId = phase.discardCompanyId
        assertExists(companyId, 'A discard follows a takeover')
        state.trainInventory.trains = state.trainInventory.trains.map((train) =>
            train.id === this.trainId ? unownedTrain(train, 'market') : train
        )
        if (!overTrainLimit(state, companyId)) delete phase.discardCompanyId
    }
}

const DecisionActions: Readonly<Record<Decision['kind'], readonly string[]>> = {
    discard: ['DiscardMergedTrain'],
    fund: ['SellTakeoverShares'],
    answer: ['AnswerMerger'],
    propose: ['ProposeMerger', 'PassMerger']
}

/** Players in priority order propose, answer and fund mergers (§11.1). */
export class MergingHandler implements EighteenThirtyTwoStateHandler {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEighteenThirtyTwoState>
    ): boolean {
        const state = context.gameState
        if (action instanceof HydratedCompleteMergerPhase)
            return action.source === ActionSource.System && !mergerDecision(state)
        if (action instanceof HydratedCompleteTakeover)
            return action.source === ActionSource.System && fundingCovered(state)
        return (
            (action instanceof HydratedProposeMerger ||
                action instanceof HydratedAnswerMerger ||
                action instanceof HydratedPassMerger ||
                action instanceof HydratedSellTakeoverShares ||
                action instanceof HydratedDiscardMergedTrain) &&
            action.isValid(state)
        )
    }
    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEighteenThirtyTwoState>
    ): string[] {
        const state = context.gameState
        const decision = mergerDecision(state)
        if (!decision || decision.playerId !== playerId || fundingCovered(state)) return []
        return [...DecisionActions[decision.kind]]
    }
    enter(context: MachineContext<HydratedEighteenThirtyTwoState>): void {
        const state = context.gameState
        if (fundingCovered(state)) {
            context.addSystemAction(CompleteTakeover, {})
            return
        }
        const decision = mergerDecision(state)
        if (decision) state.activePlayerIds = [decision.playerId]
        else context.addSystemAction(CompleteMergerPhase, {})
    }
    onAction(action: HydratedAction): string {
        if (!(action instanceof HydratedCompleteMergerPhase)) return MergingState
        assertExists(action.metadata, 'A completed merger phase records which it was')
        return action.metadata.final ? 'OperatingSet' : 'StartingOperatingSet'
    }
}

/** Opens a merger phase where one is due, before the state does anything else. */
export function startsMergerPhase(
    handler: EighteenThirtyTwoStateHandler
): EighteenThirtyTwoStateHandler {
    return new SystemActionFirstHandler(
        handler,
        StartMergerPhase,
        (state) => mergerPhaseDue(state),
        (state) => (state.mergerPhase ? MergingState : state.machineState)
    )
}

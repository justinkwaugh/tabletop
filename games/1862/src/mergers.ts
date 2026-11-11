import {
    RailwayMapState,
    TrackNetwork,
    actsFor,
    addCompanyStations,
    companyStationCenters,
    controllingOwner,
    endOperatingTurn,
    getCompany,
    inReceivership,
    placeStockMarker,
    replaceStation,
    settleCashPayments,
    stepAction,
    transferCompanyAssets,
    trainsOwnedBy,
    CashPayment,
    type EighteenXXStateHandler,
    type PlacedStation,
    type StepAction
} from '@tabletop/18xx'
import {
    ActionSource,
    assert,
    assertExists,
    type HydratedAction,
    type MachineContext
} from '@tabletop/common'
import * as Type from 'typebox'
import { isChartered } from './companyRules.js'
import { resetCompany1862 } from './companyReset.js'
import { deciderOf } from './receivers.js'
import { LondonSpacesLocationId, LondonSpacesNodeId, Map1862 } from './map.js'
import { restackAtBottom } from './operating.js'
import {
    MergeHolder,
    beginShareMerge,
    canRedeemOption,
    holderPlayer,
    nextMergeHolder,
    sameHolder,
    settleDirector,
    settleOption,
    takeMergeTurn
} from './shareMerge.js'
import { MergingSharesState, type HydratedState1862, type State1862 } from './state.js'
import {
    CharteredParPrices,
    Market1862,
    NonCharteredParPrices,
    marketSpaceIdAt
} from './stockMarket.js'
import { hasTrain } from './stockRules.js'
import { TileSet1862 } from './tiles.js'
import { systemAction, titleAction } from './titleAction.js'
import { maximumStations } from './stationPurchase.js'

const Id = Type.String({ minLength: 1 })

/** A company's price for a merger: halved, rounded down, while it has no train (§7.5.3). */
function mergerValue(state: State1862, companyId: string): number {
    const price = Market1862.companySpace(state.stockMarket, companyId).price
    return hasTrain(state, companyId) ? price : Math.floor(price / 2)
}

/** The highest market price at or below a value. */
function marketPriceAtMost(value: number): number {
    return Math.max(
        ...Market1862.spaces.map((space) => space.price).filter((price) => price <= value)
    )
}

/**
 * The merged company's price: the lower price plus half the higher, train-less prices halved
 * first, rounded down to a market price (§7.5.3).
 */
export function mergedPrice(state: State1862, a: string, b: string): number {
    const [lower, higher] = [mergerValue(state, a), mergerValue(state, b)].sort((x, y) => x - y)
    return marketPriceAtMost(lower + Math.floor(higher / 2))
}

/** The merged company's par: the highest of its area's pars at or below the price (§7.5.4). */
export function mergedPar(price: number, chartered: boolean): number {
    const pars = chartered ? CharteredParPrices : NonCharteredParPrices.filter((par) => par <= 100)
    return Math.max(Math.min(...pars), ...pars.filter((par) => par <= price))
}

function stationCenters(state: State1862, companyId: string) {
    return companyStationCenters(state, companyId).filter(
        (center) => center.locationId !== LondonSpacesLocationId
    )
}

/** Whether the companies' stations are joined by track, London aside (§7.5.2). */
export function connected(state: State1862, a: string, b: string): boolean {
    const mapState = new RailwayMapState(Map1862, TileSet1862, state.tileInventory)
    const network = new TrackNetwork(mapState, state, a)
    const targets = stationCenters(state, b)
    const own = stationCenters(state, a)
    return targets.some(
        (center) =>
            own.some((mine) => mine.locationId === center.locationId) ||
            network.reaches(center.locationId, { kind: 'node', nodeId: center.nodeId })
    )
}

function mergeable(state: State1862, companyId: string): boolean {
    const company = getCompany(state, companyId)
    return (
        !!company.floated &&
        !company.closed &&
        !!company.president &&
        !inReceivership(state, companyId) &&
        stationCenters(state, companyId).length > 0
    )
}

/** The companies the operating company may merge with or acquire now (§7.5, §7.14). */
export function mergerPartners(state: State1862, companyId: string): string[] {
    if (state.lner || !mergeable(state, companyId)) return []
    return state.companies
        .filter(
            (company) =>
                company.id !== companyId &&
                mergeable(state, company.id) &&
                connected(state, companyId, company.id)
        )
        .map((company) => company.id)
}

type Kind = 'merge' | 'acquire'

/** When the operating company may merge (its turn's start) or acquire (its turn's end). */
export function mergerKind(
    state: State1862,
    playerId: string,
    companyId: string
): Kind | undefined {
    if (state.shareMerge || state.mergerProposal || !actsFor(state, playerId, companyId))
        return undefined
    if (
        state.machineState === 'LayingTrack' &&
        state.trackStep?.companyId === companyId &&
        !state.trackStep.lays.length &&
        !state.build
    )
        return 'merge'
    if (state.machineState === 'BuyingTrains' && state.trainPurchaseStep?.companyId === companyId)
        return 'acquire'
    return undefined
}

const ProposeAction = titleAction('ProposeMerger', {
    companyId: Id,
    partnerId: Id,
    survivorId: Id
})
export const ProposeMerger = ProposeAction.schema
export const isProposeMerger = ProposeAction.is

/**
 * The operating company's director proposes a merger at the start of its turn, or an
 * acquisition at its end, naming the company that survives; the other director must agree
 * unless they are the same player (§7.5.1, §7.14).
 */
export class HydratedProposeMerger extends ProposeAction.Base {
    declare playerId: string
    declare companyId: Type.Static<typeof ProposeMerger>['companyId']
    declare partnerId: Type.Static<typeof ProposeMerger>['partnerId']
    declare survivorId: Type.Static<typeof ProposeMerger>['survivorId']
    isValid(state: HydratedState1862): boolean {
        return (
            this.source === ActionSource.User &&
            proposablePartners(state, this.playerId, this.companyId).includes(this.partnerId) &&
            (this.survivorId === this.companyId || this.survivorId === this.partnerId)
        )
    }
    apply(state: HydratedState1862): void {
        assert(this.isValid(state), 'The operating company proposes to a connected company')
        const kind = mergerKind(state, this.playerId, this.companyId)
        assertExists(kind, 'A merger has its moment')
        state.mergerProposal = {
            kind,
            companyId: this.companyId,
            partnerId: this.partnerId,
            survivorId: this.survivorId,
            initiatorId: this.playerId
        }
        if (controllingOwner(state, this.partnerId)?.playerId === this.playerId) beginMerger(state)
    }
}

const AnswerAction = titleAction('AnswerMerger', { accept: Type.Boolean() })
export const AnswerMerger = AnswerAction.schema
export const isAnswerMerger = AnswerAction.is

/** The other company's director agrees to the merger or refuses it (§7.5.1). */
export class HydratedAnswerMerger extends AnswerAction.Base {
    declare playerId: string
    declare accept: Type.Static<typeof AnswerMerger>['accept']
    isValid(state: HydratedState1862): boolean {
        const proposal = state.mergerProposal
        return (
            this.source === ActionSource.User &&
            !!proposal &&
            !state.shareMerge &&
            controllingOwner(state, proposal.partnerId)?.playerId === this.playerId
        )
    }
    apply(state: HydratedState1862): void {
        assert(this.isValid(state), 'The other company’s director answers')
        if (this.accept) beginMerger(state)
        else delete state.mergerProposal
    }
}

/**
 * Starts the agreed merger: the new price and par, and the 2:1 share merge with its holders in
 * order (§7.5.3–7.5.5). The treasuries combine first, so the companies redeem their options
 * from it.
 */
function beginMerger(state: HydratedState1862): void {
    const proposal = state.mergerProposal
    assertExists(proposal, 'A merger was proposed')
    const { survivorId } = proposal
    const otherId = survivorId === proposal.companyId ? proposal.partnerId : proposal.companyId
    const price = mergedPrice(state, survivorId, otherId)
    const chartered = isChartered(state, survivorId) && isChartered(state, otherId)
    const survivor = getCompany(state, survivorId)
    survivor.parPrice = mergedPar(price, chartered)
    placeStockMarker(state.stockMarket, survivorId, marketSpaceIdAt(price))
    restackAtBottom(state.stockMarket, survivorId)
    if (!chartered) state.chartered = state.chartered.filter((id) => id !== survivorId)
    transferCompanyAssets(state, otherId, survivorId, { loans: false })
    beginShareMerge(state, {
        kind: proposal.kind,
        initiatorId: proposal.initiatorId,
        survivorId,
        otherId,
        price
    })
}

/**
 * Gives the survivor the other company's permits and stations: one station where both had one
 * in a city or in London, the other's placed stations replaced by the survivor's, its unused
 * ones added, up to the limit (§7.5.6).
 */
function mergeStations(state: HydratedState1862, otherId: string, survivorId: string): void {
    const survivorHexes = new Set(
        companyStationCenters(state, survivorId).map((center) => center.locationId)
    )
    for (const station of state.stations.filter((entry) => entry.companyId === otherId)) {
        if (station.status === 'removed') continue
        if (station.status === 'placed' && survivorHexes.has(station.position.locationId)) {
            state.stations = state.stations.map((entry) =>
                entry.id === station.id
                    ? { id: entry.id, companyId: otherId, status: 'removed' }
                    : entry
            )
            continue
        }
        addCompanyStations(state, survivorId, 1)
        const added = state.stations.at(-1)
        assertExists(added, 'The survivor gains a station')
        if (station.status === 'placed') {
            replaceStation(state, station.id, added.id)
            survivorHexes.add(station.position.locationId)
        }
    }
    // Beyond the limit, unused stations go first, then those placed last (§7.5.6).
    const live = state.stations.filter(
        (station) => station.companyId === survivorId && station.status !== 'removed'
    )
    const excess = live.length - maximumStations(state)
    if (excess > 0) {
        const removable = [
            ...live.filter((station) => station.status !== 'placed'),
            ...live
                .filter((station): station is PlacedStation => station.status === 'placed')
                .filter((station) => station.position.nodeId !== LondonSpacesNodeId)
                .reverse()
        ].slice(0, excess)
        const ids = new Set(removable.map((station) => station.id))
        state.stations = state.stations.map((station) =>
            ids.has(station.id)
                ? { id: station.id, companyId: survivorId, status: 'removed' }
                : station
        )
    }
    state.permits[survivorId] = [
        ...new Set([...(state.permits[survivorId] ?? []), ...(state.permits[otherId] ?? [])])
    ]
}

const TurnAction = systemAction('TakeMergeTurn', {
    holder: MergeHolder,
    metadata: Type.Optional(
        Type.Object({ payments: Type.Array(CashPayment) }, { additionalProperties: false })
    )
})
export const TakeMergeTurn = TurnAction.schema
export const isTakeMergeTurn = TurnAction.is

/** The next holder returns, swaps and sells its shares (§5.2.4). */
export class HydratedTakeMergeTurn extends TurnAction.Base {
    declare holder: Type.Static<typeof TakeMergeTurn>['holder']
    declare metadata?: Type.Static<typeof TakeMergeTurn>['metadata']
    apply(state: HydratedState1862): void {
        const merge = state.shareMerge
        const holder = merge && !merge.option ? nextMergeHolder(state, merge) : undefined
        assert(
            this.source === ActionSource.System && !!holder && sameHolder(holder, this.holder),
            'The next holder takes its turn'
        )
        this.metadata = { payments: takeMergeTurn(state) }
    }
}

const OptionAction = titleAction('DecideOption', { redeem: Type.Boolean() })
export const DecideOption = OptionAction.schema
export const isDecideOption = OptionAction.is

/** The holder of an option share redeems it or gives it up; one who cannot pay gives it up. */
export class HydratedDecideOption extends OptionAction.Base {
    declare playerId: string
    declare redeem: Type.Static<typeof DecideOption>['redeem']
    isValid(state: HydratedState1862): boolean {
        const merge = state.shareMerge
        return (
            !!merge?.option &&
            holderPlayer(merge, merge.option.holder) === this.playerId &&
            (this.source === ActionSource.User
                ? !this.redeem || canRedeemOption(state, merge)
                : !this.redeem && !canRedeemOption(state, merge))
        )
    }
    apply(state: HydratedState1862): void {
        assert(this.isValid(state), 'The option’s holder decides it')
        settleOption(state, this.redeem)
    }
}

const CompleteAction = systemAction('CompleteShareMerge', {
    metadata: Type.Optional(
        Type.Object(
            {
                director: Type.Optional(Type.String()),
                refinancing: Type.Optional(Type.Integer({ minimum: 0 }))
            },
            { additionalProperties: false }
        )
    )
})
export const CompleteShareMerge = CompleteAction.schema
export const isCompleteShareMerge = CompleteAction.is

/** The capital a refinancing raises: ten times par, at most £1,000 (§7.11.2). */
export function refinancingCapital(state: State1862, companyId: string): number {
    const par = getCompany(state, companyId).parPrice
    assertExists(par, 'A started company has a par')
    return Math.min(1000, par * 10)
}

/**
 * Ends the share merge: the director settles, and a merger's other company leaves play with its
 * stations and permits passed on; a refinancing's company receives its capital (§5.2.5, §7.5.6,
 * §7.11.2).
 */
export class HydratedCompleteShareMerge extends CompleteAction.Base {
    declare metadata?: Type.Static<typeof CompleteShareMerge>['metadata']
    apply(state: HydratedState1862): void {
        const merge = state.shareMerge
        assert(
            this.source === ActionSource.System &&
                !!merge &&
                !merge.option &&
                !nextMergeHolder(state, merge),
            'Every holder has acted'
        )
        const director = settleDirector(state)
        let refinancing: number | undefined
        if (merge.kind === 'refinance') {
            refinancing = refinancingCapital(state, merge.survivorId)
            settleCashPayments(state, [
                {
                    from: { kind: 'bank' },
                    to: { kind: 'company', companyId: merge.survivorId },
                    amount: refinancing
                } satisfies CashPayment
            ])
        } else if (merge.otherId) finishMerger(state, merge.survivorId, merge.otherId)
        delete state.shareMerge
        delete state.mergerProposal
        this.metadata = {
            ...(director ? { director } : {}),
            ...(refinancing !== undefined ? { refinancing } : {})
        }
    }
}

/**
 * Passes the other company's stations and permits to the survivor, returns the other to the
 * IPO, and sets the operating order: a merger before the other company operated continues the
 * turn as the survivor; otherwise the turn ends (§7.5, §7.14).
 */
function finishMerger(state: HydratedState1862, survivorId: string, otherId: string): void {
    const proposal = state.mergerProposal
    assertExists(proposal, 'A merger was proposed')
    mergeStations(state, otherId, survivorId)
    resetCompany1862(state, otherId)
    const set = state.operatingSet
    assertExists(set, 'Mergers happen in operating rounds')
    const activeId = proposal.companyId
    const continues =
        proposal.kind === 'merge' && !set.completedCompanyIds.includes(proposal.partnerId)
    // The survivor takes the turn's place; the other company leaves the order unless it has
    // already operated.
    set.companyOrder = [
        ...new Set(set.companyOrder.map((id) => (id === activeId ? survivorId : id)))
    ].filter((id) => id !== otherId || set.completedCompanyIds.includes(id))
    if (continues) {
        if (state.trackStep) state.trackStep.companyId = survivorId
        return
    }
    if (set.completedCompanyIds.includes(survivorId)) {
        // The survivor operated earlier this round: the turn simply ends.
        state.turnManager.endTurn(state.actionCount)
        delete state.trackStep
        delete state.stationStep
        delete state.routeStep
        delete state.earningsDistribution
    } else endOperatingTurn(state, survivorId)
    delete state.trainPurchaseStep
    getCompany(state, survivorId).operated = true
}

/** The decision a share merge or proposal awaits, and whose it is. */
export function mergerDecision(
    state: State1862
):
    | { kind: 'answer'; playerId: string }
    | { kind: 'option'; playerId: string }
    | { kind: 'turn'; holder: MergeHolder }
    | { kind: 'complete' }
    | undefined {
    const merge = state.shareMerge
    if (merge) {
        if (merge.option)
            return { kind: 'option', playerId: holderPlayer(merge, merge.option.holder) }
        const holder = nextMergeHolder(state, merge)
        return holder ? { kind: 'turn', holder } : { kind: 'complete' }
    }
    const proposal = state.mergerProposal
    if (!proposal) return undefined
    const playerId = controllingOwner(state, proposal.partnerId)?.playerId
    assertExists(playerId, 'A partner has a director')
    return { kind: 'answer', playerId }
}

type Context = MachineContext<HydratedState1862>

/** Waits on answers and options until the share merge completes, then resumes the turn. */
export class MergingSharesHandler implements EighteenXXStateHandler<HydratedState1862> {
    isValidAction(action: HydratedAction, context: Context): boolean {
        const state = context.gameState
        const decision = mergerDecision(state)
        if (action instanceof HydratedTakeMergeTurn)
            return decision?.kind === 'turn' && action.source === ActionSource.System
        if (action instanceof HydratedCompleteShareMerge)
            return decision?.kind === 'complete' && action.source === ActionSource.System
        return (
            (action instanceof HydratedAnswerMerger || action instanceof HydratedDecideOption) &&
            action.isValid(state)
        )
    }
    validActionsForPlayer(playerId: string, context: Context): string[] {
        const decision = mergerDecision(context.gameState)
        if (decision?.kind === 'answer' && decision.playerId === playerId)
            return [AnswerAction.type]
        if (decision?.kind === 'option' && decision.playerId === playerId)
            return [OptionAction.type]
        return []
    }
    enter(context: Context): void {
        const state = context.gameState
        const decision = mergerDecision(state)
        assertExists(decision, 'A merger is under way')
        if (decision.kind === 'turn') {
            state.activePlayerIds = []
            context.addSystemAction(TakeMergeTurn, { holder: decision.holder })
        } else if (decision.kind === 'complete') {
            state.activePlayerIds = []
            context.addSystemAction(CompleteShareMerge, {})
        } else {
            state.activePlayerIds = [decision.playerId]
            const merge = state.shareMerge
            if (decision.kind === 'option' && merge && !canRedeemOption(state, merge))
                context.addSystemAction(DecideOption, {
                    playerId: decision.playerId,
                    redeem: false
                })
        }
    }
    onAction(action: HydratedAction, context: Context): string {
        const state = context.gameState
        if (state.shareMerge || state.mergerProposal) return MergingSharesState
        return resumeAfterMerger(state, action)
    }
}

/** Where play goes once a merger, acquisition or refinancing is settled or refused. */
function resumeAfterMerger(state: HydratedState1862, action: HydratedAction): string {
    if (state.trainPurchaseStep) return restoreOperator(state, 'BuyingTrains')
    if (state.trackStep) return restoreOperator(state, 'LayingTrack')
    void action
    return 'OperatingSet'
}

function restoreOperator(state: HydratedState1862, next: string): string {
    const companyId = state.trainPurchaseStep?.companyId ?? state.trackStep?.companyId
    const playerId = companyId ? deciderOf(state, companyId) : undefined
    state.activePlayerIds = playerId ? [playerId] : []
    return next
}

/** Sends play to the merger's decisions once a proposal or share merge is pending. */
export function hostsMergers(
    handler: EighteenXXStateHandler<HydratedState1862>
): EighteenXXStateHandler<HydratedState1862> {
    return {
        enter: (context) => handler.enter(context),
        isValidAction: (action, context) => handler.isValidAction(action, context),
        validActionsForPlayer: (playerId, context) =>
            handler.validActionsForPlayer(playerId, context),
        onAction(action, context) {
            const next = handler.onAction(action, context)
            const state = context.gameState
            return state.shareMerge || state.mergerProposal ? MergingSharesState : next
        }
    }
}

/** A company must end its turn with a train, so an acquisition needs one between them (§7.11). */
function endsWithTrain(state: State1862, companyId: string, partnerId: string): boolean {
    return [companyId, partnerId].some(
        (id) => trainsOwnedBy(state, { kind: 'company', companyId: id }).length > 0
    )
}

/** The partners the operating company may propose to now. */
export function proposablePartners(
    state: State1862,
    playerId: string,
    companyId: string
): string[] {
    const kind = mergerKind(state, playerId, companyId)
    if (!kind) return []
    return mergerPartners(state, companyId).filter(
        (partnerId) => kind === 'merge' || endsWithTrain(state, companyId, partnerId)
    )
}

export const MergerStep: StepAction<HydratedState1862> = stepAction(
    ProposeAction.type,
    (action: HydratedAction): action is HydratedProposeMerger =>
        action instanceof HydratedProposeMerger,
    (state, playerId) => {
        const companyId =
            state.machineState === 'LayingTrack'
                ? state.trackStep?.companyId
                : state.trainPurchaseStep?.companyId
        return !!companyId && proposablePartners(state, playerId, companyId).length > 0
    }
)

export const MergerActions = [
    ProposeAction.define((action) => new HydratedProposeMerger(action)),
    AnswerAction.define((action) => new HydratedAnswerMerger(action)),
    TurnAction.define((action) => new HydratedTakeMergeTurn(action)),
    OptionAction.define((action) => new HydratedDecideOption(action)),
    CompleteAction.define((action) => new HydratedCompleteShareMerge(action))
]

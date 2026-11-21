import {
    ActionSource,
    assert,
    assertExists,
    type GameAction,
    type HydratedAction
} from '@tabletop/common'
import {
    CashPayment,
    PresidencyChange,
    StationPosition,
    BetweenCompaniesState,
    abandonOperatingTurn,
    advancePhaseSchema,
    continuePhaseChange,
    getCompany,
    isObsoleteTrain,
    presidentOf,
    removeCertificates,
    removeCompanyStations,
    removeStockMarker,
    settleCashPayments,
    sharesOwned,
    signedShares,
    titleAction,
    trainsOwnedBy,
    transferCompanyAssets,
    type PhaseChangeState,
    type PhaseChanges,
    type PhaseOccurrence,
    type Station
} from '@tabletop/18xx'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MergeableMajorIds, NdmId } from './companies.js'
import { MinorClosure, closeMinorsMex } from './minors.js'
import { IpoPoolIdMex } from './names.js'
import {
    MergingIntoNdmState,
    requireStateMex,
    type HydratedStateMex,
    type NdmMergerMex,
    type StateHandlerMex
} from './state.js'
import { ExchangeStationIds, HomeExchangeStationId, OtherExchangeStationId } from './stations.js'
import { reassessPresidencyMex } from './stock.js'
import { MarketMex } from './stockMarket.js'
import { mapStateMex } from './tiles.js'
import { trainLimitMex } from './trainLimits.js'
import { ThreeHalfPhaseId } from './trains.js'

const Id = Type.String({ minLength: 1 })

/** The NdM's 10% kept in the trade-in box for the merger (5.3(d), (i)). */
export const MergerShareId = `${NdmId}:merger`

/** What the merger did: the merged company, its holders' payments, and the stations kept. */
export const MergerDetails = Type.Object(
    {
        companyId: Id,
        /** The merging company's president, given the NdM trade-in 10%; absent when it was unsold. */
        presidentPlayerId: Type.Optional(Id),
        presidency: Type.Optional(PresidencyChange),
        compensation: Type.Array(CashPayment),
        treasury: Type.Optional(CashPayment),
        trainIds: Type.Array(Id),
        /** The hexes where an exchange token replaced the merging company's station. */
        exchangedLocationIds: Type.Array(Id)
    },
    { additionalProperties: false }
)
export type MergerDetails = Type.Static<typeof MergerDetails>

/** How the merger ended, or that it waits on a choice. */
export const MergerOutcome = Type.Object(
    {
        merged: Type.Optional(MergerDetails),
        /** No company merged, so every certificate limit rose by one (5.3(i)). */
        noMerger: Type.Optional(Type.Literal(true)),
        /** The NdM chose the station its second exchange token replaced. */
        exchangedLocationId: Type.Optional(Id)
    },
    { additionalProperties: false }
)
export type MergerOutcome = Type.Static<typeof MergerOutcome>

function presidentPlayer(state: HydratedStateMex, companyId: string): string | undefined {
    const president = presidentOf(state, companyId)
    return president?.kind === 'player' ? president.playerId : undefined
}

/** A player's floated companies that may merge into the NdM (5.3(b)). */
export function floatedMergeCandidates(state: HydratedStateMex, playerId: string): string[] {
    return MergeableMajorIds.filter((id) => {
        const company = getCompany(state, id)
        return company.floated && !company.closed && presidentPlayer(state, id) === playerId
    })
}

/** The players offered the merger, clockwise from the left of the 5-train buyer's president. */
function offerOrder(state: HydratedStateMex, merger: NdmMergerMex): string[] {
    const order = state.turnManager.turnOrder
    const start = order.indexOf(merger.triggerPlayerId) + 1
    const president = presidentPlayer(state, NdmId)
    return [...order.slice(start), ...order.slice(0, start)].filter((id) => id !== president)
}

/** The player now deciding whether to merge one of their companies. */
export function mergerOfferee(state: HydratedStateMex): string | undefined {
    const merger = state.ndmMerger
    if (merger?.stage !== 'offering') return undefined
    return offerOrder(state, merger).find(
        (playerId) =>
            !merger.declinedPlayerIds.includes(playerId) &&
            floatedMergeCandidates(state, playerId).length > 0
    )
}

/**
 * The unfloated companies the NdM's president must choose among once all decline: not his own,
 * and those with their president's certificate still in the Initial Offering if any (5.3(c)).
 */
export function unfloatedMergeCandidates(state: HydratedStateMex): string[] {
    const president = presidentPlayer(state, NdmId)
    const candidates = MergeableMajorIds.filter((id) => {
        const company = getCompany(state, id)
        return !company.floated && !company.closed && presidentPlayer(state, id) !== president
    })
    const unsold = candidates.filter((id) => !getCompany(state, id).started)
    return unsold.length ? unsold : candidates
}

/** The player whose decision the merger waits on. */
export function mergerDecider(state: HydratedStateMex): string | undefined {
    const merger = state.ndmMerger
    if (!merger) return undefined
    return merger.stage === 'offering' ? mergerOfferee(state) : presidentPlayer(state, NdmId)
}

function ndmHasStationIn(state: HydratedStateMex, locationId: string): boolean {
    return state.stations.some(
        (station) =>
            station.companyId === NdmId &&
            station.status === 'placed' &&
            station.position.locationId === locationId
    )
}

/** The lowest free station space of a city, where an unplaced home's exchange token goes. */
function freeSlot(state: HydratedStateMex, locationId: string, nodeId: string): number {
    const node = mapStateMex(state)
        .tile(locationId)
        .face.nodes.find((entry) => entry.id === nodeId)
    assert(node?.kind === 'city', 'A home is a city')
    const taken = state.stations.flatMap((station) =>
        station.status === 'placed' &&
        station.position.locationId === locationId &&
        station.position.nodeId === nodeId
            ? [station.position.slot]
            : []
    )
    const slot = Array.from({ length: node.stationSlots }, (_, index) => index).find(
        (index) => !taken.includes(index)
    )
    assertExists(slot, 'A reserved home keeps a space open')
    return slot
}

function placeExchangeToken(
    state: HydratedStateMex,
    stationId: string,
    position: StationPosition
): void {
    state.stations = state.stations.map((station): Station =>
        station.id === stationId
            ? { id: station.id, companyId: NdmId, status: 'placed', position: { ...position } }
            : station
    )
    state.mergerStationIds = [...(state.mergerStationIds ?? []), stationId]
}

/**
 * The merging company's stations: an exchange token replaces its home, placed even if it never
 * operated, unless the NdM already has a station in that hex; the other replaces one more station
 * where the NdM has none, the NdM's president choosing among several; the rest leave the map
 * (5.3(f), MG-4).
 */
function exchangeStations(state: HydratedStateMex, companyId: string): string[] {
    state.stations.push(
        ...ExchangeStationIds.map((id): Station => ({ id, companyId: NdmId, status: 'available' }))
    )
    const exchanged: string[] = []
    const placed = state.stations.filter(
        (station): station is Extract<Station, { status: 'placed' }> =>
            station.companyId === companyId && station.status === 'placed'
    )
    const home = placed.find((station) => station.id === `${companyId}:home`)
    const reservation = state.stationReservations.find((entry) => entry.companyId === companyId)
    const homePosition = home
        ? home.position
        : reservation && {
              locationId: reservation.locationId,
              nodeId: reservation.nodeId,
              slot: -1
          }
    const others = placed.filter(
        (station) => station !== home && !ndmHasStationIn(state, station.position.locationId)
    )
    removeCompanyStations(state, companyId)
    if (homePosition && !ndmHasStationIn(state, homePosition.locationId)) {
        const slot =
            homePosition.slot >= 0
                ? homePosition.slot
                : freeSlot(state, homePosition.locationId, homePosition.nodeId)
        placeExchangeToken(state, HomeExchangeStationId, { ...homePosition, slot })
        exchanged.push(homePosition.locationId)
    }
    if (others.length === 1) {
        placeExchangeToken(state, OtherExchangeStationId, others[0].position)
        exchanged.push(others[0].position.locationId)
    } else if (others.length > 1) {
        const merger = state.ndmMerger
        assertExists(merger, 'The merger is under way')
        state.ndmMerger = {
            ...merger,
            stage: 'choosing-station',
            stationChoices: others.map((station) => ({ ...station.position }))
        }
    }
    return exchanged
}

/**
 * The merged company leaves the operating round: a company that bought the first 5-train ends its
 * turn there, play going on to the next company, and one yet to operate does not (5.3(h)).
 */
function leaveOperatingRound(state: HydratedStateMex, companyId: string): void {
    const change = state.phaseChange
    if (change) {
        change.discardCompanyIds = change.discardCompanyIds.filter((id) => id !== companyId)
        if (change.continuation.companyId === companyId) {
            abandonOperatingTurn(state, companyId)
            change.continuation = { machineState: BetweenCompaniesState }
            return
        }
    }
    const set = state.operatingSet
    if (set && !set.completed)
        set.companyOrder = set.companyOrder.filter(
            (id) => id !== companyId || set.completedCompanyIds.includes(id)
        )
}

/** The NdM over its train limit discards the excess into the Open Market (5.3(g)). */
function requireNdmDiscard(state: HydratedStateMex): void {
    const change = state.phaseChange
    if (!change) return
    const trains = trainsOwnedBy(state, { kind: 'company', companyId: NdmId }).filter(
        (train) => !isObsoleteTrain(train)
    )
    if (trains.length > trainLimitMex(state, NdmId) && !change.discardCompanyIds.includes(NdmId))
        change.discardCompanyIds = [NdmId, ...change.discardCompanyIds]
}

/**
 * What a player is paid for a merged company's shares beyond its president's certificate: half
 * their market value, an odd holding rounded up (5.3(e)).
 */
export function mergerPayout(state: HydratedStateMex, companyId: string, playerId: string): number {
    const company = getCompany(state, companyId)
    const price = company.started ? MarketMex.companySpace(state.stockMarket, companyId).price : 0
    const owner = { kind: 'player', playerId } as const
    const president = state.certificates.find(
        (entry) =>
            entry.id === `${companyId}:president` &&
            entry.owner?.kind === 'player' &&
            entry.owner.playerId === playerId
    )
    const shares = sharesOwned(state, companyId, owner) - (president ? signedShares(president) : 0)
    return Math.ceil((shares * price) / 2)
}

/**
 * Merges a company into the NdM (5.3(d)–(h)): its president's certificate is exchanged for the
 * NdM's trade-in 10%, every holder of its stock is paid half its market value, its stations are
 * exchanged, its money and trains go to the NdM, and it leaves play.
 */
function mergeIntoNdm(state: HydratedStateMex, companyId: string): MergerDetails {
    const company = getCompany(state, companyId)
    const presidentPlayerId = presidentPlayer(state, companyId)
    const payouts = Object.fromEntries(
        state.players.map(({ playerId }) => [playerId, mergerPayout(state, companyId, playerId)])
    )
    const mergerShare = waitingMergerShare(state)
    removeCertificates(state, [`${companyId}:president`])
    if (presidentPlayerId) {
        mergerShare.owner = { kind: 'player', playerId: presidentPlayerId }
        delete mergerShare.poolId
    } else mergerShare.poolId = IpoPoolIdMex
    const presidency = presidentPlayerId ? reassessPresidencyMex(state, NdmId) : undefined
    const compensation = state.players.flatMap(({ playerId }): CashPayment[] => {
        const amount = payouts[playerId]
        return amount ? [{ from: { kind: 'bank' }, to: { kind: 'player', playerId }, amount }] : []
    })
    settleCashPayments(state, compensation)
    const exchangedLocationIds = exchangeStations(state, companyId)
    const { payment: treasury, trainIds } = transferCompanyAssets(state, companyId, NdmId, {
        loans: false
    })
    removeCertificates(
        state,
        state.certificates
            .filter((certificate) => certificate.companyId === companyId)
            .map((certificate) => certificate.id)
    )
    removeStockMarker(state.stockMarket, companyId)
    company.closed = true
    delete company.president
    leaveOperatingRound(state, companyId)
    requireNdmDiscard(state)
    if (state.ndmMerger?.stage !== 'choosing-station') delete state.ndmMerger
    else state.ndmMerger = { ...state.ndmMerger, mergedCompanyId: companyId }
    return {
        companyId,
        ...(presidentPlayerId ? { presidentPlayerId } : {}),
        ...(presidency ? { presidency } : {}),
        compensation,
        ...(treasury ? { treasury } : {}),
        trainIds,
        exchangedLocationIds
    }
}

function waitingMergerShare(state: HydratedStateMex) {
    const mergerShare = state.certificates.find((entry) => entry.id === MergerShareId)
    assertExists(mergerShare, 'The NdM trade-in 10% waits for the merger')
    return mergerShare
}

/** No company merges: the NdM's trade-in 10% goes on sale and certificate limits rise (5.3(i)). */
function noMerger(state: HydratedStateMex): MergerOutcome {
    const mergerShare = waitingMergerShare(state)
    mergerShare.poolId = IpoPoolIdMex
    state.certificateLimitRaised = true
    delete state.ndmMerger
    return { noMerger: true }
}

/**
 * Moves the merger on once no player is left to offer it to: an unfloated company merges, the
 * NdM's president choosing among several, or, with none, there is no merger (5.3(c)).
 */
function settleWithoutOffers(state: HydratedStateMex): MergerOutcome {
    const merger = state.ndmMerger
    if (!merger || merger.stage !== 'offering' || mergerOfferee(state)) return {}
    const candidates = unfloatedMergeCandidates(state)
    if (!candidates.length) return noMerger(state)
    if (candidates.length === 1) return { merged: mergeIntoNdm(state, candidates[0]) }
    state.ndmMerger = { ...merger, stage: 'choosing-company' }
    return {}
}

/** The first 5-train starts the merger, if the NdM has floated (5.3(a), (b)). */
function beginNdmMerger(state: HydratedStateMex, event: PhaseOccurrence): MergerOutcome {
    if (!getCompany(state, NdmId).floated) return noMerger(state)
    const train = state.trainInventory.trains.find((entry) => entry.id === event.trainId)
    assert(
        train?.status === 'owned' && train.owner.kind === 'company',
        'A company bought the first 5-train'
    )
    const buyer = presidentPlayer(state, train.owner.companyId)
    assertExists(buyer, 'The 5-train buyer has a president')
    state.ndmMerger = { stage: 'offering', triggerPlayerId: buyer, declinedPlayerIds: [] }
    return settleWithoutOffers(state)
}

const PhaseChangesSchema = Type.Object(
    {
        minorClosures: Type.Optional(Type.Array(MinorClosure)),
        /** The minors close as the next stock round starts (8(c)). */
        minorsClosing: Type.Optional(Type.Literal(true)),
        merger: Type.Optional(MergerOutcome)
    },
    { additionalProperties: false }
)

export type PhaseChangesDetailsMex = Type.Static<typeof PhaseChangesSchema>
const AdvancePhaseValidator = Compile(advancePhaseSchema(PhaseChangesSchema))

/** What a phase change of this title did, read from its Action's metadata. */
export function phaseChangesMex(action: GameAction): PhaseChangesDetailsMex | undefined {
    return action.type === 'AdvancePhase' && AdvancePhaseValidator.Check(action)
        ? action.metadata?.changes
        : undefined
}

/** Phase 3½ closes the minors; phase 5 brings the NdM merger (5.2, 5.3). */
export const PhaseChangesMex: PhaseChanges<typeof PhaseChangesSchema> = {
    schema: PhaseChangesSchema,
    apply(phaseState: PhaseChangeState, event: PhaseOccurrence) {
        const state = requireStateMex(phaseState)
        if (event.toPhaseId === ThreeHalfPhaseId) {
            if (state.options.delayedMinorClose) return { minorsClosing: true as const }
            return { minorClosures: closeMinorsMex(state) }
        }
        if (event.toPhaseId === '5') return { merger: beginNdmMerger(state, event) }
        return {}
    }
}

/** The phase change waits for the merger's decisions (5.3). */
export function mergerDecisionState(state: object): string | undefined {
    return requireStateMex(state).ndmMerger ? MergingIntoNdmState : undefined
}

const MergeIntoNdmAction = titleAction('MergeIntoNdM', {
    companyId: Id,
    metadata: Type.Optional(MergerOutcome)
})
export const MergeIntoNdm = MergeIntoNdmAction.schema
export type MergeIntoNdm = Type.Static<typeof MergeIntoNdm>
export const isMergeIntoNdm = MergeIntoNdmAction.is

/** A player merges one of their floated companies, or the NdM's president an unfloated one. */
export class HydratedMergeIntoNdm extends MergeIntoNdmAction.Base {
    declare playerId: string
    declare companyId: string
    declare metadata?: MergerOutcome
    isValid(state: HydratedStateMex): boolean {
        const merger = state.ndmMerger
        if (this.source !== ActionSource.User || mergerDecider(state) !== this.playerId)
            return false
        if (merger?.stage === 'offering')
            return floatedMergeCandidates(state, this.playerId).includes(this.companyId)
        return (
            merger?.stage === 'choosing-company' &&
            unfloatedMergeCandidates(state).includes(this.companyId)
        )
    }
    apply(state: HydratedStateMex): void {
        assert(this.isValid(state), 'This company cannot merge into the NdM now')
        this.metadata = { merged: mergeIntoNdm(state, this.companyId) }
    }
}

const DeclineNdmMergerAction = titleAction('DeclineNdMMerger', {
    metadata: Type.Optional(MergerOutcome)
})
export const DeclineNdmMerger = DeclineNdmMergerAction.schema
export type DeclineNdmMerger = Type.Static<typeof DeclineNdmMerger>
export const isDeclineNdmMerger = DeclineNdmMergerAction.is

/** A player declines to merge; once all have, an unfloated company may have to (5.3(b), (c)). */
export class HydratedDeclineNdmMerger extends DeclineNdmMergerAction.Base {
    declare playerId: string
    declare metadata?: MergerOutcome
    isValid(state: HydratedStateMex): boolean {
        return this.source === ActionSource.User && mergerOfferee(state) === this.playerId
    }
    apply(state: HydratedStateMex): void {
        assert(this.isValid(state), 'Only the player offered the merger declines it')
        const merger = state.ndmMerger
        assertExists(merger, 'The merger is under way')
        state.ndmMerger = {
            ...merger,
            declinedPlayerIds: [...merger.declinedPlayerIds, this.playerId]
        }
        this.metadata = settleWithoutOffers(state)
    }
}

const ChooseExchangeStationAction = titleAction('ChooseExchangeStation', {
    locationId: Id,
    metadata: Type.Optional(MergerOutcome)
})
export const ChooseExchangeStation = ChooseExchangeStationAction.schema
export type ChooseExchangeStation = Type.Static<typeof ChooseExchangeStation>
export const isChooseExchangeStation = ChooseExchangeStationAction.is

/** The NdM's president chooses which other station its second exchange token replaces (5.3(f)). */
export class HydratedChooseExchangeStation extends ChooseExchangeStationAction.Base {
    declare playerId: string
    declare locationId: string
    declare metadata?: MergerOutcome
    isValid(state: HydratedStateMex): boolean {
        const merger = state.ndmMerger
        return (
            this.source === ActionSource.User &&
            merger?.stage === 'choosing-station' &&
            presidentPlayer(state, NdmId) === this.playerId &&
            !!merger.stationChoices?.some((choice) => choice.locationId === this.locationId)
        )
    }
    apply(state: HydratedStateMex): void {
        assert(this.isValid(state), 'The NdM cannot exchange a station there')
        const position = state.ndmMerger?.stationChoices?.find(
            (choice) => choice.locationId === this.locationId
        )
        assertExists(position, 'The chosen station is one of the choices')
        placeExchangeToken(state, OtherExchangeStationId, position)
        delete state.ndmMerger
        this.metadata = { exchangedLocationId: this.locationId }
    }
}

export const MergerActions = [
    MergeIntoNdmAction.define((action) => new HydratedMergeIntoNdm(action)),
    DeclineNdmMergerAction.define((action) => new HydratedDeclineNdmMerger(action)),
    ChooseExchangeStationAction.define((action) => new HydratedChooseExchangeStation(action))
]

function isMergerAction(
    action: HydratedAction
): action is HydratedMergeIntoNdm | HydratedDeclineNdmMerger | HydratedChooseExchangeStation {
    return (
        action instanceof HydratedMergeIntoNdm ||
        action instanceof HydratedDeclineNdmMerger ||
        action instanceof HydratedChooseExchangeStation
    )
}

/** The players' and the NdM president's merger decisions; the phase change then goes on. */
export const MergingIntoNdmHandler: StateHandlerMex = {
    isValidAction: (action, context) => isMergerAction(action) && action.isValid(context.gameState),
    validActionsForPlayer(playerId, context) {
        const state = context.gameState
        if (mergerDecider(state) !== playerId) return []
        const stage = state.ndmMerger?.stage
        if (stage === 'offering') return [MergeIntoNdmAction.type, DeclineNdmMergerAction.type]
        if (stage === 'choosing-company') return [MergeIntoNdmAction.type]
        return [ChooseExchangeStationAction.type]
    },
    enter(context) {
        const decider = mergerDecider(context.gameState)
        if (decider) context.gameState.activePlayerIds = [decider]
    },
    onAction: (_action, context) =>
        context.gameState.ndmMerger
            ? MergingIntoNdmState
            : continuePhaseChange(context.gameState, { decisionState: mergerDecisionState })
}

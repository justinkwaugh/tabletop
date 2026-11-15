import {
    ActionSource,
    assert,
    assertExists,
    type HydratedAction,
    type MachineContext
} from '@tabletop/common'
import {
    BetweenCompaniesState,
    CashPayment,
    Nationalisation,
    Owner,
    RoundEnd,
    SystemActionFirstHandler,
    closeShareCompany,
    continuePhaseChange,
    controllingOwner,
    getCompany,
    isAdvancePhase,
    nextOperatingCompany,
    operatingRoundEnd,
    settleCashPayments,
    systemAction,
    titleAction,
    trainsOwnedBy
} from '@tabletop/18xx'
import * as Type from 'typebox'
import { RsrId, isMajor1861, isMinor1861 } from './companies.js'
import {
    RsrMoscowStationId,
    nationalise1861,
    placeRsrHome,
    placeRsrMoscowStation,
    rsrOperates
} from './national.js'
import { EndingRules1861, OperatingRules1861, PhaseRules1861 } from './operating.js'
import { PrivateCatalog1861, PrivateIds1861 } from './privates.js'
import { TrainlessMajorsState, type HydratedState1861, type StateHandler1861 } from './state.js'
import { MoscowGreyTileId } from './tiles.js'
import {
    MajorStartPhaseId,
    MinorAuctionEndPhaseId,
    MinorNationalisationPhaseId,
    PrivateNationalisationPhaseId,
    TrainlessNationalisationPhaseIds
} from './trains.js'
import { MoscowLocationId, StPetersburgLocationId } from './map.js'

const Id = Type.String({ minLength: 1 })

const PrivateNationalisation = Type.Object(
    { privateId: Id, owner: Owner, payment: CashPayment },
    { additionalProperties: false }
)

const ApplyPhaseEffectsAction = systemAction('ApplyPhaseEffects', {
    phaseId: Id,
    /** Where play goes once the phase's effects and decisions are done. */
    continuation: Id,
    metadata: Type.Optional(
        Type.Object(
            {
                rsrStarted: Type.Optional(Type.Literal(true)),
                /** Where the RSR placed its reserved stations as phase 8 began. */
                rsrStationLocationIds: Type.Optional(Type.Array(Id)),
                withdrawnMinorIds: Type.Array(Id),
                privates: Type.Array(PrivateNationalisation),
                nationalisations: Type.Array(Nationalisation),
                trainlessMajorIds: Type.Array(Id),
                /** The operating round, when the company whose turn it was is nationalised last. */
                roundEnd: Type.Optional(RoundEnd)
            },
            { additionalProperties: false }
        )
    )
})
export const ApplyPhaseEffects = ApplyPhaseEffectsAction.schema
export type ApplyPhaseEffects = Type.Static<typeof ApplyPhaseEffects>
export const isApplyPhaseEffects = ApplyPhaseEffectsAction.is

const EffectPhaseIds = [
    MajorStartPhaseId,
    MinorAuctionEndPhaseId,
    ...TrainlessNationalisationPhaseIds
]

function operatingOrder(state: HydratedState1861): string[] {
    return OperatingRules1861.companyOrder(state)
}

const trainless = (state: HydratedState1861, companyId: string) =>
    !trainsOwnedBy(state, { kind: 'company', companyId }).length

/** Phase 4 starts the RSR, which operates from the round in which the first 4-train is bought (§7.4). */
function startRsr(state: HydratedState1861): boolean {
    const rsr = getCompany(state, RsrId)
    if (rsr.started) return false
    rsr.started = true
    rsr.floated = true
    rsr.funded = true
    const set = state.operatingSet
    if (set && !set.completed && !set.companyOrder.includes(RsrId) && rsrOperates(state))
        set.companyOrder = [...set.companyOrder, RsrId]
    return true
}

/** From phase 5 no minor can be started; those unsold leave the game with their homes (§8, §10.5). */
function withdrawUnsoldMinors(state: HydratedState1861): string[] {
    const withdrawn = state.companies.filter(
        (company) => isMinor1861(company.id) && !company.started && !company.closed
    )
    for (const company of withdrawn) closeShareCompany(state, company.id, 'removed')
    return withdrawn.map((company) => company.id)
}

/** Phase 6 nationalises every private: its owner receives its face value, the RSR the private (§11). */
function nationalisePrivates(state: HydratedState1861) {
    return PrivateIds1861.flatMap((privateId) => {
        const certificate = state.certificates.find(
            (entry) => entry.kind === 'private' && entry.companyId === privateId
        )
        if (!certificate || getCompany(state, privateId).closed) return []
        const owner = certificate.owner
        if (owner.kind === 'bank' || (owner.kind === 'company' && owner.companyId === RsrId))
            return []
        const payment: CashPayment = {
            from: { kind: 'bank' },
            to: structuredClone(owner),
            amount: PrivateCatalog1861.definition(privateId).faceValue
        }
        settleCashPayments(state, [payment])
        certificate.owner = { kind: 'company', companyId: RsrId }
        return [{ privateId, owner: structuredClone(owner), payment }]
    })
}

function applyPhaseEffects(
    state: HydratedState1861,
    phaseId: string,
    operatingCompanyId: string | undefined
) {
    const rsrStarted = phaseId === MajorStartPhaseId && startRsr(state)
    const withdrawnMinorIds = phaseId === MinorAuctionEndPhaseId ? withdrawUnsoldMinors(state) : []
    const privates = phaseId === PrivateNationalisationPhaseId ? nationalisePrivates(state) : []
    if (phaseId === MinorNationalisationPhaseId) {
        const set = state.operatingSet
        assertExists(set, 'The first 8-train is bought in an operating round')
        state.phaseEightAt = { set: set.number, round: set.roundNumber }
        // The RSR no longer operates once the first 8-train is bought (§7.4).
        if (nextOperatingCompany(state) !== RsrId)
            set.companyOrder = set.companyOrder.filter(
                (id) => id !== RsrId || set.completedCompanyIds.includes(id)
            )
    }
    const nationalisations: Nationalisation[] = []
    const trainlessMajorIds: string[] = []
    if (TrainlessNationalisationPhaseIds.includes(phaseId))
        for (const companyId of operatingOrder(state)) {
            const company = getCompany(state, companyId)
            if (company.closed || !company.started) continue
            if (isMinor1861(companyId)) {
                if (
                    phaseId === MinorNationalisationPhaseId ||
                    (company.operated && trainless(state, companyId))
                )
                    nationalisations.push(nationalise1861(state, companyId, operatingCompanyId))
            } else if (isMajor1861(companyId) && company.operated && trainless(state, companyId))
                trainlessMajorIds.push(companyId)
        }
    // The RSR stops operating and places its reserved stations still in hand (GTG §8.13, §11).
    const rsrStationLocationIds =
        phaseId === MinorNationalisationPhaseId
            ? [
                  ...(placeRsrHome(state) ? [StPetersburgLocationId] : []),
                  ...(placeRsrMoscowStation(state) ? [MoscowLocationId] : [])
              ]
            : []
    return {
        ...(rsrStarted ? { rsrStarted: true as const } : {}),
        ...(rsrStationLocationIds.length ? { rsrStationLocationIds } : {}),
        withdrawnMinorIds,
        privates,
        nationalisations,
        trainlessMajorIds
    }
}

/**
 * A minor nationalised as phase 8 begins in its own turn, having bought the first 8-train, has
 * ended that turn: play goes on between companies, its director the owner of the ended turn.
 */
function endedOperatingTurn(state: HydratedState1861, operatingCompanyId: string | undefined) {
    if (
        !operatingCompanyId ||
        !state.operatingSet?.completedCompanyIds.includes(operatingCompanyId)
    )
        return undefined
    if (state.phaseChange) state.phaseChange.continuation = { machineState: BetweenCompaniesState }
    return { roundEnd: operatingRoundEnd(state, EndingRules1861) }
}

class HydratedApplyPhaseEffects extends ApplyPhaseEffectsAction.Base implements ApplyPhaseEffects {
    declare type: 'ApplyPhaseEffects'
    declare phaseId: string
    declare continuation: string
    declare metadata?: ApplyPhaseEffects['metadata']
    apply(state: HydratedState1861): void {
        assert(
            this.source === ActionSource.System &&
                state.phaseId === this.phaseId &&
                !state.trainlessMajors,
            'A phase’s effects apply once, by the system'
        )
        const operatingCompanyId = nextOperatingCompany(state)
        const effects = applyPhaseEffects(state, this.phaseId, operatingCompanyId)
        const ended = endedOperatingTurn(state, operatingCompanyId)
        this.metadata = ended?.roundEnd ? { ...effects, roundEnd: ended.roundEnd } : effects
        state.trainlessMajors = {
            companyIds: this.metadata.trainlessMajorIds,
            continuation: ended ? BetweenCompaniesState : this.continuation,
            activePlayerIds: [...state.activePlayerIds]
        }
    }
}

const DecideTrainlessMajorAction = titleAction('DecideTrainlessMajor', {
    companyId: Id,
    nationalise: Type.Boolean(),
    metadata: Type.Optional(
        Type.Object(
            { nationalisation: Type.Optional(Nationalisation) },
            { additionalProperties: false }
        )
    )
})
export const DecideTrainlessMajor = DecideTrainlessMajorAction.schema
export type DecideTrainlessMajor = Type.Static<typeof DecideTrainlessMajor>
export const isDecideTrainlessMajor = DecideTrainlessMajorAction.is

function deciding(state: HydratedState1861): { companyId: string; playerId: string } | undefined {
    const companyId = state.trainlessMajors?.companyIds[0]
    if (!companyId) return undefined
    const director = controllingOwner(state, companyId)
    assertExists(director, 'A public company has a director')
    return { companyId, playerId: director.playerId }
}

/** The director of a public company left trainless as the phase begins chooses (§11). */
class HydratedDecideTrainlessMajor
    extends DecideTrainlessMajorAction.Base
    implements DecideTrainlessMajor
{
    declare type: 'DecideTrainlessMajor'
    declare playerId: string
    declare companyId: string
    declare nationalise: boolean
    declare metadata?: DecideTrainlessMajor['metadata']
    apply(state: HydratedState1861): void {
        const current = deciding(state)
        assert(
            this.source === ActionSource.User &&
                current?.companyId === this.companyId &&
                current.playerId === this.playerId,
            'The director decides for their trainless company'
        )
        const pending = state.trainlessMajors
        assertExists(pending, 'Trainless public companies are being decided')
        pending.companyIds = pending.companyIds.slice(1)
        this.metadata = this.nationalise
            ? { nationalisation: nationalise1861(state, this.companyId) }
            : {}
    }
}

export const PhaseEffectActions1861 = [
    ApplyPhaseEffectsAction.define((action) => new HydratedApplyPhaseEffects(action)),
    DecideTrainlessMajorAction.define((action) => new HydratedDecideTrainlessMajor(action))
]

/** After a phase's trains rust come its title effects, in a state of their own (§8, §11). */
export function appliesPhaseEffects(handler: StateHandler1861): StateHandler1861 {
    return {
        enter: (context) => handler.enter(context),
        isValidAction: (action, context) => handler.isValidAction(action, context),
        validActionsForPlayer: (playerId, context) =>
            handler.validActionsForPlayer(playerId, context),
        onAction(action, context) {
            const next = handler.onAction(action, context)
            const phaseId = context.gameState.phaseId
            if (!isAdvancePhase(action) || !EffectPhaseIds.includes(phaseId)) return next
            context.addSystemAction(ApplyPhaseEffects, { phaseId, continuation: next })
            return TrainlessMajorsState
        }
    }
}

/** Where the phase's effects wait for the system, then for each trainless company's director. */
export class TrainlessMajorsHandler implements StateHandler1861 {
    isValidAction(action: HydratedAction, context: MachineContext<HydratedState1861>): boolean {
        const state = context.gameState
        if (isApplyPhaseEffects(action))
            return action.source === ActionSource.System && !state.trainlessMajors
        return isDecideTrainlessMajor(action) && deciding(state)?.playerId === action.playerId
    }
    validActionsForPlayer(playerId: string, context: MachineContext<HydratedState1861>): string[] {
        return deciding(context.gameState)?.playerId === playerId ? ['DecideTrainlessMajor'] : []
    }
    enter(context: MachineContext<HydratedState1861>): void {
        const current = deciding(context.gameState)
        if (current) context.gameState.activePlayerIds = [current.playerId]
    }
    onAction(_action: HydratedAction, context: MachineContext<HydratedState1861>): string {
        const state = context.gameState
        const pending = state.trainlessMajors
        assertExists(pending, 'Trainless public companies are being decided')
        if (pending.companyIds.length) return TrainlessMajorsState
        delete state.trainlessMajors
        if (state.phaseChange) return continuePhaseChange(state, PhaseRules1861)
        state.activePlayerIds = pending.activePlayerIds
        return pending.continuation
    }
}

const NationaliseCompanyAction = systemAction('NationaliseCompany', {
    companyId: Id,
    metadata: Type.Optional(Nationalisation)
})
export const NationaliseCompany = NationaliseCompanyAction.schema
export type NationaliseCompany = Type.Static<typeof NationaliseCompany>
export const isNationaliseCompany = NationaliseCompanyAction.is

/** The company that has just ended its turn without a train, which is nationalised (§10.10). */
function trainlessFinisher(state: HydratedState1861): string | undefined {
    const companyId = state.operatingSet?.completedCompanyIds.at(-1)
    if (!companyId || companyId === RsrId) return undefined
    const company = getCompany(state, companyId)
    return company.started && !company.closed && trainless(state, companyId) ? companyId : undefined
}

class HydratedNationaliseCompany
    extends NationaliseCompanyAction.Base
    implements NationaliseCompany
{
    declare type: 'NationaliseCompany'
    declare companyId: string
    declare metadata?: NationaliseCompany['metadata']
    apply(state: HydratedState1861): void {
        assert(
            this.source === ActionSource.System && trainlessFinisher(state) === this.companyId,
            'A company that ends its turn without a train is nationalised'
        )
        this.metadata = nationalise1861(state, this.companyId)
    }
}

const PlaceStateStationAction = systemAction('PlaceStateStation', {
    locationId: Id
})
export const PlaceStateStation = PlaceStateStationAction.schema
export type PlaceStateStation = Type.Static<typeof PlaceStateStation>
export const isPlaceStateStation = PlaceStateStationAction.is

/** The RSR's first operation puts its St. Petersburg station down (§7.4). */
function rsrHomeDue(state: HydratedState1861): boolean {
    return (
        nextOperatingCompany(state) === RsrId &&
        !state.trackStep &&
        !state.stations.some(
            (station) =>
                station.companyId === RsrId &&
                station.status === 'placed' &&
                station.position.locationId === StPetersburgLocationId
        )
    )
}

/** Moscow's grey tile takes an RSR station (§7.4). */
function rsrMoscowDue(state: HydratedState1861): boolean {
    return (
        state.tileInventory.placements[MoscowLocationId]?.definitionId === MoscowGreyTileId &&
        !state.stations.some(
            (station) =>
                station.companyId === RsrId &&
                station.status === 'placed' &&
                station.position.locationId === MoscowLocationId
        ) &&
        state.stations.some(
            (station) => station.id === RsrMoscowStationId && station.status === 'available'
        )
    )
}

class HydratedPlaceStateStation extends PlaceStateStationAction.Base implements PlaceStateStation {
    declare type: 'PlaceStateStation'
    declare locationId: string
    apply(state: HydratedState1861): void {
        assert(this.source === ActionSource.System, 'The RSR’s stations are placed by the system')
        const placed =
            this.locationId === MoscowLocationId
                ? placeRsrMoscowStation(state)
                : placeRsrHome(state)
        assert(placed, 'The RSR’s station has a space')
    }
}

export const NationalActions1861 = [
    NationaliseCompanyAction.define((action) => new HydratedNationaliseCompany(action)),
    PlaceStateStationAction.define((action) => new HydratedPlaceStateStation(action))
]

/** Between companies: a trainless finisher is nationalised, and the RSR's home placed (§7.4, §10.10). */
export function nationalisesBetweenCompanies(handler: StateHandler1861): StateHandler1861 {
    return new SystemActionFirstHandler(
        new SystemActionFirstHandler(handler, PlaceStateStation, (state) =>
            rsrHomeDue(state) ? { locationId: StPetersburgLocationId } : undefined
        ),
        NationaliseCompany,
        (state) => {
            const companyId = trainlessFinisher(state)
            return companyId ? { companyId } : undefined
        }
    )
}

/** A Moscow upgrade to grey gives the RSR its station there at once (§7.4). */
export function placesMoscowStation(handler: StateHandler1861): StateHandler1861 {
    return new SystemActionFirstHandler(handler, PlaceStateStation, (state) =>
        rsrMoscowDue(state) ? { locationId: MoscowLocationId } : undefined
    )
}

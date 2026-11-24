import { ActionSource, assert, assertExists, type HydratedAction } from '@tabletop/common'
import {
    CashPayment,
    RailwayMapState,
    RevenueCenter,
    RouteNetwork,
    SystemActionFirstHandler,
    StepActionsHandler,
    abandonOperatingTurn,
    controllingOwner,
    finiteCashOwnedBy,
    getCompany,
    hasTurnMark,
    homeStationId,
    markTurn,
    nextOperatingCompany,
    privateOwner,
    replaceStation,
    routeRevenue,
    settleCashPayments,
    standingRunInstructionFor,
    systemAction,
    titleAction,
    trainsOwnedBy,
    type FinancialState,
    type OperatingResult,
    type PurchaseOffer,
    type RoutePath,
    type RoutePayment,
    type StepAction
} from '@tabletop/18xx'
import * as Type from 'typebox'
import { directorStepAction } from './directorStep.js'
import { AdrianLocationId, CoalfieldsLocationId, Map1828, PeterboroughLocationId } from './map.js'
import { CobourgRailwayId, CpId, EkId } from './ids.js'
import { requireState1828, type HydratedState1828, type StateHandler1828 } from './state.js'
import { TileSet1828 } from './tiles.js'
import { revenueStage1828 } from './trains.js'

/** Whether the C&P lays its tile this round: its private open and a player's (§8.1). */
export function cobourgOperates(
    state: Pick<FinancialState, 'companies' | 'certificates'>
): boolean {
    return (
        !getCompany(state, CobourgRailwayId).closed &&
        !getCompany(state, CpId).closed &&
        privateOwner(state, CpId)?.kind === 'player'
    )
}

/** A run the C&P may pay for: two revenue centres on one line of track that includes its tile. */
export type CobourgRun = {
    stops: RevenueCenter[]
    revenue: number
    /** The track the run follows, which reaches the tile where it lies off one end. */
    paths: RoutePath[]
    payments: RoutePayment[]
}

function sameStops(first: readonly RevenueCenter[], second: readonly RevenueCenter[]): boolean {
    const key = (stops: readonly RevenueCenter[]) =>
        stops
            .map((stop) => `${stop.locationId}.${stop.nodeId}`)
            .sort()
            .join('|')
    return key(first) === key(second)
}

/** The hex of the tile the C&P laid or upgraded this turn (§13.2.2.5). */
function cobourgTile(state: HydratedState1828): string | undefined {
    const step = state.trackStep
    return step?.companyId === CobourgRailwayId ? step.lays[0]?.locationId : undefined
}

/**
 * The runs of half a 2-train the C&P's owner may choose among, the best first (§13.2.2.5): two
 * revenue centres joined by one line of track that includes the tile, and a revenue centre on the
 * tile if it has one; the tile may lie between them or off one end. A run is its pair of stops,
 * whatever track joins them. Other companies' stations do not block it, as it runs no train; the
 * Coalfields stay closed to it.
 */
export function cobourgRuns(state: HydratedState1828): CobourgRun[] {
    const tileId = cobourgTile(state)
    if (!tileId) return []
    const mapState = new RailwayMapState(Map1828, TileSet1828, state.tileInventory)
    const network = new RouteNetwork(mapState)
    const tileStops = network.face(tileId).nodes.some((node) => node.kind !== 'junction')
    const stages = revenueStage1828(state.phaseId)
    const runs: CobourgRun[] = []
    for (const start of network.centers()) {
        if (start.locationId === CoalfieldsLocationId) continue
        network.walk(start, {}, (walk) => {
            const visits = walk.visits
            if (visits.some((visit) => visit.locationId === CoalfieldsLocationId)) return false
            if (visits.length > 2) return false
            const onTile =
                visits.some((visit) => visit.locationId === tileId) ||
                (!tileStops && walk.paths.some((path) => path.locationId === tileId))
            const stops = visits.map(({ locationId, nodeId }) => ({ locationId, nodeId }))
            if (visits.length === 2 && onTile && !runs.some((run) => sameStops(run.stops, stops))) {
                const payments = visits.map(({ locationId, nodeId, node }) => ({
                    locationId,
                    nodeId,
                    amount: routeRevenue(node.revenue, stages)
                }))
                runs.push({
                    stops,
                    revenue: payments.reduce((sum, payment) => sum + payment.amount, 0),
                    paths: walk.paths.map((path) => ({ ...path })),
                    payments
                })
            }
            // The tile may lie beyond the second stop, off that end of the run.
            return true
        })
    }
    return runs.sort((first, second) => second.revenue - first.revenue)
}

/** One run for each amount: runs paying the same come to the same for owner and treasury. */
export function oneRunPerRevenue(runs: readonly CobourgRun[]): CobourgRun[] {
    return runs.filter(
        (run, index) => runs.findIndex(({ revenue }) => revenue === run.revenue) === index
    )
}

/** A run as the table shows any company's: the C&P's half 2-train on its route. */
export function cobourgRunResult(state: HydratedState1828, run: CobourgRun): OperatingResult {
    const train = trainsOwnedBy(state, { kind: 'company', companyId: CobourgRailwayId })[0]
    assertExists(train, 'The C&P has its train')
    return {
        companyId: CobourgRailwayId,
        revenue: run.revenue,
        routes: [
            {
                trainId: train.id,
                definitionId: train.definitionId,
                start: run.stops[0],
                paths: run.paths,
                visits: run.stops,
                payments: run.payments,
                distance: run.stops.length,
                revenue: run.revenue
            }
        ]
    }
}

const RunMetadata = Type.Object(
    {
        stops: Type.Array(RevenueCenter),
        revenue: Type.Integer({ minimum: 0 }),
        payments: Type.Array(CashPayment)
    },
    { additionalProperties: false }
)

/** What a run pays each of the C&P's owner and its treasury (§13.2.2.5). */
export function cobourgRunHalf(run: Pick<CobourgRun, 'revenue'>): number {
    return run.revenue / 2
}

/**
 * Pays a run's half to the C&P's owner and half to its treasury, and ends its turn
 * (§13.2.2.5).
 */
function settleCobourgRun(
    state: HydratedState1828,
    run: CobourgRun | undefined
): Type.Static<typeof RunMetadata> {
    const owner = controllingOwner(state, CobourgRailwayId)
    assertExists(owner, 'The C&P has an owner')
    const half = run ? cobourgRunHalf(run) : 0
    const payments: CashPayment[] = half
        ? [
              { from: { kind: 'bank' }, to: { ...owner }, amount: half },
              {
                  from: { kind: 'bank' },
                  to: { kind: 'company', companyId: CobourgRailwayId },
                  amount: half
              }
          ]
        : []
    settleCashPayments(state, payments)
    abandonOperatingTurn(state, CobourgRailwayId)
    return { stops: run?.stops ?? [], revenue: run?.revenue ?? 0, payments }
}

export function cobourgRunning(state: HydratedState1828): boolean {
    return (
        state.machineState === 'RunningTrains' && nextOperatingCompany(state) === CobourgRailwayId
    )
}

const ChooseCobourgRunAction = titleAction('ChooseCobourgRun', {
    stops: Type.Array(RevenueCenter, { minItems: 2, maxItems: 2 }),
    metadata: Type.Optional(RunMetadata)
})
export const ChooseCobourgRun = ChooseCobourgRunAction.schema
export type ChooseCobourgRun = Type.Static<typeof ChooseCobourgRun>
export const isChooseCobourgRun = ChooseCobourgRunAction.is

/** The C&P's owner chooses the run its tile pays for, any of them (§13.2.2.5). */
class HydratedChooseCobourgRun extends ChooseCobourgRunAction.Base implements ChooseCobourgRun {
    declare type: 'ChooseCobourgRun'
    declare playerId: string
    declare stops: RevenueCenter[]
    declare metadata?: ChooseCobourgRun['metadata']
    run(state: HydratedState1828): CobourgRun | undefined {
        return cobourgRuns(state).find((run) => sameStops(run.stops, this.stops))
    }
    isValid(state: HydratedState1828): boolean {
        return (
            this.source === ActionSource.User &&
            cobourgRunning(state) &&
            controllingOwner(state, CobourgRailwayId)?.playerId === this.playerId &&
            !!this.run(state)
        )
    }
    apply(state: HydratedState1828): void {
        assert(this.isValid(state), 'The C&P cannot pay for this run')
        this.metadata = settleCobourgRun(state, this.run(state))
    }
}

function cobourgAutorun(state: HydratedState1828): boolean {
    const standing = standingRunInstructionFor(state, CobourgRailwayId)
    return !!standing && standing.playerId === controllingOwner(state, CobourgRailwayId)?.playerId
}

function cobourgRunDue(state: HydratedState1828): boolean {
    return cobourgRunning(state) && (!cobourgRuns(state).length || cobourgAutorun(state))
}

const RunCobourgAction = systemAction('RunCobourg', { metadata: Type.Optional(RunMetadata) })
export const RunCobourg = RunCobourgAction.schema
export type RunCobourg = Type.Static<typeof RunCobourg>
export const isRunCobourg = RunCobourgAction.is

/**
 * The C&P's run when its owner has no choice to make: on Autorun it takes the best, and without
 * a tile or a run through it, it pays nothing (§13.2.2.5).
 */
class HydratedRunCobourg extends RunCobourgAction.Base implements RunCobourg {
    declare type: 'RunCobourg'
    declare metadata?: RunCobourg['metadata']
    apply(state: HydratedState1828): void {
        assert(
            this.source === ActionSource.System && cobourgRunDue(state),
            'The C&P runs by itself only on Autorun or without a run'
        )
        this.metadata = settleCobourgRun(state, cobourgRuns(state)[0])
    }
}

/**
 * The C&P's run step, in place of running trains: its owner chooses a run, or it runs by itself
 * (§13.2.2.5).
 */
export function runsCobourg(handler: StateHandler1828): StateHandler1828 {
    const choosing: StateHandler1828 = {
        isValidAction(action, context) {
            if (!cobourgRunning(context.gameState)) return handler.isValidAction(action, context)
            return action instanceof HydratedChooseCobourgRun && action.isValid(context.gameState)
        },
        validActionsForPlayer(playerId, context) {
            const state = context.gameState
            if (!cobourgRunning(state)) return handler.validActionsForPlayer(playerId, context)
            return controllingOwner(state, CobourgRailwayId)?.playerId === playerId
                ? ['ChooseCobourgRun']
                : []
        },
        enter(context) {
            const state = context.gameState
            if (!cobourgRunning(state)) {
                handler.enter(context)
                return
            }
            const owner = controllingOwner(state, CobourgRailwayId)
            assertExists(owner, 'The C&P has an owner')
            state.activePlayerIds = [owner.playerId]
        },
        onAction(action, context) {
            return action instanceof HydratedChooseCobourgRun
                ? 'OperatingSet'
                : handler.onAction(action, context)
        }
    }
    return new SystemActionFirstHandler(
        choosing,
        RunCobourg,
        (state) => (cobourgRunDue(state) ? {} : undefined),
        'OperatingSet'
    )
}

/**
 * The family's Autorun lays nothing and runs trains; the C&P's turn is its tile and the run through
 * it, so its owner still lays and {@link runsCobourg} takes the run.
 */
export function cobourgRunHeld(state: object): boolean {
    return nextOperatingCompany(requireState1828(state)) === CobourgRailwayId
}

/** The C&P's station a buyer may still replace with its own, this turn (§13.2.2.5). */
const ReplacementMark = 'cobourg-station'
const RefusalMark = 'cobourg-station-refused'

function cobourgStation(state: HydratedState1828) {
    const station = state.stations.find((entry) => entry.id === homeStationId(CobourgRailwayId))
    return station?.status === 'placed' ? station : undefined
}

/**
 * Whether the operating company, which bought the C&P this turn before placing a station, may
 * still put one of its own in Peterborough in place of the C&P's.
 */
export function cobourgReplacementOpen(state: HydratedState1828, companyId: string): boolean {
    return (
        hasTurnMark(state, ReplacementMark) &&
        !hasTurnMark(state, RefusalMark) &&
        nextOperatingCompany(state) === companyId &&
        !!cobourgStation(state) &&
        !placedStationThisTurn(state, companyId) &&
        // A company may hold only one station in a hex (§8.3.2).
        !state.stations.some(
            (station) =>
                station.companyId === companyId &&
                station.status === 'placed' &&
                station.position.locationId === PeterboroughLocationId
        ) &&
        state.stations.some(
            (station) => station.companyId === companyId && station.status === 'available'
        )
    )
}

function placedStationThisTurn(state: HydratedState1828, companyId: string): boolean {
    return (
        state.stationStep?.companyId === companyId && state.stationStep.placedStationIds.length > 0
    )
}

/**
 * A company buying the C&P takes its treasury; its railway closes, its station staying in
 * Peterborough unless the buyer replaces it (§13.2.2.5).
 */
export function cobourgPurchased(state: object, offer: PurchaseOffer): void {
    if (offer.asset.kind !== 'private' || offer.asset.privateCompanyId !== CpId) return
    const title = requireState1828(state)
    const railway = getCompany(title, CobourgRailwayId)
    if (railway.closed) return
    const cash = finiteCashOwnedBy(title, { kind: 'company', companyId: CobourgRailwayId })
    if (cash)
        settleCashPayments(title, [
            {
                from: { kind: 'company', companyId: CobourgRailwayId },
                to: { kind: 'company', companyId: offer.buyer.companyId },
                amount: cash
            }
        ])
    railway.closed = true
    if (!placedStationThisTurn(title, offer.buyer.companyId)) markTurn(title, ReplacementMark)
}

/** A company buying the E&K lays a yellow tile in Adrian & Ann Arbor at once (§13.2.2.7). */
export function erieKalamazooPurchased(state: object, offer: PurchaseOffer): void {
    if (offer.asset.kind !== 'private' || offer.asset.privateCompanyId !== EkId) return
    const title = requireState1828(state)
    if (title.tileInventory.placements[AdrianLocationId]) return
    const director = controllingOwner(title, offer.buyer.companyId)
    assertExists(director, 'The buying company has a director')
    title.privateTrackLay = { privateCompanyId: EkId, playerId: director.playerId, required: true }
}

const ReplaceCobourgStationAction = titleAction('ReplaceCobourgStation', {
    companyId: Type.String({ minLength: 1 }),
    replace: Type.Boolean()
})
export const ReplaceCobourgStation = ReplaceCobourgStationAction.schema
export type ReplaceCobourgStation = Type.Static<typeof ReplaceCobourgStation>
export const isReplaceCobourgStation = ReplaceCobourgStationAction.is

/**
 * The buyer of the C&P puts one of its stations in Peterborough in place of the C&P's, as its
 * station this round, or leaves the C&P's there as a blocking station (§13.2.2.5).
 */
class HydratedReplaceCobourgStation
    extends ReplaceCobourgStationAction.Base
    implements ReplaceCobourgStation
{
    declare type: 'ReplaceCobourgStation'
    declare playerId: string
    declare companyId: string
    declare replace: boolean
    isValid(state: HydratedState1828): boolean {
        return (
            this.source === ActionSource.User &&
            controllingOwner(state, this.companyId)?.playerId === this.playerId &&
            cobourgReplacementOpen(state, this.companyId)
        )
    }
    apply(state: HydratedState1828): void {
        assert(this.isValid(state), 'The C&P’s station cannot be replaced now')
        if (!this.replace) {
            markTurn(state, RefusalMark)
            return
        }
        const old = cobourgStation(state)
        assertExists(old, 'The C&P’s station stands in Peterborough')
        const replacement = state.stations.find(
            (station) => station.companyId === this.companyId && station.status === 'available'
        )
        assertExists(replacement, 'The company has a station to place')
        replaceStation(state, old.id, replacement.id)
        // The replacement is the round's station, even before the station step opens (§8.3.2).
        state.stationStep ??= {
            companyId: this.companyId,
            placedStationIds: [],
            completed: false
        }
        state.stationStep.placedStationIds = [...state.stationStep.placedStationIds, replacement.id]
        markTurn(state, RefusalMark)
    }
}

export const ReplaceCobourgStationStep: StepAction<HydratedState1828> = directorStepAction(
    'ReplaceCobourgStation',
    (action: HydratedAction): action is HydratedReplaceCobourgStation =>
        action instanceof HydratedReplaceCobourgStation,
    cobourgReplacementOpen
)

export function offersCobourgStation(handler: StateHandler1828): StateHandler1828 {
    return new StepActionsHandler(handler, [ReplaceCobourgStationStep])
}

const CloseCobourgAction = systemAction('CloseCobourg', {
    metadata: Type.Optional(
        Type.Object({ payments: Type.Array(CashPayment) }, { additionalProperties: false })
    )
})
export const CloseCobourg = CloseCobourgAction.schema
export type CloseCobourg = Type.Static<typeof CloseCobourg>
export const isCloseCobourg = CloseCobourgAction.is

function cobourgClosureDue(state: HydratedState1828): boolean {
    return getCompany(state, CpId).closed === true && !getCompany(state, CobourgRailwayId).closed
}

/**
 * The C&P closing unbought discards its treasury; its station stays in Peterborough as a blocking
 * station (§13.2.2.5).
 */
class HydratedCloseCobourg extends CloseCobourgAction.Base implements CloseCobourg {
    declare type: 'CloseCobourg'
    declare metadata?: CloseCobourg['metadata']
    apply(state: HydratedState1828): void {
        assert(
            this.source === ActionSource.System && cobourgClosureDue(state),
            'The C&P closes once its private has'
        )
        const cash = finiteCashOwnedBy(state, { kind: 'company', companyId: CobourgRailwayId })
        const payments: CashPayment[] = cash
            ? [
                  {
                      from: { kind: 'company', companyId: CobourgRailwayId },
                      to: { kind: 'bank' },
                      amount: cash
                  }
              ]
            : []
        settleCashPayments(state, payments)
        getCompany(state, CobourgRailwayId).closed = true
        this.metadata = { payments }
    }
}

/** Between companies, a closed C&P private closes its railway. */
export function closesCobourg(handler: StateHandler1828): StateHandler1828 {
    return new SystemActionFirstHandler(handler, CloseCobourg, (state) =>
        cobourgClosureDue(state) ? {} : undefined
    )
}

/** The C&P's owner, who runs it while a player holds its private (§13.2.2.5). */
export function setCobourgOwner(state: HydratedState1828, playerId: string): void {
    getCompany(state, CobourgRailwayId).president = { kind: 'player', playerId }
}

export const CobourgActions1828 = [
    ChooseCobourgRunAction.define((action) => new HydratedChooseCobourgRun(action)),
    RunCobourgAction.define((action) => new HydratedRunCobourg(action)),
    ReplaceCobourgStationAction.define((action) => new HydratedReplaceCobourgStation(action)),
    CloseCobourgAction.define((action) => new HydratedCloseCobourg(action))
]

import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    assertExists,
    type HydratedAction,
    type MachineContext
} from '@tabletop/common'
import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import { EighteenXXPlayerAction } from '../actions/eighteenXXPlayerAction.js'
import { controllingOwner, getCompany } from '../finance/finance.js'
import type { HydratedEighteenXXState } from '../game/eighteenXXState.js'
import type { EighteenXXStateHandler } from '../game/eighteenXXTitleRules.js'
import { SystemActionFirstHandler } from '../game/systemActionFirstHandler.js'
import { RailwayMapState } from '../map/mapState.js'
import { companyStationCenters } from '../map/station.js'
import { reorderPendingOperatingCompanies, type OperatingState } from '../operating/operatingSet.js'
import type { RevenueCenter } from '../routes/route.js'
import { RouteEvaluation, type RouteRules } from '../routes/routeEvaluation.js'
import { routeRevenue } from '../routes/routeRevenue.js'
import type { PaidConnectionBonus } from '../routes/routeScoring.js'
import { RouteNetwork } from '../routes/routeNetwork.js'
import type { TrainDefinition } from '../trains/train.js'
import { trainsOwnedBy } from '../trains/train.js'
import { connectedWithin } from './destinationConnection.js'

const Id = Type.String({ minLength: 1 })

export const PlacingDestinationStationState = 'PlacingDestinationStation'
export const DestinationStationSource = 'destination'
export const DestinationBonusSource = 'destination'

export const DestinationRunFields = {
    destinationRun: Type.Optional(Type.Object({ companyId: Id }, { additionalProperties: false })),
    destinationRunsMade: Type.Array(Id, { uniqueItems: true }),
    destinationStations: Type.Array(Id, { uniqueItems: true })
}
export type DestinationRunState = Type.Static<Type.TObject<typeof DestinationRunFields>>

type State = HydratedEighteenXXState & DestinationRunState

export interface DestinationRunRules<Title extends State> {
    routeRules(): RouteRules
    companyOrder(state: OperatingState): string[]
    destination(companyId: string): string | undefined
    home(state: Title, companyId: string): RevenueCenter | undefined
    placeStation?(state: Title, companyId: string, center: RevenueCenter): void
}

export function destinationStationId(companyId: string): string {
    return `${companyId}:destination`
}

export class DestinationRunProcedure<Title extends State> {
    constructor(readonly rules: DestinationRunRules<Title>) {}

    private network(state: Title): RouteNetwork {
        const { map, tileSet } = this.rules.routeRules()
        return new RouteNetwork(new RailwayMapState(map, tileSet, state.tileInventory))
    }

    destinationCenter(state: Title, companyId: string): RevenueCenter | undefined {
        const locationId = this.rules.destination(companyId)
        if (!locationId) return undefined
        const { map, tileSet } = this.rules.routeRules()
        const node = new RailwayMapState(map, tileSet, state.tileInventory)
            .tile(locationId)
            .face.nodes.find((entry) => entry.kind !== 'junction')
        return node && { locationId, nodeId: node.id }
    }

    eligible(state: Title, companyId: string): boolean {
        if (state.destinationRunsMade.includes(companyId) || getCompany(state, companyId).closed)
            return false
        const home = this.rules.home(state, companyId)
        const destination = this.destinationCenter(state, companyId)
        if (!home || !destination) return false
        const trains = trainsOwnedBy(state, { kind: 'company', companyId })
        if (!trains.length) return false
        const routeRules = this.rules.routeRules()
        const reach = trains.reduce((longest, train) => {
            const { maximum } = routeRules.depot.trainDefinition(train.definitionId).distance
            return Math.max(longest, maximum === 'unlimited' ? Infinity : maximum)
        }, 0)
        return connectedWithin(
            this.network(state),
            state,
            companyId,
            home,
            destination,
            reach,
            (center) => routeRules.stopAllowed?.(state, companyId, center) !== false
        )
    }

    nextEligible(state: Title): string | undefined {
        const set = state.operatingSet
        if (!set?.privateIncomePaid || set.completed || state.destinationRun) return undefined
        const justFinished = set.completedCompanyIds.at(-1)
        const order = this.rules.companyOrder(state)
        const candidates = justFinished
            ? [justFinished, ...order.filter((companyId) => companyId !== justFinished)]
            : order
        return candidates.find((companyId) => this.eligible(state, companyId))
    }

    choosesStation(state: Title, companyId: string): boolean {
        const destination = this.rules.destination(companyId)
        return !companyStationCenters(state, companyId).some(
            (center) => center.locationId === destination
        )
    }

    private releaseCharterStation(state: Title, companyId: string): void {
        const id = destinationStationId(companyId)
        state.stations = state.stations.map((station) =>
            station.id === id ? { id, companyId, status: 'available' } : station
        )
    }

    private startRunning(state: Title, companyId: string): void {
        state.routeStep = { companyId }
    }

    begin(state: Title, companyId: string): void {
        const president = controllingOwner(state, companyId)
        assertExists(president, 'A company making a connection run has a president')
        state.destinationRun = { companyId }
        state.activePlayerIds = [president.playerId]
        if (!this.choosesStation(state, companyId)) {
            this.releaseCharterStation(state, companyId)
            this.startRunning(state, companyId)
        }
    }

    choose(state: Title, companyId: string, onMap: boolean): void {
        if (onMap) {
            const center = this.destinationCenter(state, companyId)
            assertExists(center, 'A destination station goes to its destination')
            if (this.rules.placeStation) this.rules.placeStation(state, companyId, center)
            else
                state.stationAccess = [
                    ...(state.stationAccess ?? []),
                    { companyId, ...center, sourceId: DestinationStationSource }
                ]
            state.destinationStations = [...state.destinationStations, companyId]
        } else this.releaseCharterStation(state, companyId)
        this.startRunning(state, companyId)
    }

    complete(state: Title): void {
        const run = state.destinationRun
        assertExists(run, 'A connection run is under way')
        state.destinationRunsMade = [...state.destinationRunsMade, run.companyId]
        delete state.destinationRun
        delete state.routeStep
        delete state.earningsDistribution
        state.activePlayerIds = []
        reorderPendingOperatingCompanies(state, this.rules.companyOrder(state), {
            betweenCompanies: true
        })
    }

    requiredRouteEnds(state: Title, companyId: string): readonly RevenueCenter[] | undefined {
        if (state.destinationRun?.companyId !== companyId) return undefined
        const home = this.rules.home(state, companyId)
        const destination = this.destinationCenter(state, companyId)
        assertExists(home, 'A company making a connection run has a home')
        assertExists(destination, 'A company making a connection run has a destination')
        return [home, destination]
    }

    doubling(
        state: Title,
        train: TrainDefinition,
        companyId: string
    ): PaidConnectionBonus | undefined {
        if (!state.destinationStations.includes(companyId)) return undefined
        const center = this.destinationCenter(state, companyId)
        if (!center) return undefined
        const rules = this.rules.routeRules()
        const face = new RouteEvaluation(state, rules).network.face(center.locationId)
        const node = face.nodes.find((entry) => entry.id === center.nodeId)
        assert(node && node.kind !== 'junction', 'A destination is a stop')
        const value = routeRevenue(node.revenue, rules.revenueStage(state, train))
        return {
            from: Object.fromEntries(rules.map.definition.locations.map(({ id }) => [id, 0])),
            to: { [center.locationId]: value },
            sourceId: DestinationBonusSource,
            destinationAtEnd: true
        }
    }

    starts(handler: EighteenXXStateHandler<Title>): EighteenXXStateHandler<Title> {
        return new SystemActionFirstHandler(
            handler,
            StartDestinationRun,
            (state) => {
                const companyId = this.nextEligible(state)
                return companyId ? { companyId } : undefined
            },
            (state) => (state.routeStep ? 'RunningTrains' : PlacingDestinationStationState)
        )
    }

    endsAfterEarnings(handler: EighteenXXStateHandler<Title>): EighteenXXStateHandler<Title> {
        return {
            enter: (context) => handler.enter(context),
            validActionsForPlayer: (playerId, context) =>
                handler.validActionsForPlayer(playerId, context),
            isValidAction: (action, context) => handler.isValidAction(action, context),
            onAction: (action, context) => {
                const next = handler.onAction(action, context)
                if (!context.gameState.destinationRun) return next
                this.complete(context.gameState)
                return 'OperatingSet'
            }
        }
    }

    handler(): EighteenXXStateHandler<Title> {
        return new PlacingDestinationStationHandler(this)
    }

    actions(): ActionDefinition[] {
        return [
            defineAction(
                StartDestinationRun,
                isStartDestinationRun,
                (action) => new HydratedStartDestinationRun(action, this)
            ),
            defineAction(
                ChooseDestinationStation,
                isChooseDestinationStation,
                (action) => new HydratedChooseDestinationStation(action, this)
            )
        ]
    }
}

const StartFields = Type.Object({
    type: Type.Literal('StartDestinationRun'),
    companyId: Type.String()
})
export const StartDestinationRun: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof StartFields.properties
> = Type.Object(
    { ...GameAction.properties, ...StartFields.properties },
    { additionalProperties: false }
)
export type StartDestinationRun = Type.Static<typeof StartDestinationRun>
const StartValidator = Compile(StartDestinationRun)
export function isStartDestinationRun(action: GameAction): action is StartDestinationRun {
    return (
        action instanceof HydratedStartDestinationRun ||
        (action.type === 'StartDestinationRun' && StartValidator.Check(action))
    )
}

export class HydratedStartDestinationRun<Title extends State = State>
    extends HydratableAction<typeof StartDestinationRun>
    implements StartDestinationRun
{
    declare type: 'StartDestinationRun'
    declare companyId: string
    readonly #procedure: DestinationRunProcedure<Title>
    constructor(data: StartDestinationRun, procedure: DestinationRunProcedure<Title>) {
        super(data instanceof HydratedStartDestinationRun ? data.dehydrate() : data, StartValidator)
        this.#procedure = procedure
    }
    apply(state: Title): void {
        assert(
            this.source === ActionSource.System &&
                this.#procedure.nextEligible(state) === this.companyId,
            'A connection run starts for the next eligible company'
        )
        this.#procedure.begin(state, this.companyId)
    }
}

export const ChooseDestinationStation = Type.Object(
    {
        ...EighteenXXPlayerAction.properties,
        type: Type.Literal('ChooseDestinationStation'),
        companyId: Type.String(),
        onMap: Type.Boolean()
    },
    { additionalProperties: false }
)
export type ChooseDestinationStation = Type.Static<typeof ChooseDestinationStation>
const ChooseValidator = Compile(ChooseDestinationStation)
export function isChooseDestinationStation(action: GameAction): action is ChooseDestinationStation {
    return (
        action instanceof HydratedChooseDestinationStation ||
        (action.type === 'ChooseDestinationStation' && ChooseValidator.Check(action))
    )
}

export class HydratedChooseDestinationStation<Title extends State = State>
    extends HydratableAction<typeof ChooseDestinationStation>
    implements ChooseDestinationStation
{
    declare type: 'ChooseDestinationStation'
    declare playerId: string
    declare companyId: string
    declare onMap: boolean
    readonly #procedure: DestinationRunProcedure<Title>
    constructor(data: ChooseDestinationStation, procedure: DestinationRunProcedure<Title>) {
        super(
            data instanceof HydratedChooseDestinationStation ? data.dehydrate() : data,
            ChooseValidator
        )
        this.#procedure = procedure
    }
    isValid(state: Title): boolean {
        return (
            this.source === ActionSource.User &&
            state.machineState === PlacingDestinationStationState &&
            state.destinationRun?.companyId === this.companyId &&
            state.activePlayerIds.includes(this.playerId)
        )
    }
    apply(state: Title): void {
        assert(this.isValid(state), 'Only the company’s president places its destination station')
        this.#procedure.choose(state, this.companyId, this.onMap)
    }
}

class PlacingDestinationStationHandler<
    Title extends State
> implements EighteenXXStateHandler<Title> {
    constructor(private readonly procedure: DestinationRunProcedure<Title>) {}
    isValidAction(action: HydratedAction, context: MachineContext<Title>): boolean {
        const state = context.gameState
        return (
            action instanceof HydratedChooseDestinationStation &&
            action.source === ActionSource.User &&
            state.destinationRun?.companyId === action.companyId &&
            state.activePlayerIds.includes(action.playerId)
        )
    }
    validActionsForPlayer(playerId: string, context: MachineContext<Title>): string[] {
        return context.gameState.activePlayerIds.includes(playerId)
            ? ['ChooseDestinationStation']
            : []
    }
    enter(): void {}
    onAction(): string {
        return 'RunningTrains'
    }
}

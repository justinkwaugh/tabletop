import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import { StationPosition } from '../map/station.js'
import {
    StationPlacement,
    StationPlacementDetails,
    applyStationPlacement,
    type StationPlacementState,
    type StationRules
} from '../stations/stationPlacement.js'
import type { CompanyDecisionState, PrivateStation } from './companyDecision.js'

type PrivateStationState = CompanyDecisionState & StationPlacementState

function nextStationId(state: StationPlacementState, companyId: string): string | undefined {
    return state.stations.find(
        (station) => station.companyId === companyId && station.status === 'available'
    )?.id
}

/** The open city slots on the private's tile, one per city, for the company's next station. */
export function privateStationPositions(
    state: StationPlacementState,
    rules: StationRules,
    pending: Omit<PrivateStation, 'playerId' | 'privateCompanyId'>
): StationPosition[] {
    if (!nextStationId(state, pending.companyId)) return []
    const placement = new StationPlacement(state, rules)
    return placement.mapState.tile(pending.locationId).face.nodes.flatMap((node) => {
        const slot = placement.openSlots(pending.companyId, pending.locationId, node.id)[0]
        return slot === undefined ? [] : [{ locationId: pending.locationId, nodeId: node.id, slot }]
    })
}

function pendingFor(
    state: PrivateStationState,
    action: { playerId: string; privateCompanyId: string }
): PrivateStation | undefined {
    const pending = state.privateStation
    return pending?.privateCompanyId === action.privateCompanyId &&
        pending.playerId === action.playerId &&
        state.activePlayerIds.includes(action.playerId)
        ? pending
        : undefined
}

export const PlacePrivateStation = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('PlacePrivateStation'),
        privateCompanyId: Type.String(),
        position: StationPosition,
        metadata: Type.Optional(StationPlacementDetails)
    },
    { additionalProperties: false }
)
export type PlacePrivateStation = Type.Static<typeof PlacePrivateStation>
const PlaceValidator = Compile(PlacePrivateStation)
export function isPlacePrivateStation(action: GameAction): action is PlacePrivateStation {
    return (
        action instanceof HydratedPlacePrivateStation ||
        (action.type === 'PlacePrivateStation' && PlaceValidator.Check(action))
    )
}
export class HydratedPlacePrivateStation
    extends HydratableAction<typeof PlacePrivateStation>
    implements PlacePrivateStation
{
    declare type: 'PlacePrivateStation'
    declare playerId: string
    declare privateCompanyId: string
    declare position: StationPosition
    declare metadata?: StationPlacementDetails
    readonly #rules: StationRules
    constructor(data: PlacePrivateStation, rules: StationRules) {
        super(data instanceof HydratedPlacePrivateStation ? data.dehydrate() : data, PlaceValidator)
        this.#rules = rules
    }
    isValid(state: PrivateStationState): boolean {
        const pending = pendingFor(state, this)
        return (
            this.source === ActionSource.User &&
            !!pending &&
            privateStationPositions(state, this.#rules, pending).some(
                (position) =>
                    position.locationId === this.position.locationId &&
                    position.nodeId === this.position.nodeId &&
                    position.slot === this.position.slot
            )
        )
    }
    apply(state: HydratedGameState & PrivateStationState): void {
        assert(this.isValid(state), 'Invalid private station')
        const { companyId } = state.privateStation!
        const stationId = nextStationId(state, companyId)!
        const details = { companyId, stationId, position: { ...this.position }, cost: 0 }
        applyStationPlacement(state, details)
        // The station is the company's placement for the turn.
        state.stationStep ??= { companyId, placedStationIds: [], completed: false }
        state.stationStep.placedStationIds.push(stationId)
        delete state.privateStation
        this.metadata = details
    }
}

export const DeclinePrivateStation = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('DeclinePrivateStation'),
        privateCompanyId: Type.String()
    },
    { additionalProperties: false }
)
export type DeclinePrivateStation = Type.Static<typeof DeclinePrivateStation>
const DeclineValidator = Compile(DeclinePrivateStation)
export function isDeclinePrivateStation(action: GameAction): action is DeclinePrivateStation {
    return (
        action instanceof HydratedDeclinePrivateStation ||
        (action.type === 'DeclinePrivateStation' && DeclineValidator.Check(action))
    )
}
export class HydratedDeclinePrivateStation
    extends HydratableAction<typeof DeclinePrivateStation>
    implements DeclinePrivateStation
{
    declare type: 'DeclinePrivateStation'
    declare playerId: string
    declare privateCompanyId: string
    constructor(data: DeclinePrivateStation) {
        super(
            data instanceof HydratedDeclinePrivateStation ? data.dehydrate() : data,
            DeclineValidator
        )
    }
    isValid(state: PrivateStationState): boolean {
        return this.source === ActionSource.User && !!pendingFor(state, this)
    }
    apply(state: HydratedGameState & PrivateStationState): void {
        assert(this.isValid(state), 'Only the deciding president may decline this station')
        delete state.privateStation
    }
}

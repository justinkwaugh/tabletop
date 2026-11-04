import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    HydratableAction,
    assert,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import { EighteenXXPlayerAction } from '../actions/eighteenXXPlayerAction.js'
import { controllingOwner, type FinancialState } from '../finance/finance.js'
import { RailwayMapState, type MapStateData } from '../map/mapState.js'
import {
    StationPosition,
    sameStationPosition,
    type DisplacedStation,
    type StationState
} from '../map/station.js'
import type { StationRules } from './stationPlacement.js'
import { nextOperatingCompany, type OperatingState } from '../operating/operatingSet.js'
import { BetweenCompaniesState } from '../operating/operatingSteps.js'

type State = FinancialState & MapStateData & { activePlayerIds: string[] }

/** Stations set aside by reconfiguring upgrades, waiting for their owners. */
export function displacedStations(state: Pick<StationState, 'stations'>): DisplacedStation[] {
    return state.stations.filter((station) => station.status === 'displaced')
}

/** The station whose owner must act now, if any. */
export function stationToReturn(
    state: Pick<StationState, 'stations'> & OperatingState & { machineState: string }
): DisplacedStation | undefined {
    const displaced = displacedStations(state)
    if (!displaced.length) return undefined
    if (state.machineState !== BetweenCompaniesState) {
        const companyId = nextOperatingCompany(state)
        return displaced.find((station) => station.companyId === companyId)
    }
    const order = state.operatingSet?.companyOrder ?? []
    const rank = (companyId: string) => {
        const index = order.indexOf(companyId)
        return index < 0 ? order.length : index
    }
    return [...displaced].sort((a, b) => rank(a.companyId) - rank(b.companyId))[0]
}

/**
 * Where an owner may return a set-aside station: any city of its hex, even one whose spaces are
 * full, where the station shares a space beside the others (1894 §7.3.8).
 */
export function returnPositions(
    state: Pick<StationState, 'stations'>,
    mapState: RailwayMapState,
    station: DisplacedStation
): StationPosition[] {
    return mapState.tile(station.locationId).face.nodes.flatMap((node) => {
        if (node.kind !== 'city') return []
        const used = new Set(
            state.stations.flatMap((other) =>
                other.status === 'placed' &&
                other.position.locationId === station.locationId &&
                other.position.nodeId === node.id
                    ? [other.position.slot]
                    : []
            )
        )
        let slot = 0
        while (used.has(slot)) slot++
        return [{ locationId: station.locationId, nodeId: node.id, slot }]
    })
}

export const ReturnStation = Type.Object(
    {
        ...EighteenXXPlayerAction.properties,
        type: Type.Literal('ReturnStation'),
        stationId: Type.String(),
        position: StationPosition
    },
    { additionalProperties: false }
)
export type ReturnStation = Type.Static<typeof ReturnStation>
const Validator = Compile(ReturnStation)
export function isReturnStation(action: GameAction): action is ReturnStation {
    return (
        action instanceof HydratedReturnStation ||
        (action.type === 'ReturnStation' && Validator.Check(action))
    )
}

export class HydratedReturnStation
    extends HydratableAction<typeof ReturnStation>
    implements ReturnStation
{
    declare type: 'ReturnStation'
    declare playerId: string
    declare stationId: string
    declare position: StationPosition
    readonly #rules: Pick<StationRules, 'map' | 'tileSet'>
    constructor(data: ReturnStation, rules: Pick<StationRules, 'map' | 'tileSet'>) {
        super(data instanceof HydratedReturnStation ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    private station(state: State): DisplacedStation | undefined {
        const station = state.stations.find((entry) => entry.id === this.stationId)
        return station?.status === 'displaced' ? station : undefined
    }
    isValid(state: State): boolean {
        const station = this.station(state)
        return (
            this.source === ActionSource.User &&
            !!station &&
            state.activePlayerIds.includes(this.playerId) &&
            controllingOwner(state, station.companyId)?.playerId === this.playerId &&
            returnPositions(
                state,
                new RailwayMapState(this.#rules.map, this.#rules.tileSet, state.tileInventory),
                station
            ).some((position) => sameStationPosition(position, this.position))
        )
    }
    apply(state: HydratedGameState & State): void {
        assert(this.isValid(state), 'This station cannot return there')
        state.stations = state.stations.map((station) =>
            station.id === this.stationId
                ? {
                      id: station.id,
                      companyId: station.companyId,
                      status: 'placed',
                      position: { ...this.position }
                  }
                : station
        )
    }
}

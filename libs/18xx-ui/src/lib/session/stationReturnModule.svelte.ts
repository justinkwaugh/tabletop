import { assert } from '@tabletop/common'
import {
    RailwayMapState,
    ReturnStation,
    controllingOwner,
    displacedStations,
    returnPositions,
    type DisplacedStation,
    type EighteenXXState,
    type EighteenXXTitleRules,
    type StationPosition
} from '@tabletop/18xx'
import type { ModuleSession } from './moduleSession.js'

export type StationReturnSession = ModuleSession<
    EighteenXXState,
    Pick<EighteenXXTitleRules, 'stationRules'>
>

/** A station an upgrade set aside, waiting for its owner to choose a city on its hex. */
export class StationReturnModule {
    constructor(private readonly session: StationReturnSession) {}

    pending = $derived.by((): DisplacedStation | undefined => {
        if (!this.session.interactive || !this.session.validActionTypes.includes('ReturnStation'))
            return undefined
        const actor = this.session.state.activePlayerIds[0]
        return displacedStations(this.session.state).find(
            (station) => controllingOwner(this.session.state, station.companyId)?.playerId === actor
        )
    })
    /** Set-aside stations waiting for anyone, for presentation. */
    waiting = $derived.by(() => displacedStations(this.session.state))
    positions = $derived.by((): StationPosition[] => {
        const station = this.pending
        if (!station) return []
        const { map, tileSet } = this.session.rules.stationRules
        return returnPositions(
            this.session.state,
            new RailwayMapState(map, tileSet, this.session.state.tileInventory),
            station
        )
    })
    async choose(nodeId: string) {
        const station = this.pending
        const position = this.positions.find((entry) => entry.nodeId === nodeId)
        assert(station && position, 'Choose a city on the station’s hex')
        await this.session.applyAction(
            this.session.createPlayerAction(ReturnStation, {
                stationId: station.id,
                position
            })
        )
    }
}

import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import {
    assert,
    assertExists,
    GameAction,
    HydratableAction,
    MachineContext,
    OffsetCoordinates
} from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import {
    isEnergyNode,
    isSundiverFoundry,
    isTransmitTower,
    Station,
    StationType
} from '../components/stations.js'

export type MetamorphosizeMetadata = Static<typeof MetamorphosizeMetadata>
export const MetamorphosizeMetadata = Type.Object({
    priorStation: Station,
    newStation: Station
})

export type Metamorphosize = Static<typeof Metamorphosize>
export const Metamorphosize = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Metamorphosize),
            playerId: Type.String(),
            stationId: Type.String(),
            stationType: Type.Enum(StationType),
            metadata: Type.Optional(MetamorphosizeMetadata)
        })
    ])
)

export const MetamorphosizeValidator = Compile(Metamorphosize)

export function isMetamorphosize(action?: GameAction): action is Metamorphosize {
    return action?.type === ActionType.Metamorphosize
}

export class HydratedMetamorphosize
    extends HydratableAction<typeof Metamorphosize>
    implements Metamorphosize
{
    declare type: ActionType.Metamorphosize
    declare playerId: string
    declare stationId: string
    declare stationType: StationType
    declare metadata?: MetamorphosizeMetadata
    constructor(data: Metamorphosize) {
        super(data, MetamorphosizeValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        assert(this.isValidMetamorphosis(state, this.playerId), 'Invalid metamorphosize')

        const station = state.board.findStation(this.stationId)
        assertExists(station, 'Station not found')
        assertExists(station.coords, 'Station coordinates not found')

        const coords = station.coords
        const playerState = state.getPlayerState(this.playerId)
        const removedStation = state.board.removeStationAt(coords)
        assertExists(removedStation, 'Failed to remove station')

        switch (true) {
            case isEnergyNode(removedStation):
                playerState.energyNodes.push(removedStation)
                break
            case isSundiverFoundry(removedStation):
                playerState.sundiverFoundries.push(removedStation)
                break
            case isTransmitTower(removedStation):
                playerState.transmitTowers.push(removedStation)
                break
            default:
                throw Error('Invalid station type for metamorphosize')
        }

        switch (this.stationType) {
            case StationType.EnergyNode:
                const playerNode = playerState.removeEnergyNode()
                state.board.addStationAt(playerNode, coords)
                this.metadata = { priorStation: removedStation, newStation: playerNode }
                break
            case StationType.SundiverFoundry:
                const playerFoundry = playerState.removeSundiverFoundry()
                state.board.addStationAt(playerFoundry, coords)
                this.metadata = { priorStation: removedStation, newStation: playerFoundry }
                break
            case StationType.TransmitTower:
                const playerTower = playerState.removeTransmitTower()
                state.board.addStationAt(playerTower, coords)
                this.metadata = { priorStation: removedStation, newStation: playerTower }
                break
        }

        state.activeEffect = undefined
    }

    isValidMetamorphosis(state: HydratedSolGameState, playerId: string): boolean {
        const station = state.board.findStation(this.stationId)
        assertExists(station, 'Station not found')
        assertExists(station.coords, 'Station coordinates not found')

        const types = [...Object.values(StationType)]
        return types.some((type) => {
            if (type === station.type) {
                return false
            }
            switch (type) {
                case StationType.EnergyNode:
                    return state.getPlayerState(playerId).energyNodes.length > 0
                case StationType.SundiverFoundry:
                    return state.getPlayerState(playerId).sundiverFoundries.length > 0
                case StationType.TransmitTower:
                    return state.getPlayerState(playerId).transmitTowers.length > 0
            }
        })
    }
}

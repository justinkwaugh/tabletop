import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    assert,
    GameAction,
    HydratableAction,
    MachineContext,
    OffsetCoordinates
} from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Station, StationType } from '../components/stations.js'
import { CARDS_DRAWN_PER_RING } from '../utils/solConstants.js'

export type InvadeMetadata = Type.Static<typeof InvadeMetadata>
export const InvadeMetadata = Type.Object({
    invadedStation: Station,
    invaderStation: Station,
    removedSundiverIds: Type.Array(Type.String()),
    addedSundiverIds: Type.Array(Type.String())
})

export type Invade = Type.Static<typeof Invade>
export const Invade = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Invade),
            playerId: Type.String(),
            coords: OffsetCoordinates,
            metadata: Type.Optional(InvadeMetadata)
        })
    ])
)

export const InvadeValidator = Compile(Invade)

export function isInvade(action?: GameAction): action is Invade {
    return action?.type === ActionType.Invade
}

export class HydratedInvade extends HydratableAction<typeof Invade> implements Invade {
    declare type: ActionType.Invade
    declare playerId: string
    declare coords: OffsetCoordinates
    declare metadata?: InvadeMetadata
    constructor(data: Invade) {
        super(data, InvadeValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        assert(HydratedInvade.canInvadeAt(state, this.playerId, this.coords), 'Invalid invade')

        const playerState = state.getPlayerState(this.playerId)
        const station = state.board.removeStationAt(this.coords)
        if (!station) {
            throw Error('No station to invade')
        }

        const previousOwnerState = state.getPlayerState(station.playerId)

        const numDivers = station.type === StationType.TransmitTower ? 3 : 2

        // Remove invader divers to reserve
        const playerDivers = state.board.sundiversForPlayerAt(this.playerId, this.coords)
        const diversToRemove = playerDivers.slice(0, numDivers).map((diver) => diver.id)
        const removedDivers = state.board.removeSundiversAt(diversToRemove, this.coords)
        playerState.addSundiversToReserve(removedDivers)

        // Give invaded player divers from reserve
        const numToPromote = Math.min(numDivers, previousOwnerState.reserveSundivers.length)
        const promotedSundivers = previousOwnerState.removeSundiversFromReserve(numToPromote)
        previousOwnerState.addSundiversToHold(promotedSundivers)

        let invaderStation: Station
        switch (station.type) {
            case StationType.EnergyNode: {
                // Return invaded station to previous owner
                previousOwnerState.energyNodes.push(station)
                invaderStation = playerState.removeEnergyNode()
                break
            }
            case StationType.SundiverFoundry: {
                // Return invaded station to previous owner
                previousOwnerState.sundiverFoundries.push(station)
                invaderStation = playerState.removeSundiverFoundry()
                break
            }
            case StationType.TransmitTower: {
                // Return invaded station to previous owner
                previousOwnerState.transmitTowers.push(station)
                invaderStation = playerState.removeTransmitTower()
                break
            }
        }
        previousOwnerState.movement = state.calculatePlayerMovement(previousOwnerState.playerId)

        // Place invader station on board
        state.board.addStationAt(invaderStation, this.coords)
        playerState.movement = state.calculatePlayerMovement(this.playerId)

        this.metadata = {
            invadedStation: station,
            invaderStation: invaderStation,
            removedSundiverIds: diversToRemove,
            addedSundiverIds: promotedSundivers.map((diver) => diver.id)
        }

        state.cardsToDraw += CARDS_DRAWN_PER_RING[this.coords.row]
        state.activeEffect = undefined
    }

    static canInvade(state: HydratedSolGameState, playerId: string): boolean {
        return Iterator.from(state.board).some((cell) =>
            this.canInvadeAt(state, playerId, cell.coords)
        )
    }

    static canInvadeAt(
        state: HydratedSolGameState,
        playerId: string,
        coords: OffsetCoordinates
    ): boolean {
        const playerState = state.getPlayerState(playerId)
        const cell = state.board.cellAt(coords)
        if (!cell.station || cell.station.playerId === playerId) {
            return false
        }

        switch (cell.station.type) {
            case StationType.EnergyNode:
                if (playerState.energyNodes.length < 1) {
                    return false
                }
                break
            case StationType.SundiverFoundry:
                if (playerState.sundiverFoundries.length < 1) {
                    return false
                }
                break
            case StationType.TransmitTower:
                if (playerState.transmitTowers.length < 1) {
                    return false
                }
                break
            default:
                return false
        }

        const numDivers = state.board.sundiversForPlayerAt(playerId, coords).length
        return numDivers >= (cell.station.type === StationType.TransmitTower ? 3 : 2)
    }
}

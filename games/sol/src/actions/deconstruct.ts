import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
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
    Station
} from '../components/stations.js'

export type DeconstructMetadata = Type.Static<typeof DeconstructMetadata>
export const DeconstructMetadata = Type.Object({
    removedStation: Station,
    oldMovement: Type.Number(),
    newMovement: Type.Number()
})

export type Deconstruct = Type.Static<typeof Deconstruct>
export const Deconstruct = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Deconstruct),
            playerId: Type.String(),
            coords: OffsetCoordinates,
            metadata: Type.Optional(DeconstructMetadata)
        })
    ])
)

export const DeconstructValidator = Compile(Deconstruct)

export function isDeconstruct(action?: GameAction): action is Deconstruct {
    return action?.type === ActionType.Deconstruct
}

export class HydratedDeconstruct
    extends HydratableAction<typeof Deconstruct>
    implements Deconstruct
{
    declare type: ActionType.Deconstruct
    declare playerId: string
    declare coords: OffsetCoordinates
    declare metadata?: DeconstructMetadata
    constructor(data: Deconstruct) {
        super(data, DeconstructValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        if (!HydratedDeconstruct.canDeconstructAt(state, this.playerId, this.coords)) {
            throw Error('Invalid deconstruct')
        }
        const playerState = state.getPlayerState(this.playerId)
        const cell = state.board.cellAt(this.coords)
        const station = cell.station
        assertExists(station, 'No station to deconstruct')

        const removedStation = state.board.removeStationAt(this.coords)
        assertExists(removedStation, 'Failed to remove station')

        this.metadata = {
            removedStation: removedStation,
            oldMovement: playerState.movement,
            newMovement: 0 // Placeholder, will be set below
        }

        switch (true) {
            case isEnergyNode(removedStation):
                playerState.energyNodes.push(removedStation)
                break
            case isTransmitTower(removedStation):
                playerState.transmitTowers.push(removedStation)
                break
            case isSundiverFoundry(removedStation):
                playerState.sundiverFoundries.push(removedStation)
                break
        }

        const sundivers = playerState.removeSundiversFromReserve(2)
        playerState.addSundiversToHold(sundivers)

        playerState.movement = state.calculatePlayerMovement(playerState.playerId)
        this.metadata.newMovement = playerState.movement

        // It happems before the turn sort of, so the movement points get altered too
        playerState.movementPoints = playerState.movement
    }

    static canDeconstruct(state: HydratedSolGameState, playerId: string): boolean {
        return Iterator.from(state.board).some((cell) =>
            this.canDeconstructAt(state, playerId, cell.coords)
        )
    }

    static canDeconstructAt(
        state: HydratedSolGameState,
        playerId: string,
        coords: OffsetCoordinates
    ): boolean {
        const cell = state.board.cellAt(coords)
        return cell.station !== undefined && cell.station.playerId === playerId
    }
}

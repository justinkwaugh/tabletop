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
import { SolarGate } from '../components/solarGate.js'

export type DeconstructMetadata = Type.Static<typeof DeconstructMetadata>
export const DeconstructMetadata = Type.Object({
    removedStation: Type.Optional(Station),
    removedGate: Type.Optional(SolarGate),
    oldMovement: Type.Number(),
    newMovement: Type.Number()
})

// Deconstructs the player's station at `coords`, or, when `innerCoords` is given,
// the player's gate between `innerCoords` and `coords` (as Convert places gates).
export type Deconstruct = Type.Static<typeof Deconstruct>
export const Deconstruct = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Deconstruct),
            playerId: Type.String(),
            coords: OffsetCoordinates,
            innerCoords: Type.Optional(OffsetCoordinates),
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
    declare innerCoords?: OffsetCoordinates
    declare metadata?: DeconstructMetadata
    constructor(data: Deconstruct) {
        super(data, DeconstructValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        if (this.innerCoords) {
            this.deconstructGate(state, this.innerCoords)
        } else {
            this.deconstructStation(state)
        }

        const playerState = state.getPlayerState(this.playerId)
        const sundivers = playerState.removeSundiversFromReserve(2)
        playerState.addSundiversToHold(sundivers)

        // It happems before the turn sort of, so the movement points get altered too
        playerState.movementPoints = playerState.movement
    }

    private deconstructGate(state: HydratedSolGameState, innerCoords: OffsetCoordinates) {
        if (
            !HydratedDeconstruct.canDeconstructGateAt(
                state,
                this.playerId,
                innerCoords,
                this.coords
            )
        ) {
            throw Error('Invalid deconstruct')
        }
        const playerState = state.getPlayerState(this.playerId)
        const removedGate = state.board.removeGateBetween(innerCoords, this.coords)
        assertExists(removedGate, 'Failed to remove gate')
        playerState.solarGates.push(removedGate)

        this.metadata = {
            removedGate,
            oldMovement: playerState.movement,
            newMovement: playerState.movement
        }
    }

    private deconstructStation(state: HydratedSolGameState) {
        if (!HydratedDeconstruct.canDeconstructAt(state, this.playerId, this.coords)) {
            throw Error('Invalid deconstruct')
        }
        const playerState = state.getPlayerState(this.playerId)
        const removedStation = state.board.removeStationAt(this.coords)
        assertExists(removedStation, 'Failed to remove station')

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

        const oldMovement = playerState.movement
        playerState.movement = state.calculatePlayerMovement(playerState.playerId)
        this.metadata = {
            removedStation,
            oldMovement,
            newMovement: playerState.movement
        }
    }

    static canDeconstruct(state: HydratedSolGameState, playerId: string): boolean {
        return (
            Iterator.from(state.board).some((cell) =>
                this.canDeconstructAt(state, playerId, cell.coords)
            ) || Object.values(state.board.gates).some((gate) => gate.playerId === playerId)
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

    static canDeconstructGateAt(
        state: HydratedSolGameState,
        playerId: string,
        innerCoords: OffsetCoordinates,
        outerCoords: OffsetCoordinates
    ): boolean {
        return (
            state.board.gates[state.board.gateKey(innerCoords, outerCoords)]?.playerId === playerId
        )
    }
}

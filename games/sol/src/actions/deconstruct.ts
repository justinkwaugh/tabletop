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
        const playerState = state.getPlayerState(this.playerId)
        const oldMovement = playerState.movement

        if (this.innerCoords) {
            if (
                !HydratedDeconstruct.canDeconstructGateAt(
                    state,
                    this.playerId,
                    this.innerCoords,
                    this.coords
                )
            ) {
                throw Error('Invalid deconstruct')
            }
            const removedGate = state.board.removeGateBetween(this.innerCoords, this.coords)
            assertExists(removedGate, 'Failed to remove gate')
            playerState.solarGates.push(removedGate)
            this.metadata = { removedGate, oldMovement, newMovement: oldMovement }
        } else {
            if (!HydratedDeconstruct.canDeconstructAt(state, this.playerId, this.coords)) {
                throw Error('Invalid deconstruct')
            }
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
            this.metadata = { removedStation, oldMovement, newMovement: oldMovement }
        }

        const sundivers = playerState.removeSundiversFromReserve(2)
        playerState.addSundiversToHold(sundivers)

        playerState.movement = state.calculatePlayerMovement(playerState.playerId)
        this.metadata.newMovement = playerState.movement

        // It happens before the turn sort of, so the movement points get altered too
        playerState.movementPoints = playerState.movement
    }

    static canDeconstruct(state: HydratedSolGameState, playerId: string): boolean {
        return (
            Iterator.from(state.board).some((cell) =>
                this.canDeconstructAt(state, playerId, cell.coords)
            ) || this.deconstructableGates(state, playerId).length > 0
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

    static deconstructableGates(state: HydratedSolGameState, playerId: string): SolarGate[] {
        return Object.values(state.board.gates).filter((gate) => gate.playerId === playerId)
    }

    static canDeconstructGateAt(
        state: HydratedSolGameState,
        playerId: string,
        innerCoords: OffsetCoordinates,
        outerCoords: OffsetCoordinates
    ): boolean {
        return state.board.gateBetween(innerCoords, outerCoords)?.playerId === playerId
    }
}

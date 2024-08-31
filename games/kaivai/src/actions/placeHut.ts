import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { AxialCoordinates, GameAction, HydratableAction } from '@tabletop/common'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CellType, HutCell } from '../definition/cells.js'
import { HutType } from '../definition/huts.js'
import { MachineState } from '../definition/states.js'
import { PhaseName } from 'src/definition/phases.js'

export type PlaceHut = Static<typeof PlaceHut>
export const PlaceHut = Type.Composite([
    Type.Omit(GameAction, ['playerId']),
    Type.Object({
        type: Type.Literal(ActionType.PlaceHut),
        coords: AxialCoordinates,
        playerId: Type.String(),
        hutType: Type.Enum(HutType),
        boatCoords: Type.Optional(AxialCoordinates)
    })
])

export const PlaceHutValidator = TypeCompiler.Compile(PlaceHut)

export function isPlaceHut(action?: GameAction): action is PlaceHut {
    return action?.type === ActionType.PlaceHut
}

export class HydratedPlaceHut extends HydratableAction<typeof PlaceHut> implements PlaceHut {
    declare type: ActionType.PlaceHut
    declare coords: AxialCoordinates
    declare playerId: string
    declare hutType: HutType
    declare boatCoords?: AxialCoordinates

    constructor(data: PlaceHut) {
        super(data, PlaceHutValidator)
    }

    apply(state: HydratedKaivaiGameState) {
        const playerState = state.getPlayerState(this.playerId)
        const { valid, reason } = HydratedPlaceHut.isValidPlacement(state, this)

        if (!valid) {
            throw Error(reason)
        }

        const neighboringIslandIds = state.board.getNeighboringIslands(this.coords)
        if (neighboringIslandIds.length !== 1) {
            throw Error(
                'Hut must be placed adjacent to exactly one island... validationg should have caught this'
            )
        }

        // needs a boat or fisherman
        if (this.hutType === HutType.BoatBuilding) {
            const boat = playerState.getBoat()
        } else if (this.hutType === HutType.Fishing) {
            playerState.removeFisherman()
        }
        const cell: HutCell = {
            type: CellType.Hut,
            coords: this.coords,
            islandId: neighboringIslandIds[0],
            hutType: this.hutType,
            owner: this.playerId
        }
        state.board.addCell(cell)
        playerState.initialHutsPlaced += 1
    }

    static isValidPlacement(
        state: HydratedKaivaiGameState,
        placement: Omit<PlaceHut, 'type'>
    ): { valid: boolean; reason: string } {
        const playerState = state.getPlayerState(placement.playerId)
        const board = state.board

        if (
            state.phases.currentPhase?.name === PhaseName.InitialHuts &&
            playerState.boats.length === 4 &&
            placement.hutType !== HutType.BoatBuilding
        ) {
            return { valid: false, reason: 'One of the intial hut placements must be a boat' }
        }

        if (!board.isInBounds(placement.coords)) {
            return { valid: false, reason: 'Placement is off board' }
        }

        if (!board.isWaterCell(placement.coords)) {
            return { valid: false, reason: 'Hut must be placed on water' }
        }

        if (state.machineState !== MachineState.InitialHuts && !placement.boatCoords) {
            return { valid: false, reason: 'Boat coordinates required' }
        }

        if (placement.boatCoords) {
            if (!board.isNeighborToCultSite(placement.boatCoords)) {
                return { valid: false, reason: 'Boat must next to a cult tile to build' }
            }

            const cell = board.getCellAt(placement.boatCoords)
            if (cell.type !== CellType.Water || !cell.boat) {
                return { valid: false, reason: 'Boat must be present and on water' }
            }

            if (!board.isNeighborToBoat(placement.coords, cell.boat.id)) {
                return { valid: false, reason: 'Hut must be placed next to the specified boat' }
            }
        }

        if (placement.hutType === HutType.BoatBuilding && !playerState.hasBoats()) {
            return { valid: false, reason: 'Player has no boats to build' }
        }

        if (placement.hutType === HutType.Fishing && !playerState.hasFisherman()) {
            return { valid: false, reason: 'Player has no fishermen to place' }
        }

        if (
            state.machineState === MachineState.InitialHuts &&
            !board.isNeighborToCultSite(placement.coords)
        ) {
            return { valid: false, reason: 'Hut must be placed next to a cult tile' }
        }

        const neighboringIslands = board.getNeighboringIslands(placement.coords)
        if (neighboringIslands.length > 1) {
            return { valid: false, reason: 'Hut must not connect more than one island' }
        }

        if (neighboringIslands.length === 0) {
            return { valid: false, reason: 'Hut must be adjacent to an island' }
        }

        if (board.willSurroundAnyBoats(placement.coords)) {
            return { valid: false, reason: 'Boats may not be surrounded by island' }
        }

        return { valid: true, reason: '' }
    }
}

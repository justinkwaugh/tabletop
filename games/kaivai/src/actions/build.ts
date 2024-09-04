import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { AxialCoordinates, GameAction, HydratableAction } from '@tabletop/common'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { BoatBuildingCell, Cell, CellType, FishingCell, MeetingCell } from '../definition/cells.js'
import { HutType } from '../definition/huts.js'
import { MachineState } from '../definition/states.js'
import { PhaseName } from '../definition/phases.js'
import { HydratedKaivaiPlayerState } from '../model/playerState.js'

export type Build = Static<typeof Build>
export const Build = Type.Composite([
    Type.Omit(GameAction, ['playerId']),
    Type.Object({
        type: Type.Literal(ActionType.Build),
        coords: AxialCoordinates,
        playerId: Type.String(),
        hutType: Type.Enum(HutType),
        boatId: Type.Optional(Type.String()),
        boatCoords: Type.Optional(AxialCoordinates)
    })
])

export const BuildValidator = TypeCompiler.Compile(Build)

export function isBuild(action?: GameAction): action is Build {
    return action?.type === ActionType.Build
}

export class HydratedBuild extends HydratableAction<typeof Build> implements Build {
    declare type: ActionType.Build
    declare coords: AxialCoordinates
    declare playerId: string
    declare hutType: HutType
    declare boatId?: string
    declare boatCoords?: AxialCoordinates

    constructor(data: Build) {
        super(data, BuildValidator)
    }

    apply(state: HydratedKaivaiGameState) {
        const playerState = state.getPlayerState(this.playerId)
        const { valid, reason } = HydratedBuild.isValidPlacement(state, this)

        if (!valid) {
            throw Error(reason)
        }

        const neighboringIslandIds = state.board.getNeighboringIslands(this.coords)
        if (neighboringIslandIds.length !== 1) {
            throw Error(
                'Hut must be placed adjacent to exactly one island... validation should have caught this'
            )
        }

        // Pay influence
        const requiredInfluence = state.influence[ActionType.Build]
        if (playerState.influence < requiredInfluence) {
            throw Error('Player does not have enough influence to build')
        }

        if (requiredInfluence === 0) {
            playerState.influence += 1
        } else {
            playerState.influence -= requiredInfluence
            state.influence[ActionType.Build] += requiredInfluence
        }

        const islandId = neighboringIslandIds[0]

        // Pay for building
        const cost = playerState.buildingCost + state.board.islands[islandId].coordList.length
        playerState.pay(cost)

        // Move boat
        if (this.boatId && this.boatCoords) {
            const originalLocation = playerState.boatLocations[this.boatId]
            if (!originalLocation) {
                throw Error('Boat location not found')
            }

            const boat = state.board.removeBoatFrom(originalLocation)
            if (!boat) {
                throw Error('Boat not found at original location')
            }
            state.board.addBoatTo(this.boatCoords, boat)
            playerState.boatLocations[boat.id] = this.boatCoords
        }

        let cell: Cell
        if (this.hutType === HutType.BoatBuilding) {
            // Place new boat
            const boat = playerState.getBoat()
            playerState.boatLocations[boat.id] = this.coords

            cell = <BoatBuildingCell>{
                type: CellType.BoatBuilding,
                coords: this.coords,
                islandId: neighboringIslandIds[0],
                hutType: this.hutType,
                owner: this.playerId,
                boat
            }
        } else if (this.hutType === HutType.Fishing) {
            playerState.removeFisherman()
            cell = <FishingCell>{
                type: CellType.Fishing,
                coords: this.coords,
                islandId: neighboringIslandIds[0],
                hutType: this.hutType,
                owner: this.playerId
            }
        } else {
            cell = <MeetingCell>{
                type: CellType.Meeting,
                coords: this.coords,
                islandId: neighboringIslandIds[0],
                hutType: this.hutType,
                owner: this.playerId
            }

            if (state.godLocation?.islandId === islandId) {
                playerState.influence += 1
            }
        }
        state.board.addCell(cell)
        playerState.initialHutsPlaced += 1
    }

    static isValidPlacement(
        state: HydratedKaivaiGameState,
        placement: Pick<Build, 'playerId' | 'hutType' | 'coords' | 'boatCoords'>,
        test: boolean = false
    ): { valid: boolean; reason: string } {
        const playerState = state.getPlayerState(placement.playerId)
        const board = state.board

        if (
            state.phases.currentPhase?.name === PhaseName.InitialHuts &&
            playerState.initialHutsPlaced === 1 &&
            playerState.boats.length === 4 &&
            placement.hutType !== HutType.BoatBuilding
        ) {
            return { valid: false, reason: 'One of the intial hut placements must be a boat' }
        }

        // if (!board.isInBounds(placement.coords)) {
        //     return { valid: false, reason: 'Placement is off board' }
        // }

        if (!board.isWaterCell(placement.coords)) {
            return { valid: false, reason: 'Hut must be placed on water' }
        }

        if (state.machineState !== MachineState.InitialHuts && !placement.boatCoords) {
            return { valid: false, reason: 'Boat coordinates required' }
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

        const islandId = neighboringIslands[0]
        const cost = playerState.buildingCost + state.board.islands[islandId].coordList.length
        if (playerState.money() < cost) {
            return { valid: false, reason: 'Player cannot afford to build' }
        }

        if (placement.boatCoords) {
            if (!test) {
                if (!board.isNeighborToCultSite(placement.boatCoords)) {
                    return { valid: false, reason: 'Boat must next to a cult tile to build' }
                }

                if (!board.areNeighbors(placement.coords, placement.boatCoords)) {
                    return { valid: false, reason: 'Hut must be placed next to the specified boat' }
                }
            }

            // Make sure they share the same island
            const boatIslands = board.getNeighboringIslands(placement.boatCoords, CellType.Cult)
            if (!boatIslands.includes(neighboringIslands[0])) {
                return { valid: false, reason: 'Boat and hut must be on the same island' }
            }
        }

        if (board.willSurroundAnyBoats(placement.coords)) {
            return { valid: false, reason: 'Boats may not be surrounded by island' }
        }

        return { valid: true, reason: '' }
    }

    static canBoatBuild({
        gameState,
        playerState,
        boatId
    }: {
        gameState: HydratedKaivaiGameState
        playerState: HydratedKaivaiPlayerState
        boatId: string
    }): boolean {
        const validLocations = HydratedBuild.validBoatLocations({
            gameState,
            playerState,
            boatId,
            stopAtFirst: true
        })

        return validLocations.length > 0
    }

    static validBoatLocations({
        gameState,
        playerState,
        boatId,
        stopAtFirst = false
    }: {
        gameState: HydratedKaivaiGameState
        playerState: HydratedKaivaiPlayerState
        boatId: string
        stopAtFirst?: boolean
    }): AxialCoordinates[] {
        const boatCoords = playerState.boatLocations[boatId]
        if (!boatCoords) {
            return []
        }

        const reachableHexes = gameState.board.getCoordinatesReachableByBoat(
            boatCoords,
            playerState
        )

        const cultAdjacentHexes = reachableHexes.filter(
            (hex) => gameState.board.isWaterCell(hex) && gameState.board.isNeighborToCultSite(hex)
        )

        const validHexes: AxialCoordinates[] = []
        for (const hex of cultAdjacentHexes) {
            if (gameState.board.hasOtherBoat(hex, boatId)) {
                continue
            }
            const neighbors = gameState.board.getNeighbors(hex)
            // Test each for validity
            if (
                neighbors.some((buildHex) => {
                    const { valid } = HydratedBuild.isValidPlacement(
                        gameState,
                        {
                            playerId: playerState.playerId,
                            hutType: HutType.Meeting,
                            coords: buildHex,
                            boatCoords: hex
                        },
                        true
                    )
                    return valid
                })
            ) {
                validHexes.push(hex)
                if (stopAtFirst) {
                    return validHexes
                }
            }
        }
        return validHexes
    }
}

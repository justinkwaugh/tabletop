import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction } from '@tabletop/common'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { BoatBuildingCell, Cell, CellType, FishingCell, MeetingCell } from '../definition/cells.js'
import { HutType } from '../definition/huts.js'
import { MachineState } from '../definition/states.js'
import { PhaseName } from '../definition/phases.js'
import { HydratedKaivaiPlayerState } from '../model/playerState.js'

export type BuildMetadata = Type.Static<typeof BuildMetadata>
export const BuildMetadata = Type.Object({
    originalCoords: Type.Optional(AxialCoordinates),
    cost: Type.Number()
})

export type Build = Type.Static<typeof Build>
export const Build = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Build),
            coords: AxialCoordinates,
            playerId: Type.String(),
            hutType: Type.Enum(HutType),
            boatId: Type.Optional(Type.String()),
            boatCoords: Type.Optional(AxialCoordinates),
            metadata: Type.Optional(BuildMetadata)
        })
    ])
)

export const BuildValidator = Compile(Build)

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
    declare metadata?: BuildMetadata

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

        const islandId = neighboringIslandIds[0]

        let cost = 0
        let originalCoords: AxialCoordinates | undefined

        // Initial huts are free
        if (state.phases.currentPhase?.name !== PhaseName.InitialHuts) {
            if (state.machineState === MachineState.TakingActions) {
                const requiredInfluence = state.influence[ActionType.Build] ?? 0
                if (playerState.influence < requiredInfluence) {
                    throw Error('Player does not have enough influence to build')
                }

                if (requiredInfluence === 0) {
                    state.influence[ActionType.Build] = 1
                } else {
                    playerState.influence -= requiredInfluence
                    state.influence[ActionType.Build] += requiredInfluence
                }
            }
            // Pay for building
            cost = playerState.buildingCost + state.board.islands[islandId].coordList.length
            playerState.pay(cost)
        }

        // Move boat
        if (this.boatId && this.boatCoords) {
            originalCoords = playerState.boatLocations[this.boatId]
            if (!originalCoords) {
                throw Error('Boat location not found')
            }

            const boat = state.board.removeBoatFrom(originalCoords)
            if (!boat) {
                throw Error('Boat not found at original location')
            }
            state.board.addBoatTo(this.boatCoords, boat)
            playerState.boatLocations[boat.id] = this.boatCoords

            // Mark boat as used
            playerState.availableBoats = playerState.availableBoats.filter(
                (id) => id !== this.boatId
            )
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
                fish: 0,
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
                owner: this.playerId,
                fish: 0
            }

            if (state.godLocation?.islandId === islandId) {
                playerState.influence += 1
            }
        }
        state.board.addCell(cell)
        if (state.machineState === MachineState.InitialHuts) {
            playerState.initialHutsPlaced += 1
        }
        playerState.tiles -= 1

        this.metadata = { originalCoords, cost }
    }

    static isValidPlacement(
        state: HydratedKaivaiGameState,
        placement: Pick<Build, 'playerId' | 'hutType' | 'coords' | 'boatId' | 'boatCoords'>
    ): { valid: boolean; reason: string } {
        const playerState = state.getPlayerState(placement.playerId)
        const board = state.board

        if (playerState.tiles === 0) {
            return { valid: false, reason: 'Player has no tiles remaining' }
        }

        if (
            state.phases.currentPhase?.name === PhaseName.InitialHuts &&
            playerState.initialHutsPlaced === 1 &&
            playerState.boats.length === 4 &&
            placement.hutType !== HutType.BoatBuilding
        ) {
            return { valid: false, reason: 'One of the intial hut placements must be a boat' }
        }

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

        if (placement.boatCoords && placement.boatId) {
            if (state.board.hasOtherBoat(placement.boatCoords, placement.boatId)) {
                return { valid: false, reason: 'Another boat is already at the specified location' }
            }

            if (!board.areNeighbors(placement.coords, placement.boatCoords)) {
                return { valid: false, reason: 'Hut must be placed next to the specified boat' }
            }

            const boat = board.getBoatAt(placement.coords)
            if (boat && boat.id !== placement.boatId) {
                return { valid: false, reason: 'Hut cannot be placed on a boat' }
            }

            // Make sure they share the same island (this also incidentally checks boat / cult site adjacency)
            const boatIslands = board.getNeighboringIslands(placement.boatCoords, CellType.Cult)
            if (!boatIslands.includes(neighboringIslands[0])) {
                return { valid: false, reason: 'Boat and hut must be on the same island' }
            }

            // Don't check where the boat was, check where it is going
            const fromCoords = playerState.boatLocations[placement.boatId]
            const boatMoved = {
                from: fromCoords,
                to: placement.boatCoords
            }
            if (board.willTrapBoats(placement.coords, boatMoved)) {
                return { valid: false, reason: 'Boats may not be surrounded by island' }
            }
        } else {
            if (board.willTrapBoats(placement.coords)) {
                return { valid: false, reason: 'Boats may not be surrounded by island' }
            }
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
                    const { valid } = HydratedBuild.isValidPlacement(gameState, {
                        playerId: playerState.playerId,
                        hutType: HutType.Meeting,
                        coords: buildHex,
                        boatId,
                        boatCoords: hex
                    })
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

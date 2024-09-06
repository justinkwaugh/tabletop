import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CellType } from '../definition/cells.js'
import { HutType } from '../definition/huts.js'
import { HydratedKaivaiPlayerState } from '../model/playerState.js'
import { MachineState } from '../definition/states.js'

export type Fish = Static<typeof Fish>
export const Fish = Type.Composite([
    Type.Omit(GameAction, ['playerId']),
    Type.Object({
        type: Type.Literal(ActionType.Fish),
        playerId: Type.String(),
        boatId: Type.String(),
        boatCoords: AxialCoordinates
    })
])

export const FishValidator = TypeCompiler.Compile(Fish)

export function isFish(action?: GameAction): action is Fish {
    return action?.type === ActionType.Fish
}

type IslandFishingData = { islandId: string; numHuts: number; hasGod: boolean }

export class HydratedFish extends HydratableAction<typeof Fish> implements Fish {
    declare type: ActionType.Fish
    declare playerId: string
    declare boatId: string
    declare boatCoords: AxialCoordinates

    constructor(data: Fish) {
        super(data, FishValidator)
    }

    apply(state: HydratedKaivaiGameState, _context?: MachineContext) {
        const playerState = state.getPlayerState(this.playerId)
        const { valid, reason } = HydratedFish.isValidFishingLocation(
            state,
            this.playerId,
            this.boatId,
            this.boatCoords
        )

        if (!valid) {
            throw Error(reason)
        }

        if (state.machineState === MachineState.TakingActions) {
            const requiredInfluence = state.influence[ActionType.Fish] ?? 0
            if (playerState.influence < requiredInfluence) {
                throw Error('Player does not have enough influence to fish')
            }

            if (requiredInfluence === 0) {
                state.influence[ActionType.Fish] = 1
            } else {
                playerState.influence -= requiredInfluence
                state.influence[ActionType.Fish] += requiredInfluence
            }
        }

        // Move boat
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

        // Mark boat as used
        playerState.availableBoats = playerState.availableBoats.filter((id) => id !== this.boatId)

        const neighboringIslandIds = state.board.getNeighboringIslands(this.boatCoords)
        const fishingData: IslandFishingData[] = neighboringIslandIds.map((islandId) => {
            const numHuts = state.board.numHutsOnIsland(islandId, HutType.Fishing, this.playerId)
            const hasGod = state.godLocation?.islandId === islandId
            return { islandId, numHuts, hasGod }
        })

        // Depending on rules, different islands might be better
        // const config = context?.gameConfig

        let numFish = 0
        const luckless = true
        if (luckless) {
            numFish = Math.max(...fishingData.map((data) => data.numHuts + (data.hasGod ? 1 : 0)))
        }

        playerState.fish[3] += numFish
    }

    static isValidFishingLocation(
        state: HydratedKaivaiGameState,
        playerId: string,
        boatId: string,
        boatCoords: AxialCoordinates
    ): { valid: boolean; reason: string } {
        const board = state.board

        // I think this is technically not in the rules
        if (!board.isWaterCell(boatCoords)) {
            return { valid: false, reason: 'Boat must be on water' }
        }

        if (state.board.hasOtherBoat(boatCoords, boatId)) {
            return { valid: false, reason: 'Another boat is already at the specified location' }
        }

        const neighboringIslands = board.getNeighboringIslands(boatCoords, CellType.Cult)
        if (
            !neighboringIslands.some(
                (islandId) =>
                    board.numHutsOnIsland(islandId, HutType.Fishing, playerId) > 0 ||
                    state.godLocation?.islandId === islandId
            )
        ) {
            return {
                valid: false,
                reason: 'Boat must be adjacent to a cult site on an island with a fishing hut or the fishing god'
            }
        }

        return { valid: true, reason: '' }
    }

    static canBoatFish({
        gameState,
        playerState,
        boatId
    }: {
        gameState: HydratedKaivaiGameState
        playerState: HydratedKaivaiPlayerState
        boatId: string
    }): boolean {
        const validLocations = HydratedFish.validBoatLocations({
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
            const { valid } = HydratedFish.isValidFishingLocation(
                gameState,
                playerState.playerId,
                boatId,
                hex
            )
            if (valid) {
                validHexes.push(hex)
                if (stopAtFirst) {
                    return validHexes
                }
            }
        }
        return validHexes
    }
}

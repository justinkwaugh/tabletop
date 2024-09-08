import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import {
    AxialCoordinates,
    GameAction,
    HydratableAction,
    MachineContext,
    RandomFunction
} from '@tabletop/common'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CellType } from '../definition/cells.js'
import { HutType } from '../definition/huts.js'
import { HydratedKaivaiPlayerState } from '../model/playerState.js'
import { MachineState } from '../definition/states.js'
import { KaivaiGameConfig, Ruleset } from '../definition/gameConfig.js'

export type Fish = Static<typeof Fish>
export const Fish = Type.Composite([
    Type.Omit(GameAction, ['playerId']),
    Type.Object({
        type: Type.Literal(ActionType.Fish),
        playerId: Type.String(),
        boatId: Type.String(),
        boatCoords: AxialCoordinates,
        metadata: Type.Optional(
            Type.Object({
                dieResults: Type.Array(Type.Boolean())
            })
        )
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
    declare metadata: { dieResults: boolean[] }

    constructor(data: Fish) {
        super(data, FishValidator)
    }

    apply(state: HydratedKaivaiGameState, context?: MachineContext) {
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
        const config = context?.gameConfig as KaivaiGameConfig
        let numFish = 0
        if (config?.lucklessFishing) {
            // One fish per hut and god
            numFish = Math.max(...fishingData.map((data) => data.numHuts + (data.hasGod ? 1 : 0)))
        } else if (config?.ruleSet === Ruleset.FirstEdition) {
            // God adds a die roll
            const numDice = Math.max(
                ...fishingData.map((data) => data.numHuts + (data.hasGod ? 1 : 0))
            )
            const dieResults = this.rollDice(Math.max(numDice, 4), state.prng.random)
            this.metadata = { dieResults }
            numFish = dieResults.reduce((acc, result) => acc + (result ? 1 : 0), 0)
            this.revealsInfo = true
        } else if (config?.ruleSet === Ruleset.SecondEdition) {
            // God gives a guaranteed fish
            const bestIsland = fishingData.reduce((best, current) => {
                if (!best) {
                    return current
                }
                const bestTotal = best.numHuts + (best.hasGod ? 1 : 0)
                const currentTotal = current.numHuts + (current.hasGod ? 1 : 0)
                if (currentTotal > bestTotal || (currentTotal === bestTotal && current.hasGod)) {
                    return current
                }
                return best
            })

            if (!bestIsland) {
                throw Error('No valid fishing locations')
            }

            const dieResults = this.rollDice(Math.max(bestIsland.numHuts, 4), state.prng.random)
            this.metadata = { dieResults }
            numFish =
                dieResults.reduce((acc, result) => acc + (result ? 1 : 0), 0) +
                (bestIsland.hasGod ? 1 : 0)
            this.revealsInfo = true
        }

        playerState.fish[config?.ruleSet === Ruleset.SecondEdition ? 3 : 4] += numFish
    }

    private rollDice(numDice: number, random: RandomFunction): boolean[] {
        const results = []
        if (numDice > 0) {
            results.push(Math.floor(random() * 6) < 5)
        }

        if (numDice > 1) {
            results.push(Math.floor(random() * 6) < 4)
        }

        if (numDice > 2) {
            results.push(Math.floor(random() * 6) < 3)
        }

        if (numDice > 3) {
            results.push(Math.floor(random() * 6) < 2)
        }

        return new Array(numDice).fill(true)
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

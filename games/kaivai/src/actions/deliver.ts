import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import {
    AxialCoordinates,
    GameAction,
    HydratableAction,
    MachineContext,
    sameCoordinates
} from '@tabletop/common'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { HydratedKaivaiPlayerState } from '../model/playerState.js'
import { isDeliverableCell } from '../definition/cells.js'
import { MachineState } from '../definition/states.js'

export type Delivery = Static<typeof Delivery>
export const Delivery = Type.Object({
    coords: AxialCoordinates,
    amount: Type.Number()
})

export type Deliver = Static<typeof Deliver>
export const Deliver = Type.Composite([
    Type.Omit(GameAction, ['playerId']),
    Type.Object({
        type: Type.Literal(ActionType.Deliver),
        playerId: Type.String(),
        boatId: Type.String(),
        boatCoords: AxialCoordinates,
        deliveries: Type.Array(Delivery)
    })
])

export const DeliverValidator = TypeCompiler.Compile(Deliver)

export function isDeliver(action?: GameAction): action is Deliver {
    return action?.type === ActionType.Deliver
}

export class HydratedDeliver extends HydratableAction<typeof Deliver> implements Deliver {
    declare type: ActionType.Deliver
    declare playerId: string
    declare boatId: string
    declare boatCoords: AxialCoordinates
    declare deliveries: Delivery[]

    constructor(data: Deliver) {
        super(data, DeliverValidator)
    }

    apply(state: HydratedKaivaiGameState, _context?: MachineContext) {
        const playerState = state.getPlayerState(this.playerId)
        const { valid, reason } = HydratedDeliver.areValidDeliveries({
            state,
            playerId: this.playerId,
            boatId: this.boatId,
            boatCoords: this.boatCoords,
            deliveries: this.deliveries
        })

        if (!valid) {
            throw Error(reason)
        }

        if (state.machineState === MachineState.TakingActions) {
            const requiredInfluence = state.influence[ActionType.Deliver] ?? 0
            if (playerState.influence < requiredInfluence) {
                throw Error('Player does not have enough influence to deliver')
            }

            if (requiredInfluence === 0) {
                state.influence[ActionType.Deliver] = 1
            } else {
                playerState.influence -= requiredInfluence
                state.influence[ActionType.Deliver] += requiredInfluence
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

        // Deliver fish
        for (const delivery of this.deliveries) {
            const cell = state.board.getCellAt(delivery.coords)
            if (!isDeliverableCell(cell)) {
                throw Error('Invalid delivery location')
            }

            cell.fish += delivery.amount
            playerState.removeFish(delivery.amount)

            if (cell.owner !== this.playerId) {
                playerState.shells[4] += 1
                if (delivery.amount > 1) {
                    playerState.shells[3] += 1
                }
                if (delivery.amount > 2) {
                    playerState.shells[2] += 1
                }
            }
        }
    }

    static areValidDeliveries({
        state,
        playerId,
        boatId,
        boatCoords,
        deliveries
    }: {
        state: HydratedKaivaiGameState
        playerId: string
        boatId: string
        boatCoords: AxialCoordinates
        deliveries: Delivery[]
    }): { valid: boolean; reason: string } {
        const playerState = state.getPlayerState(playerId)

        const numFish = deliveries.reduce((sum, delivery) => sum + delivery.amount, 0)
        if (numFish === 0) {
            return { valid: false, reason: 'No fish delivered' }
        }

        if (numFish > playerState.numFish()) {
            return { valid: false, reason: 'Not enough fish to deliver' }
        }

        const { valid, reason } = HydratedDeliver.isValidDeliveryLocation({
            state,
            boatId,
            boatCoords
        })

        if (!valid) {
            return { valid, reason }
        }

        const deliverableCells = state.board.getDeliverableNeighbors(boatCoords)
        for (const delivery of deliveries) {
            const cell = deliverableCells.find((cell) =>
                sameCoordinates(cell.coords, delivery.coords)
            )
            if (!isDeliverableCell(cell)) {
                return { valid: false, reason: 'Invalid delivery location' }
            }
            if (cell.fish + delivery.amount > 3) {
                return { valid: false, reason: 'Too many fish delivered for this location' }
            }
        }

        return { valid: true, reason: '' }
    }

    static canBoatDeliver({
        gameState,
        playerState,
        boatId
    }: {
        gameState: HydratedKaivaiGameState
        playerState: HydratedKaivaiPlayerState
        boatId: string
    }): boolean {
        if (playerState.numFish() === 0) {
            return false
        }

        const validLocations = HydratedDeliver.validBoatLocations({
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

        const validHexes: AxialCoordinates[] = []
        for (const hex of reachableHexes) {
            const { valid } = HydratedDeliver.isValidDeliveryLocation({
                state: gameState,
                boatId,
                boatCoords: hex
            })
            if (valid) {
                validHexes.push(hex)
                if (stopAtFirst) {
                    return validHexes
                }
            }
        }
        return validHexes
    }

    static isValidDeliveryLocation({
        state,
        boatId,
        boatCoords
    }: {
        state: HydratedKaivaiGameState
        boatId: string
        boatCoords: AxialCoordinates
    }): { valid: boolean; reason: string } {
        const board = state.board

        // I think this is technically not in the rules
        if (!board.isWaterCell(boatCoords)) {
            return { valid: false, reason: 'Boat must be on water' }
        }

        if (state.board.hasOtherBoat(boatCoords, boatId)) {
            return { valid: false, reason: 'Another boat is already at the specified location' }
        }

        if (state.board.getDeliverableNeighbors(boatCoords).length === 0) {
            return {
                valid: false,
                reason: 'Boat must be adjacent to a meeting hut or empty boatbuilder'
            }
        }

        return { valid: true, reason: '' }
    }
}

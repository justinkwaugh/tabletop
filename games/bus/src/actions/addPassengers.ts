import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assert, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedBusGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Passenger } from '../components/passenger.js'
import { BUS_STATION_IDS } from '../utils/busGraph.js'
import type { BusStationId } from '../utils/busGraph.js'

export type AddPassengersMetadata = Type.Static<typeof AddPassengersMetadata>
export const AddPassengersMetadata = Type.Object({
    passengersAdded: Type.Array(Passenger)
})

export type AddPassengers = Type.Static<typeof AddPassengers>
export const AddPassengers = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.AddPassengers), // This action is always this type
            playerId: Type.String(), // Required now
            metadata: Type.Optional(AddPassengersMetadata), // Always optional, because it is an output
            stationId: Type.String(), // The ID of the station where the player wants to add passengers
            numPassengers: Type.Number() // The number of passengers the player wants to add
        })
    ])
)

export const AddPassengersValidator = Compile(AddPassengers)

export function isAddPassengers(action?: GameAction): action is AddPassengers {
    return action?.type === ActionType.AddPassengers
}

export class HydratedAddPassengers
    extends HydratableAction<typeof AddPassengers>
    implements AddPassengers
{
    declare type: ActionType.AddPassengers
    declare playerId: string
    declare metadata?: AddPassengersMetadata
    declare stationId: string
    declare numPassengers: number

    constructor(data: AddPassengers) {
        super(data, AddPassengersValidator)
    }

    apply(state: HydratedBusGameState, context?: MachineContext) {
        if (!this.isValidAddPassengers(state)) {
            throw Error('Invalid AddPassengers action')
        }

        assert(this.isBusStationId(this.stationId), 'Invalid station ID')

        const passengersAdded = state.passengers.splice(0, this.numPassengers)
        state.board.addPassengers(passengersAdded, this.stationId)

        this.metadata = { passengersAdded }
    }

    isValidAddPassengers(state: HydratedBusGameState): boolean {
        // Need to check allowed amount as well
        return this.isBusStationId(this.stationId) && this.numPassengers <= state.passengers.length
    }

    isBusStationId(stationId: string): stationId is BusStationId {
        return BUS_STATION_IDS.includes(stationId as BusStationId)
    }

    static canAddPassengers(state: HydratedBusGameState, playerId: string): boolean {
        return state.passengers.length > 0
    }
}

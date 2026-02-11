import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assert, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedBusGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { BuildingSites, isSiteId } from '../utils/busGraph.js'
import { isBusNodeId } from '../utils/busLineRules.js'
import { Passenger } from '../components/passenger.js'
import { MachineState } from '../definition/states.js'

export type VroomMetadata = Type.Static<typeof VroomMetadata>
export const VroomMetadata = Type.Object({
    passengerId: Type.String()
})

export type Vroom = Type.Static<typeof Vroom>
export const Vroom = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.Vroom), // This action is always this type
            playerId: Type.String(), // Required now
            metadata: Type.Optional(VroomMetadata), // Always optional, because it is an output
            sourceNode: Type.String(),
            destinationSite: Type.String()
        })
    ])
)

export const VroomValidator = Compile(Vroom)

export function isVroom(action?: GameAction): action is Vroom {
    return action?.type === ActionType.Vroom
}

export class HydratedVroom extends HydratableAction<typeof Vroom> implements Vroom {
    declare type: ActionType.Vroom
    declare playerId: string
    declare metadata?: VroomMetadata
    declare sourceNode: string
    declare destinationSite: string

    constructor(data: Vroom) {
        super(data, VroomValidator)
    }

    apply(state: HydratedBusGameState, context?: MachineContext) {
        if (!this.isValidVroom(state)) {
            throw Error('Invalid Vroom action')
        }

        const passengers = state.board.passengersAtNode(this.sourceNode)
        const passengerToDeliver = passengers[0]
        assert(
            isSiteId(this.destinationSite),
            `Expected destinationSite to be a BuildingSiteId, got ${this.destinationSite}`
        )
        const buildingSite = BuildingSites[this.destinationSite]
        passengerToDeliver.nodeId = buildingSite.nodeId
        passengerToDeliver.siteId = this.destinationSite

        this.metadata = {
            passengerId: passengerToDeliver.id
        }
    }

    isValidVroom(state: HydratedBusGameState): boolean {
        if (!isBusNodeId(this.sourceNode)) {
            return false
        }
        if (!isSiteId(this.destinationSite)) {
            return false
        }

        const playerState = state.getPlayerState(this.playerId)
        const busLine = playerState.busLine

        if (!busLine.includes(this.sourceNode)) {
            return false
        }

        if (state.board.passengersAtNode(this.sourceNode).length === 0) {
            return false
        }

        const destinationNodeId = BuildingSites[this.destinationSite].nodeId
        if (!busLine.includes(destinationNodeId)) {
            return false
        }

        const destinationBuilding = state.board.buildings[this.destinationSite]
        if (!destinationBuilding) {
            return false
        }

        return (
            destinationBuilding.type === state.currentLocation &&
            !state.board.passengerAtSite(this.destinationSite)
        )
    }

    static canVroom(state: HydratedBusGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        if (
            state.machineState === MachineState.Vrooming &&
            state.actionsTaken >= playerState.buses
        ) {
            return false
        }

        const busLine = playerState.busLine
        return busLine.some((nodeId) =>
            state.board
                .passengersAtNode(nodeId)
                .some((passenger) => this.canDeliverPassenger(state, playerId, passenger))
        )
    }

    static canDeliverPassenger(
        state: HydratedBusGameState,
        playerId: string,
        passenger: Passenger
    ): boolean {
        if (!passenger.nodeId || passenger.siteId) {
            return false
        }

        const busLine = state.getPlayerState(playerId).busLine
        if (!busLine.includes(passenger.nodeId)) {
            return false
        }

        return busLine.some((nodeId) => {
            assert(isBusNodeId(nodeId), `Expected nodeId to be a BusNodeId, got ${nodeId}`)
            const buildings = state.board.buildingsForNode(nodeId)
            return buildings.some(
                (building) =>
                    building.type === state.currentLocation &&
                    !state.board.passengerAtSite(building.site)
            )
        })
    }
}

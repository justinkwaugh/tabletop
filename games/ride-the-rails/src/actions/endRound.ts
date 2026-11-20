import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { CityId } from '../data/boardMap.js'
import { RailroadId } from '../data/railroads.js'
import { ActionType } from '../definition/actions.js'
import { inCityIdOrder, type HydratedRideTheRailsGameState } from '../model/gameState.js'
import {
    currentRoundNumber,
    isLastRound,
    ROUND_END_PASSENGER_CITY,
    roundEndPassenger,
    turnOrderByMoney
} from '../rules/endOfRound.js'
import { PlayerMoney, moneyOf } from '../rules/scoring.js'
import { availableRailroads } from '../rules/supply.js'

export type EndRoundMetadata = Type.Static<typeof EndRoundMetadata>
export const EndRoundMetadata = Type.Object({
    round: Type.Integer({ minimum: 1 }),
    turnOrder: Type.Array(Type.String()),
    money: Type.Array(PlayerMoney),
    railroadId: Type.Optional(RailroadId),
    // R-8 (France): the city that took a passenger at the end of the round.
    passengerPlacedIn: Type.Optional(CityId)
})

export type EndRound = Type.Static<typeof EndRound>
export const EndRound = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.EndRound),
            metadata: Type.Optional(EndRoundMetadata)
        })
    ])
)

export const EndRoundValidator = Compile(EndRound)

export function isEndRound(action?: GameAction): action is EndRound {
    return action?.type === ActionType.EndRound
}

export class HydratedEndRound extends HydratableAction<typeof EndRound> implements EndRound {
    declare type: ActionType.EndRound
    declare metadata?: EndRoundMetadata

    constructor(data: EndRound) {
        super(data, EndRoundValidator)
    }

    // R-2.5; R-8 (France): Paris Travels.
    apply(state: HydratedRideTheRailsGameState, _context?: MachineContext) {
        assert(HydratedEndRound.canEndRound(state), 'Round 6 ends the game instead (R-6.1)')
        const round = currentRoundNumber(state)
        const availableBefore = availableRailroads(state)

        const turnOrder = turnOrderByMoney(state)
        state.turnManager.turnOrder = turnOrder

        state.roundManager.endRound(state.actionCount)
        state.roundManager.startRound(state.actionCount + 1)

        const railroadId = availableRailroads(state).find((id) => !availableBefore.includes(id))
        const passengerPlacedIn = roundEndPassenger(
            ROUND_END_PASSENGER_CITY[state.mapId],
            state.passengers
        )
        if (passengerPlacedIn) {
            state.passengers = inCityIdOrder([...state.passengers, passengerPlacedIn])
        }
        this.metadata = {
            round,
            turnOrder,
            money: moneyOf(state, turnOrder),
            ...(railroadId ? { railroadId } : {}),
            ...(passengerPlacedIn ? { passengerPlacedIn } : {})
        }
    }

    // R-2.5, R-6.1
    static canEndRound(state: HydratedRideTheRailsGameState): boolean {
        return !isLastRound(state)
    }
}

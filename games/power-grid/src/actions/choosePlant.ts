import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedPowerGridGameState } from '../model/gameState.js'
import { AuctionResult } from './auctionResult.js'

export type ChoosePlant = Type.Static<typeof ChoosePlant>
export const ChoosePlant = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChoosePlant),
            playerId: Type.String(),
            plant: Type.Integer(),
            bid: Type.Integer({ minimum: 1 }),
            metadata: Type.Optional(AuctionResult)
        })
    ])
)

export const ChoosePlantValidator = Compile(ChoosePlant)

export function isChoosePlant(action?: GameAction): action is ChoosePlant {
    return action?.type === ActionType.ChoosePlant
}

export class HydratedChoosePlant
    extends HydratableAction<typeof ChoosePlant>
    implements ChoosePlant
{
    declare type: ActionType.ChoosePlant
    declare playerId: string
    declare plant: number
    declare bid: number
    declare metadata?: AuctionResult

    constructor(data: ChoosePlant) {
        super(data, ChoosePlantValidator)
    }

    apply(state: HydratedPowerGridGameState, _context?: MachineContext) {
        if (!HydratedChoosePlant.isValidChoice(state, this.playerId, this.plant, this.bid)) {
            throw Error('Invalid ChoosePlant action')
        }
        const outcome = state.openAuction(this.id, this.playerId, this.plant, this.bid)
        this.metadata = {
            plant: this.plant,
            withdrawn: outcome.withdrawn,
            winner: outcome.winner
        }
    }

    static isValidChoice(
        state: HydratedPowerGridGameState,
        playerId: string,
        plant: number,
        bid: number
    ): boolean {
        const minimum = state.minimumBid(plant)
        return (
            state.auctionablePlants().includes(plant) &&
            bid >= minimum &&
            state.canAfford(playerId, bid) &&
            (!state.choosesUnopposed(playerId) || bid === minimum)
        )
    }

    static canChoose(state: HydratedPowerGridGameState, playerId: string): boolean {
        return state
            .auctionablePlants()
            .some((plant) => state.canAfford(playerId, state.minimumBid(plant)))
    }
}

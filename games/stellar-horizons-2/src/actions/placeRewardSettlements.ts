import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import {
    RewardPlacement,
    isValidRewardPlacement,
    placeRewardSettlements
} from '../model/settlementRewards.js'

export type PlaceRewardSettlements = Type.Static<typeof PlaceRewardSettlements>
export const PlaceRewardSettlements = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceRewardSettlements),
            playerId: Type.String(),
            placements: Type.Array(RewardPlacement)
        })
    ])
)

export const PlaceRewardSettlementsValidator = Compile(PlaceRewardSettlements)

export function isPlaceRewardSettlements(action?: GameAction): action is PlaceRewardSettlements {
    return action?.type === ActionType.PlaceRewardSettlements
}

export class HydratedPlaceRewardSettlements
    extends HydratableAction<typeof PlaceRewardSettlements>
    implements PlaceRewardSettlements
{
    declare type: ActionType.PlaceRewardSettlements
    declare playerId: string
    declare placements: RewardPlacement[]

    constructor(data: PlaceRewardSettlements) {
        super(data, PlaceRewardSettlementsValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        if (
            state.settlementRewards.at(0)?.playerId !== this.playerId ||
            !isValidRewardPlacement(state, this.placements)
        ) {
            throw Error('Invalid PlaceRewardSettlements action')
        }
        placeRewardSettlements(state, this.placements)
    }
}

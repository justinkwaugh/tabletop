import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, Visibility } from '@tabletop/common'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type PlaceScoringBid = Type.Static<typeof PlaceScoringBid>
export const PlaceScoringBid = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceScoringBid),
            playerId: Type.String(),
            amount: Visibility.protect(Type.Number(), { policy: Visibility.Policy.Actor })
        })
    ])
)

export const PlaceScoringBidValidator = Compile(PlaceScoringBid)

export function isPlaceScoringBid(action?: GameAction): action is PlaceScoringBid {
    return action?.type === ActionType.PlaceScoringBid
}

export class HydratedPlaceScoringBid
    extends HydratableAction<typeof PlaceScoringBid>
    implements PlaceScoringBid
{
    declare type: ActionType.PlaceScoringBid
    declare playerId: string
    declare amount: number

    constructor(data: PlaceScoringBid) {
        super(data, PlaceScoringBidValidator)
    }

    apply(state: HydratedKaivaiGameState) {
        const { valid, reason } = HydratedPlaceScoringBid.isValidBid(
            state,
            this.playerId,
            this.amount
        )

        if (!valid) {
            throw Error(reason)
        }

        if (state.scoringBids === undefined) {
            state.bids[this.playerId] = this.amount
        } else {
            state.scoringBids.push({ playerId: this.playerId, amount: this.amount })
        }
    }

    static isValidBid(
        state: HydratedKaivaiGameState,
        playerId: string,
        amount: number
    ): { valid: boolean; reason: string } {
        const playerState = state.getPlayerState(playerId)
        if (amount < 0 || amount > playerState.influence) {
            return { valid: false, reason: "Bid must be between 0 and the player's influence" }
        }

        if (!state.bidders.includes(playerId)) {
            return { valid: false, reason: 'Player is not a bidder' }
        }

        const alreadyBid =
            state.scoringBids === undefined
                ? Object.hasOwn(state.bids, playerId)
                : state.scoringBids.some((bid) => bid.playerId === playerId)
        if (alreadyBid) {
            return { valid: false, reason: 'Player already bid' }
        }

        return { valid: true, reason: '' }
    }
}

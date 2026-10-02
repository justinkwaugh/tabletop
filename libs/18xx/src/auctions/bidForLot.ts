import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import {
    activeSelectionAuction,
    type SelectionAuctionRules,
    type SelectionAuctionState
} from './selectionAuction.js'

export const BidForLot = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('BidForLot'),
        lotId: Type.String(),
        amount: Type.Integer({ minimum: 1 })
    },
    { additionalProperties: false }
)
export type BidForLot = Type.Static<typeof BidForLot>
const Validator = Compile(BidForLot)
export function isBidForLot(action: GameAction): action is BidForLot {
    return (
        action instanceof HydratedBidForLot ||
        (action.type === 'BidForLot' && Validator.Check(action))
    )
}
export class HydratedBidForLot extends HydratableAction<typeof BidForLot> implements BidForLot {
    declare type: 'BidForLot'
    declare playerId: string
    declare lotId: string
    declare amount: number
    readonly #rules: SelectionAuctionRules
    constructor(data: BidForLot, rules: SelectionAuctionRules) {
        super(data instanceof HydratedBidForLot ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    isValid(state: SelectionAuctionState & { machineState: string }): boolean {
        const model = activeSelectionAuction(state, this.#rules)
        return (
            !!model &&
            this.source === ActionSource.User &&
            state.activePlayerIds.includes(this.playerId) &&
            model.canBid(this.playerId, this.lotId, this.amount)
        )
    }
    apply(state: HydratedGameState & SelectionAuctionState): void {
        assert(this.isValid(state), 'Invalid BidForLot action')
        activeSelectionAuction(state, this.#rules)!.bid(this.playerId, this.lotId, this.amount)
    }
}

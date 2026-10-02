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
    requireActiveSelectionAuction,
    type SelectionAuctionRules,
    type SelectionAuctionState
} from './selectionAuction.js'

export const PassSelectionAuction = Type.Object(
    { ...PlayerAction.properties, type: Type.Literal('PassSelectionAuction') },
    { additionalProperties: false }
)
export type PassSelectionAuction = Type.Static<typeof PassSelectionAuction>
const Validator = Compile(PassSelectionAuction)
export function isPassSelectionAuction(action: GameAction): action is PassSelectionAuction {
    return (
        action instanceof HydratedPassSelectionAuction ||
        (action.type === 'PassSelectionAuction' && Validator.Check(action))
    )
}
export class HydratedPassSelectionAuction
    extends HydratableAction<typeof PassSelectionAuction>
    implements PassSelectionAuction
{
    declare type: 'PassSelectionAuction'
    declare playerId: string
    readonly #rules: SelectionAuctionRules
    constructor(data: PassSelectionAuction, rules: SelectionAuctionRules) {
        super(data instanceof HydratedPassSelectionAuction ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    isValid(state: SelectionAuctionState & { machineState: string }): boolean {
        const model = activeSelectionAuction(state, this.#rules)
        return (
            !!model &&
            this.source === ActionSource.User &&
            state.activePlayerIds.includes(this.playerId) &&
            model.canPass(this.playerId)
        )
    }
    apply(state: HydratedGameState & SelectionAuctionState): void {
        assert(this.isValid(state), 'Invalid PassSelectionAuction action')
        requireActiveSelectionAuction(state, this.#rules).pass(this.playerId)
    }
}

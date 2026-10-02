import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    type HydratedGameState
} from '@tabletop/common'
import {
    activeSelectionAuction,
    type SelectionAuctionRules,
    type SelectionAuctionState
} from './selectionAuction.js'
import { startFirstStockRound } from './startFirstStockRound.js'
import type { StockState } from '../stock/stockState.js'

const ResolveFields = Type.Object({ type: Type.Literal('ResolveSelectionAuction') })
export const ResolveSelectionAuction: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof ResolveFields.properties
> = Type.Object(
    { ...GameAction.properties, ...ResolveFields.properties },
    { additionalProperties: false }
)
export type ResolveSelectionAuction = Type.Static<typeof ResolveSelectionAuction>
const Validator = Compile(ResolveSelectionAuction)
export function isResolveSelectionAuction(action: GameAction): action is ResolveSelectionAuction {
    return (
        action instanceof HydratedResolveSelectionAuction ||
        (action.type === 'ResolveSelectionAuction' && Validator.Check(action))
    )
}
export class HydratedResolveSelectionAuction
    extends HydratableAction<typeof ResolveSelectionAuction>
    implements ResolveSelectionAuction
{
    declare type: 'ResolveSelectionAuction'
    readonly #rules: SelectionAuctionRules
    constructor(data: ResolveSelectionAuction, rules: SelectionAuctionRules) {
        super(data instanceof HydratedResolveSelectionAuction ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    isValid(state: SelectionAuctionState & { machineState: string }): boolean {
        const model = activeSelectionAuction(state, this.#rules)
        return !!model && this.source === ActionSource.System && !!model.resolution()
    }
    apply(state: HydratedGameState & SelectionAuctionState & StockState): void {
        assert(this.isValid(state), 'Invalid ResolveSelectionAuction action')
        const model = activeSelectionAuction(state, this.#rules)!
        model.resolve()
        if (!model.auction.completed) return
        // The player who would have nominated next has priority in the first stock round.
        state.turnManager.newFirstPlayer(model.auction.nominatorId)
        startFirstStockRound(state, state.turnManager.turnOrder)
    }
}

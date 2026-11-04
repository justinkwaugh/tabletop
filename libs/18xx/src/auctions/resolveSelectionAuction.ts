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
    SelectionAuctionResolution,
    activeSelectionAuction,
    requireActiveSelectionAuction,
    type SelectionAuctionRules,
    type SelectionAuctionState
} from './selectionAuction.js'
import { startFirstStockRound } from './startFirstStockRound.js'
import type { ValuationRules } from '../ending/finalWealth.js'
import { RoundEnd, roundEnd } from '../ending/roundEnd.js'
import type { StockState } from '../stock/stockState.js'

const ResolveFields = Type.Object({
    type: Type.Literal('ResolveSelectionAuction'),
    metadata: Type.Optional(
        Type.Object(
            {
                resolution: SelectionAuctionResolution,
                completed: Type.Boolean(),
                roundEnd: Type.Optional(RoundEnd)
            },
            { additionalProperties: false }
        )
    )
})
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
    declare metadata?: ResolveSelectionAuction['metadata']
    readonly #rules: SelectionAuctionRules
    readonly #valuationRules: ValuationRules
    constructor(
        data: ResolveSelectionAuction,
        rules: SelectionAuctionRules,
        valuationRules: ValuationRules
    ) {
        super(data instanceof HydratedResolveSelectionAuction ? data.dehydrate() : data, Validator)
        this.#rules = rules
        this.#valuationRules = valuationRules
    }
    isValid(state: SelectionAuctionState & { machineState: string }): boolean {
        const model = activeSelectionAuction(state, this.#rules)
        return !!model && this.source === ActionSource.System && !!model.resolution()
    }
    apply(state: HydratedGameState & SelectionAuctionState & StockState): void {
        assert(this.isValid(state), 'Invalid ResolveSelectionAuction action')
        const model = requireActiveSelectionAuction(state, this.#rules)
        const resolution = model.resolve()
        this.metadata = { resolution, completed: model.auction.completed }
        if (!model.auction.completed) return
        // The player who would have nominated next has priority in the first stock round.
        state.turnManager.newFirstPlayer(model.auction.nominatorId)
        startFirstStockRound(state, state.turnManager.turnOrder)
        this.metadata.roundEnd = roundEnd(state, this.#valuationRules, 'opening')
    }
}

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

export const NominateLot = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('NominateLot'),
        lotId: Type.String(),
        amount: Type.Integer({ minimum: 0 })
    },
    { additionalProperties: false }
)
export type NominateLot = Type.Static<typeof NominateLot>
const Validator = Compile(NominateLot)
export function isNominateLot(action: GameAction): action is NominateLot {
    return (
        action instanceof HydratedNominateLot ||
        (action.type === 'NominateLot' && Validator.Check(action))
    )
}
export class HydratedNominateLot
    extends HydratableAction<typeof NominateLot>
    implements NominateLot
{
    declare type: 'NominateLot'
    declare playerId: string
    declare lotId: string
    declare amount: number
    readonly #rules: SelectionAuctionRules
    constructor(data: NominateLot, rules: SelectionAuctionRules) {
        super(data instanceof HydratedNominateLot ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    isValid(state: SelectionAuctionState & { machineState: string }): boolean {
        const model = activeSelectionAuction(state, this.#rules)
        return (
            !!model &&
            this.source === ActionSource.User &&
            state.activePlayerIds.includes(this.playerId) &&
            model.canNominate(this.playerId, this.lotId, this.amount)
        )
    }
    apply(state: HydratedGameState & SelectionAuctionState): void {
        assert(this.isValid(state), 'Invalid NominateLot action')
        activeSelectionAuction(state, this.#rules)!.nominate(
            this.playerId,
            this.lotId,
            this.amount,
            this.id
        )
    }
}

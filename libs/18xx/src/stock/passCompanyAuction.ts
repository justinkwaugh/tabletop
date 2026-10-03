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
import { CompanyAuctionModel, type CompanyAuctionState } from './companyAuction.js'
import type { StockRules } from './stockRules.js'

export const PassCompanyAuction = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('PassCompanyAuction'),
        companyId: Type.String()
    },
    { additionalProperties: false }
)
export type PassCompanyAuction = Type.Static<typeof PassCompanyAuction>
const Validator = Compile(PassCompanyAuction)
export function isPassCompanyAuction(action: GameAction): action is PassCompanyAuction {
    return (
        action instanceof HydratedPassCompanyAuction ||
        (action.type === 'PassCompanyAuction' && Validator.Check(action))
    )
}
export class HydratedPassCompanyAuction
    extends HydratableAction<typeof PassCompanyAuction>
    implements PassCompanyAuction
{
    declare type: 'PassCompanyAuction'
    declare playerId: string
    declare companyId: string
    readonly #rules: StockRules
    constructor(data: PassCompanyAuction, rules: StockRules) {
        super(data instanceof HydratedPassCompanyAuction ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    isValid(state: CompanyAuctionState): boolean {
        const model = new CompanyAuctionModel(state, this.#rules)
        return (
            this.source === ActionSource.User &&
            model.auction?.companyId === this.companyId &&
            model.canPass(this.playerId)
        )
    }
    apply(state: HydratedGameState & CompanyAuctionState): void {
        assert(this.isValid(state), 'Invalid PassCompanyAuction action')
        new CompanyAuctionModel(state, this.#rules).pass(this.playerId)
    }
}

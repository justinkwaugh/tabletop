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

export const BidForCompany = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('BidForCompany'),
        companyId: Type.String(),
        amount: Type.Integer({ minimum: 1 })
    },
    { additionalProperties: false }
)
export type BidForCompany = Type.Static<typeof BidForCompany>
const Validator = Compile(BidForCompany)
export function isBidForCompany(action: GameAction): action is BidForCompany {
    return (
        action instanceof HydratedBidForCompany ||
        (action.type === 'BidForCompany' && Validator.Check(action))
    )
}
export class HydratedBidForCompany
    extends HydratableAction<typeof BidForCompany>
    implements BidForCompany
{
    declare type: 'BidForCompany'
    declare playerId: string
    declare companyId: string
    declare amount: number
    readonly #rules: StockRules
    constructor(data: BidForCompany, rules: StockRules) {
        super(data instanceof HydratedBidForCompany ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    isValid(state: CompanyAuctionState): boolean {
        const model = new CompanyAuctionModel(state, this.#rules)
        return (
            this.source === ActionSource.User &&
            model.auction?.companyId === this.companyId &&
            model.canBid(this.playerId, this.amount)
        )
    }
    apply(state: HydratedGameState & CompanyAuctionState): void {
        assert(this.isValid(state), 'Invalid BidForCompany action')
        new CompanyAuctionModel(state, this.#rules).bid(this.playerId, this.amount)
    }
}

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

export const AuctionCompany = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('AuctionCompany'),
        companyId: Type.String(),
        amount: Type.Integer({ minimum: 1 }),
        home: Type.Object(
            { locationId: Type.String(), nodeId: Type.String() },
            { additionalProperties: false }
        )
    },
    { additionalProperties: false }
)
export type AuctionCompany = Type.Static<typeof AuctionCompany>
const Validator = Compile(AuctionCompany)
export function isAuctionCompany(action: GameAction): action is AuctionCompany {
    return (
        action instanceof HydratedAuctionCompany ||
        (action.type === 'AuctionCompany' && Validator.Check(action))
    )
}
export class HydratedAuctionCompany
    extends HydratableAction<typeof AuctionCompany>
    implements AuctionCompany
{
    declare type: 'AuctionCompany'
    declare playerId: string
    declare companyId: string
    declare amount: number
    declare home: AuctionCompany['home']
    readonly #rules: StockRules
    constructor(data: AuctionCompany, rules: StockRules) {
        super(data instanceof HydratedAuctionCompany ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    isValid(state: CompanyAuctionState): boolean {
        return (
            this.source === ActionSource.User &&
            state.activePlayerIds.includes(this.playerId) &&
            !new CompanyAuctionModel(state, this.#rules).openingReason(this)
        )
    }
    apply(state: HydratedGameState & CompanyAuctionState): void {
        assert(this.isValid(state), 'Invalid AuctionCompany action')
        new CompanyAuctionModel(state, this.#rules).open(this, this.id)
    }
}

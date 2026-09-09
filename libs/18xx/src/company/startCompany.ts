import { recordStockAction } from '../stock/stockRoundRules.js'
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
import { Owner, getCompany } from '../finance/finance.js'
import { applySharePurchase } from '../stock/sharePurchase.js'
import { placeStockMarker } from '../stock/stockMarket.js'
import { CompanyStartDetails, evaluateCompanyStart } from './companyStart.js'
import type { StockState } from '../stock/stockState.js'
import type { StockRules } from '../stock/stockRules.js'
import type { CompanyRules } from './companyRules.js'

export const StartCompany = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('StartCompany'),
        buyer: Owner,
        companyId: Type.String(),
        marketSpaceId: Type.String(),
        expectedPrice: Type.Integer({ minimum: 1 }),
        metadata: Type.Optional(CompanyStartDetails)
    },
    { additionalProperties: false }
)
export type StartCompany = Type.Static<typeof StartCompany>
const Validator = Compile(StartCompany)
export function isStartCompany(action: GameAction): action is StartCompany {
    return (
        action instanceof HydratedStartCompany ||
        (action.type === 'StartCompany' && Validator.Check(action))
    )
}
export class HydratedStartCompany
    extends HydratableAction<typeof StartCompany>
    implements StartCompany
{
    declare type: 'StartCompany'
    declare playerId: string
    declare buyer: Owner
    declare companyId: string
    declare marketSpaceId: string
    declare expectedPrice: number
    declare metadata?: CompanyStartDetails
    readonly #stockRules: StockRules
    readonly #companyRules: CompanyRules
    constructor(data: StartCompany, stockRules: StockRules, companyRules: CompanyRules) {
        super(data instanceof HydratedStartCompany ? data.dehydrate() : data, Validator)
        this.#stockRules = stockRules
        this.#companyRules = companyRules
    }
    apply(state: HydratedGameState & StockState): void {
        assert(this.source === ActionSource.User, 'Starting a company requires a player action')
        const result = evaluateCompanyStart(state, this, this.#stockRules, this.#companyRules)
        assert(result.details, result.reason ?? 'Invalid company start')
        assert(result.details.price === this.expectedPrice, 'Starting price has changed')
        assert(result.details.buyer.kind !== 'bank', 'A company requires a president')
        const company = getCompany(state, this.companyId)
        company.started = true
        company.parPrice = result.details.parPrice
        company.president = result.details.buyer
        placeStockMarker(state.stockMarket, this.companyId, this.marketSpaceId)
        recordStockAction(state, this.playerId, this.#stockRules.round)
        applySharePurchase(state, result.details)
        this.#companyRules.onStart?.(state, result.details)
        this.metadata = result.details
    }
}

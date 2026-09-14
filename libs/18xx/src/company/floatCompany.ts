import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    type HydratedGameState
} from '@tabletop/common'
import { getCompany } from '../finance/finance.js'
import { settleCashPayments } from '../finance/cashPayments.js'
import { CompanyFlotationDetails, evaluateCompanyFlotation } from './companyFlotation.js'
import type { TrainState } from '../trains/train.js'
import type { StockState } from '../stock/stockState.js'
import type { CompanyRules } from './companyRules.js'

const FloatFields = Type.Object(
    {
        type: Type.Literal('FloatCompany'),
        companyId: Type.String(),
        metadata: Type.Optional(CompanyFlotationDetails)
    },
    { additionalProperties: false }
)
export const FloatCompany: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof FloatFields.properties
> = Type.Object(
    { ...GameAction.properties, ...FloatFields.properties },
    { additionalProperties: false }
)
export type FloatCompany = Type.Static<typeof FloatCompany>
const Validator = Compile(FloatCompany)
export function isFloatCompany(action: GameAction): action is FloatCompany {
    return (
        action instanceof HydratedFloatCompany ||
        (action.type === 'FloatCompany' && Validator.Check(action))
    )
}
export class HydratedFloatCompany
    extends HydratableAction<typeof FloatCompany>
    implements FloatCompany
{
    declare type: 'FloatCompany'
    declare companyId: string
    declare metadata?: CompanyFlotationDetails
    readonly #rules: CompanyRules
    constructor(data: FloatCompany, rules: CompanyRules) {
        super(data instanceof HydratedFloatCompany ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    apply(state: HydratedGameState & StockState & TrainState): void {
        assert(this.source === ActionSource.System, 'Flotation requires a system action')
        const details = evaluateCompanyFlotation(state, this.companyId, this.#rules)
        assert(details, 'Company does not qualify to float')
        settleCashPayments(state, details.payments)
        const company = getCompany(state, this.companyId)
        if (details.payments.length) company.funded = true
        company.floated = true
        const exchanges = this.#rules.onFloat?.(state, this.companyId)
        if (exchanges?.length) details.exchanges = exchanges
        this.metadata = details
    }
}

import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import * as Value from 'typebox/value'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    assertExists,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import { CompanyAuctionModel, type CompanyAuctionState } from './companyAuction.js'
import type { StockRules } from './stockRules.js'

export const FormCompany = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('FormCompany'),
        companyId: Type.String(),
        shareCount: Type.Integer({ minimum: 1 }),
        privateIds: Type.Array(Type.String(), { uniqueItems: true, default: [] }),
        metadata: Type.Optional(
            Type.Object(
                {
                    price: Type.Integer({ minimum: 1 }),
                    marketSpaceId: Type.String(),
                    parPrice: Type.Integer({ minimum: 1 })
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type FormCompany = Type.Static<typeof FormCompany>
const Validator = Compile(FormCompany)
export function isFormCompany(action: GameAction): action is FormCompany {
    return (
        action instanceof HydratedFormCompany ||
        (action.type === 'FormCompany' && Validator.Check(action))
    )
}
export class HydratedFormCompany
    extends HydratableAction<typeof FormCompany>
    implements FormCompany
{
    declare type: 'FormCompany'
    declare playerId: string
    declare companyId: string
    declare shareCount: number
    declare privateIds: string[]
    declare metadata?: FormCompany['metadata']
    readonly #rules: StockRules
    constructor(data: FormCompany, rules: StockRules) {
        super(data instanceof HydratedFormCompany ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    isValid(state: CompanyAuctionState): boolean {
        const model = new CompanyAuctionModel(state, this.#rules)
        if (model.formationReason(this.playerId, this.companyId, this)) return false
        if (this.source === ActionSource.User) return true
        return (
            this.source === ActionSource.System &&
            Value.Equal(model.automaticFormation(), {
                shareCount: this.shareCount,
                privateIds: this.privateIds
            })
        )
    }
    apply(state: HydratedGameState & CompanyAuctionState): void {
        assert(this.isValid(state), 'Invalid FormCompany action')
        const model = new CompanyAuctionModel(state, this.#rules)
        const pending = model.pendingFormation()
        assertExists(pending, 'A formation follows a won auction')
        this.metadata = { price: pending.price, ...model.form(this.playerId, this.companyId, this) }
    }
}

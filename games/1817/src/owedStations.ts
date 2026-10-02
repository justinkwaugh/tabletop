import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    assertExists,
    type HydratedGameState
} from '@tabletop/common'
import {
    CashPayment,
    finiteCashOwnedBy,
    type EighteenXXStateHandler,
    type StationState,
    type StockState
} from '@tabletop/18xx'
import { StationPrice, buyOwedStations, stationsOwed } from './stockRules.js'
import { LiquidateCompany, isLiquidated } from './liquidation.js'
import { SystemActionFirstHandler } from './systemActionFirstHandler.js'

const Fields = Type.Object({
    type: Type.Literal('BuyOwedStations'),
    companyId: Type.String(),
    metadata: Type.Optional(
        Type.Object(
            { stations: Type.Integer({ minimum: 1 }), payment: CashPayment },
            { additionalProperties: false }
        )
    )
})
export const BuyOwedStations: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof Fields.properties
> = Type.Object({ ...GameAction.properties, ...Fields.properties }, { additionalProperties: false })
export type BuyOwedStations = Type.Static<typeof BuyOwedStations>
const Validator = Compile(BuyOwedStations)
export function isBuyOwedStations(action: GameAction): action is BuyOwedStations {
    return (
        action instanceof HydratedBuyOwedStations ||
        (action.type === 'BuyOwedStations' && Validator.Check(action))
    )
}

export function companyAbleToBuyStations(state: StockState & StationState): string | undefined {
    return state.companies.find((company) => {
        const owed = stationsOwed(state, company.id)
        return (
            owed > 0 &&
            !isLiquidated(state.stockMarket, company.id) &&
            finiteCashOwnedBy(state, { kind: 'company', companyId: company.id }) >=
                owed * StationPrice
        )
    })?.id
}

export class HydratedBuyOwedStations
    extends HydratableAction<typeof BuyOwedStations>
    implements BuyOwedStations
{
    declare type: 'BuyOwedStations'
    declare companyId: string
    declare metadata?: BuyOwedStations['metadata']
    constructor(data: BuyOwedStations) {
        super(data instanceof HydratedBuyOwedStations ? data.dehydrate() : data, Validator)
    }
    apply(state: HydratedGameState & StockState & StationState): void {
        assert(
            this.source === ActionSource.System &&
                companyAbleToBuyStations(state) === this.companyId,
            'The system buys stations a company can now pay for'
        )
        const stations = stationsOwed(state, this.companyId)
        const payment = buyOwedStations(state, this.companyId)
        assertExists(payment, 'The company can pay for its stations')
        this.metadata = { stations, payment }
    }
}

/** Buys owed stations as soon as a company's treasury can pay for them. */
export function buysOwedStations(handler: EighteenXXStateHandler): EighteenXXStateHandler {
    return new SystemActionFirstHandler(handler, BuyOwedStations, (state) => {
        const companyId = companyAbleToBuyStations(state)
        return companyId ? { companyId } : undefined
    })
}

/** A company that still owes stations when the stock round ends is liquidated. */
export function liquidatesUnpaidStations(handler: EighteenXXStateHandler): EighteenXXStateHandler {
    return new SystemActionFirstHandler(
        handler,
        LiquidateCompany,
        (state): Partial<LiquidateCompany> | undefined => {
            const companyId = state.companies.find(
                (company) =>
                    stationsOwed(state, company.id) > 0 &&
                    !isLiquidated(state.stockMarket, company.id)
            )?.id
            return companyId ? { companyId, reason: 'unpaid-stations' } : undefined
        }
    )
}

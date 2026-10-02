import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    assertExists,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext
} from '@tabletop/common'
import {
    CashPayment,
    finiteCashOwnedBy,
    type EighteenXXStateHandler,
    type HydratedEighteenXXState,
    type StationState,
    type StockState
} from '@tabletop/18xx'
import { StationPrice, buyOwedStations, stationsOwed } from './stockRules.js'
import { LiquidateCompany, isLiquidateCompany, isLiquidated } from './liquidation.js'

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

/** The first company that owes stations and can now pay for them. */
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
export class OwedStationsHandler implements EighteenXXStateHandler {
    constructor(private readonly handler: EighteenXXStateHandler) {}
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEighteenXXState>
    ): boolean {
        return isBuyOwedStations(action)
            ? companyAbleToBuyStations(context.gameState) === action.companyId
            : this.handler.isValidAction(action, context)
    }
    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEighteenXXState>
    ): string[] {
        return this.handler.validActionsForPlayer(playerId, context)
    }
    enter(context: MachineContext<HydratedEighteenXXState>): void {
        const companyId = companyAbleToBuyStations(context.gameState)
        if (companyId) context.addSystemAction(BuyOwedStations, { companyId })
        else this.handler.enter(context)
    }
    onAction(action: HydratedAction, context: MachineContext<HydratedEighteenXXState>): string {
        return isBuyOwedStations(action)
            ? context.gameState.machineState
            : this.handler.onAction(action, context)
    }
}

/** A company that still owes stations when the stock round ends is liquidated. */
export class UnpaidStationsHandler implements EighteenXXStateHandler {
    constructor(private readonly handler: EighteenXXStateHandler) {}
    private debtor(state: StockState & StationState): string | undefined {
        return state.companies.find(
            (company) =>
                stationsOwed(state, company.id) > 0 && !isLiquidated(state.stockMarket, company.id)
        )?.id
    }
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEighteenXXState>
    ): boolean {
        if (isLiquidateCompany(action))
            return (
                action.reason === 'unpaid-stations' &&
                action.companyId === this.debtor(context.gameState)
            )
        return this.handler.isValidAction(action, context)
    }
    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEighteenXXState>
    ): string[] {
        return this.handler.validActionsForPlayer(playerId, context)
    }
    enter(context: MachineContext<HydratedEighteenXXState>): void {
        const companyId = this.debtor(context.gameState)
        if (companyId)
            context.addSystemAction(LiquidateCompany, { companyId, reason: 'unpaid-stations' })
        else this.handler.enter(context)
    }
    onAction(action: HydratedAction, context: MachineContext<HydratedEighteenXXState>): string {
        return isLiquidateCompany(action)
            ? context.gameState.machineState
            : this.handler.onAction(action, context)
    }
}

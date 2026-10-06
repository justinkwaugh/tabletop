import type { EighteenSeventeenStateHandler } from './state.js'
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
    StockMarketMove,
    companyMarketSpace,
    getCompany,
    placeStockMarker,
    trainsOwnedBy,
    type OperatingState,
    type StockMarket,
    type StockState,
    type TrainState
} from '@tabletop/18xx'
import { isLiquidationSpace } from './stockMarket.js'
import { SystemActionFirstHandler } from './systemActionFirstHandler.js'

export function isLiquidated(market: StockMarket, companyId: string): boolean {
    return isLiquidationSpace(companyMarketSpace(market, companyId))
}

/** Moves a started company to the liquidation space, where it stops operating. */
export function liquidate(state: StockState, companyId: string): StockMarketMove {
    assert(getCompany(state, companyId).started, 'Only a started company is liquidated')
    const from = companyMarketSpace(state.stockMarket, companyId)
    const to = state.stockMarket.spaces.find(isLiquidationSpace)
    assertExists(to, 'The market has a liquidation space')
    placeStockMarker(state.stockMarket, companyId, to.id)
    return { companyId, fromMarketSpaceId: from.id, toMarketSpaceId: to.id }
}

export const LiquidationReason = Type.Union([
    Type.Literal('no-train'),
    Type.Literal('unpaid-stations')
])
export type LiquidationReason = Type.Static<typeof LiquidationReason>

const Fields = Type.Object({
    type: Type.Literal('LiquidateCompany'),
    companyId: Type.String(),
    reason: LiquidationReason,
    metadata: Type.Optional(
        Type.Object({ marketMove: StockMarketMove }, { additionalProperties: false })
    )
})
export const LiquidateCompany: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof Fields.properties
> = Type.Object({ ...GameAction.properties, ...Fields.properties }, { additionalProperties: false })
export type LiquidateCompany = Type.Static<typeof LiquidateCompany>
const Validator = Compile(LiquidateCompany)
export function isLiquidateCompany(action: GameAction): action is LiquidateCompany {
    return (
        action instanceof HydratedLiquidateCompany ||
        (action.type === 'LiquidateCompany' && Validator.Check(action))
    )
}

export class HydratedLiquidateCompany
    extends HydratableAction<typeof LiquidateCompany>
    implements LiquidateCompany
{
    declare type: 'LiquidateCompany'
    declare companyId: string
    declare reason: LiquidationReason
    declare metadata?: LiquidateCompany['metadata']
    constructor(data: LiquidateCompany) {
        super(data instanceof HydratedLiquidateCompany ? data.dehydrate() : data, Validator)
    }
    apply(state: HydratedGameState & StockState): void {
        assert(
            this.source === ActionSource.System && !isLiquidated(state.stockMarket, this.companyId),
            'The system liquidates a company once'
        )
        this.metadata = { marketMove: liquidate(state, this.companyId) }
    }
}

/** The company that has just finished its turn without a train, until it is liquidated. */
function trainlessCompany(state: OperatingState & TrainState): string | undefined {
    const set = state.operatingSet
    // The round's exports can rust the last company's trains after its turn has ended.
    if (!set || set.completed || set.exportedRound === set.roundNumber) return undefined
    const companyId = set.completedCompanyIds.at(-1)
    return companyId &&
        !isLiquidated(state.stockMarket, companyId) &&
        !trainsOwnedBy(state, { kind: 'company', companyId }).length
        ? companyId
        : undefined
}

/** Liquidates a company that ends its turn without a train before play moves on. */
export function liquidatesTrainlessCompanies(
    handler: EighteenSeventeenStateHandler
): EighteenSeventeenStateHandler {
    return new SystemActionFirstHandler(
        handler,
        LiquidateCompany,
        (state): Partial<LiquidateCompany> | undefined => {
            const companyId = trainlessCompany(state)
            return companyId ? { companyId, reason: 'no-train' } : undefined
        }
    )
}

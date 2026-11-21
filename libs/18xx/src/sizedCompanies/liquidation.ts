import { ActionSource, assert, type HydratedGameState } from '@tabletop/common'
import * as Type from 'typebox'
import type { ActionDefinition } from '../actions/actionDefinition.js'
import { systemEvent, type SystemEventSchema } from '../actions/titleAction.js'
import type { HydratedEighteenXXState } from '../game/eighteenXXState.js'
import type { EighteenXXStateHandler } from '../game/eighteenXXTitleRules.js'
import { SystemActionFirstHandler } from '../game/systemActionFirstHandler.js'
import type { OperatingState } from '../operating/operatingSet.js'
import { StockMarketMove } from '../stock/stockMarket.js'
import type { StockState } from '../stock/stockState.js'
import { trainsOwnedBy, type TrainState } from '../trains/train.js'
import type { TrainDepot } from '../trains/trainDepot.js'
import type { SizedCompanyMarket } from './sizedCompanyMarket.js'

export const LiquidationReason = Type.Union([
    Type.Literal('no-train'),
    Type.Literal('unpaid-stations'),
    /** Too few of a new company's shares in players' hands as its stock round ends (18USA §17). */
    Type.Literal('unsold-shares')
])
export type LiquidationReason = Type.Static<typeof LiquidationReason>

const LiquidateCompanyFields = {
    companyId: Type.String(),
    reason: LiquidationReason,
    metadata: Type.Optional(
        Type.Object({ marketMove: StockMarketMove }, { additionalProperties: false })
    )
}
const LiquidateCompanyAction = systemEvent('LiquidateCompany', LiquidateCompanyFields)
export const LiquidateCompany: SystemEventSchema<
    'LiquidateCompany',
    typeof LiquidateCompanyFields
> = LiquidateCompanyAction.schema
export type LiquidateCompany = Type.Static<typeof LiquidateCompany>
export const isLiquidateCompany = LiquidateCompanyAction.is

/** The system's liquidation of a company, which moves it to the liquidation space. */
export class Liquidations {
    /** ``depot`` names rolling stock that never runs alone, which is no train (18USA §12.7). */
    constructor(
        readonly market: SizedCompanyMarket,
        readonly depot?: TrainDepot
    ) {}

    actions(): ActionDefinition[] {
        const market = this.market
        class HydratedLiquidateCompany
            extends LiquidateCompanyAction.Base
            implements LiquidateCompany
        {
            declare type: 'LiquidateCompany'
            declare companyId: string
            declare reason: LiquidationReason
            declare metadata?: LiquidateCompany['metadata']
            apply(state: HydratedGameState & StockState): void {
                assert(
                    this.source === ActionSource.System &&
                        !market.isLiquidated(state.stockMarket, this.companyId),
                    'The system liquidates a company once'
                )
                this.metadata = { marketMove: market.liquidate(state, this.companyId) }
            }
        }
        return [LiquidateCompanyAction.define((action) => new HydratedLiquidateCompany(action))]
    }

    /** The company that has just finished its turn without a train, until it is liquidated. */
    trainlessCompany(state: OperatingState & TrainState): string | undefined {
        const set = state.operatingSet
        // The round's exports can rust the last company's trains after its turn has ended.
        if (!set || set.completed || set.exportedRound === set.roundNumber) return undefined
        const companyId = set.completedCompanyIds.at(-1)
        return companyId &&
            !this.market.isLiquidated(state.stockMarket, companyId) &&
            !trainsOwnedBy(state, { kind: 'company', companyId }).some(
                (train) => !this.depot?.trainDefinition(train.definitionId).attachment
            )
            ? companyId
            : undefined
    }

    /** Liquidates a company that ends its turn without a train before play moves on. */
    liquidatesTrainlessCompanies<S extends HydratedEighteenXXState>(
        handler: EighteenXXStateHandler<S>
    ): EighteenXXStateHandler<S> {
        return new SystemActionFirstHandler(
            handler,
            LiquidateCompany,
            (state): Partial<LiquidateCompany> | undefined => {
                const companyId = this.trainlessCompany(state)
                return companyId ? { companyId, reason: 'no-train' } : undefined
            }
        )
    }
}

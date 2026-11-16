import { AuctionAwardDetails, AuctionAwardRecorder } from './auctionAwardDetails.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    type HydratedGameState
} from '@tabletop/common'
import {
    activeAuction,
    type OpeningAuctionState,
    type OpeningAuctionRules
} from './auctionProcedure.js'
import { CashPayment } from '../finance/cashPayments.js'
import { OfferAuction } from './offerPileAuction.js'
import { ReserveBidAuction } from './waterfallAuction.js'
import { TrainExport, exportDepotTrains } from '../operating/exportTrains.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import type { PhaseState } from '../phases/phaseChange.js'
import type { TrainState } from '../trains/train.js'
import { startFirstStockRound } from './startFirstStockRound.js'
import type { ValuationRules } from '../ending/finalWealth.js'
import { RoundEnd, roundEnd } from '../ending/roundEnd.js'

const Resolution = Type.Union([
    Type.Object(
        { kind: Type.Literal('award'), award: AuctionAwardDetails },
        { additionalProperties: false }
    ),
    Type.Object(
        { kind: Type.Literal('open-bidding'), lotId: Type.String() },
        { additionalProperties: false }
    ),
    Type.Object(
        { kind: Type.Literal('discount'), payments: Type.Optional(Type.Array(CashPayment)) },
        { additionalProperties: false }
    ),
    Type.Object(
        {
            kind: Type.Literal('income'),
            payments: Type.Optional(Type.Array(CashPayment)),
            exports: Type.Optional(TrainExport)
        },
        { additionalProperties: false }
    ),
    Type.Object(
        { kind: Type.Literal('complete'), roundEnd: Type.Optional(RoundEnd) },
        { additionalProperties: false }
    )
])
const ResolveFields = Type.Object({
    type: Type.Literal('ResolveAuction'),
    metadata: Type.Optional(Resolution)
})
export const ResolveAuction: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof ResolveFields.properties
> = Type.Object(
    { ...GameAction.properties, ...ResolveFields.properties },
    { additionalProperties: false }
)
export type ResolveAuction = Type.Static<typeof ResolveAuction>
const ResolveAuctionValidator = Compile(ResolveAuction)
export function isResolveAuction(action: GameAction): action is ResolveAuction {
    return (
        action instanceof HydratedResolveAuction ||
        (action.type === 'ResolveAuction' && ResolveAuctionValidator.Check(action))
    )
}
export class HydratedResolveAuction
    extends HydratableAction<typeof ResolveAuction>
    implements ResolveAuction
{
    declare type: 'ResolveAuction'
    declare metadata?: ResolveAuction['metadata']

    readonly #rules: OpeningAuctionRules
    readonly #valuationRules: ValuationRules
    readonly #trainRules: TrainRules
    constructor(
        data: ResolveAuction,
        rules: OpeningAuctionRules,
        valuationRules: ValuationRules,
        trainRules: TrainRules
    ) {
        super(
            data instanceof HydratedResolveAuction ? data.dehydrate() : data,
            ResolveAuctionValidator
        )
        this.#rules = rules
        this.#valuationRules = valuationRules
        this.#trainRules = trainRules
    }
    isValid(state: OpeningAuctionState): boolean {
        const model = activeAuction(state, this.#rules)
        return !!model && this.source === ActionSource.System && !!model.resolution()
    }
    apply(state: HydratedGameState & OpeningAuctionState & TrainState & PhaseState): void {
        assert(this.isValid(state), 'Invalid ResolveAuction action')
        const model = activeAuction(state, this.#rules)
        assert(model, 'Auction is not active')
        const recorder = new AuctionAwardRecorder(state)
        const resolution = model instanceof OfferAuction ? model.resolve() : model.resolve(this.id)
        this.metadata =
            resolution.kind === 'award'
                ? { kind: 'award', award: recorder.award(state, resolution.award) }
                : resolution.kind === 'income' && model instanceof ReserveBidAuction
                  ? { ...resolution, ...this.incomeExports(state, model) }
                  : resolution
        if (resolution.kind === 'complete') {
            if (model instanceof OfferAuction)
                startFirstStockRound(state, model.rules.firstStockOrder(state))
            else {
                state.turnManager.newFirstPlayer(model.firstStockPlayerId())
                startFirstStockRound(state, state.turnManager.turnOrder)
            }
            this.metadata = {
                kind: 'complete',
                roundEnd: roundEnd(state, this.#valuationRules, 'opening')
            }
        }
    }
    /** The trains an all-pass income round exports, where the title counts it as a set. */
    private incomeExports(
        state: HydratedGameState & OpeningAuctionState & TrainState & PhaseState,
        model: ReserveBidAuction
    ): { exports?: TrainExport } {
        const definitionIds = model.rules.incomeExports?.(state) ?? []
        if (!definitionIds.length) return {}
        return {
            exports: exportDepotTrains(state, this.#trainRules, definitionIds, {
                machineState: state.machineState
            })
        }
    }
}

import type { StockState } from '../stock/stockState.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    PlayerAction,
    HydratableAction,
    assert,
    type HydratedGameState,
    type HydratedAction,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import {
    ReserveBidAuction,
    AuctionAward,
    type AuctionState,
    type WaterfallAuctionRules
} from './waterfallAuction.js'
import { createStockRound } from '../stock/stockRound.js'
const BidFields = { lotId: Type.String(), amount: Type.Integer({ minimum: 1 }) }
export const ReserveBid = Type.Object(
    { ...PlayerAction.properties, ...BidFields, type: Type.Literal('ReserveBid') },
    { additionalProperties: false }
)
export const RaiseAuctionBid = Type.Object(
    { ...PlayerAction.properties, ...BidFields, type: Type.Literal('RaiseAuctionBid') },
    { additionalProperties: false }
)
export const BuyAuctionLot = Type.Object(
    {
        ...PlayerAction.properties,
        lotId: Type.String(),
        expectedPrice: Type.Integer({ minimum: 0 }),
        type: Type.Literal('BuyAuctionLot'),
        metadata: Type.Optional(AuctionAward)
    },
    { additionalProperties: false }
)
export const PassAuction = Type.Object(
    { ...PlayerAction.properties, type: Type.Literal('PassAuction') },
    { additionalProperties: false }
)
const ResolveFields = Type.Object({ type: Type.Literal('ResolveAuction') })
export const ResolveAuction: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof ResolveFields.properties
> = Type.Object(
    { ...GameAction.properties, ...ResolveFields.properties },
    { additionalProperties: false }
)
export const WaterfallAction: Type.TUnion<
    [
        typeof ReserveBid,
        typeof RaiseAuctionBid,
        typeof BuyAuctionLot,
        typeof PassAuction,
        typeof ResolveAuction
    ]
> = Type.Union([ReserveBid, RaiseAuctionBid, BuyAuctionLot, PassAuction, ResolveAuction])
export type WaterfallAction = Type.Static<typeof WaterfallAction>
const Validator = Compile(WaterfallAction)
export function isWaterfallAction(action: GameAction): action is WaterfallAction {
    return action instanceof HydratedWaterfallAction || Validator.Check(action)
}
export class HydratedWaterfallAction extends HydratableAction<typeof WaterfallAction> {
    declare metadata?: AuctionAward
    readonly #rules: WaterfallAuctionRules
    constructor(data: WaterfallAction, rules: WaterfallAuctionRules) {
        super(data instanceof HydratedWaterfallAction ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    isValid(state: AuctionState & { machineState: string }): boolean {
        if (
            !state.openingAuction ||
            !['WaterfallAuction', 'AuctionBidding'].includes(state.machineState) ||
            state.openingAuction.completed
        )
            return false
        const model = new ReserveBidAuction(state, this.#rules)
        const action = this.dehydrate()
        if (action.type === 'ResolveAuction')
            return action.source === ActionSource.System && !!model.resolution()
        if (
            action.source !== ActionSource.User ||
            action.playerId !== model.playerId ||
            !state.activePlayerIds.includes(action.playerId) ||
            model.resolution()
        )
            return false
        if (action.type === 'PassAuction') return true
        if (action.type === 'BuyAuctionLot')
            return (
                model.canPurchase(action.playerId, action.lotId) &&
                action.expectedPrice === model.price(action.lotId)
            )
        return (
            (action.type === 'RaiseAuctionBid') === Boolean(model.auction.bidding) &&
            model.canBid(action.playerId, action.lotId, action.amount)
        )
    }
    apply(state: HydratedGameState & AuctionState & StockState): void {
        assert(this.isValid(state), 'Invalid waterfall auction action')
        const model = new ReserveBidAuction(state, this.#rules)
        const action = this.dehydrate()
        switch (action.type) {
            case 'ReserveBid':
            case 'RaiseAuctionBid':
                model.bid(action.playerId, action.lotId, action.amount)
                break
            case 'BuyAuctionLot':
                this.metadata = model.purchase(action.playerId, action.lotId)
                break
            case 'PassAuction':
                model.pass()
                break
            case 'ResolveAuction':
                if (model.resolve(this.id).kind === 'complete') {
                    state.stockRound = createStockRound(1)
                    state.turnManager.newFirstPlayer(model.auction.nextPlayerId)
                    state.turnManager.endTurn(state.actionCount)
                    state.turnManager.startTurn(model.auction.nextPlayerId, state.actionCount + 1)
                }
                break
        }
    }
}
export class WaterfallAuctionHandler<
    State extends HydratedGameState & AuctionState & StockState
> implements MachineStateHandler<HydratedAction, State> {
    constructor(private readonly rules: WaterfallAuctionRules) {}
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        return action instanceof HydratedWaterfallAction && action.isValid(context.gameState)
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const state = context.gameState
        const model = new ReserveBidAuction(state, this.rules)
        if (
            model.auction.completed ||
            !state.activePlayerIds.includes(playerId) ||
            model.playerId !== playerId ||
            model.resolution()
        )
            return []
        const ids = model.auction.bidding
            ? [model.auction.bidding.lotId]
            : model.auction.remainingLotIds.slice(1)
        return [
            'PassAuction',
            ...(model.canPurchase(playerId, model.auction.remainingLotIds[0])
                ? ['BuyAuctionLot']
                : []),
            ...(ids.some((id) => model.canBid(playerId, id, model.minimumBid(id)))
                ? [model.auction.bidding ? 'RaiseAuctionBid' : 'ReserveBid']
                : [])
        ]
    }
    enter(context: MachineContext<State>): void {
        const state = context.gameState
        const model = new ReserveBidAuction(state, this.rules)
        if (model.resolution()) {
            context.addSystemAction(ResolveAuction, {})
            return
        }
        state.activePlayerIds = [model.playerId]
        if (state.turnManager.currentTurn()?.playerId !== model.playerId) {
            state.turnManager.endTurn(state.actionCount)
            state.turnManager.startTurn(model.playerId, state.actionCount + 1)
        }
    }
    onAction(_action: HydratedAction, context: MachineContext<State>): string {
        return context.gameState.openingAuction?.completed
            ? 'StockRound'
            : context.gameState.openingAuction?.bidding
              ? 'AuctionBidding'
              : 'WaterfallAuction'
    }
}

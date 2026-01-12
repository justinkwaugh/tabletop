import { GameAction, HydratableAction, assert } from '@tabletop/common'
import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { HydratedContainerGameState } from '../model/gameState.js'

export type CallBroker = Static<typeof CallBroker>
export const CallBroker = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.CallBroker),
            playerId: Type.String(),
            brokerIndex: Type.Optional(Type.Number()),
            offerType: Type.Optional(Type.Union([Type.Literal('money'), Type.Literal('containers')])),
            bidAmount: Type.Optional(Type.Number()),
            factoryIndices: Type.Optional(Type.Array(Type.Number())),
            harborIndices: Type.Optional(Type.Array(Type.Number()))
        })
    ])
)

export const CallBrokerValidator = Compile(CallBroker)

export function isCallBroker(action: GameAction): action is CallBroker {
    return action.type === ActionType.CallBroker
}

export class HydratedCallBroker extends HydratableAction<typeof CallBroker> implements CallBroker {
    declare type: ActionType.CallBroker
    declare playerId: string
    declare brokerIndex?: number
    declare offerType?: 'money' | 'containers'
    declare bidAmount?: number
    declare factoryIndices?: number[]
    declare harborIndices?: number[]

    constructor(data: CallBroker) {
        super(data, CallBrokerValidator)
    }

    apply(state: HydratedContainerGameState): void {
        const bank = state.investmentBank
        assert(bank, 'Investment Bank not enabled')
        assert(!state.calledBrokerThisTurn, 'Broker already called this turn')
        assert(!state.endTriggered, 'Cannot call broker when ending the game')
        assert(!state.brokerAuctionWonThisTurn, 'Cannot call broker after winning broker auction')

        const player = state.getPlayerState(this.playerId)
        const existingPayment = bank.paymentCard
        const offerType = existingPayment?.offerType ?? this.offerType
        const brokerIndex = existingPayment?.brokerIndex ?? this.brokerIndex

        assert(offerType !== undefined, 'offerType is required when starting a broker auction')
        assert(brokerIndex !== undefined, 'brokerIndex is required when starting a broker auction')
        assert(brokerIndex >= 0 && brokerIndex < bank.brokers.length, 'Invalid broker index')

        const broker = bank.brokers[brokerIndex]
        if (!existingPayment) {
            if (offerType === 'money') {
                assert(broker.money > 0, 'Broker has no money to auction')
            } else {
                assert(broker.containers.length > 0, 'Broker has no containers to auction')
            }
        } else {
            assert(
                brokerIndex === existingPayment.brokerIndex && offerType === existingPayment.offerType,
                'Cannot change broker offer when outbidding'
            )
        }

        const bidType = offerType === 'money' ? 'containers' : 'money'

        if (existingPayment) {
            state.refundBrokerBid(existingPayment)
        }

        if (bidType === 'money') {
            const bidAmount = this.bidAmount ?? 0
            assert(bidAmount > 0, 'Bid amount must be positive')
            if (existingPayment) {
                assert(bidAmount >= existingPayment.bidAmount + 1, 'Bid must be higher')
            }
            assert(player.money >= bidAmount, 'Not enough money to bid')

            player.money -= bidAmount
            bank.paymentCard = {
                bidderId: this.playerId,
                brokerIndex,
                offerType,
                bidType,
                bidAmount
            }
            state.calledBrokerThisTurn = true
            return
        }

        const factoryIndices = this.factoryIndices ?? []
        const harborIndices = this.harborIndices ?? []
        const totalCount = factoryIndices.length + harborIndices.length
        assert(totalCount > 0, 'Must bid at least one container')
        if (existingPayment) {
            assert(totalCount >= existingPayment.bidAmount + 1, 'Bid must be higher')
        }

        const bidContainers = state.extractBidContainers(
            this.playerId,
            factoryIndices,
            harborIndices
        )
        bank.paymentCard = {
            bidderId: this.playerId,
            brokerIndex,
            offerType,
            bidType,
            bidAmount: bidContainers.length,
            bidContainers
        }
        state.calledBrokerThisTurn = true
    }

    static canCall(state: HydratedContainerGameState, playerId: string): boolean {
        const bank = state.investmentBank
        if (!bank) {
            return false
        }
        if (state.getActivePlayerId() !== playerId) {
            return false
        }
        if (state.calledBrokerThisTurn || state.brokerAuctionWonThisTurn) {
            return false
        }
        if (state.endTriggered) {
            return false
        }

        const payment = bank.paymentCard
        if (!payment) {
            return bank.brokers.some(
                (broker) => broker.money > 0 || broker.containers.length > 0
            )
        }

        const player = state.getPlayerState(playerId)
        if (payment.bidType === 'money') {
            return player.money >= payment.bidAmount + 1
        }
        const containerCount = player.factoryStore.length + player.harborStore.length
        return containerCount >= payment.bidAmount + 1
    }
}

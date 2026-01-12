import { Type, type Static } from 'typebox'
import { ContainerColor } from './container.js'

export type Broker = Static<typeof Broker>
export const Broker = Type.Object({
    containers: Type.Array(Type.Enum(ContainerColor)),
    money: Type.Number()
})

export type BrokerBidContainer = Static<typeof BrokerBidContainer>
export const BrokerBidContainer = Type.Object({
    color: Type.Enum(ContainerColor),
    price: Type.Number(),
    source: Type.Union([Type.Literal('factory'), Type.Literal('harbor')])
})

export type PaymentCard = Static<typeof PaymentCard>
export const PaymentCard = Type.Object({
    bidderId: Type.String(),
    brokerIndex: Type.Number(),
    offerType: Type.Union([Type.Literal('money'), Type.Literal('containers')]),
    bidType: Type.Union([Type.Literal('money'), Type.Literal('containers')]),
    bidAmount: Type.Number(),
    bidContainers: Type.Optional(Type.Array(BrokerBidContainer))
})

export type InvestmentBank = Static<typeof InvestmentBank>
export const InvestmentBank = Type.Object({
    brokers: Type.Array(Broker),
    paymentCard: Type.Optional(PaymentCard),
    personalHarbors: Type.Record(Type.String(), Type.Array(Type.Enum(ContainerColor)))
})

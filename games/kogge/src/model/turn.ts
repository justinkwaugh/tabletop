import * as Type from 'typebox'
import { Visibility } from '@tabletop/common'
import { GoodCounts } from '../components/goods.js'

export enum TurnAction {
    BuildOffice = 'BuildOffice',
    GuildMasterTrade = 'GuildMasterTrade',
    BuyRouteMarkers = 'BuyRouteMarkers',
    TradeGoods = 'TradeGoods',
    ChangeRoute = 'ChangeRoute'
}

export type TurnProgress = Type.Static<typeof TurnProgress>
export const TurnProgress = Type.Object({
    playerId: Type.String(),
    startCity: Type.Integer({ minimum: 0 }),
    moves: Type.Integer({ minimum: 0 }),
    movementDone: Type.Boolean(),
    actionsTaken: Type.Array(Type.Enum(TurnAction))
})

export function newTurn(playerId: string, startCity: number): TurnProgress {
    return { playerId, startCity, moves: 0, movementDone: false, actionsTaken: [] }
}

export type RaidProgress = Type.Static<typeof RaidProgress>
export const RaidProgress = Type.Object({
    raiderId: Type.String(),
    city: Type.Integer({ minimum: 0 }),
    victimId: Type.Optional(Type.String()),
    spoils: Type.Optional(Type.Array(GoodCounts)),
    expellerId: Type.String()
})

export type StartChoice = Type.Static<typeof StartChoice>
export const StartChoice = Type.Object({
    playerId: Type.String(),
    city: Visibility.protect(Type.Optional(Type.Integer({ minimum: 0 })), {
        policy: Visibility.Policy.Owner
    }),
    submitted: Type.Boolean(),
    excluded: Type.Array(Type.Integer({ minimum: 0 }))
})

export type Bid = Type.Static<typeof Bid>
export const Bid = Type.Object({
    playerId: Type.String(),
    markers: Type.Array(Type.Integer({ minimum: 0 }))
})

export type OfferGroup = Type.Static<typeof OfferGroup>
export const OfferGroup = Type.Object({
    markers: Type.Array(Type.Integer({ minimum: 0 })),
    boughtBy: Type.Optional(Type.String())
})

export type GuildMaster = Type.Static<typeof GuildMaster>
export const GuildMaster = Type.Object({
    city: Type.Integer({ minimum: 0 }),
    startCity: Type.Integer({ minimum: 0 }),
    distance: Type.Integer({ minimum: 0 })
})

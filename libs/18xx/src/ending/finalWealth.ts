import * as Type from 'typebox'
import { assert } from '@tabletop/common'
import {
    cashOwnedBy,
    certificatesOwnedBy,
    getCompany,
    type Owner,
    type Portfolio
} from '../finance/finance.js'
import { companyMarketSpace } from '../stock/stockMarket.js'
import type { StockState } from '../stock/stockState.js'

export const WealthItem = Type.Object(
    {
        assetId: Type.String(),
        label: Type.String(),
        value: Type.Integer()
    },
    { additionalProperties: false }
)
export type WealthItem = Type.Static<typeof WealthItem>
export const PlayerWealth = Type.Object(
    {
        playerId: Type.String(),
        items: Type.Array(WealthItem),
        total: Type.Integer()
    },
    { additionalProperties: false }
)
export type PlayerWealth = Type.Static<typeof PlayerWealth>
export const EndingFields = {
    finalWealth: Type.Optional(Type.Array(PlayerWealth))
}
export interface ValuationRules {
    certificateItems(state: StockState, certificate: Portfolio[number]): WealthItem[]
}
export function marketShareValue(state: StockState, certificate: Portfolio[number]): number {
    const company = getCompany(state, certificate.companyId)
    return certificate.kind === 'share' && company.started && !company.closed
        ? certificate.shares * companyMarketSpace(state.stockMarket, company.id).price
        : 0
}
export function portfolioWealth(
    state: StockState,
    owner: Owner,
    rules: ValuationRules
): WealthItem[] {
    const cash = cashOwnedBy(state, owner)
    assert(typeof cash === 'number', 'Final wealth requires finite owner cash')
    const ownerId =
        owner.kind === 'player'
            ? owner.playerId
            : owner.kind === 'company'
              ? owner.companyId
              : 'bank'
    return [
        { assetId: `cash:${owner.kind}:${ownerId}`, label: 'Cash', value: cash },
        ...certificatesOwnedBy(state, owner).flatMap((certificate) =>
            rules.certificateItems(state, certificate)
        )
    ]
}
export function finalWealth(state: StockState, rules: ValuationRules): PlayerWealth[] {
    return state.players.map((player) => {
        const items = portfolioWealth(state, { kind: 'player', playerId: player.playerId }, rules)
        assert(
            new Set(items.map((item) => item.assetId)).size === items.length,
            'An asset can only enter a player’s wealth once'
        )
        return {
            playerId: player.playerId,
            items,
            total: items.reduce((total, item) => total + item.value, 0)
        }
    })
}

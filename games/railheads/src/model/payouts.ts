import * as Type from 'typebox'
import { CompanyId, Industry } from '../editions/types.js'
import type { HydratedRailheadsGameState } from './gameState.js'

export type PayoutRates = Type.Static<typeof PayoutRates>
export const PayoutRates = Type.Object({
    companies: Type.Array(
        Type.Object({ companyId: Type.Enum(CompanyId), perShare: Type.Number() })
    ),
    industries: Type.Array(Type.Object({ industry: Type.Enum(Industry), perToken: Type.Number() }))
})

export type PlayerIncome = Type.Static<typeof PlayerIncome>
export const PlayerIncome = Type.Object({
    playerId: Type.String(),
    amount: Type.Number()
})

export type CompanyRevenueChange = Type.Static<typeof CompanyRevenueChange>
export const CompanyRevenueChange = Type.Object({
    companyId: Type.Enum(CompanyId),
    from: Type.Number(),
    to: Type.Number()
})

// Pays every player from the bank for each share and industry token they hold.
export function payPlayers(state: HydratedRailheadsGameState, rates: PayoutRates): PlayerIncome[] {
    return state.players.map((player) => {
        const amount = state.playerIncome(player.playerId, rates)
        player.cash += amount
        return { playerId: player.playerId, amount }
    })
}

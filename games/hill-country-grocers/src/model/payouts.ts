import * as Type from 'typebox'
import { CompanyId } from '../components/companies.js'
import type { HydratedHcgGameState } from './gameState.js'

export type Payout = Type.Static<typeof Payout>
export const Payout = Type.Object({
    playerId: Type.String(),
    amount: Type.Number()
})

export type CompanyDividend = Type.Static<typeof CompanyDividend>
export const CompanyDividend = Type.Object({
    companyId: Type.Enum(CompanyId),
    value: Type.Number(),
    perShare: Type.Number()
})

export function companyDividends(state: HydratedHcgGameState): CompanyDividend[] {
    return state.companies.map((company) => ({
        companyId: company.id,
        value: state.value(company.id),
        perShare: state.perShare(company.id)
    }))
}

export function payShareholders(
    state: HydratedHcgGameState,
    dividends: readonly CompanyDividend[]
): Payout[] {
    return state.players.map((player) => {
        const amount = dividends.reduce(
            (sum, dividend) =>
                sum + dividend.perShare * state.sharesHeld(dividend.companyId, player.playerId),
            0
        )
        player.cash += amount
        return { playerId: player.playerId, amount }
    })
}

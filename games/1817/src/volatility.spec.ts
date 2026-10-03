import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { privateOwner, type EighteenXXState } from '@tabletop/18xx'
import { playExample } from '@tabletop/18xx/scenarios'
import { CityTilePrivates, pyramidOf } from './index.js'
import { EighteenSeventeenScenarios } from './scenarios/index.js'

const volatilityGame = () => playExample(EighteenSeventeenScenarios, 'optional-opening', 4)

function pyramid(state: EighteenXXState) {
    const tiers = pyramidOf(state)
    assertExists(tiers, 'A Volatility game has its pyramid')
    return tiers
}

describe('the Volatility opening', () => {
    it('keeps one city-tile private and deals 21 privates into tiers of one to six', () => {
        const { state } = volatilityGame()
        const tiers = pyramid(state)
        expect(tiers.map((tier) => tier.length)).toEqual([1, 2, 3, 4, 5, 6])
        const [keptId] = tiers[0]
        const cityTileIds = Object.keys(CityTilePrivates)
        expect(cityTileIds).toContain(keptId)
        const privateIds = state.companies
            .filter((company) => company.kind === 'private')
            .map((company) => company.id)
        expect(privateIds).toHaveLength(21)
        expect(privateIds.filter((id) => cityTileIds.includes(id))).toEqual([keptId])
        expect(new Set(tiers.flat())).toEqual(new Set(privateIds))
        expect(state).not.toHaveProperty('seedMoney')
    })

    it('opens only the bottom tier, from $0, without passing', () => {
        const play = volatilityGame()
        const nominator = play.state.activePlayerIds[0]
        expect(play.valid(nominator)).toEqual(['NominateLot'])
        const [bottom] = pyramid(play.state).slice(-1)
        const [above] = pyramid(play.state).slice(-2)
        expect(() => play.act('NominateLot', { lotId: above[0], amount: 0 })).toThrow()
        play.act('NominateLot', { lotId: bottom[0], amount: 0 })
        expect(play.valid(play.state.activePlayerIds[0])).toEqual([
            'PassSelectionAuction',
            'BidForLot'
        ])
    })

    it('removes a neighbour a sale leaves isolated, and lets the next player after the winner nominate', () => {
        const play = volatilityGame()
        const order = play.state.turnManager.turnOrder
        const [bottom] = pyramid(play.state).slice(-1)
        const [first, second, third] = bottom
        const nominator = play.state.activePlayerIds[0]
        play.act('NominateLot', { lotId: second, amount: 0 })
        const winner = play.state.activePlayerIds[0]
        play.act('BidForLot', { lotId: second, amount: 5 })
        for (let pass = 0; pass < 3; pass++) play.act('PassSelectionAuction')
        expect(privateOwner(play.state, second)).toEqual({ kind: 'player', playerId: winner })
        expect(play.state.companies.find((company) => company.id === first)?.closed).toBe(true)
        expect(play.state.companies.find((company) => company.id === third)?.closed).toBeFalsy()
        expect(pyramid(play.state).at(-1)?.slice(0, 3)).toEqual([null, null, third])
        expect(winner).not.toBe(nominator)
        expect(play.state.activePlayerIds).toEqual([
            order[(order.indexOf(winner) + 1) % order.length]
        ])
    })
})

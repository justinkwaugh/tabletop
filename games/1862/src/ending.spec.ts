import { finalWealth } from '@tabletop/18xx'
import { describe, expect, it } from 'vitest'
import { hold, operatingTurn, player, twoCompanies } from '../test/positions.js'
import { MarketTop } from './lner.js'
import { EndingRules1862 } from './operating.js'
import { StartingCash1862 } from './opening.js'
import { GameEndPrice } from './stockMarket.js'

describe('1862 final wealth (§10.4)', () => {
    function twoHoldings(operatingPrice: number) {
        const { game, state, a, b } = twoCompanies(
            { price: operatingPrice, train: true },
            { price: 90, train: false },
            'BuyingTrains'
        )
        hold(state, a, [
            { owner: player('p1'), shares: 4 },
            { owner: player('p2'), shares: 2 }
        ])
        hold(state, b, [
            { owner: player('p2'), shares: 3 },
            { owner: player('p1'), shares: 1 }
        ])
        operatingTurn(state, [b, a], a, 'BuyingTrains')
        game.state = state
        return { game, a, b }
    }

    const shareValues = (game: ReturnType<typeof twoHoldings>['game'], playerId: string) =>
        finalWealth(game.state, EndingRules1862)
            .find((wealth) => wealth.playerId === playerId)
            ?.items.filter((item) => item.assetId !== `cash:player:${playerId}`)
            .map((item) => item.value)

    it('values shares at what they would sell for, half price for a train-less company', () => {
        const { game } = twoHoldings(100)
        // The director's certificate is three shares; the train-less company's £90 sells for £45.
        expect(shareValues(game, 'p1')).toEqual([300, 100, 45])
        expect(shareValues(game, 'p2')).toEqual([100, 100, 135])
    })

    it('records each player’s cash and shares so valued as the game ends', () => {
        const { game, a } = twoHoldings(GameEndPrice)
        game.state.gameEnding = { reason: MarketTop, finalOperatingSet: 1, finalOperatingRound: 1 }
        const cash = StartingCash1862[4]
        game.act('FinishOperatingTurn', { companyId: a }, 'p1')
        expect(game.state.machineState).toBe('GameOver')
        expect(game.state.gameEnding?.reason).toBe(MarketTop)
        expect(
            Object.fromEntries(
                (game.state.finalWealth ?? []).map((wealth) => [wealth.playerId, wealth.total])
            )
        ).toEqual({
            p1: cash + 4 * GameEndPrice + 45,
            p2: cash + 2 * GameEndPrice + 3 * 45,
            p3: cash,
            p4: cash
        })
        expect(game.state.winningPlayerIds).toEqual(['p1'])
    })
})

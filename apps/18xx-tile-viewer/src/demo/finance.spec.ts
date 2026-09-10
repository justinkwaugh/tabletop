import { getCompany, cashOwnedBy } from '@tabletop/18xx'
import { expect, it } from 'vitest'
import { Color, GameEngine, GameStorage, PlayerStatus } from '@tabletop/common'
import { Definition as Top } from '@tabletop/the-old-prince'
import { Definition as Shikoku } from '@tabletop/shikoku-1889'
import { FinanceExampleValidator } from '@tabletop/18xx'

it.each([Top, Shikoku])(
    'round-trips the $info.id finance example through its runtime',
    (definition) => {
        const game = definition.runtime.initializer.initializeGame(
            {
                id: 'example',
                typeId: definition.info.id,
                name: 'Example',
                ownerId: 'user',
                storage: GameStorage.Local,
                hotseat: true,
                seed: 5,
                players: ['alex', 'blair', 'casey'].map((id) => ({
                    id,
                    name: id,
                    isHuman: true,
                    status: PlayerStatus.Joined
                }))
            },
            definition
        )
        const { initialState } = new GameEngine(definition.runtime).startGame(game)
        expect(FinanceExampleValidator.Check(initialState)).toBe(true)
        const state = definition.runtime.hydrator.hydrateState(
            JSON.parse(JSON.stringify(initialState))
        )
        const before = state.dehydrate()
        expect(definition.runtime.hydrator.hydrateState(state).dehydrate()).toEqual(before)
        expect(
            new GameEngine(definition.runtime).getValidActionTypesForPlayer(game, state, 'alex')
        ).toEqual(['BuyShares', 'SellShares', 'FinishStockTurn'])
        state.players.reverse()
        state.players.forEach((player) => (player.color = Color.Purple))
        const restored = definition.runtime.hydrator.hydrateState(
            JSON.parse(JSON.stringify(state.dehydrate()))
        )
        expect(restored.companies).toEqual(before.companies)
        expect(restored.bank).toEqual(before.bank)
        expect(restored.cash).toEqual(before.cash)
        expect(restored.certificates).toEqual(before.certificates)
        expect(restored.certificatePools).toEqual(before.certificatePools)
        expect(initialState).not.toHaveProperty('holdings')
        expect(initialState).not.toHaveProperty('finances')
        expect(restored.players).toEqual(state.players)
        restored.cash[0].amount = 0
        expect(before.cash[0].amount).toBe(240)
        restored.cash[0].amount = 240
        expect(cashOwnedBy(restored, { kind: 'player', playerId: 'alex' })).toBe(240)
        const president = restored.certificates.find(
            (certificate) => certificate.kind === 'share' && certificate.president
        )
        if (president?.kind !== 'share') throw new Error('Missing president certificate')
        expect(president.shares).toBe(2)
        expect(president.certificateLimitCount).toBe(1)
        expect(getCompany(restored, president.companyId).shareCount).toBe(10)
        expect(restored.activePlayerIds).toEqual(['alex'])
        expect(Object.keys(definition.runtime.apiActions)).toEqual([
            'BuyShares',
            'SellShares',
            'FinishStockTurn',
            'StartCompany',
            'FloatCompany',
            'CompleteStockRound',
            'StartOperatingSet',
            'LayTile',
            'FinishTrack',
            'StartOperatingTurn',
            'PlaceStation',
            'FinishStations',
            'PlaceHomeStations'
        ])
        expect(() =>
            definition.runtime.hydrator.hydrateState({
                ...initialState,
                cash: [...initialState.cash, initialState.cash[0]]
            })
        ).toThrow('Duplicate')
        expect(FinanceExampleValidator.Check({ ...initialState, unexpected: true })).toBe(false)
    }
)

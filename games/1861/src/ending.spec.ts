import { describe, expect, it } from 'vitest'
import { playOut } from '../test/bot.js'
import { edit, opened } from '../test/kit.js'

describe('1861 game end', () => {
    it('ends after the round in which the bank breaks (§13)', () => {
        const game = opened(3, 3)
        edit(game, (state) => {
            const bank = state.cash.find((entry) => entry.owner.kind === 'bank')
            if (!bank || bank.amount === 'unlimited') throw new Error('The bank is finite')
            bank.amount = 600
        })
        playOut(game, 3)
        expect(game.state.machineState).toBe('GameOver')
        expect(game.state.gameEnding?.reason).toBe('Bank broken')
        expect(game.state.finalWealth?.length).toBe(3)
    }, 120_000)
})

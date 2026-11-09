import { appendFileSync } from 'node:fs'
import { describe, it } from 'vitest'
import { playOut } from '../test/bot.js'
import { table } from '../test/kit.js'

// A wider sweep of bot games, run with SWEEP=1; failures go to /tmp/1862-sweep.log.
// eslint-disable-next-line turbo/no-undeclared-env-vars -- a manual run's switch
describe.skipIf(!process.env.SWEEP)('1862 bot sweep', () => {
    it('plays many games', { timeout: 3_000_000 }, () => {
        for (let seed = 100; seed < 128; seed++) {
            const players = 2 + (seed % 7)
            const game = table(players, seed)
            try {
                const moves = playOut(game, seed, 6000)
                appendFileSync(
                    '/tmp/1862-sweep.log',
                    `seed ${seed} players ${players}: ${game.state.machineState} after ${moves} (${game.state.gameEnding?.reason})\n`
                )
            } catch (error) {
                appendFileSync(
                    '/tmp/1862-sweep.log',
                    `seed ${seed} players ${players}: FAIL ${String(error).slice(0, 600)}\n`
                )
            }
        }
    })
})

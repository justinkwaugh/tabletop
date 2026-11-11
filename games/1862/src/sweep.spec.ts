import { describe, expect, it } from 'vitest'
import { playOut } from '../test/bot.js'
import { table } from '../test/kit.js'
import { positiveRun } from '../test/routeAudit.js'

// A wider sweep of bot games, run with SWEEP=1; the assertion lists every failure.
// eslint-disable-next-line turbo/no-undeclared-env-vars -- a manual run's switch
describe.skipIf(!process.env.SWEEP)('1862 bot sweep', () => {
    it('plays many games', { timeout: 3_000_000 }, () => {
        const failures: string[] = []
        let runs = 0
        let zeroRuns = 0
        for (let seed = 100; seed < 128; seed++) {
            const players = 2 + (seed % 7)
            const game = table(players, seed)
            try {
                const moves = playOut(game, seed, 6000, (state, result) => {
                    runs++
                    if (result.revenue) return
                    zeroRuns++
                    const witness = positiveRun(state, result.companyId)
                    if (!witness) return
                    const failure = `seed ${seed} ${result.companyId}: ran £0 with a legal £${witness.revenue} run`
                    failures.push(failure)
                })
                if (game.state.machineState !== 'GameOver')
                    failures.push(
                        `seed ${seed} players ${players}: ${game.state.machineState} after ${moves}`
                    )
            } catch (error) {
                failures.push(`seed ${seed} players ${players}: ${String(error).slice(0, 600)}`)
            }
        }
        expect({ runs, zeroRuns, failures }).toMatchObject({ failures: [] })
    })
})

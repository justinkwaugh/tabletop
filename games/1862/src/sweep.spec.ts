import { appendFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { playOut } from '../test/bot.js'
import { table } from '../test/kit.js'
import { positiveRun } from '../test/routeAudit.js'

// A wider sweep of bot games, run with SWEEP=1; failures go to /tmp/1862-sweep.log.
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
                    appendFileSync('/tmp/1862-sweep.log', `${failure}\n`)
                })
                appendFileSync(
                    '/tmp/1862-sweep.log',
                    `seed ${seed} players ${players}: ${game.state.machineState} after ${moves} (${game.state.gameEnding?.reason})\n`
                )
            } catch (error) {
                failures.push(`seed ${seed}: ${String(error)}`)
                appendFileSync(
                    '/tmp/1862-sweep.log',
                    `seed ${seed} players ${players}: FAIL ${String(error).slice(0, 600)}\n`
                )
            }
        }
        appendFileSync(
            '/tmp/1862-sweep.log',
            `audit: ${runs} runs, ${zeroRuns} zero runs, ${failures.length} failures\n`
        )
        expect(failures).toEqual([])
    })
})

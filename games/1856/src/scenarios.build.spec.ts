import { mkdirSync, writeFileSync } from 'node:fs'
import { describe, it } from 'vitest'
import { botMove, Random } from '../test/bot.js'
import { kit, type Table } from '../test/kit.js'

// Writes the harness's scenarios from seeded bot games: run with SCENARIOS=1.
const folder = new URL('../../1856-ui/src/scenarios/', import.meta.url)

// The first of the seeded games to reach the position within a harness-sized history.
function playUntil(
    players: number,
    seed: number,
    done: (game: Table) => boolean,
    limit = 3000,
    config?: Record<string, boolean>
) {
    for (let tried = seed; tried < seed + 60; tried++) {
        const game = kit.table(players, tried, config)
        const random = new Random(tried)
        for (let count = 0; count < limit && !done(game); count++) {
            if (game.state.machineState === 'GameOver') break
            const next = botMove(game, random)
            game.act(next.type, next.fields, next.playerId)
        }
        if (done(game)) return game
    }
    throw new Error('The position never came')
}

function save(slug: string, game: Table) {
    mkdirSync(folder, { recursive: true })
    // Each scenario is its own local game.
    const id = `scenario-1856-${slug}`
    const file = {
        game: { ...game.game, id, name: slug.replace(/-/g, ' ') },
        state: { ...game.state, gameId: id },
        actions: game.actions.map((action) => ({ ...action, gameId: id }))
    }
    writeFileSync(new URL(`${slug}.json`, folder), JSON.stringify(file))
}

/** The game reaches a machine state with a player to decide. */
const deciding = (machineState: string) => (game: Table) =>
    game.state.machineState === machineState && game.state.activePlayerIds.length > 0

// eslint-disable-next-line turbo/no-undeclared-env-vars -- a manual run's switch
describe.skipIf(!process.env.SCENARIOS)('1856 harness scenarios', () => {
    it('writes the private auction', () => {
        save('private-auction', kit.table(4, 1))
    })

    it('writes a company with loans at its loan step', { timeout: 600_000 }, () => {
        save(
            'loan-step',
            playUntil(
                4,
                1,
                (game) =>
                    game.state.machineState === 'RepayingLoans' &&
                    game.valid().includes('RepayLoan')
            )
        )
    })

    it('writes the CGR forming', { timeout: 600_000 }, () => {
        save('cgr-formation', playUntil(4, 1, deciding('FormingNational')))
    })

    it('writes a stock round after the CGR formed', { timeout: 600_000 }, () => {
        save(
            'cgr-stock-round',
            playUntil(
                4,
                1,
                (game) =>
                    game.state.machineState === 'StockRound' &&
                    !!game.state.companies.find((company) => company.id === 'CGR')?.started
            )
        )
    })

    it('writes a finished game', { timeout: 600_000 }, () => {
        save(
            'finished-game',
            playUntil(4, 1, (game) => game.state.machineState === 'GameOver', 6000)
        )
    })
})

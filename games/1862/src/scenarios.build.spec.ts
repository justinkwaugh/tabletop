import { writeFileSync } from 'node:fs'
import { describe, it } from 'vitest'
import { botMove, Random } from '../test/bot.js'
import { table, type Table } from '../test/kit.js'
import { canBuildToLondon, smallStationLines } from './builds.js'
import { mergerPartners } from './mergers.js'

// Writes the harness's scenarios from seeded bot games: run with SCENARIOS=1.
const folder = new URL('../../1862-ui/src/scenarios/', import.meta.url)

function playUntil(players: number, seed: number, done: (game: Table) => boolean, limit = 3000) {
    // The first of several seeded games to reach the position.
    for (let tried = seed; tried < seed + 40; tried++) {
        const game = table(players, tried)
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
    // Each scenario is its own local game.
    const id = `scenario-1862-${slug}`
    const file = {
        game: { ...game.game, id, name: slug.replace(/-/g, ' ') },
        state: { ...game.state, gameId: id },
        actions: game.actions.map((action) => ({ ...action, gameId: id }))
    }
    writeFileSync(new URL(`${slug}.json`, folder), JSON.stringify(file))
}

// eslint-disable-next-line turbo/no-undeclared-env-vars -- a manual run's switch
describe.skipIf(!process.env.SCENARIOS)('1862 harness scenarios', () => {
    it('writes them', { timeout: 600_000 }, () => {
        save(
            'first-operating-turn',
            playUntil(4, 21, (game) => game.state.machineState === 'LayingTrack')
        )
        save(
            'merger',
            playUntil(
                4,
                22,
                (game) =>
                    game.state.machineState === 'LayingTrack' &&
                    !!game.state.trackStep &&
                    !game.state.trackStep.lays.length &&
                    mergerPartners(game.state, game.state.trackStep.companyId).length > 0
            )
        )
        save(
            'phase-d-trains',
            playUntil(
                4,
                23,
                (game) => game.state.machineState === 'BuyingTrains' && game.state.phaseId >= 'D'
            )
        )
        const building = (game: Table) =>
            game.state.machineState === 'LayingTrack' &&
            !!game.state.trackStep &&
            !game.state.trackStep.lays.length &&
            game.valid().includes('PlaceSmallStation')
        save(
            'small-station',
            playUntil(
                4,
                25,
                // A hex with two open lines, so the line is chosen beside it.
                (game) =>
                    building(game) &&
                    Object.values(smallStationLines(game.hydrated)).some(
                        (lines) => lines.length > 1
                    )
            )
        )
        save(
            'london-link',
            playUntil(
                4,
                26,
                (game) =>
                    game.state.machineState === 'LayingTrack' &&
                    !!game.state.trackStep &&
                    !!game.state.companies.find(
                        (company) => company.id === game.state.trackStep?.companyId
                    )?.president &&
                    canBuildToLondon(game.hydrated, game.player, game.state.trackStep.companyId)
            )
        )
        save(
            'stock-round',
            playUntil(
                5,
                24,
                (game) =>
                    game.state.machineState === 'StockRound' && game.state.stockRound.number >= 3
            )
        )
    })
})

import { mkdirSync, writeFileSync } from 'node:fs'
import { describe, it } from 'vitest'
import { getCompany, trainsOwnedBy } from '@tabletop/18xx'
import { botMove, Random } from '../test/bot.js'
import { kit, opened, type Table } from '../test/kit.js'
import { RsrId } from './companies.js'

// Writes the harness's scenarios from seeded bot games: run with SCENARIOS=1.
const folder = new URL('../../1861-ui/src/scenarios/', import.meta.url)

// The first of the seeded games to reach the position within a harness-sized history.
function playUntil(players: number, seed: number, done: (game: Table) => boolean, limit = 3000) {
    for (let tried = seed; tried < seed + 60; tried++) {
        const game = kit.table(players, tried)
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
    const id = `scenario-1861-${slug}`
    const file = {
        game: { ...game.game, id, name: slug.replace(/-/g, ' ') },
        state: { ...game.state, gameId: id },
        actions: game.actions.map((action) => ({ ...action, gameId: id }))
    }
    writeFileSync(new URL(`${slug}.json`, folder), JSON.stringify(file))
}

const mergerDeciding = (game: Table) =>
    game.state.machineState === 'MergerRound' &&
    !game.state.mergerRound?.proposal &&
    !!game.state.mergerRound?.minorIds.length

// eslint-disable-next-line turbo/no-undeclared-env-vars -- a manual run's switch
describe.skipIf(!process.env.SCENARIOS)('1861 harness scenarios', () => {
    it('writes the private auction', () => {
        save('private-auction', kit.table(4, 1))
    })

    it('writes the Nikolaev auction', () => {
        save('nikolaev-auction', opened(4, 1))
    })

    it('writes a minor laying track', { timeout: 600_000 }, () => {
        save(
            'minor-laying-track',
            playUntil(
                4,
                1,
                (game) =>
                    game.state.machineState === 'LayingTrack' &&
                    game.valid().includes('LayTile') &&
                    getCompany(game.state, game.state.trackStep?.companyId ?? '').kind === 'minor'
            )
        )
    })

    it('writes a minor in the merger round', { timeout: 600_000 }, () => {
        save('merger-round', playUntil(4, 1, mergerDeciding))
    })

    it('writes a public company buying trains', { timeout: 600_000 }, () => {
        save(
            'public-company-buying-trains',
            playUntil(
                4,
                1,
                (game) =>
                    game.state.machineState === 'BuyingTrains' &&
                    getCompany(game.state, game.state.trainPurchaseStep?.companyId ?? '').kind ===
                        'major' &&
                    game.valid().includes('BuyTrain')
            )
        )
    })

    it('writes a trainless public company borrowing for a train', { timeout: 600_000 }, () => {
        save(
            'trainless-company-borrowing',
            playUntil(4, 1, (game) => {
                const companyId = game.state.trainPurchaseStep?.companyId ?? ''
                return (
                    game.state.machineState === 'BuyingTrains' &&
                    !!companyId &&
                    getCompany(game.state, companyId).kind === 'major' &&
                    !trainsOwnedBy(game.state, { kind: 'company', companyId }).length &&
                    game.valid().includes('BuyTrain')
                )
            })
        )
    })

    it('writes the state railway running', { timeout: 600_000 }, () => {
        save(
            'state-railway-running',
            playUntil(
                4,
                1,
                (game) =>
                    game.state.machineState === 'RunningTrains' &&
                    game.state.routeStep?.companyId === RsrId &&
                    trainsOwnedBy(game.state, { kind: 'company', companyId: RsrId }).length > 0
            )
        )
    })

    it('writes a trainless public company to decide', { timeout: 600_000 }, () => {
        save(
            'trainless-public-company',
            playUntil(4, 1, (game) => game.state.machineState === 'NationalisingTrainless')
        )
    })
})

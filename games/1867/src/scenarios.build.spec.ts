import { mkdirSync, writeFileSync } from 'node:fs'
import { describe, it } from 'vitest'
import { getCompany, trainsOwnedBy } from '@tabletop/18xx'
import { botMove, Random } from '../test/bot.js'
import { kit, opened, type Table } from '../test/kit.js'

// Writes the harness's scenarios from seeded bot games: run with SCENARIOS=1.
const folder = new URL('../../1867-ui/src/scenarios/', import.meta.url)

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
    const id = `scenario-1867-${slug}`
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
describe.skipIf(!process.env.SCENARIOS)('1867 harness scenarios', () => {
    it('writes the private auction', () => {
        save('private-auction', kit.table(4, 1))
    })

    it('writes a minor auction', () => {
        save('minor-auction', opened(4, 1))
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

    it('writes a major company buying trains', { timeout: 600_000 }, () => {
        save(
            'major-company-buying-trains',
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

    it('writes a trainless major company borrowing for a train', { timeout: 600_000 }, () => {
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

    it('writes a major trading a train in during phase 8', { timeout: 600_000 }, () => {
        save(
            'phase-8-trade-in',
            playUntil(4, 1, (game) => {
                const companyId = game.state.trainPurchaseStep?.companyId ?? ''
                return (
                    game.state.machineState === 'BuyingTrains' &&
                    game.state.phaseId === '8' &&
                    !!companyId &&
                    trainsOwnedBy(game.state, { kind: 'company', companyId }).length > 0 &&
                    game.valid().includes('BuyTrain')
                )
            })
        )
    })

    it('writes a major started in a stock round', { timeout: 600_000 }, () => {
        save(
            'major-start',
            playUntil(
                4,
                1,
                (game) =>
                    game.state.machineState === 'StockRound' &&
                    !game.state.companyAuction &&
                    game.valid().includes('StartCompany')
            )
        )
    })

    it('writes a trainless major company to decide', { timeout: 600_000 }, () => {
        save(
            'trainless-major-company',
            playUntil(4, 1, (game) => game.state.machineState === 'NationalisingTrainless')
        )
    })
})

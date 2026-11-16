import { mkdirSync, writeFileSync } from 'node:fs'
import { describe, it } from 'vitest'
import { botMove, Random } from '../test/bot.js'
import { kit, type Table } from '../test/kit.js'
import { BsId, CocId, CpId } from './companies.js'
import { PrivatePowerRulesChesapeake } from './privatePowers.js'
import { TrainDepotChesapeake } from './trains.js'

// Writes the harness's scenarios from seeded bot games: run with SCENARIOS=1.
const folder = new URL('../../18chesapeake-ui/src/scenarios/', import.meta.url)

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
    const id = `scenario-18chesapeake-${slug}`
    const file = {
        game: { ...game.game, id, name: slug.replace(/-/g, ' ') },
        state: { ...game.state, gameId: id },
        actions: game.actions.map((action) => ({ ...action, gameId: id }))
    }
    writeFileSync(new URL(`${slug}.json`, folder), JSON.stringify(file))
}

/** The operating company's president may use one of these privates' lays now. */
function privateLayOpen(game: Table, privateIds: readonly string[]): boolean {
    const playerId = game.player
    return (
        !!playerId &&
        game.state.machineState === 'LayingTrack' &&
        game.valid().includes('LayPrivateTile') &&
        privateIds.some(
            (id) => !!PrivatePowerRulesChesapeake.trackTerms(game.hydrated, id, playerId)
        )
    )
}

/** A company may buy a train while D-trains are on sale with a trade-in. */
function dieselOnSale(game: Table): boolean {
    return (
        game.state.machineState === 'BuyingTrains' &&
        game.valid().includes('BuyTrain') &&
        ['6', 'D'].includes(game.state.phaseId) &&
        TrainDepotChesapeake.remaining(game.state.trainInventory, 'D') === 'unlimited'
    )
}

/** A two-player stock turn where a pool share would be removed before a purchase. */
function poolRemovalOpen(game: Table): boolean {
    if (game.state.machineState !== 'StockRound' || !game.valid().includes('BuyShares'))
        return false
    const playerId = game.player
    return game.state.certificates.some((certificate) => {
        if (certificate.poolId !== 'open-market') return false
        const company = game.state.companies.find((entry) => entry.id === certificate.companyId)
        return company?.president?.kind === 'player' && company.president.playerId !== playerId
    })
}

// eslint-disable-next-line turbo/no-undeclared-env-vars -- a manual run's switch
describe.skipIf(!process.env.SCENARIOS)('18Chesapeake harness scenarios', () => {
    it('writes the private auction', () => {
        save('private-auction', kit.table(4, 1))
    })

    it('writes a two-tile private lay', { timeout: 600_000 }, () => {
        save(
            'paired-private-lay',
            playUntil(4, 1, (game) => privateLayOpen(game, [CpId, BsId]))
        )
    })

    it('writes the Chesapeake & Ohio Canal’s lay', { timeout: 600_000 }, () => {
        save(
            'canal-lay',
            playUntil(4, 1, (game) => privateLayOpen(game, [CocId]))
        )
    })

    it('writes D-trains on sale', { timeout: 600_000 }, () => {
        save('diesel-trade-in', playUntil(4, 1, dieselOnSale))
    })

    it('writes a two-player pool purchase', { timeout: 600_000 }, () => {
        save('two-player-pool-purchase', playUntil(2, 1, poolRemovalOpen))
    })

    it('writes an Off the Rails stock round', { timeout: 600_000 }, () => {
        save(
            'off-the-rails-stock-round',
            playUntil(
                4,
                1,
                (game) =>
                    game.state.machineState === 'StockRound' &&
                    game.state.stockRound.number >= 3 &&
                    game.state.companies.filter((company) => company.floated).length >= 3,
                3000,
                { offTheRails: true }
            )
        )
    })

    it('writes a finished Off the Rails game', { timeout: 600_000 }, () => {
        save(
            'off-the-rails-finished-game',
            playUntil(4, 2, (game) => game.state.machineState === 'GameOver', 6000, {
                offTheRails: true
            })
        )
    })

    it('writes a finished game', { timeout: 600_000 }, () => {
        save(
            'finished-game',
            playUntil(4, 2, (game) => game.state.machineState === 'GameOver', 6000)
        )
    })
})

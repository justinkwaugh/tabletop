import { writeFileSync } from 'node:fs'
import { describe, it } from 'vitest'
import {
    EmergencyTrainFunding,
    corporateFinanceChoices,
    insolvencyChoices,
    purchaseChoices
} from '@tabletop/18xx'
import { botMove, Random } from '../test/bot.js'
import { kit, type Table } from '../test/kit.js'
import {
    CorporateFinanceRules1849,
    TrainFundingRules1849,
    TrainRules1849,
    TransferRules1849
} from './operating.js'
import { StockRules1849, nextCorporation1849 } from './stock.js'

// Writes the harness's scenarios from seeded bot games: run with SCENARIOS=1.
const folder = new URL('../../1849-ui/src/scenarios/', import.meta.url)

function playUntil(
    players: number,
    seed: number,
    done: (game: Table) => boolean,
    limit = 4000,
    config: Record<string, boolean> = {}
) {
    // The first of several seeded games to reach the position.
    for (let tried = seed; tried < seed + 40; tried++) {
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
    // Each scenario is its own local game.
    const id = `scenario-1849-${slug}`
    const file = {
        game: { ...game.game, id, name: slug.replace(/-/g, ' ') },
        state: { ...game.state, gameId: id },
        actions: game.actions.map((action) => ({ ...action, gameId: id }))
    }
    writeFileSync(new URL(`${slug}.json`, folder), JSON.stringify(file))
}

const laying = (game: Table) =>
    game.state.machineState === 'LayingTrack' && !game.state.trackStep?.lays.length

// eslint-disable-next-line turbo/no-undeclared-env-vars -- a manual run's switch
describe.skipIf(!process.env.SCENARIOS)('1849 harness scenarios', () => {
    it('writes them', { timeout: 900_000 }, () => {
        save(
            'first-stock-round',
            playUntil(4, 1, (game) => game.state.machineState === 'StockRound')
        )
        save(
            'garibaldi-start',
            playUntil(
                4,
                2,
                (game) =>
                    game.state.machineState === 'StockRound' &&
                    nextCorporation1849(game.hydrated) === 'AFG'
            )
        )
        save('first-operating-turn', playUntil(4, 3, laying))
        save(
            'green-track',
            playUntil(4, 4, (game) => laying(game) && game.state.phaseId === '8H')
        )
        save(
            'end-of-turn-finance',
            playUntil(
                4,
                5,
                (game) =>
                    game.state.machineState === 'BuyingTrains' &&
                    corporateFinanceChoices(game.hydrated, CorporateFinanceRules1849).length > 1
            )
        )
        save(
            'insolvency',
            playUntil(3, 6, (game) => {
                if (game.state.machineState !== 'FundingTrain') return false
                const state = game.hydrated
                const next = new EmergencyTrainFunding(
                    state,
                    TrainFundingRules1849,
                    StockRules1849,
                    TrainRules1849
                ).next()
                return insolvencyChoices(state, TrainFundingRules1849, next).length > 0
            })
        )
        save(
            'after-earthquake',
            playUntil(4, 7, (game) => laying(game) && game.state.phaseId === '12H')
        )
        save(
            'blue-zone',
            playUntil(5, 8, (game) => laying(game) && game.state.phaseId === '16H')
        )
    })

    // Written on its own, so the scenarios above stay as they were.
    it('writes the presidency exchange', { timeout: 900_000 }, () => {
        save(
            'presidency-exchange',
            playUntil(4, 1, (game) => !!game.state.presidencyExchanges?.length)
        )
    })

    it('writes the bond step', { timeout: 900_000 }, () => {
        save(
            'bond-step',
            playUntil(
                4,
                1,
                (game) =>
                    game.state.machineState === 'RepayingLoans' &&
                    game.valid().includes('TakeLoan'),
                6000,
                { bonds: true }
            )
        )
    })

    it('writes the station purchase', { timeout: 900_000 }, () => {
        save(
            'station-purchase',
            playUntil(
                4,
                1,
                (game) =>
                    game.state.machineState === 'BuyingTrains' &&
                    !game.state.purchaseOffer &&
                    purchaseChoices(
                        game.hydrated,
                        game.player,
                        TransferRules1849,
                        TrainRules1849
                    ).some((choice) => choice.request.asset.kind === 'station'),
                6000,
                { buyStationTokens: true }
            )
        )
    })

    it('writes the E token', { timeout: 900_000 }, () => {
        save(
            'e-token',
            playUntil(
                4,
                1,
                (game) =>
                    game.state.machineState === 'BuyingTrains' &&
                    game.valid().includes('BuyAccessRight'),
                6000,
                { electricDreams: true }
            )
        )
    })
})

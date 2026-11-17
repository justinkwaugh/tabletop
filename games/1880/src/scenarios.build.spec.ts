import { mkdirSync, writeFileSync } from 'node:fs'
import { describe, it } from 'vitest'
import { controllingOwner, privateOwner } from '@tabletop/18xx'
import { botMove, Random, type BotSteering } from '../test/bot.js'
import { kit, type Table } from '../test/kit.js'
import { P7Id } from './companies.js'
import { forcedRocketCompanies } from './privatePowers.js'

// Writes the harness's scenarios from seeded bot games: run with SCENARIOS=1.
const folder = new URL('../../1880-ui/src/scenarios/', import.meta.url)

// The first of the seeded games to reach the position within a harness-sized history.
function playUntil(
    players: number,
    seed: number,
    done: (game: Table) => boolean,
    limit = 3000,
    steering: (game: Table) => BotSteering = () => ({})
) {
    for (let tried = seed; tried < seed + 60; tried++) {
        const game = kit.table(players, tried)
        const random = new Random(tried)
        const steer = steering(game)
        for (let count = 0; count < limit && !done(game); count++) {
            if (game.state.machineState === 'GameOver') break
            const next = botMove(game, random, steer)
            game.act(next.type, next.fields, next.playerId)
        }
        if (done(game)) return game
    }
    throw new Error('The position never came')
}

function save(slug: string, game: Table) {
    mkdirSync(folder, { recursive: true })
    // Each scenario is its own local game.
    const id = `scenario-1880-${slug}`
    const file = {
        game: { ...game.game, id, name: slug.replace(/-/g, ' ') },
        state: { ...game.state, gameId: id },
        actions: game.actions.map((action) => ({ ...action, gameId: id }))
    }
    writeFileSync(new URL(`${slug}.json`, folder), JSON.stringify(file))
}

// A seeded game whose Rocket owner's companies all stand at the train limit at the first 4-train.
const ROCKET_GIVING_UP_PLAYERS = 3
const ROCKET_GIVING_UP_SEED = 13

const inPhase = (game: Table, letter: string) => game.state.phaseId.startsWith(letter)

/** The Rocket of China kept for its forced exchange, its owner's companies buying every train. */
const fillingRocketOwner = (game: Table): BotSteering => ({
    keepsRocket: true,
    buysEagerly: (companyId) => {
        const owner = privateOwner(game.hydrated, P7Id)
        return (
            owner?.kind === 'player' &&
            controllingOwner(game.hydrated, companyId)?.playerId === owner.playerId
        )
    }
})

// eslint-disable-next-line turbo/no-undeclared-env-vars -- a manual run's switch
describe.skipIf(!process.env.SCENARIOS)('1880 harness scenarios', () => {
    it('writes the private auction', () => {
        save('private-auction', kit.table(4, 1))
    }, 300_000)
    it('writes the choice of investors', () => {
        save(
            'choosing-investors',
            playUntil(4, 1, (game) => game.state.machineState === 'ChoosingInvestors')
        )
    }, 300_000)
    it('writes the first share round', () => {
        save(
            'first-share-round',
            playUntil(4, 1, (game) => game.state.machineState === 'StockRound')
        )
    }, 300_000)
    it('writes a share round interrupting an operating round', () => {
        save(
            'interrupting-share-round',
            playUntil(
                4,
                2,
                (game) =>
                    game.state.machineState === 'StockRound' &&
                    !!game.state.stockRoundInterruption?.started &&
                    inPhase(game, 'B')
            )
        )
    }, 300_000)
    it('writes an investor laying track', () => {
        save(
            'investor-laying-track',
            playUntil(
                4,
                3,
                (game) =>
                    game.state.machineState === 'LayingTrack' &&
                    game.state.trackStep?.companyId.startsWith('A') === true &&
                    game.state.operatingSet?.roundNumber === 3
            )
        )
    }, 300_000)
    it('writes the investor merger choice', () => {
        save(
            'investor-merger',
            playUntil(4, 1, (game) => !!game.state.investorMerger, 6000)
        )
    }, 300_000)
    it('writes the Rocket of China’s forced exchange', () => {
        save(
            'rocket-exchange',
            playUntil(4, 1, (game) => game.state.machineState === 'ExchangingRocket', 6000)
        )
    }, 300_000)
    it('writes the Rocket of China’s exchange offered before the 4-trains', () => {
        save(
            'rocket-voluntary',
            playUntil(4, 1, (game) => {
                const playerId = game.player
                return (
                    !!playerId &&
                    game.state.machineState !== 'ExchangingRocket' &&
                    game.valid(playerId).includes('ExchangeRocket') &&
                    inPhase(game, 'B')
                )
            })
        )
    }, 300_000)
    it('writes the Rocket of China’s forced exchange giving up a train', () => {
        save(
            'rocket-giving-up',
            playUntil(
                ROCKET_GIVING_UP_PLAYERS,
                ROCKET_GIVING_UP_SEED,
                (game) =>
                    game.state.machineState === 'ExchangingRocket' &&
                    forcedRocketCompanies(game.hydrated).makesRoom,
                6000,
                fillingRocketOwner
            )
        )
    }, 600_000)
    it('writes a major buying trains in phase C', () => {
        save(
            'phase-c-trains',
            playUntil(
                5,
                3,
                (game) =>
                    game.state.machineState === 'BuyingTrains' &&
                    inPhase(game, 'C') &&
                    game.valid().includes('BuyTrain'),
                6000
            )
        )
    }, 300_000)
    it('writes a finished game', () => {
        save(
            'finished-game',
            playUntil(4, 2, (game) => game.state.machineState === 'GameOver', 8000)
        )
    }, 300_000)
})

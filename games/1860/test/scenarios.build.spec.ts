import { mkdirSync, writeFileSync } from 'node:fs'
import { describe, it } from 'vitest'
import { buyablePrivates, sellablePrivates } from '../src/bankPrivates.js'
import { FishbourneId } from '../src/companies.js'
import { leasedTrain } from '../src/routes.js'
import type { State1860 } from '../src/state.js'
import { mapState1860 } from '../src/tiles.js'
import { botMove, Random } from './bot.js'
import { kit, type Table } from './kit.js'

// Writes the UI harness's scenarios from seeded bot games: run with SCENARIOS=all, or with
// SCENARIOS naming the ones to write, separated by commas.
const folder = new URL('../../1860-ui/src/scenarios/', import.meta.url)

/** The halts laid on the map. */
function laidHalts(state: State1860): number {
    const map = mapState1860(state)
    return Object.keys(state.tileInventory.placements).filter((locationId) =>
        map.tile(locationId).face.nodes.some((node) => node.kind === 'town' && node.halt)
    ).length
}

// eslint-disable-next-line turbo/no-undeclared-env-vars -- a manual run's switch
const Wanted = (process.env.SCENARIOS ?? '').split(',')
const wanted = (slug: string) => Wanted.includes('all') || Wanted.includes(slug)

function save(slug: string, game: () => Table) {
    if (!wanted(slug)) return
    const table = game()
    console.info(`${slug}: ${table.actions.length} actions, ${table.state.machineState}`)
    mkdirSync(folder, { recursive: true })
    const id = `scenario-1860-${slug}`
    const file = {
        game: { ...table.game, id, name: slug.replace(/-/g, ' ') },
        state: { ...table.state, gameId: id },
        actions: table.actions.map((action) => ({ ...action, gameId: id }))
    }
    writeFileSync(new URL(`${slug}.json`, folder), JSON.stringify(file))
}

// eslint-disable-next-line turbo/no-undeclared-env-vars -- a manual run's switch
describe.skipIf(!process.env.SCENARIOS)('1860 harness scenarios', () => {
    it('writes the scenarios', () => {
        /** The first of the seeded games to reach the position. */
        function playUntil(
            players: number,
            seed: number,
            done: (game: Table) => boolean,
            seeds = 40
        ): Table {
            for (let tried = seed; tried < seed + seeds; tried++) {
                const game = kit.table(players, tried)
                const random = new Random(tried)
                try {
                    for (let count = 0; count < 6000 && !done(game); count++) {
                        if (game.state.machineState === 'GameOver') break
                        const next = botMove(game, random)
                        game.act(next.type, next.fields, next.playerId)
                    }
                } catch (error) {
                    console.warn(`Seed ${tried} failed after ${game.actions.length} actions`, error)
                    continue
                }
                if (done(game)) return game
            }
            throw new Error('The position never came')
        }
        save('initial-auction', () =>
            playUntil(
                4,
                1,
                (game) =>
                    !!game.state.choiceAuction?.bid &&
                    game.state.choiceAuction.lotIds.length === 4 &&
                    game.state.choiceAuction.passedIds.length > 0
            )
        )
        save('first-stock-round', () =>
            playUntil(4, 1, (game) => game.state.machineState === 'StockRound')
        )
        save('home-tile', () =>
            playUntil(4, 1, (game) => game.state.machineState === 'LayingHomeTile')
        )
        save('halts', () =>
            playUntil(
                4,
                1,
                (game) =>
                    game.state.machineState === 'RunningTrains' &&
                    game.state.phaseId !== '2' &&
                    laidHalts(game.state) >= 4
            )
        )
        save('insolvent-lease', () =>
            playUntil(4, 1, (game) => {
                const companyId = game.state.routeStep?.companyId
                return (
                    game.state.machineState === 'RunningTrains' &&
                    !!companyId &&
                    !!leasedTrain(game.hydrated, companyId)
                )
            })
        )
        save('bankrupt-refloat', () =>
            playUntil(
                4,
                1,
                (game) =>
                    game.state.machineState === 'StockRound' && game.state.bankruptIds.length > 0
            )
        )
        save('private-sale', () =>
            playUntil(
                4,
                1,
                (game) =>
                    game.state.machineState === 'StockRound' &&
                    sellablePrivates(game.hydrated, game.player).length > 0
            )
        )
        save('fishbourne-ferry', () =>
            playUntil(
                4,
                1,
                (game) =>
                    game.state.machineState === 'StockRound' &&
                    buyablePrivates(game.hydrated, game.player).includes(FishbourneId)
            )
        )
        save('nationalisation', () =>
            playUntil(
                4,
                1,
                (game) =>
                    game.state.machineState === 'RunningTrains' &&
                    (game.state.nationalisation?.closedCompanyIds.length ?? 0) > 0
            )
        )
    }, 1_800_000)
})

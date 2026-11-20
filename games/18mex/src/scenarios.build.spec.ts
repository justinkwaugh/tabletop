import { mkdirSync, writeFileSync } from 'node:fs'
import { describe, it } from 'vitest'
import { startingPositionFile } from '@tabletop/common/testing'
import { TrackConstruction, withTiles } from '@tabletop/18xx'
import { botMove, Random } from '../test/bot.js'
import { kit, type Table } from '../test/kit.js'
import { CopperCanyonLocationId, MexicoCityLocationId, PueblaLocationId } from './map.js'
import type { StateMex } from './state.js'
import { TrackRulesMex } from './track.js'
import { CopperCanyonTileId, TileSetMex, mapStateMex } from './tiles.js'

// Writes the harness's scenarios from seeded bot games: run with SCENARIOS=1.
const folder = new URL('../../18mex-ui/src/scenarios/', import.meta.url)

/** The first of the seeded games to reach the position. */
function playUntil(players: number, seed: number, done: (game: Table) => boolean, seeds = 40) {
    for (let tried = seed; tried < seed + seeds; tried++) {
        const game = kit.table(players, tried)
        const random = new Random(tried)
        for (let count = 0; count < 4000 && !done(game); count++) {
            if (game.state.machineState === 'GameOver') break
            const next = botMove(game, random)
            game.act(next.type, next.fields, next.playerId)
        }
        if (done(game)) return game
    }
    throw new Error('The position never came')
}

/** Saves a position arranged in code, which starts its history afresh. */
function saveArranged(slug: string, game: Table, arrange: (state: StateMex) => void) {
    mkdirSync(folder, { recursive: true })
    const state = structuredClone(game.state)
    arrange(state)
    const { fileName, contents } = startingPositionFile({
        slug: `18mex-${slug}`,
        name: slug.replace(/-/g, ' '),
        game: game.game,
        state
    })
    writeFileSync(new URL(fileName.replace(/^18mex-/, ''), folder), contents)
}

function save(slug: string, game: Table) {
    mkdirSync(folder, { recursive: true })
    const id = `scenario-18mex-${slug}`
    const file = {
        game: { ...game.game, id, name: slug.replace(/-/g, ' ') },
        state: { ...game.state, gameId: id },
        actions: game.actions.map((action) => ({ ...action, gameId: id }))
    }
    writeFileSync(new URL(`${slug}.json`, folder), JSON.stringify(file))
}

// eslint-disable-next-line turbo/no-undeclared-env-vars -- a manual run's switch
describe.skipIf(!process.env.SCENARIOS)('18MEX harness scenarios', () => {
    it('writes the scenarios', () => {
        save('private-auction', kit.table(4, 7))
        const first = playUntil(4, 1, (game) => game.state.machineState === 'StockRound')
        save('first-stock-round', first)
        // Copper Canyon, the seaport cities' yellow tiles and the green Mexico City tile laid in
        // the first stock round, to see them drawn.
        saveArranged('special-tiles', first, (state) => {
            state.tileInventory = withTiles(TileSetMex, state.tileInventory, [
                {
                    locationId: CopperCanyonLocationId,
                    definitionId: CopperCanyonTileId,
                    rotation: 0
                },
                { locationId: 'K6', definitionId: '18mex:471', rotation: 0 },
                { locationId: 'M12', definitionId: '18mex:472', rotation: 0 },
                { locationId: 'P13', definitionId: '18mex:473', rotation: 1 },
                { locationId: MexicoCityLocationId, definitionId: '18mex:479MC', rotation: 0 },
                { locationId: PueblaLocationId, definitionId: '18mex:479P', rotation: 0 }
            ])
        })
        save(
            'minors-operate',
            playUntil(
                4,
                1,
                (game) =>
                    game.state.machineState === 'RunningTrains' &&
                    game.state.routeStep?.companyId === 'B'
            )
        )
        save(
            'ndm-merger',
            playUntil(4, 1, (game) => game.state.machineState === 'MergingIntoNdM')
        )
        // A company's track step with the Mexico City double tile among its lays.
        save(
            'upgrade-mexico-city',
            playUntil(
                4,
                1,
                (game) =>
                    game.state.machineState === 'LayingTrack' &&
                    !game.state.trackStep?.lays.length &&
                    new TrackConstruction(game.state, TrackRulesMex).choices(MexicoCityLocationId)
                        .length > 0
            )
        )
        // A company's track step with the brown Mexico City double tiles among its lays.
        save(
            'upgrade-mexico-city-to-brown',
            playUntil(
                4,
                1,
                (game) =>
                    game.state.machineState === 'LayingTrack' &&
                    !game.state.trackStep?.lays.length &&
                    new TrackConstruction(game.state, TrackRulesMex)
                        .choices(MexicoCityLocationId)
                        .some((choice) => /^18mex:48[56]MC$/.test(choice.definitionId))
            )
        )
        const late = playUntil(
            4,
            1,
            (game) => game.state.phaseId === '4D' && game.state.machineState === 'StockRound'
        )
        save('late-game', late)
        // The brown double tile and Copper Canyon laid over the late game, to see them drawn.
        saveArranged('brown-mexico-city', late, (state) => {
            const map = mapStateMex(state)
            const brown = /^18mex:48[56]MC$/.test(
                map.tile(MexicoCityLocationId).placement?.definitionId ?? ''
            )
            state.tileInventory = withTiles(TileSetMex, state.tileInventory, [
                ...(brown
                    ? []
                    : [
                          {
                              locationId: MexicoCityLocationId,
                              definitionId: '18mex:485MC',
                              rotation: 0 as const
                          },
                          {
                              locationId: PueblaLocationId,
                              definitionId: '18mex:485P',
                              rotation: 0 as const
                          }
                      ]),
                ...(map.tile(CopperCanyonLocationId).placement
                    ? []
                    : [
                          {
                              locationId: CopperCanyonLocationId,
                              definitionId: CopperCanyonTileId,
                              rotation: 0 as const
                          }
                      ])
            ])
        })
    }, 1_200_000)
})

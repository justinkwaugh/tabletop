import { mkdirSync, writeFileSync } from 'node:fs'
import { describe, it } from 'vitest'
import { startingPositionFile } from '@tabletop/common/testing'
import { StationPlacement, neutralStation, placeableStations } from '@tabletop/18xx'
import { botMove, Random } from '../test/bot.js'
import { fishingOnly, kit, type Table } from '../test/kit.js'
import { CnId, NwrId } from './companies.js'
import { Map1882 } from './map.js'
import { StationRules1882 } from './stations.js'
import { TrainDepot1882 } from './trains.js'

// Writes the harness's scenarios from seeded bot games: run with SCENARIOS=1.
const folder = new URL('../../1882-ui/src/scenarios/', import.meta.url)

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
    const id = `scenario-1882-${slug}`
    const file = {
        game: { ...game.game, id, name: slug.replace(/-/g, ' ') },
        state: { ...game.state, gameId: id },
        actions: game.actions.map((action) => ({ ...action, gameId: id }))
    }
    writeFileSync(new URL(`${slug}.json`, folder), JSON.stringify(file))
}

/** Saves a position arranged in code, which starts its history afresh. */
function saveArranged(slug: string, game: Table) {
    mkdirSync(folder, { recursive: true })
    const { fileName, contents } = startingPositionFile({
        slug: `1882-${slug}`,
        name: slug.replace(/-/g, ' '),
        game: game.game,
        state: game.state
    })
    writeFileSync(new URL(fileName.replace(/^1882-/, ''), folder), contents)
}

/** The operating company may place the neutral station it holds. */
function neutralPlaceable(game: Table): boolean {
    const companyId = game.state.stationStep?.companyId
    if (game.state.machineState !== 'PlacingStation' || !companyId) return false
    if (!game.valid().includes('PlaceStation')) return false
    const placement = new StationPlacement(game.hydrated, StationRules1882)
    return placeableStations(game.state, Map1882, companyId).some(
        (station) =>
            !!neutralStation(Map1882, station.id) && placement.choices(station.id).length > 0
    )
}

/** A company is about to buy the train whose purchase brings the rebellion. */
function rebellionTrainNext(game: Table): boolean {
    const { definitionId, occurred } = game.state.rebellion
    return (
        !occurred &&
        game.state.machineState === 'BuyingTrains' &&
        game.valid().includes('BuyTrain') &&
        TrainDepot1882.nextDefinitionId(game.state.trainInventory) === definitionId
    )
}

// eslint-disable-next-line turbo/no-undeclared-env-vars -- a manual run's switch
describe.skipIf(!process.env.SCENARIOS)('1882 harness scenarios', () => {
    it('writes the private auction', () => {
        save('private-auction', kit.table(4, 1))
    })

    it('writes the Saskatchewan Central exchange', { timeout: 600_000 }, () => {
        save(
            'saskatchewan-central-exchange',
            playUntil(4, 1, (game) => game.valid().includes('ConvertCentral'))
        )
    })

    it('writes a neutral station placement', { timeout: 600_000 }, () => {
        save('neutral-station', playUntil(4, 1, neutralPlaceable))
    })

    it('writes the North-West Rebellion Company moving a station', { timeout: 600_000 }, () => {
        save(
            'rebellion-station-move',
            playUntil(4, 1, (game) => game.valid().includes('MoveRebellionStation'))
        )
    })

    it('writes the rebellion’s extra lay', { timeout: 600_000 }, () => {
        save(
            'rebellion-extra-lay',
            playUntil(
                4,
                1,
                (game) =>
                    game.state.privateTrackLay?.privateCompanyId === NwrId &&
                    game.valid().includes('LayPrivateTile')
            )
        )
    })

    it('writes the rebellion train on sale', { timeout: 600_000 }, () => {
        save('rebellion-train', playUntil(4, 1, rebellionTrainNext))
    })

    it('writes the Canadian National laying track', { timeout: 600_000 }, () => {
        save(
            'canadian-national-track',
            playUntil(
                4,
                1,
                (game) =>
                    game.state.machineState === 'LayingTrack' &&
                    game.state.trackStep?.companyId === CnId &&
                    game.valid().includes('LayTile')
            )
        )
    })

    it('writes a company whose only route is to the fishing exit', () => {
        const game = fishingOnly()
        game.act('FinishTrack', { companyId: 'CNoR' })
        while (game.state.machineState !== 'BuyingTrains')
            game.act(
                game.valid().includes('FinishStations') ? 'FinishStations' : 'FinishOperatingTurn',
                { companyId: 'CNoR' }
            )
        saveArranged('fishing-exit-funding', game)
    })

    it('writes a finished game', { timeout: 600_000 }, () => {
        save(
            'finished-game',
            playUntil(4, 2, (game) => game.state.machineState === 'GameOver', 6000)
        )
    })
})

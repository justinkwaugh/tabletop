import { mkdirSync, writeFileSync } from 'node:fs'
import { describe, it } from 'vitest'
import { trainsOwnedBy } from '@tabletop/18xx'
import { startingPositionFile } from '@tabletop/common/testing'
import { PullmanTrainId } from '../../18usa/src/trains.js'
import { botMove, Random } from '../../18usa/test/bot.js'
import { edit, kit, type Table } from '../../18usa/test/kit.js'
import { atLimitWithExpressFreight, mergerChoice } from '../../18usa/test/mergers.js'
import { giveTrain, presidentHoldingFive, emptyTreasury } from '../../18usa/test/positions.js'

// Writes the harness's scenarios from seeded games of the logic package's test bot: run with
// SCENARIOS=all, or with SCENARIOS naming the ones to write, separated by commas.
const folder = new URL('../src/scenarios/', import.meta.url)

// eslint-disable-next-line turbo/no-undeclared-env-vars -- a manual run's switch
const Wanted = (process.env.SCENARIOS ?? '').split(',')
const wanted = (slug: string) => Wanted.includes('all') || Wanted.includes(slug)

function save(slug: string, game: () => Table) {
    if (!wanted(slug)) return
    const table = game()
    console.info(`${slug}: ${table.actions.length} actions, ${table.state.machineState}`)
    mkdirSync(folder, { recursive: true })
    const id = `scenario-18usa-${slug}`
    const file = {
        game: { ...table.game, id, name: slug.replace(/-/g, ' ') },
        state: { ...table.state, gameId: id },
        actions: table.actions.map((action) => ({ ...action, gameId: id }))
    }
    writeFileSync(new URL(`${slug}.json`, folder), JSON.stringify(file))
}

/** A position arranged from a seeded game, with no actions behind it. */
function arrange(slug: string, name: string, game: () => Table) {
    if (!wanted(slug)) return
    const table = game()
    console.info(`${slug}: arranged, ${table.state.machineState}`)
    mkdirSync(folder, { recursive: true })
    const file = startingPositionFile({ slug, name, game: table.game, state: table.state })
    writeFileSync(new URL(file.fileName, folder), file.contents)
}

/** Passes the merger round's choices until the company must give up stations. */
function untilReducingStations(game: Table, companyId: string) {
    while (game.state.machineState !== 'ReducingStations') {
        const pass = game
            .valid(game.player)
            .find((type) => type.startsWith('Pass') || type.startsWith('Finish'))
        if (!pass) throw new Error(`Stuck in ${game.state.machineState}`)
        game.act(pass, { companyId })
    }
    return game
}

/** The first of the seeded games to reach the position. */
function playUntil(players: number, seed: number, done: (game: Table) => boolean, seeds = 40) {
    for (let tried = seed; tried < seed + seeds; tried++) {
        const game = kit.table(players, tried)
        const random = new Random(tried)
        try {
            for (let count = 0; count < 8000 && !done(game); count++) {
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

const offersSubsidy = (game: Table, locationId: string) =>
    !!game.state.citySubsidies[locationId] && !game.state.noSubsidyCityIds.includes(locationId)

const runningWithPullman = (game: Table) => {
    const companyId = game.state.routeStep?.companyId
    return (
        game.state.machineState === 'RunningTrains' &&
        !!companyId &&
        trainsOwnedBy(game.state, { kind: 'company', companyId }).some(
            (train) => train.definitionId === PullmanTrainId
        )
    )
}

// eslint-disable-next-line turbo/no-undeclared-env-vars -- a manual run's switch
describe.skipIf(!process.env.SCENARIOS)('18USA harness scenarios', () => {
    it('writes the scenarios', () => {
        save('private-auction', () =>
            playUntil(
                4,
                1,
                (game) =>
                    !!game.state.selectionAuction?.bidding &&
                    game.state.selectionAuction.bidding.auction.participants.filter(
                        (participant) => participant.bid !== undefined
                    ).length > 1
            )
        )
        save('company-auction', () =>
            playUntil(
                4,
                1,
                (game) =>
                    game.state.machineState === 'StockRound' &&
                    !!game.state.companyAuction &&
                    offersSubsidy(game, game.state.companyAuction.home.locationId) &&
                    game.state.companies.some(
                        (company) => company.kind !== 'private' && company.started
                    )
            )
        )
        save('laying-track', () =>
            playUntil(
                4,
                1,
                (game) =>
                    game.state.machineState === 'LayingTrack' &&
                    game.state.phaseId === '3' &&
                    Object.keys(game.state.tileInventory.placements).length > 12
            )
        )
        save('merger-round', () =>
            playUntil(4, 1, (game) => game.state.machineState === 'MergerRound')
        )
        save('acquisition-round', () =>
            playUntil(4, 1, (game) => game.state.machineState === 'AcquisitionRound')
        )
        save('pullman-run', () => playUntil(4, 1, runningWithPullman))
        arrange('station-limit', 'station limit', () => {
            const { game, companyId, targetId } = mergerChoice()
            atLimitWithExpressFreight(game, companyId, targetId)
            game.act('MergeCompanies', { companyId, targetId })
            return untilReducingStations(game, companyId)
        })
        arrange('merger-pullman', 'merger with a pullman', () => {
            const { game, companyId } = mergerChoice()
            edit(game, (state) => void giveTrain(state, companyId, PullmanTrainId))
            return game
        })
        arrange('president-sale', 'president sale', () => {
            const { game, president } = presidentHoldingFive({ noPresidentLimit: true })
            emptyTreasury(game, 'ATSF', president)
            return game
        })
    }, 1_800_000)
})

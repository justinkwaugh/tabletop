import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { describe, it } from 'vitest'
import { getCompany, releaseTrains, startCompanyAtPar } from '@tabletop/18xx'
import { startingPositionFile } from '@tabletop/common/testing'
import { EighteenUSAEndingRules } from '../../18usa/src/endingRules.js'
import type { EighteenUSAState } from '../../18usa/src/state.js'
import { EighteenUSAMarket } from '../../18usa/src/stockMarket.js'
import { EighteenUSAPhases, EighteenUSATrainDepot, PullmanTrainId } from '../../18usa/src/trains.js'
import { playUntil, runningWithPullman } from './seededGames.js'
import * as Privates from './privateScenarios.js'
import { edit, type Table } from '../../18usa/test/kit.js'
import { atLimitWithExpressFreight, mergerChoice } from '../../18usa/test/mergers.js'
import {
    giveTrain,
    presidentHoldingFive,
    emptyTreasury,
    setPhase
} from '../../18usa/test/positions.js'

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

const offersSubsidy = (game: Table, locationId: string) =>
    !!game.state.citySubsidies[locationId] && !game.state.noSubsidyCityIds.includes(locationId)

type RecordedRun = {
    companyId: string
    trains: string[]
    metropolisIds: EighteenUSAState['metropolisIds']
    placements: EighteenUSAState['tileInventory']['placements']
    dealtRevenues: EighteenUSAState['tileInventory']['dealtRevenues']
    stations: EighteenUSAState['stations']
    locationMarkers: EighteenUSAState['locationMarkers']
    cityBonuses: EighteenUSAState['cityBonuses']
}

/**
 * The board and fleet of a recorded phase-8 run laid over a seeded game at its run step: trains
 * rusted by phase 8 leave, and the companies holding stations on that board start at $100 under
 * the players in turn, the running company's president being the player whose turn it is.
 */
function recordedPhase8Run(game: Table): Table {
    const run: RecordedRun = JSON.parse(
        readFileSync(new URL('fixtures/phase-8-fleet.json', import.meta.url), 'utf8')
    )
    const par = EighteenUSAMarket.spaces.find((space) => space.price === 100)
    if (!par) throw new Error('No $100 space')
    edit(game, (state) => {
        const placedIds = new Set(run.stations.map((station) => station.id))
        state.stations = [
            ...run.stations,
            ...state.stations.filter(
                (station) => !placedIds.has(station.id) && station.status !== 'placed'
            )
        ]
        state.tileInventory = {
            placements: run.placements,
            dealtRevenues: run.dealtRevenues,
            retiredPieceIds: []
        }
        state.locationMarkers = run.locationMarkers
        state.cityBonuses = run.cityBonuses
        state.metropolisIds = run.metropolisIds
        setPhase(state, '8')
        const rusted = state.trainInventory.trains.filter((train) => {
            const rustsOn = EighteenUSATrainDepot.trainDefinition(train.definitionId).rustsOn
            return !!rustsOn && EighteenUSAPhases.isAtLeast('8', rustsOn)
        })
        releaseTrains(
            state.trainInventory,
            rusted.map((train) => train.id),
            'removed'
        )
        const runner = state.activePlayerIds[0]
        const players = state.players.map((player) => player.playerId)
        const companyIds = [...new Set(run.stations.map((station) => station.companyId))]
        companyIds.forEach((companyId, index) => {
            const company = getCompany(state, companyId)
            if (company.started) return
            startCompanyAtPar(state, EighteenUSAMarket, companyId, par.id)
            company.floated = true
            const president = state.certificates.find(
                (certificate) =>
                    certificate.kind === 'share' &&
                    certificate.companyId === companyId &&
                    certificate.president
            )
            if (president)
                president.owner = {
                    kind: 'player',
                    playerId: companyId === run.companyId ? runner : players[index % players.length]
                }
        })
        for (const definitionId of run.trains) giveTrain(state, run.companyId, definitionId)
        const set = state.operatingSet
        if (!set) throw new Error('The run step needs an operating set')
        state.operatingSet = { ...set, companyOrder: [run.companyId], completedCompanyIds: [] }
        state.trackStep = { companyId: run.companyId, lays: [], completed: true }
        state.stationStep = { companyId: run.companyId, placedStationIds: [], completed: true }
        state.routeStep = { companyId: run.companyId }
        delete state.trainAssignments
        state.gameEnding = EighteenUSAEndingRules.trigger(state)
    })
    return game
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
        arrange('phase-8-run', 'phase 8 run', () =>
            recordedPhase8Run(playUntil(4, 1, runningWithPullman))
        )
        arrange('privates-resources', 'privates resources', Privates.resourcePrivates)
        arrange('privates-track', 'privates track', Privates.trackPrivates)
        arrange('privates-tiles', 'privates tiles', Privates.tilePrivates)
        arrange('privates-stations', 'privates stations', Privates.stationPrivates)
        arrange('privates-run', 'privates run', Privates.runPrivates)
        arrange('privates-trains', 'privates trains', Privates.trainPrivates)
        arrange('privates-company-start', 'privates company start', Privates.companyStartPrivates)
        arrange('privates-boomtown-subsidy', 'privates boomtown subsidy', Privates.boomtownSubsidy)
        arrange('president-sale', 'president sale', () => {
            const { game, president } = presidentHoldingFive({ noPresidentLimit: true })
            emptyTreasury(game, 'ATSF', president)
            return game
        })
    }, 1_800_000)
})

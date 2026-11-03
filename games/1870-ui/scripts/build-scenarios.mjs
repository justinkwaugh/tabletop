// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios,
// from the logic package's recorded game. Build the logic package first:
// node scripts/build-scenarios.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GameEngine, scenarioJson } from '@tabletop/common'
import { startingPosition, startingPositionFile } from '@tabletop/common/testing'
import { Definition } from '@tabletop/1870'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, '..', 'src', 'scenarios')
const recorded = JSON.parse(
    readFileSync(join(here, '..', '..', '1870', 'test', 'fixtures', 'finished-game.json'), 'utf8')
)

const Scenarios = [
    {
        slug: 'bridge-for-sale',
        name: 'Bridge for sale',
        reached: (state) =>
            state.machineState === 'LayingTrack' && state.trackStep?.companyId === 'MP'
    },
    {
        slug: 'price-protection',
        name: 'Price protection',
        reached: (state) => state.machineState === 'ProtectingPrice'
    },
    {
        slug: 'company-shares',
        name: 'Company shares',
        reached: (state, engine, game) =>
            state.machineState === 'StockRound' &&
            engine
                .getValidActionTypesForPlayer(game, state, state.activePlayerIds[0])
                .includes('RedeemShare')
    },
    {
        slug: 'connection-run',
        name: 'Connection run',
        reached: (state) => state.machineState === 'PlacingDestinationStation'
    },
    {
        slug: 'connection-route',
        name: 'Connection route',
        reached: (state) => !!state.destinationRun && state.machineState === 'RunningTrains'
    },
    {
        slug: 'port-token',
        name: 'Port token',
        reached: (state, engine, game) =>
            state.machineState === 'LayingTrack' &&
            engine
                .getValidActionTypesForPlayer(game, state, state.activePlayerIds[0])
                .includes('PlaceRevenueToken')
    },
    {
        slug: 'late-game',
        name: 'Late game',
        reached: (state) =>
            state.phaseId === '8' &&
            state.machineState === 'LayingTrack' &&
            state.destinationRunsMade.length >= 4
    }
]

// A position this far in opens with no history, to keep its file small.
const HistoryLimit = 300

mkdirSync(OUT, { recursive: true })
const engine = new GameEngine(Definition.runtime)

function write(scenario) {
    const { slug, name } = scenario
    const start = startingPosition({
        slug,
        name,
        game: { ...recorded.game, createdAt: new Date(recorded.game.createdAt) },
        state: recorded.initialState
    })
    let state = start.state
    const actions = []
    for (const action of recorded.actions) {
        const result = engine.executeCanonicalAction({
            game: start.game,
            state,
            action: { ...action, gameId: start.game.id }
        })
        actions.push(...result.processedActions)
        state = result.updatedState
        if (scenario.reached(state, engine, start.game)) break
    }
    if (!scenario.reached(state, engine, start.game)) throw new Error(`Never reached ${slug}`)
    if (actions.length > HistoryLimit) {
        const file = startingPositionFile({ slug, name, game: start.game, state })
        writeFileSync(join(OUT, file.fileName), file.contents)
        return
    }
    const game = { ...start.game, activePlayerIds: [...state.activePlayerIds] }
    writeFileSync(join(OUT, `${slug}.json`), scenarioJson({ game, state, actions }))
}

for (const scenario of Scenarios) write(scenario)

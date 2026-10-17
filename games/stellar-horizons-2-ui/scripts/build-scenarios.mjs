// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Build the logic package first: node scripts/build-scenarios.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scenarioJson } from '@tabletop/common'
import { startingPosition } from '@tabletop/common/testing'
import { ActionType, TurnPhase } from '@tabletop/stellar-horizons-2'
import {
    VOYAGES_CONFIG,
    advanceTo,
    edit,
    execute,
    placeShip,
    startedGame,
    userAction
} from '@tabletop/stellar-horizons-2/testing'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')

const VEGA = 'vega'
const STELLAR_CHART = 'stellar-chart'

/** A three-player game of These are the Voyages with its starting bases placed. */
function voyagesWithBases() {
    const { game, state: started } = startedGame(3, VOYAGES_CONFIG)
    // Starting bases are placed in reverse initiative order.
    const state = ['alpha-centauri', 'luhman-16', 'barnards-star'].reduce((current, systemId) => {
        const [playerId] = current.activePlayerIds
        return execute(
            game,
            current,
            userAction(game, playerId, ActionType.PlaceStartingBase, { systemId })
        )
    }, started)
    return { game, state }
}

/**
 * The Stellar Chart at Vega with two ships of every faction there, each pair strong enough to
 * resolve it, at the start of the exploration phase.
 */
function threeFactionsAtOneAnomaly() {
    const { game, state: placed } = voyagesWithBases()
    const [starfarers, givers, praetorians] = placed.turnManager.turnOrder
    const arranged = edit(placed, (state) => {
        state.systemState(VEGA).anomaly = STELLAR_CHART
        state.anomalyPool.splice(state.anomalyPool.indexOf(STELLAR_CHART), 1)
        placeShip(state, starfarers, 'starfarers-orion', VEGA)
        placeShip(state, starfarers, 'starfarers-kepler', VEGA)
        placeShip(state, givers, 'givers-darwin', VEGA)
        placeShip(state, givers, 'givers-mendel', VEGA)
        placeShip(state, praetorians, 'praetorians-odyssey', VEGA)
        placeShip(state, praetorians, 'praetorians-audax', VEGA)
    })
    return { game, state: advanceTo(game, arranged, TurnPhase.Exploration) }
}

function write(slug, name, { game, state }) {
    // Players are named by their place in initiative order.
    const order = state.turnManager.turnOrder
    const position = startingPosition({
        slug,
        name,
        game: {
            ...game,
            players: game.players.map((player) => ({
                ...player,
                name: `Player ${order.indexOf(player.id) + 1}`
            }))
        },
        state
    })
    // The phase's span began before the position; with no actions behind it, it begins here.
    if (position.state.parallelSpan) {
        position.state.parallelSpan.branchPoint = { actionCount: 0, actionChecksum: 0 }
    }
    writeFileSync(join(OUT, `${slug}.json`), scenarioJson(position))
}

mkdirSync(OUT, { recursive: true })

write('three-factions-at-one-anomaly', 'Three factions at one anomaly', threeFactionsAtOneAnomaly())

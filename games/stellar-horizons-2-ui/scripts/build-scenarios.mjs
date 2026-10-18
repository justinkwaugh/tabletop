// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Build the logic package first: node scripts/build-scenarios.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scenarioJson } from '@tabletop/common'
import { startingPosition } from '@tabletop/common/testing'
import {
    ActionType,
    EconomicTile,
    Faction,
    ScenarioId,
    TechId,
    TurnPhase,
    WorldSide,
    recordPledgeableShips
} from '@tabletop/stellar-horizons-2'
import {
    VOYAGES_CONFIG,
    advanceTo,
    edit,
    execute,
    finishDecade,
    placeBase,
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

const CAMPAIGN_CONFIG = { scenario: ScenarioId.Campaign }

// Takes a world out of the pool or the campaign's set-aside worlds, so it is never in two places.
function takeWorld(state, predicate) {
    for (const pool of [state.worldPool, state.setAsideWorlds]) {
        const tileId = pool.find(predicate)
        if (tileId !== undefined) {
            pool.splice(pool.indexOf(tileId), 1)
            return tileId
        }
    }
    throw new Error('No such world left')
}

function placeWorlds(state, systemId, worlds) {
    state.systemState(systemId).worlds = worlds.map(([predicate, side]) => ({
        tileId: takeWorld(state, predicate),
        side
    }))
}

const is = (tileId) => (candidate) => candidate === tileId
const ofClass = (prefix) => (candidate) => candidate.startsWith(prefix)

function playerOf(state, faction) {
    return state.players.find((player) => player.faction === faction).playerId
}

/**
 * A campaign (Starfarers, Givers, Praetorians, True Path) prepared at the end of 2100 so that
 * 2110 draws the given economic tile.
 */
function campaignInto(tile, playerCount, arrange) {
    const { game, state: started } = startedGame(playerCount, CAMPAIGN_CONFIG)
    const arranged = edit(started, (state) => {
        state.economicTilePool = [tile]
        arrange(state)
    })
    return { game, state: finishDecade(game, arranged) }
}

/** Initiative in 2110 with 3, 1 and no IP to declare. */
function campaignInitiative() {
    return campaignInto(EconomicTile.RollInitiative, 3, (state) => {
        const [first, second] = state.initiativeOrder()
        state.getPlayerState(first).influence = 3
        state.getPlayerState(second).influence = 1
    })
}

/** Base production in 2110: the Starfarers have two bases, the Givers one. */
function campaignBaseProduction() {
    return campaignInto(EconomicTile.BaseProduction, 3, (state) => {
        const starfarers = playerOf(state, Faction.Starfarers)
        const givers = playerOf(state, Faction.Givers)
        placeWorlds(state, 'alpha-centauri', [
            [is('m-1'), WorldSide.I],
            [ofClass('d-'), WorldSide.I]
        ])
        placeWorlds(state, 'luhman-16', [[ofClass('j-'), WorldSide.I]])
        placeBase(state, starfarers, 'alpha-centauri', 12)
        placeBase(state, starfarers, 'luhman-16', 4)
        placeBase(state, givers, 'alpha-centauri', 6)
    })
}

/** Growth in 2110, after which the True Path may convert a Givers settlement at Alpha Centauri. */
function campaignConversion() {
    return campaignInto(EconomicTile.SettlementGrowth, 4, (state) => {
        placeWorlds(state, 'alpha-centauri', [[is('m-1'), WorldSide.I]])
        placeBase(state, playerOf(state, Faction.TruePath), 'alpha-centauri', 5)
        placeBase(state, playerOf(state, Faction.Givers), 'alpha-centauri', 4)
    })
}

/** Terraforming in 2110: the Givers own Terraforming, so they terraform twice. */
function campaignTerraforming() {
    return campaignInto(EconomicTile.Terraforming, 3, (state) => {
        const givers = playerOf(state, Faction.Givers)
        state.getPlayerState(givers).techs.push({ techId: TechId.Terraforming, year: 2090 })
        placeWorlds(state, 'alpha-centauri', [
            [is('m-1'), WorldSide.I],
            [is('m-2'), WorldSide.II]
        ])
        placeBase(state, givers, 'alpha-centauri', 8)
    })
}

/** Developing techs in 2100 with IP to spend and too little cash. */
function campaignPayingWithInfluence() {
    const { game, state: started } = startedGame(3, CAMPAIGN_CONFIG)
    const arranged = edit(started, (state) => {
        for (const player of state.players) {
            player.influence = 4
            player.cash = 2
        }
    })
    return { game, state: advanceTo(game, arranged, TurnPhase.Development) }
}

/** Exploration in 2100: Terran DNA at Alpha Centauri, with a Starfarers and a Givers ship there. */
function campaignPact() {
    const { game, state: started } = startedGame(3, CAMPAIGN_CONFIG)
    const arranged = edit(started, (state) => {
        placeWorlds(state, 'alpha-centauri', [[is('m-1'), WorldSide.I]])
        state.anomalyPool.splice(state.anomalyPool.indexOf('terran-dna'), 1)
        state.systemState('alpha-centauri').anomaly = 'terran-dna'
        placeShip(state, playerOf(state, Faction.Starfarers), 'starfarers-orion', 'alpha-centauri')
        placeShip(state, playerOf(state, Faction.Givers), 'givers-darwin', 'alpha-centauri')
        // Placed after the phase began, so what the other Players saw is taken again.
        recordPledgeableShips(state)
    })
    return { game, state: arranged }
}

/** Exploration in 2100: the Starfarers' mining and research ships at Alpha Centauri. */
function campaignMining() {
    const { game, state: started } = startedGame(3, CAMPAIGN_CONFIG)
    const arranged = edit(started, (state) => {
        const starfarers = playerOf(state, Faction.Starfarers)
        placeWorlds(state, 'alpha-centauri', [
            [is('m-1'), WorldSide.I],
            [ofClass('d-'), WorldSide.I]
        ])
        state.getPlayerState(starfarers).techs.push({
            techId: TechId.AtmosphereProcessing,
            year: 2090
        })
        placeShip(state, starfarers, 'starfarers-pytheas', 'alpha-centauri')
        placeShip(state, starfarers, 'starfarers-orion', 'alpha-centauri')
        recordPledgeableShips(state)
    })
    return { game, state: arranged }
}

/** 2110 draws an event with a challenge; the Givers, worst in initiative with a base, place it. */
function campaignEvent() {
    return campaignInto(EconomicTile.DrawEvent, 3, (state) => {
        state.eventPool = ['incoming-comet']
        placeWorlds(state, 'alpha-centauri', [[is('m-1'), WorldSide.I]])
        placeWorlds(state, 'luhman-16', [[ofClass('j-'), WorldSide.I]])
        placeBase(state, playerOf(state, Faction.Starfarers), 'alpha-centauri', 6)
        placeBase(state, playerOf(state, Faction.Givers), 'alpha-centauri', 4)
        placeBase(state, playerOf(state, Faction.Givers), 'luhman-16', 3)
    })
}

/** Base production in 2110 at Alpha Centauri, where Mineral Veins lies turned over, and an event. */
function campaignAnomalyBacks() {
    return campaignInto(EconomicTile.BaseProduction, 3, (state) => {
        placeWorlds(state, 'alpha-centauri', [[is('m-1'), WorldSide.I]])
        state.anomalyPool.splice(state.anomalyPool.indexOf('mineral-veins'), 1)
        state.systemState('alpha-centauri').anomaly = 'mineral-veins'
        state.systemState('alpha-centauri').anomalyResolved = true
        state.eventPool.splice(state.eventPool.indexOf('pirate-raids-3'), 1)
        state.events.push({ eventId: 'pirate-raids-3', systemId: 'alpha-centauri' })
        placeBase(state, playerOf(state, Faction.Starfarers), 'alpha-centauri', 8)
    })
}

/** The Starfarers resolve Splinter Colony at the end of 2100's exploration and place its settlements. */
function campaignRewardSettlements() {
    const { game, state: started } = startedGame(3, CAMPAIGN_CONFIG)
    const arranged = edit(started, (state) => {
        const starfarers = playerOf(state, Faction.Starfarers)
        placeWorlds(state, 'alpha-centauri', [[is('m-1'), WorldSide.I]])
        placeWorlds(state, 'barnards-star', [[ofClass('l-'), WorldSide.I]])
        state.anomalyPool.splice(state.anomalyPool.indexOf('splinter-colony'), 1)
        state.systemState('alpha-centauri').anomaly = 'splinter-colony'
        placeBase(state, starfarers, 'barnards-star', 4)
        state.getPlayerState(starfarers).anomalyAttempts.push({
            systemId: 'alpha-centauri',
            anomalyId: 'splinter-colony',
            shipIds: []
        })
    })
    return { game, state: finishDecade(game, arranged) }
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
write('campaign-initiative', 'Campaign: initiative', campaignInitiative())
write('campaign-base-production', 'Campaign: base production', campaignBaseProduction())
write('campaign-conversion', 'Campaign: True Path conversion', campaignConversion())
write('campaign-terraforming', 'Campaign: terraforming', campaignTerraforming())
write('campaign-paying-with-influence', 'Campaign: paying with IP', campaignPayingWithInfluence())
write('campaign-pact', 'Campaign: a pact', campaignPact())
write('campaign-mining', 'Campaign: mining and research', campaignMining())
write('campaign-event', 'Campaign: placing an event', campaignEvent())
write('campaign-anomaly-backs', 'Campaign: anomaly backs', campaignAnomalyBacks())
write('campaign-reward-settlements', 'Campaign: reward settlements', campaignRewardSettlements())

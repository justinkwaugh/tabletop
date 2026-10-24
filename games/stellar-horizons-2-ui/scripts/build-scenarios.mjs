// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Build the logic package first: node scripts/build-scenarios.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scenarioJson } from '@tabletop/common'
import { startingPosition } from '@tabletop/common/testing'
import {
    ActionType,
    CardDeck,
    EconomicTile,
    Faction,
    GoodsHolderKind,
    ScenarioId,
    TechId,
    TradeGood,
    TurnPhase,
    WorldSide,
    cardPile,
    recordPledgeableShips,
    recountPile
} from '@tabletop/stellar-horizons-2'
import {
    VOYAGES_CONFIG,
    advanceTo,
    edit,
    endPhase,
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

// Moves goods from the pool to where a scenario wants them.
function takeGoods(state, goods) {
    for (const good of goods) {
        state.goodsPool.splice(state.goodsPool.indexOf(good), 1)
    }
    return [...goods]
}

/**
 * 2110 draws the trade goods tile. The Starfarers draw Food, Ore and Fine Art, with bases at
 * Alpha Centauri (M and D worlds) and Luhman 16 (a J world).
 */
function campaignTradeGoods() {
    const drawn = campaignInto(EconomicTile.DrawTradeGoods, 3, (state) => {
        const starfarers = playerOf(state, Faction.Starfarers)
        placeWorlds(state, 'alpha-centauri', [
            [is('m-1'), WorldSide.I],
            [ofClass('d-'), WorldSide.I]
        ])
        placeWorlds(state, 'luhman-16', [[ofClass('j-'), WorldSide.I]])
        placeBase(state, starfarers, 'alpha-centauri', 6)
        placeBase(state, starfarers, 'luhman-16', 3)
        placeBase(state, playerOf(state, Faction.Givers), 'alpha-centauri', 4)
    })
    const state = edit(drawn.state, (current) => {
        const player = current.getPlayerState(playerOf(current, Faction.Starfarers))
        current.goodsPool.push(...player.drawnGoods)
        player.drawnGoods = takeGoods(current, [TradeGood.Food, TradeGood.Ore, TradeGood.FineArt])
    })
    return { game: drawn.game, state }
}

/**
 * The cargo and trade phase of 2110, the Starfarers' turn. They have Medicine at their base at
 * Alpha Centauri, where Medicine is in demand, Fauna aboard Andromeda at Barnard's Star, where
 * the Givers have a base and Fauna is in demand, and Ore on Earth.
 */
function campaignTradeTurn() {
    let starfarers
    const ready = campaignInto(EconomicTile.EarthProduction, 3, (state) => {
        starfarers = playerOf(state, Faction.Starfarers)
        const givers = playerOf(state, Faction.Givers)
        placeWorlds(state, 'alpha-centauri', [
            [is('m-1'), WorldSide.I],
            [ofClass('k-'), WorldSide.I]
        ])
        placeWorlds(state, 'barnards-star', [[ofClass('l-'), WorldSide.I]])
        placeBase(state, starfarers, 'alpha-centauri', 6).goods = takeGoods(state, [
            TradeGood.Medicine,
            TradeGood.Food
        ])
        placeBase(state, givers, 'barnards-star', 5)
        placeShip(state, starfarers, 'starfarers-andromeda', 'barnards-star', {
            goods: takeGoods(state, [TradeGood.Fauna])
        })
        placeShip(state, starfarers, 'starfarers-polaris', 'alpha-centauri')
        state.getPlayerState(starfarers).earthGoods = takeGoods(state, [TradeGood.Ore])
        for (const [systemId, good] of [
            ['alpha-centauri', TradeGood.Medicine],
            ['barnards-star', TradeGood.Fauna]
        ]) {
            state.demandPool.splice(state.demandPool.indexOf(good), 1)
            state.systemState(systemId).demand = good
        }
    })
    return {
        game: ready.game,
        state: advanceTo(ready.game, ready.state, TurnPhase.Cargo, starfarers),
        starfarers
    }
}

/** After selling Medicine at Alpha Centauri the Starfarers choose its new demand marker. */
function campaignDemandChoice() {
    const { game, state, starfarers } = campaignTradeTurn()
    const sold = execute(
        game,
        state,
        userAction(game, starfarers, ActionType.SellGoods, {
            systemId: 'alpha-centauri',
            good: TradeGood.Medicine,
            sources: [
                { holder: { kind: GoodsHolderKind.Base, systemId: 'alpha-centauri' }, count: 1 }
            ]
        })
    )
    return { game, state: sold }
}

/** The Starfarers resolve Megafauna at Alpha Centauri and place its 2 Fauna. */
function campaignRewardGoods() {
    const { game, state: started } = startedGame(3, CAMPAIGN_CONFIG)
    const arranged = edit(started, (state) => {
        const starfarers = playerOf(state, Faction.Starfarers)
        placeWorlds(state, 'alpha-centauri', [[is('m-1'), WorldSide.I]])
        state.anomalyPool.splice(state.anomalyPool.indexOf('megafauna'), 1)
        state.systemState('alpha-centauri').anomaly = 'megafauna'
        placeBase(state, starfarers, 'alpha-centauri', 6)
        placeShip(state, starfarers, 'starfarers-andromeda', 'alpha-centauri', {
            settlements: 1
        })
        state.getPlayerState(starfarers).anomalyAttempts.push({
            systemId: 'alpha-centauri',
            anomalyId: 'megafauna',
            shipIds: []
        })
    })
    return { game, state: finishDecade(game, arranged) }
}

// Takes a card out of its deck or discards, or out of the hand that drew it, which then takes
// another card of its deck, so it is never in two places.
function takeCard(state, cardId) {
    for (const pile of state.cardPiles) {
        for (const cards of [pile.cards, pile.discards]) {
            if (cards.includes(cardId)) {
                cards.splice(cards.indexOf(cardId), 1)
                recountPile(pile)
                return pile
            }
        }
    }
    for (const player of state.players) {
        const card = player.hand.find((held) => held.cardId === cardId)
        if (card) {
            const deck = cardPile(state, card.deck, card.level)
            card.cardId = deck.cards.shift()
            recountPile(deck)
            return deck
        }
    }
    throw new Error(`${cardId} is neither in a deck nor in a hand`)
}

function ownCard(state, playerId, cardId) {
    takeCard(state, cardId)
    state.getPlayerState(playerId).cards.push({ cardId, year: 2090, bought: true })
}

// Puts a card in a Player's hand in place of the hand's card of the same deck, returned to it.
function holdCard(state, playerId, cardId) {
    const pile = takeCard(state, cardId)
    const player = state.getPlayerState(playerId)
    const index = player.hand.findIndex((card) => card.deck === pile.deck)
    const [returned] = player.hand.splice(index, 1)
    const back = cardPile(state, returned.deck, returned.level)
    back.cards.push(returned.cardId)
    recountPile(back)
    player.hand.push({ playerId, deck: pile.deck, level: pile.level, cardId })
}

/**
 * Developing in 2100 with cards to buy: the Starfarers hold Scout Ships and Gifted Artists and
 * own Robo Miners, so another fleet improvement I costs 5 more; everyone has markers and IP.
 */
function campaignBuyingCards() {
    const { game, state: started } = startedGame(3, CAMPAIGN_CONFIG)
    const arranged = edit(started, (state) => {
        const starfarers = playerOf(state, Faction.Starfarers)
        holdCard(state, starfarers, 'scout-ships')
        holdCard(state, starfarers, 'gifted-artists')
        ownCard(state, starfarers, 'robo-miners')
        ownCard(state, playerOf(state, Faction.Givers), 'cunning')
        for (const player of state.players) {
            player.techMarkers = { Biology: [5, 4, 3], Physics: [5, 5, 4], Engineering: [4, 3] }
            player.influence = 3
            player.cash = 6
        }
    })
    return { game, state: advanceTo(game, arranged, TurnPhase.Development) }
}

/**
 * The deal after 2100's development: nobody bought anything, so every hand is discarded and
 * redrawn, and the Starfarers, with Starship Theoretical Concepts, choose their fleet card's level.
 */
function campaignCardLevels() {
    const { game, state: started } = startedGame(3, CAMPAIGN_CONFIG)
    const arranged = edit(started, (state) => {
        const starfarers = playerOf(state, Faction.Starfarers)
        state.getPlayerState(starfarers).techs.push({
            techId: TechId.StarshipTheoreticalConcepts,
            year: 2090
        })
        for (const player of state.players) {
            player.cash = 0
        }
    })
    let state = advanceTo(game, arranged, TurnPhase.Development)
    while (state.machineState !== 'DrawingCards') {
        state = endPhase(game, state)
    }
    return { game, state }
}

/**
 * The same deal, with the level I fleet deck down to one card: a copy of Resilient Crews, which
 * the Starfarers own. Drawing it there discards it and they draw again, from level II; the
 * Players after them find level I empty and go without a fleet card.
 */
function campaignShortDeck() {
    const { game, state: dealing } = campaignCardLevels()
    const state = edit(dealing, (state) => {
        const starfarers = playerOf(state, Faction.Starfarers)
        const copy = 'resilient-crews'
        ownCard(state, starfarers, copy)
        takeCard(state, copy)
        const pile = cardPile(state, CardDeck.Fleet, 1)
        pile.discards.push(...pile.cards)
        pile.cards = [copy]
        recountPile(pile)
    })
    return { game, state }
}

/**
 * The Starfarers resolve Alien Remains at the end of 2100's exploration. The level I genetic deck
 * holds only the card in their hand, so they earn it from the hand and draw its replacement at
 * once; Advanced Genetic Manipulation lets them choose level II or III for it.
 */
function campaignAnomalyCard() {
    const { game, state: started } = startedGame(3, CAMPAIGN_CONFIG)
    const arranged = edit(started, (state) => {
        const starfarers = playerOf(state, Faction.Starfarers)
        const player = state.getPlayerState(starfarers)
        player.techs.push({ techId: TechId.AdvancedGeneticManipulation, year: 2090 })
        const held = player.hand.find((card) => card.deck === CardDeck.Genetic)
        const pile = cardPile(state, CardDeck.Genetic, 1)
        // The rest of level I waits among the discards, shuffled back at the end of the turn.
        pile.discards.push(...pile.cards)
        pile.cards = [held.cardId]
        recountPile(pile)
        placeWorlds(state, 'alpha-centauri', [[is('m-1'), WorldSide.I]])
        state.anomalyPool.splice(state.anomalyPool.indexOf('alien-remains'), 1)
        state.systemState('alpha-centauri').anomaly = 'alien-remains'
        player.anomalyAttempts.push({
            systemId: 'alpha-centauri',
            anomalyId: 'alien-remains',
            shipIds: []
        })
    })
    return { game, state: finishDecade(game, arranged) }
}

/** Exploration in 2100: Alien Derelict at Alpha Centauri, with a Starfarers and a Givers ship. */
function campaignCardPact() {
    const { game, state: started } = startedGame(3, CAMPAIGN_CONFIG)
    const arranged = edit(started, (state) => {
        placeWorlds(state, 'alpha-centauri', [[is('m-1'), WorldSide.I]])
        state.anomalyPool.splice(state.anomalyPool.indexOf('alien-derelict'), 1)
        state.systemState('alpha-centauri').anomaly = 'alien-derelict'
        placeShip(state, playerOf(state, Faction.Starfarers), 'starfarers-orion', 'alpha-centauri')
        placeShip(state, playerOf(state, Faction.Givers), 'givers-darwin', 'alpha-centauri')
        recordPledgeableShips(state)
    })
    return { game, state: arranged }
}

/** Growth in 2110: the Givers own Prolific Breeders and have two bases that can grow. */
function campaignProlificBreeders() {
    return campaignInto(EconomicTile.SettlementGrowth, 3, (state) => {
        const givers = playerOf(state, Faction.Givers)
        ownCard(state, givers, 'prolific-breeders')
        placeWorlds(state, 'alpha-centauri', [[is('m-1'), WorldSide.I]])
        placeWorlds(state, 'luhman-16', [[is('m-2'), WorldSide.I]])
        placeBase(state, givers, 'alpha-centauri', 4)
        placeBase(state, givers, 'luhman-16', 2)
    })
}

/** The start of 2110: the Starfarers own Hive Mind and choose the economic tile. */
function campaignHiveMind() {
    const { game, state: started } = startedGame(3, CAMPAIGN_CONFIG)
    const arranged = edit(started, (state) => {
        ownCard(state, playerOf(state, Faction.Starfarers), 'hive-mind')
    })
    return { game, state: finishDecade(game, arranged) }
}

/**
 * The end of 2100's exploration: the Starfarers own Planetary Surveys and complete a survey of
 * Alpha Centauri, so they draw two worlds for its empty slot and choose one.
 */
function campaignPlanetarySurveys() {
    const { game, state: started } = startedGame(3, CAMPAIGN_CONFIG)
    const arranged = edit(started, (state) => {
        const starfarers = playerOf(state, Faction.Starfarers)
        ownCard(state, starfarers, 'planetary-surveys')
        state.getPlayerState(starfarers).pendingSurveys.push({
            shipId: 'starfarers-kepler',
            systemId: 'alpha-centauri'
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
write('campaign-trade-goods', 'Campaign: assigning trade goods', campaignTradeGoods())
write('campaign-trading', 'Campaign: cargo and trade', campaignTradeTurn())
write('campaign-demand', 'Campaign: choosing demand', campaignDemandChoice())
write('campaign-reward-goods', 'Campaign: reward goods', campaignRewardGoods())
write('campaign-buying-cards', 'Campaign: buying cards', campaignBuyingCards())
write('campaign-card-levels', 'Campaign: choosing a card level', campaignCardLevels())
write('campaign-short-deck', 'Campaign: a short deck', campaignShortDeck())
write('campaign-anomaly-card', 'Campaign: a card from an anomaly', campaignAnomalyCard())
write('campaign-card-pact', 'Campaign: a pact for a card', campaignCardPact())
write('campaign-prolific-breeders', 'Campaign: Prolific Breeders', campaignProlificBreeders())
write('campaign-hive-mind', 'Campaign: Hive Mind', campaignHiveMind())
write('campaign-planetary-surveys', 'Campaign: Planetary Surveys', campaignPlanetarySurveys())

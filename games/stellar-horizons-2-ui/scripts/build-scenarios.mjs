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
    CombatKind,
    CombatSide,
    EconomicTile,
    EscalationMarker,
    Faction,
    GoodsHolderKind,
    MachineState,
    RaidResult,
    ScenarioId,
    TechId,
    TradeGood,
    TurnPhase,
    WorldSide,
    cardPile,
    TERRAFORM_POPULATION_STEP,
    TitleId,
    WorldClass,
    crippledThreshold,
    damageCapacity,
    maxPopulation,
    worldTile,
    raidResult,
    recordPledgeableShips,
    recountPile
} from '@tabletop/stellar-horizons-2'
import {
    VOYAGES_CONFIG,
    advanceTo,
    edit,
    endPhase,
    execute,
    executeAll,
    finishDecade,
    giveDirective,
    hydrate,
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

/**
 * Base production in 2110 after the truce: the Praetorians' Gladiator and Odyssey (combat 14) at
 * Alpha Centauri, beside a Givers base of 6 and a Starfarers base of 4.
 */
function campaignBlockade() {
    return campaignInto(EconomicTile.BaseProduction, 3, (state) => {
        state.truce = false
        const praetorians = playerOf(state, Faction.Praetorians)
        placeWorlds(state, 'alpha-centauri', [[is('m-1'), WorldSide.I]])
        placeBase(state, playerOf(state, Faction.Givers), 'alpha-centauri', 6)
        placeBase(state, playerOf(state, Faction.Starfarers), 'alpha-centauri', 4)
        placeShip(state, praetorians, 'praetorians-gladiator', 'alpha-centauri')
        placeShip(state, praetorians, 'praetorians-odyssey', 'alpha-centauri')
    })
}

/**
 * Growth in 2110 after the truce: the Praetorians own Military Academy and their Gladiator
 * (combat 8) is at Luhman 16, beside a Givers base of 5.
 */
function campaignBlockadeGrowth() {
    return campaignInto(EconomicTile.SettlementGrowth, 3, (state) => {
        state.truce = false
        const praetorians = playerOf(state, Faction.Praetorians)
        ownCard(state, praetorians, 'military-academy')
        placeWorlds(state, 'luhman-16', [[is('m-2'), WorldSide.I]])
        placeBase(state, playerOf(state, Faction.Givers), 'luhman-16', 5)
        placeShip(state, praetorians, 'praetorians-gladiator', 'luhman-16')
    })
}

/**
 * The same blockade with one escalation marker left in the pool: the Praetorians, with no IP,
 * owe two.
 */
function campaignEmptyEscalationPool() {
    return campaignInto(EconomicTile.BaseProduction, 3, (state) => {
        state.truce = false
        const praetorians = playerOf(state, Faction.Praetorians)
        placeWorlds(state, 'alpha-centauri', [[is('m-1'), WorldSide.I]])
        placeBase(state, playerOf(state, Faction.Givers), 'alpha-centauri', 6)
        placeBase(state, playerOf(state, Faction.Starfarers), 'alpha-centauri', 4)
        placeShip(state, praetorians, 'praetorians-gladiator', 'alpha-centauri')
        placeShip(state, praetorians, 'praetorians-odyssey', 'alpha-centauri')
        state.escalationPool = [EscalationMarker.Points3]
    })
}

/** Developing in 2110 under the truce, whose roll at 1% ends the turn. */
function campaignTruceRoll() {
    const { game, state } = campaignInto(EconomicTile.EarthProduction, 3, () => {})
    return { game, state: advanceTo(game, state, TurnPhase.Development) }
}

/**
 * A campaign in 2110's combat phase after the truce, with the Earth production tile and the
 * given Player first in initiative order.
 */
function campaignAtWar(firstFaction, arrange) {
    const { game, state: started } = startedGame(3, CAMPAIGN_CONFIG)
    const arranged = edit(started, (state) => {
        state.economicTilePool = [EconomicTile.EarthProduction]
        state.truce = false
        const first = playerOf(state, firstFaction)
        state.turnManager.reorder([
            first,
            ...state.initiativeOrder().filter((playerId) => playerId !== first)
        ])
        arrange(state)
    })
    return { game, state: advanceTo(game, arranged, TurnPhase.Combat) }
}

/**
 * Draws the protected randomness ahead until the moves a scenario expects of the Players give
 * the result it promises: the dice are rolled only once they act in the harness.
 */
function withDice({ game, state: position }, play, promised) {
    for (let skipped = 0; skipped < 2000; skipped++) {
        const state = structuredClone(position)
        state.protectedPrng.invocations += skipped
        if (promised(play(game, state))) {
            return { game, state }
        }
    }
    throw new Error('No dice give the promised result')
}

function act(game, state, type, fields) {
    return execute(game, state, userAction(game, state.activePlayerIds[0], type, fields))
}

const LUHMAN_16 = 'luhman-16'

/**
 * The Player Guide's combat example: the Praetorians' Odyssey and Gladiator at Luhman 16 beside
 * the Givers' base of 3, Guildmaster and Sapphire (carrying a settlement). The Praetorians own
 * Military Academy.
 */
function guideExample(arrange = () => {}) {
    return campaignAtWar(Faction.Praetorians, (state) => {
        const praetorians = playerOf(state, Faction.Praetorians)
        const givers = playerOf(state, Faction.Givers)
        ownCard(state, praetorians, 'military-academy')
        placeWorlds(state, LUHMAN_16, [[is('m-2'), WorldSide.I]])
        placeBase(state, givers, LUHMAN_16, 3)
        placeShip(state, givers, 'consortium-guildmaster', LUHMAN_16)
        placeShip(state, givers, 'consortium-sapphire', LUHMAN_16, { settlements: 1 })
        placeShip(state, praetorians, 'praetorians-odyssey', LUHMAN_16)
        placeShip(state, praetorians, 'praetorians-gladiator', LUHMAN_16)
        arrange(state)
    })
}

// The Player Guide's assault, both Praetorian ships against the base and both Givers CVs.
function guideAssault(game, state) {
    const declared = act(game, state, ActionType.DeclareAttack, {
        kind: CombatKind.Assault,
        systemId: LUHMAN_16,
        defenderId: playerOf(hydrate(state), Faction.Givers),
        shipIds: ['praetorians-odyssey', 'praetorians-gladiator']
    })
    return act(game, declared, ActionType.DefendAttack, {
        includeBase: false,
        shipIds: ['consortium-guildmaster', 'consortium-sapphire']
    })
}

// Hits land on both sides, and the first is a choice.
function hitsOnBothSides(played) {
    const state = hydrate(played)
    const combat = state.combat
    return (
        state.machineState === MachineState.AssigningHits &&
        combat.hits[CombatSide.Attacker] > 0 &&
        combat.hits[CombatSide.Defender] > 0
    )
}

/** The Player Guide's example, with dice that leave hits to choose on both sides. */
function campaignAssault() {
    return withDice(guideExample(), guideAssault, hitsOnBothSides)
}

/**
 * The Player Guide's assault already rolled, with hits to choose on both sides: the Gladiator is
 * a hit from crippled and the Sapphire a hit from destroyed.
 */
function campaignHits() {
    const position = withDice(
        guideExample((state) => {
            const gladiator = state.ship('praetorians-gladiator')
            gladiator.damage = crippledThreshold(state, gladiator) - 1
            const sapphire = state.ship('consortium-sapphire')
            sapphire.damage = damageCapacity(state, sapphire) - 1
        }),
        guideAssault,
        hitsOnBothSides
    )
    return { game: position.game, state: guideAssault(position.game, position.state) }
}

/**
 * The Praetorians' Odyssey and Gladiator at Luhman 16 beside the Givers' lone base of 2, with
 * dice that eliminate it.
 */
function campaignBaseEliminated() {
    const assault = (game, state) =>
        act(game, state, ActionType.DeclareAttack, {
            kind: CombatKind.Assault,
            systemId: LUHMAN_16,
            defenderId: playerOf(hydrate(state), Faction.Givers),
            shipIds: ['praetorians-odyssey', 'praetorians-gladiator']
        })
    return withDice(
        campaignAtWar(Faction.Praetorians, (state) => {
            const praetorians = playerOf(state, Faction.Praetorians)
            placeWorlds(state, LUHMAN_16, [[is('m-2'), WorldSide.I]])
            placeBase(state, playerOf(state, Faction.Givers), LUHMAN_16, 2)
            placeShip(state, praetorians, 'praetorians-odyssey', LUHMAN_16)
            placeShip(state, praetorians, 'praetorians-gladiator', LUHMAN_16)
        }),
        assault,
        (played) => {
            const state = hydrate(played)
            return state.base(playerOf(state, Faction.Givers), LUHMAN_16) === undefined
        }
    )
}

/**
 * Every combat modifier at once, in a planetary assault at Luhman 16. The Praetorians (+1) own
 * Military Academy (+1), Enhanced Strength and Increased Body Size (+1 each on the ground); the
 * Givers own Hypersonic Missiles (-1 to assaults on them), Minefields (+3 defending), Subterranean
 * (-2 to ground attacks on them) and Reduced Body Size (-1 on the ground). Tunnel Complex lies
 * turned over there, -1 to whoever fights the Givers' base.
 */
function campaignCombatModifiers() {
    return guideExample((state) => {
        const praetorians = playerOf(state, Faction.Praetorians)
        const givers = playerOf(state, Faction.Givers)
        ownCard(state, praetorians, 'enhanced-strength')
        ownCard(state, praetorians, 'increased-body-size')
        for (const cardId of [
            'hypersonic-missiles',
            'minefields',
            'subterranean',
            'reduced-body-size'
        ]) {
            ownCard(state, givers, cardId)
        }
        state.systemState(LUHMAN_16).anomaly = 'tunnel-complex'
        state.systemState(LUHMAN_16).anomalyResolved = true
    })
}

/**
 * A fleet combat at Wolf 359 against the Givers' Sapphire, which attacked the Praetorians last
 * turn, so they may decline the escalation markers afterwards.
 */
function campaignDeclineEscalation() {
    return campaignAtWar(Faction.Praetorians, (state) => {
        const praetorians = playerOf(state, Faction.Praetorians)
        const givers = playerOf(state, Faction.Givers)
        placeShip(state, givers, 'consortium-sapphire', 'wolf-359')
        placeShip(state, praetorians, 'praetorians-centurion', 'wolf-359')
        state.attacks.push({ shipId: 'consortium-sapphire', targetId: praetorians, year: 2100 })
    })
}

/**
 * Ground combat at Alpha Centauri: the Starfarers' base of 12 against the Givers' base of 6,
 * with the Givers' Guildmaster and Sapphire there to join the defence.
 */
function campaignGroundCombat() {
    return campaignAtWar(Faction.Starfarers, (state) => {
        const givers = playerOf(state, Faction.Givers)
        placeWorlds(state, 'alpha-centauri', [[is('m-1'), WorldSide.I]])
        placeBase(state, playerOf(state, Faction.Starfarers), 'alpha-centauri', 12)
        placeBase(state, givers, 'alpha-centauri', 6)
        placeShip(state, givers, 'consortium-guildmaster', 'alpha-centauri')
        placeShip(state, givers, 'consortium-sapphire', 'alpha-centauri')
    })
}

/**
 * A Syndicate raid: the third faction plays the Syndicate, whose Viper is at Barnard's Star
 * beside the Givers' base of 4 holding Ore. The Givers hold markers of every type. The dice
 * give the result named.
 */
function campaignRaid(result) {
    // The raid's roll, from the declaration's history entry.
    const raid = (game, state) =>
        executeAll(
            game,
            state,
            userAction(game, state.activePlayerIds[0], ActionType.DeclareAttack, {
                kind: CombatKind.Raid,
                systemId: 'barnards-star',
                defenderId: playerOf(hydrate(state), Faction.Givers),
                shipIds: ['syndicate-viper']
            })
        ).processedActions.find((action) => action.type === ActionType.DeclareAttack).metadata.raid
    return withDice(
        campaignAtWar(Faction.Praetorians, (state) => {
            const raider = playerOf(state, Faction.Praetorians)
            state.getPlayerState(raider).faction = Faction.Syndicate
            for (const ship of state.shipsOf(raider)) {
                delete state.ships[ship.shipId]
            }
            const givers = playerOf(state, Faction.Givers)
            placeWorlds(state, 'barnards-star', [[ofClass('d-'), WorldSide.I]])
            const base = placeBase(state, givers, 'barnards-star', 4)
            base.goods = takeGoods(state, [TradeGood.Ore])
            placeShip(state, raider, 'syndicate-viper', 'barnards-star')
        }),
        raid,
        (roll) => raidResult(roll.total) === result
    )
}

/** An RE attack: the Praetorians' Centurion beside the Givers' Linnaeus at Procyon. */
function campaignExplorerAttack() {
    return campaignAtWar(Faction.Praetorians, (state) => {
        const linnaeus = state.ship('givers-linnaeus')
        linnaeus.systemId = 'procyon'
        linnaeus.transit = 0
        placeShip(state, playerOf(state, Faction.Praetorians), 'praetorians-centurion', 'procyon')
    })
}

/** The start of the campaign: each Player has drawn three directives to keep one. */
function campaignDirectiveChoice() {
    return startedGame(3, CAMPAIGN_CONFIG, { choosingDirectives: true })
}

/**
 * The cargo and trade turn (see Campaign trading) with the Starfarers ordered to sell 2 Ore on
 * Earth, and 2 Ore stored there.
 */
function campaignDirectiveTrade() {
    const { game, state, starfarers } = campaignTradeTurn()
    return {
        game,
        state: edit(state, (hydrated) => {
            giveDirective(hydrated, starfarers, 't3')
            hydrated
                .getPlayerState(starfarers)
                .earthGoods.push(...takeGoods(hydrated, [TradeGood.Ore]))
        })
    }
}

/**
 * Base production in 2110: the Starfarers' base of 12 at Alpha Centauri and base of 4 at Luhman
 * 16, ordered to earn $7B cash from base production.
 */
function campaignDirectiveProduction() {
    return campaignInto(EconomicTile.BaseProduction, 3, (state) => {
        const starfarers = playerOf(state, Faction.Starfarers)
        placeWorlds(state, 'alpha-centauri', [
            [is('m-1'), WorldSide.I],
            [ofClass('d-'), WorldSide.I]
        ])
        placeWorlds(state, 'luhman-16', [[ofClass('j-'), WorldSide.I]])
        placeBase(state, starfarers, 'alpha-centauri', 12)
        placeBase(state, starfarers, 'luhman-16', 4)
        giveDirective(state, starfarers, 'p4')
    })
}

/**
 * Combat in 2110: the Praetorians, ordered to start a fleet combat against the Player with the
 * most settlements, have the Centurion at Wolf 359 beside the Givers' Sapphire. The Givers have
 * the largest base, 6 at Alpha Centauri; the Starfarers have one of 2.
 */
function campaignDirectiveCombat() {
    return campaignAtWar(Faction.Praetorians, (state) => {
        const praetorians = playerOf(state, Faction.Praetorians)
        const givers = playerOf(state, Faction.Givers)
        placeWorlds(state, 'alpha-centauri', [[is('m-1'), WorldSide.I]])
        placeBase(state, givers, 'alpha-centauri', 6)
        placeBase(state, playerOf(state, Faction.Starfarers), 'alpha-centauri', 2)
        placeShip(state, givers, 'consortium-sapphire', 'wolf-359')
        placeShip(state, praetorians, 'praetorians-centurion', 'wolf-359')
        giveDirective(state, praetorians, 'c3')
    })
}

/** Exploration in 2100 with 2 IP for each Player, to redraw a directive in their Branch. */
function campaignDirectiveRedraw() {
    const { game, state } = startedGame(3, CAMPAIGN_CONFIG)
    return {
        game,
        state: edit(state, (hydrated) => {
            for (const player of hydrated.players) {
                player.influence = 2
            }
        })
    }
}

/**
 * Development in 2100: the first Player is ordered to survey Procyon, which is already fully
 * surveyed.
 */
function campaignDirectiveSurveyed() {
    const { game, state } = startedGame(3, CAMPAIGN_CONFIG)
    const ready = edit(state, (hydrated) => {
        giveDirective(hydrated, hydrated.initiativeOrder()[0], 's4')
        hydrated.systemState('procyon').explorationMarker = 0
    })
    return { game, state: advanceTo(game, ready, TurnPhase.Development) }
}

/**
 * Exploration in 2100: the Starfarers, ordered to resolve a science anomaly of 9+ difficulty, are
 * attempting Terran DNA at Alpha Centauri (printed 8, +3 Players, -1 for the Starfarers: 10).
 */
function campaignDirectiveAnomaly() {
    const { game, state } = startedGame(3, CAMPAIGN_CONFIG)
    return {
        game,
        state: edit(state, (hydrated) => {
            const starfarers = playerOf(hydrated, Faction.Starfarers)
            giveDirective(hydrated, starfarers, 'a6')
            placeWorlds(hydrated, 'alpha-centauri', [[is('m-1'), WorldSide.I]])
            hydrated.anomalyPool.splice(hydrated.anomalyPool.indexOf('terran-dna'), 1)
            hydrated.systemState('alpha-centauri').anomaly = 'terran-dna'
            hydrated.getPlayerState(starfarers).anomalyAttempts.push({
                systemId: 'alpha-centauri',
                anomalyId: 'terran-dna',
                shipIds: []
            })
        })
    }
}

/**
 * The cargo and trade turn (see Campaign trading) on the Main Line, the Starfarers with 2 IP to
 * redraw their directive there.
 */
function campaignDirectiveMainLineRedraw() {
    const { game, state, starfarers } = campaignTradeTurn()
    return {
        game,
        state: edit(state, (hydrated) => {
            hydrated.getPlayerState(starfarers).influence = 2
        })
    }
}

/**
 * Exploration in 2100: the Starfarers, ordered to complete a survey at Procyon, have a survey of
 * it waiting to resolve once everyone has explored.
 */
function campaignDirectiveSurvey() {
    const { game, state } = startedGame(3, CAMPAIGN_CONFIG)
    return {
        game,
        state: edit(state, (hydrated) => {
            const starfarers = playerOf(hydrated, Faction.Starfarers)
            giveDirective(hydrated, starfarers, 's4')
            const [ship] = hydrated.shipsOf(starfarers)
            hydrated
                .getPlayerState(starfarers)
                .pendingSurveys.push({ shipId: ship.shipId, systemId: 'procyon' })
        })
    }
}

/**
 * Terraforming in 2110: the Givers, ordered to terraform a world into O or M-class, own
 * Terraforming and a base at Alpha Centauri, whose one world is an L-class already on side II.
 * The world pool holds only an O-class world it may be replaced with.
 */
function campaignDirectiveTerraform() {
    return campaignInto(EconomicTile.Terraforming, 3, (state) => {
        const givers = playerOf(state, Faction.Givers)
        state.getPlayerState(givers).techs.push({ techId: TechId.Terraforming, year: 2090 })
        const tiles = [...state.worldPool, ...state.setAsideWorlds]
        const ofWorldClass = (worldClass) =>
            tiles.filter((tileId) => worldTile(tileId).worldClass === worldClass)
        const [world, replacement] = ofWorldClass(WorldClass.L)
            .flatMap((tileId) => {
                const current = maxPopulation(tileId, WorldSide.II)
                const fits = ofWorldClass(WorldClass.O).find((candidate) => {
                    const population = maxPopulation(candidate, WorldSide.I)
                    return population > current && population <= current + TERRAFORM_POPULATION_STEP
                })
                return fits ? [[tileId, fits]] : []
            })
            .at(0)
        placeWorlds(state, 'alpha-centauri', [[is(world), WorldSide.II]])
        placeBase(state, givers, 'alpha-centauri', 8)
        // The rest of the pool waits set aside, so the terraform draws the O-class world.
        state.setAsideWorlds = [...state.setAsideWorlds, ...state.worldPool].filter(
            (tileId) => tileId !== replacement
        )
        state.worldPool = [replacement]
        giveDirective(state, givers, 'tf2')
    })
}

/**
 * Exploration in 2100: the Givers, whose goal is 2 terraform directives, have fulfilled one
 * terraform and one survey directive.
 */
function campaignDirectiveGoal() {
    const { game, state } = startedGame(3, CAMPAIGN_CONFIG)
    return {
        game,
        state: edit(state, (hydrated) => {
            const givers = playerOf(hydrated, Faction.Givers)
            const player = hydrated.getPlayerState(givers)
            for (const directiveId of ['tf1', 's9']) {
                giveDirective(hydrated, givers, directiveId)
                player.heldDirectives = []
                player.fulfilledDirectives.push({ playerId: givers, directiveId, year: 2090 })
            }
            giveDirective(hydrated, givers, hydrated.directivePile.directives[0])
        })
    }
}

// Moves escalation markers from the pool to a Player.
function giveEscalation(state, playerId, markers) {
    for (const marker of markers) {
        state.escalationPool.splice(state.escalationPool.indexOf(marker), 1)
        state.getPlayerState(playerId).escalation.push(marker)
    }
}

// Lays a title out, from the pool if it was not drawn at the start.
function layOutTitle(state, titleId) {
    if (!state.availableTitles.includes(titleId)) {
        state.titlePool = state.titlePool.filter((pooled) => pooled !== titleId)
        state.availableTitles.push(titleId)
    }
}

/**
 * The cargo and trade turn (see Campaign trading) on the Main Line: the Starfarers have 3 Ore on
 * Earth and 9 IP, and Guildmaster is laid out.
 */
function campaignTitleGuildmaster() {
    const { game, state, starfarers } = campaignTradeTurn()
    return {
        game,
        state: edit(state, (hydrated) => {
            layOutTitle(hydrated, TitleId.Guildmaster)
            const player = hydrated.getPlayerState(starfarers)
            player.influence = 9
            player.earthGoods.push(...takeGoods(hydrated, [TradeGood.Ore, TradeGood.Ore]))
        })
    }
}

/** Development in 2100, every Player with 20 IP: enough for Chancellor, which only one can have. */
function campaignTitleRace() {
    const { game, state } = startedGame(3, CAMPAIGN_CONFIG)
    const ready = edit(state, (hydrated) => {
        for (const player of hydrated.players) {
            player.influence = 20
        }
    })
    return { game, state: advanceTo(game, ready, TurnPhase.Development) }
}

/**
 * The cargo and trade turn (see Campaign trading) on the Main Line: the Starfarers own Chancellor
 * and Navigator, hold 6 escalation markers and 30 IP.
 */
function campaignTitleWarlord() {
    const { game, state, starfarers } = campaignTradeTurn()
    return {
        game,
        state: edit(state, (hydrated) => {
            const player = hydrated.getPlayerState(starfarers)
            player.influence = 30
            giveEscalation(hydrated, starfarers, [
                EscalationMarker.Points1,
                EscalationMarker.Points1,
                EscalationMarker.Points2,
                EscalationMarker.Points2,
                EscalationMarker.Points3,
                EscalationMarker.Points3
            ])
            for (const titleId of [TitleId.Chancellor, TitleId.Navigator]) {
                layOutTitle(hydrated, titleId)
                hydrated.availableTitles = hydrated.availableTitles.filter(
                    (available) => available !== titleId
                )
                player.titles.push(titleId)
            }
        })
    }
}

/**
 * Combat in 2110: the Praetorians own Admiral and hold 2 escalation markers. Their Centurion is
 * at Wolf 359 beside the Givers' Sapphire (the Givers hold 3 markers) and their Gladiator at
 * Luhman 16 beside the Starfarers' Polaris and base of 4 (the Starfarers hold 1).
 */
function campaignTitleAdmiral() {
    return campaignAtWar(Faction.Praetorians, (state) => {
        const praetorians = playerOf(state, Faction.Praetorians)
        const givers = playerOf(state, Faction.Givers)
        const starfarers = playerOf(state, Faction.Starfarers)
        state.availableTitles = state.availableTitles.filter(
            (titleId) => titleId !== TitleId.Admiral
        )
        state.getPlayerState(praetorians).titles.push(TitleId.Admiral)
        giveEscalation(state, praetorians, [EscalationMarker.Points1, EscalationMarker.Points1])
        giveEscalation(state, givers, [
            EscalationMarker.Points2,
            EscalationMarker.Points2,
            EscalationMarker.Points2
        ])
        giveEscalation(state, starfarers, [EscalationMarker.Points3])
        placeShip(state, givers, 'consortium-sapphire', 'wolf-359')
        placeShip(state, praetorians, 'praetorians-centurion', 'wolf-359')
        placeWorlds(state, LUHMAN_16, [[is('m-2'), WorldSide.I]])
        placeBase(state, starfarers, LUHMAN_16, 4)
        placeShip(state, starfarers, 'starfarers-polaris', LUHMAN_16)
        placeShip(state, praetorians, 'praetorians-gladiator', LUHMAN_16)
    })
}

/**
 * Initiative in 2110 with escalation markers: the Starfarers hold four of three kinds and 2 IP,
 * the Givers two different ones and no IP, the Praetorians a single one.
 */
function campaignEscalationDiscard() {
    return campaignInto(EconomicTile.RollInitiative, 3, (state) => {
        const starfarers = playerOf(state, Faction.Starfarers)
        state.getPlayerState(starfarers).influence = 2
        giveEscalation(state, starfarers, [
            EscalationMarker.Points4,
            EscalationMarker.Initiative20,
            EscalationMarker.Initiative20,
            EscalationMarker.EarthEngineering
        ])
        giveEscalation(state, playerOf(state, Faction.Givers), [
            EscalationMarker.Points2,
            EscalationMarker.NoAttack
        ])
        giveEscalation(state, playerOf(state, Faction.Praetorians), [EscalationMarker.Points3])
    })
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
write('campaign-blockade', 'Campaign: a blockade', campaignBlockade())
write('campaign-blockade-growth', 'Campaign: a blockade before growth', campaignBlockadeGrowth())
write('campaign-escalation-discard', 'Campaign: discarding escalation', campaignEscalationDiscard())
write(
    'campaign-empty-escalation-pool',
    'Campaign: an empty escalation pool',
    campaignEmptyEscalationPool()
)
write('campaign-truce-roll', 'Campaign: the truce roll', campaignTruceRoll())
write('campaign-assault', 'Campaign: a planetary assault', campaignAssault())
write('campaign-hits', 'Campaign: crippling and destroying ships', campaignHits())
write('campaign-base-eliminated', 'Campaign: a base eliminated', campaignBaseEliminated())
write('campaign-combat-modifiers', 'Campaign: every combat modifier', campaignCombatModifiers())
write('campaign-decline-escalation', 'Campaign: declining escalation', campaignDeclineEscalation())
write('campaign-ground-combat', 'Campaign: ground combat', campaignGroundCombat())
write('campaign-raid-cash', 'Campaign: a raid stealing $1B', campaignRaid(RaidResult.StealCash))
write(
    'campaign-raid-more-cash',
    'Campaign: a raid stealing $2B',
    campaignRaid(RaidResult.StealMoreCash)
)
write(
    'campaign-raid-marker',
    'Campaign: a raid stealing a marker',
    campaignRaid(RaidResult.StealMarker)
)
write('campaign-raid-good', 'Campaign: a raid taking a good', campaignRaid(RaidResult.TakeGood))
write(
    'campaign-raid-settlement',
    'Campaign: a raid destroying a settlement',
    campaignRaid(RaidResult.DestroySettlement)
)
write('campaign-explorer-attack', 'Campaign: destroying an RE', campaignExplorerAttack())
write('campaign-directive-choice', 'Campaign: choosing a directive', campaignDirectiveChoice())
write('campaign-directive-trade', 'Campaign: a trade directive', campaignDirectiveTrade())
write(
    'campaign-directive-production',
    'Campaign: a production directive',
    campaignDirectiveProduction()
)
write('campaign-directive-combat', 'Campaign: a combat directive', campaignDirectiveCombat())
write('campaign-directive-anomaly', 'Campaign: an anomaly directive', campaignDirectiveAnomaly())
write('campaign-directive-redraw', 'Campaign: redrawing a directive', campaignDirectiveRedraw())
write(
    'campaign-directive-surveyed',
    'Campaign: a surveyed system’s directive',
    campaignDirectiveSurveyed()
)
write(
    'campaign-directive-main-line-redraw',
    'Campaign: redrawing a directive on the Main Line',
    campaignDirectiveMainLineRedraw()
)
write('campaign-directive-survey', 'Campaign: a survey directive', campaignDirectiveSurvey())
write(
    'campaign-directive-terraform',
    'Campaign: a terraform directive',
    campaignDirectiveTerraform()
)
write('campaign-directive-goal', 'Campaign: the directive goal', campaignDirectiveGoal())
write(
    'campaign-title-guildmaster',
    'Campaign: earning and buying a title',
    campaignTitleGuildmaster()
)
write('campaign-title-race', 'Campaign: two Players after one title', campaignTitleRace())
write('campaign-title-warlord', 'Campaign: becoming Warlord', campaignTitleWarlord())
write('campaign-title-admiral', 'Campaign: an Admiral at war', campaignTitleAdmiral())

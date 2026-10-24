import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { CARDS, CARD_DECKS, CardDeck, cardDefinition, deckCards } from '../components/cards.js'
import { Faction } from '../components/factions.js'
import { ScenarioId } from '../components/scenarios.js'
import { TechField } from '../components/techFields.js'
import { TechId } from '../components/techs.js'
import { WorldClass } from '../components/worldTypes.js'
import { WorldSide } from '../components/worlds.js'
import { hydrate, placeBase, placeShip, startedGame, takeTile } from '../testing/fixtures.js'
import { anomalyChance, anomalyStrength, challengeDifficulty } from './anomalies.js'
import { AnomalyChallenge } from '../components/anomalies.js'
import { buildCost, cloningCost, shipCost } from './building.js'
import { maxShips } from './campaign.js'
import {
    cardCost,
    cardPile,
    cardUnavailability,
    CardUnavailable,
    drawCard,
    earnRewardCard,
    holdsOrOwns,
    isCardAvailable,
    recountPile,
    RewardCardOutcome
} from './cards.js'
import { techCost } from './development.js'
import {
    cardGrowth,
    growSettlements,
    growthChoiceBases,
    queueConversions,
    systemPopulationLimit
} from './economy.js'
import { capabilitiesOf, crippledThreshold, isCrippled } from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { travelTime } from './movement.js'
import { campaignScore, rollForEnd } from './scoring.js'
import { settlementPurchaseCost } from './settling.js'
import { assignmentSystems, canAssignToEarth, salePrice } from './trade.js'
import { drawDemand } from './demand.js'
import { TradeGood } from '../components/tradeGoods.js'
import { terraformsAllowed } from './terraforming.js'

function campaign(): HydratedStellarHorizonsGameState {
    return hydrate(startedGame(4, { scenario: ScenarioId.Campaign }).state)
}

function playerOf(state: HydratedStellarHorizonsGameState, faction: Faction): string {
    const player = state.players.find((candidate) => candidate.faction === faction)
    if (!player) {
        throw new Error(`No ${faction}`)
    }
    return player.playerId
}

// A card bought the turn before, so its discounts count.
function own(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    cardId: string,
    year = state.year - 10,
    bought = true
) {
    const definition = cardDefinition(cardId)
    const pile = cardPile(state, definition.deck, definition.level)
    const index = pile.cards.indexOf(cardId)
    if (index >= 0) {
        pile.cards.splice(index, 1)
        recountPile(pile)
    }
    state.getPlayerState(playerId).cards.push({ cardId, year, bought })
}

function hold(state: HydratedStellarHorizonsGameState, playerId: string, cardId: string) {
    const definition = cardDefinition(cardId)
    const pile = cardPile(state, definition.deck, definition.level)
    pile.cards.splice(pile.cards.indexOf(cardId), 1)
    recountPile(pile)
    state.getPlayerState(playerId).hand.push({
        playerId,
        deck: definition.deck,
        level: definition.level,
        cardId
    })
}

describe('The card catalog', () => {
    it('holds 35 fleet improvements of 28 kinds and 35 genetic manipulations in three levels', () => {
        const count = (deck: CardDeck, level?: 1 | 2 | 3) =>
            [1, 2, 3]
                .filter((candidate) => level === undefined || candidate === level)
                .reduce(
                    (total, candidate) => total + deckCards(deck, candidate as 1 | 2 | 3).length,
                    0
                )
        expect([1, 2, 3].map((level) => count(CardDeck.Fleet, level as 1 | 2 | 3))).toEqual([
            15, 12, 8
        ])
        expect([1, 2, 3].map((level) => count(CardDeck.Genetic, level as 1 | 2 | 3))).toEqual([
            17, 10, 8
        ])
        expect(CARDS.filter((card) => card.deck === CardDeck.Fleet)).toHaveLength(28)
        expect(CARDS.filter((card) => card.deck === CardDeck.Genetic)).toHaveLength(35)
    })

    it('reads the star as points and the circle as the cost in its colour’s tech type', () => {
        expect(cardDefinition('planetary-surveys')).toMatchObject({
            points: 3,
            cost: 9,
            field: TechField.Physics
        })
        expect(cardDefinition('crew-focus').field).toBe(TechField.Engineering)
        expect(
            CARDS.filter((card) => card.deck === CardDeck.Genetic).map((card) => card.field)
        ).toEqual(
            CARDS.filter((card) => card.deck === CardDeck.Genetic).map(() => TechField.Biology)
        )
        expect(cardDefinition('stabilized-wormholes')).toMatchObject({ cost: 50, points: 9 })
    })
})

describe('Hands', () => {
    it('are dealt at setup: a level I card of each type, two fleet for the Praetorians', () => {
        const state = campaign()
        for (const player of state.players) {
            const fleet = player.handCards(CardDeck.Fleet)
            const genetic = player.handCards(CardDeck.Genetic)
            expect(fleet).toHaveLength(player.faction === Faction.Praetorians ? 2 : 1)
            expect(genetic).toHaveLength(1)
            expect([...fleet, ...genetic].every((card) => card.level === 1)).toBe(true)
            expect(new Set(player.hand.map((card) => card.cardId)).size).toBe(player.hand.length)
        }
        const dealt = state.players.reduce((total, player) => total + player.hand.length, 0)
        const left = CARD_DECKS.reduce(
            (total, deck) => total + cardPile(state, deck, 1).remaining,
            0
        )
        const discarded = CARD_DECKS.reduce(
            (total, deck) => total + cardPile(state, deck, 1).discarded,
            0
        )
        expect(dealt + left + discarded).toBe(15 + 17)
    })

    it('never take a copy of a card the Player holds or owns: it is discarded instead', () => {
        const state = campaign()
        const playerId = playerOf(state, Faction.Starfarers)
        const pile = cardPile(state, CardDeck.Fleet, 1)
        const copy = pile.cards.find((cardId) => cardDefinition(cardId).copies > 1)
        if (!copy) {
            throw new Error('A level I fleet card with copies is in the deck')
        }
        own(state, playerId, copy)
        pile.cards = [copy]
        recountPile(pile)
        state.getPlayerState(playerId).cardDraws = [CardDeck.Fleet]
        expect(drawCard(state, playerId, CardDeck.Fleet, 1)).toEqual({ cardId: copy, kept: false })
        expect(state.getPlayerState(playerId).cardDraws).toEqual([CardDeck.Fleet])
        expect(pile.discards).toEqual([copy])
        expect(holdsOrOwns(state, playerId, copy)).toBe(true)
    })
})

describe('Buying cards', () => {
    it('costs +5 for each card of its type and level owned, +3 for a favoured deck, never under 5', () => {
        const state = campaign()
        const starfarers = playerOf(state, Faction.Starfarers)
        const praetorians = playerOf(state, Faction.Praetorians)
        expect(cardCost(state, starfarers, 'scout-ships')).toBe(12)
        own(state, starfarers, 'robo-miners')
        own(state, starfarers, 'crew-focus')
        expect(cardCost(state, starfarers, 'scout-ships')).toBe(22)
        expect(cardCost(state, starfarers, 'deep-core-mining')).toBe(15)
        own(state, praetorians, 'robo-miners')
        expect(cardCost(state, praetorians, 'scout-ships')).toBe(15)
        own(state, praetorians, 'military-academy')
        own(state, praetorians, 'neural-interface')
        expect(cardCost(state, praetorians, 'minefields')).toBe(5)
    })

    it('takes card discounts only from cards not bought this turn', () => {
        const state = campaign()
        const playerId = playerOf(state, Faction.Givers)
        own(state, playerId, 'science-academy', state.year)
        own(state, playerId, 'skilled-biologists', state.year)
        // Skilled Biologists is a genetic manipulation I, so it adds 5 to another.
        expect(cardCost(state, playerId, 'radiation-tolerance')).toBe(14)
        expect(techCost(state, playerId, TechId.Terraforming)).toBe(10)
        state.getPlayerState(playerId).cards.forEach((card) => (card.year -= 10))
        expect(cardCost(state, playerId, 'radiation-tolerance')).toBe(9)
        expect(techCost(state, playerId, TechId.Terraforming)).toBe(7)
    })

    it('takes discounts at once from a card earned this turn', () => {
        const state = campaign()
        const playerId = playerOf(state, Faction.Givers)
        own(state, playerId, 'skilled-biologists', state.year, false)
        expect(techCost(state, playerId, TechId.Terraforming)).toBe(7)
    })

    it('counts as the purchase of its tech type and keeps the body sizes apart', () => {
        const state = campaign()
        const playerId = playerOf(state, Faction.Givers)
        hold(state, playerId, 'reduced-body-size')
        expect(isCardAvailable(state, playerId, 'reduced-body-size')).toBe(true)
        own(state, playerId, 'increased-body-size')
        expect(cardUnavailability(state, playerId, 'reduced-body-size')).toBe(
            CardUnavailable.Excluded
        )
        state.getPlayerState(playerId).cards = []
        state.getPlayerState(playerId).fieldsDeveloped.push(TechField.Biology)
        expect(cardUnavailability(state, playerId, 'reduced-body-size')).toBe(
            CardUnavailable.TypeBought
        )
        expect(cardUnavailability(state, playerId, 'skilled-biologists')).toBe(
            CardUnavailable.NotHeld
        )
    })
})

describe('The anomaly card reward', () => {
    it('earns the drawn level I card, discards one already owned, and takes one from the hand', () => {
        const state = campaign()
        const playerId = playerOf(state, Faction.Givers)
        const pile = cardPile(state, CardDeck.Fleet, 1)
        pile.cards = ['robo-miners']
        recountPile(pile)
        expect(earnRewardCard(state, playerId, CardDeck.Fleet).outcome).toBe(
            RewardCardOutcome.Earned
        )
        expect(state.getPlayerState(playerId).ownsCard('robo-miners')).toBe(true)
        expect(earnRewardCard(state, playerId, CardDeck.Fleet).outcome).toBe(
            RewardCardOutcome.DeckEmpty
        )
        pile.cards = ['robo-miners']
        recountPile(pile)
        expect(earnRewardCard(state, playerId, CardDeck.Fleet).outcome).toBe(
            RewardCardOutcome.AlreadyOwned
        )
        expect(pile.discards).toEqual(['robo-miners'])

        const [held] = state.getPlayerState(playerId).handCards(CardDeck.Genetic)
        const genetic = cardPile(state, CardDeck.Genetic, 1)
        assertExists(held.cardId)
        genetic.cards = [held.cardId]
        recountPile(genetic)
        expect(earnRewardCard(state, playerId, CardDeck.Genetic).outcome).toBe(
            RewardCardOutcome.FromHand
        )
        expect(state.getPlayerState(playerId).handCards(CardDeck.Genetic)).toEqual([])
        expect(state.getPlayerState(playerId).cardDraws).toEqual([CardDeck.Genetic])
    })
})

describe('Card effects', () => {
    it('change ship costs, which also set the base size a build needs', () => {
        const state = campaign()
        const playerId = playerOf(state, Faction.Starfarers)
        const cv = 'starfarers-orion'
        expect(shipCost(state, playerId, cv)).toBe(7)
        own(state, playerId, 'crew-focus')
        own(state, playerId, 'engine-upgrades')
        // Orion is printed fast, so Engine Upgrades take $2B more off.
        expect(shipCost(state, playerId, cv)).toBe(3)
        expect(buildCost(state, playerId, cv, 'sol')).toBe(3)
    })

    it('raise the ship cap, Robotic Swarms’ extra only for an RE', () => {
        const state = campaign()
        const playerId = playerOf(state, Faction.Starfarers)
        const printed = maxShips(state, playerId)
        own(state, playerId, 'fleet-logistics')
        own(state, playerId, 'robotic-swarms')
        expect(maxShips(state, playerId)).toBe(printed + 2)
    })

    it('let CVs take one more damage, crippling at half the new capacity', () => {
        const state = campaign()
        const playerId = playerOf(state, Faction.Starfarers)
        // Orion is a CV 2: crippled at 1 damage, and at 2 (half of 3, rounded up) with the card.
        const ship = placeShip(state, playerId, 'starfarers-orion', 'sol', { damage: 1 })
        expect(isCrippled(state, ship)).toBe(true)
        own(state, playerId, 'reinforced-hulls')
        expect(crippledThreshold(state, ship)).toBe(2)
        expect(isCrippled(state, ship)).toBe(false)
    })

    it('add up with techs and each other', () => {
        const state = campaign()
        const playerId = playerOf(state, Faction.Givers)
        state
            .getPlayerState(playerId)
            .techs.push({ techId: TechId.InterstellarLogistics, year: 2090 })
        own(state, playerId, 'scout-ships')
        own(state, playerId, 'science-academy')
        expect(capabilitiesOf(state, playerId).cvExplorationBonus).toBe(3)
        own(state, playerId, 'robo-miners')
        own(state, playerId, 'deep-core-mining')
        own(state, playerId, 'interstellar-mining-conglomerate')
        expect(capabilitiesOf(state, playerId).cashProduction).toBe(5)
        own(state, playerId, 'radiation-tolerance')
        own(state, playerId, 'zero-g-tolerance')
        expect(capabilitiesOf(state, playerId).populationByClass[WorldClass.J]).toBe(15)
    })

    it('lower anomaly difficulty, raise strength and the chance of finding one', () => {
        const state = campaign()
        const playerId = playerOf(state, Faction.Starfarers)
        const before = challengeDifficulty(state, 8, AnomalyChallenge.Science, playerId)
        own(state, playerId, 'cunning')
        own(state, playerId, 'science-academy')
        expect(challengeDifficulty(state, 8, AnomalyChallenge.Science, playerId)).toBe(before - 4)
        const chance = anomalyChance(state, playerId, 'starfarers-orion') ?? 0
        own(state, playerId, 'scout-ships')
        expect(anomalyChance(state, playerId, 'starfarers-orion')).toBe(chance + 5)
        expect(anomalyChance(state, playerId, 'starfarers-kepler')).toBe(chance)
        const ship = placeShip(state, playerId, 'starfarers-orion', 'sol')
        expect(anomalyStrength(state, ship, AnomalyChallenge.Combat)).toBe(3)
        own(state, playerId, 'hypersonic-missiles')
        expect(anomalyStrength(state, ship, AnomalyChallenge.Combat)).toBe(4)
    })

    it('change population limits and growth for their owner only', () => {
        const state = campaign()
        const playerId = playerOf(state, Faction.Givers)
        const other = playerOf(state, Faction.Starfarers)
        const system = 'alpha-centauri'
        state.systemState(system).worlds = [
            { tileId: takeTile(state, (id) => id.startsWith('o-')), side: WorldSide.I }
        ]
        placeBase(state, playerId, system, 3)
        const limit = systemPopulationLimit(state, playerId, system)
        const otherLimit = systemPopulationLimit(state, other, system)
        own(state, playerId, 'aquatic-tolerance')
        own(state, playerId, 'aquatic-species')
        own(state, playerId, 'natural-immortality')
        expect(systemPopulationLimit(state, playerId, system)).toBe(limit + 25)
        expect(systemPopulationLimit(state, other, system)).toBe(otherLimit)
        expect(cardGrowth(state, playerId, system)).toBe(4)
        const dwarf = 'barnards-star'
        state.systemState(dwarf).worlds = [
            { tileId: takeTile(state, (id) => id.startsWith('l-')), side: WorldSide.I }
        ]
        own(state, other, 'infrared-vision')
        expect(cardGrowth(state, other, dwarf)).toBe(1)
        expect(cardGrowth(state, other, system)).toBe(0)
    })

    it('grow a chosen base with Prolific Breeders, at once when only one can grow', () => {
        const state = campaign()
        const playerId = playerOf(state, Faction.Givers)
        state.systemState('alpha-centauri').worlds = [
            { tileId: takeTile(state, (id) => id.startsWith('m-')), side: WorldSide.I }
        ]
        placeBase(state, playerId, 'alpha-centauri', 3)
        own(state, playerId, 'prolific-breeders')
        expect(growthChoiceBases(state, playerId)).toEqual(['alpha-centauri'])
        const { chosen } = growSettlements(state)
        expect(chosen).toEqual([{ playerId, systemId: 'alpha-centauri', settlements: 1 }])
        expect(state.growthChoosers).toEqual([])
    })

    it('queue a conversion roll each for the True Path and Cultural Dominance', () => {
        const state = campaign()
        const truePath = playerOf(state, Faction.TruePath)
        const givers = playerOf(state, Faction.Givers)
        placeBase(state, truePath, 'alpha-centauri', 3)
        placeBase(state, givers, 'alpha-centauri', 3)
        own(state, givers, 'cultural-dominance')
        queueConversions(state)
        expect(state.conversions).toEqual(
            state
                .initiativeOrder()
                .filter((id) => id === truePath || id === givers)
                .map((id) => ({ playerId: id, roll: id === truePath ? 4 : 3 }))
        )
    })

    it('draw more trade goods, let goods be produced anywhere and sell them for more', () => {
        const state = campaign()
        const playerId = playerOf(state, Faction.Givers)
        state.systemState('alpha-centauri').worlds = [
            { tileId: takeTile(state, (id) => id.startsWith('d-')), side: WorldSide.I }
        ]
        placeBase(state, playerId, 'alpha-centauri', 3)
        expect(assignmentSystems(state, playerId, TradeGood.FineArt)).toEqual([])
        expect(canAssignToEarth(state, playerId, TradeGood.FineArt)).toBe(false)
        const price = salePrice(state, 'alpha-centauri', TradeGood.FineArt, playerId)
        own(state, playerId, 'gifted-artists')
        expect(assignmentSystems(state, playerId, TradeGood.FineArt)).toEqual(['alpha-centauri'])
        expect(canAssignToEarth(state, playerId, TradeGood.FineArt)).toBe(false)
        expect(salePrice(state, 'alpha-centauri', TradeGood.FineArt, playerId)).toBe(price + 1)
        expect(capabilitiesOf(state, playerId).extraGoods).toBe(1)
        own(state, playerId, 'culinary-geniuses')
        expect(canAssignToEarth(state, playerId, TradeGood.Beverages)).toBe(true)
    })

    it('keep two demand markers with Starports, and draw one more to choose from with the Guild', () => {
        const state = campaign()
        const playerId = playerOf(state, Faction.Givers)
        own(state, playerId, 'starports')
        own(state, playerId, 'traders-guild')
        placeBase(state, playerId, 'alpha-centauri', 3)
        drawDemand(state, playerId, 'alpha-centauri')
        expect(state.demandDraws).toEqual([
            expect.objectContaining({ systemId: 'alpha-centauri', keep: 2 })
        ])
        expect(state.demandDraws[0].drawn).toHaveLength(3)
    })

    it('price settlements with Pioneers and Spacefaring Populace, never under $1B', () => {
        const state = campaign()
        const playerId = playerOf(state, Faction.TruePath)
        state.getPlayerState(playerId).techs.push({ techId: TechId.TerranExodus, year: 2090 })
        expect(settlementPurchaseCost(state, playerId, 2)).toBe(4)
        own(state, playerId, 'spacefaring-populace')
        own(state, playerId, 'pioneers')
        expect(settlementPurchaseCost(state, playerId, 1)).toBe(1)
        expect(settlementPurchaseCost(state, playerId, 2)).toBe(2)
    })

    it('make cloning $3B with Cyborg Species', () => {
        const state = campaign()
        const playerId = playerOf(state, Faction.Givers)
        expect(cloningCost(state, playerId)).toBe(5)
        own(state, playerId, 'cyborg-species')
        expect(cloningCost(state, playerId)).toBe(3)
    })

    it('add Planetary Engineering’s terraform only to the tech’s', () => {
        const state = campaign()
        const playerId = playerOf(state, Faction.Starfarers)
        own(state, playerId, 'planetary-engineering')
        expect(terraformsAllowed(state, playerId)).toBe(0)
        state.getPlayerState(playerId).techs.push({ techId: TechId.Terraforming, year: 2090 })
        expect(terraformsAllowed(state, playerId)).toBe(2)
        expect(capabilitiesOf(state, playerId).terraformDraws).toBe(2)
        const givers = playerOf(state, Faction.Givers)
        own(state, givers, 'planetary-engineering')
        expect(terraformsAllowed(state, givers)).toBe(1)
    })

    it('make bases one hex apart with Stabilized Wormholes', () => {
        const state = campaign()
        const playerId = playerOf(state, Faction.Starfarers)
        placeBase(state, playerId, 'alpha-centauri', 10)
        placeBase(state, playerId, 'vega', 10)
        const ship = placeShip(state, playerId, 'starfarers-kepler', 'alpha-centauri')
        const before = travelTime(state, ship, 'vega')
        own(state, playerId, 'stabilized-wormholes')
        expect(travelTime(state, ship, 'vega')).toBeLessThan(before)
    })

    it('let Transcend Biology move the end roll’s chance by 3%', () => {
        const state = campaign()
        const playerId = playerOf(state, Faction.Givers)
        state.year = 2500
        const roll = rollForEnd(state)
        own(state, playerId, 'transcend-biology')
        state.getPlayerState(playerId).endRollModifier = 3
        const modified = rollForEnd(state)
        expect(modified?.chance).toBe((roll?.chance ?? 0) + 3)
        expect(modified?.modifier).toEqual({ playerId, amount: 3 })
    })

    it('score the points printed on owned cards', () => {
        const state = campaign()
        const playerId = playerOf(state, Faction.Givers)
        const before = campaignScore(state, playerId).total
        own(state, playerId, 'transcend-biology')
        own(state, playerId, 'crew-focus')
        expect(campaignScore(state, playerId).cards).toBe(16)
        expect(campaignScore(state, playerId).total).toBe(before + 16)
    })
})

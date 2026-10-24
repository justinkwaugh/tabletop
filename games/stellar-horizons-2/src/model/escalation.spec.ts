import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    ESCALATION_MARKERS,
    EscalationMarker,
    escalationPoints,
    fullEscalationPool
} from '../components/escalation.js'
import { Faction } from '../components/factions.js'
import { centuryRow } from '../components/factionSheets.js'
import { ScenarioId } from '../components/scenarios.js'
import { TechField } from '../components/techFields.js'
import { TradeGood } from '../components/tradeGoods.js'
import { WorldSide } from '../components/worlds.js'
import { hydrate, placeBase, placeShip, startedGame } from '../testing/fixtures.js'
import {
    blockadeDefence,
    blockadeSystems,
    canBlockade,
    declareBlockade,
    queueBlockades
} from './blockades.js'
import { produceAtEarth } from './campaign.js'
import { growSettlements, migrationChance, productionYield } from './economy.js'
import {
    canAttack,
    choosesEscalationKept,
    discardDrawnEscalation,
    discardEscalation,
    drawEscalation,
    escalationKeepCount,
    isValidEscalationKept,
    rollForTruce,
    truceChance
} from './escalation.js'
import { capabilitiesOf, combatValue } from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { BlockadeStep, CASH_PRODUCTION } from './pieces.js'
import { campaignScore } from './scoring.js'
import { settlementPurchaseCost } from './settling.js'
import { salePrice } from './trade.js'
import { TechId } from '../components/techs.js'

const SYSTEM = 'alpha-centauri'

function campaign(): HydratedStellarHorizonsGameState {
    return hydrate(startedGame(4, { scenario: ScenarioId.Campaign }).state)
}

function playerOf(state: HydratedStellarHorizonsGameState, faction: Faction): string {
    const player = state.players.find((candidate) => candidate.faction === faction)
    assertExists(player, `Nobody plays ${faction}`)
    return player.playerId
}

function own(state: HydratedStellarHorizonsGameState, playerId: string, cardId: string) {
    state.getPlayerState(playerId).cards.push({ cardId, year: 2090, bought: false })
}

// The Praetorians' Gladiator (8) and Odyssey (6) at Alpha Centauri, after the truce.
function atWar() {
    const state = campaign()
    state.truce = false
    const praetorians = playerOf(state, Faction.Praetorians)
    const givers = playerOf(state, Faction.Givers)
    const truePath = playerOf(state, Faction.TruePath)
    state.systemState(SYSTEM).worlds = [{ tileId: 'm-1', side: WorldSide.I }]
    placeShip(state, praetorians, 'praetorians-gladiator', SYSTEM)
    placeShip(state, praetorians, 'praetorians-odyssey', SYSTEM)
    return { state, praetorians, givers, truePath }
}

describe('Escalation markers', () => {
    it('are the 39 printed counters, the numbered ones points and the red ones -1', () => {
        expect(fullEscalationPool()).toHaveLength(39)
        expect(ESCALATION_MARKERS.reduce((total, marker) => total + marker.count, 0)).toBe(39)
        expect(escalationPoints(EscalationMarker.Points5)).toBe(5)
        expect(escalationPoints(EscalationMarker.NoAttack)).toBe(-1)
        expect(escalationPoints(EscalationMarker.EarthPhysics)).toBe(0)
    })

    it('are drawn from the pool, one more with Military Academy and one of those discarded', () => {
        const { state, praetorians } = atWar()
        const draw = drawEscalation(state, praetorians, 2)
        expect(draw.drawn).toHaveLength(2)
        expect(state.escalationPool).toHaveLength(37)
        expect(state.escalationDiscard).toBeUndefined()

        own(state, praetorians, 'military-academy')
        const academy = drawEscalation(state, praetorians, 1)
        expect(academy.drawn).toHaveLength(2)
        expect(state.escalationDiscard?.drawn).toEqual(academy.drawn)
        discardDrawnEscalation(state, praetorians, academy.drawn[1])
        expect(state.getPlayerState(praetorians).escalation).toHaveLength(3)
        expect(state.escalationPool).toHaveLength(36)
        expect(state.escalationDiscard).toBeUndefined()
    })

    it('cost 1 IP each when the pool is empty, and leave a Player short of IP unable to attack', () => {
        const { state, praetorians } = atWar()
        own(state, praetorians, 'military-academy')
        state.escalationPool = [EscalationMarker.Points1]
        state.getPlayerState(praetorians).influence = 1
        // Owed 3, drew 1: two short, Military Academy's extra ignored.
        const draw = drawEscalation(state, praetorians, 3)
        expect(draw).toMatchObject({ owed: 3, influenceLost: 1, banned: true })
        expect(state.getPlayerState(praetorians).influence).toBe(0)
        expect(canAttack(state, praetorians)).toBe(false)
        // The ban lifts after the next initiative roll.
        discardEscalation(state)
        expect(canAttack(state, praetorians)).toBe(true)
    })

    it('forbid attacks during the truce and while holding You Can’t Attack', () => {
        const { state, praetorians } = atWar()
        expect(canAttack(state, praetorians)).toBe(true)
        state.getPlayerState(praetorians).escalation = [EscalationMarker.NoAttack]
        expect(canAttack(state, praetorians)).toBe(false)
        state.getPlayerState(praetorians).escalation = []
        state.truce = true
        expect(canAttack(state, praetorians)).toBe(false)
    })

    it('are halved after the initiative roll, rounded up, keeping the Player’s choice', () => {
        const { state, praetorians, givers } = atWar()
        const player = state.getPlayerState(praetorians)
        expect(escalationKeepCount(1)).toBe(0)
        expect(escalationKeepCount(3)).toBe(1)
        player.escalation = [EscalationMarker.Points4, EscalationMarker.NoAttack]
        expect(choosesEscalationKept(player)).toBe(true)
        expect(isValidEscalationKept(player, [EscalationMarker.Points4])).toBe(true)
        expect(isValidEscalationKept(player, [EscalationMarker.Points1])).toBe(false)
        player.escalationKept = [EscalationMarker.Points4]
        // Identical markers leave nothing to choose.
        const other = state.getPlayerState(givers)
        other.escalation = [EscalationMarker.EarthCash, EscalationMarker.EarthCash]
        expect(choosesEscalationKept(other)).toBe(false)
        const pool = state.escalationPool.length
        const discards = discardEscalation(state)
        expect(player.escalation).toEqual([EscalationMarker.Points4])
        expect(other.escalation).toEqual([EscalationMarker.EarthCash])
        expect(discards).toContainEqual({
            playerId: praetorians,
            discarded: [EscalationMarker.NoAttack]
        })
        expect(state.escalationPool).toHaveLength(pool + 2)
    })

    it('change Earth production, settlement prices, sales, migration and initiative', () => {
        const { state, givers } = atWar()
        const player = state.getPlayerState(givers)
        const before = capabilitiesOf(state, givers)
        player.escalation = [
            EscalationMarker.EarthCash,
            EscalationMarker.EarthEngineering,
            EscalationMarker.SettlementCost2,
            EscalationMarker.SaleCost1,
            EscalationMarker.Migration30,
            EscalationMarker.Initiative40
        ]
        const after = capabilitiesOf(state, givers)
        expect(after.settlementCost).toBe(before.settlementCost + 2)
        expect(after.initiativeBonus).toBe(before.initiativeBonus - 40)
        expect(salePrice(state, SYSTEM, TradeGood.Medicine, givers)).toBe(
            salePrice(state, SYSTEM, TradeGood.Medicine) - 1
        )
        expect(migrationChance(state, givers, SYSTEM, 0)).toBe(
            Math.max(0, migrationChance(state, playerOf(state, Faction.Starfarers), SYSTEM, 0) - 30)
        )
        const row = centuryRow(Faction.Givers, state.year)
        const earth = produceAtEarth(state, givers)
        expect(earth.cash).toBe(Math.max(0, row.cash - 2))
        expect(earth.markers[TechField.Engineering].length + earth.emptyPoolCash).toBe(
            row.markers[TechField.Engineering] + 1
        )
    })

    it('add their settlement surcharge after every discount, Pioneers’ too', () => {
        const { state } = atWar()
        const truePath = playerOf(state, Faction.TruePath)
        const player = state.getPlayerState(truePath)
        player.techs.push({ techId: TechId.TerranExodus, year: 2090 })
        own(state, truePath, 'spacefaring-populace')
        own(state, truePath, 'pioneers')
        expect(settlementPurchaseCost(state, truePath, 1)).toBe(1)
        player.escalation = [EscalationMarker.SettlementCost1]
        expect(settlementPurchaseCost(state, truePath, 1)).toBe(2)
        expect(settlementPurchaseCost(state, truePath, 2)).toBe(4)
    })

    it('score their points, -1 for each red marker', () => {
        const { state, givers } = atWar()
        const before = campaignScore(state, givers)
        state.getPlayerState(givers).escalation = [
            EscalationMarker.Points3,
            EscalationMarker.EarthCash,
            EscalationMarker.EarthPhysics
        ]
        expect(campaignScore(state, givers).escalation).toBe(2)
        expect(before.escalation).toBe(0)
    })
})

describe('The truce', () => {
    it('is rolled from the end of 2110 at 1%, rising 1% a turn, and ends on that or less', () => {
        const state = campaign()
        state.year = 2100
        expect(truceChance(state)).toBeUndefined()
        state.year = 2110
        expect(truceChance(state)).toBe(1)
        state.year = 2150
        expect(truceChance(state)).toBe(5)
        const roll = rollForTruce(state)
        assertExists(roll)
        expect(roll.ended).toBe(roll.roll <= 5)
        expect(state.truce).toBe(!roll.ended)
        state.truce = false
        expect(rollForTruce(state)).toBeUndefined()
    })
})

describe('Blockades', () => {
    it('need more combat value than the targets’ ships and settlements, all together', () => {
        const { state, praetorians, givers, truePath } = atWar()
        placeBase(state, givers, SYSTEM, 10)
        placeBase(state, truePath, SYSTEM, 5)
        expect(canBlockade(state, praetorians, SYSTEM, [givers])).toBe(true)
        expect(canBlockade(state, praetorians, SYSTEM, [truePath])).toBe(true)
        expect(canBlockade(state, praetorians, SYSTEM, [givers, truePath])).toBe(false)
        placeShip(state, givers, 'givers-gaia', SYSTEM)
        expect(blockadeDefence(state, givers, SYSTEM)).toBeGreaterThan(10)
        expect(blockadeSystems(state, praetorians)).toEqual([SYSTEM])
    })

    it('count damaged ships at their value, Hypersonic Missiles and the defender’s Minefields', () => {
        const { state, praetorians, givers } = atWar()
        placeBase(state, givers, SYSTEM, 14)
        expect(canBlockade(state, praetorians, SYSTEM, [givers])).toBe(false)
        own(state, praetorians, 'hypersonic-missiles')
        expect(combatValue(state, state.ship('praetorians-gladiator'))).toBe(9)
        expect(canBlockade(state, praetorians, SYSTEM, [givers])).toBe(true)
        own(state, givers, 'minefields')
        expect(blockadeDefence(state, givers, SYSTEM)).toBe(17)
        expect(canBlockade(state, praetorians, SYSTEM, [givers])).toBe(false)
    })

    it('leave out ships in transit, and are not allowed during the truce', () => {
        const { state, praetorians, givers } = atWar()
        placeBase(state, givers, SYSTEM, 10)
        state.ship('praetorians-gladiator').transit = 1
        expect(canBlockade(state, praetorians, SYSTEM, [givers])).toBe(false)
        state.ship('praetorians-gladiator').transit = 0
        state.truce = true
        expect(canBlockade(state, praetorians, SYSTEM, [givers])).toBe(false)
        expect(blockadeSystems(state, praetorians)).toEqual([])
    })

    it('draw an escalation marker per base for the blockader and 1 IP for each target', () => {
        const { state, praetorians, givers } = atWar()
        placeBase(state, givers, SYSTEM, 5)
        queueBlockades(state, BlockadeStep.Production)
        expect(state.remainingBlockaders).toEqual([praetorians])
        const result = declareBlockade(state, praetorians, SYSTEM, [givers])
        expect(result).toMatchObject({ force: 14, defence: 5 })
        expect(result.escalation.drawn).toHaveLength(1)
        expect(state.getPlayerState(givers).influence).toBe(1)
        // One declaration per system.
        expect(blockadeSystems(state, praetorians)).toEqual([])
    })

    it('take away Natural Stimulants’ doubled settlements with the other anomaly bonuses', () => {
        const { state, praetorians, givers } = atWar()
        const base = placeBase(state, givers, SYSTEM, 12)
        queueBlockades(state, BlockadeStep.Production)
        declareBlockade(state, praetorians, SYSTEM, [givers])
        const plain = productionYield(state, base, CASH_PRODUCTION)
        state.systemState(SYSTEM).anomaly = 'natural-stimulants'
        state.systemState(SYSTEM).anomalyResolved = true
        expect(productionYield(state, base, CASH_PRODUCTION)).toBe(plain)
    })

    it('halve production, without the anomaly bonus, and stop growth', () => {
        const { state, praetorians, givers } = atWar()
        const base = placeBase(state, givers, SYSTEM, 4)
        // m-1 side I: cash 4, no settlement bonus at 4.
        expect(productionYield(state, base, CASH_PRODUCTION)).toBe(4)
        queueBlockades(state, BlockadeStep.Production)
        declareBlockade(state, praetorians, SYSTEM, [givers])
        expect(productionYield(state, base, CASH_PRODUCTION)).toBe(2)
        state.systemState(SYSTEM).worlds = [{ tileId: 'm-1', side: WorldSide.II }]
        const growth = growSettlements(state)
        expect(growth.results.some((result) => result.playerId === givers)).toBe(false)
        expect(state.base(givers, SYSTEM)?.settlements).toBe(4)
    })
})

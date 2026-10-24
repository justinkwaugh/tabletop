import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { AnomalyChallenge } from '../components/anomalyCatalog.js'
import { CardDeck } from '../components/cards.js'
import { EscalationMarker } from '../components/escalation.js'
import { Faction } from '../components/factions.js'
import { ScenarioId } from '../components/scenarios.js'
import { SOL_SYSTEM_ID } from '../components/systems.js'
import { TechId } from '../components/techs.js'
import { OperationRoll, TITLES, TitleId, titleDefinition } from '../components/titles.js'
import { TradeGood } from '../components/tradeGoods.js'
import { WorldClass } from '../components/worldTypes.js'
import { anomalyChance } from '../model/anomalies.js'
import { attackablePlayers } from '../model/attacks.js'
import { declareBlockade } from '../model/blockades.js'
import { capabilitiesOf } from '../model/fleet.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { TitleRequestKind } from '../model/pieces.js'
import { campaignScore } from '../model/scoring.js'
import {
    buyTitle,
    buyableTitles,
    canBuyExpiringTitle,
    canBuyTitle,
    meetsPrerequisite,
    renounceTitle,
    settleTitleRequests,
    titleCost
} from '../model/titles.js'
import { TurnPhase } from '../model/turn.js'
import { recordAttack, recordMalfunctionRoll, recordOperationRoll } from '../model/turnRecord.js'
import { beginTurn } from '../model/turnCycle.js'
import {
    advanceTo,
    edit,
    endPhase,
    executeAll,
    hydrate,
    placeBase,
    startedGame,
    userAction
} from '../testing/fixtures.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'

const CAMPAIGN = { scenario: ScenarioId.Campaign }

function campaign() {
    const { game, state } = startedGame(3, CAMPAIGN)
    const hydrated = hydrate(state)
    hydrated.parallelSpan = undefined
    return { game, state, hydrated }
}

function playerOf(state: HydratedStellarHorizonsGameState, faction: Faction): string {
    const player = state.players.find((candidate) => candidate.faction === faction)
    assertExists(player, `Nobody plays ${faction}`)
    return player.playerId
}

// Lays a title out, from the pool if it was not drawn at the start.
function layOut(state: HydratedStellarHorizonsGameState, titleId: TitleId) {
    if (!state.availableTitles.includes(titleId)) {
        state.titlePool = state.titlePool.filter((pooled) => pooled !== titleId)
        state.availableTitles.push(titleId)
    }
}

function own(state: HydratedStellarHorizonsGameState, playerId: string, cardId: string) {
    state.getPlayerState(playerId).cards.push({ cardId, year: 2090, bought: false })
}

describe('Titles at the start', () => {
    it('lay out Admiral, Warlord, Chancellor and three drawn; the rest wait', () => {
        const { hydrated } = campaign()
        expect(hydrated.availableTitles.slice(0, 3)).toEqual([
            TitleId.Admiral,
            TitleId.Warlord,
            TitleId.Chancellor
        ])
        expect(hydrated.availableTitles).toHaveLength(6)
        expect(hydrated.titlePool).toHaveLength(TITLES.length - 6)
    })

    it('are not played when the option is off', () => {
        const { state } = startedGame(3, { ...CAMPAIGN, titles: false })
        expect(hydrate(state).availableTitles).toEqual([])
    })
})

describe('Title prerequisites', () => {
    it('read what the Player did this turn', () => {
        const { hydrated } = campaign()
        const [playerId, other] = hydrated.initiativeOrder()
        const met = (titleId: TitleId) =>
            meetsPrerequisite(hydrated, playerId, titleDefinition(titleId).prerequisite)
        const record = hydrated.getPlayerState(playerId).turnRecord

        expect(met(TitleId.PlanetaryArchitect)).toBe(false)
        record.terraformedClasses.push(WorldClass.O)
        expect(met(TitleId.PlanetaryArchitect)).toBe(false)
        record.terraformedClasses.push(WorldClass.M)
        expect(met(TitleId.PlanetaryArchitect)).toBe(true)

        record.resolvedChallenges.push({ challenge: AnomalyChallenge.Combat, difficulty: 9 })
        expect(met(TitleId.Guardian)).toBe(false)
        record.resolvedChallenges.push({ challenge: AnomalyChallenge.Combat, difficulty: 10 })
        expect(met(TitleId.Guardian)).toBe(true)
        expect(met(TitleId.Mastermind)).toBe(false)

        record.sales.push(
            { systemId: SOL_SYSTEM_ID, good: TradeGood.Ore },
            { systemId: SOL_SYSTEM_ID, good: TradeGood.Ore },
            { systemId: 'alpha-centauri', good: TradeGood.Ore }
        )
        expect(met(TitleId.Guildmaster)).toBe(false)
        record.sales.push({ systemId: SOL_SYSTEM_ID, good: TradeGood.FineArt })
        expect(met(TitleId.Guildmaster)).toBe(true)

        // A roll above the rate by 3% or less avoids a malfunction narrowly; with no chance of
        // one there is nothing to avoid.
        recordMalfunctionRoll(hydrated, playerId, 34, 30)
        recordMalfunctionRoll(hydrated, playerId, 30, 30)
        recordMalfunctionRoll(hydrated, playerId, 2, 0)
        expect(met(TitleId.Navigator)).toBe(false)
        recordMalfunctionRoll(hydrated, playerId, 33, 30)
        expect(met(TitleId.Navigator)).toBe(true)

        recordOperationRoll(hydrated, playerId, OperationRoll.Research, 2)
        recordOperationRoll(hydrated, playerId, OperationRoll.Mining, 1)
        expect(met(TitleId.Prospector)).toBe(true)
        expect(met(TitleId.Researcher)).toBe(false)

        // Attacked by a Player with more escalation markers, before or after the combat.
        recordAttack(hydrated, other, playerId)
        expect(met(TitleId.Admiral)).toBe(false)
        hydrated.getPlayerState(other).escalation.push(EscalationMarker.Points1)
        recordAttack(hydrated, other, playerId)
        expect(met(TitleId.Admiral)).toBe(true)
    })

    it('count a blockader who reaches more escalation by the markers the blockade draws', () => {
        const { hydrated } = campaign()
        const [blockader, target] = hydrated.initiativeOrder()
        placeBase(hydrated, target, 'alpha-centauri', 4)
        declareBlockade(hydrated, blockader, 'alpha-centauri', [target])
        expect(hydrated.getPlayerState(blockader).escalation).toHaveLength(1)
        expect(
            meetsPrerequisite(hydrated, target, titleDefinition(TitleId.Admiral).prerequisite)
        ).toBe(true)
    })

    it('read what the Player has now', () => {
        const { hydrated } = campaign()
        const [playerId] = hydrated.initiativeOrder()
        const met = (titleId: TitleId) =>
            meetsPrerequisite(hydrated, playerId, titleDefinition(titleId).prerequisite)
        const player = hydrated.getPlayerState(playerId)
        expect(met(TitleId.Chancellor)).toBe(true)
        player.explorationMarkers = 3
        expect(met(TitleId.Cartographer)).toBe(true)
        for (const cardId of ['crew-focus', 'robotic-focus']) {
            own(hydrated, playerId, cardId)
        }
        expect(met(TitleId.Engineer)).toBe(false)
        own(hydrated, playerId, 'freight-haulers')
        expect(met(TitleId.Engineer)).toBe(true)
        expect(met(TitleId.Geneticist)).toBe(false)
        placeBase(hydrated, playerId, 'alpha-centauri', 14)
        expect(met(TitleId.Governor)).toBe(false)
        placeBase(hydrated, playerId, 'alpha-centauri', 15)
        expect(met(TitleId.Governor)).toBe(true)
        player.escalation = Array.from({ length: 6 }, () => EscalationMarker.Points1)
        expect(met(TitleId.Warlord)).toBe(true)
    })
})

describe('Buying titles', () => {
    it('costs 5 more per title owned, replaces all but the fixed three, and a Warlord buys no more', () => {
        const { hydrated } = campaign()
        const [playerId] = hydrated.initiativeOrder()
        const player = hydrated.getPlayerState(playerId)
        player.influence = 60
        player.explorationMarkers = 3
        layOut(hydrated, TitleId.Cartographer)
        expect(titleCost(hydrated, playerId, TitleId.Chancellor)).toBe(15)
        const chancellor = buyTitle(hydrated, playerId, TitleId.Chancellor)
        expect(chancellor?.replacement).toBeUndefined()
        expect(hydrated.availableTitles).not.toContain(TitleId.Chancellor)
        expect(titleCost(hydrated, playerId, TitleId.Cartographer)).toBe(12)
        const pooled = hydrated.titlePool.length
        const cartographer = buyTitle(hydrated, playerId, TitleId.Cartographer)
        expect(cartographer?.replacement).toBeDefined()
        expect(hydrated.titlePool).toHaveLength(pooled - 1)
        expect(player.influence).toBe(60 - 15 - 12)
        // Warlord takes the place of every other title.
        player.escalation = Array.from({ length: 6 }, () => EscalationMarker.Points1)
        const warlord = buyTitle(hydrated, playerId, TitleId.Warlord)
        expect(warlord?.renounced.toSorted()).toEqual(
            [TitleId.Chancellor, TitleId.Cartographer].toSorted()
        )
        expect(player.titles).toEqual([TitleId.Warlord])
        expect(hydrated.availableTitles).toContain(TitleId.Chancellor)
        expect(canBuyTitle(hydrated, playerId, TitleId.Chancellor)).toBe(false)
    })

    it('bought as Warlord in a Branch with a renunciation queued too, lays the title out once', () => {
        const { hydrated } = campaign()
        const [playerId] = hydrated.initiativeOrder()
        const player = hydrated.getPlayerState(playerId)
        player.titles = [TitleId.Chancellor]
        hydrated.availableTitles = hydrated.availableTitles.filter(
            (titleId) => titleId !== TitleId.Chancellor
        )
        player.influence = 20
        player.escalation = Array.from({ length: 6 }, () => EscalationMarker.Points1)
        player.titleRequests = [
            { kind: TitleRequestKind.Buy, titleId: TitleId.Warlord, influence: 13 },
            { kind: TitleRequestKind.Renounce, titleId: TitleId.Chancellor, influence: 0 }
        ]
        settleTitleRequests(hydrated)
        expect(player.titles).toEqual([TitleId.Warlord])
        expect(
            hydrated.availableTitles.filter((titleId) => titleId === TitleId.Chancellor)
        ).toHaveLength(1)
    })

    it('renounced, goes back to the pool unless fixed or too few others are laid out', () => {
        const { hydrated } = campaign()
        const [playerId] = hydrated.initiativeOrder()
        const player = hydrated.getPlayerState(playerId)
        player.titles = [TitleId.Chancellor, TitleId.Navigator]
        hydrated.availableTitles = hydrated.availableTitles.filter(
            (titleId) => titleId !== TitleId.Chancellor
        )
        renounceTitle(hydrated, playerId, TitleId.Chancellor)
        expect(hydrated.availableTitles).toContain(TitleId.Chancellor)
        renounceTitle(hydrated, playerId, TitleId.Navigator)
        expect(hydrated.titlePool).toContain(TitleId.Navigator)
        expect(player.titles).toEqual([])
    })

    it('in a Branch waits for the span, the earlier Player in initiative order taking it', () => {
        const { game, state: start } = startedGame(3, CAMPAIGN)
        const ready = edit(start, (hydrated) => {
            for (const player of hydrated.players) {
                player.influence = 20
            }
        })
        let state = advanceTo(game, ready, TurnPhase.Development)
        const order = hydrate(state).initiativeOrder()
        const buyers: string[] = []
        for (let buyer = 0; buyer < 2; buyer++) {
            const [playerId] = state.activePlayerIds
            buyers.push(playerId)
            state = executeAll(
                game,
                state,
                userAction(game, playerId, ActionType.BuyTitle, { titleId: TitleId.Chancellor })
            ).state
            expect(hydrate(state).getPlayerState(playerId).titleRequests).toEqual([
                { kind: TitleRequestKind.Buy, titleId: TitleId.Chancellor, influence: 15 }
            ])
            state = endPhase(game, state)
        }
        while (state.machineState === MachineState.Developing) {
            state = endPhase(game, state)
        }
        const settled = hydrate(state)
        const [first, second] = order.filter((playerId) => buyers.includes(playerId))
        expect(settled.getPlayerState(first).titles).toEqual([TitleId.Chancellor])
        expect(settled.getPlayerState(second).titles).toEqual([])
        expect(settled.getPlayerState(second).influence).toBe(20)
        expect(settled.getPlayerState(second).titleRequests).toEqual([])
    })
})

describe('Title effects', () => {
    it('add Admiral’s +2 as a named modifier, stop its raids and its attacks on fewer markers', () => {
        const { hydrated } = campaign()
        const [admiral, more, fewer] = hydrated.initiativeOrder()
        hydrated.getPlayerState(admiral).titles = [TitleId.Admiral]
        hydrated.getPlayerState(admiral).escalation = [EscalationMarker.Points1]
        hydrated.getPlayerState(more).escalation = [
            EscalationMarker.Points1,
            EscalationMarker.Points2
        ]
        const capabilities = capabilitiesOf(hydrated, admiral)
        expect(capabilities.rollModifiers).toContainEqual({
            effect: 'combatRoll',
            source: { kind: 'Title', titleId: TitleId.Admiral },
            value: 2
        })
        expect(capabilities.cannotRaid).toBe(true)
        expect(attackablePlayers(hydrated, admiral).map((player) => player.playerId)).toEqual([
            more
        ])
        expect(attackablePlayers(hydrated, fewer)).toHaveLength(2)
    })

    it('change the rules their text names', () => {
        const { hydrated } = campaign()
        const playerId = playerOf(hydrated, Faction.Givers)
        const before = capabilitiesOf(hydrated, playerId)
        hydrated.getPlayerState(playerId).titles = [
            TitleId.Chancellor,
            TitleId.Cartographer,
            TitleId.Engineer,
            TitleId.Governor,
            TitleId.Guardian,
            TitleId.Guildmaster,
            TitleId.Navigator,
            TitleId.Prospector,
            TitleId.PlanetaryArchitect
        ]
        const after = capabilitiesOf(hydrated, playerId)
        expect(after.influencePerTurn - before.influencePerTurn).toBe(1)
        expect(after.titleAnomalyChance).toBe(5)
        expect(after.handSize[CardDeck.Fleet] - before.handSize[CardDeck.Fleet]).toBe(1)
        expect(after.cardDiscount[CardDeck.Fleet] - before.cardDiscount[CardDeck.Fleet]).toBe(2)
        expect(after.migrationChange - before.migrationChange).toBe(10)
        expect(
            after.difficulty[AnomalyChallenge.Combat] - before.difficulty[AnomalyChallenge.Combat]
        ).toBe(-2)
        expect(after.earthSaleInfluence).toBe(1)
        expect(before.cvMalfunction - after.cvMalfunction).toBe(3)
        expect(before.reMalfunction - after.reMalfunction).toBe(3)
        expect(after.miningWorldValue).toBe(1)
        // The Givers terraform without the tech, so Planetary Architect adds to that.
        expect(after.terraforms - before.terraforms).toBe(1)
        const other = playerOf(hydrated, Faction.Starfarers)
        hydrated.getPlayerState(other).titles = [TitleId.PlanetaryArchitect]
        expect(capabilitiesOf(hydrated, other).terraforms).toBe(0)
        hydrated.getPlayerState(other).techs.push({ techId: TechId.Terraforming, year: 2090 })
        expect(capabilitiesOf(hydrated, other).terraforms).toBe(2)
    })

    it('reach the rules: anomaly chance, mining value and the turn’s IP', () => {
        const { hydrated } = campaign()
        const playerId = playerOf(hydrated, Faction.Givers)
        const chance = anomalyChance(hydrated, playerId)
        const influence = hydrated.getPlayerState(playerId).influence
        hydrated.getPlayerState(playerId).titles = [TitleId.Cartographer, TitleId.Chancellor]
        expect(anomalyChance(hydrated, playerId)).toBe((chance ?? 0) + 5)
        beginTurn(hydrated)
        expect(hydrated.getPlayerState(playerId).influence).toBe(influence + 1)
    })

    it('score 10 each', () => {
        const { hydrated } = campaign()
        const [playerId] = hydrated.initiativeOrder()
        hydrated.getPlayerState(playerId).titles = [TitleId.Chancellor, TitleId.Navigator]
        expect(campaignScore(hydrated, playerId).titles).toBe(20)
    })

    it('keep the development phase open only while one lost with the turn can be bought', () => {
        const { hydrated } = campaign()
        const [playerId] = hydrated.initiativeOrder()
        hydrated.getPlayerState(playerId).influence = 15
        expect(buyableTitles(hydrated, playerId)).toEqual([TitleId.Chancellor])
        // Chancellor can be bought any turn, so it does not hold the phase open.
        expect(canBuyExpiringTitle(hydrated, playerId)).toBe(false)
        layOut(hydrated, TitleId.Navigator)
        recordMalfunctionRoll(hydrated, playerId, 31, 30)
        expect(canBuyExpiringTitle(hydrated, playerId)).toBe(true)
    })
})

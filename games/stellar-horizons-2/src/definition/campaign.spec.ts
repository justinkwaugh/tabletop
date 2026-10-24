import { describe, expect, it } from 'vitest'
import { assertExists, type Game, type GameAction } from '@tabletop/common'
import { ECONOMIC_TILES, EconomicTile } from '../components/economicTiles.js'
import { centuryRow, factionSheet } from '../components/factionSheets.js'
import { ScenarioId } from '../components/scenarios.js'
import { Faction } from '../components/factions.js'
import { shipDefinition } from '../components/ships.js'
import { starSystemDefinition } from '../components/systems.js'
import { TECH_FIELDS, TechField } from '../components/techFields.js'
import { TECHS, TechId } from '../components/techs.js'
import { shipsAvailableToBuild } from '../model/building.js'
import { anomalyDifficulty } from '../model/anomalies.js'
import { effectiveHabitability } from '../model/campaign.js'
import { isFirstToDevelop, isValidPayment } from '../model/development.js'
import { drawableLevels } from '../model/cards.js'
import {
    type ConversionResult,
    availableProductions,
    conversionTargets,
    economicTileChoices,
    growthChoiceBases,
    systemPopulationLimit
} from '../model/economy.js'
import { capabilitiesOf } from '../model/fleet.js'
import { isWithinRange } from '../model/movement.js'
import { eventPlacementSystems } from '../model/events.js'
import { campaignScore, endRollChance, galacticRank } from '../model/scoring.js'
import { rewardPlacementSystems } from '../model/settlementRewards.js'
import { resolveNextSurvey } from '../model/surveys.js'
import { terraformTargets, terraformingQueue } from '../model/terraforming.js'
import { WorldClass, WorldSide, worldTile } from '../components/worlds.js'
import type { DrawEconomicTileMetadata } from '../actions/drawEconomicTile.js'
import type { DrawTradeGoodsMetadata } from '../actions/drawTradeGoods.js'
import { SOL_SYSTEM_ID } from '../components/systems.js'
import { TradeGood } from '../components/tradeGoods.js'
import { GoodsHolderKind, canAssignToEarth } from '../model/trade.js'
import type { GrowSettlementsMetadata } from '../actions/growSettlements.js'
import type { ProduceAtBasesMetadata } from '../actions/produceAtBases.js'
import type { RollInitiativeMetadata } from '../actions/rollInitiative.js'
import type {
    HydratedStellarHorizonsGameState,
    StellarHorizonsProjectedState
} from '../model/gameState.js'
import { CASH_PRODUCTION } from '../model/pieces.js'
import { TurnPhase } from '../model/turn.js'
import { playPhase } from '../model/turnPlan.js'
import {
    MASTER_SEED,
    createGame,
    edit,
    engine,
    executeAll,
    hydrate,
    placeBase,
    startedGame,
    userAction
} from '../testing/fixtures.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'

const CAMPAIGN_CONFIG = { scenario: ScenarioId.Campaign }

function campaign(playerCount = 3) {
    return startedGame(playerCount, CAMPAIGN_CONFIG)
}

interface Played {
    state: StellarHorizonsProjectedState
    actions: GameAction[]
}

// Takes the simplest choice wherever a Player has to act: no IP for initiative, cash at every
// base, no conversion, no terraforming, goods discarded, the first demand marker drawn, and
// otherwise ends the phase.
function step(game: Game, state: StellarHorizonsProjectedState): Played {
    const [playerId] = state.activePlayerIds
    assertExists(playerId, `Nobody can act in ${state.machineState}`)
    const run = (type: ActionType, fields: Record<string, unknown> = {}) => {
        const result = executeAll(game, state, userAction(game, playerId, type, fields))
        return { state: result.state, actions: result.processedActions }
    }
    switch (state.machineState) {
        case MachineState.DecidingInitiative:
            return run(ActionType.DeclareInitiative, { influence: 0 })
        case MachineState.ChoosingProduction: {
            const base = hydrate(state)
                .basesOf(playerId)
                .find((candidate) => !candidate.production)
            assertExists(base, 'No base awaits production')
            return run(ActionType.ChooseProduction, {
                systemId: base.systemId,
                production: CASH_PRODUCTION
            })
        }
        case MachineState.ConvertingSettlements:
            return run(ActionType.PassConversion)
        case MachineState.Terraforming:
            return run(ActionType.PassTerraform)
        case MachineState.PlacingEvent: {
            const [systemId] = eventPlacementSystems(hydrate(state), playerId)
            return run(ActionType.PlaceEvent, { systemId })
        }
        case MachineState.PlacingHomesteaders: {
            const [base] = hydrate(state).basesOf(playerId)
            return run(ActionType.PlaceHomesteaders, { systemId: base.systemId })
        }
        case MachineState.PlacingRewardSettlements: {
            const hydrated = hydrate(state)
            const [systemId] = rewardPlacementSystems(hydrated)
            const settlements = hydrated.settlementRewards.at(0)?.settlements ?? 0
            return run(ActionType.PlaceRewardSettlements, {
                placements: [{ systemId, settlements }]
            })
        }
        case MachineState.AssigningGoods:
            return run(ActionType.AssignGoods, { assignments: [] })
        case MachineState.PlacingRewardGoods:
            return run(ActionType.PlaceRewardGoods, { placements: [] })
        case MachineState.ChoosingDemand: {
            const [good] = hydrate(state).demandDraws[0].drawn
            return run(ActionType.ChooseDemand, { good })
        }
        case MachineState.ChoosingTerraformWorld:
            return run(ActionType.ChooseTerraformWorld, { removedTileIds: [] })
        case MachineState.DrawingCards: {
            const hydrated = hydrate(state)
            const deck = hydrated.getPlayerState(playerId).cardDraws[0]
            const [level] = drawableLevels(hydrated, playerId, deck)
            return run(ActionType.DrawCard, { deck, level })
        }
        case MachineState.ChoosingGrowthBase: {
            const [systemId] = growthChoiceBases(hydrate(state), playerId)
            return run(ActionType.ChooseGrowthBase, { systemId })
        }
        case MachineState.EconomicPhase: {
            const [tile] = economicTileChoices(hydrate(state))
            return run(ActionType.ChooseEconomicTile, { tile })
        }
        default: {
            const phase = playPhase(state)
            assertExists(phase, `Nobody is playing a phase in ${state.machineState}`)
            return run(ActionType.EndPhase, { phase })
        }
    }
}

function playUntil(
    game: Game,
    state: StellarHorizonsProjectedState,
    done: (state: StellarHorizonsProjectedState) => boolean
): Played {
    let current = state
    const actions: GameAction[] = []
    for (let guard = 0; guard < 20_000; guard++) {
        if (done(current)) {
            return { state: current, actions }
        }
        const played = step(game, current)
        current = played.state
        actions.push(...played.actions)
    }
    throw new Error(`Gave up in ${current.machineState}`)
}

function finishTurn(game: Game, state: StellarHorizonsProjectedState): Played {
    const year = state.year
    return playUntil(game, state, (current) => current.year !== year)
}

// Fixes the next economic tile, then plays into the next turn.
function nextTurnWith(
    game: Game,
    state: StellarHorizonsProjectedState,
    tile: EconomicTile,
    prepare: (state: HydratedStellarHorizonsGameState) => void = () => {}
): Played {
    const ready = edit(state, (hydrated) => {
        hydrated.economicTilePool = [tile]
        hydrated.economicTile = undefined
        prepare(hydrated)
    })
    return finishTurn(game, ready)
}

function metadataOf<T>(action: GameAction | undefined): T {
    const metadata = (action as { metadata?: T } | undefined)?.metadata
    assertExists(metadata, 'The action has no metadata')
    return metadata
}

function actionsOf(actions: GameAction[], type: ActionType) {
    return actions.filter((action) => action.type === type)
}

describe('Campaign setup', () => {
    it('starts in the exploration phase of 2100 with every sector and no techs', () => {
        const { state } = campaign()
        expect(state.year).toBe(2100)
        expect(state.machineState).toBe(MachineState.Exploring)
        expect(state.systems).toHaveLength(36)
        for (const system of state.systems) {
            expect(system.explorationMarker).toBe(system.systemId === 'sol' ? 0 : 5)
        }
        for (const player of state.players) {
            expect(player.techs).toEqual([])
            expect(player.influence).toBe(0)
        }
    })

    it('sets aside 8 M, 6 O, 6 L and 6 H worlds', () => {
        const { state } = campaign()
        const counts = new Map<WorldClass, number>()
        for (const tileId of state.setAsideWorlds) {
            const worldClass = worldTile(tileId).worldClass
            counts.set(worldClass, (counts.get(worldClass) ?? 0) + 1)
        }
        expect(Object.fromEntries(counts)).toEqual({ M: 8, O: 6, L: 6, H: 6 })
        expect(state.worldPool).toHaveLength(160 - 26)
    })

    it('places each faction’s initial ships with their transfer markers', () => {
        const { state } = campaign()
        const hydrated = hydrate(state)
        for (const player of hydrated.players) {
            assertExists(player.faction)
            const sheet = factionSheet(player.faction)
            expect(hydrated.shipsOf(player.playerId)).toHaveLength(sheet.initialShips.length)
            for (const initial of sheet.initialShips) {
                const ship = hydrated.ship(initial.shipId)
                expect(ship.systemId).toBe(initial.systemId)
                expect(ship.transit).toBe(initial.transit)
            }
        }
    })

    it('pays Earth production for 2100 as the starting cash and tech markers', () => {
        const { state } = campaign()
        for (const player of state.players) {
            assertExists(player.faction)
            const row = centuryRow(player.faction, 2100)
            expect(player.cash).toBe(row.cash)
            for (const field of TECH_FIELDS) {
                expect(player.techMarkers[field]).toHaveLength(row.markers[field])
            }
        }
    })
})

describe('The first turn', () => {
    it('has only exploration and development, then 2110 opens with the economic phase', () => {
        const { game, state } = campaign()
        const phases: TurnPhase[] = []
        let current = state
        while (current.year === 2100) {
            const phase = playPhase(current)
            if (phase && !phases.includes(phase)) {
                phases.push(phase)
            }
            current = step(game, current).state
        }
        expect(phases).toEqual([TurnPhase.Exploration, TurnPhase.Development])
        expect(current.year).toBe(2110)
        expect(current.economicTile).toBeDefined()
    })

    it('brings the ships with a 1 marker in at the start of 2110', () => {
        const { game, state } = campaign()
        const hydrated = hydrate(finishTurn(game, state).state)
        expect(hydrated.ship('starfarers-messier').transit).toBe(0)
        expect(hydrated.ship('starfarers-copernicus').transit).toBe(1)
    })
})

describe('Economic phase tiles', () => {
    it('draws each of the seven tiles once before reshuffling, never the same twice running', () => {
        const { game, state } = campaign(2)
        const drawn: EconomicTile[] = []
        let current = finishTurn(game, state).state
        for (let turn = 0; turn < 14; turn++) {
            assertExists(current.economicTile)
            drawn.push(current.economicTile)
            current = finishTurn(game, current).state
        }
        expect(new Set(drawn.slice(0, 7))).toEqual(new Set(ECONOMIC_TILES))
        expect(new Set(drawn.slice(7, 14))).toEqual(new Set(ECONOMIC_TILES))
        for (let index = 1; index < drawn.length; index++) {
            expect(drawn[index]).not.toBe(drawn[index - 1])
        }
    })
})

describe('Rolling initiative', () => {
    it('spends declared IP for +20% each and reorders from the highest total', () => {
        const { game, state } = campaign()
        let current = nextTurnWith(game, state, EconomicTile.RollInitiative, (hydrated) => {
            for (const player of hydrated.players) {
                player.influence = 5
            }
        }).state
        expect(current.machineState).toBe(MachineState.DecidingInitiative)
        const bids = new Map<string, number>()
        const actions: GameAction[] = []
        while (current.machineState === MachineState.DecidingInitiative) {
            const [playerId] = current.activePlayerIds
            const influence = bids.size
            bids.set(playerId, influence)
            const result = executeAll(
                game,
                current,
                userAction(game, playerId, ActionType.DeclareInitiative, { influence })
            )
            current = result.state
            actions.push(...result.processedActions)
        }
        const [roll] = actionsOf(actions, ActionType.RollInitiative)
        const metadata = metadataOf<RollInitiativeMetadata>(roll)
        for (const entry of metadata.rolls) {
            expect(entry.bid).toBe(bids.get(entry.playerId))
            expect(entry.total).toBe(entry.roll + 20 * entry.bid)
        }
        const totals = metadata.order.map(
            (playerId) => metadata.rolls.find((entry) => entry.playerId === playerId)?.total ?? 0
        )
        expect(totals).toEqual(totals.toSorted((a, b) => b - a))
        expect(current.turnManager.turnOrder).toEqual(metadata.order)
        for (const [playerId, bid] of bids) {
            expect(hydrate(current).getPlayerState(playerId).influence).toBe(5 - bid)
        }
    })

    it('skips the declaration for Players without IP', () => {
        const { game, state } = campaign()
        const played = nextTurnWith(game, state, EconomicTile.RollInitiative)
        expect(actionsOf(played.actions, ActionType.RollInitiative)).toHaveLength(1)
        expect(played.state.machineState).not.toBe(MachineState.DecidingInitiative)
    })
})

describe('Earth production', () => {
    it('pays each faction its century’s cash and tech markers', () => {
        const { game, state } = campaign()
        const before = hydrate(state)
        const played = nextTurnWith(game, state, EconomicTile.EarthProduction)
        const [draw] = actionsOf(played.actions, ActionType.DrawEconomicTile)
        const metadata = metadataOf<DrawEconomicTileMetadata>(draw)
        expect(metadata.tile).toBe(EconomicTile.EarthProduction)
        for (const record of metadata.earthProduction) {
            const faction = before.getPlayerState(record.playerId).faction
            assertExists(faction)
            const row = centuryRow(faction, 2110)
            expect(record.cash).toBe(row.cash)
            for (const field of TECH_FIELDS) {
                expect(record.markers[field]).toHaveLength(row.markers[field])
            }
        }
    })
})

describe('Base production', () => {
    it('produces the best world value plus the settlement bonus, cash or tech markers', () => {
        const { game, state } = campaign(2)
        let systemId = ''
        let current = nextTurnWith(game, state, EconomicTile.BaseProduction, (hydrated) => {
            const [first, second] = hydrated.initiativeOrder()
            systemId = 'alpha-centauri'
            hydrated.systemState(systemId).worlds = [{ tileId: 'm-1', side: WorldSide.I }]
            placeBase(hydrated, first, systemId, 12)
            placeBase(hydrated, second, systemId, 3)
        }).state
        expect(current.machineState).toBe(MachineState.ChoosingProduction)
        const choices = [CASH_PRODUCTION, TechField.Biology]
        const actions: GameAction[] = []
        const order: string[] = []
        while (current.machineState === MachineState.ChoosingProduction) {
            const [playerId] = current.activePlayerIds
            order.push(playerId)
            const result = executeAll(
                game,
                current,
                userAction(game, playerId, ActionType.ChooseProduction, {
                    systemId,
                    production: choices[order.length - 1]
                })
            )
            current = result.state
            actions.push(...result.processedActions)
        }
        const [produce] = actionsOf(actions, ActionType.ProduceAtBases)
        const results = metadataOf<ProduceAtBasesMetadata>(produce).results
        // m-1 side I: biology 2, cash 4. 12 settlements: +$2B / +1; 3 settlements: no bonus.
        const firstResult = results.find((result) => result.playerId === order[0])
        const secondResult = results.find((result) => result.playerId === order[1])
        const settlementsOf = (playerId: string) =>
            hydrate(current).base(playerId, systemId)?.settlements
        expect(settlementsOf(order[0]) === 12 ? firstResult?.amount : secondResult?.amount).toBe(6)
        expect(settlementsOf(order[0]) === 12 ? secondResult?.amount : firstResult?.amount).toBe(2)
        const markerResult = results.find((result) => result.production === TechField.Biology)
        expect(markerResult?.markers).toHaveLength(markerResult?.amount ?? -1)
    })
})

describe('Settlement growth and migration', () => {
    it('grows a small base by one and a large one by one per full 10, within the limit', () => {
        const { game, state } = campaign(2)
        let first = ''
        let second = ''
        const played = nextTurnWith(game, state, EconomicTile.SettlementGrowth, (hydrated) => {
            ;[first, second] = hydrated.initiativeOrder()
            hydrated.systemState('alpha-centauri').worlds = [{ tileId: 'm-1', side: WorldSide.I }]
            hydrated.systemState('luhman-16').worlds = [{ tileId: 'm-2', side: WorldSide.I }]
            placeBase(hydrated, first, 'alpha-centauri', 4)
            placeBase(hydrated, second, 'luhman-16', 23)
        })
        const [grow] = actionsOf(played.actions, ActionType.GrowSettlements)
        const results = metadataOf<GrowSettlementsMetadata>(grow).results
        const small = results.find((result) => result.playerId === first)
        const large = results.find((result) => result.playerId === second)
        assertExists(small)
        assertExists(large)
        expect(small.growth).toBe(1)
        expect(small.growthRoll).toBeUndefined()
        expect(large.growth).toBe(2 + ((large.growthRoll ?? 10) <= 3 ? 1 : 0))
        expect(large.after).toBe(Math.min(25, 23 + large.growth + large.migration))
        // The leader has 23 settlements and the trailer 4: one full 10 behind, +10%.
        const habitability = starSystemDefinition('alpha-centauri').habitability
        expect(small.migrationChance).toBe(Math.min(100, habitability + 10))
    })

    it('lowers the limit by 10 for every other Player with a base in the system', () => {
        const { state } = campaign(3)
        const hydrated = hydrate(state)
        const [first, second, third] = hydrated.initiativeOrder()
        hydrated.systemState('alpha-centauri').worlds = [{ tileId: 'm-1', side: WorldSide.I }]
        placeBase(hydrated, first, 'alpha-centauri', 5)
        placeBase(hydrated, second, 'alpha-centauri', 5)
        placeBase(hydrated, third, 'alpha-centauri', 5)
        expect(systemPopulationLimit(hydrated, first, 'alpha-centauri')).toBe(25 - 20)
    })

    it('raises the True Path’s habitability by 20%, to at most 100%', () => {
        const { state } = campaign(4)
        const hydrated = hydrate(state)
        const truePath = hydrated.players.find((player) => player.faction === Faction.TruePath)
        const givers = hydrated.players.find((player) => player.faction === Faction.Givers)
        assertExists(truePath)
        assertExists(givers)
        expect(effectiveHabitability(hydrated, truePath.playerId, 'barnards-star')).toBe(70)
        expect(effectiveHabitability(hydrated, givers.playerId, 'barnards-star')).toBe(50)
    })
})

describe('The True Path’s conversion', () => {
    it('offers one system shared with another Player, converting on a 4 or less', () => {
        const { game, state } = campaign(4)
        let truePathId = ''
        let rivalId = ''
        let current = nextTurnWith(game, state, EconomicTile.SettlementGrowth, (hydrated) => {
            const truePath = hydrated.players.find((player) => player.faction === Faction.TruePath)
            const rival = hydrated.players.find((player) => player.faction === Faction.Givers)
            assertExists(truePath)
            assertExists(rival)
            truePathId = truePath.playerId
            rivalId = rival.playerId
            hydrated.systemState('alpha-centauri').worlds = [{ tileId: 'm-1', side: WorldSide.I }]
            placeBase(hydrated, truePathId, 'alpha-centauri', 3)
            placeBase(hydrated, rivalId, 'alpha-centauri', 3)
        }).state
        expect(current.machineState).toBe(MachineState.ConvertingSettlements)
        expect(current.activePlayerIds).toEqual([truePathId])
        const before = hydrate(current)
        const truePathBefore = before.base(truePathId, 'alpha-centauri')?.settlements ?? 0
        const rivalBefore = before.base(rivalId, 'alpha-centauri')?.settlements ?? 0
        const result = executeAll(
            game,
            current,
            userAction(game, truePathId, ActionType.ConvertSettlement, {
                systemId: 'alpha-centauri',
                targetPlayerId: rivalId
            })
        )
        current = result.state
        const [conversion] = actionsOf(result.processedActions, ActionType.ConvertSettlement)
        const outcome = metadataOf<ConversionResult>(conversion)
        expect(outcome.converted).toBe(outcome.roll <= 4)
        const after = hydrate(current)
        const shift = outcome.converted ? 1 : 0
        expect(after.base(truePathId, 'alpha-centauri')?.settlements).toBe(truePathBefore + shift)
        expect(after.base(rivalId, 'alpha-centauri')?.settlements).toBe(rivalBefore - shift)
        expect(current.machineState).not.toBe(MachineState.ConvertingSettlements)
    })

    it('never takes the last settlement of a base', () => {
        const { state } = campaign(4)
        const hydrated = hydrate(state)
        const truePath = hydrated.players.find((player) => player.faction === Faction.TruePath)
        const rival = hydrated.players.find((player) => player.faction === Faction.Givers)
        assertExists(truePath)
        assertExists(rival)
        placeBase(hydrated, truePath.playerId, 'alpha-centauri', 3)
        placeBase(hydrated, rival.playerId, 'alpha-centauri', 1)
        expect(conversionTargets(hydrated, truePath.playerId)).toEqual([])
    })
})

describe('Campaign terraforming', () => {
    it('gives the Givers a terraform without the tech, and 1 IP for flipping a world', () => {
        const { game, state } = campaign(2)
        let giversId = ''
        let current = nextTurnWith(game, state, EconomicTile.Terraforming, (hydrated) => {
            const givers = hydrated.players.find((player) => player.faction === Faction.Givers)
            assertExists(givers)
            giversId = givers.playerId
            hydrated.systemState('alpha-centauri').worlds = [{ tileId: 'm-1', side: WorldSide.I }]
            placeBase(hydrated, giversId, 'alpha-centauri', 3)
        }).state
        expect(current.machineState).toBe(MachineState.Terraforming)
        expect(current.terraformQueue).toEqual([giversId])
        const poolBefore = current.worldPool.length
        const setAsideBefore = current.setAsideWorlds.length
        current = executeAll(
            game,
            current,
            userAction(game, giversId, ActionType.Terraform, {
                systemId: 'alpha-centauri',
                slot: 0
            })
        ).state
        const after = hydrate(current)
        expect(after.systemState('alpha-centauri').worlds[0].side).toBe(WorldSide.II)
        expect(after.getPlayerState(giversId).influence).toBe(1)
        // One world of each set-aside class joins the pool once terraforming is over.
        expect(current.worldPool.length).toBe(poolBefore + 4)
        expect(current.setAsideWorlds.length).toBe(setAsideBefore - 4)
    })

    it('lets the Givers with the tech terraform twice, never the same world twice', () => {
        const { state } = campaign(2)
        const hydrated = hydrate(state)
        const givers = hydrated.players.find((player) => player.faction === Faction.Givers)
        assertExists(givers)
        givers.techs.push({ techId: TechId.Terraforming, year: 2090 })
        hydrated.systemState('alpha-centauri').worlds = [
            { tileId: 'm-1', side: WorldSide.I },
            { tileId: 'm-2', side: WorldSide.I }
        ]
        placeBase(hydrated, givers.playerId, 'alpha-centauri', 3)
        expect(terraformingQueue(hydrated)).toEqual([givers.playerId, givers.playerId])
        hydrated.terraformedWorlds.push({
            playerId: givers.playerId,
            systemId: 'alpha-centauri',
            slot: 0
        })
        expect(terraformTargets(hydrated, givers.playerId)).toEqual([
            { systemId: 'alpha-centauri', slot: 1 }
        ])
    })
})

describe('Influence', () => {
    it('can be spent for $1B while a Player is acting', () => {
        const { game, state } = campaign()
        const [playerId] = state.activePlayerIds
        const ready = edit(state, (hydrated) => {
            hydrated.getPlayerState(playerId).influence = 3
        })
        const cash = hydrate(ready).getPlayerState(playerId).cash
        const after = executeAll(
            game,
            ready,
            userAction(game, playerId, ActionType.SpendInfluence, { influence: 2 })
        ).state
        const player = hydrate(after).getPlayerState(playerId)
        expect(player.influence).toBe(1)
        expect(player.cash).toBe(cash + 2)
    })

    it('pays 2 tech points each for a tech, and the first to develop it earns 1', () => {
        const { state } = campaign()
        const hydrated = hydrate(state)
        const [playerId] = hydrated.initiativeOrder()
        const player = hydrated.getPlayerState(playerId)
        player.techMarkers.Biology = [4]
        player.cash = 0
        player.influence = 3
        // Interstellar Settlement costs 10: a 4 marker and 3 IP (6 points).
        expect(
            isValidPayment(hydrated, playerId, { techId: TechId.InterstellarSettlement }, [4], 0, 3)
        ).toBe(true)
        expect(
            isValidPayment(hydrated, playerId, { techId: TechId.InterstellarSettlement }, [4], 0, 2)
        ).toBe(false)
        expect(isFirstToDevelop(hydrated, TechId.InterstellarSettlement)).toBe(true)
        hydrated.otherPlayers(playerId)[0].techs.push({
            techId: TechId.InterstellarSettlement,
            year: 2090
        })
        expect(isFirstToDevelop(hydrated, TechId.InterstellarSettlement)).toBe(false)
    })

    it('resumes resolving surveys once a surveyed system’s demand marker is kept', () => {
        const { game, state } = campaign()
        const systemIds = ['alpha-centauri', 'barnards-star']
        let playerId = ''
        const ready = edit(state, (hydrated) => {
            ;[playerId] = hydrated.initiativeOrder()
            hydrated.anomalyPool = []
            for (const systemId of systemIds) {
                hydrated.systemState(systemId).explorationMarker = 1
                hydrated
                    .getPlayerState(playerId)
                    .pendingSurveys.push({ shipId: 'starfarers-kepler', systemId })
            }
        })
        let current = playUntil(
            game,
            ready,
            (candidate) => candidate.machineState === MachineState.ChoosingDemand
        ).state
        for (const systemId of systemIds) {
            expect(current.machineState).toBe(MachineState.ChoosingDemand)
            const [draw] = hydrate(current).demandDraws
            expect(draw).toMatchObject({ playerId, systemId })
            current = executeAll(
                game,
                current,
                userAction(game, playerId, ActionType.ChooseDemand, { good: draw.drawn[0] })
            ).state
            expect(hydrate(current).systemState(systemId).demand).toBe(draw.drawn[0])
        }
        expect(current.resumeAfterDemand).toBeUndefined()
        expect(hydrate(current).getPlayerState(playerId).pendingSurveys).toEqual([])
    })

    it('rewards the last survey of a system with its marker and 1 IP', () => {
        const { state } = campaign()
        const hydrated = hydrate(state)
        const [playerId] = hydrated.initiativeOrder()
        hydrated.systemState('alpha-centauri').explorationMarker = 1
        hydrated.anomalyPool = []
        hydrated.getPlayerState(playerId).pendingSurveys.push({
            shipId: 'starfarers-kepler',
            systemId: 'alpha-centauri'
        })
        resolveNextSurvey(hydrated)
        const player = hydrated.getPlayerState(playerId)
        expect(player.explorationMarkers).toBe(1)
        expect(player.influence).toBeGreaterThanOrEqual(1)
    })
})

describe('Faction sheets', () => {
    it('caps ships and bases by century and prices settlements by faction', () => {
        const { state } = campaign(4)
        const hydrated = hydrate(state)
        const praetorians = hydrated.players.find(
            (player) => player.faction === Faction.Praetorians
        )
        const truePath = hydrated.players.find((player) => player.faction === Faction.TruePath)
        assertExists(praetorians)
        assertExists(truePath)
        expect(hydrated.shipsOf(praetorians.playerId)).toHaveLength(4)
        expect(shipsAvailableToBuild(hydrated, praetorians.playerId)).toEqual([])
        expect(capabilitiesOf(hydrated, truePath.playerId).settlementCost).toBe(3)
        expect(capabilitiesOf(hydrated, praetorians.playerId).settlementCost).toBe(6)
    })

    it('counts the Starfarers’ bases twice for range', () => {
        const { state } = campaign(2)
        const hydrated = hydrate(state)
        const starfarers = hydrated.players.find((player) => player.faction === Faction.Starfarers)
        assertExists(starfarers)
        hydrated.systemState('altair').worlds = [{ tileId: 'm-1', side: WorldSide.I }]
        placeBase(hydrated, starfarers.playerId, 'altair', 2)
        const kuiper = hydrated.ship('starfarers-kuiper')
        const cost = shipDefinition(kuiper.shipId).cost
        expect(cost).toBeLessThanOrEqual(4)
        expect(isWithinRange(hydrated, kuiper, 'altair')).toBe(true)
    })
})

describe('The end of the campaign', () => {
    it('rolls from the end of 2500 at 1% a turn plus 1% per completed tech type', () => {
        const { state } = campaign(2)
        const hydrated = hydrate(state)
        hydrated.year = 2490
        expect(endRollChance(hydrated)).toBeUndefined()
        hydrated.year = 2500
        expect(endRollChance(hydrated)).toBe(1)
        hydrated.year = 2520
        expect(endRollChance(hydrated)).toBe(3)
        const [playerId] = hydrated.initiativeOrder()
        const player = hydrated.getPlayerState(playerId)
        for (const tech of TECHS.filter((candidate) => candidate.field === TechField.Physics)) {
            player.techs.push({ techId: tech.id, year: 2400 })
        }
        expect(endRollChance(hydrated)).toBe(4)
    })

    it('scores techs, settlements by distance, bases, markers, IP, tech points and cash', () => {
        const { state } = campaign(3)
        const hydrated = hydrate(state)
        const [first, second] = hydrated.initiativeOrder()
        const player = hydrated.getPlayerState(first)
        for (const other of hydrated.players) {
            other.techMarkers = { Biology: [], Physics: [], Engineering: [] }
            other.cash = 0
        }
        player.techs = TECHS.slice(0, 4).map((tech) => ({ techId: tech.id, year: 2200 }))
        player.cash = 25
        player.influence = 5
        player.explorationMarkers = 2
        player.techMarkers = { Biology: [5, 5], Physics: [3], Engineering: [] }
        placeBase(hydrated, first, 'alpha-centauri', 12)
        placeBase(hydrated, first, 'altair', 5)
        placeBase(hydrated, second, 'barnards-star', 12)
        const score = campaignScore(hydrated, first)
        expect(score.techs).toBe(-5 * (TECHS.length - 4))
        expect(score.settlements).toBe(12 * 0.5 + 5 * 1)
        expect(score.largeBases).toBe(2 + 1)
        expect(score.largestBase).toBe(10)
        expect(score.explorationMarkers).toBe(2)
        expect(score.influence).toBe(2)
        expect(score.techPoints).toBe(1)
        expect(score.cash).toBe(2)
        expect(score.playerCount).toBe(5)
        expect(campaignScore(hydrated, second).largestBase).toBe(10)
    })

    it('names the galactic rank', () => {
        expect(galacticRank(-40)).toBe('Galactic scum')
        expect(galacticRank(130)).toBe('Lieutenant')
        expect(galacticRank(300)).toBe('Emperor')
    })
})

describe('A whole campaign', () => {
    it('plays from 2100 to the end roll and names the highest scorers as winners', () => {
        const { game, state } = campaign(3)
        const played = playUntil(
            game,
            state,
            (current) => current.machineState === MachineState.EndOfGame
        )
        const final = hydrate(played.state)
        expect(final.year).toBeGreaterThanOrEqual(2500)
        const [endTurn] = actionsOf(played.actions, ActionType.EndTurn).filter(
            (action) => metadataOf<{ gameOver: boolean }>(action).gameOver
        )
        expect(metadataOf<{ endRoll?: { ended: boolean } }>(endTurn).endRoll?.ended).toBe(true)
        const best = Math.max(
            ...final.players.map((player) => campaignScore(final, player.playerId).total)
        )
        expect(final.winningPlayerIds.length).toBeGreaterThan(0)
        for (const playerId of final.winningPlayerIds) {
            expect(campaignScore(final, playerId).total).toBe(best)
        }
    }, 60_000)
})

describe('Review fixes', () => {
    it('offers cash and only the tech types the system’s worlds produce', () => {
        const { state } = campaign(2)
        const hydrated = hydrate(state)
        const [playerId] = hydrated.initiativeOrder()
        hydrated.systemState('alpha-centauri').worlds = [{ tileId: 'm-1', side: WorldSide.I }]
        const base = placeBase(hydrated, playerId, 'alpha-centauri', 12)
        expect(availableProductions(hydrated, base)).toEqual([CASH_PRODUCTION, TechField.Biology])
    })

    it('takes the Starfarers’ 1 off science anomalies only, and the Syndicate’s 2 off combat', () => {
        const { state } = startedGame(2, CAMPAIGN_CONFIG)
        const hydrated = hydrate(state)
        const starfarers = hydrated.players.find((player) => player.faction === Faction.Starfarers)
        assertExists(starfarers)
        // Ice Caverns: science 3; Colossal Comet: combat 3; two players.
        expect(anomalyDifficulty(hydrated, 'ice-caverns', starfarers.playerId)).toBe(4)
        expect(anomalyDifficulty(hydrated, 'colossal-comet', starfarers.playerId)).toBe(5)
        starfarers.faction = Faction.Syndicate
        expect(anomalyDifficulty(hydrated, 'ice-caverns', starfarers.playerId)).toBe(5)
        expect(anomalyDifficulty(hydrated, 'colossal-comet', starfarers.playerId)).toBe(3)
    })

    it('offers no conversion in a system with a "no bases" anomaly', () => {
        const { state } = campaign(4)
        const hydrated = hydrate(state)
        const truePath = hydrated.players.find((player) => player.faction === Faction.TruePath)
        const givers = hydrated.players.find((player) => player.faction === Faction.Givers)
        assertExists(truePath)
        assertExists(givers)
        placeBase(hydrated, truePath.playerId, 'alpha-centauri', 3)
        placeBase(hydrated, givers.playerId, 'alpha-centauri', 3)
        expect(conversionTargets(hydrated, truePath.playerId)).toHaveLength(1)
        hydrated.systemState('alpha-centauri').anomaly = 'terran-dna'
        expect(conversionTargets(hydrated, truePath.playerId)).toEqual([])
    })

    it('takes up to seven players in the campaign and four in the scenarios', () => {
        expect(() => createGame(7, CAMPAIGN_CONFIG)).not.toThrow()
        expect(() =>
            engine.startGame(createGame(7, CAMPAIGN_CONFIG), { masterSeed: MASTER_SEED })
        ).not.toThrow()
        expect(() => engine.startGame(createGame(5), { masterSeed: MASTER_SEED })).toThrow(
            /at most 4/
        )
    })
})

describe('Trade goods', () => {
    it('are drawn on their tile, then each Player assigns their own in a Barrier span', () => {
        const { game, state } = campaign()
        const played = nextTurnWith(game, state, EconomicTile.DrawTradeGoods)
        const [draw] = actionsOf(played.actions, ActionType.DrawTradeGoods)
        const { draws } = metadataOf<DrawTradeGoodsMetadata>(draw)
        for (const record of draws) {
            const faction = hydrate(state).getPlayerState(record.playerId).faction
            assertExists(faction)
            expect(record.goods).toHaveLength(centuryRow(faction, 2110).tradeGoods)
        }
        let current = played.state
        expect(current.machineState).toBe(MachineState.AssigningGoods)
        while (current.machineState === MachineState.AssigningGoods) {
            const [playerId] = current.activePlayerIds
            const drawn = hydrate(current).getPlayerState(playerId).drawnGoods
            const assignments = drawn
                .filter((good) => canAssignToEarth(hydrate(current), playerId, good))
                .map((good) => ({ good, store: { kind: GoodsHolderKind.Earth } }))
            current = executeAll(
                game,
                current,
                userAction(game, playerId, ActionType.AssignGoods, { assignments })
            ).state
        }
        const settled = hydrate(current)
        let kept = 0
        for (const record of draws) {
            const player = settled.getPlayerState(record.playerId)
            const earth = record.goods.filter((good) =>
                canAssignToEarth(settled, record.playerId, good)
            )
            expect(player.earthGoods).toEqual(earth)
            expect(player.drawnGoods).toEqual([])
            expect(player.discardedGoods).toEqual([])
            kept += earth.length
        }
        // Discards made inside the Branches are back in the pool once the span completes.
        expect(settled.goodsPool).toHaveLength(92 - kept)
    })
})

describe('The cargo and trade phase', () => {
    it('is played on the Main Line, one Player at a time in initiative order', () => {
        const { game, state } = campaign()
        const SYSTEM = 'alpha-centauri'
        const order = hydrate(state).initiativeOrder()
        const [first, second] = order
        const arrived = (hydrated: HydratedStellarHorizonsGameState, playerId: string) => {
            const ship = hydrated.shipsOf(playerId).find((candidate) => candidate.transit === 0)
            assertExists(ship, 'Every faction starts with a ship in place')
            return ship
        }
        let shipIds: string[] = []
        const played = nextTurnWith(game, state, EconomicTile.EarthProduction, (hydrated) => {
            const seller = arrived(hydrated, first)
            seller.systemId = SYSTEM
            seller.goods = [TradeGood.Food]
            const earthSeller = arrived(hydrated, second)
            earthSeller.systemId = SOL_SYSTEM_ID
            earthSeller.goods = [TradeGood.Ore]
            hydrated.systemState(SYSTEM).demand = TradeGood.Food
            hydrated.demandPool.splice(hydrated.demandPool.indexOf(TradeGood.Food), 1)
            shipIds = [seller.shipId, earthSeller.shipId]
        })
        let current = playUntil(
            game,
            played.state,
            (candidate) => candidate.machineState === MachineState.Trading
        ).state
        const act = (playerId: string, type: ActionType, fields: Record<string, unknown> = {}) => {
            current = executeAll(game, current, userAction(game, playerId, type, fields)).state
        }
        const influence = hydrate(current).getPlayerState(first).influence
        expect(current.activePlayerIds).toEqual([first])

        act(first, ActionType.SellGoods, {
            systemId: SYSTEM,
            good: TradeGood.Food,
            sources: [{ holder: { kind: GoodsHolderKind.Ship, shipId: shipIds[0] }, count: 1 }]
        })
        expect(current.machineState).toBe(MachineState.ChoosingDemand)
        expect(current.activePlayerIds).toEqual([first])
        const [kept] = hydrate(current).demandDraws[0].drawn
        act(first, ActionType.ChooseDemand, { good: kept })
        expect(current.machineState).toBe(MachineState.Trading)
        expect(hydrate(current).systemState(SYSTEM).demand).toBe(kept)
        expect(hydrate(current).getPlayerState(first).influence).toBe(influence + 1)

        // With nothing left to sell or move, the first Player's turn ends by itself.
        expect(current.activePlayerIds).toEqual([second])
        act(second, ActionType.SellGoods, {
            systemId: SOL_SYSTEM_ID,
            good: TradeGood.Ore,
            sources: [{ holder: { kind: GoodsHolderKind.Ship, shipId: shipIds[1] }, count: 1 }]
        })
        // The third Player has nothing to load, unload or sell either, so the phase moves on.
        expect(playPhase(current)).toBe(TurnPhase.Movement)
    })
})

describe('Card effects in the campaign turn', () => {
    function own(state: HydratedStellarHorizonsGameState, playerId: string, cardId: string) {
        state.getPlayerState(playerId).cards.push({ cardId, year: state.year - 10, bought: true })
    }

    it('let Hive Mind’s owner choose the economic tile from those left', () => {
        const { game, state } = campaign()
        const [owner] = state.turnManager.turnOrder
        const ready = edit(state, (hydrated) => own(hydrated, owner, 'hive-mind'))
        const played = playUntil(
            game,
            ready,
            (current) => current.machineState === MachineState.EconomicPhase
        )
        expect(played.state.activePlayerIds).toEqual([owner])
        const choices = economicTileChoices(hydrate(played.state))
        expect(choices).toHaveLength(ECONOMIC_TILES.length)
        const chosen = executeAll(
            game,
            played.state,
            userAction(game, owner, ActionType.ChooseEconomicTile, {
                tile: EconomicTile.SettlementGrowth
            })
        )
        expect(chosen.state.economicTile).toBe(EconomicTile.SettlementGrowth)
        expect(chosen.state.economicTilePool).not.toContain(EconomicTile.SettlementGrowth)
    })

    it('ask Prolific Breeders’ owner for a base after growth when more than one can grow', () => {
        const { game, state } = campaign()
        const [owner] = state.turnManager.turnOrder
        const played = nextTurnWith(game, state, EconomicTile.SettlementGrowth, (hydrated) => {
            own(hydrated, owner, 'prolific-breeders')
            for (const systemId of ['alpha-centauri', 'barnards-star']) {
                hydrated.systemState(systemId).worlds = [
                    {
                        tileId: hydrated.worldPool.splice(
                            hydrated.worldPool.findIndex((id) => id.startsWith('m-')),
                            1
                        )[0],
                        side: WorldSide.I
                    }
                ]
                placeBase(hydrated, owner, systemId, 2)
            }
        })
        const grown = finishTurn(game, played.state)
        const chosen = actionsOf(grown.actions, ActionType.ChooseGrowthBase)
        expect(chosen).toHaveLength(1)
        expect(metadataOf<{ settlements: number }>(chosen[0]).settlements).toBe(1)
    })

    it('repair a point on each CV for free as Self Repair’s owner starts building', () => {
        const { game, state } = campaign()
        const [owner] = state.turnManager.turnOrder
        const cv = hydrate(state)
            .shipsOf(owner)
            .find((ship) => shipDefinition(ship.shipId).kind === 'CV')
        assertExists(cv, 'Every faction starts with a CV')
        const ready = edit(state, (hydrated) => {
            own(hydrated, owner, 'self-repair-system')
            hydrated.ship(cv.shipId).damage = 1
        })
        const played = playUntil(
            game,
            ready,
            (current) => current.machineState === MachineState.Building
        )
        const starts = actionsOf(played.actions, ActionType.StartPhase).filter(
            (action) => action.playerId === owner
        )
        expect(
            starts.some((action) =>
                (metadataOf<{ repairedShipIds?: string[] }>(action).repairedShipIds ?? []).includes(
                    cv.shipId
                )
            )
        ).toBe(true)
    })
})

import { describe, expect, it } from 'vitest'
import { ActionSource, assertExists } from '@tabletop/common'
import { HydratedAssignHit } from '../actions/assignHit.js'
import { RaidResult, combatHits, raidDamage, raidResult } from '../components/combatTables.js'
import { Faction } from '../components/factions.js'
import { ScenarioId } from '../components/scenarios.js'
import { SOL_SYSTEM_ID } from '../components/systems.js'
import { TechField } from '../components/techFields.js'
import { TradeGood } from '../components/tradeGoods.js'
import { WorldSide } from '../components/worlds.js'
import { ActionType } from '../definition/actions.js'
import { hydrate, placeBase, placeShip, startedGame } from '../testing/fixtures.js'
import { answerAttack, attackOptions, declareAttack } from './attacks.js'
import { currentCombatOf, endCombat, owedEscalation } from './combat.js'
import { damageCapacity } from './fleet.js'
import { modifierTotal } from './combatRolls.js'
import { assignHit, hitChooser, hitTargets, settleForcedHits } from './hits.js'
import { raidChoices, resolveRaid } from './raids.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { CombatKind, CombatSide } from './pieces.js'
import { roundHalfUp } from './turn.js'

const SYSTEM = 'luhman-16'

function playerOf(state: HydratedStellarHorizonsGameState, faction: Faction): string {
    const player = state.players.find((candidate) => candidate.faction === faction)
    assertExists(player, `Nobody plays ${faction}`)
    return player.playerId
}

function own(state: HydratedStellarHorizonsGameState, playerId: string, cardId: string) {
    state.getPlayerState(playerId).cards.push({ cardId, year: 2090, bought: false })
}

// The Player Guide's combat example (3.3): the Praetorians' Odyssey and Gladiator attack the
// base of 3 at Luhman 16, where Guildmaster and Sapphire defend. The Givers stand in for the
// Consortium.
function guideExample() {
    const state = hydrate(startedGame(4, { scenario: ScenarioId.Campaign }).state)
    state.truce = false
    const praetorians = playerOf(state, Faction.Praetorians)
    const consortium = playerOf(state, Faction.Givers)
    state.systemState(SYSTEM).worlds = [{ tileId: 'm-1', side: WorldSide.I }]
    placeBase(state, consortium, SYSTEM, 3)
    placeShip(state, consortium, 'consortium-guildmaster', SYSTEM)
    placeShip(state, consortium, 'consortium-sapphire', SYSTEM, { settlements: 1 })
    placeShip(state, praetorians, 'praetorians-odyssey', SYSTEM)
    placeShip(state, praetorians, 'praetorians-gladiator', SYSTEM)
    return { state, praetorians, consortium }
}

function assault(state: HydratedStellarHorizonsGameState, attackerId: string, defenderId: string) {
    return declareAttack(state, attackerId, {
        kind: CombatKind.Assault,
        systemId: SYSTEM,
        defenderId,
        shipIds: ['praetorians-odyssey', 'praetorians-gladiator']
    })
}

describe('The combat and raid tables', () => {
    it('read hits by combat value and modified roll, as in the Player Guide', () => {
        // The Praetorians' 14 at 8, the Consortium's 11 at 7.
        expect(combatHits(14, 8)).toBe(6)
        expect(combatHits(11, 7)).toBe(4)
        expect(combatHits(1, 3)).toBe(0)
        expect(combatHits(70, 12)).toBe(25)
        expect(combatHits(0, 12)).toBe(0)
    })

    it('read raids by two faces of the die, and the raider’s damage by percentiles', () => {
        expect([0, 1, 2, 3, 6, 8, 9, 11].map(raidResult)).toEqual([
            RaidResult.StealCash,
            RaidResult.StealCash,
            RaidResult.StealCash,
            RaidResult.StealMoreCash,
            RaidResult.StealMarker,
            RaidResult.TakeGood,
            RaidResult.DestroySettlement,
            RaidResult.DestroySettlement
        ])
        expect([raidDamage(25, false), raidDamage(25, true), raidDamage(10, true)]).toEqual([
            1, 0, 2
        ])
    })
})

describe('Attacks', () => {
    it('need the truce over, armed and uncrippled CVs, and one combat per system', () => {
        const { state, praetorians, consortium } = guideExample()
        const kinds = () =>
            attackOptions(state, praetorians)
                .filter((option) => option.defenderId === consortium)
                .map((option) => option.kind)
        expect(kinds()).toEqual([CombatKind.Fleet, CombatKind.Assault])
        state.truce = true
        expect(kinds()).toEqual([])
        state.truce = false
        state.ship('praetorians-odyssey').damage = 1
        expect(attackOptions(state, praetorians)[0].shipIds).toEqual(['praetorians-gladiator'])
        assault(state, praetorians, consortium)
        state.combat = undefined
        expect(kinds()).toEqual([])
    })

    it('raid only bases without armed defending CVs, never the Praetorians’', () => {
        const { state, praetorians, consortium } = guideExample()
        const raids = (attackerId: string) =>
            attackOptions(state, attackerId).filter((option) => option.kind === CombatKind.Raid)
        expect(raids(praetorians)).toEqual([])
        delete state.ships['consortium-guildmaster']
        delete state.ships['consortium-sapphire']
        expect(raids(praetorians)[0].shipIds).toEqual([
            'praetorians-gladiator',
            'praetorians-odyssey'
        ])
        placeBase(state, praetorians, SYSTEM, 2)
        placeShip(state, consortium, 'givers-gaia', SYSTEM)
        expect(raids(consortium).filter((option) => option.defenderId === praetorians)).toEqual([])
    })

    it('destroy an RE only away from Sol and from its owner’s bases and CVs', () => {
        const { state, praetorians, consortium } = guideExample()
        placeShip(state, consortium, 'givers-linnaeus', 'alpha-centauri')
        placeShip(state, praetorians, 'praetorians-centurion', 'alpha-centauri')
        placeShip(state, consortium, 'givers-humboldt', SOL_SYSTEM_ID)
        placeShip(state, praetorians, 'praetorians-argonaut', SOL_SYSTEM_ID)
        const explorers = attackOptions(state, praetorians).filter(
            (option) => option.kind === CombatKind.Explorer
        )
        expect(explorers.map((option) => option.explorerIds)).toEqual([['givers-linnaeus']])
        const markers = state.getPlayerState(consortium).techMarkers[TechField.Engineering].length
        declareAttack(state, praetorians, {
            kind: CombatKind.Explorer,
            systemId: 'alpha-centauri',
            defenderId: consortium,
            shipIds: ['praetorians-centurion'],
            explorerId: 'givers-linnaeus'
        })
        expect(state.findShip('givers-linnaeus')).toBeUndefined()
        expect(state.getPlayerState(consortium).techMarkers[TechField.Engineering].length).toBe(
            markers + 1
        )
        const outcome = endCombat(state, false)
        expect(outcome).toMatchObject({ owed: 1, influence: 1 })
    })
})

describe('Resolving a combat', () => {
    it('totals combat values and modifies each die as in the Player Guide’s example', () => {
        const { state, praetorians, consortium } = guideExample()
        assault(state, praetorians, consortium)
        expect(state.combat?.rolls).toBeUndefined()
        const { rolls } = answerAttack(state, false, [
            'consortium-guildmaster',
            'consortium-sapphire'
        ])
        assertExists(rolls)
        const attacker = rolls[CombatSide.Attacker]
        const defender = rolls[CombatSide.Defender]
        expect(attacker.combatValue).toBe(14)
        expect(defender.combatValue).toBe(11)
        // Two fast CV-2s count 0.1 each, 3 settlements 0.3, the Praetorians +1.
        expect(attacker.enemyShips).toBeCloseTo(0.2)
        expect(attacker.enemySettlements).toBeCloseTo(0.3)
        expect(attacker.modifiers).toEqual([
            { source: { kind: 'Faction', faction: Faction.Praetorians }, value: 1 }
        ])
        expect(attacker.total).toBe(roundHalfUp(attacker.die + 1.5))
        // A fast CV-2 and a fast CV-3 count 0.1 and 0.2.
        expect(defender.enemyShips).toBeCloseTo(0.3)
        expect(defender.total).toBe(roundHalfUp(defender.die + 0.3))
        expect(attacker.hits).toBe(combatHits(14, attacker.total))
    })

    it('add the cards’ and anomalies’ modifiers to the rolls and Minefields to the defence', () => {
        const { state, praetorians, consortium } = guideExample()
        own(state, praetorians, 'military-academy')
        own(state, praetorians, 'enhanced-strength')
        own(state, consortium, 'subterranean')
        own(state, consortium, 'hypersonic-missiles')
        own(state, consortium, 'minefields')
        state.systemState(SYSTEM).anomaly = 'tunnel-complex'
        state.systemState(SYSTEM).anomalyResolved = true
        assault(state, praetorians, consortium)
        const { rolls } = answerAttack(state, false, [])
        assertExists(rolls)
        // Praetorians +1, Military Academy +1, Enhanced Strength +1, Subterranean -2,
        // Hypersonic Missiles -1, Tunnel Complex -1.
        const card = (cardId: string, value: number) => ({
            source: { kind: 'Card', cardId },
            value
        })
        expect(rolls[CombatSide.Attacker].modifiers).toEqual([
            { source: { kind: 'Faction', faction: Faction.Praetorians }, value: 1 },
            card('military-academy', 1),
            card('enhanced-strength', 1),
            card('subterranean', -2),
            card('hypersonic-missiles', -1),
            { source: { kind: 'Anomaly', anomalyId: 'tunnel-complex' }, value: -1 }
        ])
        expect(modifierTotal(rolls[CombatSide.Attacker].modifiers)).toBe(-1)
        // The base's 3 and Minefields' 3; the defender's ships stayed out.
        expect(rolls[CombatSide.Defender].combatValue).toBe(6)
        expect(rolls[CombatSide.Defender].modifiers).toEqual([])
    })

    it('take hits in turn, the owner first, placing those that leave no choice', () => {
        const { state, praetorians, consortium } = guideExample()
        assault(state, praetorians, consortium)
        answerAttack(state, false, ['consortium-guildmaster', 'consortium-sapphire'])
        const combat = state.combat
        assertExists(combat)
        combat.hits = { [CombatSide.Attacker]: 2, [CombatSide.Defender]: 6 }
        combat.picks = 0
        expect(hitChooser(combat)).toBe(praetorians)
        assignHit(state, { kind: 'Ship', shipId: 'praetorians-gladiator' }, praetorians)
        expect(hitChooser(combat)).toBe(consortium)
        assignHit(state, { kind: 'Ship', shipId: 'praetorians-odyssey' }, consortium)
        // Now the defender's units: the defender chooses first.
        expect(hitChooser(combat)).toBe(consortium)
        assignHit(state, { kind: 'Base' }, consortium)
        assignHit(state, { kind: 'Ship', shipId: 'consortium-sapphire' }, praetorians)
        assignHit(state, { kind: 'Ship', shipId: 'consortium-guildmaster' }, consortium)
        assignHit(state, { kind: 'Ship', shipId: 'consortium-sapphire' }, praetorians)
        // Sapphire is lost with its settlement. Two hits are left for the Guildmaster's last
        // point and the base's two settlements, so the choice still matters.
        expect(state.findShip('consortium-sapphire')).toBeUndefined()
        expect(settleForcedHits(state)).toEqual([])
        expect(hitTargets(state)).toHaveLength(2)
        assignHit(state, { kind: 'Base' }, consortium)
        assignHit(state, { kind: 'Base' }, praetorians)
        expect(state.base(consortium, SYSTEM)).toBeUndefined()
        expect(combat.defenderLosses).toEqual({
            shipIds: ['consortium-sapphire'],
            settlements: 4,
            baseEliminated: true
        })
        // 1 for the combat, 1 for Sapphire, 0.5 for each of the four settlements (three at the
        // base, one aboard Sapphire) and 2 for the base: 6, as in the Player Guide.
        expect(owedEscalation(combat)).toBe(6)
    })

    it('draw a destroyed ship’s compensation at once, so that hit cannot be taken back', () => {
        const { state, praetorians, consortium } = guideExample()
        assault(state, praetorians, consortium)
        answerAttack(state, false, ['consortium-guildmaster', 'consortium-sapphire'])
        const combat = currentCombatOf(state)
        combat.hits = { [CombatSide.Attacker]: 2, [CombatSide.Defender]: 0 }
        combat.picks = 0
        const odyssey = state.ship('praetorians-odyssey')
        odyssey.damage = damageCapacity(state, odyssey) - 1
        const hit = (playerId: string, shipId: string) => {
            const action = new HydratedAssignHit({
                id: `hit-${shipId}`,
                gameId: state.gameId,
                source: ActionSource.User,
                type: ActionType.AssignHit,
                playerId,
                target: { kind: 'Ship', shipId }
            })
            action.apply(state)
            return action
        }
        expect(hit(praetorians, 'praetorians-gladiator').revealsInfo).toBeFalsy()
        const destroying = hit(consortium, 'praetorians-odyssey')
        expect(destroying.metadata?.hits[0].lost?.markers).toHaveLength(2)
        expect(destroying.revealsInfo).toBe(true)
    })

    it('destroy everything at once when the hits are enough, and lose the hits left over', () => {
        const { state, praetorians, consortium } = guideExample()
        assault(state, praetorians, consortium)
        answerAttack(state, false, [])
        const combat = state.combat
        assertExists(combat)
        combat.hits = { [CombatSide.Attacker]: 0, [CombatSide.Defender]: 9 }
        const placed = settleForcedHits(state)
        expect(placed).toHaveLength(3)
        expect(placed.at(-1)?.baseEliminated).toBe(true)
        expect(combat.hits[CombatSide.Defender]).toBe(0)
    })

    it('let the attacker decline the markers against a ship that attacked them last turn', () => {
        const { state, praetorians, consortium } = guideExample()
        state.attacks.push({
            shipId: 'consortium-sapphire',
            targetId: praetorians,
            year: state.year - 10
        })
        declareAttack(state, praetorians, {
            kind: CombatKind.Fleet,
            systemId: SYSTEM,
            defenderId: consortium,
            shipIds: ['praetorians-gladiator']
        })
        answerAttack(state, false, [])
        const combat = state.combat
        assertExists(combat)
        expect(combat.mayDecline).toBe(true)
        combat.hits = { [CombatSide.Attacker]: 0, [CombatSide.Defender]: 0 }
        const influence = state.getPlayerState(consortium).influence
        expect(endCombat(state, true)).toMatchObject({ owed: 1, declined: true, influence: 0 })
        expect(state.getPlayerState(consortium).influence).toBe(influence)
        expect(state.getPlayerState(praetorians).escalation).toEqual([])
    })
})

describe('Raids', () => {
    function raid() {
        const { state, praetorians, consortium } = guideExample()
        delete state.ships['consortium-guildmaster']
        delete state.ships['consortium-sapphire']
        const base = state.base(consortium, SYSTEM)
        assertExists(base)
        base.goods = [TradeGood.Ore]
        state.getPlayerState(consortium).techMarkers[TechField.Physics] = [4]
        state.getPlayerState(consortium).cash = 1
        const declared = declareAttack(state, praetorians, {
            kind: CombatKind.Raid,
            systemId: SYSTEM,
            defenderId: consortium,
            shipIds: ['praetorians-gladiator']
        })
        return { state, praetorians, consortium, declared }
    }

    it('roll the die with the Praetorians’ +1 and apply the result rolled', () => {
        const { state, declared } = raid()
        const roll = declared.raid
        assertExists(roll)
        expect(modifierTotal(roll.modifiers)).toBe(1)
        const result = raidResult(roll.total)
        if (declared.raidOutcome) {
            expect(declared.raidOutcome.result).toBe(result)
        } else {
            expect(raidChoices(state).every((choice) => choice.result === result)).toBe(true)
        }
    })

    it('let the Syndicate take any lower result, even one with no effect', () => {
        const { state, praetorians, consortium } = raid()
        state.combat = undefined
        state.systemAttacks = []
        state.getPlayerState(praetorians).faction = Faction.Syndicate
        declareAttack(state, praetorians, {
            kind: CombatKind.Raid,
            systemId: SYSTEM,
            defenderId: consortium,
            shipIds: ['praetorians-odyssey']
        })
        const combat = currentCombatOf(state)
        combat.raid = { die: 10, modifiers: [], total: 10, percentile: 90 }
        const results = new Set(raidChoices(state).map((choice) => choice.result))
        expect(results.size).toBe(5)
        state.getPlayerState(consortium).cash = 0
        const outcome = resolveRaid(state, { result: RaidResult.StealCash })
        expect(outcome).toMatchObject({ effective: false, lowered: true, damage: 0 })
        expect(owedEscalation(combat)).toBe(0)
    })

    it('steal a marker of the chosen type, take or destroy a good, never the last settlement', () => {
        const { state, praetorians, consortium } = raid()
        const victim = state.getPlayerState(consortium)
        victim.techMarkers = { Biology: [], Physics: [4], Engineering: [] }
        const rolled = (total: number) => {
            state.combat = {
                kind: CombatKind.Raid,
                systemId: SYSTEM,
                attackerId: praetorians,
                defenderId: consortium,
                forces: {
                    [CombatSide.Attacker]: { shipIds: ['praetorians-odyssey'], base: false },
                    [CombatSide.Defender]: { shipIds: [], base: true }
                },
                hits: { [CombatSide.Attacker]: 0, [CombatSide.Defender]: 0 },
                picks: 0,
                raid: { die: total, modifiers: [], total, percentile: 50 },
                defenderLosses: { shipIds: [], settlements: 0, baseEliminated: false },
                mayDecline: false
            }
        }
        rolled(5)
        expect(raidChoices(state)).toEqual([
            { result: RaidResult.StealMarker, field: TechField.Physics }
        ])
        expect(resolveRaid(state, raidChoices(state)[0])).toMatchObject({
            marker: 4,
            effective: true
        })
        expect(state.getPlayerState(praetorians).techMarkers[TechField.Physics]).toContain(4)
        // The Odyssey has no cargo room, so the good is destroyed for $1B.
        rolled(7)
        expect(raidChoices(state)).toEqual([
            { result: RaidResult.TakeGood, good: TradeGood.Ore, stolen: false }
        ])
        rolled(9)
        const base = state.base(consortium, SYSTEM)
        assertExists(base)
        base.settlements = 1
        expect(resolveRaid(state, { result: RaidResult.DestroySettlement })).toMatchObject({
            effective: false
        })
        expect(base.settlements).toBe(1)
    })
})

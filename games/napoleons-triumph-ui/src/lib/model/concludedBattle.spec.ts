import { describe, expect, it } from 'vitest'
import { assertExists, type GameAction } from '@tabletop/common'
import { AUSTERLITZ, ActionType, CommandKind, Side } from '@tabletop/napoleons-triumph'
import {
    TestGame,
    arrangeBattlefield,
    artillery,
    cavalry,
    infantry,
    passTurns,
    type PiecePlacement
} from '@tabletop/napoleons-triumph/testing'
import { concludedBattleOf, endingOf, type ConcludedBattle } from './concludedBattle.js'

const FROM = 93
const INTO = 94
const REFUGE = 83

class Recorded {
    readonly game = new TestGame()
    readonly actions: GameAction[] = []

    constructor(placements: readonly PiecePlacement[]) {
        this.game.deployBoth()
        passTurns(this.game, 1)
        arrangeBattlefield(this.game, placements)
    }

    act(type: ActionType, side: Side, payload: Record<string, unknown> = {}) {
        this.actions.push(...this.game.act(type, this.game.playerOf(side), payload))
    }

    concluded(): ConcludedBattle | undefined {
        return concludedBattleOf({ state: this.game.state, actions: this.actions })
    }

    battle(): ConcludedBattle {
        const battle = this.concluded()
        assertExists(battle, 'Expected an attack that has just ended')
        return battle
    }
}

const french = (id: string, face: PiecePlacement['face'], more = {}): PiecePlacement => ({
    id,
    side: Side.French,
    face,
    locale: FROM,
    commanderId: 'st-hilaire',
    ...more
})
const allied = (id: string, face: PiecePlacement['face'], more = {}): PiecePlacement => ({
    id,
    side: Side.Allied,
    face,
    locale: INTO,
    commanderId: 'prebyshevsky',
    ...more
})

const stHilaire = (unitIds: string[]) => ({
    orders: [{ kind: CommandKind.Corps, commanderId: 'st-hilaire', unitIds }],
    wide: true
})

/** Two weak French units against blockers: thrown back, with nothing left for anyone to decide. */
function repulsed(): Recorded {
    const recorded = new Recorded([
        french('F01', infantry(2)),
        french('F02', infantry(2)),
        allied('A01', infantry(3), { facing: FROM }),
        allied('A02', infantry(2), { facing: FROM }),
        allied('A03', infantry(2))
    ])
    recorded.act(ActionType.ThreatenAttack, Side.French, {
        approach: AUSTERLITZ.approachBetween(FROM, INTO).id
    })
    recorded.act(ActionType.PressAttack, Side.French)
    recorded.act(ActionType.LeadDefense, Side.Allied, { leaderIds: ['A01'] })
    recorded.act(ActionType.DeclareAttack, Side.French, {
        ...stHilaire(['F01', 'F02']),
        leaderIds: ['F01']
    })
    return recorded
}

/** A strong French attack on a defence from reserve, which the Allies leave, losing steps on the way. */
function wonUntilTheRetreat(alliedMorale?: number): Recorded {
    const recorded = new Recorded([
        french('F01', infantry(3)),
        french('F02', infantry(3)),
        french('F03', cavalry(2)),
        allied('A01', infantry(2)),
        allied('A02', infantry(1)),
        allied('A03', artillery()),
        allied('A04', infantry(3))
    ])
    if (alliedMorale !== undefined) {
        recorded.game.arrange((state) => {
            state.playerOf(Side.Allied).morale = alliedMorale
        })
    }
    recorded.act(ActionType.ThreatenAttack, Side.French, {
        approach: AUSTERLITZ.approachBetween(FROM, INTO).id
    })
    recorded.act(ActionType.DeclareDefense, Side.Allied, { unitIds: ['A01', 'A02'] })
    recorded.act(ActionType.PressAttack, Side.French)
    recorded.act(ActionType.LeadDefense, Side.Allied, { leaderIds: ['A01'] })
    recorded.act(ActionType.DeclareAttack, Side.French, {
        ...stHilaire(['F01', 'F02', 'F03']),
        leaderIds: ['F01', 'F02']
    })
    recorded.act(ActionType.CounterAttack, Side.Allied, { unitIds: [] })
    return recorded
}

function retreatedTo(recorded: Recorded, locale: number) {
    recorded.act(ActionType.Retreat, Side.Allied, {
        losses: { A04: 2 },
        destinations: { A03: locale, A04: locale },
        kept: { prebyshevsky: 'A04' }
    })
}

describe('the attack that has just ended', () => {
    it('is not there while the attack is still being fought', () => {
        const recorded = wonUntilTheRetreat()
        expect(recorded.game.state.attack).toBeDefined()
        expect(recorded.concluded()).toBeUndefined()
    })

    it('carries the result the actions settled, though the game no longer keeps the attack', () => {
        const recorded = repulsed()
        recorded.act(ActionType.CounterAttack, Side.Allied, { unitIds: [] })
        expect(recorded.game.state.attack).toBeUndefined()
        const battle = recorded.battle()
        expect(battle.openedBy).toBe(recorded.actions[0].id)
        expect(battle.attack).toMatchObject({
            initialResult: -2,
            finalResult: -2,
            attackerWon: false,
            attackingUnitIds: ['F01', 'F02']
        })
        expect(battle.retreatedTo).toEqual([])
    })

    it('keeps the units the attack destroyed, as they were last seen', () => {
        const recorded = repulsed()
        recorded.act(ActionType.CounterAttack, Side.Allied, { unitIds: [] })
        expect(recorded.game.hydrated.findUnit('F01')).toBeUndefined()
        expect(recorded.battle().units.get('F01')?.face).toEqual(infantry(2))
    })

    it('names where the defenders retreated to', () => {
        const recorded = wonUntilTheRetreat()
        retreatedTo(recorded, REFUGE)
        const battle = recorded.battle()
        expect(battle.attack.attackerWon).toBe(true)
        expect(battle.retreatedTo).toEqual([REFUGE])
        expect(battle.units.has('A03')).toBe(true)
    })

    it('is gone once anything else is done', () => {
        const recorded = wonUntilTheRetreat()
        retreatedTo(recorded, REFUGE)
        recorded.act(ActionType.EndTurn, Side.French)
        expect(recorded.concluded()).toBeUndefined()
    })
})

describe('the sentence that ends an attack', () => {
    const ending = (recorded: Recorded) =>
        endingOf(recorded.battle(), true, (locale) => `locale ${locale}`)

    it('says the defenders hold the locale when the attack is thrown back', () => {
        const recorded = repulsed()
        recorded.act(ActionType.CounterAttack, Side.Allied, { unitIds: [] })
        expect(ending(recorded)).toBe('The Allies hold locale 94.')
    })

    it('says where the defenders retreated to and that the attackers took the locale', () => {
        const recorded = wonUntilTheRetreat()
        retreatedTo(recorded, REFUGE)
        expect(recorded.battle().taken).toBe(true)
        expect(ending(recorded)).toBe(
            'The Allies retreat to locale 83, and the French take locale 94.'
        )
    })

    it('does not move the attackers in when the retreat breaks the defending army', () => {
        const recorded = wonUntilTheRetreat(4)
        retreatedTo(recorded, REFUGE)
        expect(recorded.game.state.victory).toBeDefined()
        expect(recorded.battle().taken).toBe(false)
        expect(ending(recorded)).toBe('The Allies retreat to locale 83.')
    })
})

import { describe, expect, it } from 'vitest'
import { assertExists, type GameAction } from '@tabletop/common'
import { AUSTERLITZ, ActionType, CommandKind, FeintEnd, Side } from '@tabletop/napoleons-triumph'
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

    constructor(placements: readonly PiecePlacement[], alliedMorale?: number) {
        this.game.deployBoth()
        passTurns(this.game, 1)
        arrangeBattlefield(this.game, placements)
        if (alliedMorale !== undefined) {
            this.game.arrange((state) => {
                state.playerOf(Side.Allied).morale = alliedMorale
            })
        }
    }

    act(type: ActionType, side: Side, payload: Record<string, unknown> = {}) {
        this.actions.push(...this.game.act(type, this.game.playerOf(side), payload))
    }

    threaten() {
        this.act(ActionType.ThreatenAttack, Side.French, {
            approach: AUSTERLITZ.approachBetween(FROM, INTO).id
        })
    }

    concluded(): ConcludedBattle | undefined {
        return concludedBattleOf({ state: this.game.state, actions: this.actions })
    }

    battle(): ConcludedBattle {
        const battle = this.concluded()
        assertExists(battle, 'Expected an attack that has just ended')
        return battle
    }

    ending(): string {
        return endingOf(this.battle(), Side.French, (locale) => `locale ${locale}`)
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

function repulsed(): Recorded {
    const recorded = new Recorded([
        french('F01', infantry(2)),
        french('F02', infantry(2)),
        allied('A01', infantry(3), { facing: FROM }),
        allied('A02', infantry(2), { facing: FROM }),
        allied('A03', infantry(2))
    ])
    recorded.threaten()
    recorded.act(ActionType.PressAttack, Side.French)
    recorded.act(ActionType.LeadDefense, Side.Allied, { leaderIds: ['A01'] })
    recorded.act(ActionType.DeclareAttack, Side.French, {
        ...stHilaire(['F01', 'F02']),
        leaderIds: ['F01']
    })
    recorded.act(ActionType.CounterAttack, Side.Allied, { unitIds: [] })
    return recorded
}

function wonUntilTheRetreat(alliedMorale?: number): Recorded {
    const recorded = new Recorded(
        [
            french('F01', infantry(3)),
            french('F02', infantry(3)),
            french('F03', cavalry(2)),
            allied('A01', infantry(2)),
            allied('A02', infantry(1)),
            allied('A03', artillery()),
            allied('A04', infantry(3))
        ],
        alliedMorale
    )
    recorded.threaten()
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

function retreated(recorded: Recorded): Recorded {
    recorded.act(ActionType.Retreat, Side.Allied, {
        losses: { A04: 2 },
        destinations: { A03: REFUGE, A04: REFUGE },
        kept: { prebyshevsky: 'A04' }
    })
    return recorded
}

describe('the attack that has just ended', () => {
    it('is not there while the attack is still being fought', () => {
        const recorded = wonUntilTheRetreat()
        expect(recorded.game.state.attack).toBeDefined()
        expect(recorded.concluded()).toBeUndefined()
    })

    it('is the attack the last action recorded, results included', () => {
        const recorded = repulsed()
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
        expect(recorded.game.hydrated.findUnit('F01')).toBeUndefined()
        expect(recorded.battle().unitsLastSeen.get('F01')?.face).toEqual(infantry(2))
    })

    it('names where the defenders retreated to and whether the attackers moved in', () => {
        const battle = retreated(wonUntilTheRetreat()).battle()
        expect(battle.attack.attackerWon).toBe(true)
        expect(battle.retreatedTo).toEqual([REFUGE])
        expect(battle.taken).toBe(true)
        expect(battle.unitsLastSeen.has('A03')).toBe(true)
    })

    it('is gone once anything else is done', () => {
        const recorded = retreated(wonUntilTheRetreat())
        recorded.act(ActionType.EndTurn, Side.French)
        expect(recorded.concluded()).toBeUndefined()
    })
})

describe('the sentence that ends an attack', () => {
    it('says the defenders hold the locale when the attack is thrown back', () => {
        expect(repulsed().ending()).toBe('The Allies hold locale 94.')
    })

    it('says where the defenders retreated to and that the attackers took the locale', () => {
        expect(retreated(wonUntilTheRetreat()).ending()).toBe(
            'The Allies retreat to locale 83, and the French take locale 94.'
        )
    })

    it('says the army is demoralized when the retreat breaks it, and nobody moves in', () => {
        const recorded = retreated(wonUntilTheRetreat(4))
        expect(recorded.game.state.victory).toBeDefined()
        expect(recorded.battle().taken).toBe(false)
        expect(recorded.ending()).toBe(
            'The Allies retreat to locale 83; the Allied army is demoralized.'
        )
    })

    it('says the guns fired when artillery led an attack its declaration settled', () => {
        const recorded = new Recorded([
            french('F01', artillery(), { commanderId: undefined, facing: INTO }),
            allied('A01', infantry(3))
        ])
        recorded.threaten()
        recorded.act(ActionType.DeclareDefense, Side.Allied, { unitIds: ['A01'] })
        recorded.act(ActionType.PressAttack, Side.French)
        recorded.act(ActionType.LeadDefense, Side.Allied, { leaderIds: [] })
        recorded.act(ActionType.DeclareAttack, Side.French, {
            orders: [{ kind: CommandKind.Unit, unitIds: ['F01'] }],
            wide: false,
            leaderIds: ['F01']
        })
        expect(recorded.battle().attack).toMatchObject({
            attackingUnitIds: ['F01'],
            artilleryLed: true
        })
        expect(recorded.ending()).toBe('The guns fire, and the Allies keep locale 94.')
    })

    it('says the attack was a feint when it is called off against blockers', () => {
        const recorded = new Recorded([
            french('F01', infantry(3)),
            allied('A01', infantry(3), { facing: FROM })
        ])
        recorded.threaten()
        recorded.act(ActionType.DeclareFeint, Side.French, {
            orders: stHilaire(['F01']).orders,
            end: FeintEnd.Reserve
        })
        expect(recorded.ending()).toBe('The French call the attack off as a feint.')
    })

    it('says the defenders fell back and the attackers moved in after a retreat before combat', () => {
        const recorded = new Recorded([french('F01', infantry(3)), allied('A01', infantry(3))])
        recorded.threaten()
        recorded.act(ActionType.Retreat, Side.Allied, {
            losses: { A01: 2 },
            destinations: { A01: REFUGE },
            kept: {}
        })
        recorded.act(ActionType.Occupy, Side.French, {
            orders: [{ kind: CommandKind.Corps, commanderId: 'st-hilaire', unitIds: ['F01'] }]
        })
        expect(recorded.ending()).toBe(
            'The Allies fall back to locale 83 before the attack, and the French move into locale 94.'
        )
    })

    it('says the defenders fell back and the army is demoralized when that retreat breaks it', () => {
        const recorded = new Recorded([french('F01', infantry(3)), allied('A01', infantry(3))], 1)
        recorded.threaten()
        recorded.act(ActionType.Retreat, Side.Allied, {
            losses: { A01: 2 },
            destinations: { A01: REFUGE },
            kept: {}
        })
        expect(recorded.ending()).toBe(
            'The Allies fall back to locale 83 before the attack; the Allied army is demoralized.'
        )
    })
})

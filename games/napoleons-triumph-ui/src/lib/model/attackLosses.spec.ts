import { describe, expect, it } from 'vitest'
import type { GameAction } from '@tabletop/common'
import {
    ActionType,
    CommandKind,
    MoralePenaltyKind,
    ResultTermKind,
    Side,
    attackerLossPoints,
    defenderLossPoints,
    type Face,
    type ResultTerm
} from '@tabletop/napoleons-triumph'
import {
    TestGame,
    arrangeBattlefield,
    artillery,
    cavalry,
    infantry
} from '@tabletop/napoleons-triumph/testing'
import {
    anyLoss,
    lossSummary,
    lossesOfAttack,
    owedByAttacker,
    owedByDefender
} from './attackLosses.js'
import { recordedAccounts } from './resultAccount.js'

function threatened() {
    const game = new TestGame()
    game.deployBoth()
    game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
    arrangeBattlefield(game, [
        { id: 'F-inf', side: Side.French, face: infantry(3), locale: 53 },
        { id: 'A-inf', side: Side.Allied, face: infantry(1), locale: 63, facing: 53 },
        { id: 'A-cav', side: Side.Allied, face: cavalry(3), locale: 63, facing: 53 }
    ])
    const french = game.playerOf(Side.French)
    const allied = game.playerOf(Side.Allied)
    const actions: GameAction[] = []
    const act = (type: ActionType, playerId: string, payload: Record<string, unknown> = {}) => {
        actions.push(...game.act(type, playerId, payload))
    }
    act(ActionType.ThreatenAttack, french, {
        approach: game.hydrated.map.approachBetween(53, 63).id
    })
    const attack = () => {
        const fought = game.hydrated.attack
        return fought ?? { attackerId: french, defenderId: allied, attackingUnitIds: ['F-inf'] }
    }
    return { game, french, allied, actions, act, attack }
}

describe('what an attack has cost each side', () => {
    it('is nothing while it is only threatened', () => {
        const { actions, attack } = threatened()
        const losses = lossesOfAttack(actions, attack())
        expect(anyLoss(losses)).toBe(false)
        expect(lossSummary(losses.attacker)).toBe('no loss')
    })

    it('follows rule 11’s fourth example: the loser pays morale for its steps, the winner only for what it committed', () => {
        const { french, allied, actions, act, attack } = threatened()
        act(ActionType.PressAttack, french)
        act(ActionType.LeadDefense, allied, { leaderIds: ['A-inf'] })
        act(ActionType.DeclareAttack, french, {
            orders: [{ kind: CommandKind.Unit, unitIds: ['F-inf'] }],
            wide: false,
            leaderIds: ['F-inf']
        })
        const fought = attack()
        act(ActionType.CounterAttack, allied, { unitIds: ['A-cav'] })
        const losses = lossesOfAttack(actions, fought)

        expect(losses.attacker).toMatchObject({ playerId: french, steps: 2, paidForSteps: 2 })
        expect(losses.attacker.taken).toEqual([
            { unitId: 'F-inf', face: infantry(3), steps: 2, eliminated: false }
        ])
        expect(lossSummary(losses.attacker)).toBe('2 steps and 2 morale')

        expect(losses.defender).toMatchObject({ playerId: allied, steps: 2, paidForSteps: 0 })
        expect(
            losses.defender.taken.map((loss) => [loss.unitId, loss.steps, loss.eliminated])
        ).toEqual([
            ['A-cav', 1, false],
            ['A-inf', 1, true]
        ])
        expect(losses.defender.penalties.map((penalty) => penalty.kind)).toEqual([
            MoralePenaltyKind.HeavyCavalryCommitted
        ])
        expect(losses.defender.morale).toBe(losses.defender.penalties[0].moraleLost)
        expect(anyLoss(losses)).toBe(true)

        const { initial } = recordedAccounts(actions)
        expect(owedByAttacker(initial ?? [], -1).map((line) => line.steps)).toEqual([1, 1])
        expect(owedByDefender(initial ?? [], -1, 1).map((line) => line.steps)).toEqual([1, 1])
    })

    it('counts a retreat before combat against the defender, in steps and as much morale', () => {
        const game = new TestGame()
        game.deployBoth()
        game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
        arrangeBattlefield(game, [
            { id: 'F-inf', side: Side.French, face: infantry(3), locale: 53 },
            { id: 'A-inf', side: Side.Allied, face: infantry(3), locale: 63 },
            { id: 'A-cav', side: Side.Allied, face: cavalry(1), locale: 63 }
        ])
        const french = game.playerOf(Side.French)
        const allied = game.playerOf(Side.Allied)
        const approach = game.hydrated.map.approachBetween(53, 63)
        const owed = approach.wide ? 2 : 1
        const actions = [
            ...game.act(ActionType.ThreatenAttack, french, { approach: approach.id }),
            ...game.act(ActionType.Retreat, allied, {
                losses: { 'A-inf': owed },
                destinations: { 'A-inf': 64, 'A-cav': 64 },
                kept: {}
            })
        ]
        const losses = lossesOfAttack(actions, {
            attackerId: french,
            defenderId: allied,
            attackingUnitIds: []
        })
        expect(losses.defender).toMatchObject({ steps: owed, paidForSteps: owed, morale: owed })
        expect(losses.defender.taken).toEqual([
            { unitId: 'A-inf', face: infantry(3), steps: owed, eliminated: false }
        ])
        expect(losses.attacker).toMatchObject({ steps: 0, morale: 0 })
    })
})

describe('the steps a result makes each side owe (rule 11, steps 9 and 10)', () => {
    const account = (attackLeaders: Face[], defenseLeaders: Face[]): ResultTerm[] => [
        { kind: ResultTermKind.AttackLeaders, value: 0, faces: attackLeaders },
        { kind: ResultTermKind.DefenseLeaders, value: 0, faces: defenseLeaders }
    ]
    const sum = (lines: { steps: number }[]) => lines.reduce((total, line) => total + line.steps, 0)

    it('add up to what the game takes, whoever leads and whatever the result', () => {
        const leaders = [[infantry(3)], [infantry(3), cavalry(2)], [cavalry(2)]]
        const defenders = [[], [infantry(2)], [artillery()], [artillery(), infantry(1)]]
        for (const attackLeaders of leaders) {
            for (const defenseLeaders of defenders) {
                for (const finalResult of [-2, 0, 3]) {
                    const terms = account(attackLeaders, defenseLeaders)
                    expect(sum(owedByAttacker(terms, finalResult))).toBe(
                        attackerLossPoints(attackLeaders, defenseLeaders.length, finalResult)
                    )
                    expect(sum(owedByDefender(terms, finalResult, 0))).toBe(
                        defenderLossPoints(attackLeaders, defenseLeaders, finalResult)
                    )
                }
            }
        }
    })

    it('ask nothing of artillery that leads an attack, and of the defence only what the result is above zero', () => {
        const guns = [artillery()]
        const terms: ResultTerm[] = [
            { kind: ResultTermKind.AttackLeaders, value: 1, faces: guns },
            { kind: ResultTermKind.ArtilleryLeads, value: 0 }
        ]
        expect(sum(owedByAttacker(terms, 1))).toBe(attackerLossPoints(guns, 1, 1))
        expect(sum(owedByDefender(terms, 1, 0))).toBe(defenderLossPoints(guns, [], 1))
        expect(sum(owedByDefender(terms, 1, 0))).toBe(1)
    })

    it('add a step for each unit that counter-attacks', () => {
        const terms = account([infantry(3)], [infantry(2)])
        expect(sum(owedByDefender(terms, 0, 2))).toBe(sum(owedByDefender(terms, 0, 0)) + 2)
    })
})

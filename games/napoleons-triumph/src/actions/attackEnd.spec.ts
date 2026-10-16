import { describe, expect, it } from 'vitest'
import type { GameAction } from '@tabletop/common'
import { AUSTERLITZ } from '../components/austerlitz.js'
import { Side } from '../components/pieces.js'
import { ActionType } from '../definition/actions.js'
import { NapoleonsTriumphRuntime } from '../definition/runtime.js'
import { CommandKind } from '../model/attack.js'
import { FeintEnd } from '../model/attackDeclaration.js'
import {
    TestGame,
    arrangeBattlefield,
    artillery,
    cavalry,
    infantry,
    passTurns,
    type PiecePlacement
} from '../testing/harness.js'
import { attackEndedBy, type EndedAttack } from './attackEnd.js'

const FROM = 93
const INTO = 94
const REFUGE = 83

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

function frenchTurn(placements: readonly PiecePlacement[], alliedMorale?: number): TestGame {
    const game = new TestGame()
    game.deployBoth()
    passTurns(game, 1)
    arrangeBattlefield(game, placements)
    if (alliedMorale !== undefined) {
        game.arrange((state) => {
            state.playerOf(Side.Allied).morale = alliedMorale
        })
    }
    return game
}

function act(game: TestGame, type: ActionType, side: Side, payload = {}): GameAction[] {
    return game.act(type, game.playerOf(side), payload)
}

function threaten(game: TestGame) {
    act(game, ActionType.ThreatenAttack, Side.French, {
        approach: AUSTERLITZ.approachBetween(FROM, INTO).id
    })
}

function endedBy(actions: readonly GameAction[]): EndedAttack | undefined {
    return attackEndedBy(actions.at(-1))
}

const corps = (unitIds: string[]) => [
    { kind: CommandKind.Corps, commanderId: 'st-hilaire', unitIds }
]

function wonUntilTheRetreat(alliedMorale?: number): TestGame {
    const game = frenchTurn(
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
    threaten(game)
    act(game, ActionType.DeclareDefense, Side.Allied, { unitIds: ['A01', 'A02'] })
    act(game, ActionType.PressAttack, Side.French)
    act(game, ActionType.LeadDefense, Side.Allied, { leaderIds: ['A01'] })
    act(game, ActionType.DeclareAttack, Side.French, {
        orders: corps(['F01', 'F02', 'F03']),
        wide: true,
        leaderIds: ['F01', 'F02']
    })
    return game
}

const retreat = (game: TestGame) =>
    act(game, ActionType.Retreat, Side.Allied, {
        losses: { A04: 2 },
        destinations: { A03: REFUGE, A04: REFUGE },
        kept: { prebyshevsky: 'A04' }
    })

describe('the action that ends an attack', () => {
    it('records nothing while the attack goes on', () => {
        const game = wonUntilTheRetreat()
        expect(endedBy(act(game, ActionType.CounterAttack, Side.Allied, { unitIds: [] }))).toBe(
            undefined
        )
    })

    it('records the attack as its last action left it, results included', () => {
        const game = wonUntilTheRetreat()
        act(game, ActionType.CounterAttack, Side.Allied, { unitIds: [] })
        const ended = endedBy(retreat(game))
        expect(game.state.attack).toBeUndefined()
        expect(ended).toMatchObject({
            attackerId: game.playerOf(Side.French),
            attackingUnitIds: ['F01', 'F02', 'F03'],
            attackLeaderIds: ['F01', 'F02'],
            defendingUnitIds: ['A01', 'A02'],
            initialResult: 4,
            finalResult: 4,
            attackerWon: true
        })
    })

    it('records what the declaration that settled the attack named, for artillery that fired', () => {
        const game = frenchTurn([
            french('F01', artillery(), { commanderId: undefined, facing: INTO }),
            allied('A01', infantry(3))
        ])
        threaten(game)
        act(game, ActionType.DeclareDefense, Side.Allied, { unitIds: ['A01'] })
        act(game, ActionType.PressAttack, Side.French)
        act(game, ActionType.LeadDefense, Side.Allied, { leaderIds: [] })
        const ended = endedBy(
            act(game, ActionType.DeclareAttack, Side.French, {
                orders: [{ kind: CommandKind.Unit, unitIds: ['F01'] }],
                wide: false,
                leaderIds: ['F01']
            })
        )
        expect(game.state.attack).toBeUndefined()
        expect(ended).toMatchObject({
            attackingUnitIds: ['F01'],
            artilleryLed: true,
            attackerWon: true
        })
    })

    it('records a feint against blockers, which ends the attack at once', () => {
        const game = frenchTurn([
            french('F01', infantry(3)),
            allied('A01', infantry(3), { facing: FROM })
        ])
        threaten(game)
        const ended = endedBy(
            act(game, ActionType.DeclareFeint, Side.French, {
                orders: corps(['F01']),
                end: FeintEnd.Reserve
            })
        )
        expect(game.state.attack).toBeUndefined()
        expect(ended).toMatchObject({ feint: true })
    })

    it('records a retreat before combat that breaks the defending army', () => {
        const game = frenchTurn([french('F01', infantry(3)), allied('A01', infantry(3))], 1)
        threaten(game)
        const ended = endedBy(
            act(game, ActionType.Retreat, Side.Allied, {
                losses: { A01: 2 },
                destinations: { A01: REFUGE },
                kept: {}
            })
        )
        expect(game.state.victory).toBeDefined()
        expect(ended).toMatchObject({ retreatBeforeCombat: true })
    })

    it('keeps the plans of either side out of the record', () => {
        const game = wonUntilTheRetreat()
        act(game, ActionType.CounterAttack, Side.Allied, { unitIds: [] })
        const [retreated] = retreat(game)
        const toAttacker = NapoleonsTriumphRuntime.visibility.actions.project(retreated, {
            kind: 'player',
            playerId: game.playerOf(Side.French)
        })
        const ended = attackEndedBy(toAttacker)
        expect(ended).toMatchObject({ attackingUnitIds: ['F01', 'F02', 'F03'] })
        for (const field of ['attackPlan', 'defensePlan', 'pending', 'orders', 'awaits']) {
            expect(ended).not.toHaveProperty(field)
        }
    })
})

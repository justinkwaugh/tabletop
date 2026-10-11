import { describe, expect, it } from 'vitest'
import { Side } from '../components/pieces.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import {
    TestGame,
    arrangeBattlefield,
    artillery,
    infantry,
    type PiecePlacement
} from '../testing/harness.js'
import { CommandKind, DecisionKind } from './attack.js'

const ATTACK_FROM = 38
const DEFEND_IN = 51

function pressed(placements: readonly PiecePlacement[], defenders: string[], leaders: string[]) {
    const game = new TestGame()
    game.deployBoth()
    game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
    arrangeBattlefield(game, placements)
    const french = game.playerOf(Side.French)
    game.act(ActionType.ThreatenAttack, french, {
        approach: game.hydrated.map.approachBetween(ATTACK_FROM, DEFEND_IN).id
    })
    game.act(ActionType.DeclareDefense, game.playerOf(Side.Allied), {
        unitIds: defenders,
        leaderIds: leaders
    })
    game.act(ActionType.PressAttack, french)
    return game
}

describe('two batteries combining their Unit Moves to lead an attack', () => {
    const battery = (id: string, commanderId: string): PiecePlacement => ({
        id,
        side: Side.French,
        face: artillery(),
        locale: ATTACK_FROM,
        facing: DEFEND_IN,
        commanderId
    })
    const defender: PiecePlacement = {
        id: 'A-inf',
        side: Side.Allied,
        face: infantry(3),
        locale: DEFEND_IN,
        facing: ATTACK_FROM
    }
    const declaration = {
        orders: [
            { kind: CommandKind.Unit, unitIds: ['F-a1'] },
            { kind: CommandKind.Unit, unitIds: ['F-a2'] }
        ],
        wide: true,
        leaderIds: ['F-a1', 'F-a2']
    }

    it('cannot both leave a corps of two, which would be left a commander alone (rule 8)', () => {
        const game = pressed(
            [battery('F-a1', 'lannes'), battery('F-a2', 'lannes'), defender],
            ['A-inf'],
            []
        )
        expect(() =>
            game.act(ActionType.DeclareAttack, game.playerOf(Side.French), declaration)
        ).toThrow(/last unit/)
        expect(game.hydrated.corpsUnits('lannes')).toHaveLength(2)
    })

    it('may leave a corps that keeps another unit', () => {
        const game = pressed(
            [
                battery('F-a1', 'lannes'),
                battery('F-a2', 'lannes'),
                { ...battery('F-inf', 'lannes'), face: infantry(2) },
                defender
            ],
            ['A-inf'],
            []
        )
        game.act(ActionType.DeclareAttack, game.playerOf(Side.French), declaration)
        const state = game.hydrated
        expect(state.corpsUnits('lannes').map((unit) => unit.id)).toEqual(['F-inf'])
        expect(state.playerOf(Side.French).independentCommandsUsed).toBe(2)
    })
})

describe('the odd loss between two leading units of equal strength', () => {
    const leader = (id: string, commanderId: string): PiecePlacement => ({
        id,
        side: Side.French,
        face: infantry(3),
        locale: ATTACK_FROM,
        commanderId
    })
    const defender: PiecePlacement = {
        id: 'A-inf',
        side: Side.Allied,
        face: infantry(2),
        locale: DEFEND_IN,
        facing: ATTACK_FROM
    }
    const corpsMove = (commanderId: string, unitIds: string[]) => ({
        kind: CommandKind.Corps,
        commanderId,
        unitIds
    })

    it('is the other player’s to place when the two belong to different corps (rule 11, step 9)', () => {
        const game = pressed(
            [leader('F-i1', 'lannes'), leader('F-i2', 'murat'), defender],
            ['A-inf'],
            ['A-inf']
        )
        game.act(ActionType.DeclareAttack, game.playerOf(Side.French), {
            orders: [corpsMove('lannes', ['F-i1']), corpsMove('murat', ['F-i2'])],
            wide: true,
            leaderIds: ['F-i1', 'F-i2']
        })
        const allied = game.playerOf(Side.Allied)
        expect(game.state.machineState).toBe(MachineState.ResolvingAttack)
        expect(game.hydrated.attack?.pending).toEqual([
            { kind: DecisionKind.OddLoss, playerId: allied, unitIds: ['F-i1', 'F-i2'] }
        ])
        game.act(ActionType.AssignLosses, allied, { allocation: { 'F-i2': 1 } })
        expect(game.hydrated.unit('F-i1').face).toEqual(infantry(3))
        expect(game.hydrated.unit('F-i2').face).toEqual(infantry(2))
    })

    it('needs no choice when the two stand in the same corps and cannot be told apart', () => {
        const game = pressed(
            [leader('F-i1', 'lannes'), leader('F-i2', 'lannes'), defender],
            ['A-inf'],
            ['A-inf']
        )
        game.act(ActionType.DeclareAttack, game.playerOf(Side.French), {
            orders: [corpsMove('lannes', ['F-i1', 'F-i2'])],
            wide: true,
            leaderIds: ['F-i1', 'F-i2']
        })
        const faces = ['F-i1', 'F-i2'].map((id) => game.hydrated.unit(id).face?.strength)
        expect(faces.toSorted()).toEqual([2, 3])
        expect(game.hydrated.attack?.pending ?? []).toEqual([])
    })
})

import { describe, expect, it } from 'vitest'
import type { GameAction } from '@tabletop/common'
import { Side } from '../components/pieces.js'
import { ActionType } from '../definition/actions.js'
import { CommandKind } from '../model/attack.js'
import {
    TestGame,
    arrangeBattlefield,
    artillery,
    infantry,
    type PiecePlacement
} from '../testing/harness.js'

const ATTACK_FROM = 38
const DEFEND_IN = 51

const placements: PiecePlacement[] = [
    {
        id: 'F-art',
        side: Side.French,
        face: artillery(),
        locale: ATTACK_FROM,
        facing: DEFEND_IN
    },
    { id: 'F-inf', side: Side.French, face: infantry(2), locale: ATTACK_FROM },
    { id: 'A-inf', side: Side.Allied, face: infantry(3), locale: DEFEND_IN, facing: ATTACK_FROM }
]

function frenchTurn(): TestGame {
    const game = new TestGame()
    game.deployBoth()
    game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
    arrangeBattlefield(game, placements)
    return game
}

function barred(actions: readonly GameAction[]): boolean {
    return actions.some((action) => action.revealsInfo === true)
}

describe('taking an action back', () => {
    it('stays possible after a move, which shows the mover nothing', () => {
        const game = frenchTurn()
        const moved = game.act(ActionType.Move, game.playerOf(Side.French), {
            order: { kind: CommandKind.Unit, unitIds: ['F-inf'] },
            to: {
                locale: ATTACK_FROM,
                approach: game.hydrated.map.approachBetween(ATTACK_FROM, DEFEND_IN).id
            }
        })
        expect(barred(moved)).toBe(false)
    })

    it('stays possible after a threat and after the defence is declared, its leading units still unseen', () => {
        const game = frenchTurn()
        const threat = game.act(ActionType.ThreatenAttack, game.playerOf(Side.French), {
            approach: game.hydrated.map.approachBetween(ATTACK_FROM, DEFEND_IN).id
        })
        const defence = game.act(ActionType.DeclareDefense, game.playerOf(Side.Allied), {
            unitIds: ['A-inf'],
            leaderIds: ['A-inf']
        })
        expect(barred(threat)).toBe(false)
        expect(barred(defence)).toBe(false)
    })

    it('is barred once pressing the attack has shown the defence’s leading units', () => {
        const game = frenchTurn()
        const french = game.playerOf(Side.French)
        game.act(ActionType.ThreatenAttack, french, {
            approach: game.hydrated.map.approachBetween(ATTACK_FROM, DEFEND_IN).id
        })
        game.act(ActionType.DeclareDefense, game.playerOf(Side.Allied), {
            unitIds: ['A-inf'],
            leaderIds: ['A-inf']
        })
        expect(barred(game.act(ActionType.PressAttack, french))).toBe(true)
    })

    it('is barred once an attack’s losses have shown an enemy block that was hidden', () => {
        const game = frenchTurn()
        const french = game.playerOf(Side.French)
        game.act(ActionType.ThreatenAttack, french, {
            approach: game.hydrated.map.approachBetween(ATTACK_FROM, DEFEND_IN).id
        })
        game.act(ActionType.DeclareDefense, game.playerOf(Side.Allied), {
            unitIds: ['A-inf'],
            leaderIds: []
        })
        expect(barred(game.act(ActionType.PressAttack, french))).toBe(false)
        const fired = game.act(ActionType.DeclareAttack, french, {
            orders: [{ kind: CommandKind.Unit, unitIds: ['F-art'] }],
            wide: false,
            leaderIds: ['F-art']
        })
        expect(game.hydrated.unit('A-inf').shown).toEqual(infantry(2))
        expect(barred(fired)).toBe(true)
    })

    it('is barred once the armies have been dealt, whichever army was chosen', () => {
        const game = new TestGame({ sideSelection: 'Auction' })
        const [first] = game.state.activePlayerIds
        game.act(ActionType.PlaceBid, first, { amount: 2 })
        const [second] = game.state.activePlayerIds
        expect(second).not.toBe(first)
        expect(barred(game.act(ActionType.PassBid, second))).toBe(false)
        expect(barred(game.act(ActionType.ChooseSide, first, { side: Side.French }))).toBe(true)
        expect(game.hydrated.playerOf(Side.French).playerId).toBe(first)
    })
})

describe('the morale auction', () => {
    it('passes the bidding back and forth and gives the choice to whoever did not pass', () => {
        const game = new TestGame({ sideSelection: 'Auction' })
        const [first] = game.state.activePlayerIds
        game.act(ActionType.PlaceBid, first, { amount: 1 })
        const [second] = game.state.activePlayerIds
        expect(() => game.act(ActionType.PlaceBid, second, { amount: 1 })).toThrow(/beat/)
        game.act(ActionType.PlaceBid, second, { amount: 3 })
        expect(game.state.activePlayerIds).toEqual([first])
        game.act(ActionType.PassBid, first)
        expect(game.state.activePlayerIds).toEqual([second])
        game.act(ActionType.ChooseSide, second, { side: Side.Allied })
        const allies = game.hydrated.playerOf(Side.Allied)
        expect(allies.playerId).toBe(second)
        expect(allies.morale).toBe(24)
    })

    it('goes to the second bidder at no cost when the first passes at once', () => {
        const game = new TestGame({ sideSelection: 'Auction' })
        const [first] = game.state.activePlayerIds
        game.act(ActionType.PassBid, first)
        const [winner] = game.state.activePlayerIds
        expect(winner).not.toBe(first)
        game.act(ActionType.ChooseSide, winner, { side: Side.Allied })
        expect(game.hydrated.playerOf(Side.Allied).morale).toBe(27)
    })
})

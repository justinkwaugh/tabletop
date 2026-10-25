import { describe, expect, it } from 'vitest'
import { AUSTERLITZ, ActionType, CommandKind, Side } from '@tabletop/napoleons-triumph'
import { TestGame, arrangeBattlefield, cavalry } from '@tabletop/napoleons-triumph/testing'
import { revealedRideLines } from './revealedRide.js'

function riddenToTheEndOfTheTurn(): TestGame {
    const game = new TestGame()
    game.deployBoth()
    game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
    arrangeBattlefield(game, [
        { id: 'F01', side: Side.French, face: cavalry(2), locale: 52, commanderId: 'murat' },
        { id: 'F02', side: Side.French, face: cavalry(3), locale: 52, commanderId: 'murat' },
        { id: 'A01', side: Side.Allied, face: cavalry(2), locale: 63 }
    ])
    const french = game.playerOf(Side.French)
    game.act(ActionType.ThreatenAttack, french, {
        approach: AUSTERLITZ.approachBetween(53, 63).id
    })
    game.act(ActionType.Retreat, game.playerOf(Side.Allied), {
        losses: {},
        destinations: { A01: 64 },
        kept: {}
    })
    game.act(ActionType.Occupy, french, {
        orders: [
            { kind: CommandKind.Corps, commanderId: 'murat', unitIds: ['F01', 'F02'], road: [53] }
        ]
    })
    game.act(ActionType.EndTurn, french)
    return game
}

describe('the cavalry still riding when the last turn ended', () => {
    it('is named with where it stands and what it showed, strongest first', () => {
        expect(revealedRideLines(riddenToTheEndOfTheTurn().hydrated)).toEqual({
            riding: `Murat’s cavalry was still riding in ${AUSTERLITZ.label(63)} when the French turn ended.`,
            revealed: 'It was revealed as a heavy cavalry and a 2-strength cavalry.'
        })
    })

    it('is not mentioned once it has been seen', () => {
        const game = riddenToTheEndOfTheTurn()
        game.act(ActionType.AcknowledgeReveal, game.playerOf(Side.Allied))
        expect(revealedRideLines(game.hydrated)).toBeUndefined()
    })
})

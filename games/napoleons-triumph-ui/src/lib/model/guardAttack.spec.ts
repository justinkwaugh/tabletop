import { describe, expect, it } from 'vitest'
import { ActionType, CommandKind, Side } from '@tabletop/napoleons-triumph'
import {
    TestGame,
    arrangeBattlefield,
    guard,
    infantry,
    type PiecePlacement
} from '@tabletop/napoleons-triumph/testing'
import { guardUnitToAnnounce, targetsOfGuardAttack } from './guardAttack.js'
import { TargetKind, moveTargets, type MoveTarget } from './targets.js'

const FROM = 95
const INTO = 108

const GUARD: PiecePlacement = { id: 'F-guard', side: Side.French, face: guard(), locale: FROM }
const LINE: PiecePlacement = { id: 'F-line', side: Side.French, face: infantry(3), locale: FROM }
const ENEMY: PiecePlacement = { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: INTO }

function frenchTurn(placements: readonly PiecePlacement[]) {
    const game = new TestGame()
    game.deployBoth()
    game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
    arrangeBattlefield(game, placements)
    const state = game.hydrated
    const playerId = game.playerOf(Side.French)
    const targetsOf = (unitId: string): MoveTarget[] =>
        moveTargets(state, playerId, { kind: CommandKind.Unit, unitIds: [unitId] })
    return { game, state, playerId, targetsOf }
}

function threatsIn(targets: readonly MoveTarget[]): MoveTarget[] {
    return targets.filter((target) => target.kind === TargetKind.Attack)
}

describe('announcing a Guard Attack', () => {
    it('is offered for Guard infantry that can threaten across an open approach', () => {
        const { state, playerId, targetsOf } = frenchTurn([GUARD, LINE, ENEMY])
        const targets = targetsOf('F-guard')
        expect(threatsIn(targets).length).toBeGreaterThan(0)
        expect(guardUnitToAnnounce(state, playerId, ['F-guard'], targets)).toBe('F-guard')
    })

    it('is not offered to other infantry, or with nothing to threaten', () => {
        const { state, playerId, targetsOf } = frenchTurn([GUARD, LINE, ENEMY])
        expect(
            guardUnitToAnnounce(state, playerId, ['F-line'], targetsOf('F-line'))
        ).toBeUndefined()

        const alone = frenchTurn([GUARD])
        const quiet = alone.targetsOf('F-guard')
        expect(threatsIn(quiet)).toEqual([])
        expect(guardUnitToAnnounce(alone.state, alone.playerId, ['F-guard'], quiet)).toBeUndefined()
    })

    it('is not offered once the army has forfeited its Guard Attack', () => {
        const { game, playerId, targetsOf } = frenchTurn([GUARD, ENEMY])
        const targets = targetsOf('F-guard')
        game.arrange((state) => {
            state.getPlayerState(playerId).guardAttackForfeited = true
        })
        expect(guardUnitToAnnounce(game.hydrated, playerId, ['F-guard'], targets)).toBeUndefined()
    })

    it('leaves every place to go marked except threats across obstructed approaches', () => {
        const { state, targetsOf } = frenchTurn([GUARD, ENEMY])
        const targets = targetsOf('F-guard')
        const announced = targetsOfGuardAttack(state, targets)
        const open = (target: MoveTarget) =>
            target.kind !== TargetKind.Attack ||
            !state.map.approach(target.position.approach).obstructed
        expect(announced).toEqual(targets.filter(open))
        expect(threatsIn(announced).length).toBeGreaterThan(0)
    })
})

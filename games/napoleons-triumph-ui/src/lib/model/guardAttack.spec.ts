import { describe, expect, it } from 'vitest'
import { ActionType, Side } from '@tabletop/napoleons-triumph'
import {
    TestGame,
    arrangeBattlefield,
    guard,
    infantry,
    type PiecePlacement
} from '@tabletop/napoleons-triumph/testing'
import { guardUnitsToAnnounce } from './guardAttack.js'
import { TargetKind, threatsOn } from './targets.js'

const FROM = 95
const INTO = 108
const ELSEWHERE = 94

const GUARD: PiecePlacement = { id: 'F-guard', side: Side.French, face: guard(), locale: FROM }
const SECOND_GUARD: PiecePlacement = { ...GUARD, id: 'F-guard-2' }
const CORPS_GUARD: PiecePlacement = { ...GUARD, id: 'F-corps-guard', commanderId: 'st-hilaire' }
const LINE: PiecePlacement = { id: 'F-line', side: Side.French, face: infantry(3), locale: FROM }
const ENEMY: PiecePlacement = { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: INTO }

function frenchTurn(placements: readonly PiecePlacement[]) {
    const game = new TestGame()
    game.deployBoth()
    game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
    arrangeBattlefield(game, placements)
    return { game, state: game.hydrated, playerId: game.playerOf(Side.French) }
}

describe('threats aimed at a locale', () => {
    it('are offered across the approach from where pieces can make them, whoever they are', () => {
        const { state, playerId } = frenchTurn([LINE, ENEMY])
        const across = state.map.approachBetween(FROM, INTO).id
        expect(threatsOn(state, playerId, INTO)).toEqual([
            expect.objectContaining({
                kind: TargetKind.Attack,
                position: { locale: FROM, approach: across }
            })
        ])
    })

    it('are not offered at a locale nobody can attack', () => {
        const { state, playerId } = frenchTurn([LINE, ENEMY])
        expect(threatsOn(state, playerId, FROM)).toEqual([])

        const far = frenchTurn([ENEMY])
        expect(threatsOn(far.state, far.playerId, INTO)).toEqual([])
    })
})

describe('the Guard units that could announce a Guard Attack with a threat', () => {
    it('are those standing where the threat starts, whichever pieces were picked up', () => {
        const { state, playerId } = frenchTurn([LINE, GUARD, ENEMY])
        const [threat] = threatsOn(state, playerId, INTO)
        expect(guardUnitsToAnnounce(state, playerId, threat)).toEqual(['F-guard'])
    })

    it('are one for each corps or detached group they stand in, since those of one are alike', () => {
        const alike = frenchTurn([GUARD, SECOND_GUARD, ENEMY])
        const [threat] = threatsOn(alike.state, alike.playerId, INTO)
        expect(guardUnitsToAnnounce(alike.state, alike.playerId, threat)).toEqual(['F-guard'])

        const apart = frenchTurn([GUARD, CORPS_GUARD, ENEMY])
        const [across] = threatsOn(apart.state, apart.playerId, INTO)
        expect(guardUnitsToAnnounce(apart.state, apart.playerId, across).toSorted()).toEqual([
            'F-corps-guard',
            'F-guard'
        ])
    })

    it('leave out other infantry and Guard units standing elsewhere', () => {
        const { state, playerId } = frenchTurn([LINE, { ...GUARD, locale: ELSEWHERE }, ENEMY])
        const [threat] = threatsOn(state, playerId, INTO)
        expect(guardUnitsToAnnounce(state, playerId, threat)).toEqual([])
    })

    it('are, among alike Guard units, one the enemy has already seen', () => {
        const { game, playerId } = frenchTurn([GUARD, SECOND_GUARD, ENEMY])
        game.arrange((state) => {
            const seen = state.units.find((unit) => unit.id === 'F-guard-2')
            if (!seen?.face) throw new Error('Expected the second Guard unit')
            seen.shown = { ...seen.face }
        })
        const state = game.hydrated
        const [threat] = threatsOn(state, playerId, INTO)
        expect(guardUnitsToAnnounce(state, playerId, threat)).toEqual(['F-guard-2'])
    })

    it('are none across an approach obstructed on the attacker’s side', () => {
        const OBSTRUCTED_FROM = 73
        const OBSTRUCTED_INTO = 74
        const { state, playerId } = frenchTurn([
            { ...GUARD, locale: OBSTRUCTED_FROM },
            { ...ENEMY, locale: OBSTRUCTED_INTO }
        ])
        const across = state.map.approachBetween(OBSTRUCTED_FROM, OBSTRUCTED_INTO)
        expect(across.obstructed).toBe(true)
        const [threat] = threatsOn(state, playerId, OBSTRUCTED_INTO)
        expect(threat.position.approach).toBe(across.id)
        expect(guardUnitsToAnnounce(state, playerId, threat)).toEqual([])
    })

    it('are none once the army has forfeited its Guard Attack', () => {
        const { game, playerId } = frenchTurn([GUARD, ENEMY])
        game.arrange((state) => {
            state.getPlayerState(playerId).guardAttackForfeited = true
        })
        const state = game.hydrated
        const [threat] = threatsOn(state, playerId, INTO)
        expect(guardUnitsToAnnounce(state, playerId, threat)).toEqual([])
    })
})

import { describe, expect, it } from 'vitest'
import { ActionType, CommandKind, Side } from '@tabletop/napoleons-triumph'
import {
    TestGame,
    arrangeBattlefield,
    cavalry,
    infantry,
    type PiecePlacement
} from '@tabletop/napoleons-triumph/testing'
import { emptyBattleSelections } from './battleSelection.js'
import { StageKind, battleStageOf } from './battleStage.js'
import { TargetKind, moveTargets } from './targets.js'

const NEAR = 53
const TAKEN = 63
const BEYOND = 64

const rider = { kind: CommandKind.Unit, unitIds: ['F-cav'] }
const ridingOn = { ...rider, continues: true as const }

function screened(attacker: PiecePlacement, beyond: PiecePlacement[] = []): TestGame {
    const game = new TestGame()
    game.deployBoth()
    game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
    arrangeBattlefield(game, [
        attacker,
        { id: 'A-screen', side: Side.Allied, face: cavalry(1), locale: TAKEN },
        ...beyond
    ])
    game.act(ActionType.ThreatenAttack, game.playerOf(Side.French), {
        approach: game.hydrated.map.approachBetween(NEAR, TAKEN).id
    })
    game.act(ActionType.Retreat, game.playerOf(Side.Allied), {
        losses: {},
        destinations: { 'A-screen': 72 },
        kept: {}
    })
    return game
}

const horse: PiecePlacement = { id: 'F-cav', side: Side.French, face: cavalry(2), locale: NEAR }

function stageOf(game: TestGame, plannedUnitIds: string[]) {
    const state = game.hydrated
    const attack = state.attack
    if (!attack) {
        throw new Error('Expected an attack in progress')
    }
    return battleStageOf(state, attack, emptyBattleSelections(), {
        kind: CommandKind.Unit,
        unitIds: plannedUnitIds
    })
}

describe('following up a retreat with cavalry', () => {
    it('offers the move in both ways: plainly, or by road so that the cavalry may ride on', () => {
        const stage = stageOf(screened(horse), ['F-cav'])
        expect(stage).toMatchObject({
            kind: StageKind.Occupation,
            orders: [rider],
            roadOrders: [{ ...rider, road: [] }],
            mayMoveIn: true,
            gunsMayStay: false
        })
    })

    it('offers no road move to infantry', () => {
        const foot: PiecePlacement = {
            id: 'F-inf',
            side: Side.French,
            face: infantry(2),
            locale: NEAR
        }
        const stage = stageOf(screened(foot), ['F-inf'])
        expect(stage).toMatchObject({ kind: StageKind.Occupation, mayMoveIn: true })
        expect(stage).not.toHaveProperty('roadOrders', expect.anything())
    })
})

describe('cavalry riding on', () => {
    function ridden(beyond: PiecePlacement[] = []): TestGame {
        const game = screened(horse, beyond)
        game.act(ActionType.Occupy, game.playerOf(Side.French), {
            orders: [{ ...rider, road: [] }]
        })
        return game
    }

    it('is offered only places along its road', () => {
        const game = ridden()
        const targets = moveTargets(game.hydrated, game.playerOf(Side.French), ridingOn)
        const reserves = targets.filter((target) => target.kind === TargetKind.Reserve)
        expect(reserves.map((target) => target.position.locale)).toContain(BEYOND)
        expect(reserves.every((target) => target.road !== undefined)).toBe(true)
        expect(
            targets.some(
                (target) => target.kind === TargetKind.Approach && target.position.locale === TAKEN
            )
        ).toBe(true)
    })

    it('may threaten the next locale on its road and carries out the threat at no command', () => {
        const game = ridden([
            { id: 'A-line', side: Side.Allied, face: infantry(2), locale: BEYOND }
        ])
        const french = game.playerOf(Side.French)
        const facing = game.hydrated.map.approachBetween(TAKEN, BEYOND).id
        const threats = moveTargets(game.hydrated, french, ridingOn).filter(
            (target) => target.kind === TargetKind.Attack
        )
        expect(threats.map((target) => target.position)).toEqual(
            expect.arrayContaining([{ locale: TAKEN, approach: facing }])
        )
        game.act(ActionType.ThreatenAttack, french, { approach: facing })
        game.act(ActionType.DeclareDefense, game.playerOf(Side.Allied), {
            unitIds: ['A-line'],
            leaderIds: []
        })
        expect(stageOf(game, ['F-cav'])).toMatchObject({
            kind: StageKind.Feint,
            attackers: ['F-cav'],
            orders: [{ ...ridingOn, road: [] }],
            canPress: false
        })
    })
})

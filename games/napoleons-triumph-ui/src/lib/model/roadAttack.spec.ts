import { describe, expect, it } from 'vitest'
import { ActionType, CommandKind, Side } from '@tabletop/napoleons-triumph'
import {
    TestGame,
    arrangeBattlefield,
    cavalry,
    RIDDEN_IN,
    infantry,
    reinforcementCavalryRiddenIn,
    type PiecePlacement
} from '@tabletop/napoleons-triumph/testing'
import {
    StageKind,
    emptyBattleSelections,
    setAttackRide,
    type BattleSelections
} from './battleSelection.js'
import { battleStageOf } from './battleStage.js'
import { RideChoice } from './moveCommands.js'
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
        approach: game.hydrated.map.approachBetween(NEAR, TAKEN).id,
        plan: { kind: CommandKind.Unit, unitIds: [attacker.id] }
    })
    game.act(ActionType.Retreat, game.playerOf(Side.Allied), {
        losses: {},
        destinations: { 'A-screen': 72 },
        kept: {}
    })
    return game
}

const horse: PiecePlacement = { id: 'F-cav', side: Side.French, face: cavalry(2), locale: NEAR }

function stageOf(game: TestGame, selections: BattleSelections = emptyBattleSelections()) {
    const state = game.hydrated
    const attack = state.attack
    if (!attack) {
        throw new Error('Expected an attack in progress')
    }
    return battleStageOf(state, attack, selections)
}

describe('following up a retreat with cavalry', () => {
    it('offers the move in both ways: plainly, or by road so that the cavalry may ride on', () => {
        const stage = stageOf(screened(horse))
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
        const stage = stageOf(screened(foot))
        expect(stage).toMatchObject({ kind: StageKind.Occupation, mayMoveIn: true })
        expect(stage).not.toHaveProperty('roadOrders', expect.anything())
    })
})

describe('the command a road attack is made by', () => {
    const WEST = 52
    const rider = (id: string) => ({
        id,
        side: Side.French,
        face: cavalry(2),
        locale: WEST,
        commanderId: 'murat'
    })

    function feinting(plan: { kind: CommandKind; unitIds: string[] }) {
        const game = new TestGame()
        game.deployBoth()
        game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
        arrangeBattlefield(game, [
            rider('F-c1'),
            rider('F-c2'),
            { id: 'A-line', side: Side.Allied, face: infantry(2), locale: TAKEN }
        ])
        game.act(ActionType.ThreatenAttack, game.playerOf(Side.French), {
            approach: game.hydrated.map.approachBetween(NEAR, TAKEN).id,
            plan
        })
        game.act(ActionType.DeclareDefense, game.playerOf(Side.Allied), {
            unitIds: ['A-line'],
            leaderIds: []
        })
        return stageOf(game)
    }

    it('is a Unit Move for one unit of a corps, with the Corps Move there to choose', () => {
        const stage = feinting({ kind: CommandKind.Unit, unitIds: ['F-c1'] })
        expect(stage).toMatchObject({
            kind: StageKind.Feint,
            attackers: ['F-c1'],
            commandOptions: [CommandKind.Unit, CommandKind.Corps],
            command: CommandKind.Unit
        })
        expect(stage).toHaveProperty('orders', [
            { kind: CommandKind.Unit, unitIds: ['F-c1'], road: [NEAR] }
        ])
    })

    it('is the Corps Move, taking the commander along, when that is the command chosen', () => {
        const stage = feinting({ kind: CommandKind.Corps, unitIds: ['F-c1'] })
        expect(stage).toMatchObject({ command: CommandKind.Corps })
        expect(stage).toHaveProperty('orders', [
            { kind: CommandKind.Corps, commanderId: 'murat', unitIds: ['F-c1'], road: [NEAR] }
        ])
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
        expect(reserves.every((target) => target.ways !== undefined)).toBe(true)
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
        game.act(ActionType.ThreatenAttack, french, { approach: facing, plan: rider })
        game.act(ActionType.DeclareDefense, game.playerOf(Side.Allied), {
            unitIds: ['A-line'],
            leaderIds: []
        })
        expect(stageOf(game)).toMatchObject({
            kind: StageKind.Feint,
            attackers: ['F-cav'],
            orders: [{ ...ridingOn, road: [] }],
            canPress: false,
            feinting: true
        })
    })
})

describe('cavalry reinforcements riding on in their turn of entry', () => {
    const { taken: RIDDEN_INTO, held: HELD, corps } = RIDDEN_IN
    const ride = { ...corps, road: [], continues: true as const }
    const ridden = reinforcementCavalryRiddenIn

    function threatening(plan: { continues?: true }): TestGame {
        const game = ridden()
        game.act(ActionType.ThreatenAttack, game.playerOf(Side.French), {
            approach: game.hydrated.map.approachBetween(RIDDEN_INTO, HELD).id,
            plan: { kind: CommandKind.Corps, unitIds: ['F-off'], ...plan }
        })
        return game
    }

    function standing(plan: { continues?: true }): TestGame {
        const game = threatening(plan)
        game.act(ActionType.DeclareDefense, game.playerOf(Side.Allied), {
            unitIds: ['A-line'],
            leaderIds: []
        })
        return game
    }

    function givingWay(plan: { continues?: true }): TestGame {
        const game = threatening(plan)
        game.act(ActionType.Retreat, game.playerOf(Side.Allied), {
            losses: { 'A-line': 1 },
            destinations: { 'A-line': 53 },
            kept: {}
        })
        return game
    }

    it('may go by road again under a new command, with a fresh allowance of road', () => {
        const game = ridden()
        const french = game.playerOf(Side.French)
        const riding = moveTargets(game.hydrated, french, { ...corps, continues: true })
        const anew = moveTargets(game.hydrated, french, corps)
        const reached = (targets: typeof anew) =>
            targets
                .filter((target) => target.kind === TargetKind.Reserve)
                .map((target) => target.position.locale)
        expect(reached(anew).length).toBeGreaterThan(reached(riding).length)
        expect(anew.some((target) => target.kind === TargetKind.Attack)).toBe(true)
    })

    it('follows up a retreat riding on unless a new command was meant, and may be switched', () => {
        const ridingOn = stageOf(givingWay({ continues: true }))
        expect(ridingOn).toMatchObject({
            kind: StageKind.Occupation,
            attackers: ['F-off'],
            ride: RideChoice.RidingOn,
            orders: [ride],
            byRoad: true
        })
        expect(ridingOn).toHaveProperty('groups', [
            expect.objectContaining({ label: 'Riding on by road' })
        ])

        const game = givingWay({})
        expect(stageOf(game)).toMatchObject({
            ride: RideChoice.NewCommand,
            orders: [corps],
            roadOrders: [{ ...corps, road: [] }],
            mayMoveIn: true,
            byRoad: false
        })
        const switched = {
            ...emptyBattleSelections(),
            attackers: setAttackRide(emptyBattleSelections().attackers, RideChoice.RidingOn)
        }
        expect(stageOf(game, switched)).toMatchObject({ ride: RideChoice.RidingOn, orders: [ride] })
    })

    it('feints either way when the defence stands', () => {
        expect(stageOf(standing({ continues: true }))).toMatchObject({
            kind: StageKind.Feint,
            canPress: true,
            ride: RideChoice.RidingOn,
            orders: [ride]
        })
        expect(stageOf(standing({}))).toMatchObject({
            ride: RideChoice.NewCommand,
            orders: [corps]
        })
    })

    it('presses an attack only by a new command, whatever it meant when it threatened', () => {
        const game = standing({ continues: true })
        game.act(ActionType.PressAttack, game.playerOf(Side.French))
        const stage = stageOf(game)
        expect(stage).toMatchObject({
            kind: StageKind.Declaration,
            attackers: ['F-off'],
            orders: [corps],
            commandOptions: [CommandKind.Corps]
        })
        expect(stage).not.toHaveProperty('ride', expect.anything())
        expect(stage).not.toHaveProperty('problem', expect.anything())
        expect(stage).toHaveProperty('groups', [expect.objectContaining({ label: 'In reserve' })])
    })
})

describe('cavalry riding on that is no reinforcement', () => {
    it('has no new command to take, in an attack or out of it', () => {
        const game = screened(horse, [
            { id: 'A-line', side: Side.Allied, face: infantry(2), locale: BEYOND }
        ])
        const french = game.playerOf(Side.French)
        game.act(ActionType.Occupy, french, { orders: [{ ...rider, road: [] }] })
        expect(moveTargets(game.hydrated, french, rider)).toEqual([])
        game.act(ActionType.ThreatenAttack, french, {
            approach: game.hydrated.map.approachBetween(TAKEN, BEYOND).id,
            plan: rider
        })
        game.act(ActionType.Retreat, game.playerOf(Side.Allied), {
            losses: { 'A-line': 2 },
            destinations: {},
            kept: {}
        })
        const stage = stageOf(game)
        expect(stage).toMatchObject({ kind: StageKind.Occupation, orders: [ridingOn] })
        expect(stage).not.toHaveProperty('ride', expect.anything())
    })
})

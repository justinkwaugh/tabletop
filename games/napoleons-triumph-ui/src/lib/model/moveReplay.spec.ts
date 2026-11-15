import { describe, expect, it } from 'vitest'
import { assertExists, type GameAction, type Point } from '@tabletop/common'
import {
    ActionType,
    CommandKind,
    FeintEnd,
    Side,
    type MoveOrder
} from '@tabletop/napoleons-triumph'
import {
    RIDDEN_IN,
    TestGame,
    arrangeBattlefield,
    cavalry,
    infantry,
    waitOffMap
} from '@tabletop/napoleons-triumph/testing'
import {
    APPROACH_GEOMETRY,
    BOARD_HEIGHT,
    BOARD_WIDTH,
    LOCALE_GEOMETRY
} from '$lib/map/boardGeometry.js'
import { coveredBy } from '$lib/utils/blockShape.js'
import { BoardView, toView, viewRotation } from '$lib/utils/boardView.js'
import { layoutPieces } from '$lib/utils/pieceLayout.js'
import { BattleRole } from './battleStage.js'
import { AttackMarkKind } from './attackMark.js'
import { moveReplayOf, moveReplayScene, type MoveReplay } from './moveReplay.js'
import { TargetKind, moveTargets } from './targets.js'

const NORTH = viewRotation(BoardView.North)
const CAPTION = { time: '7:00AM', text: 'A move' }

class Recorded {
    readonly game = new TestGame()
    readonly actions: GameAction[] = []

    act(type: ActionType, side: Side, payload: Record<string, unknown> = {}): GameAction {
        const processed = this.game.act(type, this.game.playerOf(side), payload)
        this.actions.push(...processed)
        return processed[0]
    }

    replayOf(action: GameAction): MoveReplay | undefined {
        return moveReplayOf({ state: this.game.state, actions: this.actions }, action.id, CAPTION)
    }

    replay(action: GameAction): MoveReplay {
        const replay = this.replayOf(action)
        assertExists(replay, 'Expected the action to be replayed')
        return replay
    }
}

function deployed(): Recorded {
    const recorded = new Recorded()
    recorded.actions.push(
        ...recorded.game.deploy(Side.Allied),
        ...recorded.game.deploy(Side.French)
    )
    return recorded
}

function corpsOrder(recorded: Recorded, commanderId: string, unitIds?: string[]): MoveOrder {
    return {
        kind: unitIds ? CommandKind.Detach : CommandKind.Corps,
        commanderId,
        unitIds: unitIds ?? recorded.game.hydrated.corpsUnits(commanderId).map((unit) => unit.id)
    }
}

function langeronTo94(recorded: Recorded): GameAction {
    return recorded.act(ActionType.Move, Side.Allied, {
        order: corpsOrder(recorded, 'langeron'),
        to: { locale: 94 }
    })
}

const idsOf = (blocks: readonly { unit: { id: string } }[]) => blocks.map((block) => block.unit.id)

describe('what the history can replay', () => {
    it('is a move, with the pieces as they stood before and after it', () => {
        const recorded = deployed()
        const replay = recorded.replay(langeronTo94(recorded))
        const whereWas = (standing: MoveReplay['before']) =>
            standing.commanders.find((commander) => commander.id === 'langeron')?.position?.locale
        expect(replay).toMatchObject({ index: 2, ...CAPTION })
        expect(whereWas(replay.before)).toBe(106)
        expect(whereWas(replay.after)).toBe(94)
    })

    it('reads an earlier move past the actions made since, leaving the game where it stands', () => {
        const recorded = deployed()
        const first = langeronTo94(recorded)
        recorded.act(ActionType.Move, Side.Allied, {
            order: corpsOrder(recorded, 'dokhturov'),
            to: { locale: 105 }
        })
        const standing = structuredClone(recorded.game.state)
        const replay = recorded.replay(first)
        const dokhturov = (pieces: MoveReplay['before']) =>
            pieces.commanders.find((commander) => commander.id === 'dokhturov')?.position?.locale
        expect(dokhturov(replay.after)).toBe(dokhturov(replay.before))
        expect(dokhturov(replay.after)).not.toBe(105)
        expect(recorded.game.state).toEqual(standing)
    })

    it('is not an action that leaves every piece where it stood and belongs to no attack', () => {
        const recorded = deployed()
        langeronTo94(recorded)
        const turnEnd = recorded.act(ActionType.EndTurn, Side.Allied)
        expect(recorded.replayOf(turnEnd)).toBeUndefined()
    })

    it('is an army set out on the map, shown where it was set down with nothing moving', () => {
        const recorded = deployed()
        const [deployment] = recorded.actions
        const scene = moveReplayScene(recorded.replay(deployment), NORTH)
        expect(scene.arrows).toEqual([])
        expect(scene.left).toEqual([])
        expect(scene.attackMark).toBeUndefined()
        expect(scene.sprites.length).toBeGreaterThan(0)
    })

    it('is not an action the record cannot be read back to, nor one that is not in it', () => {
        const recorded = deployed()
        const first = langeronTo94(recorded)
        const second = recorded.act(ActionType.Move, Side.Allied, {
            order: corpsOrder(recorded, 'dokhturov'),
            to: { locale: 105 }
        })
        const sealed = recorded.actions.map((action) =>
            action.id === second.id ? { ...action, undoPatch: undefined } : action
        )
        const record = { state: recorded.game.state, actions: sealed }
        expect(moveReplayOf(record, first.id, CAPTION)).toBeUndefined()
        expect(moveReplayOf(record, second.id, CAPTION)).toBeUndefined()
        expect(moveReplayOf(record, 'no such action', CAPTION)).toBeUndefined()
    })

    it('is a retreat, with an arrow to each locale the units went to', () => {
        const recorded = deployed()
        recorded.act(ActionType.EndTurn, Side.Allied)
        arrangeBattlefield(recorded.game, [
            { id: 'F-inf', side: Side.French, face: infantry(2), locale: 53 },
            { id: 'A-1', side: Side.Allied, face: cavalry(1), locale: 63 },
            { id: 'A-2', side: Side.Allied, face: cavalry(1), locale: 63 }
        ])
        recorded.actions.length = 0
        const threat = recorded.act(ActionType.ThreatenAttack, Side.French, {
            approach: recorded.game.hydrated.map.approachBetween(53, 63).id
        })
        const retreat = recorded.act(ActionType.Retreat, Side.Allied, {
            losses: {},
            destinations: { 'A-1': 64, 'A-2': 72 },
            kept: {}
        })
        const occupation = recorded.act(ActionType.Occupy, Side.French, {
            orders: [{ kind: CommandKind.Unit, unitIds: ['F-inf'] }]
        })
        const threatened = moveReplayScene(recorded.replay(threat), NORTH)
        expect(threatened.arrows).toEqual([])
        expect(threatened.attackMark).toMatchObject({
            approach: recorded.game.hydrated.map.approachBetween(53, 63).id,
            kind: AttackMarkKind.Threat
        })
        const scene = moveReplayScene(recorded.replay(retreat), NORTH)
        expect(idsOf(scene.left).toSorted()).toEqual(['A-1', 'A-2'])
        expect(scene.arrows).toHaveLength(2)
        expect(scene.attackMark?.kind).toBe(AttackMarkKind.Threat)
        const moved = moveReplayScene(recorded.replay(occupation), NORTH)
        expect(idsOf(moved.left)).toEqual(['F-inf'])
        expect(moved.arrows).toHaveLength(1)
        expect(moved.attackMark).toBeUndefined()
    })

    it('is cavalry taking a locale by road, with its arrow along the road through the locale it attacked from', () => {
        const recorded = deployed()
        arrangeBattlefield(recorded.game, [
            { id: 'A-cav', side: Side.Allied, face: cavalry(2), locale: 74 },
            { id: 'F-inf', side: Side.French, face: infantry(2), locale: 72 }
        ])
        recorded.actions.length = 0
        const rider = { kind: CommandKind.Unit, unitIds: ['A-cav'] }
        recorded.act(ActionType.ThreatenAttack, Side.Allied, {
            approach: recorded.game.hydrated.map.approachBetween(73, 72).id,
            plan: rider
        })
        recorded.act(ActionType.Retreat, Side.French, {
            losses: { 'F-inf': 1 },
            destinations: { 'F-inf': 83 },
            kept: {}
        })
        const occupation = recorded.act(ActionType.Occupy, Side.Allied, {
            orders: [{ ...rider, road: [73] }]
        })
        const [arrow] = moveReplayScene(recorded.replay(occupation), NORTH).arrows
        expect(arrow.shaft).toContainEqual(LOCALE_GEOMETRY[73].anchor)
    })

    it('is reinforcement cavalry taking a locale by road, with its arrow from the edge of the field', () => {
        const { entry, taken, corps } = RIDDEN_IN
        const recorded = deployed()
        recorded.act(ActionType.EndTurn, Side.Allied)
        arrangeBattlefield(recorded.game, [
            { id: 'A-screen', side: Side.Allied, face: cavalry(1), locale: taken }
        ])
        waitOffMap(recorded.game, corps.commanderId, [{ id: 'F-off', face: cavalry(2) }])
        recorded.actions.length = 0
        const { map } = recorded.game.hydrated
        const mainRoad = map
            .entries(Side.French)
            .find((candidate) => candidate.locale === entry && candidate.main)
        assertExists(mainRoad, 'Expected a main road onto the field')
        recorded.act(ActionType.ThreatenAttack, Side.French, {
            approach: map.approachBetween(entry, taken).id
        })
        recorded.act(ActionType.Retreat, Side.Allied, {
            losses: {},
            destinations: { 'A-screen': 39 },
            kept: {}
        })
        const occupation = recorded.act(ActionType.Occupy, Side.French, {
            orders: [{ ...corps, entryId: mainRoad.id, road: [entry] }]
        })
        const scene = moveReplayScene(recorded.replay(occupation), NORTH)
        expect(scene.left).toEqual([])
        expect(scene.arrows).toHaveLength(1)
        expect(scene.arrows[0].shaft).toContainEqual(LOCALE_GEOMETRY[entry].anchor)
    })

    function standsAgainstAThreat(defenders: string[]) {
        const recorded = deployed()
        recorded.act(ActionType.EndTurn, Side.Allied)
        arrangeBattlefield(recorded.game, [
            { id: 'F-inf', side: Side.French, face: infantry(3), locale: 53 },
            {
                id: 'A-1',
                side: Side.Allied,
                face: infantry(2),
                locale: 63,
                commanderId: 'langeron'
            },
            {
                id: 'A-2',
                side: Side.Allied,
                face: infantry(2),
                locale: 63,
                commanderId: 'langeron'
            }
        ])
        recorded.actions.length = 0
        const approach = recorded.game.hydrated.map.approachBetween(53, 63).id
        recorded.act(ActionType.ThreatenAttack, Side.French, { approach })
        const defence = recorded.act(ActionType.DeclareDefense, Side.Allied, {
            unitIds: defenders
        })
        return { recorded, approach, defence }
    }

    it('is a feint, with the arrow of the attack curled back', () => {
        const { recorded, approach } = standsAgainstAThreat(['A-1'])
        const feint = recorded.act(ActionType.DeclareFeint, Side.French, {
            orders: [{ kind: CommandKind.Unit, unitIds: ['F-inf'] }],
            end: FeintEnd.Reserve
        })
        const scene = moveReplayScene(recorded.replay(feint), NORTH)
        expect(scene.attackMark).toMatchObject({ approach, kind: AttackMarkKind.Feint })
    })

    it('is the defender stepping up after a feint, shown by where it went: no arrow of the attack, the corps it left solid', () => {
        const { recorded } = standsAgainstAThreat(['A-1'])
        recorded.act(ActionType.DeclareFeint, Side.French, {
            orders: [{ kind: CommandKind.Unit, unitIds: ['F-inf'] }],
            end: FeintEnd.Reserve
        })
        const advance = recorded.act(ActionType.Advance, Side.Allied, {
            unitIds: ['A-1'],
            commanderIds: []
        })
        const scene = moveReplayScene(recorded.replay(advance), NORTH)
        expect(scene.attackMark).toBeUndefined()
        expect(idsOf(scene.left)).toEqual(['A-1'])
        expect(scene.arrows).toHaveLength(1)
        expect(scene.bystanderIds).toEqual([])
    })

    it('shows the opponent the place a unit stepped up from at the end of its stack towards the approach, whichever unit it was', () => {
        const steppedUp = (unitId: string, reader: Side) => {
            const { recorded, approach } = standsAgainstAThreat([unitId])
            recorded.act(ActionType.DeclareFeint, Side.French, {
                orders: [{ kind: CommandKind.Unit, unitIds: ['F-inf'] }],
                end: FeintEnd.Reserve
            })
            const advance = recorded.act(ActionType.Advance, Side.Allied, {
                unitIds: [unitId],
                commanderIds: []
            })
            const scene = moveReplayScene(
                recorded.replay(advance),
                NORTH,
                recorded.game.playerOf(reader)
            )
            const { map } = recorded.game.hydrated
            const bar = APPROACH_GEOMETRY[map.approachBetween(63, 53).id].centre
            const fromTheBar = (block: { centre: Point }) =>
                Math.hypot(block.centre.x - bar.x, block.centre.y - bar.y)
            const stayed = scene.sprites
                .filter(({ group }) => group.position.approach === undefined)
                .flatMap((sprite) => sprite.blocks)
                .filter((block) => ['A-1', 'A-2'].includes(block.unit.id))
            expect(approach).toBeDefined()
            return { left: scene.left[0], stayed, fromTheBar }
        }
        const first = steppedUp('A-1', Side.French)
        const second = steppedUp('A-2', Side.French)
        expect(second.left.centre).toEqual(first.left.centre)
        for (const { left, stayed, fromTheBar } of [first, second]) {
            expect(stayed).toHaveLength(1)
            expect(fromTheBar(left)).toBeLessThan(fromTheBar(stayed[0]))
        }
        expect(steppedUp('A-2', Side.Allied).left.centre).not.toEqual(
            steppedUp('A-1', Side.Allied).left.centre
        )
    })

    it('is a step of an attack that moves nothing, with each piece marked for what it was doing', () => {
        const { recorded, defence } = standsAgainstAThreat(['A-1', 'A-2'])
        const scene = moveReplayScene(recorded.replay(defence), NORTH)
        expect(scene.arrows).toEqual([])
        expect(scene.roles).toMatchObject({ 'A-1': BattleRole.Defends, 'A-2': BattleRole.Defends })
        expect(scene.attackMark?.kind).toBe(AttackMarkKind.Threat)
    })

    it('washes out only the units standing with those an action names, and none when it names no unit', () => {
        const { recorded, defence } = standsAgainstAThreat(['A-1'])
        const [threat] = recorded.actions
        const defended = moveReplayScene(recorded.replay(defence), NORTH)
        expect(defended.bystanderIds).toEqual(['A-2'])
        expect(moveReplayScene(recorded.replay(threat), NORTH).bystanderIds).toEqual([])
    })

    it('shows a unit destroyed in the fight washed out where it stood', () => {
        const { recorded } = standsAgainstAThreat(['A-1'])
        recorded.act(ActionType.PressAttack, Side.French)
        recorded.act(ActionType.LeadDefense, Side.Allied, { leaderIds: ['A-1'] })
        const fight = recorded.act(ActionType.DeclareAttack, Side.French, {
            orders: [{ kind: CommandKind.Unit, unitIds: ['F-inf'] }],
            wide: false,
            leaderIds: ['F-inf']
        })
        const scene = moveReplayScene(recorded.replay(fight), NORTH)
        expect(recorded.game.hydrated.findUnit('A-1')).toBeUndefined()
        expect(idsOf(scene.left)).toContain('A-1')
        expect(idsOf(scene.sprites.flatMap((sprite) => sprite.blocks))).not.toContain('A-1')
    })
})

describe('the scene of a move taken from the history', () => {
    it('shows a corps where it went and the places it left where it stood', () => {
        const recorded = deployed()
        const stood = layoutPieces(recorded.game.hydrated, { rotation: NORTH })
            .flatMap((sprite) => sprite.blocks)
            .filter((block) => block.unit.commanderId === 'langeron')
        const scene = moveReplayScene(recorded.replay(langeronTo94(recorded)), NORTH)
        expect(scene.left.map(({ unit, centre }) => ({ id: unit.id, centre }))).toEqual(
            stood.map(({ unit, centre }) => ({ id: unit.id, centre }))
        )
        const corps = scene.sprites.filter((sprite) => sprite.group.commander?.id === 'langeron')
        expect(corps).toHaveLength(1)
        expect(corps[0].group.position).toEqual({ locale: 94 })
        expect(idsOf(corps[0].blocks).toSorted()).toEqual(idsOf(scene.left).toSorted())
    })

    it('draws one arrow from the places left to the pieces, clear of both', () => {
        const recorded = deployed()
        const scene = moveReplayScene(recorded.replay(langeronTo94(recorded)), NORTH)
        const arrived = scene.sprites
            .filter((sprite) => sprite.group.commander?.id === 'langeron')
            .flatMap((sprite) => sprite.blocks)
        expect(scene.arrows).toHaveLength(1)
        const [{ shaft, tip }] = scene.arrows
        const [tail] = shaft
        expect(coveredBy(scene.left)(tail)).toBe(false)
        expect(coveredBy(arrived)(tip)).toBe(false)
        const fromArrived = (point: Point) =>
            Math.hypot(point.x - arrived[0].centre.x, point.y - arrived[0].centre.y)
        expect(fromArrived(tip)).toBeLessThan(fromArrived(tail))
    })

    it('keeps a corps that some units left in the shape it had, with their places left open', () => {
        const recorded = deployed()
        const [first, second, ...staying] = recorded.game.hydrated
            .corpsUnits('dokhturov')
            .map((unit) => unit.id)
        const stood = layoutPieces(recorded.game.hydrated, { rotation: NORTH })
            .flatMap((sprite) => sprite.blocks)
            .filter((block) => block.unit.commanderId === 'dokhturov')
        const detached = recorded.act(ActionType.Move, Side.Allied, {
            order: corpsOrder(recorded, 'dokhturov', [first, second]),
            to: { locale: 105 }
        })
        const scene = moveReplayScene(recorded.replay(detached), NORTH)
        const corps = scene.sprites.find((sprite) => sprite.group.commander?.id === 'dokhturov')
        assertExists(corps, 'Expected the rest of the corps to stand where it was')
        expect(idsOf(corps.blocks).toSorted()).toEqual(staying.toSorted())
        expect(corps.group.units.map((unit) => unit.id).toSorted()).toEqual(staying.toSorted())
        expect(idsOf(scene.left).toSorted()).toEqual([first, second].toSorted())
        const placeOf = (id: string) => stood.find((block) => block.unit.id === id)?.centre
        for (const block of [...corps.blocks, ...scene.left]) {
            expect(block.centre).toEqual(placeOf(block.unit.id))
        }
        const onTheRest = coveredBy(corps.blocks)
        expect(scene.left.some((block) => onTheRest(block.centre))).toBe(false)
    })

    it('marks an approach the pieces moved up to as held, and keeps flags off the way', () => {
        const recorded = deployed()
        const approach = recorded.game.hydrated.map.approachBetween(106, 94).id
        const blocked = recorded.act(ActionType.Move, Side.Allied, {
            order: corpsOrder(recorded, 'langeron'),
            to: { locale: 106, approach }
        })
        const scene = moveReplayScene(recorded.replay(blocked), NORTH)
        expect(scene.held).toContainEqual({
            approach,
            playerId: recorded.game.playerOf(Side.Allied)
        })
        expect(scene.left).not.toHaveLength(0)
        expect(scene.arrows).toHaveLength(1)
        expect(scene.keptClear).toContainEqual(scene.arrows[0].tip)
    })

    it('brings reinforcements on from the edge of the field, with no place left behind', () => {
        const recorded = deployed()
        recorded.act(ActionType.EndTurn, Side.Allied)
        const french = recorded.game.playerOf(Side.French)
        const order = corpsOrder(recorded, 'bernadotte')
        const entries = recorded.game.hydrated.map.entries(Side.French).map((entry) => entry.id)
        const target = moveTargets(recorded.game.hydrated, french, order, entries).find(
            (candidate) => candidate.kind === TargetKind.Reserve
        )
        const way = target?.ways?.at(0)
        assertExists(target, 'Expected somewhere for the reinforcements to enter')
        assertExists(way, 'Expected the reinforcements to enter by road')
        const entered = recorded.act(ActionType.Move, Side.French, {
            order: { ...order, ...way },
            to: target.position
        })
        const scene = moveReplayScene(recorded.replay(entered), NORTH)
        expect(scene.left).toEqual([])
        expect(scene.arrows).toHaveLength(1)
        const [{ shaft, tip }] = scene.arrows
        const [tail] = shaft
        expect(tail.x).toBeGreaterThan(0)
        expect(tail.x).toBeLessThan(BOARD_WIDTH)
        expect(tail.y).toBeGreaterThan(0)
        expect(tail.y).toBeLessThan(BOARD_HEIGHT)
        const arrived = scene.sprites
            .filter((sprite) => sprite.group.commander?.id === 'bernadotte')
            .flatMap((sprite) => sprite.blocks)
        expect(coveredBy(arrived)(tip)).toBe(false)
    })

    it('frames the move within the board, as the board is turned', () => {
        for (const view of [BoardView.North, BoardView.Allied, BoardView.French]) {
            const recorded = deployed()
            const rotation = viewRotation(view)
            const { focus, left, arrows } = moveReplayScene(
                recorded.replay(langeronTo94(recorded)),
                rotation
            )
            expect(focus.width / focus.height).toBeCloseTo(4 / 3)
            const shown = [
                ...left.map((block) => block.centre),
                ...arrows.map((arrow) => arrow.tip)
            ]
            for (const point of shown) {
                const onScreen = toView(point, rotation)
                expect(onScreen.x).toBeGreaterThan(focus.x)
                expect(onScreen.x).toBeLessThan(focus.x + focus.width)
                expect(onScreen.y).toBeGreaterThan(focus.y)
                expect(onScreen.y).toBeLessThan(focus.y + focus.height)
            }
        }
    })
})

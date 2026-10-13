import { describe, expect, it } from 'vitest'
import type { GameAction, Point } from '@tabletop/common'
import { ActionType, CommandKind, FeintEnd, Side } from '@tabletop/napoleons-triumph'
import {
    TestGame,
    arrangeBattlefield,
    cavalry,
    infantry
} from '@tabletop/napoleons-triumph/testing'
import { LOCALE_GEOMETRY } from '$lib/map/boardGeometry.js'
import { coveredBy } from '$lib/utils/blockShape.js'
import { BoardView, screenAxes, viewRotation } from '$lib/utils/boardView.js'
import { layoutPieces, type BlockSprite } from '$lib/utils/pieceLayout.js'
import { turnTrails, type Trail } from './turnTrails.js'

const VIEW = { rotation: viewRotation(BoardView.North) }

class Recorded {
    readonly game = new TestGame()
    readonly actions: GameAction[] = []

    constructor() {
        this.actions.push(...this.game.deploy(Side.Allied), ...this.game.deploy(Side.French))
    }

    act(type: ActionType, side: Side, payload: Record<string, unknown> = {}) {
        this.actions.push(...this.game.act(type, this.game.playerOf(side), payload))
    }

    standing(): BlockSprite[] {
        return layoutPieces(this.game.hydrated, VIEW).flatMap((sprite) => sprite.blocks)
    }

    trails(): Trail[] {
        return turnTrails({ state: this.game.state, actions: this.actions }, this.standing(), VIEW)
    }
}

function near(point: Point, locale: number): boolean {
    const { anchor } = LOCALE_GEOMETRY[locale]
    return Math.hypot(point.x - anchor.x, point.y - anchor.y) < 200
}

function moveLangeronTo94(recorded: Recorded) {
    recorded.act(ActionType.Move, Side.Allied, {
        order: {
            kind: CommandKind.Corps,
            commanderId: 'langeron',
            unitIds: recorded.game.hydrated.corpsUnits('langeron').map((unit) => unit.id)
        },
        to: { locale: 94 }
    })
}

describe('the trails of the turn in progress', () => {
    it('are none before anything has moved', () => {
        expect(new Recorded().trails()).toEqual([])
    })

    it('run from where a corps stood to just short of where it stands', () => {
        const recorded = new Recorded()
        moveLangeronTo94(recorded)
        const [trail, ...others] = recorded.trails()
        const tip = trail.line[trail.line.length - 1]
        expect(others).toEqual([])
        expect(trail.order).toBe(1)
        expect(near(trail.line[0], 106)).toBe(true)
        expect(near(tip, 94)).toBe(true)
        expect(coveredBy(recorded.standing(), 0)(tip)).toBe(false)
    })

    it('are gone once the turn ends', () => {
        const recorded = new Recorded()
        moveLangeronTo94(recorded)
        recorded.act(ActionType.EndTurn, Side.Allied)
        expect(recorded.trails()).toEqual([])
    })

    it('number the moves in the order they were made, the arrows of one action alike, and meet where a unit moved twice stopped', () => {
        const recorded = new Recorded()
        recorded.act(ActionType.EndTurn, Side.Allied)
        arrangeBattlefield(recorded.game, [
            { id: 'F-inf', side: Side.French, face: infantry(3), locale: 53 },
            { id: 'F-cav', side: Side.French, face: cavalry(3), locale: 54 },
            { id: 'A-1', side: Side.Allied, face: cavalry(2), locale: 63 },
            { id: 'A-2', side: Side.Allied, face: cavalry(1), locale: 63 }
        ])
        recorded.actions.length = 0
        const { map } = recorded.game.hydrated
        recorded.act(ActionType.ThreatenAttack, Side.French, {
            approach: map.approachBetween(53, 63).id
        })
        recorded.act(ActionType.Retreat, Side.Allied, {
            losses: {},
            destinations: { 'A-1': 64, 'A-2': 72 },
            kept: {}
        })
        recorded.act(ActionType.Occupy, Side.French, {
            orders: [{ kind: CommandKind.Unit, unitIds: ['F-inf'] }]
        })
        expect(recorded.trails().map((trail) => trail.order)).toEqual([1, 1, 2])

        recorded.act(ActionType.ThreatenAttack, Side.French, {
            approach: map.approachBetween(54, 64).id
        })
        recorded.act(ActionType.Retreat, Side.Allied, {
            losses: {},
            destinations: { 'A-1': 65 },
            kept: {}
        })
        const trails = recorded.trails()
        expect(trails.map((trail) => trail.order)).toEqual([1, 1, 2, 3])
        const [first] = trails.filter((trail) => near(trail.line[trail.line.length - 1], 64))
        const [second] = trails.filter((trail) => trail.order === 3)
        expect(near(first.line[0], 63)).toBe(true)
        expect(near(second.line[0], 64)).toBe(true)
        expect(near(second.line[second.line.length - 1], 65)).toBe(true)
    })

    it('start from an opponent’s stack as a whole, whichever of its units moved', () => {
        const trailOf = (unitId: string, reader: Side) => {
            const recorded = new Recorded()
            recorded.act(ActionType.EndTurn, Side.Allied)
            arrangeBattlefield(recorded.game, [
                { id: 'F-inf', side: Side.French, face: infantry(3), locale: 53 },
                ...['A-1', 'A-2', 'A-3'].map((id) => ({
                    id,
                    side: Side.Allied,
                    face: cavalry(2),
                    locale: 63,
                    commanderId: 'langeron'
                }))
            ])
            recorded.actions.length = 0
            recorded.act(ActionType.ThreatenAttack, Side.French, {
                approach: recorded.game.hydrated.map.approachBetween(53, 63).id
            })
            recorded.act(ActionType.DeclareDefense, Side.Allied, {
                unitIds: [unitId],
                leaderIds: [unitId]
            })
            recorded.act(ActionType.DeclareFeint, Side.French, {
                orders: [{ kind: CommandKind.Unit, unitIds: ['F-inf'] }],
                end: FeintEnd.Reserve
            })
            recorded.act(ActionType.Advance, Side.Allied, { unitIds: [unitId], commanderIds: [] })
            const view = { ...VIEW, readBy: recorded.game.playerOf(reader) }
            const standing = layoutPieces(recorded.game.hydrated, view).flatMap(
                (sprite) => sprite.blocks
            )
            const [trail, ...others] = turnTrails(
                { state: recorded.game.state, actions: recorded.actions },
                standing,
                view
            )
            expect(others).toEqual([])
            return trail.line
        }
        expect(trailOf('A-3', Side.French)).toEqual(trailOf('A-1', Side.French))
        expect(trailOf('A-3', Side.Allied)).not.toEqual(trailOf('A-1', Side.Allied))
    })

    it('stand each number beside its arrow, on the upper side as the board is turned', () => {
        const recorded = new Recorded()
        moveLangeronTo94(recorded)
        for (const view of [BoardView.North, BoardView.Allied, BoardView.French]) {
            const rotation = viewRotation(view)
            const [trail] = turnTrails(
                { state: recorded.game.state, actions: recorded.actions },
                recorded.standing(),
                { rotation }
            )
            const { down } = screenAxes(rotation)
            expect(Math.hypot(trail.aside.x, trail.aside.y)).toBeCloseTo(1)
            expect(trail.aside.x * down.x + trail.aside.y * down.y).toBeLessThanOrEqual(0)
        }
    })
})

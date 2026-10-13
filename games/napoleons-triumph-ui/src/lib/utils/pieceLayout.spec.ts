import { describe, expect, it } from 'vitest'
import { assertExists, type Point } from '@tabletop/common'
import { Side, type Face } from '@tabletop/napoleons-triumph'
import {
    TestGame,
    arrangeBattlefield,
    artillery,
    cavalry,
    guard,
    infantry
} from '@tabletop/napoleons-triumph/testing'
import { BoardView, toView, viewRotation } from './boardView.js'
import { APPROACH_GEOMETRY, LOCALE_GEOMETRY } from '$lib/map/boardGeometry.js'
import { BLOCK_LENGTH, BLOCK_THICKNESS, blockSamples, coveredBy } from './blockShape.js'
import { layoutPieces, type BlockSprite } from './pieceLayout.js'
import { insidePolygon } from './polygon.js'

const LOCALE = 94

const CORPS = ['langeron', 'dokhturov', 'kollowrath', 'miloradovich', 'liechtenstein', 'bagration']

function cornersOf(block: BlockSprite): Point[] {
    const radians = (block.angle * Math.PI) / 180
    const along = {
        x: (Math.cos(radians) * BLOCK_LENGTH) / 2,
        y: (Math.sin(radians) * BLOCK_LENGTH) / 2
    }
    const across = {
        x: (-Math.sin(radians) * BLOCK_THICKNESS) / 2,
        y: (Math.cos(radians) * BLOCK_THICKNESS) / 2
    }
    return [-1, 1].flatMap((end) =>
        [-1, 1].map((side) => ({
            x: block.centre.x + end * along.x + side * across.x,
            y: block.centre.y + end * along.y + side * across.y
        }))
    )
}

function topOf(block: BlockSprite): Point {
    const radians = (block.angle * Math.PI) / 180
    return { x: Math.sin(radians), y: -Math.cos(radians) }
}

function blocking(view: BoardView) {
    const game = new TestGame()
    game.deployBoth()
    const neighbours = game.hydrated.map
        .passableApproachesOf(LOCALE)
        .map((approach) => approach.neighbour)
    arrangeBattlefield(
        game,
        neighbours.flatMap((facing) => [
            { id: `inf-${facing}`, side: Side.Allied, face: infantry(2), locale: LOCALE, facing },
            { id: `cav-${facing}`, side: Side.Allied, face: cavalry(1), locale: LOCALE, facing }
        ])
    )
    const sprites = layoutPieces(game.hydrated, { rotation: viewRotation(view) })
    return sprites.flatMap((sprite) => sprite.blocks)
}

describe('units blocking an approach', () => {
    it('front it from inside their locale, whichever side of the locale it is on', () => {
        const blocks = blocking(BoardView.North)
        expect(blocks.length).toBeGreaterThan(4)
        for (const block of blocks) {
            const approach = block.unit.position?.approach
            expect(approach).toBeDefined()
            if (approach === undefined) continue
            const bar = APPROACH_GEOMETRY[approach]
            const top = topOf(block)
            expect(top.x * bar.inward.x + top.y * bar.inward.y).toBeCloseTo(-1)
            const inside =
                (block.centre.x - bar.centre.x) * bar.inward.x +
                (block.centre.y - bar.centre.y) * bar.inward.y
            expect(inside).toBeGreaterThan(0)
        }
    })

    it('show their front rank whole, with the ranks behind it tucked under', () => {
        const game = new TestGame()
        game.deployBoth()
        const [facing] = game.hydrated.map
            .passableApproachesOf(LOCALE)
            .map((approach) => approach.neighbour)
        arrangeBattlefield(
            game,
            ['first', 'second', 'third'].map((id) => ({
                id,
                side: Side.Allied,
                face: infantry(2),
                locale: LOCALE,
                facing,
                commanderId: 'langeron'
            }))
        )
        const [corps] = layoutPieces(game.hydrated)
        const bar = APPROACH_GEOMETRY[game.hydrated.map.approachBetween(LOCALE, facing).id]
        const behindTheBar = corps.blocks.map(
            (block) =>
                (block.centre.x - bar.centre.x) * bar.inward.x +
                (block.centre.y - bar.centre.y) * bar.inward.y
        )
        expect(behindTheBar).toEqual(behindTheBar.toSorted((a, b) => b - a))
        expect(corps.blocks.at(-1)?.unit.id).toBe('first')
    })

    it('stand side by side on a wide approach, each group in its own file at the bar', () => {
        const game = new TestGame()
        game.deployBoth()
        const map = game.hydrated.map
        const wide = map.allLocales
            .flatMap((locale) => map.passableApproachesOf(locale.id))
            .find((approach) => approach.wide)
        assertExists(wide, 'The board has wide approaches')
        const corps = (commanderId: string, ids: string[]) =>
            ids.map((id) => ({
                id,
                side: Side.Allied,
                face: infantry(2),
                locale: wide.locale,
                facing: wide.neighbour,
                commanderId
            }))
        arrangeBattlefield(game, [
            ...corps('langeron', ['l1', 'l2', 'l3']),
            ...corps('dokhturov', ['d1', 'd2'])
        ])
        const bar = APPROACH_GEOMETRY[wide.id]
        const radians = (bar.angle * Math.PI) / 180
        const alongBar = (block: BlockSprite) =>
            (block.centre.x - bar.centre.x) * Math.cos(radians) +
            (block.centre.y - bar.centre.y) * Math.sin(radians)
        const behindBar = (block: BlockSprite) =>
            (block.centre.x - bar.centre.x) * bar.inward.x +
            (block.centre.y - bar.centre.y) * bar.inward.y

        const sprites = layoutPieces(game.hydrated)
        expect(sprites).toHaveLength(2)
        const fronts = sprites.map((sprite) => sprite.blocks[sprite.blocks.length - 1])
        expect(behindBar(fronts[0])).toBeCloseTo(behindBar(fronts[1]))
        expect(Math.abs(alongBar(fronts[0]) - alongBar(fronts[1]))).toBeGreaterThan(BLOCK_LENGTH)
        for (const sprite of sprites) {
            for (const block of sprite.blocks) {
                expect(alongBar(block)).toBeCloseTo(alongBar(sprite.blocks[0]))
            }
        }
    })

    it('carry their flag at the top of the stack as the board is turned, clear of every block', () => {
        for (const view of [BoardView.North, BoardView.French, BoardView.Allied]) {
            const rotation = viewRotation(view)
            const game = new TestGame()
            game.deployBoth()
            const neighbours = game.hydrated.map
                .passableApproachesOf(LOCALE)
                .map((approach) => approach.neighbour)
            arrangeBattlefield(
                game,
                neighbours.flatMap((facing, index) =>
                    ['a', 'b', 'c'].map((unit) => ({
                        id: `${facing}-${unit}`,
                        side: Side.Allied,
                        face: infantry(2),
                        locale: LOCALE,
                        facing,
                        commanderId: CORPS[index]
                    }))
                )
            )
            const sprites = layoutPieces(game.hydrated, { rotation })
            expect(sprites.length).toBeGreaterThan(2)
            for (const sprite of sprites) {
                const feet = sprite.flagFeetByPreference
                assertExists(feet, 'A corps has places for its flag')
                const tops = sprite.blocks
                    .flatMap(cornersOf)
                    .map((corner) => toView(corner, rotation).y)
                expect(toView(feet[0], rotation).y).toBeCloseTo(Math.min(...tops))
                expect(feet.length).toBeGreaterThan(1)
                for (const foot of feet) {
                    expect(Math.hypot(foot.x - feet[0].x, foot.y - feet[0].y)).toBeLessThanOrEqual(
                        BLOCK_LENGTH + 0.5
                    )
                }
            }
        }
    })

    it('keep that facing however the board is turned', () => {
        const angles = (view: BoardView) => blocking(view).map((block) => block.angle)
        expect(angles(BoardView.French)).toEqual(angles(BoardView.North))
        expect(angles(BoardView.Allied)).toEqual(angles(BoardView.North))
    })
})

describe('a corps in reserve', () => {
    const SHARED = 64

    function sharing(withBlockers: boolean) {
        const game = new TestGame()
        game.deployBoth()
        const map = game.hydrated.map
        const wide = map.passableApproachesOf(SHARED).find((approach) => approach.wide)
        assertExists(wide, 'The locale has a wide approach')
        const corps = (commanderId: string, count: number, facing?: number) =>
            Array.from({ length: count }, (_, index) => ({
                id: `${commanderId}-${index}`,
                side: Side.French,
                face: infantry(2),
                locale: SHARED,
                facing,
                commanderId
            }))
        arrangeBattlefield(game, [
            ...(withBlockers ? corps('lannes', 5, wide.neighbour) : []),
            ...corps('murat', 4)
        ])
        const sprites = layoutPieces(game.hydrated)
        const of = (commanderId: string) =>
            sprites.find((sprite) => sprite.group.commander?.id === commanderId)?.blocks ?? []
        return { blockers: of('lannes'), reserve: of('murat') }
    }

    it('gathers on the locale’s anchor when nothing is in its way', () => {
        const { reserve } = sharing(false)
        const { anchor } = LOCALE_GEOMETRY[SHARED]
        const middle = {
            x: reserve.reduce((sum, block) => sum + block.centre.x, 0) / reserve.length,
            y: reserve.reduce((sum, block) => sum + block.centre.y, 0) / reserve.length
        }
        expect(middle.x).toBeCloseTo(anchor.x)
        expect(middle.y).toBeCloseTo(anchor.y)
    })

    it('stands aside, inside its locale, from a corps blocking one of the approaches', () => {
        const { blockers, reserve } = sharing(true)
        expect(blockers).toHaveLength(5)
        expect(reserve).toHaveLength(4)
        const overlapping = reserve.flatMap(blockSamples).filter(coveredBy(blockers))
        expect(overlapping).toEqual([])
        const { outline } = LOCALE_GEOMETRY[SHARED]
        for (const block of reserve) {
            expect(insidePolygon(block.centre, outline)).toBe(true)
        }
    })
})

describe('stacks short of room', () => {
    const SMALL = 110
    const ROOMY = 94

    function stackIn(locale: number, looseLocales: number[] = []) {
        const game = new TestGame()
        game.deployBoth()
        arrangeBattlefield(
            game,
            Array.from({ length: 5 }, (_, index) => ({
                id: `inf-${index}`,
                side: Side.Allied,
                face: infantry(2),
                locale,
                commanderId: 'langeron'
            }))
        )
        const [stack] = layoutPieces(game.hydrated, { rotation: 0, looseLocales })
        const [first, second] = stack.blocks
        const spacing = Math.hypot(
            second.centre.x - first.centre.x,
            second.centre.y - first.centre.y
        )
        return { closedUp: stack.closedUp, spacing, blocks: stack.blocks }
    }

    it('close up in a small locale, each block lying over part of the next', () => {
        const stack = stackIn(SMALL)
        expect(stack.closedUp).toBe(true)
        expect(stack.spacing).toBeLessThan(BLOCK_THICKNESS)
    })

    it('stand a full block apart where there is room', () => {
        const stack = stackIn(ROOMY)
        expect(stack.closedUp).toBe(false)
        expect(stack.spacing).toBeGreaterThan(BLOCK_THICKNESS)
    })

    it('spread to a full block apart when their locale is laid out loose', () => {
        const stack = stackIn(SMALL, [SMALL])
        expect(stack.closedUp).toBe(false)
        expect(stack.spacing).toBe(stackIn(ROOMY).spacing)
    })

    it('draw the top block whole and last, with each block under it showing its lower edge', () => {
        const stack = stackIn(SMALL)
        const lowestOnTheBoard = stack.blocks.toSorted((a, b) => b.centre.y - a.centre.y)
        expect(stack.blocks).toEqual(lowestOnTheBoard)
        expect(stack.blocks.at(-1)?.unit.id).toBe('inf-0')
    })
})

describe('the order of a player’s own pieces in a stack', () => {
    const AS_DEALT: Face[] = [
        artillery(),
        cavalry(1),
        infantry(2),
        guard(),
        cavalry(3),
        infantry(3)
    ]
    const IN_ORDER: Face[] = [
        guard(),
        infantry(3),
        infantry(2),
        cavalry(3),
        cavalry(1),
        artillery()
    ]
    const VIEWS = [BoardView.North, BoardView.French, BoardView.Allied]

    function corps(facing: number | undefined, view: BoardView, readBy: Side | undefined) {
        const game = new TestGame()
        game.deployBoth()
        arrangeBattlefield(
            game,
            AS_DEALT.map((face, index) => ({
                id: `unit-${index}`,
                side: Side.Allied,
                face,
                locale: LOCALE,
                facing,
                commanderId: 'langeron'
            }))
        )
        const rotation = viewRotation(view)
        const [stack] = layoutPieces(game.hydrated, {
            rotation,
            readBy: readBy && game.playerOf(readBy)
        })
        return { stack, rotation, map: game.hydrated.map }
    }

    const facesOf = (blocks: BlockSprite[]) => blocks.map((block) => block.unit.face)

    it('runs Guard, infantry, cavalry, artillery from the top of a reserve stack down, the strongest first, however the board is turned', () => {
        for (const view of VIEWS) {
            const { stack, rotation } = corps(undefined, view, Side.Allied)
            const topDown = stack.blocks.toSorted(
                (a, b) => toView(a.centre, rotation).y - toView(b.centre, rotation).y
            )
            expect(facesOf(topDown)).toEqual(IN_ORDER)
            expect(stack.group.units.map((unit) => unit.face)).toEqual(IN_ORDER)
        }
    })

    it('is left as it stands for anyone else, who must learn nothing from it', () => {
        for (const readBy of [Side.French, undefined]) {
            const { stack } = corps(undefined, BoardView.North, readBy)
            expect(stack.group.units.map((unit) => unit.face)).toEqual(AS_DEALT)
        }
    })

    it('runs from the top of the screen down in a file standing upright, and from inside the locale out to the bar in one lying level', () => {
        const { map } = corps(undefined, BoardView.North, Side.Allied)
        const neighbours = map.passableApproachesOf(LOCALE).map((approach) => approach.neighbour)
        const seen = { upright: 0, level: 0 }
        for (const view of VIEWS) {
            for (const facing of neighbours) {
                const { stack, rotation } = corps(facing, view, Side.Allied)
                const bar = APPROACH_GEOMETRY[map.approachBetween(LOCALE, facing).id]
                const onScreen = (point: Point) => toView(point, rotation)
                const [front, behind] = stack.blocks.toSorted(
                    (a, b) => fromTheBar(a, bar.centre) - fromTheBar(b, bar.centre)
                )
                const along = {
                    x: onScreen(behind.centre).x - onScreen(front.centre).x,
                    y: onScreen(behind.centre).y - onScreen(front.centre).y
                }
                const upright = Math.abs(along.y) >= Math.abs(along.x)
                const asRead = upright
                    ? stack.blocks.toSorted((a, b) => onScreen(a.centre).y - onScreen(b.centre).y)
                    : stack.blocks.toSorted(
                          (a, b) => fromTheBar(b, bar.centre) - fromTheBar(a, bar.centre)
                      )
                expect(facesOf(asRead)).toEqual(IN_ORDER)
                seen[upright ? 'upright' : 'level'] += 1
            }
        }
        expect(seen.upright).toBeGreaterThan(0)
        expect(seen.level).toBeGreaterThan(0)
    })
})

describe('the units an opponent has committed to an attack', () => {
    const VIEWS = [BoardView.North, BoardView.French, BoardView.Allied]
    const CHOSEN = ['unit-4', 'unit-1', 'unit-3']
    const OTHERS = ['unit-0', 'unit-2', 'unit-5']

    function corps(facing: number | undefined, view: BoardView, readBy: Side, towards: number) {
        const game = new TestGame()
        game.deployBoth()
        arrangeBattlefield(
            game,
            Array.from({ length: 6 }, (_, index) => ({
                id: `unit-${index}`,
                side: Side.Allied,
                face: infantry(2),
                locale: LOCALE,
                facing,
                commanderId: 'langeron'
            }))
        )
        const rotation = viewRotation(view)
        const approach = game.hydrated.map.approachBetween(LOCALE, towards).id
        const [stack] = layoutPieces(game.hydrated, {
            rotation,
            readBy: game.playerOf(readBy),
            chosen: [{ approach, unitIds: CHOSEN }]
        })
        return { stack, bar: APPROACH_GEOMETRY[approach], rotation }
    }

    const neighboursOf = () => {
        const game = new TestGame()
        return game.hydrated.map.passableApproachesOf(LOCALE).map((approach) => approach.neighbour)
    }
    const idsOf = (blocks: BlockSprite[]) => blocks.map((block) => block.unit.id)

    it('stand nearest the bar in a stack blocking the approach, in the order given, wherever they were', () => {
        for (const view of VIEWS) {
            for (const towards of neighboursOf()) {
                const { stack, bar } = corps(towards, view, Side.French, towards)
                const nearestFirst = stack.blocks.toSorted(
                    (a, b) => fromTheBar(a, bar.centre) - fromTheBar(b, bar.centre)
                )
                expect(idsOf(nearestFirst)).toEqual([...CHOSEN, ...OTHERS])
            }
        }
    })

    it('stand at the end of a reserve stack that is towards the approach on screen, the first of them outermost', () => {
        const seen = { top: 0, bottom: 0 }
        for (const view of VIEWS) {
            for (const towards of neighboursOf()) {
                const { stack, bar, rotation } = corps(undefined, view, Side.French, towards)
                const topDown = stack.blocks.toSorted(
                    (a, b) => toView(a.centre, rotation).y - toView(b.centre, rotation).y
                )
                const anchor = toView(LOCALE_GEOMETRY[LOCALE].anchor, rotation)
                const below = toView(bar.centre, rotation).y > anchor.y
                expect(idsOf(below ? topDown.toReversed() : topDown)).toEqual([
                    ...CHOSEN,
                    ...OTHERS
                ])
                seen[below ? 'bottom' : 'top'] += 1
            }
        }
        expect(seen.top).toBeGreaterThan(0)
        expect(seen.bottom).toBeGreaterThan(0)
    })

    it('stay where the owner reads them in the owner’s own view', () => {
        const [towards] = neighboursOf()
        const { stack } = corps(undefined, BoardView.North, Side.Allied, towards)
        expect(stack.group.units.map((unit) => unit.id)).toEqual(
            Array.from({ length: 6 }, (_, index) => `unit-${index}`)
        )
    })
})

function fromTheBar(block: BlockSprite, barCentre: Point): number {
    return Math.hypot(block.centre.x - barCentre.x, block.centre.y - barCentre.y)
}

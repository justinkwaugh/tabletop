import { describe, expect, it } from 'vitest'
import { assertExists, type Point } from '@tabletop/common'
import { Side } from '@tabletop/napoleons-triumph'
import {
    TestGame,
    arrangeBattlefield,
    cavalry,
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

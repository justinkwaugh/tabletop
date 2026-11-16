import { GuildIds, HydratedFeudumGameState } from '@tabletop/feudum'
import { flushSync } from 'svelte'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { FeudumHost } from '$lib/testing/sessionHarness.js'
import {
    BoardHeight,
    DeskBoardArea,
    GuildAreas,
    MapArea,
    railOverRect
} from '$lib/utils/boardGeometry.js'
import type { BoardOffer, BoardTarget } from './boardOffer.js'
import {
    BoardFocus,
    ChooserInset,
    DeskRowClear,
    deskRestScaleOf,
    deskScaledHeight,
    litAreasOf,
    pickFrameOf,
    pickFrameScale,
    PickFrameZoom,
    rectOfArea,
    restScaleOf,
    ZoomRowBand,
    type BoardFocusSetting,
    type BoardRect,
    type BoardView,
    type PickFrame
} from './boardFocus.svelte.js'

type Calls = { focused: { rect: BoardRect; maxScale: number }[]; fits: number }

function fakeView(): { view: BoardView; calls: Calls } {
    const calls: Calls = { focused: [], fits: 0 }
    return {
        calls,
        view: {
            focusRect: (rect, { maxScale }) => calls.focused.push({ rect, maxScale }),
            fitToContent: () => {
                calls.fits += 1
            }
        }
    }
}

const Rest = 0.33

function focusOn(setting: Partial<BoardFocusSetting> = {}) {
    const { view, calls } = fakeView()
    const focus = new BoardFocus({
        view: () => view,
        restScale: () => Rest,
        sideways: () => false,
        animate: () => false,
        ...setting
    })
    return { focus, calls }
}

const frameA: PickFrame = { key: 'a', rect: { x: 1, y: 2, width: 3, height: 4 } }
const frameB: PickFrame = { key: 'b', rect: { x: 5, y: 6, width: 7, height: 8 } }

function offerOf(...targets: BoardTarget[]): BoardOffer {
    return {
        targets: new Map(targets.map((target) => [target, { role: 'lit' as const }])),
        dimsRest: true
    }
}

describe('R-1.2 what the chooser frames, and how far a pick may go', () => {
    it('a pick may bring the board to 2.5 times its rest, and no further', () => {
        expect(PickFrameZoom).toBe(2.5)
        expect(pickFrameScale(Rest)).toBeCloseTo(0.825)
        const { focus, calls } = focusOn()
        focus.follow(frameA)
        expect(calls.focused).toEqual([{ rect: frameA.rect, maxScale: Rest * 2.5 }])
    })

    it('a chosen guild column is framed under the same cap', () => {
        const { focus, calls } = focusOn()
        focus.choose('west')
        expect(calls.focused[0]?.rect).toEqual(rectOfArea('west'))
        expect(calls.focused[0]?.maxScale).toBeCloseTo(Rest * 2.5)
        expect(focus.shown).toBe('west')
    })

    it('the Map rests at the cover fit upright, and fits by height sideways', () => {
        const upright = focusOn()
        upright.focus.choose('map')
        expect(upright.calls.fits).toBe(1)
        expect(upright.calls.focused).toEqual([])
        const sideways = focusOn({ sideways: () => true })
        sideways.focus.choose('map')
        expect(sideways.calls.fits).toBe(0)
        expect(sideways.calls.focused[0]?.rect).toEqual(MapArea)
    })

    it('each column holds its three guilds, the West its own and the East its own', () => {
        const inside = (rect: BoardRect, guild: (typeof GuildIds)[number]) =>
            GuildAreas[guild].x >= rect.x && GuildAreas[guild].x < rect.x + rect.width
        for (const guild of ['alchemist', 'merchant', 'farmer'] as const) {
            expect(inside(rectOfArea('west'), guild)).toBe(true)
            expect(inside(rectOfArea('east'), guild)).toBe(false)
        }
        for (const guild of ['knight', 'noble', 'monk'] as const) {
            expect(inside(rectOfArea('east'), guild)).toBe(true)
            expect(inside(rectOfArea('west'), guild)).toBe(false)
        }
    })

    it("each column's view holds its guilds' standing rails at the map's inner edge", () => {
        const holds = (rect: BoardRect, inner: BoardRect) =>
            inner.x >= rect.x &&
            inner.y >= rect.y &&
            inner.x + inner.width <= rect.x + rect.width &&
            inner.y + inner.height <= rect.y + rect.height
        for (const guild of ['alchemist', 'merchant', 'farmer'] as const) {
            expect(holds(rectOfArea('west'), railOverRect(guild))).toBe(true)
        }
        for (const guild of ['knight', 'noble', 'monk'] as const) {
            expect(holds(rectOfArea('east'), railOverRect(guild))).toBe(true)
        }
    })

    it('a phone rests at a cover fit, and a roomy view contains', () => {
        expect(restScaleOf(329, 398)).toBeGreaterThan(329 / 2500)
        expect(restScaleOf(2500, 1103 + 36)).toBeCloseTo(1, 1)
    })

    it('R-1.2.5 the rest reckons the band under the board, which holds the zoom row at a cover fit', () => {
        const rest = restScaleOf(343, 356 + ChooserInset)
        expect(rest).toBeCloseTo(356 / (BoardHeight + ZoomRowBand), 5)
        expect(ZoomRowBand * rest).toBeGreaterThanOrEqual(40)
    })
})

describe('Contract, Zoom row: a desk focuses the board from the zoom row', () => {
    const Desk = { width: 1576, height: 600 }
    const deskFocus = (setting: Partial<BoardFocusSetting> = {}) =>
        focusOn({ desk: () => Desk, restScale: () => deskRestScaleOf(1576, 600, 4), ...setting })
    const inContent = (rect: BoardRect) => ({
        ...rect,
        x: rect.x - DeskBoardArea.x,
        y: rect.y - DeskBoardArea.y
    })

    it('rests on the whole board, and Whole board is the fit', () => {
        const { focus, calls } = deskFocus()
        expect(focus.chosen).toBe('board')
        expect(focus.shown).toBe('board')
        focus.choose('map')
        focus.choose('board')
        expect(calls.fits).toBe(1)
        expect(focus.shown).toBe('board')
    })

    it('settling at rest leaves the wrapper its own fit', () => {
        const { focus, calls } = deskFocus()
        focus.settle()
        expect(calls.fits).toBe(0)
        expect(calls.focused).toEqual([])
    })

    it('frames each area at the largest scale the view allows with the zoom row clear', () => {
        for (const area of ['map', 'west', 'east'] as const) {
            const { focus, calls } = deskFocus()
            focus.choose(area)
            expect(focus.shown).toBe(area)
            const framed = calls.focused[0]
            const rect = inContent(rectOfArea(area))
            expect(framed?.rect.x).toBeCloseTo(rect.x, 5)
            expect(framed?.rect.y).toBeCloseTo(rect.y, 5)
            expect(framed?.rect.width).toBeCloseTo(rect.width, 5)
            // The view shows the area at the scale that fits above the row, the row's height under it.
            const scale = Math.min(
                (Desk.width - 24) / rect.width,
                (Desk.height - 24 - DeskRowClear) / rect.height,
                framed?.maxScale ?? 0
            )
            expect(framed?.rect.height).toBeCloseTo(rect.height + DeskRowClear / scale, 5)
            const wrapperScale = Math.min(
                (Desk.width - 24) / (framed?.rect.width ?? 1),
                (Desk.height - 24) / (framed?.rect.height ?? 1),
                framed?.maxScale ?? 0
            )
            expect(wrapperScale).toBeCloseTo(scale, 5)
        }
    })

    it('a pick in view frames nothing; one the chosen area leaves out is framed as on a phone', () => {
        const map: PickFrame = { ...frameA, holds: ['map'] }
        const guild: PickFrame = { ...frameB, holds: ['west'], area: 'west' }
        const resting = deskFocus()
        resting.focus.follow(map)
        resting.focus.follow(guild)
        expect(resting.calls.focused).toEqual([])
        expect(resting.focus.shown).toBe('board')
        const onMap = deskFocus()
        onMap.focus.choose('map')
        onMap.focus.follow(map)
        expect(onMap.calls.focused).toHaveLength(1)
        onMap.focus.follow(guild)
        expect(onMap.calls.focused).toHaveLength(2)
        expect(onMap.calls.focused[1]?.rect.x).toBeCloseTo(frameB.rect.x - DeskBoardArea.x, 5)
        expect(onMap.focus.shown).toBe('west')
        onMap.focus.follow(undefined)
        expect(onMap.focus.shown).toBe('map')
        expect(onMap.calls.focused).toHaveLength(3)
    })

    it('a track pick stands on the map', () => {
        const { focus, calls } = deskFocus()
        focus.choose('map')
        focus.follow({ ...frameA, holds: ['tracks'] })
        expect(calls.focused).toHaveLength(1)
    })

    it('a desk rests at a contain fit of the board, its strip and the band', () => {
        expect(deskRestScaleOf(1576, 2000, 4)).toBeCloseTo(1576 / DeskBoardArea.width, 5)
        expect(deskRestScaleOf(1576, 400, 4)).toBeCloseTo(400 / deskScaledHeight(4), 5)
    })
})

describe('R-3.7 a pick frames once, and a hand clears it', () => {
    it('frames a lit set only when it is new', () => {
        const { focus, calls } = focusOn()
        focus.follow(frameA)
        focus.follow(frameA)
        expect(calls.focused).toHaveLength(1)
        focus.follow(frameB)
        expect(calls.focused).toHaveLength(2)
    })

    it('closing gives back the chip it found', () => {
        const { focus, calls } = focusOn()
        focus.choose('west')
        focus.follow(frameA)
        expect(focus.framed).toBe(frameA)
        focus.follow(undefined)
        expect(focus.framed).toBeUndefined()
        expect(focus.shown).toBe('west')
        expect(calls.focused.at(-1)?.rect).toEqual(rectOfArea('west'))
    })

    it('a hand pan clears the framing and the chip: closing moves nothing', () => {
        const { focus, calls } = focusOn()
        focus.follow(frameA)
        focus.handMoved()
        expect(focus.framed).toBeUndefined()
        expect(focus.chosen).toBeUndefined()
        expect(focus.shown).toBeUndefined()
        const before = { focused: calls.focused.length, fits: calls.fits }
        focus.follow(undefined)
        expect(calls.focused).toHaveLength(before.focused)
        expect(calls.fits).toBe(before.fits)
    })

    it('settling keeps a framing framed, as the view’s size changes', () => {
        const { focus, calls } = focusOn()
        focus.follow(frameA)
        focus.settle()
        expect(calls.focused).toHaveLength(2)
        expect(calls.focused[1]?.rect).toEqual(frameA.rect)
        expect(calls.fits).toBe(0)
    })

    it('settling puts nothing over a hand’s view', () => {
        const { focus, calls } = focusOn()
        focus.handMoved()
        focus.settle()
        expect(calls.fits).toBe(0)
        expect(calls.focused).toHaveLength(0)
    })

    it('a chip takes the view back from a pick', () => {
        const { focus, calls } = focusOn()
        focus.follow(frameA)
        focus.choose('east')
        expect(focus.framed).toBeUndefined()
        expect(calls.focused.at(-1)?.rect).toEqual(rectOfArea('east'))
    })

    it('a frame reaches no offer: it reads the view only', () => {
        const focusRect = vi.fn()
        const view = { focusRect, fitToContent: vi.fn() }
        const focus = new BoardFocus({
            view: () => view,
            restScale: () => Rest,
            sideways: () => false,
            animate: () => false
        })
        flushSync(() => focus.follow(frameA))
        expect(focusRect).toHaveBeenCalledOnce()
    })
})

describe('R-4.6.1 what a pick’s offer asks of the board', () => {
    let host: FeudumHost
    let stateWith: HydratedFeudumGameState

    beforeAll(async () => {
        vi.spyOn(console, 'log').mockImplementation(() => undefined)
        host = new FeudumHost(3)
        await host.playStartingGoods()
        await host.playStartingPawns()
        stateWith = new HydratedFeudumGameState(structuredClone(host.state))
    })

    afterAll(() => {
        host.close()
        vi.restoreAllMocks()
    })

    it('guilds in both columns: the West is framed, and each chip carries a dot', () => {
        const offer = offerOf('guild:merchant', 'guild:monk')
        expect(pickFrameOf(stateWith, offer)).toMatchObject({ area: 'west' })
        expect([...litAreasOf(stateWith, offer)].toSorted()).toEqual(['east', 'west'])
    })

    it('guilds in the East alone: the East is framed', () => {
        const offer = offerOf('guild:knight')
        expect(pickFrameOf(stateWith, offer)).toMatchObject({ area: 'east' })
    })

    it('R-3.7 a voyage disc frames its track, and names no chip', () => {
        const offer = offerOf('voyage:2')
        const frame = pickFrameOf(stateWith, offer)
        expect(frame?.area).toBeUndefined()
        expect(frame?.rect.width).toBeGreaterThan(0)
        expect([...litAreasOf(stateWith, offer)]).toEqual(['tracks'])
    })

    it('a mix frames the map first', () => {
        const player = stateWith.players[0]
        const pawn = player?.pawns.find(({ spaceId }) => spaceId !== undefined)
        const pawnTarget: BoardTarget = `pawn:${player?.playerId}:${pawn?.n ?? 1}`
        const offer = offerOf(pawnTarget, 'guild:monk')
        const frame = pickFrameOf(stateWith, offer)
        expect(frame?.area).toBeUndefined()
        expect(frame?.rect.width).toBeLessThan(MapArea.width)
        expect([...litAreasOf(stateWith, offer)].toSorted()).toEqual(['east', 'map'])
    })

    it('a frame names every area its targets stand in, so a desk knows whether its view holds them', () => {
        expect(pickFrameOf(stateWith, offerOf('voyage:2'))?.holds).toEqual(['tracks'])
        expect(
            pickFrameOf(stateWith, offerOf('guild:merchant', 'guild:monk'))?.holds?.toSorted()
        ).toEqual(['east', 'west'])
        expect(pickFrameOf(stateWith, offerOf(), 'guild:merchant')?.holds).toEqual(['west'])
    })

    it('an open popup keeps its anchor framed: a guild’s holds its own column', () => {
        const frame = pickFrameOf(stateWith, offerOf(), 'guild:merchant')
        expect(frame).toMatchObject({ area: 'west', rect: rectOfArea('west') })
        const east = pickFrameOf(stateWith, offerOf('guild:merchant'), 'guild:monk')
        expect(east).toMatchObject({ area: 'east', rect: rectOfArea('east') })
        expect(pickFrameOf(stateWith, offerOf(), 'voyage:2')?.rect.width).toBeGreaterThan(0)
    })

    it('no lit target frames nothing', () => {
        expect(pickFrameOf(stateWith, offerOf())).toBeUndefined()
    })
})

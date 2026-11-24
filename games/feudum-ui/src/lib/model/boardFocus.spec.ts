import { assertExists, type BoundingBox } from '@tabletop/common'
import { GuildIds, HydratedFeudumGameState } from '@tabletop/feudum'
import { flushSync } from 'svelte'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { OpenPick } from '$lib/testing/openPick.svelte.js'
import { FeudumHost } from '$lib/testing/sessionHarness.js'
import {
    BoardHeight,
    GuildAreas,
    MapArea,
    railOverRect,
    StandingsStrip,
    standingsStripHeight,
    stripRailDrawingHeight
} from '$lib/utils/boardGeometry.js'
import type { BoardOffer, BoardTarget } from './boardOffer.js'
import { ChipHeight, chipLayout, spaceChips } from './spaceChips.js'
import {
    BoardFocus,
    ChooserInset,
    columnRailScale,
    DeskColumnGap,
    DeskColumnWidth,
    deskColumnBox,
    deskColumnFoot,
    deskColumnOf,
    deskColumnViewWidth,
    MinColumnRailScale,
    deskMapAtRest,
    deskRestScaleOf,
    deskScaledHeight,
    deskViewHeight,
    litAreasOf,
    pickFrameOf,
    PickFrameZoom,
    restScaleOf,
    SideButtonGap,
    SideButtonWidth,
    SideGutter,
    guildSideFollowing,
    ZoomRowBand,
    type BoardFocusSetting,
    type BoardView,
    type PickFrame
} from './boardFocus.svelte.js'

type Calls = { focused: { rect: BoundingBox; maxScale: number }[]; fits: number }

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
    const pick = new OpenPick()
    const focus = new BoardFocus({
        view: () => view,
        restScale: () => Rest,
        sideways: () => false,
        animate: () => false,
        pickFrame: pick.read,
        ...setting
    })
    return { focus, calls, pick }
}

/** Contract, Focus chooser: the rect the chooser frames for a guild column. */
function framed(area: 'west' | 'east'): BoundingBox {
    const { focus, calls } = focusOn()
    focus.choose(area)
    focus.settle()
    const rect = calls.focused.at(-1)?.rect
    assertExists(rect, `the ${area} column is framed`)
    return rect
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
        expect(Rest * PickFrameZoom).toBeCloseTo(0.825)
        const { focus, calls, pick } = focusOn()
        pick.frame = frameA
        focus.settle()
        expect(calls.focused).toEqual([{ rect: frameA.rect, maxScale: Rest * 2.5 }])
    })

    it('a chosen guild column is framed under the same cap', () => {
        const { focus, calls } = focusOn()
        focus.choose('west')
        focus.settle()
        expect(calls.focused[0]?.maxScale).toBeCloseTo(Rest * 2.5)
        expect(focus.shown).toBe('west')
    })

    it('the Map rests at the cover fit upright, and fits by height sideways', () => {
        const upright = focusOn()
        upright.focus.choose('map')
        upright.focus.settle()
        expect(upright.calls.fits).toBe(1)
        expect(upright.calls.focused).toEqual([])
        const sideways = focusOn({ sideways: () => true })
        sideways.focus.choose('map')
        sideways.focus.settle()
        expect(sideways.calls.fits).toBe(0)
        expect(sideways.calls.focused[0]?.rect).toEqual(MapArea)
    })

    it('each column holds its three guilds, the West its own and the East its own', () => {
        const inside = (rect: BoundingBox, guild: (typeof GuildIds)[number]) =>
            GuildAreas[guild].x >= rect.x && GuildAreas[guild].x < rect.x + rect.width
        for (const guild of ['alchemist', 'merchant', 'farmer'] as const) {
            expect(inside(framed('west'), guild)).toBe(true)
            expect(inside(framed('east'), guild)).toBe(false)
        }
        for (const guild of ['knight', 'noble', 'monk'] as const) {
            expect(inside(framed('east'), guild)).toBe(true)
            expect(inside(framed('west'), guild)).toBe(false)
        }
    })

    it("each column's view holds its guilds' standing rails at the map's inner edge", () => {
        const holds = (rect: BoundingBox, inner: BoundingBox) =>
            inner.x >= rect.x &&
            inner.y >= rect.y &&
            inner.x + inner.width <= rect.x + rect.width &&
            inner.y + inner.height <= rect.y + rect.height
        for (const guild of ['alchemist', 'merchant', 'farmer'] as const) {
            expect(holds(framed('west'), railOverRect(guild))).toBe(true)
        }
        for (const guild of ['knight', 'noble', 'monk'] as const) {
            expect(holds(framed('east'), railOverRect(guild))).toBe(true)
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

describe('Contract, Desk layout: the map between the West and East guild buttons', () => {
    it('each button is 45 px wide with 4 px to the map', () => {
        expect(SideButtonWidth).toBe(45)
        expect(SideButtonGap).toBe(4)
        expect(SideGutter).toBe(49)
    })

    it('a desk fits the map, its strip and the band, between the two gutters', () => {
        expect(deskScaledHeight(4)).toBeCloseTo(
            MapArea.height + standingsStripHeight(4) + ZoomRowBand,
            5
        )
        expect(deskRestScaleOf(1096, 2000, 4)).toBeCloseTo((1096 - 98) / MapArea.width, 5)
        expect(deskRestScaleOf(1096, 400, 4)).toBeCloseTo(400 / deskScaledHeight(4), 5)
        expect(deskRestScaleOf(4000, 4000, 4)).toBe(1)
    })

    it('a room narrower than its gutters gives a scale of 0, never below', () => {
        expect(deskRestScaleOf(40, 900, 4)).toBe(0)
        expect(deskRestScaleOf(1200, 900, 4, { perRow: 1, width: 1400 })).toBe(0)
    })

    it('the view is that shape at the column’s width', () => {
        expect(deskViewHeight(1096, 4)).toBeCloseTo((998 * deskScaledHeight(4)) / MapArea.width, 5)
        expect(deskViewHeight(60, 4)).toBe(0)
    })

    it('the content’s gutters bring the wrapper’s own fit to the rest, the map between the buttons', () => {
        for (const [width, height] of [
            [1096, 2000],
            [1096, 400],
            [4000, 4000]
        ] as const) {
            const rest = deskMapAtRest({ width, height }, 4, false)
            const content = MapArea.width + 2 * rest.gutter
            const fit = Math.min(width / content, height / deskScaledHeight(4), 1)
            expect(fit).toBeCloseTo(rest.scale, 5)
            expect(rest.x).toBeCloseTo(SideGutter, 5)
            expect(rest.y).toBe(0)
            expect(rest.width).toBeCloseTo(MapArea.width * rest.scale, 5)
            expect(rest.height).toBeCloseTo(MapArea.height * rest.scale, 5)
        }
    })

    it('an unmeasured view, or one narrower than the buttons, keeps no gutter', () => {
        expect(deskMapAtRest({ width: 0, height: 0 }, 4, false)).toMatchObject({
            width: 0,
            gutter: 0
        })
        expect(deskMapAtRest({ width: 60, height: 600 }, 4, false).gutter).toBe(0)
    })

    it('in full screen the content stands centred, and the map with it', () => {
        const rest = deskMapAtRest({ width: 1424, height: 820 }, 4, true)
        const content = (MapArea.width + 2 * rest.gutter) * rest.scale
        expect(rest.x).toBeCloseTo((1424 - content) / 2 + SideGutter, 5)
        expect(rest.y).toBeCloseTo((820 - deskScaledHeight(4) * rest.scale) / 2, 5)
    })
})

describe('Contract, Desk layout: where the map’s height binds, the standings and the zoom row stand in a column beside it', () => {
    /** The room under the panel on desks of 1850 x 880, 1440 x 900 and 1920 x 1080. */
    const wide = { width: 1506, height: 702 }
    const desk = { width: 1096, height: 722 }
    const tall = { width: 1576, height: 902 }
    /** The map's width beside the column at 1506 px across: less the buttons, the gap, the column. */
    const besideWidth = 1506 - 2 * SideGutter - DeskColumnGap - DeskColumnWidth

    function stripMap(room: { width: number; height: number }, seats: number) {
        const height = Math.min(deskViewHeight(room.width, seats), room.height)
        return deskMapAtRest({ width: room.width, height }, seats, false)
    }

    it('a height-bound desk takes the column, and its map grows into the width the strip left empty', () => {
        const column = deskColumnOf(wide, 3)
        expect(column).toEqual({ perRow: 1, width: DeskColumnWidth })
        const view = { width: deskColumnViewWidth(wide, 3, column!), height: wide.height }
        const rest = deskMapAtRest(view, 3, false, column)
        expect(rest.width).toBeCloseTo(besideWidth, 5)
        expect(rest.height).toBeCloseTo((besideWidth * MapArea.height) / MapArea.width, 5)
        expect(rest.width).toBeGreaterThan(stripMap(wide, 3).width + 130)
    })

    it('a width-bound desk keeps the strip under the map, as does one where the column would not make the map larger', () => {
        for (const seats of [3, 4, 5]) {
            expect(deskColumnOf(desk, seats)).toBeUndefined()
            expect(deskColumnOf({ width: 936, height: 622 }, seats)).toBeUndefined()
            expect(deskColumnOf(tall, seats)).toBeUndefined()
        }
    })

    it('the map gives the buttons their width in either layout: about 998 x 520 at 1440 x 900, 1144 x 596 at 1850 x 880, and 1294 x 674 at 1920 x 1080, where the height binds', () => {
        const strip = stripMap(desk, 4)
        expect(strip.width).toBeCloseTo(1096 - 2 * 49, 5)
        expect(Math.round(strip.height)).toBe(520)
        const column = deskColumnOf(wide, 3)!
        const view = { width: deskColumnViewWidth(wide, 3, column), height: wide.height }
        const beside = deskMapAtRest(view, 3, false, column)
        expect(beside.width).toBeCloseTo(1506 - 2 * 49 - 8 - 256, 5)
        expect(Math.round(beside.height)).toBe(596)
        const high = stripMap(tall, 3)
        expect(Math.round(high.width)).toBe(1294)
        expect(Math.abs(high.height - 674)).toBeLessThan(1)
    })

    it('one layout per size: the column only while its map is the larger, on either side of the threshold', () => {
        // Down: at 1506 px across, three seats' strip reaches the column's map width at this height.
        const down = (besideWidth * deskScaledHeight(3)) / MapArea.width
        expect(deskColumnOf({ width: 1506, height: Math.floor(down) - 1 }, 3)).toBeDefined()
        expect(deskColumnOf({ width: 1506, height: Math.ceil(down) + 1 }, 3)).toBeUndefined()
        // Across: at 702 px tall the strip's map is height-bound; the column's catches it here.
        const strip = stripMap(wide, 3).width
        const across = strip + 2 * SideGutter + DeskColumnGap + DeskColumnWidth
        expect(deskColumnOf({ width: Math.floor(across) - 1, height: 702 }, 3)).toBeUndefined()
        expect(deskColumnOf({ width: Math.ceil(across) + 1, height: 702 }, 3)).toBeDefined()
        // The room alone decides it, so asking again gives the same answer.
        expect(deskColumnOf(wide, 3)).toEqual(deskColumnOf(wide, 3))
    })

    it('the standings stand one a row while they keep 0.85 of their own size; five seats at 880 px tall stand two a row', () => {
        expect(MinColumnRailScale).toBe(0.85)
        expect(deskColumnOf(wide, 4)).toEqual({ perRow: 1, width: DeskColumnWidth })
        expect(columnRailScale(wide.height - deskColumnFoot(4), 4, 1)).toBeGreaterThanOrEqual(0.85)
        expect(columnRailScale(wide.height - deskColumnFoot(5), 5, 1)).toBeLessThan(0.85)
        expect(deskColumnOf(wide, 5)).toEqual({
            perRow: 2,
            width: 2 * StandingsStrip.drawing.width + 4
        })
        expect(columnRailScale(wide.height - deskColumnFoot(5), 5, 2)).toBe(1)
    })

    it('a standing is drawn at its own size where the column has room, and smaller to fit, never larger', () => {
        const own = stripRailDrawingHeight(3)
        expect(columnRailScale(2000, 3, 1)).toBe(1)
        expect(columnRailScale(3 * own + 2 * 4, 3, 2)).toBeCloseTo(1, 5)
        const height = 300
        const scale = columnRailScale(height, 3, 1)
        expect(6 * own * scale + 5 * 4).toBeCloseTo(height, 5)
        expect(columnRailScale(0, 3, 1)).toBe(0)
    })

    it('the view ends with the column, so the zoom buttons stand at its foot, and the gutters bring the wrapper’s fit to the rest', () => {
        for (const room of [wide, { width: 1506, height: 600 }, { width: 1800, height: 500 }]) {
            const column = deskColumnOf(room, 3)!
            const width = deskColumnViewWidth(room, 3, column)
            expect(width).toBeLessThanOrEqual(room.width)
            const view = { width, height: room.height }
            const rest = deskMapAtRest(view, 3, false, column)
            const content = MapArea.width + rest.gutter + rest.trail
            const fit = Math.min(width / content, room.height / MapArea.height, 1)
            expect(fit).toBeCloseTo(rest.scale, 5)
            expect(rest.x).toBeCloseTo(SideGutter, 5)
            expect(rest.y).toBe(0)
            const box = deskColumnBox(view, column)
            expect(box).toEqual({
                x: width - column.width,
                y: 0,
                width: column.width,
                height: room.height
            })
            const gap = box.x - (rest.x + rest.width + SideGutter)
            expect(gap).toBeGreaterThanOrEqual(DeskColumnGap - 1e-6)
            expect(gap).toBeLessThan(DeskColumnGap + 1)
        }
    })

    it('in full screen the column stands at the view’s right edge, the map centred in the room left of it', () => {
        const view = { width: 1834, height: 700 }
        const column = deskColumnOf(view, 3)!
        const rest = deskMapAtRest(view, 3, true, column)
        const box = deskColumnBox(view, column)
        expect(box.x + box.width).toBe(view.width)
        const left = rest.x - SideGutter
        const right = box.x - DeskColumnGap - (rest.x + rest.width + SideGutter)
        expect(left).toBeGreaterThan(0)
        expect(left).toBeCloseTo(right, 5)
        expect((MapArea.width + rest.gutter + rest.trail) * rest.scale).toBeCloseTo(view.width, 5)
        expect(rest.y).toBeCloseTo((view.height - MapArea.height * rest.scale) / 2, 5)
    })

    it('the strip’s rest is as it was: a gutter each side, the same', () => {
        const rest = deskMapAtRest({ width: 1096, height: 722 }, 4, false)
        expect(rest.trail).toBeCloseTo(rest.gutter, 5)
    })
})

describe('Contract, Pick framing: a desk opens a guild side only for a pick wholly on it', () => {
    it('targets on one side open it; both sides keep it as it is; the map, a track or a mix close it', () => {
        expect(guildSideFollowing({ ...frameA, holds: ['west'], area: 'west' })).toBe('west')
        expect(guildSideFollowing({ ...frameA, holds: ['east'], area: 'east' })).toBe('east')
        expect(guildSideFollowing({ ...frameA, holds: ['west', 'east'], area: 'west' })).toBe(
            'keep'
        )
        expect(guildSideFollowing({ ...frameA, holds: ['map', 'west'] })).toBeUndefined()
        expect(guildSideFollowing({ ...frameA, holds: ['map'] })).toBeUndefined()
        expect(guildSideFollowing({ ...frameA, holds: ['tracks'] })).toBeUndefined()
        expect(guildSideFollowing(undefined)).toBeUndefined()
    })
})

describe('R-3.7 a pick frames once, and a hand clears it', () => {
    it('frames a lit set only when it is new: a hand’s pan stays until the lit set changes', () => {
        const { focus, pick } = focusOn()
        pick.frame = frameA
        expect(focus.framed).toBe(frameA)
        focus.handMoved()
        pick.frame = { ...frameA }
        expect(focus.framed).toBeUndefined()
        pick.frame = frameB
        expect(focus.framed).toBe(frameB)
    })

    it('closing gives back the chip it found', () => {
        const { focus, calls, pick } = focusOn()
        focus.choose('west')
        pick.frame = frameA
        expect(focus.framed).toBe(frameA)
        expect(focus.shown).toBeUndefined()
        pick.frame = undefined
        expect(focus.framed).toBeUndefined()
        expect(focus.shown).toBe('west')
        focus.settle()
        expect(calls.focused.at(-1)?.rect).toEqual(framed('west'))
    })

    it('a hand pan clears the framing and the chip: closing moves nothing', () => {
        const { focus, calls, pick } = focusOn()
        pick.frame = frameA
        focus.handMoved()
        expect(focus.framed).toBeUndefined()
        expect(focus.chosen).toBeUndefined()
        expect(focus.shown).toBeUndefined()
        pick.frame = undefined
        focus.settle()
        expect(calls.focused).toHaveLength(0)
        expect(calls.fits).toBe(0)
    })

    it('settling keeps a framing framed, as the view’s size changes', () => {
        const { focus, calls, pick } = focusOn()
        pick.frame = frameA
        focus.settle()
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
        const { focus, calls, pick } = focusOn()
        pick.frame = frameA
        focus.choose('east')
        expect(focus.framed).toBeUndefined()
        focus.settle()
        expect(calls.focused.at(-1)?.rect).toEqual(framed('east'))
    })

    it('a frame reaches no offer: it reads the view only', () => {
        const focusRect = vi.fn()
        const view = { focusRect, fitToContent: vi.fn() }
        const pick = new OpenPick()
        const focus = new BoardFocus({
            view: () => view,
            restScale: () => Rest,
            sideways: () => false,
            animate: () => false,
            pickFrame: pick.read
        })
        pick.frame = frameA
        flushSync(() => focus.settle())
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

    it('R-3.6 a pick frames every chip of the pawns sharing a space whole, as well as the pawns', () => {
        const player = stateWith.players[0]
        const placed = player?.pawns.find(({ spaceId }) => spaceId !== undefined)
        const shared = new HydratedFeudumGameState(structuredClone(host.state))
        const pawns = shared.getPlayerState(player?.playerId ?? '').pawns
        for (const pawn of pawns) {
            pawn.spaceId = placed?.spaceId
            pawn.character = pawn.character ?? 'merchant'
        }
        const off = { kind: 'role', label: 'off', tone: 'amber' } as const
        const targets = new Map<BoardTarget, { role: 'lit'; chip: typeof off }>(
            pawns.map(({ n }) => [`pawn:${player?.playerId}:${n}`, { role: 'lit', chip: off }])
        )
        const offer: BoardOffer = { targets, dimsRest: true }
        const frame = pickFrameOf(shared, offer)
        const chips = spaceChips(shared, offer, placed?.spaceId ?? 'space.sea.1')
        expect(chips).toHaveLength(3)
        for (const { chip, at } of chips) {
            const half = chipLayout(chip).width / 2
            expect(frame?.rect.x).toBeLessThanOrEqual(at.x - half)
            expect((frame?.rect.x ?? 0) + (frame?.rect.width ?? 0)).toBeGreaterThanOrEqual(
                at.x + half
            )
            expect(frame?.rect.y).toBeLessThanOrEqual(at.y - ChipHeight / 2)
        }
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
        expect(frame).toMatchObject({ area: 'west', rect: framed('west') })
        const east = pickFrameOf(stateWith, offerOf('guild:merchant'), 'guild:monk')
        expect(east).toMatchObject({ area: 'east', rect: framed('east') })
        expect(pickFrameOf(stateWith, offerOf(), 'voyage:2')?.rect.width).toBeGreaterThan(0)
    })

    it('no lit target frames nothing', () => {
        expect(pickFrameOf(stateWith, offerOf())).toBeUndefined()
    })
})

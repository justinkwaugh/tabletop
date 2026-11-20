import type { Point } from '@tabletop/common'
import { expect, test, type Page } from '@playwright/test'
import type {
    MotionFrame,
    PawnFrame,
    PaintedFrame,
    WatchedReplay
} from '../src/lib/testing/motionTablePage.js'
import { settled } from './helpers.js'

/**
 * Motion on the real table: every animation frame's piece, read back in the board's own coordinates,
 * so a framed phone reads the same as the desk. The session specs prove the plan and its timing; this
 * proves what paints, that the gate is up meanwhile and down after, and that nothing stays behind.
 */

declare global {
    interface Window {
        motionTable: {
            pressed(): Promise<string>
            walk(): Promise<MotionFrame[]>
            roundEnd(): Promise<MotionFrame[]>
            tableText(): string
            logLine(): string
            strayWrites(): string
            seat(): string
            replay(piece?: string): Promise<MotionFrame[]>
            replayPawn(): Promise<PawnFrame[]>
            replayTurn(): Promise<WatchedReplay>
        }
    }
}

const problems = new WeakMap<Page, string[]>()

test.beforeEach(({ page }) => {
    const seen: string[] = []
    problems.set(page, seen)
    page.on('pageerror', (error) => seen.push(error.message))
    page.on('console', (message) => {
        if (/Error (applying|handling)/.test(message.text())) {
            seen.push(message.text())
        }
    })
})

test.afterEach(({ page }) => {
    expect(problems.get(page)).toEqual([])
})

async function openTable(page: Page, call: string) {
    await page.goto('/')
    await page.addScriptTag({
        type: 'module',
        content: `import * as tables from '/src/lib/testing/motionTablePage.ts'
            await tables.${call}
            document.body.dataset.benchTable = ''`
    })
    await page.waitForSelector('body[data-bench-table]', { timeout: 45_000 })
    await settled(page)
    await page.evaluate(() => document.fonts.ready)
}

type Placed = MotionFrame & Point

const placed = (frames: readonly MotionFrame[]): Placed[] =>
    frames.filter((frame): frame is Placed => frame.x !== undefined && frame.y !== undefined)

/** The distinct places a piece stood, in board units, in the order it stood there. */
function standings(frames: readonly MotionFrame[]): Placed[] {
    return placed(frames).filter(
        (frame, index, all) =>
            index === 0 || Math.hypot(frame.x - all[index - 1].x, frame.y - all[index - 1].y) > 0.25
    )
}

function expectGateAcross(frames: readonly MotionFrame[]) {
    const moving = frames.filter(({ writes }) => writes !== '')
    expect(moving.length).toBeGreaterThan(0)
    for (const frame of moving) {
        expect(frame.updating).toBe(true)
        expect(frame.capInert).toBe(true)
        expect(frame.overlaysInert).toBe(true)
        expect(frame.lit).toBe(0)
    }
    const last = frames.at(-1)
    expect(last?.updating).toBe(false)
    expect(last?.capInert).toBe(false)
    expect(last?.overlaysInert).toBe(false)
    expect(last?.writes).toBe('')
    expect(last?.tokens).toEqual([])
}

test.describe('on the desk', () => {
    test('R-3.7.1 a live Move: the pawn walks its road, the table gated, and nothing left behind', async ({
        page
    }) => {
        await openTable(page, 'openWalkTable()')
        expect(await page.evaluate(() => window.motionTable.pressed())).toContain('Move')
        const sending = page.evaluate(() => window.motionTable.walk())
        await page.waitForTimeout(250)
        await page.screenshot({ path: test.info().outputPath('walk-mid.png') })
        const frames = await sending
        await page.screenshot({ path: test.info().outputPath('walk-end.png') })

        const stood = standings(frames)
        expect(stood.length).toBeGreaterThan(5)
        const [first] = stood
        const last = stood[stood.length - 1]
        const whole = Math.hypot(last.x - first.x, last.y - first.y)
        expect(whole).toBeGreaterThan(5)
        // No jump: the walk's own steps are small against the road, and the end stays where it landed.
        const steps = stood
            .slice(1)
            .map((one, index) => Math.hypot(one.x - stood[index].x, one.y - stood[index].y))
        expect(Math.max(...steps)).toBeLessThan(whole / 2)
        expectGateAcross(frames)
        expect(await page.evaluate(() => window.motionTable.strayWrites())).toBe('')
    })

    test('R-4.11.1, R-4.12 the round end: die and dawn on one gated stretch, the table given back', async ({
        page
    }) => {
        await openTable(page, 'openRoundEndTable()')
        const frames = await page.evaluate(() => window.motionTable.roundEnd())
        const die = frames.filter(({ tokens }) => tokens.includes('die-face'))
        expect(die.length).toBeGreaterThan(3)
        for (const frame of die) {
            expect(frame.updating).toBe(true)
            expect(frame.capInert).toBe(true)
        }
        const last = frames.at(-1)
        expect(last?.updating).toBe(false)
        expect(last?.capInert).toBe(false)
        expect(last?.tokens).toEqual([])
        await page.screenshot({ path: test.info().outputPath('round-end.png') })
    })
})

test('S64 R-3.7.1 a replayed turn walks a pawn its first Action brought on: no jump when it shows', async ({
    page
}) => {
    await openTable(page, 'openMigrateMoveTable()')
    const frames = await page.evaluate(() => window.motionTable.replayPawn())
    const final = frames.at(-1)
    expect(final?.drawn).toBe('piece')
    // Where the Migrate's copy came to rest: the first place it held for three frames.
    const rest = frames.findIndex(
        (frame, index) =>
            index + 2 < frames.length &&
            [1, 2].every(
                (ahead) =>
                    Math.hypot(
                        frames[index + ahead].x - frame.x,
                        frames[index + ahead].y - frame.y
                    ) < 0.25
            )
    )
    expect(rest).toBeGreaterThanOrEqual(0)
    const after = frames.slice(rest)
    const landed = after[0]
    const whole = Math.hypot((final?.x ?? 0) - landed.x, (final?.y ?? 0) - landed.y)
    expect(whole).toBeGreaterThan(5)
    // From there the Move walks it along the road, the copy carried, and the piece shows where the
    // walk ended: every step small against the road, the copy to the piece included.
    const steps = after
        .slice(1)
        .map((one, index) => Math.hypot(one.x - after[index].x, one.y - after[index].y))
    expect(Math.max(...steps)).toBeLessThan(whole / 2)
})

test('S65 R-3.7.1 reduced motion: the Move lands with no tween, and what the table reads is the same', async ({
    page
}) => {
    const walk = async (reducedMotion: 'reduce' | 'no-preference') => {
        await page.emulateMedia({ reducedMotion })
        await openTable(page, 'openWalkTable()')
        expect(await page.evaluate(() => window.motionTable.pressed())).toContain('Move')
        const frames = await page.evaluate(() => window.motionTable.walk())
        return {
            frames,
            text: await page.evaluate(() => window.motionTable.tableText()),
            log: await page.evaluate(() => window.motionTable.logLine())
        }
    }
    const moving = await walk('no-preference')
    const still = await walk('reduce')

    expect(standings(moving.frames).length).toBeGreaterThan(5)
    // Where it stood and where it stands, with nothing between and no wait: at most the first
    // frame still shows it where it stood before it is simply where the Move ends.
    const stood = standings(still.frames)
    expect(stood.length).toBeLessThanOrEqual(2)
    const from = standings(moving.frames)[0]
    const to = stood.at(-1)
    expect(Math.hypot((to?.x ?? 0) - from.x, (to?.y ?? 0) - from.y)).toBeGreaterThan(5)
    expect(placed(still.frames).at(-1)).toMatchObject({
        x: placed(moving.frames).at(-1)?.x,
        y: placed(moving.frames).at(-1)?.y
    })
    expect(still.frames.at(-1)).toMatchObject({ updating: false, writes: '', tokens: [] })
    expect(still.text).toBe(moving.text)
    expect(moving.log).toMatch(/^You moved /)
    expect(still.log).toBe(moving.log)
})

test.describe('a framed phone', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })

    test('R-3.7.1 the walk reads the same on the board, and the view is never moved by it', async ({
        page
    }) => {
        await openTable(page, 'openWalkTable()')
        expect(await page.evaluate(() => window.motionTable.pressed())).toContain('Move')
        await settled(page)
        const frames = await page.evaluate(() => window.motionTable.walk())
        await page.screenshot({ path: test.info().outputPath('phone-walk-end.png') })
        const stood = standings(frames)
        expect(stood.length).toBeGreaterThan(5)
        const [first] = stood
        const last = stood[stood.length - 1]
        const whole = Math.hypot(last.x - first.x, last.y - first.y)
        const steps = stood
            .slice(1)
            .map((one, index) => Math.hypot(one.x - stood[index].x, one.y - stood[index].y))
        expect(Math.max(...steps)).toBeLessThan(whole / 2)
        expectGateAcross(frames)
        // The view stands where the pick left it for as long as the piece is moving.
        const moving = frames.filter(({ writes }) => writes !== '')
        expect(new Set(moving.map(({ scale }) => Math.round(scale))).size).toBe(1)
    })
})

/**
 * Contract, Replay: the moving pieces in order of first sight, the frames each is painted in, and
 * how far its last painted place stands from the nearest piece, against its travel.
 */
function replayedSteps({ frames, pieces }: WatchedReplay) {
    const order = [...new Set(frames.flatMap(({ seen }) => seen.map(({ id }) => id)))]
    const seenIn = (id: string) =>
        frames.flatMap(({ seen }, index) => (seen.some((one) => one.id === id) ? [index] : []))
    const placeIn = (index: number | undefined, id: string) =>
        index === undefined ? undefined : frames[index].seen.find((one) => one.id === id)
    const landing = (id: string) => {
        const first = placeIn(seenIn(id).at(0), id)
        const last = placeIn(seenIn(id).at(-1), id)
        if (!first || !last || pieces.length === 0) {
            return undefined
        }
        const travel = Math.hypot(last.x - first.x, last.y - first.y)
        const off = Math.min(...pieces.map(({ x, y }) => Math.hypot(x - last.x, y - last.y)))
        return { travel, off }
    }
    return { order, seenIn, landing }
}

/** A frame short of the landing, and a piece's box drawn off its centre: a few pixels at most. */
const LandingSlack = 6

const firstFrame = (frames: readonly PaintedFrame[], ids: readonly string[]) =>
    frames.findIndex(({ seen }) => seen.some(({ id }) => ids.includes(id)))

for (const side of [undefined, 'west'] as const) {
    test(`S64 R-3.15, R-4.6.5 a replayed turn takes on the good its first Action laid down: ${side ? 'on a desk with the West side open, the flight layer’s copy' : 'on a phone’s board, its token'} goes as the next one leaves, and the piece shows where that one ends`, async ({
        page
    }) => {
        await page.setViewportSize(
            side ? { width: 1440, height: 900 } : { width: 390, height: 844 }
        )
        await openTable(page, `openGuildRepeatTable(${side ? `'${side}'` : ''})`)
        const watched = await page.evaluate(() => window.motionTable.replayTurn())
        const { order, seenIn, landing } = replayedSteps(watched)
        // The push's good, then the pull's: one moving good each.
        expect(order).toHaveLength(2)
        const [pushed, pulled] = order
        const taken = firstFrame(watched.frames, [pulled])
        expect(seenIn(pushed)[0]).toBeLessThan(taken)
        // Never two: once the pull's good is on its way, the push's is gone from the market.
        expect(seenIn(pushed).filter((index) => index >= taken)).toEqual([])
        expect(watched.pieces).toHaveLength(1)
        // No jump: the last frame painted before the state shows is the flight's last stretch.
        const end = landing(pulled)
        expect(end?.travel).toBeGreaterThan(50)
        expect(end?.off).toBeLessThan(LandingSlack)
    })
}

test('S64 R-3.15, R-4.6.4 a replayed turn lifts the bead its first Action laid on the rosary: on a desk with the East side open, that copy goes as the lift starts, and the bead put back shows where its copy ends', async ({
    page
}) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openTable(page, `openBeadRepeatTable('east')`)
    const watched = await page.evaluate(() => window.motionTable.replayTurn())
    const { order, seenIn, landing } = replayedSteps(watched)
    // The flipped seal, then the two beads lifted: the high and the low.
    expect(order).toHaveLength(3)
    const [flipped, ...lifted] = order
    const lift = firstFrame(watched.frames, lifted)
    expect(seenIn(flipped)[0]).toBeLessThan(lift)
    // Never two: once the lift starts, the first Action's copy is gone from the rosary.
    expect(seenIn(flipped).filter((index) => index >= lift)).toEqual([])
    for (const bead of lifted) {
        expect(seenIn(bead).length).toBeGreaterThan(5)
    }
    // The rosary stands in the open side, the chicken the drawn bead goes to off it: the bead put
    // back is drawn where its copy came to rest.
    const ends = lifted.flatMap((bead) => landing(bead) ?? [])
    expect(Math.min(...ends.map(({ off }) => off))).toBeLessThan(LandingSlack)
})

test('S64 R-3.15, R-4.5.3 a replayed turn moves up the rank its first Action brought on: on a desk with the West side open, the resting copy slides with the second Migrate, and the marker shows where it stops', async ({
    page
}) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openTable(page, `openRankRepeatTable('west')`)
    const watched = await page.evaluate(() => window.motionTable.replayTurn())
    const { order, seenIn } = replayedSteps(watched)
    // The first Migrate's marker, the one copy: the second's is the board's slide of that piece.
    expect(order).toHaveLength(1)
    const [marker] = order
    const places = seenIn(marker).map((index) => {
        const seen = watched.frames[index].seen.find(({ id }) => id === marker)
        return { x: seen?.x ?? NaN, y: seen?.y ?? NaN }
    })
    const still = (index: number) =>
        [1, 2].every(
            (ahead) =>
                Math.hypot(
                    places[index + ahead].x - places[index].x,
                    places[index + ahead].y - places[index].y
                ) < 0.25
        )
    const rest = places.findIndex((_, index) => index + 2 < places.length && still(index))
    expect(rest).toBeGreaterThanOrEqual(0)
    const landed = places[rest]
    const last = places.at(-1) ?? landed
    const slide = Math.hypot(last.x - landed.x, last.y - landed.y)
    expect(slide).toBeGreaterThan(5)
    expect(watched.pieces).toHaveLength(1)
    const [piece] = watched.pieces
    expect(Math.hypot(piece.x - last.x, piece.y - last.y)).toBeLessThan(LandingSlack)
})

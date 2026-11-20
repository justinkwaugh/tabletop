import { expect, test, type Page } from '@playwright/test'
import type { MotionFrame, PawnFrame } from '../src/lib/testing/motionTablePage.js'
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

type Placed = MotionFrame & { readonly x: number; readonly y: number }

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

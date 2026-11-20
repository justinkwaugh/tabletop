import type { Point } from '@tabletop/common'
import { expect, test, type Page } from '@playwright/test'
import type { MotionFrame } from '../src/lib/testing/motionTablePage.js'
import { createGame, playToCards, settled, shot } from './helpers.js'

/** The log on a real table: entries, interstitials, jump and replay, what a watcher would see. */

const problems = new WeakMap<Page, string[]>()

test.beforeEach(({ page }) => {
    const seen: string[] = []
    problems.set(page, seen)
    page.on('pageerror', (error) => seen.push(error.message))
    page.on('console', (message) => {
        if (/Error (applying|handling|presenting)/.test(message.text())) {
            seen.push(message.text())
        }
    })
})

test.afterEach(({ page }) => {
    expect(problems.get(page)).toEqual([])
})

const panel = (page: Page) => page.locator('[data-action-panel]')

async function playAMove(page: Page) {
    await createGame(page)
    await playToCards(page)
    await panel(page).getByRole('button', { name: 'Move', exact: true }).click()
    await settled(page)
    await page.locator('[data-pick-role="lit"]').first().locator('[role="button"]').click()
    await settled(page)
    await panel(page)
        .getByRole('button', { name: /No pilfer/ })
        .click()
    await settled(page)
    await panel(page).locator('[data-primary]').click()
    await settled(page)
    await page.getByRole('tab', { name: 'History' }).click()
}

const list = (page: Page) => page.locator('[data-history-list]')
const entry = (page: Page, first: number) => list(page).locator(`[data-first-index="${first}"]`)
const current = (page: Page) => page.evaluate(() => window.feudumSession.currentAction?.index)
const viewing = (page: Page) => page.evaluate(() => window.feudumSession.isViewingHistory)

test('R-X.1 A name in the log reads as the platform gives it, at the start of a line too', async ({
    page
}) => {
    await createGame(page, (seat) => `seat ${seat}`)
    await playToCards(page)
    await page.getByRole('tab', { name: 'History' }).click()
    await expect(list(page).locator('[data-action-line]').first()).toBeVisible()
    // As painted, so that a style that changes the letters counts too.
    const painted = await list(page).innerText()
    expect(painted).toMatch(/^seat [2-4]\b/m)
    expect(painted).not.toMatch(/Seat [2-4]/)
})

test('S61 S64 R-2.2 The hotseat log: grouped, jumped and replayed, and the seat stays who it was', async ({
    page
}) => {
    await playAMove(page)
    await shot(page, 'log')

    // By hand from setup: four seats` goods and pawns are 0 to 7, the round starts at 8, hands 9 to 12 and their reveal 13.
    const hands = entry(page, 9)
    await expect(hands).toHaveAttribute('data-history-entry', 'hands')
    await expect(hands).toHaveAttribute('data-last-index', '13')
    await expect(hands.locator('[data-action-line]')).toHaveCount(5)
    await expect(hands.locator('button')).toHaveCount(0)
    const turn = entry(page, 14)
    await expect(turn).toHaveAttribute('data-history-entry', 'turn')
    await expect(turn.locator('[data-action-line]').first()).toHaveAttribute(
        'data-action-line',
        /moved/
    )
    // Newest first: this turn, the hands, then the round that opened them.
    await expect(list(page).locator('[data-history-entry]').first()).toHaveAttribute(
        'data-first-index',
        '14'
    )
    await expect(list(page).locator('[data-history-entry]').nth(1)).toHaveAttribute(
        'data-first-index',
        '9'
    )
    await expect(list(page).locator('[data-history-divider="round"]')).toContainText('Round 1')
    await expect(list(page).locator('[data-history-divider="epoch"]')).toContainText('Epoch I')

    // A replay in the hotseat: the list reads as it did, frame to frame, and the table comes back.
    const seat = await page.evaluate(() => window.feudumSession.myPlayerId)
    const frames = await page.evaluate(async () => {
        const session = window.feudumSession
        const list = document.querySelector('[data-history-list]')
        const seen: { text: string; viewing: boolean; index?: number; refused: boolean }[] = []
        let running = true
        const sample = () => {
            if (running) {
                seen.push({
                    text: list?.textContent ?? '',
                    viewing: session.isViewingHistory,
                    index: session.currentAction?.index,
                    refused: [...(list?.querySelectorAll('button') ?? [])].every(
                        (each) => each.disabled
                    )
                })
                requestAnimationFrame(sample)
            }
        }
        requestAnimationFrame(sample)
        const button = list?.querySelector<HTMLButtonElement>(
            '[data-first-index="14"] [data-history-replay]'
        )
        button?.click()
        do {
            await new Promise((done) => setTimeout(done, 50))
        } while (session.historyLog.replaying)
        running = false
        return seen
    })
    expect(frames.some(({ viewing }) => viewing)).toBe(true)
    expect(frames.filter(({ viewing }) => viewing).every(({ refused }) => refused)).toBe(true)
    expect([...new Set(frames.map(({ text }) => text))]).toHaveLength(1)
    await settled(page)
    expect(await viewing(page)).toBe(false)
    expect(await page.evaluate(() => window.feudumSession.myPlayerId)).toBe(seat)

    // A jump on the turn: History View on its last Action, the line described, no panel.
    await turn.locator('[data-history-jump]').click()
    await settled(page)
    expect(await viewing(page)).toBe(true)
    expect(await current(page)).toBe(14)
    await expect(panel(page)).toHaveCount(0)
    await expect(page.locator('[data-history-description] [data-action-line]')).toHaveAttribute(
        'data-action-line',
        /moved/
    )
    await shot(page, 'jump-turn')

    // A jump on the round: as it began, no hand finalised.
    await list(page).locator('[data-history-divider="round"] [data-history-jump]').click()
    await settled(page)
    expect(await current(page)).toBe(8)
    expect(await page.evaluate(() => window.feudumSession.gameState.machineState)).toBe(
        'SelectingHands'
    )
    await shot(page, 'jump-round')
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

/** The distinct places a piece stood, in board units, in the order it stood there. */
function standings(frames: readonly MotionFrame[]): Placed[] {
    return frames
        .filter((frame): frame is Placed => frame.x !== undefined && frame.y !== undefined)
        .filter(
            (frame, index, all) =>
                index === 0 ||
                Math.hypot(frame.x - all[index - 1].x, frame.y - all[index - 1].y) > 0.25
        )
}

test('S64 R-3.7.1, R-3.7.4 Replaying a Move: the steps along the route, then the pilfer, then back', async ({
    page
}) => {
    await openTable(page, 'openPilferTable()')
    const before = await page.evaluate(() => window.motionTable.tableText())

    const frames = await page.evaluate(() => window.motionTable.replay())

    expect(standings(frames).length).toBeGreaterThan(5)
    const last = frames.at(-1)
    expect(last?.updating).toBe(false)
    const [ended] = standings(frames.filter(({ x }) => x !== undefined).slice(-1))
    // The pilfer follows the walk: nothing shows until the piece has walked to where it ends.
    const firstShown = frames.findIndex(({ shownTokens }) => shownTokens.includes('good'))
    expect(firstShown).toBeGreaterThan(0)
    const farthest = Math.max(
        ...standings(frames.slice(0, firstShown)).map(({ x, y }) =>
            Math.hypot(x - ended.x, y - ended.y)
        )
    )
    expect(farthest).toBeGreaterThan(20)
    expect(frames[firstShown].x).toBeCloseTo(ended.x, 0)
    expect(frames[firstShown].y).toBeCloseTo(ended.y, 0)
    expect(last?.tokens).toEqual([])
    expect(await viewing(page)).toBe(false)
    expect(await page.evaluate(() => window.motionTable.tableText())).toBe(before)
})

/** Every score copy that crossed the table while `run` played, by the seat it flew to. */
async function scoreFlightsDuring(page: Page, run: () => Promise<unknown>): Promise<string[]> {
    await page.evaluate(() => {
        const seen = new Set<string>()
        Object.assign(window, { scoreFlightsSeen: seen })
        const sample = () => {
            for (const copy of document.querySelectorAll('[data-flight-row="score"]')) {
                seen.add(copy.querySelector('[aria-label]')?.getAttribute('aria-label') ?? '')
            }
            if (Reflect.get(window, 'scoreFlightsSeen') === seen) {
                requestAnimationFrame(sample)
            }
        }
        requestAnimationFrame(sample)
    })
    await run()
    return page.evaluate(() => {
        const seen = Reflect.get(window, 'scoreFlightsSeen') as Set<string>
        Reflect.deleteProperty(window, 'scoreFlightsSeen')
        return [...seen]
    })
}

test('S64 R-4.12 Replaying a dawn: the epoch marker moves and the scores fly to the seats, then back', async ({
    page
}) => {
    await openTable(page, 'openDawnTable()')
    const before = await page.evaluate(() => window.motionTable.tableText())

    const replaying = page.evaluate(() => window.motionTable.replay('epoch-marker'))
    await page.waitForTimeout(1_000)
    await page.screenshot({ path: test.info().outputPath('dawn-replaying.png') })
    const marker = await replaying

    expect(standings(marker).length).toBeGreaterThan(5)
    await settled(page)
    expect(await viewing(page)).toBe(false)
    expect(await page.evaluate(() => window.motionTable.tableText())).toBe(before)
    await page.screenshot({ path: test.info().outputPath('dawn-replayed.png') })

    // A desk's board draws no score ring: each score crosses the table to its seat panel.
    const flown = await scoreFlightsDuring(page, () =>
        page.evaluate(() => window.motionTable.replay('epoch-marker'))
    )
    expect(flown.length).toBeGreaterThan(0)
    await settled(page)
    expect(await page.locator('[data-flight]').count()).toBe(0)
    expect(await page.evaluate(() => window.motionTable.tableText())).toBe(before)
})

test('S64 R-4.12 Replaying a dawn on a phone: a score disc walks the ring, then back', async ({
    page
}) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await openTable(page, 'openDawnTable()')
    const seat = await page.evaluate(() => window.motionTable.seat())
    const disc = await page.evaluate((piece) => window.motionTable.replay(piece), `score:${seat}`)
    expect(standings(disc).length).toBeGreaterThan(5)
    await settled(page)
    expect(await viewing(page)).toBe(false)
})

test.describe('on a phone', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })

    test('S64 R-2.2 The log fits, and each of its buttons is big enough to tap', async ({
        page
    }) => {
        await playAMove(page)
        await shot(page, 'phone-log')

        const buttons = list(page).locator('[data-history-replay], [data-history-jump]')
        expect(await buttons.count()).toBeGreaterThan(1)
        for (const button of await buttons.all()) {
            const box = await button.boundingBox()
            expect(box?.height).toBeGreaterThanOrEqual(44)
            expect(box?.width).toBeGreaterThanOrEqual(44)
        }
        const wide = await list(page).evaluate((element) => ({
            across: element.scrollWidth - element.clientWidth,
            right: element.getBoundingClientRect().right
        }))
        expect(wide.across).toBe(0)
        expect(wide.right).toBeLessThanOrEqual(375)

        await entry(page, 14).locator('[data-history-jump]').tap()
        await settled(page)
        expect(await current(page)).toBe(14)
    })
})

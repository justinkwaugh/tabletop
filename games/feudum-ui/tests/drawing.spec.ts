import { expect, test, type Page } from '@playwright/test'
import { createGame, playToCards, playToHands, settled } from './helpers.js'
import { ActionType, MachineState } from '@tabletop/feudum'
import { realGames } from '@tabletop/feudum/testing'
import { openFixture } from './scenarioTable.js'

/**
 * How the table draws, by the platform's phone-rendering rules: what WebKit pays for on a phone
 * that the other specs cannot see.
 */

declare global {
    interface Window {
        feudumListenerLog: string[]
    }
}

const WheelAndTouch = ['wheel', 'mousewheel', 'touchstart', 'touchmove']
const Pointer = ['pointerenter', 'pointerleave', 'pointerover', 'pointerout']

/** Every listener of these types added or removed on the page, from its first script on. */
async function logListeners(page: Page, types: readonly string[] = WheelAndTouch) {
    await page.addInitScript((types) => {
        const watched = new Set(types)
        const log: string[] = []
        window.feudumListenerLog = log
        const { addEventListener, removeEventListener } = EventTarget.prototype
        EventTarget.prototype.addEventListener = function (
            this: EventTarget,
            type: string,
            ...rest: [EventListenerOrEventListenerObject | null, unknown?]
        ) {
            if (watched.has(type)) log.push(`add ${type}`)
            return addEventListener.call(this, type, ...(rest as [EventListener]))
        }
        EventTarget.prototype.removeEventListener = function (
            this: EventTarget,
            type: string,
            ...rest: [EventListenerOrEventListenerObject | null, unknown?]
        ) {
            if (watched.has(type)) log.push(`remove ${type}`)
            return removeEventListener.call(this, type, ...(rest as [EventListener]))
        }
    }, types)
}

/** The properties each running CSS animation changes, by animation name. */
async function animatedProperties(page: Page): Promise<Record<string, string[]>> {
    return page.evaluate(() => {
        const timing = new Set(['offset', 'computedOffset', 'easing', 'composite'])
        const found: Record<string, string[]> = {}
        for (const animation of document.getAnimations()) {
            if (!(animation instanceof CSSAnimation)) continue
            const effect = animation.effect as KeyframeEffect
            // A component's keyframes are named after it: its own name ends the scoped one.
            const name = animation.animationName.split('-').slice(-2).join('-')
            const properties = effect
                .getKeyframes()
                .flatMap((frame) => Object.keys(frame).filter((key) => !timing.has(key)))
            found[name] = [...new Set([...(found[name] ?? []), ...properties])].sort()
        }
        return found
    })
}

test('opening and closing the Key and the Supply card adds and removes no wheel or touch listener', async ({
    page
}) => {
    await logListeners(page)
    await createGame(page)
    await playToCards(page)
    await settled(page)
    await page.evaluate(() => window.feudumListenerLog.splice(0))

    await page.locator('[data-symbol-key-toggle]').click()
    await expect(page.locator('#feudum-symbol-key')).toBeVisible()
    await page.locator('[data-symbol-key-toggle]').click()
    await expect(page.locator('#feudum-symbol-key')).toHaveCount(0)
    await page.locator('[data-supply-toggle]').click()
    await expect(page.locator('#feudum-supply')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('#feudum-supply')).toHaveCount(0)

    // A wheel over an open card still never zooms the board beneath it.
    await page.locator('[data-symbol-key-toggle]').click()
    const before = await page.locator('[data-board-surface]').boundingBox()
    await page.locator('#feudum-symbol-key').hover()
    await page.mouse.wheel(0, -400)
    await page.waitForTimeout(400)
    expect(await page.locator('[data-board-surface]').boundingBox()).toEqual(before)

    expect(await page.evaluate(() => window.feudumListenerLog)).toEqual([])
})

test('opening, switching and closing the guild sides adds and removes no wheel or touch listener', async ({
    page
}) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await logListeners(page)
    await createGame(page)
    await playToCards(page)
    await settled(page)
    await page.evaluate(() => window.feudumListenerLog.splice(0))

    await page.locator('[data-guild-side="west"]').click()
    await expect(page.locator('[data-guild-view="west"]')).toBeVisible()
    await page.locator('[data-guild-side="east"]').click()
    await expect(page.locator('[data-guild-view="east"]')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-guild-view]')).toHaveCount(0)

    // A wheel over an open side still never zooms the board beneath it.
    await page.locator('[data-guild-side="west"]').click()
    await expect(page.locator('[data-guild-view="west"]')).toBeVisible()
    const before = await page.locator('[data-board-surface]').boundingBox()
    await page
        .locator('[data-guild-view="west"] [data-guild-scrim]')
        .hover({ position: { x: 8, y: 8 } })
    await page.mouse.wheel(0, -400)
    await page.waitForTimeout(400)
    expect(await page.locator('[data-board-surface]').boundingBox()).toEqual(before)

    expect(await page.evaluate(() => window.feudumListenerLog)).toEqual([])
})

test('a map pick and the panel rows it brings add and remove no pointer listener', async ({
    page
}) => {
    await logListeners(page, Pointer)
    await createGame(page)
    await playToCards(page)
    await settled(page)
    await page.evaluate(() => window.feudumListenerLog.splice(0))

    for (const card of ['Move', 'Influence']) {
        const press = page.locator(`[data-cards="hand"] [data-row^="${card}"] button`).first()
        if ((await press.count()) === 0) continue
        await press.hover()
        await press.click()
        await settled(page)
        await page.getByRole('button', { name: 'Undo', exact: true }).click()
        await settled(page)
    }
    await expect(page.locator('[data-open-site]').first()).toBeAttached()

    expect(await page.evaluate(() => window.feudumListenerLog)).toEqual([])
})

test('the desk side column coming and going with the room adds and removes no wheel listener', async ({
    page
}) => {
    await page.setViewportSize({ width: 1850, height: 880 })
    await logListeners(page)
    await createGame(page)
    await playToCards(page)
    await settled(page)
    await expect(page.locator('[data-desk-column]')).toBeVisible()
    await page.evaluate(() => window.feudumListenerLog.splice(0))

    await page.setViewportSize({ width: 1280, height: 800 })
    await settled(page)
    await expect(page.locator('[data-desk-column]')).toHaveCount(0)
    await page.setViewportSize({ width: 1850, height: 880 })
    await settled(page)
    await expect(page.locator('[data-desk-column]')).toBeVisible()

    // A wheel over the column still never zooms the board beside it.
    const before = await page.locator('[data-board-surface]').boundingBox()
    await page.locator('[data-desk-column]').hover()
    await page.mouse.wheel(0, -400)
    await page.waitForTimeout(400)
    expect(await page.locator('[data-board-surface]').boundingBox()).toEqual(before)

    expect(await page.evaluate(() => window.feudumListenerLog)).toEqual([])
})

/** Every element of the board drawn at an opacity below 1: its box in board units, and the pieces in it. */
function translucent(page: Page) {
    return page.locator('[data-board-surface]').evaluate((svg) =>
        [...svg.querySelectorAll('*')].flatMap((element) => {
            if (!(element instanceof SVGGraphicsElement)) return []
            const opacity = Number(getComputedStyle(element).opacity)
            if (opacity >= 1) return []
            const { width, height } = element.getBBox()
            const pieces = element.querySelectorAll('[data-world]').length
            return [{ tag: element.tagName, opacity, width, height, pieces }]
        })
    )
}

/** The largest single piece the board dims: a location disc's frame, or a region's stack of tiles. */
const LargestPiece = 100

type Dimmed = Awaited<ReturnType<typeof translucent>>[number]

/** Phone rendering, effects stay piece-sized: each fade holds at most one piece, at a piece's size. */
function largerThanAPiece(dims: readonly Dimmed[]): Dimmed[] {
    return dims.filter(
        ({ width, height, pieces }) => pieces > 1 || width > LargestPiece || height > LargestPiece
    )
}

/**
 * A late position of a five-seat game the logic's scripted seats played: the last time a seat held
 * its Move card and played it, as the harness opens a scenario file, with every Action before it.
 */
function lateFiveSeatMove() {
    const walk = realGames().find(({ game }) => game.players.length === 5)
    if (!walk) throw new Error('The logic plays a five-seat game')
    const index = walk.steps.findLastIndex(
        ({ input, before }) =>
            input.type === ActionType.Move &&
            before.machineState === MachineState.PlayingCards &&
            before.players.some(
                ({ playerId, hand }) => playerId === input.playerId && (hand ?? []).includes('move')
            )
    )
    const step = walk.steps[index]
    return {
        seat: step.input.playerId,
        scenario: {
            game: walk.game,
            state: step.before,
            actions: walk.steps.slice(0, index).flatMap(({ processed }) => processed)
        }
    }
}

test.describe('the dims of a pick, on a phone that draws the whole board', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

    for (const [fixture, card] of [
        ['guild-pick', 'Guild'],
        ['cards-migrate', 'Migrate']
    ] as const) {
        test(`${fixture}: what dims is piece-sized, and one veil a raster stands under`, async ({
            page
        }) => {
            test.setTimeout(120_000)
            await openFixture(page, fixture)
            await settled(page)
            await page.locator(`[data-cards="hand"] [data-row^="${card}"] button`).first().click()
            await settled(page)
            await expect(
                page.locator('[data-board-surface] [data-pick-role="lit"]').first()
            ).toBeAttached()
            expect(largerThanAPiece(await translucent(page))).toEqual([])
            // The map's raster and each dimmed guild area's print stand under a veil, a plain shape.
            expect(
                await page.locator('[data-board-surface] [data-dim-veil]').count()
            ).toBeGreaterThan(0)
        })
    }

    test('a late five-seat Move: each piece on a space dims as itself', async ({ page }) => {
        test.setTimeout(180_000)
        const { scenario } = lateFiveSeatMove()
        await page.goto('/')
        await page.waitForLoadState('networkidle')
        await expect(page.getByRole('button', { name: 'Scenarios' })).toBeVisible()
        await page.locator('input[aria-label="Scenario file"]').setInputFiles({
            name: 'late-five-seat-move.json',
            mimeType: 'application/json',
            buffer: Buffer.from(JSON.stringify(scenario))
        })
        const move = page.locator('[data-cards="hand"] [data-row^="Move"] button').first()
        await expect(move).toBeVisible({ timeout: 60_000 })
        await settled(page)
        await move.click()
        await settled(page)
        await expect(
            page.locator('[data-board-surface] [data-pick-role="lit"]').first()
        ).toBeAttached()
        const dims = await translucent(page)
        expect(dims.filter(({ pieces }) => pieces === 1).length).toBeGreaterThan(20)
        expect(largerThanAPiece(dims)).toEqual([])
    })
})

test.describe('waiting seats', () => {
    test('a seat waiting on its choice pulses by opacity alone, at a desk', async ({ page }) => {
        await createGame(page)
        await playToHands(page)
        await settled(page)
        await expect(page.locator('[data-seat-panel] [data-deciding]').first()).toBeVisible()
        const animated = await animatedProperties(page)
        expect(Object.keys(animated)).toContain('ribbon-pulse')
        for (const properties of Object.values(animated)) {
            expect(properties.filter((property) => property !== 'opacity')).toEqual([])
        }
    })

    test.describe('on a phone', () => {
        test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

        test('a seat waiting on its choice pulses by opacity alone', async ({ page }) => {
            await createGame(page)
            await playToHands(page)
            await settled(page)
            await expect(page.locator('[data-seat-chip][data-deciding]').first()).toBeVisible()
            const animated = await animatedProperties(page)
            expect(Object.keys(animated)).toContain('chip-pulse')
            for (const properties of Object.values(animated)) {
                expect(properties.filter((property) => property !== 'opacity')).toEqual([])
            }
        })
    })
})

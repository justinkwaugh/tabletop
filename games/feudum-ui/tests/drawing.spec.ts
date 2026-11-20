import { expect, test, type Page } from '@playwright/test'
import { createGame, playToCards, playToHands, settled } from './helpers.js'
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

/** Every wheel and touch listener added or removed on the page, from its first script on. */
async function logListeners(page: Page) {
    await page.addInitScript(() => {
        const watched = new Set(['wheel', 'mousewheel', 'touchstart', 'touchmove'])
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
    })
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

/** Every element of the board drawn at an opacity below 1, with its box in board units. */
function translucent(page: Page) {
    return page.locator('[data-board-surface]').evaluate((svg) =>
        [...svg.querySelectorAll('*')].flatMap((element) => {
            if (!(element instanceof SVGGraphicsElement)) return []
            const opacity = Number(getComputedStyle(element).opacity)
            if (opacity >= 1) return []
            const { width, height } = element.getBBox()
            return [{ tag: element.tagName, opacity, width, height }]
        })
    )
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
            // Phone rendering, effects stay piece-sized: no group the size of the board, the map
            // or a guild area fades as one; the largest piece is a location disc's frame.
            const large = (await translucent(page)).filter(
                ({ width, height }) => width > 160 || height > 160
            )
            expect(large).toEqual([])
            // The map's raster and each dimmed guild area's print stand under a veil, a plain shape.
            expect(
                await page.locator('[data-board-surface] [data-dim-veil]').count()
            ).toBeGreaterThan(0)
        })
    }
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

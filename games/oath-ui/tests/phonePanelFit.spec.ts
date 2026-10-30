import { expect, test, type Page } from '@playwright/test'
import type * as TableFixture from '../src/lib/testing/tableFixture.js'

type Fixture = typeof TableFixture

async function call<K extends keyof Fixture>(
    page: Page,
    name: K,
    ...args: Parameters<Fixture[K]>
): Promise<Awaited<ReturnType<Fixture[K]>>> {
    return page.evaluate(
        async ({ name, args }) => {
            const fixture = await import(
                new URL('/src/lib/testing/tableFixture.ts', location.href).href
            )
            return fixture[name](...args)
        },
        { name, args }
    )
}

type Scene = { name: string; table: TableFixture.TableName; tile?: string }

/** Panels taller than their share of an upright phone's column, at 375 by 812 and by 667. */
const TALL: Scene[] = [
    { name: 'the Tribunal exchange with a long promise', table: 'tribunalAnswerLong' },
    { name: 'Trade with three cards that change it', table: 'modifierTrade', tile: 'Trade' },
    { name: 'Sacrifice after a battle', table: 'sacrificeWhole' },
    { name: 'Recover with a relic seen', table: 'recoverSeen', tile: 'Recover' },
    { name: 'the Act Phase menu with every minor action', table: 'everyMinor' }
]

/** The share of the column a panel may take: an upright phone's, and every other window's. */
const UPRIGHT_SHARE = 0.55
const SHARE = 0.4

const panel = (page: Page) => page.locator('.fit__inner .panel')
const fit = (page: Page) => page.locator('.fit').first()
const undo = (page: Page) => page.getByRole('button', { name: 'Undo', exact: true })

async function waitFrames(page: Page, count: number) {
    await page.evaluate(async (count) => {
        for (let frame = 0; frame < count; frame++) await new Promise(requestAnimationFrame)
    }, count)
}

/** Waits until the panel's images have loaded and its box has stopped changing. */
async function settled(page: Page) {
    await page.waitForFunction(() =>
        [...document.querySelectorAll('.fit__inner img')].every(
            (image) => image instanceof HTMLImageElement && image.complete
        )
    )
    await expect
        .poll(async () => {
            const before = await fit(page).evaluate((box) => box.getBoundingClientRect().height)
            await waitFrames(page, 6)
            const after = await fit(page).evaluate((box) => box.getBoundingClientRect().height)
            return before === after
        })
        .toBe(true)
}

async function openScene(page: Page, scene: Scene) {
    await page.goto('/')
    await call(page, 'open', scene.table)
    await expect(panel(page).first()).toBeVisible()
    if (scene.tile) {
        await panel(page).locator('.majors button').filter({ hasText: scene.tile }).first().click()
    }
    await settled(page)
}

/** The fitted box as drawn: its scale, its size against its column, and the page around it. */
function measureFit() {
    const inner = document.querySelector('.fit__inner')
    const box = inner?.parentElement
    const column = box?.parentElement
    if (!(inner instanceof HTMLElement) || !box || !column) throw new Error('no fitted panel')
    const buttons = [...inner.querySelectorAll('button')].filter(
        (button) => button.offsetHeight >= 44
    )
    // Its natural height as FitBox reads it: at the box's full width, whatever width it is drawn at.
    const drawnWidth = inner.style.width
    inner.style.width = '100%'
    const natural = inner.scrollHeight
    inner.style.width = drawnWidth
    return {
        scale: inner.style.getPropertyValue('--fit-scale'),
        transform: getComputedStyle(inner).transform,
        box: box.getBoundingClientRect().height,
        column: column.clientHeight,
        natural,
        overflowY: getComputedStyle(box).overflowY,
        scrollHeight: box.scrollHeight,
        clientHeight: box.clientHeight,
        more: box.classList.contains('fit--more'),
        upright: box.classList.contains('fit--upright'),
        line: getComputedStyle(box).borderBottomWidth,
        lineColour: getComputedStyle(box).borderBottomColor,
        tapButtons: buttons.length,
        tapButtonsDrawnSmall: buttons
            .filter((button) => button.getBoundingClientRect().height < 43.5)
            .map((button) => `${button.innerText.trim()} ${button.getBoundingClientRect().height}`),
        pageOverflowX: document.documentElement.scrollWidth - window.innerWidth,
        pageOverflowY: document.documentElement.scrollHeight - window.innerHeight
    }
}

const fitFade = (page: Page) =>
    fit(page).evaluate((box) => getComputedStyle(box).getPropertyValue('--oath-fit-fade').trim())

async function scrollToEnd(page: Page) {
    await fit(page).evaluate((box) => (box.scrollTop = box.scrollHeight))
    await waitFrames(page, 4)
}

for (const height of [812, 667]) {
    test.describe(`an upright phone at 375 by ${height}: a tall panel scrolls inside its share`, () => {
        test.use({ viewport: { width: 375, height }, hasTouch: true })

        for (const scene of TALL) {
            test(`${scene.name}: full size, 44 px buttons, no taller than its share, scrolling`, async ({
                page
            }) => {
                await openScene(page, scene)
                const drawn = await page.evaluate(measureFit)
                expect(drawn.scale).toBe('1')
                expect(drawn.transform).toBe('none')
                expect(drawn.upright).toBe(true)
                expect(drawn.tapButtons).toBeGreaterThan(0)
                expect(drawn.tapButtonsDrawnSmall).toEqual([])
                expect(drawn.box).toBeLessThanOrEqual(drawn.column * UPRIGHT_SHARE + 2)
                expect(drawn.scrollHeight).toBeGreaterThan(drawn.clientHeight)
                expect(drawn.pageOverflowX).toBeLessThanOrEqual(0)
                expect(drawn.pageOverflowY).toBeLessThanOrEqual(0)
                // More below: a 2 px line in the frame's colour at full opacity.
                expect(drawn.more).toBe(true)
                expect(drawn.line).toBe('2px')
                expect(drawn.lineColour).not.toMatch(/\/ 0?\.\d+\)$|rgba|transparent/)
            })
        }

        test('the Tribunal: Accept and Refuse stay on screen, pinned to the box’s bottom', async ({
            page
        }) => {
            await openScene(page, TALL[0])
            const accept = panel(page).getByRole('button', { name: 'Accept', exact: true })
            const inside = () =>
                accept.evaluate((button) => {
                    const box = button.closest('.fit')?.getBoundingClientRect()
                    const drawn = button.getBoundingClientRect()
                    return (
                        !!box &&
                        drawn.top >= box.top - 0.5 &&
                        drawn.bottom <= box.bottom + 0.5 &&
                        drawn.bottom <= window.innerHeight + 0.5
                    )
                })
            expect(await inside()).toBe(true)
            const row = panel(page).locator('[data-answer-row]').last()
            await expect(row).toHaveAttribute('data-pinned', '')
            await expect(row).toHaveCSS('position', 'sticky')
            // Opaque, so the promise scrolling under it does not show through.
            expect(await row.evaluate((e) => getComputedStyle(e).backgroundImage)).toMatch(
                /gradient/
            )
            expect(await row.evaluate((e) => getComputedStyle(e).backgroundColor)).not.toMatch(
                /\/ 0?\.\d+\)$|rgba|transparent/
            )
            // The pinned row takes the fade's place.
            await expect(fit(page)).toHaveCSS('mask-image', 'none')

            // Pinning re-measures nothing in a loop: the attribute never toggles once settled.
            const toggles = await page.evaluate(async () => {
                let count = 0
                const watcher = new MutationObserver((records) => {
                    count += records.filter((r) => r.attributeName === 'data-pinned').length
                })
                watcher.observe(document.body, { subtree: true, attributes: true })
                for (let frame = 0; frame < 30; frame++) await new Promise(requestAnimationFrame)
                watcher.disconnect()
                return count
            })
            expect(toggles).toBe(0)

            await scrollToEnd(page)
            expect(await inside()).toBe(true)
        })

        test('Sacrifice: its two buttons one per line scroll with the rest, unpinned', async ({
            page
        }) => {
            await openScene(page, TALL[2])
            const row = panel(page).locator('[data-answer-row]').last()
            await expect(row).toBeVisible()
            const tops = await row.evaluate(
                (element) =>
                    new Set([...element.children].map((child) => (child as HTMLElement).offsetTop))
                        .size
            )
            expect(tops).toBe(2)
            await expect(row).not.toHaveAttribute('data-pinned')
            await expect(row).toHaveCSS('position', 'static')
        })

        test('Trade: the fade over the bottom edge goes when scrolled to the end', async ({
            page
        }) => {
            await openScene(page, TALL[1])
            await expect(fit(page)).not.toHaveCSS('mask-image', 'none')
            expect(await fitFade(page)).toBe('36px')
            await scrollToEnd(page)
            expect(await fitFade(page)).toBe('0px')
            // The line stays while the panel is taller than its share.
            await expect(fit(page)).toHaveCSS('border-bottom-width', '2px')
        })

        test('Trade without scroll-driven animation: the line, no fade', async ({ page }) => {
            await openScene(page, TALL[1])
            await page.addStyleTag({ content: '.fit { animation: none !important; }' })
            await waitFrames(page, 2)
            expect(await fitFade(page)).toBe('0px')
            await expect(fit(page)).toHaveCSS('border-bottom-width', '2px')
        })

        test('the turn bar with Undo scrolls up with the panel; nothing is pinned at the top', async ({
            page
        }) => {
            await openScene(page, TALL[1])
            await expect(undo(page)).toBeVisible()
            expect(await undo(page).evaluate((button) => !!button.closest('.fit'))).toBe(true)
            await scrollToEnd(page)
            const { undoBottom, boxTop } = await undo(page).evaluate((button) => ({
                undoBottom: button.getBoundingClientRect().bottom,
                boxTop: button.closest('.fit')?.getBoundingClientRect().top ?? 0
            }))
            expect(undoBottom).toBeLessThanOrEqual(boxTop)
        })

        test('the Act Phase menu that fits: its natural height, no line, no fade, no pin', async ({
            page
        }) => {
            await openScene(page, { name: 'the menu', table: 'modifierTrade' })
            const drawn = await page.evaluate(measureFit)
            expect(drawn.scale).toBe('1')
            expect(drawn.natural).toBeLessThanOrEqual(drawn.column * UPRIGHT_SHARE)
            expect(Math.abs(drawn.box - drawn.natural)).toBeLessThanOrEqual(1)
            expect(drawn.more).toBe(false)
            expect(drawn.scrollHeight).toBe(drawn.clientHeight)
            expect(drawn.line).toBe('0px')
            await expect(fit(page)).toHaveCSS('mask-image', 'none')
        })
    })
}

test.describe('an upright phone at 375 by 812: the steps inside a scrolling panel', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true })

    test('the Search’s "Discard 1 adviser." step: full-size cards, one tap ends the Search', async ({
        page
    }) => {
        await page.goto('/')
        await call(page, 'open', 'landWardenSecondAdviser')
        const card = (name: string) =>
            panel(page).locator(`button:not(.magnifier):has(img[alt="${name}"])`)
        await expect(panel(page).getByText('Keep one.', { exact: true })).toBeVisible()
        await card('Wayside Inn').click()
        await panel(page)
            .getByRole('button', { name: 'adviser, faceup', exact: true })
            .first()
            .click()
        await panel(page)
            .getByRole('button', { name: /^To your site/ })
            .click()
        await expect(panel(page).getByText('Discard 1 adviser.', { exact: true })).toBeVisible()
        await settled(page)
        const drawn = await page.evaluate(measureFit)
        expect(drawn.scale).toBe('1')
        expect(drawn.box).toBeLessThanOrEqual(drawn.column * UPRIGHT_SHARE + 2)
        for (const adviser of ['Wolves', 'Rangers']) {
            const size = await card(adviser).boundingBox()
            expect(size?.width).toBeCloseTo(72, 0)
            expect(size?.height).toBeCloseTo(112, 0)
        }
        await card('Wolves').click()
        await expect(panel(page).getByText('Discard 1 adviser.', { exact: true })).toHaveCount(0)
    })

    test('the spoils’ two buttons are 44 px on the screen', async ({ page }) => {
        await page.goto('/')
        await call(page, 'open', 'spoils')
        await panel(page).getByRole('button', { name: 'Next', exact: true }).click()
        await panel(page)
            .getByRole('button', { name: /^Leave it at / })
            .click()
        const take = panel(page).getByRole('button', { name: 'Take spoils', exact: true })
        await expect(take).toBeVisible()
        await settled(page)
        for (const button of [
            take,
            panel(page).getByRole('button', { name: /^Take and burn 2/ })
        ]) {
            expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(43.5)
            await expect(button).toHaveCSS('min-height', '44px')
        }
    })
})

/** Everywhere else, FitBox scales as before: `share` of the column, the box as tall as the drawn panel. */
for (const window of [
    { name: 'a desktop at 1280 by 900', viewport: { width: 1280, height: 900 }, phone: false },
    {
        name: 'a phone held sideways at 812 by 375',
        viewport: { width: 812, height: 375 },
        phone: true
    }
]) {
    test.describe(`${window.name}: the panel scales to its share as before`, () => {
        test.use({ viewport: window.viewport, hasTouch: window.phone })

        for (const scene of [...TALL, { name: 'the menu', table: 'modifierTrade' } as Scene]) {
            test(`${scene.name}: scaled to fit, never scrolled`, async ({ page }) => {
                await openScene(page, scene)
                const drawn = await page.evaluate(measureFit)
                const budget = drawn.column * SHARE
                const scale = Math.min(1, budget / drawn.natural)
                expect(Number(drawn.scale)).toBeCloseTo(scale, 3)
                expect(drawn.box).toBeCloseTo(Math.ceil(drawn.natural * scale), 0)
                expect(drawn.upright).toBe(false)
                expect(drawn.more).toBe(false)
                expect(drawn.line).toBe('0px')
                expect(drawn.overflowY).toBe('visible')
            })
        }

        if (window.phone) {
            test('the Tribunal exchange is drawn scaled down', async ({ page }) => {
                await openScene(page, TALL[0])
                expect(Number((await page.evaluate(measureFit)).scale)).toBeLessThan(1)
            })
        }
    })
}

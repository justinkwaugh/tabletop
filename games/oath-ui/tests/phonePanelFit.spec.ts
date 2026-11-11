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
    const content = inner?.querySelector(':scope > .fit__content')
    if (!(inner instanceof HTMLElement) || !content || !box || !column) {
        throw new Error('no fitted panel')
    }
    // What scrolls: the box on an upright phone, and elsewhere, below the smallest scale, the
    // scaled panel inside it.
    const clamped = box.classList.contains('fit--clamped')
    const scroller = clamped ? inner : box
    const buttons = [...inner.querySelectorAll('button')].filter(
        (button) => button.offsetHeight >= 44
    )
    // Its natural height as FitBox reads it: at the box's full width, whatever width it is drawn at.
    const drawnWidth = inner.style.width
    inner.style.width = '100%'
    const natural = content.scrollHeight
    inner.style.width = drawnWidth
    return {
        scale: inner.style.getPropertyValue('--fit-scale'),
        transform: getComputedStyle(inner).transform,
        box: box.getBoundingClientRect().height,
        column: column.clientHeight,
        natural,
        clamped,
        overflowY: getComputedStyle(scroller).overflowY,
        scrollHeight: scroller.scrollHeight,
        scrollWidth: scroller.scrollWidth,
        clientWidth: scroller.clientWidth,
        clientHeight: scroller.clientHeight,
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

/** Scrolls what scrolls (see `measureFit`) to the given share of its room, 1 for the end. */
async function scrollTo(page: Page, at: number) {
    await fit(page).evaluate((box, at) => {
        const inner = box.querySelector(':scope > .fit__inner')
        const scroller = box.classList.contains('fit--clamped') && inner ? inner : box
        scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) * at
    }, at)
    await waitFrames(page, 4)
}

const scrollToEnd = (page: Page) => scrollTo(page, 1)

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

test.describe('an upright phone at 375 by 812: a panel that fits pins nothing', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true })

    for (const scene of [
        { name: 'the sneak attack’s Campaign or Pass', table: 'sneakAttack', button: 'Campaign' },
        { name: 'the Citizenship answer', table: 'citizenshipEnough', button: 'Accept' }
    ] as const) {
        test(`${scene.name}: its one-line answer row stays in place, drawn as the rest`, async ({
            page
        }) => {
            await openScene(page, scene)
            const drawn = await page.evaluate(measureFit)
            expect(drawn.scale).toBe('1')
            expect(drawn.more).toBe(false)
            expect(drawn.scrollHeight).toBe(drawn.clientHeight)
            expect(Math.abs(drawn.box - drawn.natural)).toBeLessThanOrEqual(1)
            const row = panel(page).locator('[data-answer-row]').last()
            await expect(row.getByRole('button', { name: scene.button, exact: true })).toBeVisible()
            // On one line, so it is marked to pin; with nothing below it to scroll, it is not pinned.
            await expect(row).toHaveAttribute('data-pinned', '')
            await expect(row).toHaveCSS('position', 'static')
            await expect(row).toHaveCSS('box-shadow', 'none')
            await expect(row).toHaveCSS('padding-top', '0px')
            await expect(row).toHaveCSS('margin-bottom', '0px')
            await expect(row).toHaveCSS('background-image', 'none')
        })
    }
})

test.describe('an upright phone at 375 by 812: pinning never changes the height it is decided on', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true })

    const answerRow = (page: Page) => panel(page).locator('[data-answer-row]').last()

    test('the Citizenship answer just under its share fits, opened first or after another table', async ({
        page
    }) => {
        const short: Scene = { name: 'the Citizenship answer', table: 'citizenshipShort' }
        await openScene(page, short)
        const first = await page.evaluate(measureFit)
        await expect(answerRow(page)).toHaveCSS('position', 'static')

        await openScene(page, TALL[0])
        await call(page, 'open', short.table)
        await expect(panel(page).getByRole('button', { name: 'Accept', exact: true })).toBeVisible()
        await settled(page)
        const after = await page.evaluate(measureFit)
        await expect(answerRow(page)).toHaveCSS('position', 'static')

        expect(first.natural).toBeLessThanOrEqual(first.column * UPRIGHT_SHARE)
        expect(after.natural).toBe(first.natural)
        expect(first.more).toBe(false)
        expect(after.more).toBe(false)
        expect(first.scrollHeight).toBe(first.clientHeight)
    })

    /**
     * The answer row's height with its margins, the panel's natural height as FitBox reads it, and
     * the gap from the line above the row to its buttons: as drawn, with the box's `fit--more` on,
     * with it off, and as drawn again once it is put back.
     */
    const heightsPinnedAndUnpinned = (page: Page) =>
        answerRow(page).evaluate((row) => {
            const box = row.closest('.fit')
            const inner = box?.querySelector('.fit__inner')
            const button = row.querySelector('button')
            if (
                !box ||
                !(inner instanceof HTMLElement) ||
                !(row instanceof HTMLElement) ||
                !button
            ) {
                throw new Error('no fitted panel')
            }
            const above = row.previousElementSibling
            const read = () => {
                const style = getComputedStyle(row)
                return {
                    row:
                        row.offsetHeight +
                        parseFloat(style.marginTop) +
                        parseFloat(style.marginBottom),
                    content: inner.scrollHeight,
                    gap: above
                        ? button.getBoundingClientRect().top - above.getBoundingClientRect().bottom
                        : undefined,
                    position: style.position
                }
            }
            const more = box.classList.contains('fit--more')
            const drawn = read()
            box.classList.add('fit--more')
            const pinned = read()
            box.classList.remove('fit--more')
            const unpinned = read()
            box.classList.toggle('fit--more', more)
            return { drawn, pinned, unpinned, again: read() }
        })

    test('the Tribunal exchange with a long promise: pinned, its row and panel are as tall as unpinned', async ({
        page
    }) => {
        await openScene(page, TALL[0])
        await expect(answerRow(page)).toHaveCSS('position', 'sticky')
        const heights = await heightsPinnedAndUnpinned(page)
        expect(heights.pinned.position).toBe('sticky')
        expect(heights.unpinned.position).toBe('static')
        expect(heights.pinned.row).toBe(heights.unpinned.row)
        expect(heights.pinned.content).toBe(heights.unpinned.content)
        expect(heights.again).toEqual(heights.drawn)
    })

    test('the Chronicle’s Oath with one picked: pinned, its row and panel are as tall as unpinned, 8 px under the words', async ({
        page
    }) => {
        await openScene(page, { name: 'the Chronicle’s Oath', table: 'chronicleVow' })
        await panel(page)
            .getByRole('button', { name: /^Oath of / })
            .first()
            .click()
        await expect(answerRow(page).getByRole('button', { name: 'Confirm' })).toBeVisible()
        await settled(page)
        const heights = await heightsPinnedAndUnpinned(page)
        expect(heights.pinned.position).toBe('sticky')
        expect(heights.unpinned.position).toBe('static')
        expect(heights.pinned.row).toBe(heights.unpinned.row)
        expect(heights.pinned.content).toBe(heights.unpinned.content)
        expect(heights.unpinned.gap).toBe(8)
        expect(heights.pinned.gap).toBe(8)
        expect(heights.again).toEqual(heights.drawn)
    })

    test('the battle before its picks add up: its answer row has no buttons, so it is not pinned and the fade stays', async ({
        page
    }) => {
        await openScene(page, {
            name: 'the battle with a force of two groups',
            table: 'sacrificeMixed'
        })
        await expect(fit(page)).toHaveClass(/fit--more/)
        const row = answerRow(page)
        expect(await row.evaluate((element) => element.children.length)).toBe(0)
        await expect(row).not.toHaveAttribute('data-pinned')
        await expect(row).toHaveCSS('position', 'static')
        await expect(fit(page)).not.toHaveCSS('mask-image', 'none')

        // The first button to appear is measured once and pinned while the panel has more below.
        await panel(page)
            .getByRole('button', { name: /^2 of the / })
            .first()
            .click()
        await expect(row.getByRole('button', { name: 'Sacrifice 2 and win' })).toBeVisible()
        await settled(page)
        await expect(fit(page)).toHaveClass(/fit--more/)
        await expect(row).toHaveAttribute('data-pinned')
        await expect(row).toHaveCSS('position', 'sticky')
    })
})

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

/**
 * Everywhere else, FitBox scales the panel to its `share` of the column, the box as tall as the
 * drawn panel, but never below `MIN_SCALE`: there the box stays its share tall and scrolls.
 */
const MIN_SCALE = 0.75

for (const window of [
    { name: 'a desktop at 1280 by 900', viewport: { width: 1280, height: 900 }, phone: false },
    {
        name: 'a phone held sideways at 812 by 375',
        viewport: { width: 812, height: 375 },
        phone: true
    }
]) {
    test.describe(`${window.name}: the panel scales to its share, never below 0.75`, () => {
        test.use({ viewport: window.viewport, hasTouch: window.phone })

        for (const scene of [...TALL, { name: 'the menu', table: 'modifierTrade' } as Scene]) {
            test(`${scene.name}: scaled to fit, or at 0.75 and scrolling inside its share`, async ({
                page
            }) => {
                await openScene(page, scene)
                const drawn = await page.evaluate(measureFit)
                const budget = drawn.column * SHARE
                const fits = Math.min(1, budget / drawn.natural)
                const scale = Math.max(MIN_SCALE, fits)
                expect(Number(drawn.scale)).toBeCloseTo(scale, 3)
                expect(drawn.upright).toBe(false)
                if (fits >= MIN_SCALE) {
                    expect(drawn.box).toBeCloseTo(Math.ceil(drawn.natural * scale), 0)
                    expect(drawn.more).toBe(false)
                    expect(drawn.line).toBe('0px')
                    expect(drawn.overflowY).toBe('visible')
                } else {
                    expect(drawn.box).toBeCloseTo(Math.ceil(budget), 0)
                    expect(drawn.more).toBe(true)
                    expect(drawn.line).toBe('2px')
                    expect(drawn.overflowY).toBe('auto')
                    expect(drawn.scrollHeight).toBeGreaterThan(drawn.clientHeight)
                    expect(drawn.scrollWidth).toBeLessThanOrEqual(drawn.clientWidth)
                }
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

/** The Horned Mask's Use at the full Great Slum: taller than a 720 px desktop's share at 0.75. */
async function openPowers(page: Page) {
    await openScene(page, { name: 'the Horned Mask at the Great Slum', table: 'greatSlumPowers' })
    // On a phone the seats sit off the screen, so the tap is sent to the badge itself.
    await page.locator('[data-use-badge="relic.horned-mask"]').dispatchEvent('click')
    await expect(panel(page).locator('[data-action-power="relic.horned-mask"]')).toBeVisible()
    await settled(page)
}

/**
 * A box scrolling at 0.75, as drawn: its edges inside its line, the bottom of what it holds, how
 * far it is scrolled, where the turn bar is, and every answer button outside the box or under the
 * turn bar.
 */
const scrolledEdges = (page: Page) =>
    fit(page).evaluate((box) => {
        const inner = box.querySelector(':scope > .fit__inner')
        const content = inner?.querySelector(':scope > .fit__content')
        if (!(inner instanceof HTMLElement) || !content) throw new Error('no fitted panel')
        const line = parseFloat(getComputedStyle(box).borderBottomWidth)
        const drawn = box.getBoundingClientRect()
        const bar = box.querySelector('[data-turn-bar]')?.getBoundingClientRect()
        const top = bar ? bar.bottom : drawn.top
        const bottom = drawn.bottom - line
        const answers = [...box.querySelectorAll('[data-answer-row] button')].map((button) => ({
            label: (button as HTMLElement).innerText.trim(),
            rect: button.getBoundingClientRect()
        }))
        return {
            top: drawn.top,
            edge: bottom,
            content: content.getBoundingClientRect().bottom,
            scrollTop: inner.scrollTop,
            room: inner.scrollHeight - inner.clientHeight,
            bar: bar ? { top: bar.top, bottom: bar.bottom } : undefined,
            answers: answers.length,
            answersOutOfView: answers
                .filter(({ rect }) => rect.top < top - 0.5 || rect.bottom > bottom + 0.5)
                .map(({ label, rect }) => `${label} ${rect.top}-${rect.bottom}`)
        }
    })

/**
 * Scrolls each card magnifier and Use badge in a box scrolling at 0.75 under the given part that
 * stays in view (the turn bar, a pinned answer row), and returns how many reached it and every
 * point where they overlap at which something other than that part is drawn on top.
 */
const drawnOverStickyPart = (page: Page, part: string) =>
    fit(page).evaluate(async (box, part) => {
        const inner = box.querySelector(':scope > .fit__inner')
        const sticky = [...box.querySelectorAll(part)].at(-1)
        if (!(inner instanceof HTMLElement) || !sticky) throw new Error(`no ${part} in the box`)
        const scale = parseFloat(inner.style.getPropertyValue('--fit-scale'))
        const room = inner.scrollHeight - inner.clientHeight
        const badges = [
            ...inner.querySelectorAll('.magnifier, .site-magnifier, .use-badge')
        ].filter((badge) => !sticky.contains(badge))
        let reached = 0
        const over: string[] = []
        for (const badge of badges) {
            const at = sticky.getBoundingClientRect()
            const drawn = badge.getBoundingClientRect()
            // The scaled panel scrolls in its own space: a screen pixel is 1 / scale of it.
            const shift = (drawn.top + drawn.bottom - at.top - at.bottom) / 2 / scale
            inner.scrollTop = Math.min(room, Math.max(0, inner.scrollTop + shift))
            for (let frame = 0; frame < 2; frame++) await new Promise(requestAnimationFrame)
            const a = sticky.getBoundingClientRect()
            const b = badge.getBoundingClientRect()
            const left = Math.max(a.left, b.left) + 1
            const right = Math.min(a.right, b.right) - 1
            const top = Math.max(a.top, b.top) + 1
            const bottom = Math.min(a.bottom, b.bottom) - 1
            if (right <= left || bottom <= top) continue
            reached++
            let covered = 0
            for (const x of [left, (left + right) / 2, right]) {
                for (const y of [top, (top + bottom) / 2, bottom]) {
                    const hit = document.elementFromPoint(x, y)
                    if (!hit || !sticky.contains(hit)) covered++
                }
            }
            const name = badge.getAttribute('aria-label') ?? badge.classList[0]
            if (covered > 0) over.push(`${name}: drawn over ${covered} of 9 points`)
        }
        return { reached, over }
    }, part)

// With every power on its card's Use, no Act Phase step stands far enough above a 900 px
// desktop's share at 0.75 to scroll a card under the turn bar; the Horned Mask's stands above a
// 720 px desktop's.
for (const window of [
    { name: 'a desktop at 1280 by 720', viewport: { width: 1280, height: 720 }, phone: false },
    {
        name: 'a desktop at 1280 by 720 in full screen',
        viewport: { width: 1280, height: 720 },
        phone: false,
        full: true
    },
    {
        name: 'a phone held sideways at 812 by 375',
        viewport: { width: 812, height: 375 },
        phone: true
    }
]) {
    test.describe(`${window.name}: a step too tall at 0.75 is drawn at 0.75 and scrolls`, () => {
        test.use({ viewport: window.viewport, hasTouch: window.phone })

        test('the Horned Mask at the Great Slum: at 0.75, its share tall, scrolling to its end and no further', async ({
            page
        }) => {
            await openPowers(page)
            if (window.full) {
                await page.getByRole('button', { name: 'Enter full screen' }).click()
                await expect(page.locator('.fullscreen-panel .fit__inner')).toBeVisible()
                await settled(page)
            }
            const drawn = await page.evaluate(measureFit)
            const budget = (window.full ? window.viewport.height : drawn.column) * SHARE
            expect(drawn.natural * MIN_SCALE).toBeGreaterThan(budget)
            expect(drawn.scale).toBe(String(MIN_SCALE))
            expect(drawn.transform).toBe('matrix(0.75, 0, 0, 0.75, 0, 0)')
            expect(drawn.upright).toBe(false)
            expect(Math.abs(drawn.box - Math.ceil(budget))).toBeLessThanOrEqual(1)
            expect(drawn.pageOverflowX).toBeLessThanOrEqual(0)
            expect(drawn.pageOverflowY).toBeLessThanOrEqual(0)
            // More below: the upright phone's line and fade.
            expect(drawn.more).toBe(true)
            expect(drawn.line).toBe('2px')
            expect(drawn.lineColour).not.toMatch(/\/ 0?\.\d+\)$|rgba|transparent/)
            expect(drawn.overflowY).toBe('auto')
            await expect(fit(page)).not.toHaveCSS('mask-image', 'none')
            expect(await fitFade(page)).toBe('36px')
            // The scaled panel scrolls inside itself, as far as it reaches and only down: never
            // across.
            expect(drawn.clamped).toBe(true)
            expect(Math.abs(drawn.scrollHeight - drawn.natural)).toBeLessThanOrEqual(1)
            expect(drawn.scrollHeight).toBeGreaterThan(drawn.clientHeight)
            expect(drawn.scrollWidth).toBeLessThanOrEqual(drawn.clientWidth)
            // A step without an answer row: nothing pinned at the bottom, so the fade stays.
            await expect(panel(page).locator('[data-answer-row]')).toHaveCount(0)
            const top = await scrolledEdges(page)
            expect(top.bar?.top).toBeCloseTo(top.top, 0)

            await scrollToEnd(page)
            const end = await scrolledEdges(page)
            expect(end.scrollTop).toBeGreaterThan(0)
            expect(Math.abs(end.scrollTop - end.room)).toBeLessThanOrEqual(1)
            // The panel's end meets the box's bottom edge: no blank space below it.
            expect(Math.abs(end.content - end.edge)).toBeLessThanOrEqual(2)
            expect(await fitFade(page)).toBe('0px')
            await expect(fit(page)).toHaveCSS('border-bottom-width', '2px')
            // The turn bar, Undo with it, stays at the box's top while the step scrolls under it.
            expect(end.bar?.top).toBeCloseTo(top.top, 0)
            await expect(undo(page)).toBeInViewport()
            const undoTop = await undo(page).evaluate(
                (button) => button.getBoundingClientRect().top
            )
            expect(undoTop).toBeGreaterThanOrEqual(top.top)
            // Scrolled under the turn bar, a card's magnifier is drawn below it, not over Undo.
            const underBar = await drawnOverStickyPart(page, '[data-turn-bar]')
            expect(underBar.reached).toBeGreaterThan(0)
            expect(underBar.over).toEqual([])
        })
    })
}

/** Steps whose answer row sat below a sideways phone's box at 0.75 until the row was pinned there. */
const ANSWERED_BELOW: TableFixture.TableName[] = [
    'sacrificeInTwoPlaces',
    'resultShort',
    'kinshipPlague',
    'citizenshipShort',
    'citizenshipNone',
    'citizenshipEnough',
    'heldAttack',
    'heldAttackRerolled',
    'battleDefenderPlans',
    'battlePlanCosts',
    'sacrificeSplit',
    'sacrificeShort',
    'sacrificeWhole',
    'askTinkersFair',
    'askGamblingHallBank',
    'askWildMounts',
    'tribunalAnswer',
    'tribunalDealAsked',
    'tribunalAnswerLong',
    'tribunalDealAskedLong',
    'gamblingHallAsked',
    'wrestlersPick',
    'wrestlersOnePlace',
    'warningSignals',
    'warningSignalsNothingToMove',
    'banditRampartDefender'
]

test.describe('a phone held sideways at 812 by 375: a step scrolling at 0.75 keeps its answer in view', () => {
    test.use({ viewport: { width: 812, height: 375 }, hasTouch: true })

    for (const table of ANSWERED_BELOW) {
        test(`${table}: the answer row pinned to the box's bottom, the turn bar to its top, all the way down`, async ({
            page
        }) => {
            await openScene(page, { name: table, table })
            const drawn = await page.evaluate(measureFit)
            expect(drawn.clamped).toBe(true)
            expect(drawn.scale).toBe(String(MIN_SCALE))
            const row = panel(page).locator('[data-answer-row][data-pinned]').last()
            await expect(row).toHaveCSS('position', 'sticky')
            // The pinned row takes the fade's place, as on an upright phone.
            await expect(fit(page)).toHaveCSS('mask-image', 'none')
            for (const at of [0, 0.5, 1]) {
                await scrollTo(page, at)
                const view = await scrolledEdges(page)
                expect(view.answers).toBeGreaterThan(0)
                expect(view.answersOutOfView, `scrolled to ${at} of its room`).toEqual([])
                expect(view.bar?.top, `scrolled to ${at} of its room`).toBeCloseTo(view.top, 0)
            }
        })
    }

    // Each step's one card magnifier can be scrolled under one of the two: a card at the step's
    // end reaches the pinned row, and one near its top reaches the turn bar.
    for (const { table, reaches } of [
        { table: 'battleDefenderPlans', reaches: '[data-answer-row][data-pinned]' },
        { table: 'wrestlersPick', reaches: '[data-answer-row][data-pinned]' },
        { table: 'citizenshipEnough', reaches: '[data-turn-bar]' },
        { table: 'tribunalAnswerLong', reaches: '[data-turn-bar]' }
    ] as const) {
        test(`${table}: a card scrolled under the turn bar or the pinned answer row has its magnifier drawn below them`, async ({
            page
        }) => {
            await openScene(page, { name: table, table })
            expect((await page.evaluate(measureFit)).clamped).toBe(true)
            for (const part of ['[data-turn-bar]', '[data-answer-row][data-pinned]']) {
                const under = await drawnOverStickyPart(page, part)
                if (part === reaches) expect(under.reached, part).toBeGreaterThan(0)
                expect(under.over, part).toEqual([])
            }
        })
    }
})

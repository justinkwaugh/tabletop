import { expect, test, type Locator, type Page } from '@playwright/test'
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

async function openTable(page: Page, name: TableFixture.TableName) {
    await page.goto('/')
    return call(page, 'open', name)
}

async function boxOf(locator: Locator) {
    const box = await locator.boundingBox()
    if (!box) throw Error('The element is not drawn')
    return box
}

const panel = (page: Page) => page.locator('.panel')
const line = (page: Page) => panel(page).locator('.question-line')
const form = (page: Page) => panel(page).locator('.question-form')
const bankButtons = (page: Page) => panel(page).getByRole('button', { name: /^\+\d+ favor from the / })
const bankButton = (page: Page, gain: number, suit: string) =>
    panel(page).getByRole('button', { name: `+${gain} favor from the ${suit} bank`, exact: true })
const history = (page: Page) => page.locator('.history')

/** The banks: Discord 3, Arcane 2, Order 4, Hearth 1, Beast 0, Nomad 3; the roll is 6. */
const GAINS = [
    [3, 'Discord'],
    [2, 'Arcane'],
    [4, 'Order'],
    [1, 'Hearth'],
    [3, 'Nomad']
] as const

const SIZES = [
    { name: 'desktop', viewport: { width: 1280, height: 900 }, phone: false },
    { name: 'phone', viewport: { width: 375, height: 812 }, phone: true }
]

async function shot(page: Page, name: string, phone: boolean) {
    await page.mouse.move(2, 2)
    await panel(page).screenshot({ path: test.info().outputPath(`${name}-${phone ? 'phone' : 'desktop'}.png`) })
}

for (const { name, viewport, phone } of SIZES) {
    /**
     * R-7.1.3-H2 — Dana used Gambling Hall with no bank and rolled shield, two shields, blank and a
     * doubling, 6 shields; the bank is asked once the roll stands.
     */
    test.describe(`Gambling Hall's bank after the roll, on a ${name}`, () => {
        test.use({ viewport, hasTouch: phone })

        test('the picture, "Rolled 6 shields:", the four faces, "Gain 6 [favor] from:" and one label-sized button per bank with favor', async ({ page }) => {
            await openTable(page, 'gamblingHallAsked')
            await expect.poll(async () => (await call(page, 'tableFacts')).seatId).toBe('Dana')
            await expect(panel(page).getByRole('heading', { name: 'Gambling Hall' })).toBeVisible()
            await expect(form(page).getByRole('img', { name: 'Gambling Hall' }).first()).toBeVisible()
            await expect(line(page)).toHaveText(/^\s*Rolled 6 shields:\s*$/)
            const dice = form(page).locator('.die img')
            await expect(dice).toHaveCount(4)
            expect(await dice.evaluateAll((images) => images.map((image) => image.getAttribute('alt')))).toEqual([
                '1 shield',
                '2 shields',
                'Blank',
                'Doubles the shields rolled'
            ])
            const gain = form(page).locator('p').filter({ hasText: /^\s*Gain\s*6\s*from:\s*$/ })
            await expect(gain).toBeVisible()
            await expect(gain.locator('img[alt="favor"]')).toHaveCount(1)
            await expect(bankButtons(page)).toHaveCount(GAINS.length)
            await expect(panel(page).getByRole('button', { name: /Beast/ })).toHaveCount(0)
            const boxes = []
            for (const [count, suit] of GAINS) {
                const button = bankButton(page, count, suit)
                await expect(button).toBeVisible()
                await expect(button).toContainText(`+${count}`)
                const overflow = await button.evaluate((element) => element.scrollWidth - element.clientWidth)
                expect(overflow).toBeLessThanOrEqual(0)
                boxes.push(await boxOf(button))
            }
            const formBox = await boxOf(form(page))
            for (const box of boxes) {
                expect(Math.abs(box.width - boxes[0].width)).toBeLessThan(1)
                // Label-sized: never stretched across the panel.
                expect(box.width).toBeLessThan(formBox.width / 2)
                if (phone) expect(box.height).toBeGreaterThanOrEqual(44)
            }
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
            expect(overflow).toBeLessThanOrEqual(0)
            await shot(page, 'gambling-hall-bank', phone)
        })

        test('one tap on "+4 [favor] [order]" takes 4 favor from the Order bank and closes the question', async ({ page }) => {
            await openTable(page, 'gamblingHallAsked')
            await expect.poll(async () => (await call(page, 'tableFacts')).seatId).toBe('Dana')
            const before = (await call(page, 'tableFacts')).favorOf.Dana
            await bankButton(page, 4, 'Order').click()
            await expect.poll(async () => (await call(page, 'tableFacts')).favorOf.Dana).toBe(before + 4)
            await expect(bankButtons(page)).toHaveCount(0)
        })

        test('another seat reads only "Waiting on Dana." while Dana chooses', async ({ page }) => {
            await openTable(page, 'gamblingHallAsked')
            expect(await call(page, 'viewOffTheClock')).not.toBe('Dana')
            await expect(panel(page)).toContainText('Waiting on Dana.')
            await expect(bankButtons(page)).toHaveCount(0)
        })

        test('with Jinx, its reroll comes first in today’s words; Keep then asks the bank', async ({ page }) => {
            await openTable(page, 'gamblingHallJinx')
            await expect.poll(async () => (await call(page, 'tableFacts')).seatId).toBe('Dana')
            await expect(line(page)).toHaveText('Reroll the Gambling Hall dice? Now 6 shields.')
            await expect(bankButtons(page)).toHaveCount(0)
            await panel(page).getByRole('button', { name: 'Keep', exact: true }).click()
            await expect(line(page)).toHaveText(/^\s*Rolled 6 shields:\s*$/)
            await expect(bankButtons(page)).toHaveCount(GAINS.length)
        })
    })
}

test.describe('the History of Gambling Hall, on a desktop at 1280', () => {
    test('the use row reads the roll; the answer row the gain', async ({ page }) => {
        await openTable(page, 'gamblingHallAsked')
        await expect.poll(async () => (await call(page, 'tableFacts')).seatId).toBe('Dana')
        await bankButton(page, 4, 'Order').click()
        await expect(bankButtons(page)).toHaveCount(0)
        await page.getByRole('tab', { name: 'History' }).click()
        await expect(history(page)).toContainText(/used Gambling Hall, placing 2\s*on it: rolled 6 shields/)
        // The bank is its suit's mark, "the Order bank" its alt, and favor its token.
        const gained = history(page).getByText(/gained 4\s*from\s*\(Gambling Hall\)/)
        await expect(gained).toBeVisible()
        await expect(gained.locator('img[alt="the Order bank"]')).toHaveCount(1)
        await expect(gained.locator('img[alt="favor"]')).toHaveCount(1)
    })
})

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

async function openTable(page: Page, name: TableFixture.TableName) {
    await page.goto('/')
    return call(page, 'open', name)
}

async function boxOf(page: Page, locator: ReturnType<Page['locator']>) {
    const box = await locator.boundingBox()
    if (!box) throw Error('The element is not drawn')
    return box
}

const panel = (page: Page) => page.locator('.panel')
const cardRow = (page: Page, name: string) =>
    panel(page).locator('button[aria-pressed]').filter({ hasText: name })
const travelTile = (page: Page) =>
    panel(page).locator('.majors button').filter({ hasText: 'Travel' })
const woodButton = (page: Page) =>
    panel(page).getByRole('button', { name: /^Travel:\s*Bea\s*picks where$/ })
const bankButton = (page: Page, suit: string) =>
    panel(page).getByRole('button', { name: `+1 favor from the ${suit} bank` })
const history = (page: Page) => page.locator('.history')

const SIZES = [
    { name: 'desktop', viewport: { width: 1280, height: 900 }, phone: false },
    { name: 'phone', viewport: { width: 375, height: 812 }, phone: true }
]

/**
 * R-11.7-H2 — Hospitality on a Travel out of an enemy's Shrouded Wood: listed with the other cards,
 * no bank named; after the ruler's pick, two banks matching, the traveller is asked which.
 */
for (const { name, viewport, phone } of SIZES) {
    test.describe(`Hospitality out of an enemy’s Shrouded Wood, on a ${name}`, () => {
        test.use({ viewport })

        test('Hospitality is listed in use with "+1 favor" and no bank; the set-out row names it', async ({
            page
        }) => {
            await openTable(page, 'woodHospitality')
            await travelTile(page).click()
            const row = cardRow(page, 'Hospitality')
            await expect(row).toHaveAttribute('aria-pressed', 'true')
            await expect(row).toContainText('+1')
            await expect(row.locator('img[alt="favor"]')).toHaveCount(1)
            await expect(row).not.toContainText(/bank|Order|Nomad/)
            await expect(panel(page)).toContainText('2 Supply.')
            await woodButton(page).click()
            await expect.poll(async () => (await call(page, 'tableFacts')).seatId).toBe('Bea')
            if (!phone) {
                await page.getByRole('tab', { name: 'History' }).click()
                await expect(history(page)).toContainText(
                    /Dana\s*set out from Shrouded Wood \(Hospitality\);\s*you\s*pick where/
                )
            }
        })

        test('two banks at the River: "Gain 1 favor from:", one label-sized button per bank sharing one width; one tap gains', async ({
            page
        }) => {
            await openTable(page, 'woodHospitalityAsked')
            await expect.poll(async () => (await call(page, 'tableFacts')).seatId).toBe('Dana')
            await expect(panel(page).getByRole('heading', { name: 'Hospitality' })).toBeVisible()
            await expect(panel(page).locator('.question-line')).toHaveText(
                /^\s*Gain\s*1\s*from:\s*$/
            )
            const order = bankButton(page, 'Order')
            const nomad = bankButton(page, 'Nomad')
            await expect(order).toBeVisible()
            await expect(nomad).toBeVisible()
            await expect(
                panel(page).getByRole('button', { name: /^\+1 favor from the / })
            ).toHaveCount(2)
            const [a, b, form] = [
                await boxOf(page, order),
                await boxOf(page, nomad),
                await boxOf(page, panel(page).locator('.question-form'))
            ]
            expect(Math.abs(a.width - b.width)).toBeLessThan(1)
            // Label-sized: never stretched to the panel's width.
            expect(a.width).toBeLessThan(form.width / 2)
            if (phone) expect(a.height).toBeGreaterThanOrEqual(44)
            for (const button of [order, nomad]) {
                const overflow = await button.evaluate(
                    (element) => element.scrollWidth - element.clientWidth
                )
                expect(overflow).toBeLessThanOrEqual(0)
            }
            const before = (await call(page, 'tableFacts')).favorOf.Dana
            await order.click()
            await expect
                .poll(async () => (await call(page, 'tableFacts')).favorOf.Dana)
                .toBe(before + 1)
            await expect(bankButton(page, 'Order')).toHaveCount(0)
            const overflow = await page.evaluate(
                () => document.documentElement.scrollWidth - document.documentElement.clientWidth
            )
            expect(overflow).toBeLessThanOrEqual(0)
        })

        test('Bea, the ruler, reads only "Waiting on Dana." while Dana chooses', async ({
            page
        }) => {
            await openTable(page, 'woodHospitalityAsked')
            expect(await call(page, 'viewOffTheClock')).toBe('Bea')
            await expect(panel(page)).toContainText('Waiting on Dana.')
            await expect(
                panel(page).getByRole('button', { name: /^\+1 favor from the / })
            ).toHaveCount(0)
        })
    })
}

test.describe('the History of Hospitality out of the Wood, on a desktop at 1280', () => {
    test('the set-out row, the pick row, then the gain in today’s words', async ({ page }) => {
        await openTable(page, 'woodHospitalityAsked')
        await page.getByRole('tab', { name: 'History' }).click()
        await expect(history(page)).toContainText(
            /you\s*set out from Shrouded Wood \(Hospitality\);\s*Bea\s*picks where/
        )
        await expect(history(page)).toContainText(
            /you\s*traveled from Shrouded Wood to River \(\s*Bea\s*'s pick\), spending 2 Supply\s*$/m
        )
        await bankButton(page, 'Order').click()
        await expect(history(page)).toContainText(/you\s*gained 1\s*from\s*\(Hospitality\)/)
        await expect(history(page).locator('img[alt="the Order bank"]')).toHaveCount(1)
    })
})

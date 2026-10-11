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

const SIZES = [
    { name: 'desktop', viewport: { width: 1280, height: 900 }, phone: false },
    { name: 'phone', viewport: { width: 375, height: 812 }, phone: true }
]

/** R-11.7 — leaving a Shrouded Wood an enemy rules: the traveller's panel and the ruler's choice. */
for (const { name, viewport, phone } of SIZES) {
    test.describe(`leaving an enemy's Shrouded Wood, on a ${name}`, () => {
        test.use({ viewport })

        test('the traveller sees what each region the ruler can pick costs, and the Travel spends nothing', async ({ page }) => {
            await openTable(page, 'woodTraveller')
            await panel(page).locator('.majors button').filter({ hasText: 'Travel' }).click()
            await expect(panel(page).locator('.bg-oath-accent-soft').first()).toHaveText('Travel')
            await expect(panel(page)).not.toContainText('rules this Shrouded Wood')

            // A card that changed the price is named alone; the Wood's own price has no note.
            const costs = panel(page).getByRole('list', { name: 'What you pay, by region' })
            await expect(costs.getByRole('listitem')).toHaveText(
                [/^cradle\s*0 Supply\s*Decadent$/i, /^provinces\s*2 Supply\s*$/i],
                { useInnerText: true }
            )
            const button = panel(page).getByRole('button', { name: /^Travel:\s*Rhys\s*picks where$/ })
            const [buttonBox, panelBox] = [await boxOf(page, button), await boxOf(page, panel(page))]
            expect(buttonBox.width).toBeLessThan(panelBox.width * 0.7)
            if (phone) expect(buttonBox.height).toBeGreaterThanOrEqual(44)

            await button.click()
            await expect(panel(page).getByText(/^Pick where\s*Dana\s*goes\.$/)).toBeVisible()
            const facts = await call(page, 'tableFacts')
            expect(facts.seatId).toBe('Rhys')
            expect(facts.siteOf.Dana).toBe('slot.provinces.0')
        })

        // On a phone the ruler picks in the panel; on a desktop on the lit map (below).
        if (phone) {
            test('the ruler is offered only the sites the traveller can pay for, by region with the cost', async ({ page }) => {
                await openTable(page, 'woodRuler')
                await expect(panel(page).getByText(/^Pick where\s*Dana\s*goes\.$/)).toBeVisible()
                await expect(panel(page)).not.toContainText('has 2 Supply')

                const cradle = panel(page).getByRole('group', { name: 'Sites in the Cradle' })
                const provinces = panel(page).getByRole('group', { name: 'Sites in the Provinces' })
                await expect(cradle).toContainText(/0\s*Supply\s*Decadent/)
                await expect(provinces).toContainText(/2\s*Supply/)
                await expect(cradle.getByRole('button')).toHaveText(['Drowned City', 'Plains'])
                await expect(provinces.getByRole('button')).toHaveText(['Great Slum', 'River'])
                await expect(panel(page).getByRole('group', { name: 'Sites in the Hinterland' })).toHaveCount(0)
                await expect(panel(page).getByRole('button', { name: 'Mountain' })).toHaveCount(0)

                // A region's buttons wrap side by side, as wide as the widest label, never stretched.
                const [cradleBox, provincesBox] = [await boxOf(page, cradle), await boxOf(page, provinces)]
                const [drowned, plains] = [await boxOf(page, cradle.getByRole('button').first()), await boxOf(page, cradle.getByRole('button').last())]
                expect(provincesBox.y).toBeGreaterThanOrEqual(cradleBox.y + cradleBox.height - 1)
                expect(Math.abs(drowned.y - plains.y)).toBeLessThan(1)
                expect(Math.abs(drowned.width - plains.width)).toBeLessThan(1)
                expect(drowned.width + plains.width).toBeLessThan((await boxOf(page, panel(page))).width * 0.9)
                expect(drowned.height).toBeGreaterThanOrEqual(44)

                await provinces.getByRole('button', { name: 'Great Slum' }).click()
                await expect.poll(async () => (await call(page, 'tableFacts')).siteOf.Dana).toBe('slot.provinces.1')
            })

            test('Toll Roads: the ruler sees the toll site marked, and the pick waits on the traveller', async ({ page }) => {
                await openTable(page, 'woodRulerToll')
                const provinces = panel(page).getByRole('group', { name: 'Sites in the Provinces' })
                await expect(provinces.getByRole('button')).toHaveText([/^\s*Great Slum\s*·\s*toll\s*1\s*$/, 'River'])
                const mark = provinces.getByRole('button').first().locator('.favor-cost')
                await expect(mark.locator('img[alt="favor"]')).toBeVisible()
                // The toll's count is gold, as a cost is.
                const gold = await page.evaluate(() => {
                    const probe = document.createElement('span')
                    probe.style.color = 'var(--oath-accent)'
                    document.querySelector('.panel')?.append(probe)
                    const color = getComputedStyle(probe).color
                    probe.remove()
                    return color
                })
                await expect(mark.locator('.favor-cost__count')).toHaveCSS('color', gold)

                await provinces.getByRole('button', { name: /^Great Slum/ }).click()
                // The table passes to the traveller, asked before anything is paid or moved.
                await expect(panel(page).getByRole('heading', { name: 'Toll Roads' })).toBeVisible()
                const facts = await call(page, 'tableFacts')
                expect(facts.seatId).toBe('Dana')
                expect(facts.siteOf.Dana).toBe('slot.provinces.0')
                expect(facts.favorOf.Dana).toBe(2)
            })
        }

        /** The traveller's Toll Roads question, in the question form, its Pay and Refuse at a standard size. */
        async function tollQuestion(page: Page) {
            expect((await openTable(page, 'woodTollAsked')).seatId).toBe('Dana')
            await expect(panel(page).getByRole('heading', { name: 'Toll Roads' })).toBeVisible()
            await expect(panel(page).locator('.question-line')).toHaveText(/^Pay\s*Rhys\s*1\?$/)
            const pay = panel(page).getByRole('button', { name: 'Pay', exact: true })
            const refuse = panel(page).getByRole('button', { name: 'Refuse', exact: true })
            const [payBox, refuseBox, panelBox] = [await boxOf(page, pay), await boxOf(page, refuse), await boxOf(page, panel(page))]
            // One width for the two, the wider label's, never stretched across the panel.
            expect(Math.abs(payBox.width - refuseBox.width)).toBeLessThan(1)
            expect(payBox.width + refuseBox.width).toBeLessThan(panelBox.width * 0.6)
            if (phone) {
                expect(payBox.height).toBeGreaterThanOrEqual(44)
                expect(refuseBox.height).toBeGreaterThanOrEqual(44)
            }
            return { pay, refuse }
        }

        test('Toll Roads at the pick: the traveller pays or refuses before any Supply is paid', async ({ page }) => {
            const { pay } = await tollQuestion(page)
            await pay.click()
            await expect.poll(async () => (await call(page, 'tableFacts')).siteOf.Dana).toBe('slot.provinces.1')
            const facts = await call(page, 'tableFacts')
            expect(facts.favorOf).toMatchObject({ Dana: 1 })
            if (!phone) {
                await page.getByRole('tab', { name: 'History' }).click()
                await expect(page.locator('.history')).toContainText("left the Shrouded Wood for the Great Slum (Rhys's pick), paying 2 Supply; paid Rhys 1 (Toll Roads)")
            }
        })

        test('Toll Roads at the pick: refused, the traveller stays in the Wood and pays nothing', async ({ page }) => {
            const { refuse } = await tollQuestion(page)
            await refuse.click()
            await expect(refuse).toHaveCount(0)
            const facts = await call(page, 'tableFacts')
            expect(facts.siteOf.Dana).toBe('slot.provinces.0')
            expect(facts.favorOf).toMatchObject({ Dana: 2 })
            if (!phone) {
                await page.getByRole('tab', { name: 'History' }).click()
                await expect(page.locator('.history')).toContainText('refused Toll Roads and stayed at the Shrouded Wood')
            }
        })
    })
}

const siteAt = (page: Page, slotId: string) => page.locator(`.site[data-slot="${slotId}"]`)
const litSlots = (page: Page) =>
    page
        .locator('.site')
        .filter({ has: page.locator('.board-card.offered') })
        .evaluateAll((sites) => sites.map((site) => site.getAttribute('data-slot') ?? '').sort())

/** R-11.7 — on a desktop the ruler picks where the traveller goes on the lit map, as Travel does. */
test.describe('the Shrouded Wood ruler’s pick on a desktop at 1280', () => {
    test('only the sites the traveller can pay for are lit, each with its Supply; the panel lists no sites; a click sends the pick', async ({ page }) => {
        expect(page.viewportSize()?.width).toBe(1280)
        await openTable(page, 'woodRuler')
        await expect(panel(page).getByText(/^Pick where\s*Dana\s*goes\.$/)).toBeVisible()
        await expect(panel(page).getByRole('group', { name: /^Sites in the / })).toHaveCount(0)
        await expect(panel(page).getByRole('button', { name: /Drowned City|Plains|Great Slum|River/ })).toHaveCount(0)

        expect(await litSlots(page)).toEqual(['slot.cradle.0', 'slot.cradle.1', 'slot.provinces.1', 'slot.provinces.2'])
        for (const slotId of ['slot.cradle.0', 'slot.cradle.1']) {
            await expect(siteAt(page, slotId).locator('.travel-cost')).toHaveText('0 Supply')
            // The card that changed the price is named where the site is pointed at.
            await expect(siteAt(page, slotId).locator('.board-card')).toHaveAttribute('title', /0 Supply \(Decadent\)$/)
        }
        for (const slotId of ['slot.provinces.1', 'slot.provinces.2']) {
            await expect(siteAt(page, slotId).locator('.travel-cost')).toHaveText('2 Supply')
        }
        await expect(siteAt(page, 'slot.cradle.0').locator('.travel-cost')).toHaveCSS('background-color', 'rgb(251, 191, 36)')
        await expect(page.locator('.site.dimmed')).toHaveCount((await page.locator('.site').count()) - 4)
        expect((await call(page, 'tableFacts')).siteOf.Dana).toBe('slot.provinces.0')

        await siteAt(page, 'slot.provinces.1').locator('.board-card').click()
        await expect.poll(async () => (await call(page, 'tableFacts')).siteOf.Dana).toBe('slot.provinces.1')
        await expect(page.locator('.board-card.offered')).toHaveCount(0)
    })

    test('Toll Roads: the toll site’s chip carries the favor, and a click passes the pick to the traveller', async ({ page }) => {
        await openTable(page, 'woodRulerToll')
        await expect(panel(page).getByText(/^Pick where\s*Dana\s*goes\.$/)).toBeVisible()
        const chip = siteAt(page, 'slot.provinces.1').locator('.travel-cost')
        await expect(chip).toHaveText(/^\s*2\+$/)
        await expect(chip.getByRole('img', { name: 'favor' })).toBeVisible()
        await expect(siteAt(page, 'slot.provinces.2').locator('.travel-cost')).toHaveText('2 Supply')

        await siteAt(page, 'slot.provinces.1').locator('.board-card').click()
        // The table passes to the traveller, asked before anything is paid or moved; her map lights nothing.
        await expect(panel(page).getByRole('heading', { name: 'Toll Roads' })).toBeVisible()
        const facts = await call(page, 'tableFacts')
        expect(facts.seatId).toBe('Dana')
        expect(facts.siteOf.Dana).toBe('slot.provinces.0')
        expect(facts.favorOf.Dana).toBe(2)
        await expect(page.locator('.board-card.offered')).toHaveCount(0)
    })
})

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

const HIDDEN = 'slot.hinterland.1'
const panel = (page: Page) => page.locator('.panel')
const travelPrompt = (page: Page) => panel(page).getByText('Tap a lit site.', { exact: true })
const tile = (page: Page, label: string) => panel(page).locator('.majors button').filter({ hasText: label })
const siteAt = (page: Page, slotId: string) => page.locator(`.site[data-slot="${slotId}"]`)
const siteCard = (page: Page, slotId: string) => siteAt(page, slotId).locator('.board-card')
const chip = (page: Page, slotId: string) => siteAt(page, slotId).locator('.travel-cost')
const secretsIn = (locator: Locator) => locator.getByRole('img', { name: 'secret' })
const litSlots = (page: Page) =>
    page
        .locator('.site')
        .filter({ has: page.locator('.board-card.offered') })
        .evaluateAll((sites) => sites.map((site) => site.getAttribute('data-slot') ?? '').sort())
const oneFlip = (page: Page) =>
    panel(page).getByRole('button', { name: 'Travel to The Hidden Place: spend 4 Supply, flip a secret facedown', exact: true })
const twoFlips = (page: Page) =>
    panel(page).getByRole('button', { name: 'Travel to The Hidden Place: spend no Supply, flip 2 secrets facedown', exact: true })
const undo = (page: Page) => page.getByRole('button', { name: 'Undo', exact: true })
const history = (page: Page) => page.locator('.history')

const SIZES = [
    { name: 'desktop', viewport: { width: 1280, height: 900 }, phone: false },
    { name: 'phone', viewport: { width: 375, height: 812 }, phone: true }
]

async function chooseTravel(page: Page, table: TableFixture.TableName) {
    await openTable(page, table)
    await tile(page, 'Travel').last().click()
    await expect(travelPrompt(page)).toBeVisible()
}

/** The map scrolled so the site shows, then the shot of the page as the player sees it. */
async function shot(page: Page, name: string, phone: boolean) {
    await page.mouse.move(2, 2)
    await page.screenshot({ path: test.info().outputPath(`${name}-${phone ? 'phone' : 'desktop'}.png`) })
}

for (const { name, viewport, phone } of SIZES) {
    /**
     * R-11.13-H2 — me at the Buried Giant with 2 faceup secrets; The Hidden Place in the middle
     * Hinterland slot, 4 Supply away: one flip satisfies it at the usual Supply, two make it free.
     */
    test.describe(`From the Buried Giant to The Hidden Place, on a ${name}`, () => {
        test.use({ viewport, hasTouch: phone })

        test('3 Supply: the free way alone, "0+[secret][secret]"; a tap travels and flips both', async ({ page }) => {
            await chooseTravel(page, 'buriedGiantHiddenPlace')
            await expect(chip(page, HIDDEN)).toHaveText('0+')
            await expect(secretsIn(chip(page, HIDDEN))).toHaveCount(2)
            // The other Hinterland sites keep their one flip.
            for (const slotId of ['slot.hinterland.0', 'slot.hinterland.2']) {
                await expect(chip(page, slotId)).toHaveText('0+')
                await expect(secretsIn(chip(page, slotId))).toHaveCount(1)
            }
            await siteCard(page, HIDDEN).scrollIntoViewIfNeeded()
            await shot(page, 'buried-giant-hidden-place-short', phone)
            await siteCard(page, HIDDEN).click()
            await expect.poll(async () => (await call(page, 'tableFacts')).siteOf.me).toBe(HIDDEN)
            expect((await call(page, 'tableFacts')).secretsOf.me).toBe(0)
            if (!phone) {
                await page.getByRole('tab', { name: 'History' }).click()
                await expect(history(page)).toContainText(/traveled to The Hidden Place; flipped 2/)
                await expect(history(page).getByRole('img', { name: 'secrets' })).toBeVisible()
            }
        })

        test('one faceup secret and 3 Supply: The Hidden Place is not lit', async ({ page }) => {
            await chooseTravel(page, 'buriedGiantHiddenPlacePoor')
            const lit = await litSlots(page)
            expect(lit).not.toContain(HIDDEN)
            expect(lit).toContain('slot.hinterland.0')
            await expect(chip(page, HIDDEN)).toHaveCount(0)
        })

        test('4 or more Supply: "4+[secret] or 0+[secret][secret]"; the two ways open, label-sized, one width; Undo closes them', async ({ page }) => {
            await chooseTravel(page, 'buriedGiantHiddenPlaceRich')
            await expect(chip(page, HIDDEN)).toHaveText('4+ or 0+')
            await expect(secretsIn(chip(page, HIDDEN))).toHaveCount(3)
            await expect(chip(page, 'slot.hinterland.0')).toHaveText('4 or 0+')
            await siteCard(page, HIDDEN).click()
            await expect(oneFlip(page)).toBeVisible()
            await expect(twoFlips(page)).toBeVisible()
            await expect(oneFlip(page)).toHaveText(/^\s*4 Supply\s*\+\s*$/)
            await expect(twoFlips(page)).toHaveText(/^\s*0\s*\+\s*$/)
            await expect(secretsIn(oneFlip(page))).toHaveCount(1)
            await expect(secretsIn(twoFlips(page))).toHaveCount(2)
            const [one, two] = [await boxOf(oneFlip(page)), await boxOf(twoFlips(page))]
            expect(two.width).toBeCloseTo(one.width, 0)
            expect(one.width).toBeLessThan((await boxOf(panel(page))).width / 2)
            if (phone) {
                expect(one.height).toBeGreaterThanOrEqual(43.5)
                expect(two.height).toBeGreaterThanOrEqual(43.5)
            }
            expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
            await shot(page, 'buried-giant-hidden-place-rich', phone)

            await undo(page).click()
            await expect(twoFlips(page)).toHaveCount(0)
            await expect(travelPrompt(page)).toBeVisible()
            expect((await call(page, 'tableFacts')).siteOf.me).toBe('slot.cradle.0')

            await siteCard(page, HIDDEN).click()
            await oneFlip(page).click()
            await expect.poll(async () => (await call(page, 'tableFacts')).siteOf.me).toBe(HIDDEN)
            expect((await call(page, 'tableFacts')).secretsOf.me).toBe(1)
        })
    })
}

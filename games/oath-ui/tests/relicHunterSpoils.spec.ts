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

/** Its size as laid out, before the panel is scaled to fit the screen. */
const layoutSizeOf = async (locator: Locator) => {
    const size = await locator.evaluate((element) =>
        element instanceof HTMLElement ? { width: element.offsetWidth, height: element.offsetHeight } : undefined
    )
    if (!size) throw Error('The element is not laid out')
    return size
}

const panel = (page: Page) => page.locator('.panel')
const stepCount = (page: Page) => panel(page).getByText(/^\d of \d$/)
const rows = (page: Page) => panel(page).getByRole('list', { name: 'Relics taken' }).getByRole('listitem')
const row = (page: Page, name: string) => rows(page).filter({ hasText: name })
const option = (page: Page, relic: string, name: string) =>
    row(page, relic).getByRole('button', { name, exact: true })
const takeSpoils = (page: Page) => panel(page).getByRole('button', { name: 'Take spoils', exact: true })

const SIZES = [
    { name: 'desktop', viewport: { width: 1280, height: 900 }, phone: false },
    { name: 'phone', viewport: { width: 375, height: 812 }, phone: true }
]

async function shot(page: Page, name: string, phone: boolean) {
    await page.mouse.move(2, 2)
    await panel(page).screenshot({ path: test.info().outputPath(`${name}-${phone ? 'phone' : 'desktop'}.png`) })
}

/** The warbands step as it comes, then the relics. */
async function toRelics(page: Page) {
    await openTable(page, 'spoilsRelicHunterDrum')
    await expect(stepCount(page)).toHaveText('1 of 2')
    await panel(page).getByRole('button', { name: 'Next', exact: true }).click()
    await expect(stepCount(page)).toHaveText('2 of 2')
}

for (const { name, viewport, phone } of SIZES) {
    /**
     * Relic Hunter's "any relics you take": the attacker took the Cup of Plenty facedown at a site and
     * the defender's Dragonskin Drum (their pawn was at the attacker's site).
     */
    test.describe(`Relic Hunter's relics taken, on a ${name}`, () => {
        test.use({ viewport, hasTouch: phone })

        test("the defender's Drum gets the Cup's row: picture, name, Keep it and Bottom of the relic deck, label-sized", async ({ page }) => {
            await toRelics(page)
            await expect(rows(page)).toHaveCount(2)
            await expect(rows(page).nth(0)).toContainText('Cup of Plenty')
            await expect(rows(page).nth(1)).toContainText('Dragonskin Drum')
            await expect(row(page, 'Dragonskin Drum').getByRole('img', { name: 'Dragonskin Drum' })).toBeVisible()
            // No "from" line: the row is the picture, the name and the two options.
            await expect(row(page, 'Dragonskin Drum')).toHaveText(/^\s*Dragonskin Drum\s*Keep it\s*Bottom of the relic deck\s*$/)
            const buttons = panel(page).getByRole('list', { name: 'Relics taken' }).getByRole('button', { name: /^(Keep it|Bottom of the relic deck)$/ })
            await expect(buttons).toHaveCount(4)
            const width = (await layoutSizeOf(panel(page))).width
            const boxes = await Promise.all((await buttons.all()).map(layoutSizeOf))
            for (const box of boxes) {
                if (phone) expect(box.height).toBeGreaterThanOrEqual(44)
                expect(box.width).toBeLessThan(width)
                expect(Math.abs(box.width - (boxes[0]?.width ?? 0))).toBeLessThanOrEqual(1)
            }
            const named = await boxOf(row(page, 'Dragonskin Drum').getByText('Dragonskin Drum', { exact: true }))
            const keep = await boxOf(option(page, 'Dragonskin Drum', 'Keep it'))
            // On a phone the buttons stack under the name; on a desktop they sit beside it.
            if (phone) expect(keep.y).toBeGreaterThanOrEqual(named.y + named.height)
            else expect(keep.x).toBeGreaterThan(named.x + named.width)
            await expect(takeSpoils(page)).toHaveCount(0)
            await shot(page, 'relic-hunter-rows', phone)
        })

        test('the Cup kept and the Drum sent down: each pressed, then sent; the defender no longer holds the Drum, nor the attacker', async ({ page }) => {
            await toRelics(page)
            await option(page, 'Cup of Plenty', 'Keep it').click()
            await expect(takeSpoils(page)).toHaveCount(0)
            await option(page, 'Dragonskin Drum', 'Bottom of the relic deck').click()
            await expect(option(page, 'Cup of Plenty', 'Keep it')).toHaveAttribute('aria-pressed', 'true')
            await expect(option(page, 'Dragonskin Drum', 'Bottom of the relic deck')).toHaveAttribute('aria-pressed', 'true')
            await expect(option(page, 'Dragonskin Drum', 'Keep it')).toHaveAttribute('aria-pressed', 'false')
            await expect(takeSpoils(page)).toBeVisible()
            await shot(page, 'relic-hunter-picked', phone)
            await takeSpoils(page).click()
            await expect.poll(async () => (await call(page, 'tableFacts')).campaignUnderway).toBe(false)
            const facts = await call(page, 'tableFacts')
            expect(facts.relicsOf.def).toEqual([])
            expect(facts.relicsOf.att).toEqual(['relic.cup-of-plenty'])
        })

        test("Undo takes back the step's picks at once, both rows' as the warbands' counts, then the step before", async ({ page }) => {
            await toRelics(page)
            await option(page, 'Cup of Plenty', 'Bottom of the relic deck').click()
            await option(page, 'Dragonskin Drum', 'Keep it').click()
            await expect(takeSpoils(page)).toBeVisible()
            const undo = page.getByRole('button', { name: 'Undo', exact: true })
            await undo.click()
            await expect(stepCount(page)).toHaveText('2 of 2')
            await expect(option(page, 'Dragonskin Drum', 'Keep it')).toHaveAttribute('aria-pressed', 'false')
            await expect(option(page, 'Cup of Plenty', 'Bottom of the relic deck')).toHaveAttribute('aria-pressed', 'false')
            await expect(takeSpoils(page)).toHaveCount(0)
            await undo.click()
            await expect(stepCount(page)).toHaveText('1 of 2')
        })
    })
}

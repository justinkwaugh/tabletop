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

/** R-7.6.3-H1 — a promise as long as the rule allows (200), one unbroken word. */
const LONG = 'W'.repeat(200)

const grid = (page: Page) => page.locator('.panel')
const detail = (page: Page) => page.locator('.seat-detail')
const history = (page: Page) => page.locator('.history')

/**
 * How far a panel runs sideways: its own overflow, the page's, and every element inside it that
 * reaches past its edges (none should).
 */
async function sideways(panel: Locator) {
    return panel.evaluate((element) => {
        const edge = element.getBoundingClientRect()
        const past = [...element.querySelectorAll('*')].flatMap((inner) => {
            const box = inner.getBoundingClientRect()
            if (box.width === 0 || box.height === 0) return []
            if (box.left >= edge.left - 0.5 && box.right <= edge.right + 0.5) return []
            return [`${inner.tagName.toLowerCase()}.${inner.className} ${Math.round(box.width)}`]
        })
        return {
            panel: element.scrollWidth - element.clientWidth,
            page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            past
        }
    })
}

async function expectInside(panel: Locator) {
    await expect(panel).toBeVisible()
    expect(await sideways(panel)).toEqual({ panel: 0, page: 0, past: [] })
}

/**
 * R-7.6.3-H1 — a long unbroken promise wraps inside its panel wherever it is shown: the promise box,
 * the offer's answer, the Resolve Tribunal rows, the kept-deal question, the seat detail's open deals and the
 * end-of-game list in the History. Nothing runs past its panel and the page never scrolls sideways.
 */
for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 }
]) {
    test.describe(`a 200-letter unbroken promise at ${viewport.width} × ${viewport.height}`, () => {
        test.use({ viewport })

        test('the promise box holds it as typed inside the panel', async ({ page }) => {
            await openTable(page, 'tribunalOffer')
            await grid(page).getByRole('button', { name: 'Use a power', exact: true }).click()
            await grid(page)
                .locator('[data-action-power="site.the-tribunal"]')
                .getByRole('button', { name: 'rhys', exact: true })
                .click()
            const box = grid(page).getByRole('textbox', {
                name: 'You promise (optional)',
                exact: true
            })
            await box.fill(LONG)
            await expect(grid(page).locator('[data-promise-count]').first()).toHaveText('200 / 200')
            await expectInside(grid(page))
        })

        test('the offer’s answer quotes it inside the question panel', async ({ page }) => {
            await openTable(page, 'tribunalAnswerLong')
            await expect(grid(page).locator('[data-promise]').last()).toHaveText(LONG)
            await expectInside(grid(page))
        })

        test('the Resolve Tribunal rows quote it inside the panel', async ({ page }) => {
            await openTable(page, 'tribunalDealsLong')
            await grid(page)
                .locator('.minors button')
                .filter({ hasText: 'Resolve Tribunal' })
                .click()
            await expect(grid(page).locator('[data-deal-promise]')).toHaveCount(3)
            await expect(
                grid(page).locator('[data-deal="3.7"] [data-deal-promise]').last()
            ).toContainText(LONG)
            await expectInside(grid(page))
        })

        test('the kept-deal question quotes it inside the question panel', async ({ page }) => {
            await openTable(page, 'tribunalDealAskedLong')
            await expect(grid(page).locator('[data-promise]').last()).toHaveText(LONG)
            await expectInside(grid(page))
        })

        test('the seat detail’s open deals quote it inside the detail', async ({ page }) => {
            for (const seat of ['rhys', 'ann']) {
                await openTable(page, 'tribunalDealsLong')
                await page.getByRole('button', { name: `Open ${seat}'s seat`, exact: true }).click()
                await expect(detail(page).locator('[data-promise]').last()).toHaveText(LONG)
                await expectInside(detail(page))
            }
        })

        test('the end-of-game list in the History quotes it inside the History', async ({
            page
        }) => {
            await openTable(page, 'tribunalDealsEndedLong')
            await page.getByRole('tab', { name: 'History' }).click()
            const dropped = history(page).locator('[data-dropped-deals]')
            await expect(dropped).toContainText(`"${LONG}"`)
            await expectInside(history(page))
        })
    })
}

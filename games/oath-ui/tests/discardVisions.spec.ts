import { expect, test, type Page } from '@playwright/test'
import type * as TableFixture from '../src/lib/testing/tableFixture.js'

// R-9.4 — the fronts in a discard pile are private and every back is public, so the box beside each
// pile names its count and, from the backs, where its Visions lie from the top: never which Vision.

async function openTable(page: Page, name: TableFixture.TableName) {
    await page.goto('/')
    await page.evaluate(async (name) => {
        const fixture = await import(
            new URL('/src/lib/testing/tableFixture.ts', location.href).href
        )
        return fixture.open(name)
    }, name)
}

const pile = (page: Page, region: string) => page.locator(`.discard[data-region="${region}"]`)
const box = (page: Page, region: string) => pile(page, region).locator('.discard__box')

async function expectCountOnly(page: Page, region: string, count: string) {
    await expect(box(page, region).locator('.discard__count')).toHaveText(count)
    await expect(box(page, region).locator('.discard__unit')).toHaveText(
        count === '1' ? 'card' : 'cards'
    )
    await expect(box(page, region).locator('.discard__visions')).toHaveCount(0)
}

async function expectVisions(page: Page, region: string, word: string, places: string) {
    const visions = box(page, region).locator('.discard__visions')
    await expect(visions.locator('.discard__vision-word')).toHaveText(word)
    await expect(visions.locator('.discard__places')).toHaveText(places)
    await expect(visions.locator('img')).toHaveCount(1)
}

for (const viewport of [
    { width: 1280, height: 800 },
    { width: 375, height: 812 }
]) {
    test.describe(`at ${viewport.width} × ${viewport.height}`, () => {
        test.use({ viewport })

        test('the Provinces’ box reads 12 cards, Visions 3rd, 8th; the Hinterland’s 7 cards, Vision 1st; the Cradle’s 4 cards alone', async ({
            page
        }) => {
            await openTable(page, 'discardVisions')
            await expect(box(page, 'provinces').locator('.discard__count')).toHaveText('12')
            await expect(box(page, 'provinces').locator('.discard__unit')).toHaveText('cards')
            await expectVisions(page, 'provinces', 'Visions', '3rd, 8th')
            await expect(box(page, 'hinterland').locator('.discard__count')).toHaveText('7')
            await expectVisions(page, 'hinterland', 'Vision', '1st')
            await expectCountOnly(page, 'cradle', '4')
            await expect(box(page, 'provinces')).toHaveAttribute(
                'aria-label',
                'Provinces discard pile: 12 cards; Visions 3rd and 8th from the top'
            )
        })

        test('each box sits right of its pile, above the site rows, and the pile carries no count of its own', async ({
            page
        }) => {
            await openTable(page, 'discardVisions')
            for (const region of ['cradle', 'provinces', 'hinterland']) {
                const card = await pile(page, region).locator('.discard__pile').boundingBox()
                const frame = await box(page, region).boundingBox()
                const firstSite = await page
                    .locator(`.site[data-slot="slot.${region}.0"]`)
                    .boundingBox()
                expect(card && frame && firstSite).toBeTruthy()
                if (!card || !frame || !firstSite) return
                expect(frame.x).toBeGreaterThan(card.x + card.width)
                expect(frame.y + frame.height).toBeLessThan(firstSite.y)
                // The count is the box's alone: nothing of it lies over the pile.
                await expect(pile(page, region).locator('.discard__count')).toHaveCount(1)
            }
            const board = await page.locator('.scaling-surface').first().boundingBox()
            const last = await box(page, 'hinterland').boundingBox()
            if (board && last && viewport.width > 640)
                expect(last.x + last.width).toBeLessThanOrEqual(board.x + board.width + 1)
        })

        test('a game created before the table kept every back: each box shows its count alone, 0 cards for an empty pile', async ({
            page
        }) => {
            await openTable(page, 'discardVisionsOlderGame')
            await expectCountOnly(page, 'cradle', '0')
            await expectCountOnly(page, 'provinces', '12')
            await expectCountOnly(page, 'hinterland', '7')
            await expect(pile(page, 'cradle')).toHaveClass(/empty/)
        })
    })
}

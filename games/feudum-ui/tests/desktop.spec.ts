import { expect, test, type Locator, type Page } from '@playwright/test'
import { openFixture } from './scenarioTable.js'

/**
 * A desk at 1440 x 900, and a small laptop at 1280 x 720: where things stand on the real table, read
 * off the page.
 */

const problems = new WeakMap<Page, string[]>()

test.beforeEach(({ page }) => {
    const seen: string[] = []
    problems.set(page, seen)
    page.on('pageerror', (error) => seen.push(error.message))
    page.on('console', (message) => {
        if (/Error (applying|handling)/.test(message.text())) {
            seen.push(message.text())
        }
    })
})

test.afterEach(({ page }) => {
    expect(problems.get(page)).toEqual([])
})

const panel = (page: Page) => page.locator('[data-action-panel]')

async function rect(target: Locator) {
    const box = await target.boundingBox()
    if (!box) {
        throw new Error('not on the page')
    }
    return box
}

test.describe('a 1440 px desk', () => {
    test.use({ viewport: { width: 1440, height: 900 } })

    test('R-6.2 a sealed charter’s score reads as vp beneath its face', async ({ page }) => {
        await openFixture(page, 'game-end')
        const charter = panel(page).locator('[data-game-end-charter]')
        await expect(charter).toHaveCount(1)
        const score = charter.locator('[data-charter-score]')
        await expect(score).toHaveText('5 vp')
        const face = await rect(charter.locator('svg').first())
        expect((await rect(score)).y).toBeGreaterThanOrEqual(face.y + face.height - 1)
    })
})

import { expect, test, type Page } from '@playwright/test'
import { board, collectPageErrors, openScenario } from './helpers.js'

// Art plan, Palette: the board is a printed board on the table, light in the site's light and
// dark themes alike, and the panels and seat cards take its paper.

collectPageErrors()

const PAPER = {
    table: 'rgb(239, 232, 216)',
    sea: 'rgb(207, 227, 234)',
    plain: 'rgb(245, 237, 216)',
    card: 'rgb(255, 253, 247)'
}

/** The site keeps `.dark` on its document; the harness starts dark. */
async function useSiteTheme(page: Page, theme: 'light' | 'dark') {
    await page.evaluate(
        (dark) => document.documentElement.classList.toggle('dark', dark),
        theme === 'dark'
    )
}

async function computed(page: Page, selector: string, property: 'backgroundColor' | 'fill') {
    return page
        .locator(selector)
        .first()
        .evaluate((element, name) => getComputedStyle(element)[name], property)
}

/**
 * The board's mean relative luminance on screen, from a screenshot of the box it is shown in
 * (the board itself is drawn under a CSS zoom, which an element screenshot does not follow).
 */
async function boardLuminance(page: Page): Promise<number> {
    const png = await page.locator('[data-rtr-table] .grow-0.overflow-hidden').screenshot()
    await test.info().attach('board', { body: png, contentType: 'image/png' })
    return page.evaluate(
        async (bytes) => {
            const image = await createImageBitmap(
                new Blob([new Uint8Array(bytes)], { type: 'image/png' })
            )
            const canvas = new OffscreenCanvas(image.width, image.height)
            const context = canvas.getContext('2d')
            if (!context) return 0
            context.drawImage(image, 0, 0)
            const pixels = context.getImageData(0, 0, image.width, image.height).data
            let sum = 0
            for (let index = 0; index < pixels.length; index += 4) {
                sum +=
                    0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]
            }
            return sum / (pixels.length / 4) / 255
        },
        [...png]
    )
}

for (const theme of ['dark', 'light'] as const) {
    test(`The board and its table are paper in the site's ${theme} theme`, async ({ page }) => {
        await openScenario(page, 'Last journey')
        await useSiteTheme(page, theme)

        expect(await computed(page, '[data-rtr-table]', 'backgroundColor')).toBe(PAPER.table)
        expect(await computed(page, '[data-map-board] .ground rect', 'fill')).toBe(PAPER.sea)
        expect(await computed(page, 'section.seat', 'backgroundColor')).toBe(PAPER.card)
        // A light board: well above the old dark board's mean (about 0.2).
        expect(await boardLuminance(page)).toBeGreaterThan(0.6)
    })
}

test('Every railroad piece is a cube, every taken passenger an outline', async ({ page }) => {
    await openScenario(page, 'Last journey')
    const state = await page.evaluate(() => ({
        pieces: Object.values(window.rtrSession.gameState.track).flat().length,
        passengers: window.rtrSession.gameState.passengers.length
    }))
    const track = board(page).locator('g.track [data-cube]')
    await expect(track).toHaveCount(state.pieces)
    const cities = board(page).locator('g.passengers [data-passenger]')
    await expect(cities).toHaveCount(51)
    await expect(board(page).locator('g.passengers [data-passenger="waiting"]')).toHaveCount(
        state.passengers
    )
    await expect(board(page).locator('g.passengers [data-passenger="gone"]')).toHaveCount(
        51 - state.passengers
    )
    // The seat cards and the railroad strip show cubes too, with their railroad's letter.
    await expect(page.locator('section.seat svg [data-cube="R"]').first()).toBeVisible()
    await expect(board(page).locator('g.track [data-cube] path')).not.toHaveCount(0)
})

test('Cities mark their start colours with a ring and their bonuses with coins', async ({
    page
}) => {
    // Round 1's share: nothing is lit, so every city shows its marks.
    await openScenario(page, 'First share')
    const marks = (cityId: string) => board(page).locator(`[data-city-marks="${cityId}"]`)
    // New York: four start colours; San Francisco: two; Chicago: three, and its $2.
    await expect(marks('city.usa.new-york').locator('[data-start-ring]')).toHaveAttribute(
        'data-start-ring',
        '4'
    )
    await expect(marks('city.usa.new-york').locator('[data-start-ring] path')).toHaveCount(4)
    await expect(marks('city.usa.san-francisco').locator('[data-start-ring] path')).toHaveCount(2)
    await expect(marks('city.usa.chicago').locator('[data-bonus="chicago"]')).toHaveText('$2')
    await expect(marks('city.usa.denver').locator('[data-bonus]')).toHaveText('$5')
    // A city with no start colours draws no ring.
    await expect(marks('city.usa.denver').locator('[data-start-ring]')).toHaveCount(0)
})

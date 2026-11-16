import { expect, test, type Page } from '@playwright/test'
import { board, collectPageErrors, litHexAt, litLabels, openScenario, pressHex } from './helpers.js'

// Art plan, Palette and Pieces: a printed board on the table, light in the site's light and dark
// themes alike, its sea hatched in a navy frame, its pieces flat and unlettered.

collectPageErrors()

const CHART = {
    table: 'rgb(239, 232, 216)',
    frame: 'rgb(15, 26, 44)',
    plain: 'rgb(247, 243, 231)',
    card: 'rgb(248, 243, 228)'
}

/** The site keeps `.dark` on its document; the harness starts dark. */
async function useSiteTheme(page: Page, theme: 'light' | 'dark') {
    await page.evaluate(
        (dark) => document.documentElement.classList.toggle('dark', dark),
        theme === 'dark'
    )
}

async function computed(
    page: Page,
    selector: string,
    property: 'backgroundColor' | 'fill' | 'stroke'
) {
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
    test(`The board and its table keep the chart look in the site's ${theme} theme`, async ({
        page
    }) => {
        await openScenario(page, 'Last journey')
        await useSiteTheme(page, theme)

        expect(await computed(page, '[data-rtr-table]', 'backgroundColor')).toBe(CHART.table)
        await expect(board(page).locator('[data-sea-hatch]')).toHaveAttribute(
            'stroke',
            'var(--rtr-sea-line)'
        )
        expect(await computed(page, '[data-map-board] [data-frame]', 'stroke')).toBe(CHART.frame)
        expect(await computed(page, '[data-map-board] .ground polygon', 'fill')).toBe(CHART.plain)
        expect(await computed(page, 'section.seat', 'backgroundColor')).toBe(CHART.card)
        // A light board: well above the old dark board's mean (about 0.2). It is measured as a
        // seat watching sees it, with no pick open, since a pick's scrim dims the map on purpose.
        await page.evaluate(() => window.rtrSession.setViewingAsNonActivePlayer(true))
        await expect(board(page).locator('g.scrim path')).toHaveCount(0)
        expect(await boardLuminance(page)).toBeGreaterThan(0.6)
    })
}

test('Every railroad piece is a flat unlettered square, every passenger a meeple or its outline', async ({
    page
}) => {
    await openScenario(page, 'Last journey')
    const state = await page.evaluate(() => ({
        pieces: Object.values(window.rtrSession.gameState.track).flat().length,
        passengers: window.rtrSession.gameState.passengers.length
    }))
    const track = board(page).locator('g.track [data-cube]')
    await expect(track).toHaveCount(state.pieces)
    await expect(board(page).locator('g.passengers [data-passenger]')).toHaveCount(51)
    await expect(board(page).locator('g.passengers [data-passenger-shape="meeple"]')).toHaveCount(
        51
    )
    await expect(board(page).locator('g.passengers [data-passenger="waiting"]')).toHaveCount(
        state.passengers
    )
    await expect(board(page).locator('g.passengers [data-passenger="gone"]')).toHaveCount(
        51 - state.passengers
    )
    // The seat cards show cubes too; no cube, on the map or off it, carries a letter.
    await expect(page.locator('section.seat svg [data-cube="railroad.red"]').first()).toBeVisible()
    // One flat square each: no faces, gradients or grain.
    await expect(board(page).locator('g.track rect[data-cube]')).toHaveCount(state.pieces)
    await expect(board(page).locator('linearGradient, radialGradient')).toHaveCount(0)
    expect(await page.locator('[data-cube]').count()).toBeGreaterThan(state.pieces)
    await expect(page.locator('[data-cube] text')).toHaveCount(0)
})

test('Cities band their start colours, plain cities in Black, with serif pills and capacities', async ({
    page
}) => {
    // Round 1's share: nothing is lit, so every city shows its marks.
    await openScenario(page, 'First share')
    const marks = (cityId: string) => board(page).locator(`[data-city-marks="${cityId}"]`)
    // New York: four start colours; San Francisco: two.
    await expect(marks('city.usa.new-york').locator('[data-start-band]')).toHaveAttribute(
        'data-start-band',
        '4'
    )
    await expect(marks('city.usa.new-york').locator('[data-band-colour]')).toHaveCount(4)
    await expect(marks('city.usa.san-francisco').locator('[data-band-colour]')).toHaveCount(2)
    // Denver has no printed start colour: only Black may start there (R-4.2.5).
    await expect(marks('city.usa.denver').locator('[data-band-colour]')).toHaveCount(1)
    await expect(
        marks('city.usa.denver').locator('[data-band-colour="railroad.black"]')
    ).toHaveCount(1)
    await expect(marks('city.usa.chicago').locator('[data-bonus="chicago"]')).toHaveText('$2')
    await expect(marks('city.usa.denver').locator('[data-bonus]')).toHaveText('$5')
    await expect(marks('city.usa.new-york').locator('[data-capacity]')).toHaveText('1')
    await expect(marks('city.usa.chicago').locator('[data-capacity]')).toHaveCount(0)
    expect(
        await marks('city.usa.denver')
            .locator('[data-bonus] text')
            .evaluate((text) => getComputedStyle(text).fontFamily)
    ).toContain('Ride the Rails Serif')
})

test("Round 3 shows Yellow's start cities to every seat, whoever acts", async ({ page }) => {
    // Ben decides on a share; nobody builds, yet Yellow's starts are marked for all.
    await openScenario(page, 'Red supply empty')
    const cues = board(page).locator('[data-start-cue="railroad.yellow"]')
    await expect(cues).not.toHaveCount(0)
    await expect(board(page).locator('[data-start-cue="railroad.purple"]')).toHaveCount(0)
    await expect(board(page).locator('[data-start-cue="railroad.black"]')).toHaveCount(0)
    expect(await page.evaluate(() => window.rtrSession.gameState.activePlayerIds)).toEqual(['p2'])

    // In Ada's building turn the marks name the same cities her lit Yellow starts do.
    await openScenario(page, 'Yellow starts')
    const yellowStarts = (await litLabels(page))
        .filter((label) => /start Yellow/.test(label))
        .map((label) => label.split(':')[0])
    const cuedHexes = async () =>
        (
            await board(page)
                .locator('[data-start-cue="railroad.yellow"]')
                .evaluateAll((groups) => groups.map((group) => group.getAttribute('data-hex')))
        ).toSorted()
    expect(await cuedHexes()).toHaveLength(yellowStarts.length)
    expect(await cuedHexes()).toContain('hex.usa.5-43')

    // Ada starts Yellow in Chicago: Yellow has a cube on the map, so its marks go.
    await pressHex(page, litHexAt(page, 'hex.usa.5-43'))
    const popup = page.getByRole('group', { name: 'Chicago: which railroad?', exact: true })
    if (await popup.isVisible()) {
        await popup.getByRole('button', { name: /^Start Yellow, / }).click()
    }
    await expect(board(page).locator('[data-start-cue="railroad.yellow"]')).toHaveCount(0)
})

test('Lit hexes show a ghost cube for each railroad that may build there', async ({ page }) => {
    await openScenario(page, 'First placement')
    // R-4.2.1: Red may start in each of the six East Coast cities, one ghost cube in each.
    const ghosts = board(page).locator('g.picks [data-ghost]')
    await expect(ghosts).toHaveCount(6)
    await expect(board(page).locator('g.picks [data-ghost="railroad.red"]')).toHaveCount(6)
    // The old lettered pips are gone.
    await expect(board(page).locator('g.picks circle')).toHaveCount(0)
})

test('The railroad popup is two cube buttons with no words, named in full', async ({ page }) => {
    await openScenario(page, 'Two railroads meet')
    const both = board(page)
        .getByRole('button', { name: /: place Red or Blue$/ })
        .first()
    const place = ((await both.getAttribute('aria-label')) ?? '').split(':')[0] ?? ''
    await pressHex(page, both)
    const popup = page.getByRole('group', { name: `${place}: which railroad?`, exact: true })
    await expect(popup).toBeVisible()
    const buttons = popup.getByRole('button')
    await expect(buttons).toHaveCount(2)
    await expect(buttons.nth(0)).toHaveAccessibleName(/^Place Red, \d+ left$/)
    await expect(buttons.nth(1)).toHaveAccessibleName(/^Place Blue, \d+ left$/)
    // No title, no "Undo closes", no railroad names: the popup's text is empty.
    expect((await popup.innerText()).trim()).toBe('')
    await expect(buttons.nth(0).locator('svg [data-cube="railroad.red"]')).toHaveCount(1)
})

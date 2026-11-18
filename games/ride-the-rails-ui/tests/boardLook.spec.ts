import { expect, test, type Page } from '@playwright/test'
import {
    board,
    collectPageErrors,
    litHexAt,
    litHexes,
    litLabels,
    openScenario,
    pressHex
} from './helpers.js'

// Art plan, Palette and Pieces: a printed board on a pale mist table, light in the site's light
// and dark themes alike, its hatched sea edged by a thin line in a deeper sea, its pieces flat and
// unlettered.

collectPageErrors()

const MIST = {
    table: 'rgb(230, 231, 227)',
    seaEdge: 'rgb(138, 162, 169)',
    plain: 'rgb(247, 243, 231)',
    card: 'rgb(244, 242, 236)'
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
    test(`The board and its table keep the mist look in the site's ${theme} theme`, async ({
        page
    }) => {
        await openScenario(page, 'Last journey')
        await useSiteTheme(page, theme)

        await expect(page.locator('[data-rtr-table]')).toHaveAttribute('data-rtr-palette', 'mist')
        expect(await computed(page, '[data-rtr-table]', 'backgroundColor')).toBe(MIST.table)
        await expect(board(page).locator('[data-sea-hatch]')).toHaveAttribute(
            'stroke',
            'var(--rtr-sea-line)'
        )
        // The map's edge is a thin line in a deeper sea, not the old navy frame.
        await expect(board(page).locator('[data-frame]')).toHaveAttribute('stroke-width', '3')
        expect(await computed(page, '[data-map-board] [data-frame]', 'stroke')).toBe(MIST.seaEdge)
        expect(await computed(page, '[data-map-board] .ground polygon', 'fill')).toBe(MIST.plain)
        expect(await computed(page, 'section.seat', 'backgroundColor')).toBe(MIST.card)
        // A light board: well above the old dark board's mean (about 0.2). It is measured as a
        // seat watching sees it, with no pick open, since a pick's scrim dims the map on purpose.
        await page.evaluate(() => window.rtrSession.setViewingAsNonActivePlayer(true))
        await expect(board(page).locator('g.scrim path')).toHaveCount(0)
        expect(await boardLuminance(page)).toBeGreaterThan(0.6)
    })
}

test('Every railroad piece is a flat unlettered square, every waiting passenger a meeple', async ({
    page
}) => {
    await openScenario(page, 'Last journey')
    const state = await page.evaluate(() => ({
        pieces: Object.values(window.rtrSession.gameState.track).flat().length,
        passengers: window.rtrSession.gameState.passengers.length
    }))
    const track = board(page).locator('g.track [data-cube]')
    await expect(track).toHaveCount(state.pieces)
    // A taken passenger never comes back on the USA map (R-3.3.6), so it leaves no outline.
    expect(state.passengers).toBeLessThan(51)
    await expect(board(page).locator('g.passengers [data-passenger]')).toHaveCount(state.passengers)
    await expect(board(page).locator('g.passengers [data-passenger-shape="meeple"]')).toHaveCount(
        state.passengers
    )
    await expect(board(page).locator('g.passengers [data-passenger="gone"]')).toHaveCount(0)
    // The seat cards show cubes too; no cube, on the map or off it, carries a letter.
    await expect(page.locator('section.seat svg [data-cube="railroad.red"]').first()).toBeVisible()
    // One flat square each: no faces, gradients or grain.
    await expect(board(page).locator('g.track rect[data-cube]')).toHaveCount(state.pieces)
    await expect(board(page).locator('linearGradient, radialGradient')).toHaveCount(0)
    expect(await page.locator('[data-cube]').count()).toBeGreaterThan(state.pieces)
    await expect(page.locator('[data-cube] text')).toHaveCount(0)
})

test('Every city bands its start colours with Black, the pills at its foot, the capacities in the sea', async ({
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
    // Denver has no printed start colour: only Black may start there (R-4.2.5), a thin Black band.
    await expect(marks('city.usa.denver').locator('[data-band-colour]')).toHaveCount(1)
    await expect(
        marks('city.usa.denver').locator('[data-band-colour="railroad.black"]')
    ).toHaveCount(1)
    // Black is on every city's band.
    const cities = board(page).locator('[data-city-marks]')
    await expect(cities).toHaveCount(51)
    await expect(
        board(page).locator('[data-city-marks]:has([data-band-colour="railroad.black"])')
    ).toHaveCount(51)
    // R-4.3: Chicago's $2 and each $5 untaken are pills of their own, not part of the city's marks.
    const bonuses = board(page).locator('g.bonuses [data-bonus]')
    await expect(board(page).locator('g.bonuses [data-bonus="coin"]')).toHaveText('$2')
    const fives = board(page).locator('g.bonuses [data-bonus="five"]')
    expect(await fives.count()).toBeGreaterThan(0)
    for (const text of await fives.allTextContents()) expect(text).toBe('$5')
    await expect(board(page).locator('g.bonuses [data-bonus="used"]')).toHaveCount(0)
    await expect(cities.locator('[data-bonus]')).toHaveCount(0)
    expect(
        await fives
            .first()
            .locator('text')
            .evaluate((text) => getComputedStyle(text).fontFamily)
    ).toContain('Ride the Rails Serif')
    // R-4.1.3, R-4.1.4: a "1" in the water beside each of the six East Coast cities, a "6" by
    // Chicago; no limit is written in a city.
    const capacities = board(page).locator('[data-capacity-marks] text')
    expect((await capacities.allTextContents()).toSorted()).toEqual([
        '1',
        '1',
        '1',
        '1',
        '1',
        '1',
        '6'
    ])
    await expect(cities.locator('[data-capacity]')).toHaveCount(0)
    // No city is named on the board.
    expect(await board(page).locator('text').allTextContents()).not.toContain('Chicago')

    // R-4.3: bonuses are paid for building, so the journey phase hides every pill.
    await openScenario(page, 'Journey choices')
    await expect(bonuses).toHaveCount(0)
})

/** The cities whose start band carries a railroad's colour. */
async function bandedCities(page: Page, railroadId: string): Promise<string[]> {
    const cities = await board(page)
        .locator(`[data-city-marks]:has([data-band-colour="${railroadId}"])`)
        .evaluateAll((groups) => groups.map((group) => group.getAttribute('data-city-marks') ?? ''))
    return cities.toSorted()
}

/** A city's id from its name in a lit hex's accessible name: "Kansas City" is `city.usa.kansas-city`. */
function cityIdOf(name: string): string {
    return `city.usa.${name.toLowerCase().replaceAll(' ', '-')}`
}

test("Round 3 shows Yellow's start cities to every seat, whoever acts", async ({ page }) => {
    // Round 1: Yellow is printed in Chicago's band alone.
    await openScenario(page, 'First share')
    expect(await bandedCities(page, 'railroad.yellow')).toEqual(['city.usa.chicago'])

    // Round 3, Ben decides on a share; nobody builds, yet Yellow joins the westernmost cities'
    // bands for all (R-4.2.3). Purple, not yet available, joins none.
    await openScenario(page, 'Red supply empty')
    expect(await page.evaluate(() => window.rtrSession.gameState.activePlayerIds)).toEqual(['p2'])
    expect((await bandedCities(page, 'railroad.yellow')).length).toBeGreaterThan(1)
    await expect(board(page).locator('[data-start-cue]')).toHaveCount(0)

    // In Ada's building turn the bands name the same cities her lit Yellow starts do.
    await openScenario(page, 'Yellow starts')
    const yellowStarts = (await litLabels(page))
        .filter((label) => /start Yellow/.test(label))
        .map((label) => cityIdOf(label.split(':')[0] ?? ''))
        .toSorted()
    expect(yellowStarts).toContain('city.usa.chicago')
    expect(yellowStarts.length).toBeGreaterThan(1)
    expect(await bandedCities(page, 'railroad.yellow')).toEqual(yellowStarts)

    // Ada starts Yellow in Chicago: Yellow has a cube on the map, so only its printed band stays.
    await pressHex(page, litHexAt(page, 'hex.usa.5-43'))
    const popup = page.getByRole('group', { name: 'Chicago: which railroad?', exact: true })
    if (await popup.isVisible()) {
        await popup.getByRole('button', { name: /^Start Yellow, / }).click()
    }
    await expect.poll(() => bandedCities(page, 'railroad.yellow')).toEqual(['city.usa.chicago'])
})

test('Lit hexes draw nothing of the railroads that may build there', async ({ page }) => {
    await openScenario(page, 'First placement')
    // R-4.2.1: Red may start in each of the six East Coast cities; each is a hole in the scrim,
    // with no ghost cube, ring or pip in it: its accessible name says the railroad.
    await expect(litHexes(page)).toHaveCount(6)
    for (const label of await litLabels(page)) expect(label).toMatch(/: start Red$/)
    await expect(board(page).locator('g.scrim path')).toHaveCount(1)
    await expect(board(page).locator('[data-ghost]')).toHaveCount(0)
    await expect(board(page).locator('g.picks circle')).toHaveCount(0)
    await expect(board(page).locator('g.picks [data-ring]')).toHaveCount(0)
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

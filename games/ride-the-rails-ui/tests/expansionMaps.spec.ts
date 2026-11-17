import { expect, test, type Page } from '@playwright/test'
import {
    activePlayerId,
    board,
    collectPageErrors,
    litHexAt,
    litHexes,
    moneyOf,
    openScenario,
    pressHex,
    settled
} from './helpers.js'

// R-8: each expansion map's table renders, its building offer lights the legal hexes, and a
// placement goes through, at the desktop (1440 × 900) and phone (390 × 844) sizes.
collectPageErrors()

test.beforeEach(async ({ page }, testInfo) => {
    await page.setViewportSize(
        testInfo.project.use.hasTouch ? { width: 390, height: 844 } : { width: 1440, height: 900 }
    )
})

/** The railroads standing in a hex, in placement order. */
function trackIn(page: Page, hexId: string): Promise<string[]> {
    return page.evaluate((id) => {
        const track: Record<string, string[] | undefined> = window.rtrSession.gameState.track
        return track[id] ?? []
    }, hexId)
}

/** The lit hexes' map positions. */
function litHexIds(page: Page): Promise<string[]> {
    return litHexes(page).evaluateAll((hexes) =>
        hexes.map((hex) => hex.getAttribute('data-hex-id') ?? '')
    )
}

/** Australia's long-distance hexes, then Perth's and Brisbane's (R-8.2). */
const LONG_DISTANCE = [
    'hex.au.2-12',
    'hex.au.1-13',
    'hex.au.3-13',
    'hex.au.34-8',
    'hex.au.0-12',
    'hex.au.34-6'
]

test('Australia: a long-distance placement ends the turn (R-8.2)', async ({ page }) => {
    await openScenario(page, 'Australia perth chain')
    await expect(page.getByRole('group', { name: 'Map of Australia' })).toBeVisible()
    await expect(board(page).locator('[data-alps-hatch]')).toHaveCount(1)
    // A buffer stop in each of the four long-distance hexes, and in Perth and Brisbane.
    await expect(board(page).locator('[data-buffer-stop]')).toHaveCount(6)
    for (const hexId of LONG_DISTANCE) {
        await expect(board(page).locator(`[data-buffer-stop="${hexId}"]`), hexId).toHaveCount(1)
    }
    // Each one's stop bar is the impassable sides' red.
    const bars = board(page).locator('[data-buffer-stop] rect')
    await expect(bars).toHaveCount(6)
    for (const fill of await bars.evaluateAll((rects) =>
        rects.map((rect) => getComputedStyle(rect).fill)
    )) {
        expect(fill).toBe('rgb(235, 0, 0)')
    }
    // Every long-distance hex has a side on the sea, so its 1 stands there, as Perth's does.
    await expect(board(page).locator('[data-limit-in-hex]')).toHaveCount(0)
    await expect(board(page).locator('[data-limit-in-sea]')).toHaveCount(6)

    const lit = await litHexIds(page)
    // Orange may enter the chain's next long-distance hex, its turn's first placement; never the
    // one past it, which touches no Orange track.
    expect(lit).toContain('hex.au.2-12')
    expect(lit).not.toContain('hex.au.1-13')
    expect(lit.length).toBeGreaterThan(3)
    expect(await activePlayerId(page)).toBe('p1')
    // Its name says the placement ends the turn; no other lit hex's does.
    await expect(litHexAt(page, 'hex.au.2-12')).toHaveAccessibleName(
        /: place Orange, ends the turn$/
    )
    for (const hexId of lit.filter((id) => !LONG_DISTANCE.includes(id))) {
        await expect(litHexAt(page, hexId), hexId).not.toHaveAccessibleName(/ends the turn/)
    }

    await pressHex(page, litHexAt(page, 'hex.au.2-12'))
    await expect.poll(() => trackIn(page, 'hex.au.2-12')).toEqual(['railroad.orange'])
    await expect.poll(() => activePlayerId(page)).not.toBe('p1')
})

test('Australia: a long-distance hex’s 1 stands in the sea beside it, over no hex (R-8.2)', async ({
    page
}) => {
    await openScenario(page, 'Australia perth chain')
    await settled(page)
    for (const hexId of ['hex.au.2-12', 'hex.au.1-13', 'hex.au.3-13', 'hex.au.34-8']) {
        const mark = board(page).locator(`[data-limit-in-sea="${hexId}"]`)
        await expect(mark).toHaveCount(1)
        await expect(mark.locator('text')).toHaveText('1')
        // The mark's four corners, in board units, fall in no hex on the board.
        const corners = await mark.evaluate((element) => {
            if (!(element instanceof SVGGraphicsElement)) return -1
            const { e, f } = element.transform.baseVal.consolidate()?.matrix ?? { e: 0, f: 0 }
            const square = element.querySelector('rect')?.getBBox()
            if (!square) return -1
            const hexes = [...document.querySelectorAll<SVGPolygonElement>('polygon[data-hex-id]')]
            return [
                [square.x, square.y],
                [square.x + square.width, square.y],
                [square.x, square.y + square.height],
                [square.x + square.width, square.y + square.height]
            ].filter(([x = 0, y = 0]) =>
                hexes.every((hex) => !hex.isPointInFill(new DOMPoint(e + x, f + y)))
            ).length
        })
        expect(corners, hexId).toBe(4)
        await expect(board(page).locator(`[data-limit-in-hex="${hexId}"]`)).toHaveCount(0)
    }
})

test('Australia: Perth and Brisbane draw no start band, as no railroad starts there (R-8.2)', async ({
    page
}) => {
    await openScenario(page, 'Australia perth chain')
    await settled(page)
    for (const cityId of ['city.au.perth', 'city.au.brisbane']) {
        const city = board(page).locator(`[data-city-marks="${cityId}"]`)
        await expect(city, cityId).toHaveCount(1)
        await expect(city.locator('[data-start-band]'), cityId).toHaveCount(0)
        await expect(city.locator('[data-band-colour]'), cityId).toHaveCount(0)
    }
    // A city printed in Purple and Black keeps its band.
    const brokenHill = board(page).locator('[data-city-marks="city.au.broken-hill"]')
    await expect(brokenHill.locator('[data-band-colour]')).toHaveCount(2)
    const lit = await litHexIds(page)
    expect(lit).not.toContain('hex.au.0-12')
    expect(lit).not.toContain('hex.au.34-6')
})

for (const [map, scenario] of [
    ['the USA', 'First share'],
    ['Australia', 'Australia perth chain'],
    ['Canada', 'Canada toronto'],
    ['France', 'France paris ring'],
    ['Germany', 'Germany berlin']
] as const) {
    test(`${map}: the start legend holds its rows inside its card`, async ({ page }) => {
        await openScenario(page, scenario)
        const overflow = await board(page)
            .locator('[data-start-legend]')
            .evaluate((legend) => {
                const card = legend.querySelector('rect')?.getBBox()
                if (!card) return ['no card']
                return [...legend.querySelectorAll('text')].flatMap((text) => {
                    const box = text.getBBox()
                    // The card's padding, 16, stays clear on the right as on the left.
                    return box.x + box.width <= card.x + card.width - 16
                        ? []
                        : [`${text.textContent} ends at ${box.x + box.width}`]
                })
            })
        expect(overflow).toEqual([])
    })
}

test('Canada: no pick is offered across an impassable side (R-8.3)', async ({ page }) => {
    await openScenario(page, 'Canada toronto')
    await expect(page.getByRole('group', { name: 'Map of Canada' })).toBeVisible()
    await expect(board(page).locator('[data-impassable-sides] path')).toHaveCount(2)
    await expect(board(page).locator('g.bonuses [data-bonus-text="$3/$2"]')).toHaveCount(1)
    expect(await trackIn(page, 'hex.ca.11-21')).toEqual([
        'railroad.blue',
        'railroad.red',
        'railroad.purple'
    ])

    // Purple stands in the hex beside Toronto: Hamilton, across a side open to it, lights; the
    // hex past its impassable south side does not, though nothing else stands there.
    const lit = await litHexIds(page)
    expect(lit).toContain('hex.ca.9-23')
    expect(lit).toContain('hex.ca.10-22')
    expect(lit).not.toContain('hex.ca.10-24')
    expect(await trackIn(page, 'hex.ca.10-24')).toEqual([])

    await pressHex(page, litHexAt(page, 'hex.ca.9-23'))
    await expect.poll(() => trackIn(page, 'hex.ca.9-23')).toEqual(['railroad.purple'])
    await expect.poll(() => litHexIds(page)).not.toContain('hex.ca.9-23')
})

/** The screen point a little inside `cityHexId` from the middle of the side it shares with `otherHexId`. */
function sidePoint(page: Page, cityHexId: string, otherHexId: string) {
    return board(page).evaluate(
        (svg, [cityId, otherId]) => {
            const corners = (id: string) => {
                const hit = svg.querySelector(`g.hits [data-hex-id="${id}"]`)
                const points = hit?.getAttribute('points')?.trim().split(/\s+/) ?? []
                return points.map((pair) => pair.split(',').map(Number))
            }
            const city = corners(cityId ?? '')
            const shared = corners(otherId ?? '').filter(([x, y]) =>
                city.some(
                    ([cx, cy]) => Math.hypot((cx ?? 0) - (x ?? 0), (cy ?? 0) - (y ?? 0)) < 0.5
                )
            )
            const centre = city.reduce(
                ([sx, sy], [x, y]) => [sx + (x ?? 0) / city.length, sy + (y ?? 0) / city.length],
                [0, 0]
            )
            const mid = shared.reduce(
                ([sx, sy], [x, y]) => [sx + (x ?? 0) / 2, sy + (y ?? 0) / 2],
                [0, 0]
            )
            // 2.5 units in from the side: on the line and on the city's band.
            if (!(svg instanceof SVGSVGElement)) throw new Error('the board is not an SVG')
            const toward = Math.hypot(centre[0] - mid[0], centre[1] - mid[1])
            const screen = new DOMPoint(
                mid[0] + ((centre[0] - mid[0]) / toward) * 2.5,
                mid[1] + ((centre[1] - mid[1]) / toward) * 2.5
            ).matrixTransform(svg.getScreenCTM() ?? undefined)
            return { shared: shared.length, x: screen.x, y: screen.y }
        },
        [cityHexId, otherHexId]
    )
}

/** What is drawn at a screen point, top first, each shape named by its layer. */
function drawnAt(page: Page, x: number, y: number) {
    return board(page).evaluate(
        (svg, [px, py]) => {
            // Every shape takes the hit test for this read only, so the stack is the paint order.
            const style = document.createElement('style')
            style.textContent = '[data-map-board] * { pointer-events: visiblePainted !important; }'
            document.head.append(style)
            const stack = document.elementsFromPoint(px ?? 0, py ?? 0)
            style.remove()
            const layers: [string, string][] = [
                ['[data-impassable-sides]', 'impassable'],
                ['g.hits', 'hits'],
                ['g.picks', 'picks'],
                ['g.flights', 'flights'],
                ['[data-start-band]', 'band'],
                ['g.cities', 'city'],
                ['g.scrim', 'scrim'],
                ['g.ground', 'ground']
            ]
            return stack
                .filter((element) => element !== svg && svg.contains(element))
                .map(
                    (element) =>
                        layers.find(([selector]) => element.closest(selector))?.[1] ??
                        element.tagName
                )
        },
        [x, y]
    )
}

test('Canada: an impassable side is drawn over the banded city beside it (R-8.3)', async ({
    page
}) => {
    await openScenario(page, 'Canada toronto')
    await settled(page)
    // Québec City's orange and black band runs along its impassable south-west side. The phone's
    // board rests zoomed in, so it is zoomed out until that side is on screen.
    const zoomOut = page.getByRole('button', { name: 'Zoom out', exact: true })
    const view = page.viewportSize()
    const onBoard = async () => {
        const { x, y } = await sidePoint(page, 'hex.ca.30-4', 'hex.ca.29-5')
        if (!view || x < 0 || y < 0 || x > view.width || y > view.height) return false
        return page.evaluate(
            ([px, py]) =>
                document.elementFromPoint(px ?? 0, py ?? 0)?.closest('[data-map-board]') !== null,
            [x, y]
        )
    }
    for (let step = 0; step < 6 && !(await onBoard()); step++) {
        if (test.info().project.use.hasTouch) await zoomOut.tap()
        else await zoomOut.click()
        await settled(page)
    }
    await expect.poll(onBoard).toBe(true)
    const side = await sidePoint(page, 'hex.ca.30-4', 'hex.ca.29-5')
    expect(side.shared).toBe(2)

    // Under the hit targets, the line is the topmost thing drawn there, over the band and scrim.
    const drawn = (await drawnAt(page, side.x, side.y)).filter(
        (layer) => !['hits', 'picks', 'flights'].includes(layer)
    )
    expect(drawn[0]).toBe('impassable')
    expect(drawn).toContain('band')
    expect(drawn.indexOf('band')).toBeGreaterThan(drawn.lastIndexOf('impassable'))

    // It takes no presses: the hex's own hit target is still what a press there finds.
    await expect(board(page).locator('[data-impassable-sides]')).toHaveCSS('pointer-events', 'none')
    const pressed = await page.evaluate(
        ([px, py]) => document.elementFromPoint(px ?? 0, py ?? 0)?.getAttribute('data-hex-id'),
        [side.x, side.y]
    )
    expect(pressed).toBe('hex.ca.30-4')
})

test('Canada: a city printed with Black alone has the USA’s thin Black band (R-4.2.5, R-8)', async ({
    page
}) => {
    await openScenario(page, 'Canada toronto')
    await settled(page)
    /**
     * Whether the city's first band colour covers a point this far in from its hex's top edge, a
     * little right of the edge's middle, where a two-colour band's first half starts.
     */
    const bandCovers = (cityId: string, inset: number) =>
        board(page)
            .locator(`[data-city-marks="${cityId}"] [data-band-colour]`)
            .first()
            .evaluate((band, depth) => {
                if (!(band instanceof SVGPathElement)) return false
                // A flat hex's top edge stands its apothem, 40 × cos 30°, above its centre.
                const apothem = 40 * Math.cos(Math.PI / 6)
                return band.isPointInFill(new DOMPoint(6, -apothem + depth))
            }, inset)

    // Sudbury: Black alone, one ring 2.4 thick, as a plain city on the USA.
    const sudbury = board(page).locator('[data-city-marks="city.ca.sudbury"]')
    await expect(sudbury.locator('[data-band-colour]')).toHaveCount(1)
    await expect(sudbury.locator('[data-band-colour="railroad.black"]')).toHaveCount(1)
    expect(await bandCovers('city.ca.sudbury', 1)).toBe(true)
    expect(await bandCovers('city.ca.sudbury', 4)).toBe(false)
    // Montréal, printed Blue as well as Black, keeps its band as printed, 6.4 thick.
    const montreal = board(page).locator('[data-city-marks="city.ca.montreal"]')
    await expect(montreal.locator('[data-band-colour]')).toHaveCount(2)
    expect(await bandCovers('city.ca.montreal', 4)).toBe(true)
})

test('France: Paris lights with its $10, and nothing crosses the estuary (R-8.4)', async ({
    page
}) => {
    await openScenario(page, 'France paris ring')
    await expect(page.getByRole('group', { name: 'Map of France' })).toBeVisible()
    await expect(board(page).locator('[data-entry-ring]')).toHaveCount(1)
    await expect(board(page).locator('[data-impassable-sides] path')).toHaveCount(2)
    // Six entry hexes, the four border cities and Paris's 6, each inside its hex.
    await expect(board(page).locator('[data-limit-in-hex]')).toHaveCount(11)
    await expect(board(page).locator('g.bonuses [data-bonus-text="$10"]')).toHaveCount(1)

    // Orange in Le Havre lights round it, never across the Seine's estuary to Caen.
    const lit = await litHexIds(page)
    expect(lit).toContain('hex.fr.9-7')
    expect(lit).not.toContain('hex.fr.8-8')
    // Red, in the entry hex north of Paris, lights Paris.
    expect(lit).toContain('hex.fr.13-13')

    const before = (await moneyOf(page, 'p1')) ?? 0
    await pressHex(page, litHexAt(page, 'hex.fr.13-13'))
    await expect.poll(() => trackIn(page, 'hex.fr.13-13')).toEqual(['railroad.red'])
    await expect.poll(() => moneyOf(page, 'p1')).toBe(before + 10)
})

test('Germany: Berlin is one city, and Orange builds on a mountain for nothing (R-8.5)', async ({
    page
}) => {
    await openScenario(page, 'Germany berlin')
    await expect(page.getByRole('group', { name: 'Map of Germany' })).toBeVisible()
    const berlin = board(page).locator('[data-city-marks="city.de.berlin"]')
    // One band round both cells: Purple and Black, one path each.
    await expect(berlin.locator('[data-band-colour]')).toHaveCount(2)
    await expect(board(page).locator('g.bonuses [data-bonus-text="$3"]')).toHaveCount(1)
    await expect(board(page).locator('[data-limit-in-hex="city.de.berlin"]')).toHaveCount(1)
    expect(await trackIn(page, 'hex.de.19-17')).toEqual([
        'railroad.red',
        'railroad.blue',
        'railroad.purple'
    ])

    // Orange in München may take the mountain beside it, and says nothing of the limit.
    const mountain = litHexAt(page, 'hex.de.14-50')
    await expect(mountain).toHaveCount(1)
    expect(await mountain.getAttribute('aria-label')).not.toContain('limit')

    await pressHex(page, mountain)
    await expect.poll(() => trackIn(page, 'hex.de.14-50')).toEqual(['railroad.orange'])
    // The turn's limit stands at 8: an Orange mountain uses no mountain.
    await expect
        .poll(() => page.evaluate(() => window.rtrSession.gameState.building?.usedMountain))
        .toBe(false)
    await expect(page.locator('div.action').getByText('1 of 8 placed')).toHaveCount(1)
})

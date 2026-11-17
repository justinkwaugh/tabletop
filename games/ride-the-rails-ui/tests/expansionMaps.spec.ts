import { expect, test, type Page } from '@playwright/test'
import {
    activePlayerId,
    board,
    collectPageErrors,
    litHexAt,
    litHexes,
    moneyOf,
    openScenario,
    pressHex
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

test('Australia: a long-distance placement ends the turn (R-8.2)', async ({ page }) => {
    await openScenario(page, 'Australia perth chain')
    await expect(page.getByRole('group', { name: 'Map of Australia' })).toBeVisible()
    await expect(board(page).locator('[data-alps-hatch]')).toHaveCount(1)
    await expect(board(page).locator('[data-hourglass]')).toHaveCount(4)
    await expect(board(page).locator('[data-limit-in-hex]')).toHaveCount(4)

    const lit = await litHexIds(page)
    // Orange may enter the chain's next long-distance hex, its turn's first placement; never the
    // one past it, which touches no Orange track.
    expect(lit).toContain('hex.au.2-12')
    expect(lit).not.toContain('hex.au.1-13')
    expect(lit.length).toBeGreaterThan(3)
    expect(await activePlayerId(page)).toBe('p1')

    await pressHex(page, litHexAt(page, 'hex.au.2-12'))
    await expect.poll(() => trackIn(page, 'hex.au.2-12')).toEqual(['railroad.orange'])
    await expect.poll(() => activePlayerId(page)).not.toBe('p1')
})

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

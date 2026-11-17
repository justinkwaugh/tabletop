import { expect, test, type Page } from '@playwright/test'
import {
    activePlayerId,
    board,
    collectPageErrors,
    litHexAt,
    litHexes,
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

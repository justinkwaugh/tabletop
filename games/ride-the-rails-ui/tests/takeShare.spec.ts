import { expect, test } from '@playwright/test'
import {
    activePlayerId,
    board,
    collectPageErrors,
    flyersDuring,
    openScenario,
    undo
} from './helpers.js'

// The contract's verification scenarios for Take a share (R-3.1), each at desktop and phone width.
collectPageErrors()

test('1. Round 1, 4 seats, phase 1: take Red, then undo it', async ({ page }) => {
    await openScenario(page, 'First share')
    // R-3.1: phase 1 goes in reverse turn order, so the last seat decides first.
    expect(await activePlayerId(page)).toBe('p4')
    await expect(page.getByText("Dell - It's your turn")).toBeVisible()

    // R-1.4: Red and Blue from round 1, the others from their rounds.
    const red = page.getByRole('button', { name: 'Red, 27 left', exact: true })
    await expect(red).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Blue, 27 left', exact: true })).toBeEnabled()
    for (const [railroad, round] of [
        ['Orange', 2],
        ['Yellow', 3],
        ['Purple', 4],
        ['Black', 5]
    ] as const) {
        await expect(
            page.getByRole('button', { name: `${railroad}, from round ${round}`, exact: true })
        ).toBeDisabled()
    }
    // No pick is open, so the map has no scrim and no lit hex.
    await expect(board(page).locator('g.scrim path')).toHaveCount(0)
    await expect(board(page).locator('[data-hex-id][role="button"]')).toHaveCount(0)

    const flyers = await flyersDuring(page, () => red.click())
    expect(flyers).toContain('locomotive')
    expect(await activePlayerId(page)).toBe('p3')
    await expect(page.getByRole('button', { name: /^Red, 26 left/ })).toBeVisible()
    await expect(
        page
            .getByRole('region', { name: 'Dell, 4th' })
            .getByRole('button', { name: 'Red: 1 share' })
    ).toBeVisible()

    await undo(page)
    expect(await activePlayerId(page)).toBe('p4')
    await expect(page.getByRole('button', { name: 'Red, 27 left', exact: true })).toBeEnabled()
    await expect(page.getByRole('region', { name: 'Dell, 4th' })).toContainText('No shares')
})

test('2. Empty supply: Red is disabled, Blue is not', async ({ page }) => {
    await openScenario(page, 'Red supply empty')
    expect(await activePlayerId(page)).toBe('p2')
    // R-3.1: a railroad with no locomotives left offers no share.
    await expect(
        page.getByRole('button', { name: 'Red, none left · you 2', exact: true })
    ).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Blue, 22 left', exact: true })).toBeEnabled()
})

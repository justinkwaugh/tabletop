import { expect, test, type Locator, type Page } from '@playwright/test'
import type { RailroadId } from '@tabletop/ride-the-rails'
import { activePlayerId, collectPageErrors, openScenario, settled } from './helpers.js'

// Contract, Take a share and Build: full screen's dialog is modal, so everything outside it (the
// railroad cards above the board among it) is unreachable; the action area in its toolbar offers
// the piles itself, at every width.
collectPageErrors()

function onPhone(): boolean {
    return test.info().project.use.isMobile === true
}

async function enterFullScreen(page: Page): Promise<Locator> {
    await page.getByRole('button', { name: 'Enter full screen' }).click()
    const dialog = page.getByRole('dialog', { name: 'Full screen view' })
    await expect(dialog).toBeVisible()
    await settled(page)
    return dialog
}

/** A seat's shares of a railroad, from the game state. */
function sharesOf(page: Page, playerId: string, railroadId: RailroadId) {
    return page.evaluate(
        ({ seat, railroad }) =>
            window.rtrSession.gameState.players
                .find((player) => player.playerId === seat)
                ?.sharesOf(railroad) ?? 0,
        { seat: playerId, railroad: railroadId }
    )
}

/** Presses Tab until the focused element is `target`, at most `limit` times. */
async function tabTo(page: Page, target: Locator, limit = 40): Promise<boolean> {
    for (let step = 0; step < limit; step++) {
        await page.keyboard.press('Tab')
        if (await target.evaluate((node) => node === document.activeElement)) return true
    }
    return false
}

test('Full screen at desktop width: the share buttons are in the dialog, by keyboard too', async ({
    page
}) => {
    test.skip(onPhone(), 'The phone test below covers the phone width.')
    await page.setViewportSize({ width: 1440, height: 900 })
    await openScenario(page, 'First share')
    expect(await activePlayerId(page)).toBe('p4')
    const dialog = await enterFullScreen(page)

    const railroads = dialog.getByRole('group', { name: 'Railroads' })
    const red = railroads.getByRole('button', { name: 'Take a Red share, 27 left', exact: true })
    await expect(red).toBeEnabled()
    await expect(
        railroads.getByRole('button', { name: 'Take a Blue share, 27 left', exact: true })
    ).toBeEnabled()

    expect(await tabTo(page, red)).toBe(true)
    await page.keyboard.press('Enter')

    await expect
        .poll(() =>
            page.evaluate(() => {
                const action = window.rtrSession.actions.at(-1)
                return action && 'railroadId' in action
                    ? `${action.playerId} ${action.railroadId}`
                    : undefined
            })
        )
        .toBe('p4 railroad.red')
    expect(await sharesOf(page, 'p4', 'railroad.red')).toBe(1)
    expect(await activePlayerId(page)).toBe('p3')
    await expect(dialog).toBeVisible()
    await expect(
        railroads.getByRole('button', { name: 'Take a Red share, 26 left', exact: true })
    ).toBeVisible()
})

test('Full screen at desktop width: the build panel holds the cards, a press spotlights', async ({
    page
}) => {
    test.skip(onPhone(), 'The phone build panel has its cards at any size.')
    await page.setViewportSize({ width: 1440, height: 900 })
    await openScenario(page, 'First placement')
    const dialog = await enterFullScreen(page)

    const card = dialog.getByRole('group', { name: 'Railroads' }).getByRole('button').first()
    await expect(card).toHaveAttribute('aria-pressed', 'false')
    await card.click()
    await expect(card).toHaveAttribute('aria-pressed', 'true')
    await expect
        .poll(() => page.evaluate(() => window.rtrSession.spotlightRailroadId))
        .not.toBe(undefined)
    // The count and Skip on one line; the turn can be finished without leaving full screen.
    await expect(dialog.getByText('0 / 5', { exact: true })).toBeVisible()
    const skip = dialog.getByRole('button', { name: 'Skip', exact: true })
    await expect(skip).toBeEnabled()
    await skip.click()
    await expect.poll(() => activePlayerId(page)).toBe('p2')
    await expect(dialog).toBeVisible()
})

test('Outside full screen at desktop width: the cards are the share buttons, the panel has none', async ({
    page
}) => {
    test.skip(onPhone(), 'A phone has no cards.')
    await page.setViewportSize({ width: 1440, height: 900 })
    await openScenario(page, 'First share')
    // One Red share button: the card's. The action panel keeps only its prompt.
    await expect(
        page.getByRole('button', { name: 'Take a Red share, 27 left', exact: true })
    ).toHaveCount(1)
    const panel = page.locator('div.action')
    await expect(panel.getByText('Select a share below', { exact: true })).toBeVisible()
    await expect(panel.getByRole('button')).toHaveCount(0)
})

test('Full screen on a phone: the share buttons stay in the dialog', async ({ page }) => {
    test.skip(!onPhone(), 'The desktop tests above cover the desktop width.')
    await openScenario(page, 'First share')
    const dialog = await enterFullScreen(page)

    const red = dialog
        .getByRole('group', { name: 'Railroads' })
        .getByRole('button', { name: 'Take a Red share, 27 left', exact: true })
    await red.click()
    await expect.poll(() => sharesOf(page, 'p4', 'railroad.red')).toBe(1)
    expect(await activePlayerId(page)).toBe('p3')
})

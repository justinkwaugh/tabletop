import { expect, test, type Page } from '@playwright/test'
import {
    activePlayerId,
    board,
    collectPageErrors,
    flyersDuring,
    openScenario,
    settled,
    undo
} from './helpers.js'

/** The last share taken, as its seat and railroad. */
function lastTakenShare(page: Page) {
    return page.evaluate(() => {
        const action = window.rtrSession.actions.at(-1)
        return action && 'railroadId' in action
            ? { playerId: action.playerId, railroadId: action.railroadId }
            : undefined
    })
}

// The contract's verification scenarios for Take a share (R-3.1), each at desktop and phone width.
collectPageErrors()

test('1. Round 1, 4 seats, phase 1: take Red, then undo it', async ({ page }) => {
    await openScenario(page, 'First share')
    // R-3.1: phase 1 goes in reverse turn order, so the last seat decides first.
    expect(await activePlayerId(page)).toBe('p4')
    await expect(page.getByText("Dell - It's your turn")).toBeVisible()
    await expect(page.getByText('Select a share below', { exact: true })).toBeVisible()

    // R-1.4: Red and Blue from round 1; the others are not shown until their rounds.
    const red = page.getByRole('button', { name: 'Take a Red share, 27 left', exact: true })
    await expect(red).toBeEnabled()
    await expect(
        page.getByRole('button', { name: 'Take a Blue share, 27 left', exact: true })
    ).toBeEnabled()
    for (const railroad of ['Orange', 'Yellow', 'Purple', 'Black']) {
        await expect(page.getByRole('button', { name: new RegExp(railroad) })).toHaveCount(0)
    }
    // No pick is open, so the map has no scrim and no lit hex.
    await expect(board(page).locator('g.scrim path')).toHaveCount(0)
    await expect(board(page).locator('[data-hex-id][role="button"]')).toHaveCount(0)

    const flyers = await flyersDuring(page, () => red.click())
    expect(flyers).toContain('locomotive')
    expect(await activePlayerId(page)).toBe('p3')
    await expect(page.getByRole('button', { name: 'Take a Red share, 26 left' })).toBeVisible()
    const dell = page.getByRole('region', { name: 'Dell', exact: true })
    await expect(dell.getByRole('button', { name: 'Red: 1 share' })).toBeAttached()

    await undo(page)
    expect(await activePlayerId(page)).toBe('p4')
    await expect(
        page.getByRole('button', { name: 'Take a Red share, 27 left', exact: true })
    ).toBeEnabled()
    await expect(dell.getByRole('group', { name: 'Shares' }).getByRole('button')).toHaveCount(0)
})

test('2. Empty supply: Red is disabled, Blue is not', async ({ page }) => {
    await openScenario(page, 'Red supply empty')
    expect(await activePlayerId(page)).toBe('p2')
    // R-3.1: a railroad with no locomotives left offers no share.
    const red = page.getByRole('button', { name: 'Red: none left, you hold 2', exact: true })
    await expect(red).toBeDisabled()
    // Its cube is dashed, its count 0.
    await expect(red.locator('.supply.empty')).toHaveCount(1)
    await expect(red).toHaveText(/^\s*0\s*$/)
    await expect(
        page.getByRole('button', { name: 'Take a Blue share, 22 left', exact: true })
    ).toBeEnabled()
})

const onPhone = () => test.info().project.use.isMobile === true

/** Every railroad's name, as a word anywhere on the table. */
const RAILROAD_NAME = /\b(Red|Blue|Orange|Yellow|Purple|Black)\b/

test('The share buttons are a cube and a count with no words: a tap takes that share', async ({
    page
}) => {
    await openScenario(page, 'Red supply empty')
    expect(await activePlayerId(page)).toBe('p2')
    // On desktop the railroad cards are the buttons; on a phone the action panel's row.
    const buttons = page.getByRole('group', { name: 'Railroads' }).getByRole('button')
    await expect(buttons).toHaveCount(4)
    for (const button of await buttons.all()) {
        const name = await button.getAttribute('aria-label')
        expect(name).toMatch(/^(Take an? \w+ share, \d+ left|\w+: none left)/)
        await expect(button.locator('.supply .cube')).toHaveCount(1)
        // The count is the button's only text, the number its name gives.
        const left = /, (\d+) left/.exec(name ?? '')?.[1] ?? '0'
        expect((await button.innerText()).trim()).toBe(left)
    }
    // R-3.1: on a phone the seat's own shares are dots under the count; the desktop cards leave
    // them to the seat cards.
    const red = page.getByRole('button', { name: /^Red: none left, you hold 2/ })
    await expect(red.locator('.dot')).toHaveCount(onPhone() ? 2 : 0)
    // No railroad's name is drawn anywhere in the table during the share step.
    const table = page.locator('[data-rtr-table]')
    expect(await table.innerText()).not.toMatch(RAILROAD_NAME)

    const blue = page.getByRole('button', { name: /^Take a Blue share, 22 left/ })
    await (test.info().project.use.hasTouch ? blue.tap() : blue.click())
    await settled(page)
    expect(await lastTakenShare(page)).toEqual({ playerId: 'p2', railroadId: 'railroad.blue' })
    await expect(
        page
            .getByRole('region', { name: 'Ben', exact: true })
            .getByRole('button', { name: /^Blue: / })
    ).toBeAttached()
})

test("1. Round 1: the seat card counts the share as the share's locomotive lands", async ({
    page
}) => {
    await openScenario(page, 'First share')
    const card = page.getByRole('region', { name: 'Dell', exact: true })
    const held = card.getByRole('group', { name: 'Shares' }).getByRole('button')
    await expect(held).toHaveCount(0)

    // Each frame of the motion: whether the share's locomotive is still drawn, and how many of
    // Dell's six share slots hold a share.
    await card.evaluate((element) => {
        const frames: string[] = []
        Reflect.set(window, 'rtrFrames', frames)
        const watch = () => {
            const flying = window.rtrSession.flights.flyers.some((flyer) => flyer.key === 'share')
            const filled = element.querySelectorAll('.slots .held').length
            frames.push(`${flying ? 'flying' : 'still'}: ${filled}`)
            requestAnimationFrame(watch)
        }
        watch()
    })
    await page.getByRole('button', { name: 'Take a Red share, 27 left', exact: true }).click()
    await settled(page)
    const frames = await page.evaluate(() => {
        const seen: unknown = Reflect.get(window, 'rtrFrames')
        return Array.isArray(seen) ? seen.map(String) : []
    })

    // R-3.1: while the locomotive lifts and flies the card still shows no share; the share
    // appears in its slot as the locomotive lands on it, while the locomotive fades, and stays.
    const flying = frames.filter((frame) => frame.startsWith('flying'))
    expect(flying.at(0)).toBe('flying: 0')
    expect(flying.at(-1)).toBe('flying: 1')
    expect(frames.at(-1)).toBe('still: 1')
    await expect(held).toHaveCount(1)
    await expect(card.getByRole('button', { name: 'Red: 1 share' })).toBeAttached()
})

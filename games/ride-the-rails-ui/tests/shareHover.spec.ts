import { expect, test, type Locator, type Page } from '@playwright/test'
import { activePlayerId, board, collectPageErrors, openScenario, settled } from './helpers.js'

// The contract's Take a share: on desktop a mouse over an enabled share button shows the pointer,
// rings the button in the accent colour and spotlights its railroad, as a railroad card does on
// another seat's turn. A press takes the share and holds no spotlight.
collectPageErrors()

const onPhone = () => test.info().project.use.isMobile === true

function shareButtons(page: Page): Locator {
    return page.getByRole('group', { name: 'Railroads' }).getByRole('button')
}

/** The button's cursor, and whether its shadow carries the 2 px accent ring. */
function hoverLook(button: Locator) {
    return button.evaluate((element) => {
        const probe = document.createElement('span')
        probe.style.color = 'var(--rtr-accent)'
        element.append(probe)
        const accent = getComputedStyle(probe).color
        probe.remove()
        const style = getComputedStyle(element)
        return {
            cursor: style.cursor,
            ringed: style.boxShadow.includes(`${accent} 0px 0px 0px 2px`)
        }
    })
}

const spotlight = (page: Page) => page.evaluate(() => window.rtrSession.spotlightRailroadId)

/** The board's cubes drawn faded by the spotlight. */
const fadedCubes = (page: Page) => board(page).locator('g.track > g[opacity="0.2"]').count()

test('Hovering a share button points, rings it and spotlights its railroad; leaving ends both', async ({
    page
}) => {
    test.skip(onPhone(), 'A phone has no pointer to hover with.')
    await page.setViewportSize({ width: 1440, height: 900 })
    await openScenario(page, 'Red supply empty')
    expect(await activePlayerId(page)).toBe('p2')
    const blue = shareButtons(page).and(page.getByRole('button', { name: /^Take a Blue share/ }))
    await expect(blue).toBeEnabled()
    expect(await hoverLook(blue)).toEqual({ cursor: 'pointer', ringed: false })
    expect(await fadedCubes(page)).toBe(0)

    await blue.hover()
    await expect.poll(() => spotlight(page)).toBe('railroad.blue')
    expect(await page.evaluate(() => window.rtrSession.heldRailroadId)).toBeUndefined()
    expect(await hoverLook(blue)).toEqual({ cursor: 'pointer', ringed: true })
    expect(await fadedCubes(page)).toBeGreaterThan(0)

    await page.mouse.move(0, 0)
    await expect.poll(() => spotlight(page)).toBe(undefined)
    expect(await hoverLook(blue)).toEqual({ cursor: 'pointer', ringed: false })
    expect(await fadedCubes(page)).toBe(0)
})

test('Hovering the empty, disabled share button does nothing', async ({ page }) => {
    test.skip(onPhone(), 'A phone has no pointer to hover with.')
    await page.setViewportSize({ width: 1440, height: 900 })
    await openScenario(page, 'Red supply empty')
    const red = shareButtons(page).and(page.getByRole('button', { name: /^Red: none left/ }))
    await expect(red).toBeDisabled()

    await red.hover({ force: true })
    // A pointer move is a task; give its events a frame to arrive before reading.
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(done)))
    expect(await spotlight(page)).toBeUndefined()
    expect((await hoverLook(red)).cursor).not.toBe('pointer')
    expect((await hoverLook(red)).ringed).toBe(false)
    expect(await fadedCubes(page)).toBe(0)
})

test('Pressing a hovered share button takes the share and leaves no spotlight', async ({
    page
}) => {
    test.skip(onPhone(), 'A phone has no pointer to hover with.')
    await page.setViewportSize({ width: 1440, height: 900 })
    await openScenario(page, 'First share')
    expect(await activePlayerId(page)).toBe('p4')
    const red = page.getByRole('button', { name: 'Take a Red share, 27 left', exact: true })
    await red.hover()
    await expect.poll(() => spotlight(page)).toBe('railroad.red')

    await red.click()
    await settled(page)
    // R-3.1: the next seat takes a share, and the mouse still rests on Red's button.
    expect(await activePlayerId(page)).toBe('p3')
    const next = page.getByRole('button', { name: 'Take a Red share, 26 left', exact: true })
    await expect(next).toBeEnabled()
    expect(await spotlight(page)).toBeUndefined()
    expect(await page.evaluate(() => window.rtrSession.heldRailroadId)).toBeUndefined()
    expect((await hoverLook(next)).ringed).toBe(false)
})

test('On a phone the share panel is as before: a tap takes the share and spotlights nothing', async ({
    page
}) => {
    test.skip(!onPhone(), 'The desktop cards are the share buttons.')
    await page.setViewportSize({ width: 390, height: 844 })
    await openScenario(page, 'First share')
    const red = shareButtons(page).and(
        page.getByRole('button', { name: 'Take a Red share, 27 left', exact: true })
    )
    await expect(red).toBeEnabled()
    expect((await hoverLook(red)).ringed).toBe(false)

    await red.tap()
    await settled(page)
    expect(await activePlayerId(page)).toBe('p3')
    expect(await spotlight(page)).toBeUndefined()
    const next = shareButtons(page).and(
        page.getByRole('button', { name: 'Take a Red share, 26 left', exact: true })
    )
    await expect(next).toBeEnabled()
    expect((await hoverLook(next)).ringed).toBe(false)
})

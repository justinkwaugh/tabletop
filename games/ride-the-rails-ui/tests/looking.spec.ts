import { expect, test, type Locator, type Page } from '@playwright/test'
import {
    board,
    collectPageErrors,
    litHexAt,
    litLabels,
    openScenario,
    pressHex,
    settled
} from './helpers.js'

// The contract's verification scenario for looking during a pick (Look: hex detail; Coexistence
// and precedence), at desktop and phone width.
collectPageErrors()

/** Any hex at a map position, lit or not. */
function hexAt(page: Page, hexId: string): Locator {
    return board(page).locator(`g.hits polygon[data-hex-id="${hexId}"]`)
}

function hexDetail(page: Page, place: string): Locator {
    return page.getByRole('region', { name: `${place}: hex detail`, exact: true })
}

function trackCount(page: Page): Promise<number> {
    return page.evaluate(
        () =>
            Object.values(window.rtrSession.gameState.track).flatMap((railroads) => railroads)
                .length
    )
}

function detailInSidePanel(page: Page): Promise<boolean> {
    return page.evaluate(() => window.rtrSession.hexDetailInSidePanel)
}

function isPhone(): boolean {
    return test.info().project.use.isMobile === true
}

/** Phones: the East focus, where New York and the lit hexes are on screen at a readable size. */
async function focusEast(page: Page) {
    if (!isPhone()) return
    const east = page.getByRole('button', { name: 'East', exact: true })
    for (let step = 0; step < 6 && !(await east.isVisible()); step++) {
        await page.getByRole('button', { name: 'Zoom out', exact: true }).tap()
        await page.waitForTimeout(300)
    }
    await east.tap()
    await settled(page)
}

const NEW_YORK = 'hex.usa.6-60'
const BOTH = 'hex.usa.10-54'
const RED_ONLY = 'hex.usa.8-54'

test('20. Hex detail during a pick: apart from the railroad popup', async ({ page }) => {
    await openScenario(page, 'Two railroads meet')
    await focusEast(page)
    const lit = await litLabels(page)
    const before = await trackCount(page)

    // U-5: New York is not lit, so a press shows it and changes no stage.
    await pressHex(page, hexAt(page, NEW_YORK))
    await expect(hexDetail(page, 'New York')).toBeAttached()
    expect(await detailInSidePanel(page)).toBe(!isPhone())
    expect(await litLabels(page)).toEqual(lit)
    expect(await page.evaluate(() => window.rtrSession.buildHexId)).toBeUndefined()
    expect(await trackCount(page)).toBe(before)

    // A press on a lit hex picks and closes the detail.
    await pressHex(page, litHexAt(page, BOTH))
    const popup = page.getByRole('group', { name: /: which railroad\?$/ })
    await expect(popup).toBeVisible()
    await expect(hexDetail(page, 'New York')).toHaveCount(0)

    // With the popup open, the detail opens in the side panel (on phones, beside its hex) and the
    // popup stays by its hex.
    await pressHex(page, hexAt(page, NEW_YORK))
    await expect(hexDetail(page, 'New York')).toBeAttached()
    expect(await detailInSidePanel(page)).toBe(!isPhone())
    await expect(hexDetail(page, 'New York')).toBeInViewport()
    await expect(popup).toBeVisible()
    expect(await page.evaluate(() => window.rtrSession.buildHexId)).toBe(BOTH)
    const popupBox = await popup.boundingBox()
    const view = page.viewportSize()
    expect(popupBox).not.toBeNull()
    if (popupBox && view) {
        expect(popupBox.x).toBeGreaterThanOrEqual(0)
        expect(popupBox.x + popupBox.width).toBeLessThanOrEqual(view.width)
    }
    // The two never cover each other.
    const detailBox = await hexDetail(page, 'New York').boundingBox()
    if (popupBox && detailBox) {
        const apart =
            detailBox.x >= popupBox.x + popupBox.width ||
            popupBox.x >= detailBox.x + detailBox.width ||
            detailBox.y >= popupBox.y + popupBox.height ||
            popupBox.y >= detailBox.y + detailBox.height
        expect(apart).toBe(true)
    }

    // The next press on a lit hex places, and closes the detail and the popup.
    await pressHex(page, litHexAt(page, RED_ONLY))
    await settled(page)
    expect(await trackCount(page)).toBe(before + 1)
    await expect(hexDetail(page, 'New York')).toHaveCount(0)
    await expect(popup).toHaveCount(0)
    await expect(page.getByText('1 of 5 placed', { exact: true })).toBeVisible()
})

test('20. Hex detail during a pick on a phone: the card beside its hex is on screen', async ({
    page
}) => {
    test.skip(!isPhone(), 'Desktop shows the side panel beside the board; the test above sees it.')
    await openScenario(page, 'Two railroads meet')
    await focusEast(page)
    await pressHex(page, hexAt(page, NEW_YORK))
    await expect(hexDetail(page, 'New York')).toBeInViewport()
    expect(await detailInSidePanel(page)).toBe(false)
    // Beside its hex: the card's nearest edge is a popup gap from the hex's box.
    const hexBox = await hexAt(page, NEW_YORK).boundingBox()
    const cardBox = await hexDetail(page, 'New York').boundingBox()
    expect(hexBox).not.toBeNull()
    expect(cardBox).not.toBeNull()
    if (hexBox && cardBox) {
        const gapX = Math.max(
            cardBox.x - (hexBox.x + hexBox.width),
            hexBox.x - (cardBox.x + cardBox.width),
            0
        )
        const gapY = Math.max(
            cardBox.y - (hexBox.y + hexBox.height),
            hexBox.y - (cardBox.y + cardBox.height),
            0
        )
        expect(Math.max(gapX, gapY)).toBeLessThanOrEqual(16)
    }
})

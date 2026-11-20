import { expect, test, type Locator, type Page } from '@playwright/test'
import {
    activePlayerId,
    board,
    collectPageErrors,
    litHex,
    litHexes,
    openScenario,
    pressHex,
    settled
} from './helpers.js'

// Contract, Pick conventions: no control floats over a pick target. The map's Ride button takes the
// first clear spot beside the route's last city, and stays hidden while there is none. In Crowded
// chicago a journey from Milwaukee into Chicago lights Detroit on Chicago's east and Cincinnati
// below it, where the button stands on desktop and on a phone. Desktop 1440 × 900, phone 390 × 844.
collectPageErrors()

type Box = { x: number; y: number; width: number; height: number }

const CHICAGO = 'hex.usa.5-43'

function mapRide(page: Page): Locator {
    return page.locator('button[data-map-ride]')
}

function onPhone(): boolean {
    return test.info().project.use.hasTouch === true
}

function apart(a: Box, b: Box): boolean {
    return (
        a.x >= b.x + b.width ||
        b.x >= a.x + a.width ||
        a.y >= b.y + b.height ||
        b.y >= a.y + a.height
    )
}

async function boxOf(locator: Locator): Promise<Box> {
    const box = await locator.boundingBox()
    expect(box).not.toBeNull()
    return box ?? { x: 0, y: 0, width: 0, height: 0 }
}

/** Ada's journey from Milwaukee into Chicago by Orange, at 1440 × 900 or 390 × 844. */
async function rideIntoChicago(page: Page, scenario = 'Crowded chicago') {
    await page.setViewportSize(
        onPhone() ? { width: 390, height: 844 } : { width: 1440, height: 900 }
    )
    await openScenario(page, scenario)
    await pressHex(page, litHex(page, 'Milwaukee: start a journey with its passenger'))
    await pressHex(page, litHex(page, 'Chicago: link by Orange'))
    await expect(litHex(page, 'Detroit: link by Orange')).toBeVisible()
    await expect(litHex(page, 'Cincinnati: link by Yellow')).toBeVisible()
}

/** Zooms out as far as the board goes, where a hex is narrower than the button. */
async function wholeMap(page: Page) {
    const zoomOut = page.getByRole('button', { name: 'Zoom out', exact: true })
    let before = await settled(page)
    for (let step = 0; step < 12; step++) {
        if (onPhone()) await zoomOut.tap()
        else await zoomOut.click()
        await page.waitForTimeout(300)
        const after = await settled(page)
        if (after.width === before.width) return
        before = after
    }
    throw new Error('The board kept zooming out')
}

/** Every box the button must not cover: each lit hex and chevron, and the route's last city. */
async function keepClearBoxes(page: Page): Promise<Box[]> {
    const picks = [
        ...(await litHexes(page).all()),
        ...(await board(page).locator('[data-chevron]').all()),
        board(page).locator(`g.hits polygon[data-hex-id="${CHICAGO}"]`)
    ]
    return Promise.all(picks.map(boxOf))
}

/** Whether the button stands on its own side of Chicago: east on desktop, below on a phone. */
async function onItsOwnSide(page: Page): Promise<boolean> {
    const ride = await boxOf(mapRide(page))
    const city = await boxOf(board(page).locator(`g.hits polygon[data-hex-id="${CHICAGO}"]`))
    if (onPhone()) {
        const centred = Math.abs(ride.x + ride.width / 2 - (city.x + city.width / 2)) < 1
        return centred && ride.y >= city.y + city.height
    }
    const level = Math.abs(ride.y + ride.height / 2 - (city.y + city.height / 2)) < 1
    return level && ride.x >= city.x + city.width
}

test('Fully zoomed out, the map’s Ride button stands clear of the lit cities and the last city, and sends the journey', async ({
    page
}) => {
    await rideIntoChicago(page)
    await wholeMap(page)

    const ride = mapRide(page)
    await expect(ride).toBeVisible()
    const box = await boxOf(ride)
    for (const pick of await keepClearBoxes(page)) {
        expect(apart(box, pick), `Ride ${JSON.stringify(box)} over ${JSON.stringify(pick)}`).toBe(
            true
        )
    }

    expect(await activePlayerId(page)).toBe('p1')
    if (onPhone()) await ride.tap()
    else await ride.click()
    await settled(page)
    await expect.poll(() => activePlayerId(page)).not.toBe('p1')
    await expect(ride).toHaveCount(0)
})

test('Zooming in brings the map’s Ride button back to its own side of the city', async ({
    page
}) => {
    await rideIntoChicago(page)
    await wholeMap(page)
    // On the whole map its own side covers a lit city, so it stands elsewhere.
    await expect(mapRide(page)).toBeVisible()
    expect(await onItsOwnSide(page)).toBe(false)

    // A mouse wheel over Chicago zooms in about it, until a hex is wider than the button.
    for (
        let step = 0;
        step < 12 && !((await mapRide(page).isVisible()) && (await onItsOwnSide(page)));
        step++
    ) {
        const city = await boxOf(board(page).locator(`g.hits polygon[data-hex-id="${CHICAGO}"]`))
        await page.mouse.move(city.x + city.width / 2, city.y + city.height / 2)
        await page.mouse.wheel(0, -100)
        await page.waitForTimeout(300)
        await settled(page)
    }
    await expect(mapRide(page)).toBeVisible()
    expect(await onItsOwnSide(page)).toBe(true)
    const box = await boxOf(mapRide(page))
    for (const pick of await keepClearBoxes(page)) {
        expect(apart(box, pick)).toBe(true)
    }
})

/** Whether a press at the middle of a lit hex lands on the hex itself. */
function takesPressAtMiddle(hex: Locator): Promise<boolean> {
    return hex.evaluate((element) => {
        const { x, y, width, height } = element.getBoundingClientRect()
        return document.elementFromPoint(x + width / 2, y + height / 2) === element
    })
}

test('Where the map’s Ride button has no clear place, a lit city under its own side still takes a press', async ({
    page
}) => {
    test.skip(!onPhone(), 'The whole desktop map leaves the button a clear place beside Chicago.')
    await rideIntoChicago(page, 'Ringed chicago')
    await expect(litHex(page, 'Saint Louis: link by Yellow')).toBeVisible()
    await wholeMap(page)

    // Every place beside Chicago covers a lit city, so the button is hidden. Its own side, below
    // the city, covers Cincinnati, and the hidden button's box must not take the press.
    await expect(mapRide(page)).toBeHidden()
    const cincinnati = litHex(page, 'Cincinnati: link by Yellow')
    expect(await takesPressAtMiddle(cincinnati)).toBe(true)
    const links = () => page.evaluate(() => window.rtrSession.journeyDraft?.draftLinks.length)
    expect(await links()).toBe(1)
    await cincinnati.tap()
    await settled(page)
    await expect.poll(links).toBe(2)
    expect(await activePlayerId(page)).toBe('p1')
})

import { expect, test, type Page } from '@playwright/test'
import {
    activePlayerId,
    board,
    collectPageErrors,
    litHex,
    litHexes,
    litLabels,
    moneyOf,
    openScenario,
    pressHex,
    settled,
    undo
} from './helpers.js'

// The contract's verification scenarios for Ride the Rails (R-3.3), each at desktop and phone
// width.
collectPageErrors()

const START = 'start a journey with its passenger'

function linkTo(city: string): RegExp {
    return new RegExp(`^${city}: link by `)
}

function journeyStart(page: Page, city: string) {
    return litHex(page, `${city}: the journey's start, clear the journey`)
}

/** The cities lit as a next link, by name, leaving out the picked start. */
async function linkTargets(page: Page): Promise<string[]> {
    return (await litLabels(page))
        .filter((label) => label.includes(': link by '))
        .map((label) => label.split(':')[0] ?? '')
}

function stagedRoute(page: Page) {
    return board(page).locator('g.staged-route polyline')
}

function routeHeading(page: Page, text: string) {
    return expect(page.getByRole('heading', { name: text, exact: true })).toBeVisible()
}

/** The action panel's Ride button; the map's floats beside the route ([data-map-ride]). */
function panelRide(page: Page) {
    return page
        .getByRole('button', { name: 'Ride', exact: true })
        .and(page.locator('button:not([data-map-ride])'))
}

function mapRide(page: Page) {
    return page.locator('button[data-map-ride]')
}

function startPassenger(page: Page) {
    return board(page).locator('g.staged-route [data-start-passenger]')
}

/** The link count drawn on the route's last city. */
function linkCount(page: Page) {
    return board(page).locator('g.staged-route text')
}

function linkPopup(page: Page, city: string) {
    return page.getByRole('group', { name: `${city}: which railroad?`, exact: true })
}

/** The dividend chips sit behind a toggle on phones (Phone layout). */
async function openSeatChips(page: Page) {
    const toggle = page.getByRole('button', { name: /seats$/ })
    if (await toggle.isVisible()) {
        if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
            await toggle.click()
        }
    }
}

test('13. Start and extend: a passenger city, a one-railroad link, then undo both', async ({
    page
}) => {
    await openScenario(page, 'Journey choices')
    expect(await activePlayerId(page)).toBe('p1')
    await expect(page.getByRole('heading', { name: 'Choose a passenger' })).toBeVisible()

    // R-3.3.1: each city holding a passenger with a link out; Chicago's passenger is gone.
    expect(await litLabels(page)).toEqual(
        ['Milwaukee', 'Des Moines', 'New York', 'Saint Louis', 'Baltimore'].map(
            (city) => `${city}: ${START}`
        )
    )
    await expect(startPassenger(page)).toHaveCount(0)

    await pressHex(page, litHex(page, `Des Moines: ${START}`))
    await expect(journeyStart(page, 'Des Moines')).toBeVisible()
    await routeHeading(page, 'Des Moines')
    // The start's passenger grows to the middle of its hex, which takes the navy start ring.
    await expect(startPassenger(page)).toHaveCount(1)
    await expect(board(page).locator('[data-ring="journey-start"]')).toHaveCount(1)
    // R-3.3.2: the cities one link away light, each with a chevron; no ghost cube is drawn.
    expect(await linkTargets(page)).toContain('Chicago')
    await expect(litHex(page, 'Chicago: link by Orange')).toBeVisible()
    await expect(board(page).locator('[data-chevron]')).not.toHaveCount(0)
    await expect(board(page).locator('g.picks [data-ghost]')).toHaveCount(0)
    await expect(stagedRoute(page)).toHaveCount(0)
    await expect(panelRide(page)).toBeDisabled()
    await expect(mapRide(page)).toHaveCount(0)

    await pressHex(page, litHex(page, 'Chicago: link by Orange'))
    await routeHeading(page, 'Des Moines → Chicago')
    await expect(page.getByText(/^1 link · fare \$2/)).toBeVisible()
    await expect(
        stagedRoute(page).and(page.locator('[stroke="var(--rtr-railroad-orange)"]'))
    ).toHaveCount(1)
    await expect(linkCount(page)).toHaveText('1')
    // R-3.3.4, R-3.3.5: Ada's fare and dividend, and $1 to each other Orange shareholder, the
    // rider's chip among the others.
    await openSeatChips(page)
    for (const chip of ['Ada $3', 'Cora $1', 'Dell $1']) {
        await expect(page.getByText(chip, { exact: true })).toBeVisible()
    }
    await expect(page.getByText(/^Ben \$/)).toHaveCount(0)
    await expect(panelRide(page)).toBeEnabled()
    // Ride also floats on the map beside the route's last city.
    await expect(mapRide(page)).toBeVisible()

    // Undo takes back the link, then the start.
    await undo(page)
    await routeHeading(page, 'Des Moines')
    await expect(stagedRoute(page)).toHaveCount(0)
    await expect(mapRide(page)).toHaveCount(0)
    await expect(journeyStart(page, 'Des Moines')).toBeVisible()
    await undo(page)
    await expect(page.getByRole('heading', { name: 'Choose a passenger' })).toBeVisible()
    await expect(startPassenger(page)).toHaveCount(0)
    expect(await litLabels(page)).toHaveLength(5)
    expect(await activePlayerId(page)).toBe('p1')
})

test('14. Railroad choice on a link: Orange or Yellow, each with what it pays', async ({
    page
}) => {
    await openScenario(page, 'Journey choices')
    await pressHex(page, litHex(page, `Des Moines: ${START}`))
    await pressHex(page, litHex(page, 'Chicago: link by Orange'))

    // R-3.3.2: two railroads link Chicago to Milwaukee; Ada holds Orange, not Yellow.
    const milwaukee = litHex(page, 'Milwaukee: link by Orange or Yellow')
    await pressHex(page, milwaukee)
    const popup = linkPopup(page, 'Milwaukee')
    await expect(popup).toBeVisible()
    await expect(
        popup.getByRole('button', { name: 'Link by Orange, you +$5', exact: true })
    ).toBeVisible()
    const yellow = popup.getByRole('button', { name: 'Link by Yellow, you +$4', exact: true })
    await expect(yellow).toBeVisible()
    // The map's Ride button hides while a link popup is open.
    await expect(mapRide(page)).toHaveCount(0)

    await yellow.click()
    await settled(page)
    await expect(popup).toHaveCount(0)
    await routeHeading(page, 'Des Moines → Milwaukee, via 1 city')
    await expect(page.getByText(/^2 links · fare \$3/)).toBeVisible()
    await expect(
        stagedRoute(page).and(page.locator('[stroke="var(--rtr-railroad-yellow)"]'))
    ).toHaveCount(1)
    await expect(linkCount(page)).toHaveText('2')
    await expect(mapRide(page)).toBeVisible()
    expect(
        await page.evaluate(() =>
            window.rtrSession.journeyDraft?.links.map((link) => link.railroadId)
        )
    ).toEqual(['railroad.orange', 'railroad.yellow'])
})

test('15. No loop: a city on the route, or past a used hex, never lights', async ({ page }) => {
    await openScenario(page, 'Journey choices')
    // Yellow links Chicago to Saint Louis through the hex next to Chicago on Orange's line.
    await pressHex(page, litHex(page, `Milwaukee: ${START}`))
    await pressHex(page, litHex(page, 'Chicago: link by Orange or Yellow'))
    await linkPopup(page, 'Chicago')
        .getByRole('button', { name: /^Link by Orange, / })
        .click()
    await settled(page)
    expect(await linkTargets(page)).toContain('Saint Louis')
    expect(await linkTargets(page)).not.toContain('Milwaukee')

    // A press on the start cuts the route back to the start alone; a second drops the draft.
    await pressHex(page, journeyStart(page, 'Milwaukee'))
    await routeHeading(page, 'Milwaukee')
    await pressHex(page, journeyStart(page, 'Milwaukee'))
    await expect(page.getByRole('heading', { name: 'Choose a passenger' })).toBeVisible()
    await pressHex(page, litHex(page, `Des Moines: ${START}`))
    await pressHex(page, litHex(page, 'Chicago: link by Orange'))
    // R-3.3.3: Des Moines is on the route, and Saint Louis is reached only through a hex the
    // route has used.
    expect(await linkTargets(page)).toEqual(['Milwaukee'])
    await expect(litHexes(page)).toHaveCount(2)
    await expect(journeyStart(page, 'Des Moines')).toBeVisible()
    await expect(page.getByRole('button', { name: linkTo('Saint Louis') })).toHaveCount(0)
    await expect(page.getByRole('button', { name: linkTo('Des Moines') })).toHaveCount(0)

    await pressHex(page, litHex(page, 'Milwaukee: link by Orange or Yellow'))
    await linkPopup(page, 'Milwaukee')
        .getByRole('button', { name: /^Link by Yellow, / })
        .click()
    await settled(page)
    // From Milwaukee every link out runs back over the route.
    expect(await linkTargets(page)).toEqual([])
})

test('16. City by city, and cut back: no Best route; a press on the route cuts it; Ride sends the route shown', async ({
    page
}) => {
    await openScenario(page, 'Journey choices')
    const bestRoute = page.getByRole('button', { name: /best route/i })
    await expect(bestRoute).toHaveCount(0)
    await pressHex(page, litHex(page, `Saint Louis: ${START}`))
    await routeHeading(page, 'Saint Louis')
    await expect(panelRide(page)).toBeDisabled()
    await expect(bestRoute).toHaveCount(0)

    // R-3.3.2: the route is named one city at a time.
    await pressHex(page, litHex(page, 'Chicago: link by Yellow'))
    await routeHeading(page, 'Saint Louis → Chicago')
    await pressHex(page, litHex(page, 'Milwaukee: link by Orange or Yellow'))
    await linkPopup(page, 'Milwaukee')
        .getByRole('button', { name: /^Link by Orange, / })
        .click()
    await settled(page)
    await routeHeading(page, 'Saint Louis → Milwaukee, via 1 city')
    await expect(page.getByText(/^2 links · fare \$3/)).toBeVisible()
    await expect(bestRoute).toHaveCount(0)

    // A press on Chicago, already on the route, cuts it back to there; Undo puts the link back.
    await pressHex(page, board(page).locator('[data-hex-id="hex.usa.5-43"]').first())
    await routeHeading(page, 'Saint Louis → Chicago')
    await expect(linkCount(page)).toHaveText('1')
    await undo(page)
    await routeHeading(page, 'Saint Louis → Milwaukee, via 1 city')
    await expect(linkCount(page)).toHaveText('2')

    const shown = await page.evaluate(() => ({
        links: window.rtrSession.journeyDraft?.links,
        payments: window.rtrSession.journeyPreview?.payments ?? []
    }))
    expect(shown.links?.map((link) => link.railroadId)).toEqual([
        'railroad.yellow',
        'railroad.orange'
    ])
    const before = await page.evaluate(() =>
        Object.fromEntries(
            window.rtrSession.gameState.players.map((player) => [player.playerId, player.money])
        )
    )
    // Ride on the map sends it, as the panel's does.
    await mapRide(page).click()
    // The panel keeps showing the sent journey while it plays.
    await routeHeading(page, 'Saint Louis → Milwaukee, via 1 city')
    await expect(page.getByRole('heading', { name: 'Choose a passenger' })).toHaveCount(0)
    await settled(page)

    // R-3.3.4, R-3.3.5: the route sent is the one shown, and each seat gains what it previewed.
    expect(await page.evaluate(() => window.rtrSession.actions.at(-1)?.type)).toBe('RideJourney')
    expect(
        await page.evaluate(() => {
            const action = window.rtrSession.actions.at(-1)
            return action && 'links' in action ? action.links : undefined
        })
    ).toEqual(shown.links)
    for (const payment of shown.payments) {
        expect(await moneyOf(page, payment.playerId)).toBe(
            (before[payment.playerId] ?? 0) + payment.dividends + payment.fare
        )
    }
    expect(await activePlayerId(page)).toBe('p2')
})

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

function draftLinkCount(page: Page): Promise<number> {
    return page.evaluate(() => window.rtrSession.journeyDraft?.links.length ?? -1)
}

test('12. Start and extend: a passenger city, a one-railroad link, then undo both', async ({
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

    await pressHex(page, litHex(page, `Des Moines: ${START}`))
    await expect(journeyStart(page, 'Des Moines')).toBeVisible()
    await routeHeading(page, 'Des Moines')
    // R-3.3.2: the cities one link away light, with the pips of the railroads that link there.
    expect(await linkTargets(page)).toContain('Chicago')
    await expect(litHex(page, 'Chicago: link by Orange')).toBeVisible()
    await expect(
        board(page).locator('g.picks circle[fill="var(--rtr-railroad-orange)"]')
    ).not.toHaveCount(0)
    await expect(stagedRoute(page)).toHaveCount(0)

    await pressHex(page, litHex(page, 'Chicago: link by Orange'))
    await routeHeading(page, 'Des Moines → Chicago')
    await expect(page.getByText(/^1 link · fare \$2/)).toBeVisible()
    await expect(
        stagedRoute(page).and(page.locator('[stroke="var(--rtr-railroad-orange)"]'))
    ).toHaveCount(1)
    // R-3.3.4, R-3.3.5: Ada's fare and dividend, and $1 to each other Orange shareholder.
    await openSeatChips(page)
    for (const chip of ['Ada +$3', 'Cora +$1', 'Dell +$1']) {
        await expect(page.getByText(chip, { exact: true })).toBeVisible()
    }
    await expect(page.getByText(/^Ben \+\$/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Ride · you +$3', exact: true })).toBeEnabled()

    // Undo takes back the link, then the start.
    await undo(page)
    await routeHeading(page, 'Des Moines')
    await expect(stagedRoute(page)).toHaveCount(0)
    await expect(journeyStart(page, 'Des Moines')).toBeVisible()
    await undo(page)
    await expect(page.getByRole('heading', { name: 'Choose a passenger' })).toBeVisible()
    expect(await litLabels(page)).toHaveLength(5)
    expect(await activePlayerId(page)).toBe('p1')
})

test('13. Railroad choice on a link: Orange or Yellow, each with what it pays', async ({
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

    await yellow.click()
    await settled(page)
    await expect(popup).toHaveCount(0)
    await routeHeading(page, 'Des Moines → Chicago → Milwaukee')
    await expect(page.getByText(/^2 links · fare \$3/)).toBeVisible()
    await expect(
        stagedRoute(page).and(page.locator('[stroke="var(--rtr-railroad-yellow)"]'))
    ).toHaveCount(1)
    expect(
        await page.evaluate(() =>
            window.rtrSession.journeyDraft?.links.map((link) => link.railroadId)
        )
    ).toEqual(['railroad.orange', 'railroad.yellow'])
})

test('14. No loop: a city on the route, or past a used hex, never lights', async ({ page }) => {
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

    await pressHex(page, journeyStart(page, 'Milwaukee'))
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

test('15. Best route: fills the best journey, undo pops one link, Ride pays the preview', async ({
    page
}) => {
    await openScenario(page, 'Journey choices')
    await pressHex(page, litHex(page, `Saint Louis: ${START}`))
    const best = page.getByRole('button', { name: 'Best route', exact: true })
    await best.click()
    await settled(page)
    // R-3.3: Yellow into Chicago, then Orange to Milwaukee, since Ada holds Orange.
    await routeHeading(page, 'Saint Louis → Chicago → Milwaukee')
    expect(
        await page.evaluate(() =>
            window.rtrSession.journeyDraft?.links.map((link) => link.railroadId)
        )
    ).toEqual(['railroad.yellow', 'railroad.orange'])
    await expect(page.getByText(/^2 links · fare \$3/)).toBeVisible()

    await undo(page)
    expect(await draftLinkCount(page)).toBe(1)
    await routeHeading(page, 'Saint Louis → Chicago')

    await best.click()
    await settled(page)
    expect(await draftLinkCount(page)).toBe(2)
    const shown = await page.evaluate(() => ({
        links: window.rtrSession.journeyDraft?.links,
        payments: window.rtrSession.journeyPreview?.payments ?? []
    }))
    const before = await page.evaluate(() =>
        Object.fromEntries(
            window.rtrSession.gameState.players.map((player) => [player.playerId, player.money])
        )
    )
    await page.getByRole('button', { name: /^Ride · you \+\$4$/ }).click()
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

test('16. Pass: no passenger city has a link, so Pass is the only button', async ({ page }) => {
    await openScenario(page, 'No journey')
    expect(await activePlayerId(page)).toBe('p1')
    // R-3.3.1-H1
    await expect(
        page.getByRole('heading', {
            name: "No passenger can travel: no link leaves any passenger's city"
        })
    ).toBeVisible()
    const pass = page.getByRole('button', { name: 'Pass', exact: true })
    await expect(pass).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Best route' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Ride/ })).toHaveCount(0)
    await expect(litHexes(page)).toHaveCount(0)
    await expect(board(page).locator('g.scrim path')).toHaveCount(0)

    await pass.click()
    await settled(page)
    expect(await page.evaluate(() => window.rtrSession.actions.at(-1)?.type)).toBe('PassJourney')
    expect(await activePlayerId(page)).toBe('p2')
})

import { expect, test, type Page } from '@playwright/test'
import {
    activePlayerId,
    board,
    collectPageErrors,
    litHex,
    openScenario,
    pressHex,
    settled
} from './helpers.js'

// The journey draft on the map (R-3.3): each link its shortest way, drawn through the cubes it
// rides; the start as a navy marker; chevrons on the next cities; the last journey only for the
// seats not now deciding; and the $5 pill, gone once taken and hidden while riding. Desktop and
// phone width.
collectPageErrors()

const START = 'start a journey with its passenger'

function draftLinks(page: Page) {
    return page.evaluate(() => window.rtrSession.journeyDraft?.links ?? [])
}

function stagedRoute(page: Page) {
    return board(page).locator('g.staged-route')
}

function lastJourneyLines(page: Page) {
    return board(page).locator('g.lines polyline')
}

test('A one-link draft takes the short way through the cubes and keeps it when a link is added', async ({
    page
}) => {
    await openScenario(page, 'Short way to washington')
    expect(await activePlayerId(page)).toBe('p1')

    await pressHex(page, litHex(page, `Baltimore: ${START}`))
    // The start is a navy ring with its passenger grown in the middle, no flag, and a press on it
    // still clears the draft.
    const start = litHex(page, "Baltimore: the journey's start, clear the journey")
    await expect(start).toBeVisible()
    await expect(board(page).locator('[data-ring="journey-start"]')).toHaveCount(1)
    await expect(board(page).locator('[data-start-passenger]')).toHaveCount(1)
    await expect(board(page).locator('[data-start-flag]')).toHaveCount(0)
    // R-3.3.2: each next city, Washington and Cincinnati past it, carries a Red chevron.
    await expect(litHex(page, 'Washington: link by Red')).toBeVisible()
    await expect(litHex(page, 'Cincinnati: link by Red')).toBeVisible()
    await expect(board(page).locator('[data-chevron]')).toHaveCount(2)
    await expect(board(page).locator('[data-chevron="railroad.red"]')).toHaveCount(2)

    await pressHex(page, litHex(page, 'Washington: link by Red'))
    const shortWay = ['hex.usa.9-55', 'hex.usa.10-54', 'hex.usa.11-55']
    expect(await draftLinks(page)).toEqual([{ railroadId: 'railroad.red', hexIds: shortWay }])
    // The line runs through the three cubes it rides, drawn again on top of it.
    await expect(stagedRoute(page).locator('polyline')).toHaveCount(2)
    const points = await stagedRoute(page).locator('polyline').first().getAttribute('points')
    expect(points?.split(' ')).toHaveLength(3)
    await expect(stagedRoute(page).locator('[data-cube]')).toHaveCount(3)

    await expect(board(page).locator('[data-chevron="railroad.red"]')).toHaveCount(1)
    await pressHex(page, litHex(page, 'Cincinnati: link by Red'))
    const links = await draftLinks(page)
    expect(links[0]).toEqual({ railroadId: 'railroad.red', hexIds: shortWay })
    expect(links[1]?.hexIds.slice(0, 2)).toEqual(['hex.usa.11-55', 'hex.usa.11-53'])

    // A press on the start cuts the route back to it; a second drops the draft.
    await pressHex(page, start)
    expect(await draftLinks(page)).toEqual([])
    await expect(page.getByRole('heading', { name: 'Baltimore', exact: true })).toBeVisible()
    await pressHex(page, start)
    await expect(page.getByRole('heading', { name: 'Choose a passenger' })).toBeVisible()
    await expect(board(page).locator('[data-start-passenger]')).toHaveCount(0)
})

test('18. Last journey: not drawn for the seat now deciding; the Non-active view keeps it', async ({
    page
}) => {
    await openScenario(page, 'Journey choices')
    await pressHex(page, litHex(page, `Des Moines: ${START}`))
    await pressHex(page, litHex(page, 'Chicago: link by Orange'))
    await page.locator('button[data-map-ride]').click()
    await settled(page)
    await expect.poll(() => activePlayerId(page)).toBe('p2')

    // Ben decides: his board starts clean.
    await expect(lastJourneyLines(page)).toHaveCount(0)

    // Watching, Ada's journey stays drawn over its halo until the next action.
    await page.evaluate(() => window.rtrSession.setViewingAsNonActivePlayer(true))
    await expect(lastJourneyLines(page)).toHaveCount(2)
    await expect(
        lastJourneyLines(page).and(page.locator('[stroke="var(--rtr-railroad-orange)"]'))
    ).toHaveCount(1)
    await page.evaluate(() => window.rtrSession.setViewingAsNonActivePlayer(false))
    await expect(lastJourneyLines(page)).toHaveCount(0)
})

test('7. A $5 pill shows until a railroad has had the bonus, then is gone', async ({ page }) => {
    await openScenario(page, 'Black unstarted')
    const pill = board(page).locator('g.bonuses [data-bonus]')
    const denver = board(page).locator('[data-city-marks="city.usa.denver"]')
    const fives = await pill.and(board(page).locator('[data-bonus="five"]')).count()
    expect(fives).toBeGreaterThan(0)
    // No ring marks a $5 city: its pill is enough.
    await expect(denver.locator('[data-five-ring]')).toHaveCount(0)

    await pressHex(page, litHex(page, 'Denver: place Orange or start Black, $5'))
    const popup = page.getByRole('group', { name: 'Denver: which railroad?', exact: true })
    await popup.getByRole('button', { name: /^Place Orange, .*, pays \$5$/ }).click()
    await settled(page)
    // R-4.3.2: the taken $5 is gone from the map, not greyed.
    await expect(board(page).locator('g.bonuses [data-bonus="five"]')).toHaveCount(fives - 1)
    await expect(board(page).locator('g.bonuses [data-bonus="used"]')).toHaveCount(0)
})

test('No bonus pill shows while journeys are made', async ({ page }) => {
    await openScenario(page, 'Journey choices')
    await expect(board(page).locator('g.bonuses [data-bonus]')).toHaveCount(0)
})

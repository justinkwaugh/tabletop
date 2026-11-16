import { expect, test, type Page } from '@playwright/test'
import {
    activePlayerId,
    collectPageErrors,
    litHex,
    moneyOf,
    openScenario,
    pressHex,
    settled,
    undo
} from './helpers.js'

// The contract's verification scenarios for the end of round and the game's end (R-2.5, R-6),
// each at desktop and phone width. The end of round's motion is checked by hand.
collectPageErrors()

const START = 'start a journey with its passenger'

function isPhone(): boolean {
    return test.info().project.use.isMobile === true
}

function turnOrder(page: Page): Promise<string[]> {
    return page.evaluate(() => [...window.rtrSession.gameState.turnManager.turnOrder])
}

function roundNumber(page: Page): Promise<number | undefined> {
    return page.evaluate(() => window.rtrSession.gameState.roundManager.currentRound?.number)
}

/**
 * The round the table shows: the turn line's current ticket, or below `lg`, where the six do not
 * fit, the current round's ticket alone.
 */
async function shownRound(page: Page, round: number) {
    const name = new RegExp(`^Round ${round}(,|$)`)
    if (isPhone()) {
        await expect(page.getByLabel(name).filter({ visible: true })).toHaveCount(1)
        return
    }
    await expect(page.getByRole('listitem', { name })).toHaveAttribute('aria-current', 'step')
}

/** The seat cards' names, in the order the phase under way is played (no places are written). */
async function shownOrder(page: Page, seats: readonly string[]) {
    const cards = page.locator('[data-flight-target^="seat:"]')
    await expect
        .poll(() => cards.evaluateAll((all) => all.map((card) => card.getAttribute('aria-label'))))
        .toEqual(seats)
}

/** The action panel's Ride button; the map's floats beside the route ([data-map-ride]). */
function panelRide(page: Page) {
    return page
        .getByRole('button', { name: 'Ride', exact: true })
        .and(page.locator('button:not([data-map-ride])'))
}

/** A railroad's card on desktop, or its share button on a phone (the share step's only cards). */
function railroadEntry(page: Page, name: string) {
    return page
        .getByRole('group', { name: 'Railroads' })
        .getByRole('button', { name: new RegExp(`^(Take an? )?${name}\\b`) })
}

test('19. End of round: money order with the tie swapped, round II, Orange; undo reverses it', async ({
    page
}) => {
    await openScenario(page, 'Round one ends')
    expect(await activePlayerId(page)).toBe('p4')
    expect(await turnOrder(page)).toEqual(['p1', 'p2', 'p3', 'p4'])
    await shownRound(page, 1)
    // R-1.4: Orange is not shown until its round.
    const orange = railroadEntry(page, 'Orange')
    await expect(orange).toHaveCount(0)
    // A phone shows no railroad cards while riding.
    await expect(railroadEntry(page, 'Blue')).toHaveCount(isPhone() ? 0 : 1)

    // Dell rides the round's last journey, Washington to Baltimore by Blue.
    await pressHex(page, litHex(page, `Washington: ${START}`))
    await pressHex(page, litHex(page, 'Baltimore: link by Blue'))
    await expect(page.getByText('Dell $3', { exact: true })).toBeAttached()
    await panelRide(page).click()
    await settled(page)

    // R-2.5.1: lowest money first; Ben and Dell tie at $4, so they swap places.
    expect(await moneyOf(page, 'p4')).toBe(4)
    expect(await moneyOf(page, 'p2')).toBe(4)
    expect(await turnOrder(page)).toEqual(['p4', 'p2', 'p3', 'p1'])
    // R-2.5.2, R-2.5.3: round 2 starts with Orange available, and phase 1 runs in reverse, as
    // the seat cards are ordered.
    await shownOrder(page, ['Ada', 'Cora', 'Ben', 'Dell'])
    expect(await roundNumber(page)).toBe(2)
    await shownRound(page, 2)
    expect(await activePlayerId(page)).toBe('p1')
    await expect(orange).toHaveAccessibleName('Take an Orange share, 27 left')
    await expect(orange).toBeEnabled()

    // Undo of the journey, before Ada takes her share, takes back the end of round too.
    await undo(page)
    expect(await roundNumber(page)).toBe(1)
    expect(await turnOrder(page)).toEqual(['p1', 'p2', 'p3', 'p4'])
    expect(await activePlayerId(page)).toBe('p4')
    expect(await moneyOf(page, 'p4')).toBe(1)
    expect(await moneyOf(page, 'p2')).toBe(3)
    await shownOrder(page, ['Ada', 'Ben', 'Cora', 'Dell'])
    await shownRound(page, 1)
    await expect(orange).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Ride', exact: true })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Choose a passenger' })).toBeVisible()
})

test('20. Game end: final money in order, and both seats tied for most win', async ({ page }) => {
    await openScenario(page, 'Last journey')
    expect(await activePlayerId(page)).toBe('p3')
    expect(await roundNumber(page)).toBe(6)

    // Cora's journey from Saint Louis, both links by Yellow.
    await pressHex(page, litHex(page, `Saint Louis: ${START}`))
    await pressHex(page, litHex(page, 'Chicago: link by Yellow'))
    await pressHex(page, litHex(page, 'Milwaukee: link by Orange or Yellow'))
    await page
        .getByRole('group', { name: 'Milwaukee: which railroad?' })
        .getByRole('button', { name: /^Link by Yellow, / })
        .click()
    await settled(page)
    await expect(page.getByText('Cora $5', { exact: true })).toBeAttached()
    await panelRide(page).click()
    await settled(page)

    // R-6.1, R-6.2: the game ends after round 6; Ada and Cora share the win.
    expect(await page.evaluate(() => window.rtrSession.gameState.result !== undefined)).toBe(true)
    const headline = page.getByRole('heading', {
        name: 'Ada and Cora share the win with $44',
        exact: true
    })
    await expect(headline).toBeVisible()
    await expect(page.getByText('tied for most money: both win', { exact: true })).toBeVisible()
    // The standings: a small table, most money first, the winners' rows marked; no shares.
    const standings = page.getByRole('table', { name: 'Final money' })
    await expect(standings.getByRole('row')).toHaveText([
        /^1\s*Ada\s*\$44$/,
        /^2\s*Cora\s*\$44$/,
        /^3\s*Ben\s*\$42$/
    ])
    await expect(standings.locator('tr.winner')).toHaveCount(2)
    await expect(standings.locator('tr.winner')).toContainText(['Ada', 'Cora'])
    await expect(standings.locator('[data-cube], svg')).toHaveCount(0)
})

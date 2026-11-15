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

/** The round the table shows: the turn line's current ticket, or its label on a phone. */
async function shownRound(page: Page, round: number) {
    if (isPhone()) {
        await expect(page.getByText(new RegExp(`^R${round} · `))).toBeVisible()
        return
    }
    await expect(
        page.getByRole('listitem', { name: `Round ${round}`, exact: true })
    ).toHaveAttribute('aria-current', 'step')
}

/** The seat cards, in turn order, as their names and places. */
async function shownOrder(page: Page, seats: readonly string[]) {
    const cards = page.locator('[data-flight-target^="seat:"]')
    await expect
        .poll(() => cards.evaluateAll((all) => all.map((card) => card.getAttribute('aria-label'))))
        .toEqual(
            seats.map((seat, index) => `${seat}, ${['1st', '2nd', '3rd', '4th', '5th'][index]}`)
        )
}

/** A railroad's card on desktop, or its pile on the phone's rail. */
function railroadEntry(page: Page, name: string) {
    return page
        .getByRole('group', { name: 'Railroads' })
        .getByRole('button', { name: new RegExp(`^${name}: `) })
}

test('18. End of round: money order with the tie swapped, round II, Orange; undo reverses it', async ({
    page
}) => {
    await openScenario(page, 'Round one ends')
    expect(await activePlayerId(page)).toBe('p4')
    expect(await turnOrder(page)).toEqual(['p1', 'p2', 'p3', 'p4'])
    await shownRound(page, 1)
    // R-1.4: Orange is not shown until its round.
    const orange = railroadEntry(page, 'Orange')
    await expect(orange).toHaveCount(0)
    await expect(railroadEntry(page, 'Blue')).toBeVisible()

    // Dell rides the round's last journey, Washington to Baltimore by Blue.
    await pressHex(page, litHex(page, `Washington: ${START}`))
    await pressHex(page, litHex(page, 'Baltimore: link by Blue'))
    await page.getByRole('button', { name: 'Ride · you +$3', exact: true }).click()
    await settled(page)

    // R-2.5.1, R-2.5-H1: lowest money first; Ben and Dell tie at $4, so they swap places.
    expect(await moneyOf(page, 'p4')).toBe(4)
    expect(await moneyOf(page, 'p2')).toBe(4)
    expect(await turnOrder(page)).toEqual(['p4', 'p2', 'p3', 'p1'])
    await shownOrder(page, ['Dell', 'Ben', 'Cora', 'Ada'])
    // R-2.5.2, R-2.5.3: round 2 starts with Orange available, and phase 1 runs in reverse.
    expect(await roundNumber(page)).toBe(2)
    await shownRound(page, 2)
    await expect(orange).toHaveAccessibleName(/^Orange: 27 left, 0 track/)
    expect(await activePlayerId(page)).toBe('p1')
    await expect(page.getByRole('button', { name: 'Orange, 27 left', exact: true })).toBeEnabled()

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
    await expect(page.getByRole('button', { name: /^Ride/ })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Choose a passenger' })).toBeVisible()
})

test('19. Game end: final money in order, and both seats tied for most win', async ({ page }) => {
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
    await page.getByRole('button', { name: 'Ride · you +$5', exact: true }).click()
    await settled(page)

    // R-6.1, R-6.2, R-6.2-H1: the game ends after round 6; Ada and Cora share the win.
    expect(await page.evaluate(() => window.rtrSession.gameState.result !== undefined)).toBe(true)
    const headline = page.getByRole('heading', {
        name: 'Ada and Cora share the win with $44',
        exact: true
    })
    await expect(headline).toBeVisible()
    await expect(page.getByText('tied for most money: both win', { exact: true })).toBeVisible()
    // The standings follow the headline, most money first.
    const standings = headline.locator('xpath=../following-sibling::div[1]')
    await expect(standings.locator('span.rtr-display')).toHaveText(['$44', '$44', '$42'])
    await expect(page.getByText('Ada · winner', { exact: true })).toBeVisible()
    await expect(page.getByText('Cora · winner', { exact: true })).toBeVisible()
    await expect(page.getByText('Ben', { exact: true }).first()).toBeAttached()
    await expect(page.getByText('Ben · winner', { exact: true })).toHaveCount(0)
})

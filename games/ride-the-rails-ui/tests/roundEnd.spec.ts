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

/** The round the table shows: the margin's punched ticket, or the phone strip's badge. */
async function shownRound(page: Page, round: number) {
    if (isPhone()) {
        await expect(page.getByLabel(`Round ${round}`, { exact: true })).toBeVisible()
        return
    }
    await expect(page.getByRole('img', { name: new RegExp(`^Round ${round}\\b`) })).toHaveAttribute(
        'aria-current',
        'step'
    )
}

/** The turn order track's markers, in order; phones show the seat cards' order instead. */
async function shownOrder(page: Page, seats: readonly string[]) {
    if (isPhone()) {
        return
    }
    for (const [index, seat] of seats.entries()) {
        const ordinal = ['1st', '2nd', '3rd', '4th', '5th'][index] ?? ''
        await expect(
            page.getByRole('img', { name: `${ordinal}: ${seat}`, exact: true })
        ).toBeVisible()
    }
}

test('18. End of round: money order with the tie swapped, round II, Orange; undo reverses it', async ({
    page
}) => {
    await openScenario(page, 'Round one ends')
    expect(await activePlayerId(page)).toBe('p4')
    expect(await turnOrder(page)).toEqual(['p1', 'p2', 'p3', 'p4'])
    await shownRound(page, 1)
    const orange = page.getByRole('button', { name: /^Orange: / })
    await expect(orange).toHaveAccessibleName('Orange: available from round 2')

    // Dell rides the round's last journey, Washington to Baltimore by Blue.
    await pressHex(page, litHex(page, `Washington: ${START}`))
    await pressHex(page, litHex(page, 'Baltimore: link by Blue'))
    await page.getByRole('button', { name: 'Ride · you +$3', exact: true }).click()
    await settled(page)

    // R-2.5.1, R-2.5-H1: lowest money first; Ben and Dell tie at $4, so they swap places.
    expect(await moneyOf(page, 'p4')).toBe(4)
    expect(await moneyOf(page, 'p2')).toBe(4)
    expect(await turnOrder(page)).toEqual(['p4', 'p2', 'p3', 'p1'])
    await shownOrder(page, ['Dell, $4', 'Ben, $4', 'Cora, $5', 'Ada, $6'])
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
    await shownOrder(page, ['Ada, $6', 'Ben, $3', 'Cora, $5', 'Dell, $1'])
    await shownRound(page, 1)
    await expect(orange).toHaveAccessibleName('Orange: available from round 2')
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

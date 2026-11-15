import { expect, test, type Page } from '@playwright/test'
import { board, collectPageErrors, litHexes, openScenario, settled } from './helpers.js'

// The contract's Desktop and Phone layouts: the board cropped to the land, one railroad card (on a
// phone, one supply pile on the rail) per railroad available this round, piles of cubes with no
// number, and a press that spotlights the railroad and, on a phone, opens its track and holders.
collectPageErrors()

const onPhone = () => test.info().project.use.isMobile === true

/** The railroad cards above the board, or the rail beside it on a phone. */
function railroads(page: Page) {
    return page.getByRole('group', { name: 'Railroads' })
}

async function shownRailroads(page: Page): Promise<string[]> {
    const labels = await railroads(page)
        .getByRole('button')
        .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label') ?? ''))
    return labels.map((label) => label.slice(0, label.indexOf(':')))
}

/** A hex's width on screen, across its flats, in px. */
function hexWidth(page: Page): Promise<number> {
    return board(page).evaluate((svg) => {
        const box = svg.getBoundingClientRect()
        return (box.width / Number(svg.getAttribute('width'))) * Math.sqrt(3) * 40
    })
}

test('Round 1 shows only Red and Blue; round 4 adds Purple, and Black waits', async ({ page }) => {
    await openScenario(page, 'First share')
    expect(await shownRailroads(page)).toEqual(['Red', 'Blue'])
    await openScenario(page, 'Purple arrives')
    expect(await shownRailroads(page)).toEqual(['Red', 'Blue', 'Orange', 'Yellow', 'Purple'])
})

test('No supply count is written on the board, the cards or the rail', async ({ page }) => {
    await openScenario(page, 'Purple arrives')
    await expect(railroads(page).getByRole('button')).toHaveCount(5)
    for (const text of [await board(page).textContent(), await railroads(page).textContent()]) {
        expect(text ?? '').not.toMatch(/\d+\s+left|none left/)
    }
    // Each pile draws its supply as that many cubes; the card's name says the count in words.
    const red = railroads(page).getByRole('button', { name: /^Red: / })
    const label = (await red.getAttribute('aria-label')) ?? ''
    const supply = Number(/^Red: (\d+) left/.exec(label)?.[1] ?? -1)
    expect(supply).toBeGreaterThan(0)
    await expect(red.locator('[data-supply-pile] rect')).toHaveCount(supply)
})

test('Pressing a railroad holds its spotlight; a second press lets it go', async ({ page }) => {
    await openScenario(page, 'Purple arrives')
    const orange = railroads(page).getByRole('button', { name: /^Orange: / })
    await (onPhone() ? orange.tap() : orange.click())
    await expect(orange).toHaveAttribute('aria-pressed', 'true')
    expect(await page.evaluate(() => window.rtrSession.heldRailroadId)).toBe('railroad.orange')
    await (onPhone() ? orange.tap() : orange.click())
    await expect(orange).toHaveAttribute('aria-pressed', 'false')
    expect(await page.evaluate(() => window.rtrSession.heldRailroadId)).toBeUndefined()
})

test('On a phone a pile opens its railroad’s track count and holders', async ({ page }) => {
    test.skip(!onPhone(), 'Desktop cards show the track and holders on the card.')
    await openScenario(page, 'Purple arrives')
    const popover = page.getByRole('note', { name: 'Orange railroad' })
    await expect(popover).toHaveCount(0)
    await railroads(page)
        .getByRole('button', { name: /^Orange: / })
        .tap()
    await expect(popover).toBeVisible()
    await expect(popover).toContainText('track 13')
    await expect(popover).toContainText(/Ada\s*1/)
    await expect(popover).toContainText(/Ben\s*2/)
    await railroads(page)
        .getByRole('button', { name: /^Orange: / })
        .tap()
    await expect(popover).toHaveCount(0)
})

test('Every city is named while a seat chooses, a lit one too, above the picks', async ({
    page
}) => {
    await openScenario(page, 'Purple arrives')
    await expect(litHexes(page).first()).toBeVisible()
    const names = board(page).locator('.city-labels text')
    await expect(names).toHaveCount(51)
    const shown = await names.allTextContents()
    for (const city of ['Seattle', 'San Francisco', 'Los Angeles']) expect(shown).toContain(city)
    expect(shown.filter((name) => name === 'Portland')).toHaveLength(2)
    // Drawn after the rings, ghost cubes and marks, so none of them covers a name.
    const namesFollowPicks = await board(page).evaluate((svg) => {
        const picks = svg.querySelector('.picks')
        const labels = svg.querySelector('.city-labels')
        if (!picks || !labels) return false
        return (picks.compareDocumentPosition(labels) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    })
    expect(namesFollowPicks).toBe(true)
})

test('The board is drawn as large as the layout allows', async ({ page }) => {
    // The layout's targets: a 34.5 px hex at 1440 × 900 and 37.5 px at rest at 390 × 844.
    await page.setViewportSize(
        onPhone() ? { width: 390, height: 844 } : { width: 1440, height: 900 }
    )
    await openScenario(page, 'Transcontinental in reach')
    await settled(page)
    const width = await hexWidth(page)
    test.info().annotations.push({ type: 'hex width', description: `${width.toFixed(1)} px` })
    // A phone rests at the middle third's scale, a hex never under 33 px.
    expect(width).toBeGreaterThanOrEqual(onPhone() ? 33 - 0.1 : 34.5)
})

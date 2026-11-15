import { expect, test, type Page } from '@playwright/test'
import { board, collectPageErrors, litHexes, openScenario, settled } from './helpers.js'

// The contract's Desktop and Phone layouts: the board cropped to the land, one railroad card (on a
// phone, one supply pile on the rail) per railroad available this round, piles of cubes with no
// number, and a press that spotlights the railroad and, on a phone, opens its holders.
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

test('A desktop card shows its name and its pile alone, the cubes as large as it holds', async ({
    page
}) => {
    test.skip(onPhone(), 'A phone’s rail shows the piles alone.')
    await openScenario(page, 'Purple arrives')
    // Ada and Ben hold Orange, and it has track on the map; the card shows neither.
    const orangeState = await page.evaluate(() => {
        const state = window.rtrSession.gameState
        return {
            held: state.turnManager.turnOrder
                .map((playerId) => state.getPlayerState(playerId).sharesOf('railroad.orange'))
                .reduce((sum, shares) => sum + shares, 0),
            track: Object.values(state.track).filter((railroads) =>
                railroads.includes('railroad.orange')
            ).length
        }
    })
    expect(orangeState.held).toBeGreaterThan(0)
    expect(orangeState.track).toBeGreaterThan(0)
    const orange = railroads(page).getByRole('button', { name: /^Orange: / })
    await expect(orange).toHaveAccessibleName(/^Orange: \d+ left$/)
    await expect(orange).toHaveText(/^\s*Orange\s*$/)
    // The card keeps its height, and a full pile's six columns of five fill the body below the
    // name, 1 px clear of it and of the card's foot.
    for (const card of await railroads(page).getByRole('button').all()) {
        const fit = await card.evaluate((element) => {
            const edge = element.getBoundingClientRect()
            const head = element.firstElementChild?.getBoundingClientRect()
            const pile = element.querySelector('[data-supply-pile]')?.getBoundingClientRect()
            const cube = element.querySelector('[data-supply-pile] rect')?.getBoundingClientRect()
            return {
                height: edge.height,
                pile: pile?.height ?? 0,
                clearOfHead: head && pile ? pile.top - head.bottom : -1,
                clearOfFoot: pile ? edge.bottom - 1 - pile.bottom : -1,
                clearOfSides: pile ? Math.min(pile.left - edge.left, edge.right - pile.right) : -1,
                cube: cube?.width ?? 0
            }
        })
        expect(fit.height).toBeCloseTo(64, 0)
        expect(fit.pile).toBeCloseTo(46, 0)
        expect(fit.clearOfHead).toBeGreaterThanOrEqual(0.5)
        expect(fit.clearOfFoot).toBeGreaterThanOrEqual(0.5)
        expect(fit.clearOfSides).toBeGreaterThan(5)
        if (fit.cube) expect(fit.cube).toBeCloseTo(8.17, 1)
    }
})

test('On a phone a pile opens its railroad’s holders', async ({ page }) => {
    test.skip(!onPhone(), 'The desktop seat cards show the holders.')
    await openScenario(page, 'Purple arrives')
    const popover = page.getByRole('note', { name: 'Orange railroad' })
    await expect(popover).toHaveCount(0)
    // The seat cards are in a drawer off screen, so the pile's name lists the holders too.
    const orange = railroads(page).getByRole('button', { name: /^Orange: / })
    await expect(orange).toHaveAccessibleName(/^Orange: \d+ left, shares (?=.*Ada 1)(?=.*Ben 2)/)
    await orange.tap()
    await expect(popover).toBeVisible()
    await expect(popover).not.toContainText('track')
    await expect(popover).toContainText(/Ada\s*1/)
    await expect(popover).toContainText(/Ben\s*2/)
    await orange.tap()
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
    // A phone rests at the middle third's scale, a hex never under 37 px.
    expect(width).toBeGreaterThanOrEqual(onPhone() ? 37 - 0.1 : 34.5)
    if (!onPhone()) return
    // At that scale the board is taller than its frame too, so it pans north–south at rest.
    const heights = await board(page).evaluate((svg) => {
        let frame: Element | null = svg.parentElement
        while (frame && getComputedStyle(frame).overflow === 'visible') frame = frame.parentElement
        return {
            board: svg.getBoundingClientRect().height,
            frame: frame?.getBoundingClientRect().height ?? Infinity
        }
    })
    expect(heights.board).toBeGreaterThan(heights.frame)
})

/** No control names a part of the map to show: the view moves by pinch, drag, wheel and zoom. */
async function expectNoFocusChooser(page: Page) {
    await expect(page.getByRole('group', { name: 'Focus the map' })).toHaveCount(0)
    for (const name of ['Whole map', 'West', 'Middle', 'East']) {
        await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
    }
}

test('No focus chooser is drawn at any zoom, zoomed fully out included', async ({ page }) => {
    // A small desktop window too, where the whole map draws a hex at its smallest.
    if (!onPhone()) await page.setViewportSize({ width: 900, height: 640 })
    await openScenario(page, 'First placement')
    let box = await settled(page)
    await expectNoFocusChooser(page)
    // Presses a zoom button until the board no longer changes size: as far as it goes.
    const zoom = async (name: string) => {
        const button = page.getByRole('button', { name, exact: true })
        for (let step = 0; step < 20; step++) {
            if (onPhone()) await button.tap()
            else await button.click()
            const next = await settled(page)
            await expectNoFocusChooser(page)
            if (next.width === box.width) return
            box = next
        }
        throw new Error(`${name} never reached its end.`)
    }
    await zoom('Zoom out')
    await zoom('Zoom in')
})

import { expect, test, type Page } from '@playwright/test'
import { board, collectPageErrors, litHexes, openScenario, settled } from './helpers.js'

// The contract's Desktop and Phone layouts: the board cropped to the land, one railroad card per
// railroad available this round on desktop, and on a phone no rail, the piles only where they are
// used (the share buttons, the building seat's railroads); piles of cubes with no number or name,
// and a press that spotlights the railroad.
collectPageErrors()

const onPhone = () => test.info().project.use.isMobile === true

/** The railroad cards above the board, or on a phone the action panel's piles. */
function railroads(page: Page) {
    return page.getByRole('group', { name: 'Railroads' })
}

async function shownRailroads(page: Page): Promise<string[]> {
    const labels = await railroads(page)
        .getByRole('button')
        .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label') ?? ''))
    return labels.map((label) => /^(?:Take an? )?(\w+)/.exec(label)?.[1] ?? label)
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
    test.skip(onPhone(), 'A phone shows the building seat’s railroads alone (next test).')
    await openScenario(page, 'Purple arrives')
    expect(await shownRailroads(page)).toEqual(['Red', 'Blue', 'Orange', 'Yellow', 'Purple'])
})

test('A phone’s build panel shows only the railroads the building seat may place', async ({
    page
}) => {
    // Ada holds Red alone; then Red, Orange and Purple; then Red, Orange and Black.
    for (const [scenario, held] of [
        ['First placement', ['Red']],
        ['Purple arrives', ['Red', 'Orange', 'Purple']],
        ['Black unstarted', ['Red', 'Orange', 'Black']]
    ] as const) {
        await openScenario(page, scenario)
        if (onPhone()) {
            expect(await shownRailroads(page), scenario).toEqual(held)
            await expect(page.getByText(/^0\/[45]$/)).toBeVisible()
        } else {
            // The desktop cards show every railroad of the round, and the panel no pile.
            expect((await shownRailroads(page)).length, scenario).toBeGreaterThan(held.length)
            await expect(page.getByRole('button', { name: 'Build nothing' })).toBeVisible()
            expect(await railroads(page).locator('[data-supply-pile]').count()).toBe(
                (await shownRailroads(page)).length
            )
        }
    }
})

test('Riding shows no piles on a phone', async ({ page }) => {
    await openScenario(page, 'Journey choices')
    await expect(litHexes(page).first()).toBeVisible()
    const piles = page.locator('[data-supply-pile]')
    if (onPhone()) {
        await expect(piles).toHaveCount(0)
    } else {
        await expect(railroads(page).getByRole('button')).not.toHaveCount(0)
        expect(await piles.count()).toBe(await railroads(page).getByRole('button').count())
    }
})

test('No supply count is written on the board, the cards or the piles', async ({ page }) => {
    await openScenario(page, 'Purple arrives')
    await expect(railroads(page).getByRole('button')).toHaveCount(onPhone() ? 3 : 5)
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

test('A desktop card shows its pile alone, with no name, the cubes as large as it holds', async ({
    page
}) => {
    test.skip(onPhone(), 'A phone has no railroad cards.')
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
    // The colour is the label: no name is drawn.
    expect((await orange.innerText()).trim()).toBe('')
    // The card keeps its height, and a full pile's six columns of five stand 56 px tall in it,
    // clear of its top and foot.
    for (const card of await railroads(page).getByRole('button').all()) {
        const fit = await card.evaluate((element) => {
            const edge = element.getBoundingClientRect()
            const pile = element.querySelector('[data-supply-pile]')?.getBoundingClientRect()
            const cube = element.querySelector('[data-supply-pile] rect')?.getBoundingClientRect()
            return {
                height: edge.height,
                pile: pile?.height ?? 0,
                clearOfTop: pile ? pile.top - edge.top - 1 : -1,
                clearOfFoot: pile ? edge.bottom - 1 - pile.bottom : -1,
                clearOfSides: pile ? Math.min(pile.left - edge.left, edge.right - pile.right) : -1,
                cube: cube?.width ?? 0
            }
        })
        expect(fit.height).toBeCloseTo(64, 0)
        expect(fit.pile).toBeCloseTo(56, 0)
        expect(fit.clearOfTop).toBeGreaterThanOrEqual(2)
        expect(fit.clearOfFoot).toBeGreaterThanOrEqual(2)
        expect(fit.clearOfSides).toBeGreaterThan(5)
        if (fit.cube) expect(fit.cube).toBeCloseTo(9.95, 1)
    }
})

test('A phone has no supply rail: the board takes the game column’s width', async ({ page }) => {
    test.skip(!onPhone(), 'The desktop shows the railroad cards above the board.')
    await page.setViewportSize({ width: 390, height: 844 })
    await openScenario(page, 'Purple arrives')
    await expect(page.locator('.phone-rail')).toHaveCount(0)
    await expect(page.getByRole('note')).toHaveCount(0)
    const fit = await board(page).evaluate((svg) => {
        let frame: Element | null = svg.parentElement
        while (frame && getComputedStyle(frame).overflow === 'visible') frame = frame.parentElement
        const view = frame?.getBoundingClientRect()
        const panel = document
            .querySelector('[data-rtr-table] .rounded-xl')
            ?.getBoundingClientRect()
        return { left: view?.left ?? 0, right: view?.right ?? 0, panelRight: panel?.right ?? 0 }
    })
    // The board's view reaches the action panel's right edge: nothing stands beside it.
    expect(fit.right).toBeGreaterThanOrEqual(fit.panelRight - 1)
    expect(fit.right - fit.left).toBeGreaterThanOrEqual(343 - 1)
})

test('A phone’s board rests at least 343 × 593 px on a round 5 building turn', async ({ page }) => {
    test.skip(!onPhone(), 'The phone layout’s target.')
    await page.setViewportSize({ width: 390, height: 844 })
    await openScenario(page, 'Black unstarted')
    await settled(page)
    const view = await board(page).evaluate((svg) => {
        let frame: Element | null = svg.parentElement
        while (frame && getComputedStyle(frame).overflow === 'visible') frame = frame.parentElement
        const box = frame?.getBoundingClientRect()
        return { width: box?.width ?? 0, height: box?.height ?? 0 }
    })
    test.info().annotations.push({
        type: 'board view',
        description: `${view.width.toFixed(1)} × ${view.height.toFixed(1)} px`
    })
    // The layout's target for a building turn at 390 × 844: 343 × 593.
    expect(view.width).toBeGreaterThanOrEqual(343 - 1)
    expect(view.height).toBeGreaterThanOrEqual(593 - 1)
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

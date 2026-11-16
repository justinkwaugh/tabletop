import { expect, test, type Page } from '@playwright/test'
import type { RailroadId } from '@tabletop/ride-the-rails'
import { board, collectPageErrors, litHexes, litLabels, openScenario, settled } from './helpers.js'

// The contract's table and Phone layout (scenarios 25 and 27): the board in its band of sea, one
// railroad card per railroad available this round on desktop, and on a phone no rail, the supply
// only where it is used (the share buttons, the building seat's railroads); each card a cube and
// the number left with no name, and a press that spotlights the railroad.
collectPageErrors()

const onPhone = () => test.info().project.use.isMobile === true

/** The railroad cards above the board, or on a phone the action panel's share buttons or build cards. */
function railroads(page: Page) {
    return page.getByRole('group', { name: 'Railroads' })
}

async function shownRailroads(page: Page): Promise<string[]> {
    const labels = await railroads(page)
        .getByRole('button')
        .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label') ?? ''))
    return labels.map((label) => /^(?:Take an? )?(\w+)/.exec(label)?.[1] ?? label)
}

/** R-1.1: a railroad's locomotives neither held as shares nor on the map. */
function supplyOf(page: Page, railroadId: RailroadId): Promise<number> {
    return page.evaluate((id) => {
        const state = window.rtrSession.gameState
        const shares = state.players.reduce((sum, player) => sum + player.sharesOf(id), 0)
        const track = Object.values(state.track)
            .flat()
            .filter((railroad) => railroad === id).length
        return 27 - shares - track
    }, railroadId)
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
            // The count and Skip on one line, the cards below.
            await expect(page.getByText(/^0 \/ [45]$/)).toBeVisible()
            await expect(page.getByRole('button', { name: 'Skip', exact: true })).toBeVisible()
        } else {
            // The desktop cards show every railroad of the round, and the panel no card.
            const shown = await shownRailroads(page)
            expect(shown.length, scenario).toBeGreaterThan(held.length)
            await expect(railroads(page)).toHaveCount(1)
            await expect(page.getByRole('button', { name: 'Skip', exact: true })).toBeVisible()
            await expect(railroads(page).locator('.supply')).toHaveCount(shown.length)
            // R-3.2.2: on the viewer's building turn a railroad they hold no share of is faded.
            for (const button of await railroads(page).getByRole('button').all()) {
                const name = /^(\w+):/.exec((await button.getAttribute('aria-label')) ?? '')?.[1]
                const opacity = await button.evaluate(
                    (element) => getComputedStyle(element.parentElement ?? element).opacity
                )
                expect(opacity, `${scenario}: ${name}`).toBe(
                    held.some((railroad) => railroad === name) ? '1' : '0.4'
                )
            }
        }
    }
})

test('Riding shows no supply on a phone', async ({ page }) => {
    await openScenario(page, 'Journey choices')
    await expect(litHexes(page).first()).toBeVisible()
    const supplies = page.locator('.supply:visible')
    if (onPhone()) {
        await expect(supplies).toHaveCount(0)
    } else {
        await expect(railroads(page).getByRole('button')).not.toHaveCount(0)
        expect(await supplies.count()).toBe(await railroads(page).getByRole('button').count())
    }
})

test('27. Each railroad card is one cube and the number left, with no name', async ({ page }) => {
    await openScenario(page, 'Purple arrives')
    await expect(railroads(page).getByRole('button')).toHaveCount(onPhone() ? 3 : 5)
    const state = Object.fromEntries(
        await Promise.all(
            (
                [
                    'railroad.red',
                    'railroad.blue',
                    'railroad.orange',
                    'railroad.yellow',
                    'railroad.purple'
                ] as const
            ).map(async (railroadId) => [railroadId, await supplyOf(page, railroadId)] as const)
        )
    )
    for (const card of await railroads(page).getByRole('button').all()) {
        const label = (await card.getAttribute('aria-label')) ?? ''
        const [, name, count] = /^(\w+): (\d+) left$/.exec(label) ?? []
        expect(name, label).toBeDefined()
        expect(Number(count)).toBe(state[`railroad.${name?.toLowerCase()}`])
        // The colour is the label: the card draws its count and nothing else, no name or "left".
        expect((await card.innerText()).trim()).toBe(count)
        await expect(card.locator('.supply .cube')).toHaveCount(1)
    }
    // The board writes no supply.
    expect((await board(page).textContent()) ?? '').not.toMatch(/\d+\s+left|none left/)
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

test('A desktop card is 66 × 34 px, 4 px apart, with no holders and no track', async ({ page }) => {
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
    const supply = await supplyOf(page, 'railroad.orange')
    expect(orangeState.held).toBeGreaterThan(0)
    expect(orangeState.track).toBeGreaterThan(0)
    const orange = railroads(page).getByRole('button', { name: /^Orange: / })
    await expect(orange).toHaveAccessibleName(`Orange: ${supply} left`)
    expect((await orange.innerText()).trim()).toBe(String(supply))
    const boxes = await railroads(page)
        .getByRole('button')
        .evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().toJSON()))
    for (const [index, box] of boxes.entries()) {
        expect(box.width).toBeCloseTo(66, 0)
        expect(box.height).toBeCloseTo(34, 0)
        const next = boxes[index + 1]
        if (next) expect(next.left - box.right).toBeCloseTo(4, 0)
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

test('A phone’s board rests at least 343 × 560 px on a round 5 building turn', async ({ page }) => {
    // The contract's Phone layout: the build panel's railroad cards sit on a second row below
    // the count and Skip, leaving the board 343 × 560 at 390 × 844.
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
    // The layout's target for a building turn at 390 × 844: 343 × 560.
    expect(view.width).toBeGreaterThanOrEqual(343 - 1)
    expect(view.height).toBeGreaterThanOrEqual(560 - 1)
})

test('No city is named on the board, a lit one neither', async ({ page }) => {
    await openScenario(page, 'Purple arrives')
    await expect(litHexes(page).first()).toBeVisible()
    await expect(board(page).locator('.city-labels')).toHaveCount(0)
    // The lit hexes' accessible names still say the place.
    expect((await litLabels(page)).some((label) => label.startsWith('Seattle:'))).toBe(true)
    // The start legend's rules name Chicago and the coasts; no text on the map itself names a city.
    const drawn = await board(page)
        .locator('text')
        .evaluateAll((texts) =>
            texts.flatMap((text) =>
                text.closest('[data-start-legend]') ? [] : [text.textContent ?? '']
            )
        )
    for (const city of [
        'Seattle',
        'San Francisco',
        'Los Angeles',
        'Portland',
        'Denver',
        'Chicago',
        'New York'
    ]) {
        expect(drawn.filter((text) => text.includes(city))).toEqual([])
    }
})

test('The board is drawn as large as the layout allows', async ({ page }) => {
    // The layout's targets: at 1440 × 900 the whole map fitted to its frame, its band of sea
    // (BOARD_MARGIN, 40 board units) included, a hex about 33.6 px; at 390 × 844 at least 37 px
    // at rest.
    await page.setViewportSize(
        onPhone() ? { width: 390, height: 844 } : { width: 1440, height: 900 }
    )
    await openScenario(page, 'Transcontinental in reach')
    await settled(page)
    const width = await hexWidth(page)
    test.info().annotations.push({ type: 'hex width', description: `${width.toFixed(1)} px` })
    // A phone rests at the middle third's scale, a hex never under 37 px.
    expect(width).toBeGreaterThanOrEqual(onPhone() ? 37 - 0.1 : 33.5)
    if (!onPhone()) {
        // The whole map fills its frame's width or height: nothing larger would fit.
        const fit = await board(page).evaluate((svg) => {
            let frame: Element | null = svg.parentElement
            while (frame && getComputedStyle(frame).overflow === 'visible') {
                frame = frame.parentElement
            }
            const box = svg.getBoundingClientRect()
            const view = frame?.getBoundingClientRect()
            return {
                spareWidth: (view?.width ?? 0) - box.width,
                spareHeight: (view?.height ?? 0) - box.height
            }
        })
        expect(fit.spareWidth).toBeGreaterThanOrEqual(-1)
        expect(fit.spareHeight).toBeGreaterThanOrEqual(-1)
        expect(Math.min(fit.spareWidth, fit.spareHeight)).toBeLessThan(1)
        return
    }
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

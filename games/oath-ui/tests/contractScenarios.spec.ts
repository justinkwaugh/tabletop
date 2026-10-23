import { expect, test, type Locator, type Page } from '@playwright/test'
import type * as TableFixture from '../src/lib/testing/tableFixture.js'

type Fixture = typeof TableFixture

async function call<K extends keyof Fixture>(
    page: Page,
    name: K,
    ...args: Parameters<Fixture[K]>
): Promise<Awaited<ReturnType<Fixture[K]>>> {
    return page.evaluate(
        async ({ name, args }) => {
            const fixture = await import(
                new URL('/src/lib/testing/tableFixture.ts', location.href).href
            )
            return fixture[name](...args)
        },
        { name, args }
    )
}

async function openTable(page: Page, name: TableFixture.TableName) {
    await page.goto('/')
    return call(page, 'open', name)
}

/** The first card of `selector` whose centre is not under another layer, such as the side column. */
async function uncovered(page: Page, selector: string) {
    const index = await page.evaluate((selector) => {
        return [...document.querySelectorAll(selector)].findIndex((card) => {
            const box = card.getBoundingClientRect()
            const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
            return top !== null && card.contains(top)
        })
    }, selector)
    if (index < 0) throw Error(`No ${selector} is uncovered`)
    return page.locator(selector).nth(index)
}

const preview = (page: Page) => page.locator('.card-preview')
const panelCards = (page: Page) => page.locator('.panel button:not(.magnifier)')
const magnifiers = (page: Page) => page.locator('.panel button.magnifier')

/** docs/ui-interaction-visual-contract.md, rules 1 and 4 and scenarios 7, 24 and 44, on touch. */
test.describe('on touch', () => {
    test.use({ hasTouch: true, viewport: { width: 1024, height: 768 } })

    test('scenario 7: a panel card’s magnifier enlarges it and the next tap closes it; a tap on the card picks it', async ({
        page
    }) => {
        await openTable(page, 'setup')
        await expect(page.getByText('Keep one.', { exact: true })).toBeVisible()
        await magnifiers(page).first().tap()
        await expect(preview(page)).toBeVisible()
        await expect(page.locator('[aria-pressed="true"]')).toHaveCount(0)

        await page.touchscreen.tap(20, 20)
        await expect(preview(page)).toHaveCount(0)
        await panelCards(page).first().tap()
        await expect(
            page.getByText('Tap to discard; the last goes on top.', { exact: true })
        ).toBeVisible()
        await expect(preview(page)).toHaveCount(0)
    })

    test('scenario 44: a tap on a lit Travel site’s magnifier enlarges it and travels nowhere; the next tap closes it', async ({
        page
    }) => {
        await openTable(page, 'actPhase')
        await tile(page, 'Travel').click()
        await expect(page.getByText('Tap a lit site.', { exact: true })).toBeVisible()
        await (await uncovered(page, '.site .site-magnifier')).tap()
        await expect(preview(page)).toBeVisible()
        expect((await call(page, 'tableFacts')).siteOf.me).toBe('slot.cradle.0')

        await page.touchscreen.tap(20, 20)
        await expect(preview(page)).toHaveCount(0)
        expect((await call(page, 'tableFacts')).siteOf.me).toBe('slot.cradle.0')
        await expect(page.getByText('Tap a lit site.', { exact: true })).toBeVisible()
    })

    test('scenario 41: with Muster chosen, a tap on a ringed denizen enlarges it and musters nothing', async ({
        page
    }) => {
        await openTable(page, 'trade')
        await tile(page, 'Muster').tap()
        const musters = page.getByRole('list', { name: 'Musters at your site' })
        await expect(musters).toBeVisible()
        const before = await call(page, 'tableFacts')
        await (await uncovered(page, '.board-card.offered')).tap()
        await expect(preview(page)).toBeVisible()
        expect(await call(page, 'tableFacts')).toEqual(before)
        await page.touchscreen.tap(20, 20)
        await expect(preview(page)).toHaveCount(0)
        await expect(musters).toBeVisible()
    })

    test('scenario 44: in a Search, a drawn card’s magnifier enlarges it unpicked; the next tap closes it; a tap on the card picks it', async ({
        page
    }) => {
        await openTable(page, 'searching')
        await magnifiers(page).first().tap()
        await expect(preview(page)).toBeVisible()
        expect(await call(page, 'searchPicks')).toEqual({})
        await page.touchscreen.tap(20, 20)
        await expect(preview(page)).toHaveCount(0)
        expect(await call(page, 'searchPicks')).toEqual({})
        await panelCards(page).first().tap()
        await expect.poll(async () => (await call(page, 'searchPicks')).kept).toBeDefined()
    })

    test('scenario 24: an enlarged card closes when its card leaves the table, and the new offers show with no ring left over', async ({
        page
    }) => {
        await openTable(page, 'setup')
        await magnifiers(page).first().tap()
        await expect(preview(page)).toBeVisible()

        await call(page, 'seatMakesSetupChoice')
        await expect(preview(page)).toHaveCount(0)
        await expect(
            page.getByText('Pick a start site and a card to keep.', { exact: true })
        ).toBeVisible()
        await expect(page.locator('[aria-pressed="true"]')).toHaveCount(0)
    })

    test('scenario 24: an enlarged card over a card still on the table stays, while the picks under it end', async ({
        page
    }) => {
        await openTable(page, 'searching')
        await panelCards(page).first().tap()
        await expect(page.getByText('How do you play it?', { exact: false })).toBeVisible()
        await (await uncovered(page, '.board-card:not(.offered)')).tap()
        await expect(preview(page)).toBeVisible()

        await call(page, 'anotherSeatLetsPeek')
        await expect(preview(page)).toBeVisible()
        expect(await call(page, 'searchPicks')).toEqual({})
    })
})

/** Rule 4 with a mouse: a hover opens nothing, a click enlarges, Escape closes. */
test('scenario 44: a hover opens nothing; a click on a card on the table enlarges it; Escape closes it', async ({
    page
}) => {
    await openTable(page, 'trade')
    const denizen = page
        .locator('.board-card')
        .filter({ has: page.getByRole('img', { name: 'Book Binders', exact: true }) })
    const hovered = [
        denizen,
        await uncovered(page, '.site .board-card'),
        await uncovered(page, '.banner'),
        page.getByRole('img', { name: 'A Round of Ale' }).first()
    ]
    for (const target of hovered) {
        await target.hover()
        await page.waitForTimeout(400)
        await expect(preview(page)).toHaveCount(0)
    }
    const card = denizen
    await card.click()
    await expect(preview(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(preview(page)).toHaveCount(0)
})

test('scenario 41: with Recover chosen, a click on a banner on the rail or on its row’s magnifier enlarges it and stages nothing', async ({
    page
}) => {
    await openTable(page, 'trade')
    await tile(page, 'Recover').click()
    const banners = page.getByRole('list', { name: 'Banners to recover' })
    await expect(banners).toBeVisible()
    await (await uncovered(page, '.banner')).click()
    await expect(preview(page)).toBeVisible()
    await expect(grid(page).getByRole('button', { name: /^pay \d+ favor$/ })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(preview(page)).toHaveCount(0)
    await expect(banners).toBeVisible()

    await banners.getByRole('button', { name: 'Enlarge the People’s Favor', exact: true }).click()
    await expect(preview(page)).toBeVisible()
    await expect(grid(page).getByRole('button', { name: /^pay \d+ favor$/ })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(preview(page)).toHaveCount(0)
    await expect(banners).toBeVisible()
})

test('scenario 44: the click that closes an enlarged card does nothing else, even over a menu row', async ({
    page
}) => {
    await openTable(page, 'actPhase')
    await tile(page, 'Search').click()
    const go = page.getByRole('list', { name: 'Sources to search' }).getByRole('button').first()
    await expect(go).toBeVisible()
    const row = await go.boundingBox()
    if (!row) throw Error('The source’s button is on screen')
    await (await uncovered(page, '.board-card')).click()
    await expect(preview(page)).toBeVisible()
    await page.mouse.click(row.x + row.width / 2, row.y + row.height / 2)
    await expect(preview(page)).toHaveCount(0)
    expect((await call(page, 'tableFacts')).machineState).toBe('ActPhase')
    await expect(go).toBeVisible()
})

test('scenario 44: the keyboard reaches the panel’s magnifiers and never a card on the table; Enter enlarges, Escape closes', async ({
    page
}) => {
    await openTable(page, 'setup')
    await expect(magnifiers(page).first()).toBeVisible()
    let onMagnifier = false
    for (let press = 0; press < 80 && !onMagnifier; press++) {
        await page.keyboard.press('Tab')
        const focus = await page.evaluate(() => ({
            onTableCard: document.activeElement?.closest('.board-card') != null,
            onMagnifier: document.activeElement?.classList.contains('magnifier') ?? false
        }))
        expect(focus.onTableCard).toBe(false)
        onMagnifier = focus.onMagnifier
    }
    expect(onMagnifier).toBe(true)
    await page.keyboard.press('Enter')
    await expect(preview(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(preview(page)).toHaveCount(0)
})

/** Scenario 52: a wide card runs to its source art. */
test('scenario 52: a banner enlarges to its 920 px source on a desktop', async ({ page }) => {
    await openTable(page, 'trade')
    await (await uncovered(page, '.banner')).click()
    const shown = preview(page).locator('img').first()
    await expect(shown).toBeVisible()
    expect(Math.round((await shown.boundingBox())?.width ?? 0)).toBe(920)
})

/** Scenario 53: an enlarged site says what it does, its printed symbols drawn. */
test('scenario 53: an enlarged site shows its sentence under it, with the suit and favor as symbols', async ({
    page
}) => {
    await openTable(page, 'setup')
    await (await uncovered(page, '.site .board-card')).click()
    const sentence = preview(page).locator('.site-sentence')
    await expect(sentence).toContainText('card to this site, and you have not discarded a')
    await expect(sentence.getByRole('img', { name: 'Hearth' })).toHaveCount(2)
    await expect(sentence.getByRole('img', { name: 'favor' })).toHaveCount(1)
    await page.keyboard.press('Escape')
    await (await uncovered(page, '.site .board-card:has(img[alt^="Facedown site"])')).click()
    await expect(preview(page)).toBeVisible()
    await expect(preview(page).locator('.site-sentence')).toHaveCount(0)
})

/** Scenario 24 with a mouse: a remote Action lands while a card is enlarged. */
test('scenario 24: an enlarged card closes when its card leaves the table, and the new offers show with no ring left over', async ({
    page
}) => {
    await openTable(page, 'setup')
    await magnifiers(page).first().click()
    const shown = preview(page).locator('img').first()
    await expect(shown).toBeVisible()
    const name = await shown.getAttribute('alt')

    await call(page, 'seatMakesSetupChoice')
    await expect(
        page.getByText('Pick a start site and a card to keep.', { exact: true })
    ).toBeVisible()
    await expect(preview(page).locator(`img[alt="${name}"]`)).toHaveCount(0)
    await expect(page.locator('[aria-pressed="true"]')).toHaveCount(0)
})

/** Scenario 25: another seat's Action processed mid-pick, as a Search is under way. */
test('scenario 25: another seat acting mid-pick starts the Search panel again with nothing picked', async ({
    page
}) => {
    await openTable(page, 'searching')
    await panelCards(page).first().click()
    await page.getByRole('button', { name: 'Discard', exact: true }).click()
    await expect(
        page.getByText('Tap to discard; the last goes on top.', { exact: true })
    ).toBeVisible()
    expect((await call(page, 'searchPicks')).placement).toBe('discard')

    await call(page, 'anotherSeatLetsPeek')
    expect(await call(page, 'searchPicks')).toEqual({})
    await expect(page.getByText('Keep one.', { exact: true })).toBeVisible()
})

/** Scenario 16: a second question after the first starts with nothing picked. */
test('scenario 16: after one False Prophet question is answered, the next offers the same advisers with none picked', async ({
    page
}) => {
    await openTable(page, 'prophets')
    const row = page.getByText('discard 1 first', { exact: false }).locator('..')
    await row.getByRole('button').first().click()
    const picked = await call(page, 'questionPicks')
    expect(picked.visionDiscard).toBeDefined()
    expect(picked.queued).toBe(2)

    await page.getByRole('button', { name: 'Discard', exact: true }).click()
    await expect.poll(async () => (await call(page, 'questionPicks')).queued).toBe(1)
    const next = await call(page, 'questionPicks')
    expect(next.visionDiscard).toBeUndefined()
    expect(next.offered).toEqual(picked.offered)
    await expect(page.locator('[aria-pressed="true"]')).toHaveCount(0)
})

/** Coexistence: off the clock the seat card's Let another peek opens the picker alone. */
test('let another peek off the clock: the seat card opens the picker and stages nothing', async ({
    page
}) => {
    await openTable(page, 'offTurn')
    expect(await call(page, 'viewOffTheClock')).toBe('me')
    await page.getByRole('button', { name: 'Let another peek', exact: true }).click()
    expect(await call(page, 'letPeekState')).toEqual({ open: true, staged: false })
})

const grid = (page: Page) => page.locator('.panel')
const undoButton = (page: Page) => page.getByRole('button', { name: 'Undo', exact: true })
/** docs/user-interactions.md — Undo is the one reversal control, so no panel renders a Back or a step-cancel. */
const stepBacks = (page: Page) => page.getByRole('button', { name: /^(Back|Cancel)\b/ })
const tile = (page: Page, label: string) =>
    grid(page).locator('.majors button').filter({ hasText: label })
const reasonLine = (page: Page) => grid(page).locator('.strip')
const boardOffers = (page: Page) => page.locator('.board-card.offered')
const dimmedSites = (page: Page) => page.locator('.site.dimmed')
const answer = (page: Page, name: string) => grid(page).getByRole('button', { name, exact: true })
const question = (page: Page) => grid(page).locator('p').filter({ hasText: '?' })

async function restMouse(page: Page) {
    await page.mouse.move(2, 2)
}

/** A dimmed tile is `aria-disabled`, which Playwright treats as not clickable, yet it takes the tap. */
async function tapDimmed(tile: ReturnType<Page['locator']>) {
    await tile.click({ force: true })
}

/**
 * A count is a row of warband pieces per group, the Nth named "N of the … warbands …"; a tap on the
 * Nth sets N. `group` counts the rows that hold an Nth piece.
 */
async function pickCount(page: Page, group: number, value: number) {
    await grid(page)
        .getByRole('button', { name: new RegExp(`^${value} of the `) })
        .nth(group)
        .click()
}
/** Every row has a first piece. */
const countRows = (page: Page) => grid(page).getByRole('button', { name: /^1 of the / })

/** Scenario 29: the one line under the Act Phase grid. */
test('scenario 29: a hover writes the summary, a dimmed tile the reason; a hover replaces the reason and a new state clears it', async ({
    page
}) => {
    await openTable(page, 'actPhase')
    const muster = tile(page, 'Muster')
    const travel = tile(page, 'Travel')
    await expect(muster).toHaveAttribute('aria-disabled', 'true')

    await travel.hover()
    await expect(reasonLine(page)).toHaveText('Move your pawn.')
    await restMouse(page)
    await expect(reasonLine(page)).toHaveText('')

    await tapDimmed(muster)
    await expect(reasonLine(page)).toHaveText('No card here.')
    await travel.hover()
    await expect(reasonLine(page)).toHaveText('Move your pawn.')
    await restMouse(page)
    await expect(reasonLine(page)).toHaveText('')

    await tapDimmed(muster)
    await restMouse(page)
    await expect(reasonLine(page)).toHaveText('No card here.')
    await muster.hover()
    await expect(reasonLine(page)).toHaveText('No card here.')
    await restMouse(page)
    await expect(boardOffers(page)).toHaveCount(0)
    await expect(dimmedSites(page)).toHaveCount(0)

    await call(page, 'anotherSeatLetsPeek')
    await expect(reasonLine(page)).toHaveText('')
    await expect(muster).toHaveAttribute('aria-disabled', 'true')

    await tapDimmed(muster)
    await restMouse(page)
    await expect(reasonLine(page)).toHaveText('No card here.')
    await call(page, 'seatTravels', 'slot.cradle.1')
    await expect(muster).toHaveAttribute('aria-disabled', 'false')
    await expect(reasonLine(page)).toHaveText('')
    await expect(boardOffers(page)).toHaveCount(0)
    await expect(dimmedSites(page)).toHaveCount(0)
})

test('the grid lists the six majors and only the minors that can be taken, under the Supply, with End Act Phase; a dimmed major under the pointer says why', async ({
    page
}) => {
    await openTable(page, 'actPhase')
    await expect(grid(page).locator('.majors button')).toHaveCount(6)
    await expect(grid(page).locator('.minors button')).toHaveCount(0)
    await expect(grid(page).locator('h3')).toHaveText('Supply 7')
    await expect(
        grid(page).getByRole('button', { name: 'End Act Phase', exact: true })
    ).toBeVisible()
    await tile(page, 'Muster').hover()
    await expect(reasonLine(page)).toHaveText('No card here.')
    await restMouse(page)
    await expect(reasonLine(page)).toHaveText('')

    await openTable(page, 'advisers')
    const minors = grid(page).locator('.minors button')
    await expect(minors).toHaveText(['Adviser', 'Show'])
    for (const minor of await minors.all())
        await expect(minor).not.toHaveAttribute('aria-disabled', 'true')
})

/** Each minor chip as drawn: its layout box, its label's lines and whether they stay inside its content box. */
async function minorChips(page: Page) {
    await expect(grid(page).locator('.minors button').first()).toBeVisible()
    return grid(page)
        .locator('.minors button')
        .evaluateAll((chips: HTMLElement[]) =>
            chips.map((chip) => {
                const box = chip.getBoundingClientRect()
                const style = getComputedStyle(chip)
                const scale = box.width / chip.offsetWidth
                const inset = (side: 'Left' | 'Right' | 'Top' | 'Bottom') =>
                    (parseFloat(style.getPropertyValue(`padding-${side.toLowerCase()}`)) +
                        parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`))) *
                    scale
                const text = document.createRange()
                text.selectNodeContents(chip)
                const lines = [...text.getClientRects()].filter((line) => line.width > 0)
                const slack = 0.5
                return {
                    label: chip.textContent?.trim() ?? '',
                    width: chip.offsetWidth,
                    height: chip.offsetHeight,
                    fontSize: style.fontSize,
                    lines: new Set(lines.map((line) => Math.round(line.top))).size,
                    inside: lines.every(
                        (line) =>
                            line.left >= box.left + inset('Left') - slack &&
                            line.right <= box.right - inset('Right') + slack &&
                            line.top >= box.top + inset('Top') - slack &&
                            line.bottom <= box.bottom - inset('Bottom') + slack
                    ),
                    left: box.left,
                    top: box.top,
                    bottom: box.bottom
                }
            })
        )
}

async function majorsBox(page: Page) {
    const box = await grid(page).locator('.majors').boundingBox()
    if (!box) throw Error('The majors are not drawn')
    return box
}

const SEVEN_MINORS = [
    'Adviser',
    'Use a power',
    'Peek',
    'Show',
    'Move warbands',
    'Offer Citizenship',
    'Exile Citizen'
]

function expectChipsFit(chips: Awaited<ReturnType<typeof minorChips>>, phone: boolean) {
    for (const chip of chips) {
        expect(chip.inside, `“${chip.label}” stays inside its button`).toBe(true)
        expect(chip.width, `“${chip.label}” is the group’s one width`).toBe(chips[0].width)
        if (phone) {
            expect(chip.height, `“${chip.label}” is 44 px tall`).toBeGreaterThanOrEqual(44)
            expect(chip.lines, `“${chip.label}” takes at most two lines`).toBeLessThanOrEqual(2)
            expect(chip.fontSize).toBe('12px')
        }
    }
}

/** Rows of chips, by the top of each. */
function rowsOf(chips: Awaited<ReturnType<typeof minorChips>>): number[] {
    const rows = new Map<number, number>()
    for (const chip of chips)
        rows.set(Math.round(chip.top), (rows.get(Math.round(chip.top)) ?? 0) + 1)
    return [...rows.values()]
}

for (const viewport of [
    { width: 402, height: 874 },
    { width: 375, height: 812 }
]) {
    test(`on a phone ${viewport.width} wide the minors stand beside the majors, one per line, one width, each label inside its button`, async ({
        page
    }) => {
        await page.setViewportSize(viewport)
        await openTable(page, 'everyMinor')
        await expect(grid(page).locator('.minors button')).toHaveText(SEVEN_MINORS)
        const chips = await minorChips(page)
        expectChipsFit(chips, true)
        const majors = await majorsBox(page)
        for (const [index, chip] of chips.entries()) {
            expect(chip.left).toBeGreaterThan(majors.x + majors.width)
            expect(chip.left).toBeCloseTo(chips[0].left, 0)
            if (index > 0) expect(chip.top).toBeGreaterThan(chips[index - 1].bottom)
        }
    })
}

test('on a narrow phone the minors drop under the majors, two to a row at the widest label’s width, one line each', async ({
    page
}) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await openTable(page, 'everyMinor')
    const chips = await minorChips(page)
    expectChipsFit(chips, true)
    const majors = await majorsBox(page)
    for (const chip of chips) {
        expect(chip.top).toBeGreaterThan(majors.y + majors.height)
        expect(chip.lines).toBe(1)
    }
    expect(rowsOf(chips)).toEqual([2, 2, 2, 1])
})

for (const { viewport, perRow } of [
    { viewport: { width: 812, height: 375 }, perRow: [4, 3] },
    { viewport: { width: 667, height: 375 }, perRow: [3, 3, 1] }
]) {
    test(`held sideways at ${viewport.width} the minors stand under the majors, as many to a row as keep each word whole`, async ({
        page
    }) => {
        await page.setViewportSize(viewport)
        await openTable(page, 'everyMinor')
        const chips = await minorChips(page)
        expectChipsFit(chips, true)
        const majors = await majorsBox(page)
        for (const chip of chips) expect(chip.top).toBeGreaterThan(majors.y + majors.height)
        expect(rowsOf(chips)).toEqual(perRow)
    })
}

for (const viewport of [
    { width: 402, height: 874 },
    { width: 320, height: 568 },
    { width: 667, height: 375 }
]) {
    test(`a Citizen’s “Exile yourself” stays inside its button at ${viewport.width} wide`, async ({
        page
    }) => {
        await page.setViewportSize(viewport)
        await openTable(page, 'selfExile')
        await expect(
            grid(page).locator('.minors button').filter({ hasText: 'Exile yourself' })
        ).toBeVisible()
        expectChipsFit(await minorChips(page), true)
    })
}

test('on a desktop the minors share the widest one’s width, each label on one line', async ({
    page
}) => {
    await openTable(page, 'everyMinor')
    const chips = await minorChips(page)
    expectChipsFit(chips, false)
    for (const chip of chips) expect(chip.lines).toBe(1)
    expect(rowsOf(chips)).toEqual([7])
})

test('a free Travel due: one line beside Skip, Travel lit at no Supply, every other tile dimmed and saying the free Travel comes first', async ({
    page
}) => {
    await openTable(page, 'freeTravel')
    await expect(grid(page).locator('.due')).toHaveText(/^\s*Free Travel next\.\s*Skip\s*$/)
    await expect(tile(page, 'Travel')).toHaveAttribute('aria-disabled', 'false')
    await expect(tile(page, 'Travel')).toContainText('no Supply')
    await expect(grid(page).locator('.minors button')).toHaveCount(0)
    for (const label of ['Search', 'Muster', 'Trade', 'Recover', 'Campaign']) {
        await expect(tile(page, label)).toHaveAttribute('aria-disabled', 'true')
    }
    await tapDimmed(tile(page, 'Search'))
    await restMouse(page)
    await expect(reasonLine(page)).toHaveText('Free Travel first.')
})

test('Undo reads "Undo" and has no hover, both for a sent move and for a pick', async ({
    page
}) => {
    await openTable(page, 'actPhase')
    const undo = undoButton(page)
    await expect(undo).toHaveCount(0)

    await call(page, 'seatTravels', 'slot.cradle.1')
    await expect(undo).toHaveText('Undo')
    await expect(undo).not.toHaveAttribute('title')

    await tile(page, 'Travel').click()
    await expect(undo).toHaveText('Undo')
    await expect(undo).not.toHaveAttribute('title')
})

/** The turn bar's main line and the words after it, whitespace collapsed. */
async function turnBar(page: Page): Promise<string[]> {
    const lines = await page.locator('.info > div > span').allTextContents()
    return lines.map((line) => line.replace(/\s+/g, ' ').trim())
}

/** The turn bar names whose turn it is and the turn's phase, whichever seat the engine waits on. */
test.describe('the turn bar', () => {
    test('a card asks a seat on another seat’s turn: the bar names the turn and its phase', async ({
        page
    }) => {
        await openTable(page, 'askedOffTurn')
        expect((await call(page, 'tableFacts')).seatId).toBe('ann')
        await expect.poll(() => turnBar(page)).toEqual(["dev's turn", 'Act Phase'])
        expect(await call(page, 'viewOffTheClock')).toBe('dev')
        await expect.poll(() => turnBar(page)).toEqual(['Your turn', 'Act Phase'])
    })

    test('a seat asks another for permission on its own turn: the bar names the asker’s turn', async ({
        page
    }) => {
        await openTable(page, 'warbandMoveAsked')
        expect((await call(page, 'tableFacts')).seatId).toBe('chan')
        await expect.poll(() => turnBar(page)).toEqual(["cit's turn", 'Act Phase'])
        expect(await call(page, 'viewOffTheClock')).toBe('cit')
        await expect.poll(() => turnBar(page)).toEqual(['Your turn', 'Act Phase'])
    })

    test('the defender’s battle plans: the bar names the attacker’s turn', async ({ page }) => {
        await openTable(page, 'defenderPlans')
        expect((await call(page, 'tableFacts')).seatId).toBe('def')
        await expect.poll(() => turnBar(page)).toEqual(["att's turn", 'Act Phase'])
        expect(await call(page, 'viewOffTheClock')).toBe('att')
        await expect.poll(() => turnBar(page)).toEqual(['Your turn', 'Act Phase'])
    })

    test('the defending side’s losses: the bar names the attacker’s turn', async ({ page }) => {
        await openTable(page, 'exileDefeated')
        expect((await call(page, 'tableFacts')).seatId).toBe('def')
        await expect.poll(() => turnBar(page)).toEqual(["att's turn", 'Act Phase'])
        expect(await call(page, 'viewOffTheClock')).toBe('att')
        await expect.poll(() => turnBar(page)).toEqual(['Your turn', 'Act Phase'])
    })

    test('the Oathkeeper title’s choice on another seat’s turn: the bar names the turn', async ({
        page
    }) => {
        await openTable(page, 'oathkeeperChoice')
        expect((await call(page, 'tableFacts')).seatId).toBe('ann')
        await expect.poll(() => turnBar(page)).toEqual(["dev's turn", 'Act Phase'])
        expect(await call(page, 'viewOffTheClock')).toBe('dev')
        await expect.poll(() => turnBar(page)).toEqual(['Your turn', 'Act Phase'])
    })

    test('a Campaign out of turn: the bar says whose turn is paused, not who campaigns', async ({
        page
    }) => {
        await openTable(page, 'sneakAttackHeld')
        expect((await call(page, 'tableFacts')).seatId).toBe('att')
        await expect.poll(() => turnBar(page)).toEqual(["def's turn is paused", 'Act Phase'])
        expect(await call(page, 'viewOffTheClock')).toBe('def')
        await expect.poll(() => turnBar(page)).toEqual(['Your turn is paused', 'Act Phase'])
        await expect(page.locator('.info')).not.toContainText('campaigning')
    })

    test('setup: no turn has begun, so the bar names nobody', async ({ page }) => {
        await openTable(page, 'setup')
        await expect.poll(() => turnBar(page)).toEqual(['Setup'])
        expect(await call(page, 'viewOffTheClock')).toBeDefined()
        await expect.poll(() => turnBar(page)).toEqual(['Setup'])
    })

    test('between rounds: the bar names the Chancellor’s roll', async ({ page }) => {
        await openTable(page, 'endOfRound')
        await expect.poll(() => turnBar(page)).toEqual(['Your roll', 'End of round 6'])
        expect(await call(page, 'viewOffTheClock')).toBe('dev')
        await expect.poll(() => turnBar(page)).toEqual(["ann's roll", 'End of round 6'])
    })
})

/** The panel's waiting line reads exactly "Waiting on" and the colour chip of each seat the engine waits on. */
async function expectWaitingOn(page: Page, playerIds: string[]) {
    const line = grid(page)
        .locator('p')
        .filter({ hasText: /^\s*Waiting/ })
    await expect(line).toHaveCount(1)
    await expect(line).toHaveText(
        new RegExp(`^\\s*Waiting on\\s+${playerIds.join('\\s+')}\\.\\s*$`)
    )
    const chips = line.locator(':scope > span')
    await expect(chips).toHaveText(playerIds)
    for (const chip of await chips.all()) {
        await expect(chip).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    }
}

/** Every seat the engine is not waiting on reads "Waiting on <chip>."; what is being decided is in the History. */
test.describe('the waiting line', () => {
    test('the action panel: the Sneak Attack’s turn seat waits on the campaigner', async ({
        page
    }) => {
        await openTable(page, 'sneakAttackHeld')
        expect(await call(page, 'viewOffTheClock')).toBe('def')
        await expectWaitingOn(page, ['att'])
    })

    test('a question: the turn seat waits on the asked seat', async ({ page }) => {
        await openTable(page, 'askedOffTurn')
        expect(await call(page, 'viewOffTheClock')).toBe('dev')
        await expectWaitingOn(page, ['ann'])
    })

    test('a request: the asking seat waits on the asked seat', async ({ page }) => {
        await openTable(page, 'warbandMoveAsked')
        expect(await call(page, 'viewOffTheClock')).toBe('cit')
        await expectWaitingOn(page, ['chan'])
    })

    test('the Campaign: the attacker waits on the defender’s battle plans, then on its losses', async ({
        page
    }) => {
        await openTable(page, 'defenderPlans')
        expect(await call(page, 'viewOffTheClock')).toBe('att')
        await expectWaitingOn(page, ['def'])

        await openTable(page, 'exileDefeated')
        expect(await call(page, 'viewOffTheClock')).toBe('att')
        await expectWaitingOn(page, ['def'])
    })

    test('between rounds: every other seat waits on the Chancellor’s roll', async ({ page }) => {
        await openTable(page, 'endOfRound')
        expect(await call(page, 'viewOffTheClock')).toBe('dev')
        await expectWaitingOn(page, ['ann'])
    })

    test('the Oathkeeper title: the turn seat waits on the outgoing holder', async ({ page }) => {
        await openTable(page, 'oathkeeperChoice')
        expect(await call(page, 'viewOffTheClock')).toBe('dev')
        await expectWaitingOn(page, ['ann'])
    })

    test('setup: another seat waits on the seat setting up', async ({ page }) => {
        await openTable(page, 'setup')
        const { seatId } = await call(page, 'tableFacts')
        if (seatId === undefined) throw Error('A seat sets up')
        expect(await call(page, 'viewOffTheClock')).not.toBe(seatId)
        await expectWaitingOn(page, [seatId])
    })
})

/** Scenario 30: a warband move that needs the Chancellor's permission (R-6.5.a). */
test.describe('scenario 30: answering another player’s request', () => {
    test('the asked player sees who asks for what; nothing moves until Allow, which moves it', async ({
        page
    }) => {
        await openTable(page, 'warbandMoveAsked')
        const asked = await call(page, 'tableFacts')
        expect(asked.seatId).toBe('chan')
        expect(asked.machineState).toBe('ConsentRequest')
        await expect(grid(page).getByRole('heading', { name: 'Move warbands' })).toBeVisible()
        await expect(grid(page)).not.toContainText('A question for you')
        await expect(question(page)).toHaveText('Let cit move 2 off their site?')
        await expect(question(page).getByRole('img', { name: 'Imperial warbands' })).toBeVisible()
        await expect(answer(page, 'Allow')).toBeEnabled()
        await expect(answer(page, 'Refuse')).toBeEnabled()
        expect(asked.warbandsAt.c1).toEqual({ imperial: 3 })
        expect(asked.boardOf.cit).toEqual({ imperial: 2 })

        await answer(page, 'Allow').click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).machineState)
            .toBe('ActPhase')
        const allowed = await call(page, 'tableFacts')
        expect(allowed.seatId).toBe('cit')
        expect(allowed.warbandsAt.c1).toEqual({ imperial: 1 })
        expect(allowed.boardOf.cit).toEqual({ imperial: 4 })
        await expect(grid(page)).toContainText('Act Phase')
    })

    test('Refuse sends the answer and moves nothing', async ({ page }) => {
        await openTable(page, 'warbandMoveAsked')
        await answer(page, 'Refuse').click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).machineState)
            .toBe('ActPhase')
        const refused = await call(page, 'tableFacts')
        expect(refused.seatId).toBe('cit')
        expect(refused.warbandsAt.c1).toEqual({ imperial: 3 })
        expect(refused.boardOf.cit).toEqual({ imperial: 2 })
    })

    test('another seat sees whom the game is waiting on, and no answer', async ({ page }) => {
        await openTable(page, 'warbandMoveAsked')
        expect(await call(page, 'viewOffTheClock')).toBe('cit')
        await expectWaitingOn(page, ['chan'])
        await expect(grid(page)).not.toContainText('A question for you')
        await expect(grid(page)).not.toContainText('Move warbands')
        await expect(answer(page, 'Allow')).toHaveCount(0)
        await expect(answer(page, 'Refuse')).toHaveCount(0)
    })

    test('Allow is not shown when the board no longer allows the move; the engine’s reason is the one red line', async ({
        page
    }) => {
        await openTable(page, 'staleWarbandMoveAsked')
        await expect(answer(page, 'Allow')).toHaveCount(0)
        await expect(grid(page).locator('.text-oath-danger')).toHaveCount(1)
        await expect(grid(page).locator('.text-oath-danger')).toContainText(
            'the last one must stay'
        )
        await expect(answer(page, 'Refuse')).toBeEnabled()
    })

    test('a gift asks “Let … give you …?”, and the answers are as wide as the wider label', async ({
        page
    }) => {
        await openTable(page, 'warbandGiveAsked')
        await expect(question(page)).toHaveText('Let cit give you 2?')
        await expect(question(page).getByRole('img', { name: 'Imperial warbands' })).toBeVisible()
        const allow = await answer(page, 'Allow').boundingBox()
        const refuse = await answer(page, 'Refuse').boundingBox()
        const panel = await grid(page).boundingBox()
        expect(allow?.width).toBe(refuse?.width)
        expect((allow?.width ?? 0) * 3).toBeLessThan(panel?.width ?? 0)
    })

    test('a Citizen answers Join or Stay out, then the defender Allow or Refuse; nothing is rolled until both answer', async ({
        page
    }) => {
        await openTable(page, 'joinDefenceAsked')
        const joining = await call(page, 'tableFacts')
        expect(joining.seatId).toBe('cit')
        expect(joining.campaignUnderway).toBe(false)
        await expect(grid(page).getByRole('heading', { name: 'Campaign' })).toBeVisible()
        await expect(question(page)).toHaveText('Join chan’s defence?')
        await expect(answer(page, 'Stay out')).toBeEnabled()
        await answer(page, 'Join').click()

        await expect.poll(async () => (await call(page, 'tableFacts')).seatId).toBe('chan')
        expect((await call(page, 'tableFacts')).campaignUnderway).toBe(false)
        await expect(grid(page).getByRole('heading', { name: 'Campaign' })).toBeVisible()
        await expect(question(page)).toHaveText('Let cit join your defence?')
        await answer(page, 'Allow').click()

        await expect.poll(async () => (await call(page, 'tableFacts')).campaignUnderway).toBe(true)
        expect((await call(page, 'tableFacts')).machineState).not.toBe('ConsentRequest')
    })
})

/** Accept or refuse Citizenship (R-6.6.1, R-6.6.2, R-9.3): the exchange as symbols and the warbands as pieces. */
test.describe('answering an offer of Citizenship', () => {
    const pieces = (page: Page) =>
        grid(page).getByRole('button', { name: /^(Imperial|Removed): a warband/ })
    const piece = (page: Page, name: string) =>
        grid(page).getByRole('button', { name, exact: true })
    const conversion = (page: Page) =>
        grid(page).getByRole('img', { name: /^Your \d+ warbands become/ })

    test('short: the pieces by place, the first three Imperial, and the rest removed; the line says so', async ({
        page
    }) => {
        await openTable(page, 'citizenshipShort')
        expect((await call(page, 'tableFacts')).seatId).toBe('me')
        await expect(grid(page)).toContainText('ann offers you Citizenship.')
        await expect(grid(page)).not.toContainText('A question for you')
        await expect(grid(page)).not.toContainText('the rest stay your own')
        await expect(conversion(page)).toHaveAccessibleName(
            'Your 5 warbands become 3 Imperial warbands; 2 are removed'
        )
        await expect(conversion(page)).toContainText('2 Removed')
        await expect(grid(page).getByText('On your board', { exact: true })).toBeVisible()
        await expect(grid(page).getByText('At Fertile Valley', { exact: true })).toBeVisible()

        await expect(pieces(page)).toHaveCount(5)
        for (const one of await pieces(page).all()) await expect(one).toBeEnabled()
        await expect(piece(page, 'Imperial: a warband on your board')).toHaveCount(3)
        await expect(piece(page, 'Removed: a warband at Fertile Valley')).toHaveCount(2)
        await expect(grid(page).locator('button[aria-pressed="true"]')).toHaveCount(3)
        await expect(answer(page, 'Accept')).toBeEnabled()
    })

    test('short: Accept is hidden while fewer are picked than the Empire covers, with no red line', async ({
        page
    }) => {
        await openTable(page, 'citizenshipShort')
        await piece(page, 'Imperial: a warband on your board').first().click()
        await expect(grid(page).locator('button[aria-pressed="true"]')).toHaveCount(2)
        await expect(answer(page, 'Accept')).toHaveCount(0)
        await expect(grid(page)).not.toContainText('must choose exactly')
        await expect(answer(page, 'Refuse')).toBeEnabled()

        await piece(page, 'Removed: a warband at Fertile Valley').first().click()
        await expect(answer(page, 'Accept')).toBeEnabled()
    })

    test('short: a tap on a removed piece makes it Imperial and removes the oldest pick', async ({
        page
    }) => {
        await openTable(page, 'citizenshipShort')
        await piece(page, 'Removed: a warband at Fertile Valley').first().click()
        await expect(piece(page, 'Imperial: a warband at Fertile Valley')).toHaveCount(1)
        await expect(piece(page, 'Imperial: a warband on your board')).toHaveCount(2)
        await expect(pieces(page).first()).toHaveAttribute('aria-pressed', 'false')
        await expect(grid(page).locator('button[aria-pressed="true"]')).toHaveCount(3)

        await answer(page, 'Accept').click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).machineState)
            .not.toBe('ConsentRequest')
        const accepted = await call(page, 'tableFacts')
        expect(accepted.boardOf.me?.imperial).toBe(2)
        expect(accepted.boardOf.me?.me ?? 0).toBe(0)
    })

    test('none: every piece is removed and none can be tapped; Accept removes them all', async ({
        page
    }) => {
        await openTable(page, 'citizenshipNone')
        await expect(conversion(page)).toHaveAccessibleName(
            'Your 5 warbands become 0 Imperial warbands; 5 are removed'
        )
        await expect(conversion(page)).toContainText('5 Removed')
        await expect(pieces(page)).toHaveCount(5)
        for (const one of await pieces(page).all()) await expect(one).toBeDisabled()
        await expect(grid(page).getByRole('button', { name: /^Removed: a warband/ })).toHaveCount(5)

        await answer(page, 'Accept').click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).machineState)
            .not.toBe('ConsentRequest')
        const accepted = await call(page, 'tableFacts')
        expect(accepted.boardOf.me?.imperial ?? 0).toBe(0)
        expect(accepted.boardOf.me?.me ?? 0).toBe(0)
    })

    test('enough: every piece becomes Imperial and none can be tapped; the line names no loss', async ({
        page
    }) => {
        await openTable(page, 'citizenshipEnough')
        await expect(conversion(page)).toHaveAccessibleName(
            'Your 5 warbands become 5 Imperial warbands'
        )
        await expect(conversion(page)).not.toContainText('Removed')
        await expect(pieces(page)).toHaveCount(5)
        for (const one of await pieces(page).all()) await expect(one).toBeDisabled()
        await expect(grid(page).getByRole('button', { name: /^Imperial: a warband/ })).toHaveCount(
            5
        )
        await expect(grid(page)).not.toContainText('Removed')
    })

    test('"You give" shows what the Exile gives, its count in gold, and is gone when they give nothing', async ({
        page
    }) => {
        await openTable(page, 'citizenshipShort')
        await expect(grid(page).getByText('You get', { exact: true })).toBeVisible()
        await expect(grid(page).getByText('You give', { exact: true })).toBeVisible()
        const given = grid(page).getByRole('img', { name: '1 secret', exact: true })
        await expect(given).toBeVisible()
        const [count, accent] = await given.evaluate((element) => {
            const probe = document.createElement('span')
            probe.style.color = 'var(--oath-accent)'
            element.append(probe)
            const colours = [
                getComputedStyle(element.querySelector('.count') ?? element).color,
                getComputedStyle(probe).color
            ]
            probe.remove()
            return colours
        })
        expect(count).toBe(accent)

        await openTable(page, 'citizenshipEnough')
        await expect(grid(page).getByText('You get', { exact: true })).toBeVisible()
        await expect(grid(page).getByText('You give', { exact: true })).toHaveCount(0)
    })

    test('the relic is drawn as the Exile sees it, and its magnifier enlarges it', async ({
        page
    }) => {
        await openTable(page, 'citizenshipShort')
        await grid(page)
            .getByRole('button', {
                name: 'Enlarge the facedown relic on Reliquary space 1',
                exact: true
            })
            .click()
        await expect(preview(page)).toBeVisible()
        await page.mouse.click(20, 20)
        await expect(preview(page)).toHaveCount(0)
        await expect(grid(page).locator('button[aria-pressed="true"]')).toHaveCount(3)
    })

    test('on a desktop the answers fit their label and share one width', async ({ page }) => {
        await openTable(page, 'citizenshipShort')
        const accept = await answer(page, 'Accept').boundingBox()
        const refuse = await answer(page, 'Refuse').boundingBox()
        const panel = await grid(page).boundingBox()
        expect(accept && refuse && panel).toBeTruthy()
        if (!accept || !refuse || !panel) return
        expect(Math.abs(accept.width - refuse.width)).toBeLessThan(1)
        expect(accept.width + refuse.width).toBeLessThan(panel.width / 2)
    })

    test('on a phone the answers fit their label too, share one width and are 44 px tall', async ({
        page
    }) => {
        await page.setViewportSize({ width: 375, height: 812 })
        await openTable(page, 'citizenshipShort')
        const accept = await answer(page, 'Accept').boundingBox()
        const refuse = await answer(page, 'Refuse').boundingBox()
        const panel = await grid(page).boundingBox()
        expect(accept && refuse && panel).toBeTruthy()
        if (!accept || !refuse || !panel) return
        expect(Math.abs(accept.width - refuse.width)).toBeLessThan(1)
        expect(refuse.x + refuse.width - accept.x).toBeLessThan(panel.width * 0.6)
        expect(accept.height).toBeGreaterThanOrEqual(44)
    })
})

const minor = (page: Page, label: string) =>
    grid(page).locator('.minors button').filter({ hasText: label })

/** The Citizenship offer's builder (R-6.6.1): to whom, which relic, then the terms. */
test.describe('offering Citizenship', () => {
    test('“To:” the Exiles’ chips, “Promise <chip> one relic.”, then the terms by side and “Offer” alone', async ({
        page
    }) => {
        await openTable(page, 'offerCitizenship')
        await minor(page, 'Offer Citizenship').click()
        await expect(grid(page)).toContainText('To:')
        await expect(grid(page)).not.toContainText('Choose an Exile')
        await expect(grid(page)).not.toContainText('yourself')
        await expect(answer(page, 'Cancel the offer')).toHaveCount(0)

        await grid(page).getByRole('button', { name: 'rhys', exact: true }).click()
        await expect(grid(page).locator('p').filter({ hasText: 'Promise' })).toHaveText(
            'Promise rhys one relic.'
        )
        await expect(grid(page)).not.toContainText('facedown')
        await panelCards(page)
            .filter({ has: page.getByRole('img', { name: 'Cup of Plenty' }) })
            .click()

        await expect(grid(page).locator('p').filter({ hasText: /^To/ })).toHaveText('To rhys')
        await expect(grid(page)).not.toContainText('reliquary.')
        await expect(grid(page)).not.toContainText('hold')
        await expect(grid(page)).toContainText('You give')
        await expect(grid(page)).toContainText('You get')
        await expect(grid(page).getByRole('img', { name: 'Cup of Plenty' })).toBeVisible()
        await expect(grid(page).locator('input[type="checkbox"]')).toHaveCount(0)
        await expect(answer(page, 'Back')).toHaveCount(0)
        await expect(answer(page, 'Offer')).toBeEnabled()

        // The banners are their tiles: a tap adds one and rings it, a second takes it out.
        const darkest = answer(page, 'the Darkest Secret')
        await expect(darkest).toHaveAttribute('aria-pressed', 'false')
        await darkest.click()
        await expect(darkest).toHaveAttribute('aria-pressed', 'true')
        await expect(answer(page, 'the People’s Favor')).toHaveAttribute('aria-pressed', 'false')

        // The counts are token rows: a tap on the second favor gives 2, the tokens up to it ringed.
        await answer(page, 'you give 2 favor').click()
        await expect(answer(page, 'you give 1 favor')).toHaveAttribute('aria-pressed', 'true')
        await expect(answer(page, 'you give 2 favor')).toHaveAttribute('aria-pressed', 'true')
        await expect(answer(page, 'you give 3 favor')).toHaveAttribute('aria-pressed', 'false')
        await answer(page, 'they give 1 secret').click()
        await expect(answer(page, 'they give 1 secret')).toHaveAttribute('aria-pressed', 'true')

        await answer(page, 'Offer').click()
        await expect
            .poll(async () => (await call(page, 'standing')).asked)
            .toEqual({
                kind: 'citizenshipOffer',
                askedPlayerId: 'rhys'
            })
    })

    test('Undo backs out one pick per press: a term, the banner, the relic, the Exile, then the action', async ({
        page
    }) => {
        await openTable(page, 'offerCitizenship')
        await minor(page, 'Offer Citizenship').click()
        await grid(page).getByRole('button', { name: 'rhys', exact: true }).click()
        await panelCards(page).first().click()
        await answer(page, 'the Darkest Secret').click()
        await answer(page, 'you give 1 favor').click()

        await undoButton(page).click()
        await expect(answer(page, 'you give 1 favor')).toHaveAttribute('aria-pressed', 'false')
        await expect(answer(page, 'the Darkest Secret')).toHaveAttribute('aria-pressed', 'true')
        await undoButton(page).click()
        await expect(answer(page, 'the Darkest Secret')).toHaveAttribute('aria-pressed', 'false')
        await undoButton(page).click()
        await expect(grid(page)).toContainText('Promise')
        await undoButton(page).click()
        await expect(grid(page)).toContainText('To:')
        await undoButton(page).click()
        await expect(grid(page)).toContainText('Act Phase')
        expect((await call(page, 'tableFacts')).staged).toBeUndefined()
    })

    test('with one Exile, the offer opens at the relic; Undo then puts the action down', async ({
        page
    }) => {
        await openTable(page, 'offerCitizenshipToOne')
        await minor(page, 'Offer Citizenship').click()
        await expect(grid(page).locator('p').filter({ hasText: 'Promise' })).toHaveText(
            'Promise rhys one relic.'
        )
        await expect(grid(page)).not.toContainText('To:')
        await undoButton(page).click()
        await expect(grid(page)).toContainText('Act Phase')
        expect((await call(page, 'tableFacts')).staged).toBeUndefined()
    })
})

/** An element's size in layout pixels: the panel may be drawn scaled to fit. */
const layoutSizeOf = (locator: Locator) =>
    locator.evaluate((element) =>
        element instanceof HTMLElement
            ? { width: element.offsetWidth, height: element.offsetHeight }
            : undefined
    )

/** The scale the last fitted panel is drawn at. */
const panelScale = (page: Page) =>
    page
        .locator('.fit__inner')
        .last()
        .evaluate((inner) => new DOMMatrixReadOnly(getComputedStyle(inner).transform).a)

/** Opens the offer to Rhys with the Cup of Plenty promised: the terms. */
async function offerToRhys(
    page: Page,
    table: TableFixture.TableName = 'offerCitizenship',
    exile = 'rhys'
) {
    await openTable(page, table)
    await minor(page, 'Offer Citizenship').click()
    await grid(page).getByRole('button', { name: exile, exact: true }).click()
    await panelCards(page)
        .filter({ has: page.getByRole('img', { name: 'Cup of Plenty' }) })
        .click()
    await expect(grid(page).locator('p').filter({ hasText: /^To/ })).toHaveText(`To ${exile}`)
}

const FAVOR_TOKENS = (who: 'you' | 'they', count: number) =>
    Array.from({ length: count }, (_, index) => `${who} give ${index + 1} favor`)

/**
 * The offer's terms (R-6.6.1): the promised relic is the one large card, each side's relics and
 * banners small tiles ringed once added, favor and secrets token rows; the sides side by side on
 * a desktop and stacked on a phone; no summary line; an Exile offering himself gets no terms.
 */
test.describe('the Citizenship offer’s terms', () => {
    test('the promised relic is the 56 px card, not a button; the Scepter and banners are 40 px tiles, unringed until tapped', async ({
        page
    }) => {
        await offerToRhys(page)
        const promised = grid(page).getByRole('img', { name: 'Cup of Plenty', exact: true })
        expect(await layoutSizeOf(promised)).toEqual({ width: 56, height: 56 })
        await expect(promised.locator('xpath=ancestor::button')).toHaveCount(0)
        await expect(
            grid(page).getByRole('button', { name: 'Enlarge Cup of Plenty', exact: true })
        ).toHaveCount(1)

        // Picks start empty: the Scepter is listed, not in the offer until tapped.
        const scepter = answer(page, 'The Grand Scepter')
        await expect(scepter).toHaveAttribute('aria-pressed', 'false')
        expect(await layoutSizeOf(scepter.locator('img'))).toEqual({ width: 40, height: 40 })
        await expect(
            grid(page).getByRole('button', { name: 'Enlarge The Grand Scepter', exact: true })
        ).toHaveCSS('width', '24px')
        for (const [name, width] of [
            ['the Darkest Secret', 80],
            ['the People’s Favor', 80]
        ] as const) {
            const banner = answer(page, name)
            await expect(banner).toHaveAttribute('aria-pressed', 'false')
            expect(await layoutSizeOf(banner.locator('img'))).toEqual({ width, height: 40 })
        }
        // No hover: a tile has no hover ring and no tooltip.
        for (const tile of [scepter, answer(page, 'the Darkest Secret')]) {
            await expect(tile).not.toHaveAttribute('title')
            await expect(tile.locator('img')).not.toHaveAttribute('title')
            expect(await tile.getAttribute('class')).not.toMatch(/hover:/)
        }
        await expect(scepter).toHaveClass(/ring-1/)
        await scepter.click()
        await expect(scepter).toHaveAttribute('aria-pressed', 'true')
        await expect(scepter).toHaveClass(/ring-2/)
        await expect(scepter).toHaveClass(/ring-oath-accent/)
    })

    test('favor and secrets are token rows: the Nth token gives N, the token at the count gives 0', async ({
        page
    }) => {
        await offerToRhys(page)
        // One token per unit held, none at the start, and no "0".
        const tokens = [
            ...FAVOR_TOKENS('you', 4),
            'you give 1 secret',
            'you give 2 secrets',
            ...FAVOR_TOKENS('they', 3),
            'they give 1 secret'
        ]
        for (const name of tokens) {
            await expect(answer(page, name)).toHaveAttribute('aria-pressed', 'false')
            await expect(answer(page, name)).toBeEnabled()
            expect(await layoutSizeOf(answer(page, name))).toEqual({ width: 34, height: 32 })
        }
        await expect(grid(page).getByRole('button', { name: /give 0 / })).toHaveCount(0)
        await expect(
            grid(page).getByRole('button', { name: 'you give 5 favor', exact: true })
        ).toHaveCount(0)

        const pressed = async () =>
            Promise.all(
                FAVOR_TOKENS('you', 4).map((name) =>
                    answer(page, name).getAttribute('aria-pressed')
                )
            )
        await answer(page, 'you give 2 favor').click()
        expect(await pressed()).toEqual(['true', 'true', 'false', 'false'])
        await answer(page, 'you give 4 favor').click()
        expect(await pressed()).toEqual(['true', 'true', 'true', 'true'])
        await answer(page, 'you give 1 favor').click()
        expect(await pressed()).toEqual(['true', 'false', 'false', 'false'])
        await answer(page, 'you give 1 favor').click()
        expect(await pressed()).toEqual(['false', 'false', 'false', 'false'])

        // A token in the deal is ringed gold; its picture is full strength, the others faint.
        await answer(page, 'they give 1 secret').click()
        await expect(answer(page, 'they give 1 secret')).toHaveClass(/ring-oath-accent/)
        await expect(answer(page, 'they give 1 secret').locator('img')).toHaveCSS('opacity', '1')
        await expect(answer(page, 'they give 1 favor').locator('img')).not.toHaveCSS('opacity', '1')
    })

    test('the sides stand side by side, and nothing but “Offer” follows them', async ({ page }) => {
        await offerToRhys(page)
        const give = await boxOf(grid(page).getByText('You give', { exact: true }))
        const get = await boxOf(grid(page).getByText('You get', { exact: true }))
        expect(Math.abs(give.y - get.y)).toBeLessThan(1)
        expect(get.x).toBeGreaterThan(give.x + 200)
        await answer(page, 'you give 2 favor').click()
        await expect(grid(page)).toHaveText(
            /^\s*Offer Citizenship\s*To rhys\s*You give\s*You get\s*Offer\s*$/
        )
    })

    test('a token a side holds none of has no control', async ({ page }) => {
        await offerToRhys(page, 'offerCitizenship', 'ann')
        for (const name of FAVOR_TOKENS('they', 2)) await expect(answer(page, name)).toBeVisible()
        await expect(
            grid(page).getByRole('button', { name: /^they give \d+ secrets?$/ })
        ).toHaveCount(0)
        await expect(
            grid(page).getByRole('button', { name: /^you give \d+ secrets?$/ })
        ).toHaveCount(2)
    })

    test('a token the rules refuse is not tappable and keeps its place', async ({ page }) => {
        await offerToRhys(page, 'offerCitizenshipSilenced')
        const secret = answer(page, 'they give 1 secret')
        await expect(secret).toBeVisible()
        await expect(secret).toBeDisabled()
        expect(await layoutSizeOf(secret)).toEqual({ width: 34, height: 32 })
        await expect(answer(page, 'they give 1 favor')).toBeEnabled()
        await expect(answer(page, 'Offer')).toBeEnabled()
    })

    test('an Exile offering himself gets no terms: the promised relic and “Offer”', async ({
        page
    }) => {
        await openTable(page, 'offerCitizenshipSelf')
        await minor(page, 'Offer Citizenship').click()
        await expect(grid(page)).not.toContainText('To:')
        await panelCards(page)
            .filter({ has: page.getByRole('img', { name: 'Cup of Plenty' }) })
            .click()
        await expect(grid(page)).toContainText('You give')
        await expect(grid(page)).not.toContainText('You get')
        await expect(
            grid(page).getByRole('img', { name: 'Cup of Plenty', exact: true })
        ).toBeVisible()
        await expect(
            grid(page).getByRole('button', { name: /give \d+ (favor|secrets?)$/ })
        ).toHaveCount(0)
        await expect(
            grid(page).getByRole('button', { name: 'The Grand Scepter', exact: true })
        ).toHaveCount(0)
        await expect(
            grid(page).getByRole('button', { name: 'the Darkest Secret', exact: true })
        ).toHaveCount(0)
        await answer(page, 'Offer').click()
        await expect
            .poll(async () => (await call(page, 'standing')).asked)
            .toEqual({
                kind: 'citizenshipOffer',
                askedPlayerId: 'dana'
            })
        expect(await call(page, 'offeredCitizenshipTerms')).toBe('none')
    })

    for (const viewport of [
        { width: 402, height: 874 },
        { width: 375, height: 812 }
    ]) {
        test.describe(`on a ${viewport.width} px phone`, () => {
            test.use({ viewport })

            test('the sides stack; tiles and tokens are 44 px, the Scepter unringed until tapped, every label inside its button', async ({
                page
            }) => {
                await offerToRhys(page)
                await panelImagesLoaded(page)
                const give = await boxOf(grid(page).getByText('You give', { exact: true }))
                const get = await boxOf(grid(page).getByText('You get', { exact: true }))
                expect(get.y).toBeGreaterThan(give.y + 44)
                expect(Math.abs(give.x - get.x)).toBeLessThan(1)

                const scepter = answer(page, 'The Grand Scepter')
                expect(await layoutSizeOf(scepter.locator('img'))).toEqual({
                    width: 44,
                    height: 44
                })
                expect(
                    await layoutSizeOf(answer(page, 'the Darkest Secret').locator('img'))
                ).toEqual({ width: 88, height: 44 })
                for (const name of [
                    ...FAVOR_TOKENS('you', 4),
                    'you give 2 secrets',
                    'they give 1 secret'
                ]) {
                    expect(await layoutSizeOf(answer(page, name))).toEqual({
                        width: 44,
                        height: 44
                    })
                }
                expect((await layoutSizeOf(answer(page, 'Offer')))?.height).toBeGreaterThanOrEqual(
                    44
                )
                await expect(scepter).toHaveAttribute('aria-pressed', 'false')
                await scepter.click()
                await expect(scepter).toHaveAttribute('aria-pressed', 'true')
                expect(await clippedLabels(page)).toEqual([])
                expect(await wrappedLabels(page)).toEqual([])
                if (viewport.width === 402) expect(await panelScale(page)).toBe(1)
            })
        })
    }
})

/** Exile (R-6.7, R-6.8): each button is the price and whom it goes to. */
test.describe('exiling', () => {
    test('Exile Citizen: one button per Citizen, “5 [favor] to <chip>”, the People’s Favor’s holder 6; a tap exiles', async ({
        page
    }) => {
        await openTable(page, 'exileCitizens')
        await minor(page, 'Exile Citizen').click()
        const rhys = answer(page, '5 favor to rhys')
        const ann = answer(page, '6 favor to ann')
        await expect(rhys).toHaveText('5 to rhys')
        await expect(ann).toHaveText('6 to ann')
        await expect(rhys.getByRole('img', { name: 'favor' })).toBeVisible()
        await expect(rhys.locator('.text-oath-accent')).toHaveText('5')
        await expect(grid(page)).not.toContainText('Exile rhys')
        const [rhysBox, annBox] = [await rhys.boundingBox(), await ann.boundingBox()]
        expect(rhysBox?.width).toBe(annBox?.width)

        await ann.click()
        await expect.poll(async () => (await call(page, 'standing')).statusOf.ann).toBe('exile')
        expect((await call(page, 'tableFacts')).favorOf).toMatchObject({ dana: 6, ann: 8 })
    })

    test('Exile yourself is staged: the bar names it, one button “3 [favor] to <chip>” sends it, and Undo puts it down', async ({
        page
    }) => {
        await openTable(page, 'selfExile')
        await minor(page, 'Exile yourself').click()
        const facts = await call(page, 'tableFacts')
        expect(facts.staged).toBe('selfExile')
        expect(facts.favorOf).toEqual({ rhys: 5, dana: 4 })
        expect((await call(page, 'standing')).statusOf.rhys).toBe('citizen')
        await expect(minor(page, 'Exile yourself')).toHaveCount(0)
        await expect(grid(page)).toContainText('Exile yourself')
        const pay = answer(page, '3 favor to dana')
        await expect(pay).toHaveText('3 to dana')

        await undoButton(page).click()
        expect((await call(page, 'tableFacts')).staged).toBeUndefined()
        await expect(pay).toHaveCount(0)

        await minor(page, 'Exile yourself').click()
        await answer(page, '3 favor to dana').click()
        await expect.poll(async () => (await call(page, 'standing')).statusOf.rhys).toBe('exile')
        expect((await call(page, 'tableFacts')).favorOf).toEqual({ rhys: 2, dana: 7 })

        // The History names who got the favor.
        await page.getByRole('tab', { name: 'History' }).click()
        await expect(page.locator('.history')).toContainText('went into exile, giving 3')
        await expect(page.locator('.history')).toContainText('to dana')
    })
})

test.describe('on a phone, the answers and the exile buttons', () => {
    test.use({ viewport: { width: 375, height: 812 } })

    test('Allow and Refuse stay sized to the wider label, 44 px tall; the exile prices sit side by side at one width, never stretched', async ({
        page
    }) => {
        await openTable(page, 'warbandMoveAsked')
        const allow = await answer(page, 'Allow').boundingBox()
        const refuse = await answer(page, 'Refuse').boundingBox()
        expect(allow?.height).toBeGreaterThanOrEqual(44)
        expect(allow?.width).toBe(refuse?.width)
        expect(allow?.y).toBe(refuse?.y)

        // Rule 3: sized to the wider label, in CSS pixels (the panel may be drawn scaled to fit).
        await openTable(page, 'exileCitizens')
        await minor(page, 'Exile Citizen').click()
        const sizes = await Promise.all(
            [answer(page, '5 favor to rhys'), answer(page, '6 favor to ann')].map((button) =>
                button.evaluate((element) => {
                    const style = getComputedStyle(element)
                    const panel = element.closest('.panel')
                    return {
                        width: parseFloat(style.width),
                        height: parseFloat(style.height),
                        top: element.getBoundingClientRect().top,
                        panel: panel ? parseFloat(getComputedStyle(panel).width) : 0
                    }
                })
            )
        )
        const [rhys, ann] = sizes
        expect(rhys.width).toBe(ann.width)
        for (const size of sizes) {
            expect(size.width).toBeLessThan(size.panel * 0.5)
            expect(size.height).toBeGreaterThanOrEqual(44)
        }
        expect(rhys.top).toBe(ann.top)
    })
})

/** Scenario 31: the defending side's losses after a won battle (R-5.5.6.a). */
test.describe('scenario 31: choosing the defending side’s losses', () => {
    test('one row of warband pieces per group and a count; Kill shows only once the count is right; Undo clears every count', async ({
        page
    }) => {
        await openTable(page, 'exileDefeated')
        const facts = await call(page, 'tableFacts')
        expect(facts.seatId).toBe('def')
        expect(facts.machineState).toBe('CampaignDefeat')
        expect((await call(page, 'defeatPicks')).required).toBe(2)

        const kill = answer(page, 'Kill')
        await expect(grid(page).locator('h3')).toHaveText('Losses')
        await expect(grid(page)).toContainText('Pick 2 to kill.')
        await expect(countRows(page)).toHaveCount(2)
        await expect(grid(page)).toContainText('Chosen 0 of 2')
        await expect(kill).toHaveCount(0)
        await expect(grid(page)).not.toContainText('must kill exactly')

        await pickCount(page, 0, 1)
        await expect(grid(page)).toContainText('Chosen 1 of 2')
        await expect(kill).toHaveCount(0)
        await pickCount(page, 1, 1)
        await expect(grid(page)).toContainText('Chosen 2 of 2')
        await expect(kill).toBeEnabled()
        await expect(grid(page)).not.toContainText('must kill exactly')

        await page.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(grid(page)).toContainText('Chosen 0 of 2')
        await expect(kill).toHaveCount(0)
        expect((await call(page, 'defeatPicks')).picked).toEqual([0, 0])

        await pickCount(page, 0, 1)
        await pickCount(page, 1, 1)
        await kill.click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).machineState)
            .not.toBe('CampaignDefeat')
        const after = await call(page, 'tableFacts')
        expect(after.warbandsAt.c1?.def ?? 0).toBe(0)
        expect(after.boardOf.def).toEqual({ def: 2 })
    })

    test('the count is muted, never rose; the rows name the board by its owner; no rule is restated', async ({
        page
    }) => {
        await openTable(page, 'exileDefeated')
        await expect(grid(page).getByText('Chosen 0 of 2', { exact: true })).toHaveClass(
            /text-oath-text-muted/
        )
        await expect(grid(page)).toContainText('on your board')
        await expect(grid(page)).not.toContainText('the rest go home')
        await expect(grid(page)).not.toContainText('The attacker won')
    })

    test('the warbands picked to die are ringed rose; with the count owed picked the rest keep their place, untappable', async ({
        page
    }) => {
        await openTable(page, 'exileDefeated')
        const board = (n: number) =>
            grid(page).getByRole('button', {
                name: `${n} of the warbands on your board`,
                exact: true
            })
        const site = (n: number) =>
            grid(page).getByRole('button', { name: new RegExp(`^${n} of the warbands at `) })
        await board(2).click()
        for (const piece of [board(1), board(2)]) {
            await expect(piece).toHaveAttribute('aria-pressed', 'true')
            await expect(piece).toHaveClass(/ring-oath-danger/)
            await expect(piece).not.toHaveClass(/ring-oath-accent/)
        }
        await expect(site(1)).toBeDisabled()
        await expect(site(2)).toBeDisabled()
        await expect(answer(page, 'Kill')).toBeVisible()
        await board(2).click()
        await expect(board(1)).toHaveAttribute('aria-pressed', 'false')
        await expect(site(1)).toBeEnabled()
        await expect(answer(page, 'Kill')).toHaveCount(0)
    })

    test('for an Imperial defence the Chancellor chooses, not the defending Citizen', async ({
        page
    }) => {
        await openTable(page, 'imperialDefeated')
        expect((await call(page, 'tableFacts')).seatId).toBe('chan')
        await expect(countRows(page)).toHaveCount(2)
        await expect(answer(page, 'Kill')).toHaveCount(0)
    })
})

/** The panel's buttons whose label is wider than the button, by their text. */
async function clippedLabels(page: Page) {
    return grid(page)
        .locator('button')
        .evaluateAll((buttons) =>
            buttons
                .filter((button) => button.scrollWidth > button.clientWidth + 1)
                .map((button) => button.textContent?.trim() ?? '')
        )
}

/** The panel's buttons whose label runs onto a second line, by their text. */
async function wrappedLabels(page: Page) {
    return grid(page)
        .locator('button')
        .evaluateAll((buttons) =>
            buttons
                .filter((button) => {
                    // The top of every line the label's text sits on; one line, one top.
                    const tops: number[] = []
                    const texts = document.createTreeWalker(button, NodeFilter.SHOW_TEXT)
                    for (let text = texts.nextNode(); text; text = texts.nextNode()) {
                        const range = document.createRange()
                        range.selectNodeContents(text)
                        for (const rect of range.getClientRects()) {
                            if (rect.width > 0) tops.push(rect.top)
                        }
                    }
                    const lineHeight = parseFloat(getComputedStyle(button).lineHeight)
                    return (
                        tops.length > 0 && Math.max(...tops) - Math.min(...tops) >= lineHeight / 2
                    )
                })
                .map((button) => button.textContent?.trim() ?? '')
        )
}

async function widthOf(locator: ReturnType<Page['locator']>) {
    return Math.round((await boxOf(locator)).width)
}

/** How a pair of buttons sits: side by side, or one per line (the second under the first). */
async function pairLayout(
    first: ReturnType<Page['locator']>,
    second: ReturnType<Page['locator']>
): Promise<'side by side' | 'one per line' | 'apart'> {
    const a = await boxOf(first)
    const b = await boxOf(second)
    if (Math.abs(a.y - b.y) < 1) return 'side by side'
    if (b.y >= a.y + a.height && Math.abs(a.x - b.x) < 1) return 'one per line'
    return 'apart'
}

/** The background a primary button wears, read from a probe so the token's value is not repeated. */
async function primaryBackground(page: Page) {
    return grid(page).evaluate((panel) => {
        const probe = document.createElement('button')
        probe.className = 'bg-oath-primary'
        panel.append(probe)
        const colour = getComputedStyle(probe).backgroundColor
        probe.remove()
        return colour
    })
}

const backgroundOf = (locator: ReturnType<Page['locator']>) =>
    locator.evaluate((element) => getComputedStyle(element).backgroundColor)

/** A battle plan's card in the panel's strip. */
const planCard = (page: Page) => panelCards(page).filter({ hasNotText: /plans/ }).first()

/** Scenario 62: the Campaign's panels say the least; the History holds the rest. */
test.describe('scenario 62: the Campaign’s words', () => {
    test('declaring: the defender is asked only when there is a choice, and Declare shows once a target and the dice are picked', async ({
        page
    }) => {
        await openTable(page, 'campaignTwoDefenders')
        await tile(page, 'Campaign').click()
        await expect(grid(page)).toContainText('Attack who?')
        await expect(grid(page)).not.toContainText('Choose who you are attacking')
        const bandits = answer(page, 'The bandits')
        const ann = grid(page).getByRole('button', { name: /^ann$/i })
        expect(await widthOf(bandits)).toBe(await widthOf(ann))
        await ann.click()

        await expect(grid(page)).toContainText(/Against ann\. Tap targets\./i)
        await expect(grid(page)).not.toContainText('Tap a target to add it')
        // The site is held by nobody, so the defender rules no site here.
        await expect(grid(page).locator('h4')).toContainText(['Pawn and favor', 'Attack dice'])
        await expect(grid(page)).not.toContainText('Attack dice — tap')
        const pawn = grid(page)
            .locator('button[aria-pressed]')
            .filter({ has: page.locator('img[src*="pawn"]') })
        await expect(pawn).toHaveAccessibleName(/^ann$/i)
        await expect(pawn).not.toContainText('Their pawn and favor')

        const declare = answer(page, 'Declare')
        await expect(declare).toHaveCount(0)
        await grid(page).locator('button[aria-pressed]').first().click()
        await expect(declare).toHaveCount(0)
        await grid(page)
            .getByRole('button', { name: /^Add attack die 2/ })
            .click()
        await expect(declare).toBeVisible()
        await expect(grid(page)).not.toContainText('Declare the Campaign')
    })

    test('the defender’s battle plans: Use plans once a plan is picked, No plans always; no rule restated', async ({
        page
    }) => {
        await openTable(page, 'battleDefenderPlans')
        expect((await call(page, 'tableFacts')).seatId).toBe('def')
        await expect(grid(page).locator('h3')).toHaveText('Battle plans')
        await expect(grid(page)).toContainText('Tap the plans to use.')
        await expect(grid(page)).not.toContainText('You are defending')
        await expect(grid(page)).not.toContainText('and roll')
        const use = answer(page, 'Use plans')
        const none = answer(page, 'No plans')
        await expect(use).toHaveCount(0)
        await expect(none).toBeVisible()

        await planCard(page).click()
        await expect(use).toBeVisible()
        expect(await backgroundOf(use)).toBe(await primaryBackground(page))
        expect(await widthOf(use)).toBe(await widthOf(none))
        expect(await pairLayout(use, none)).toBe('side by side')

        await none.click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).machineState)
            .not.toBe('CampaignPlans')
    })

    test('the attacker’s battle plans after the Citizens: the same two buttons, the confirm drawn as the primary', async ({
        page
    }) => {
        await openTable(page, 'attackerPlans')
        expect((await call(page, 'tableFacts')).seatId).toBe('att')
        await expect(grid(page).locator('h3')).toHaveText('Battle plans')
        await expect(grid(page)).toContainText('Tap the plans to use.')
        await expect(grid(page)).not.toContainText('The Citizens have answered')
        const use = answer(page, 'Use plans')
        const none = answer(page, 'No plans')
        await expect(use).toHaveCount(0)
        await expect(none).toBeVisible()

        await planCard(page).click()
        await expect(use).toBeVisible()
        expect(await backgroundOf(use)).toBe(await primaryBackground(page))
        expect(await widthOf(use)).toBe(await widthOf(none))
        expect(await pairLayout(use, none)).toBe('side by side')
    })

    test('the battle: the two choices at one width, with no rule restated', async ({ page }) => {
        await openTable(page, 'sacrifice')
        await expect(grid(page).locator('h3')).toHaveText('Battle')
        await expect(grid(page)).not.toContainText('Defending:')
        await expect(grid(page)).not.toContainText('The rules allow no amount in between')
        await expect(grid(page)).not.toContainText('Defeated, you lose half your force')
        const win = answer(page, 'Sacrifice 3 and win')
        const lose = answer(page, 'Sacrifice nothing')
        await expect(win).toBeVisible()
        await expect(lose).toBeVisible()
        expect(await widthOf(win)).toBe(await widthOf(lose))
        expect(await pairLayout(win, lose)).toBe('side by side')
    })

    test('the battle with a force of two groups: each choice shows once its own picks are complete', async ({
        page
    }) => {
        await openTable(page, 'sacrificeMixed')
        await expect(grid(page)).toContainText('To win, sacrifice 2:')
        await expect(grid(page)).toContainText(/If you lose, \d die:/)
        await expect(grid(page)).not.toContainText('of these')
        const win = answer(page, 'Sacrifice 2 and win')
        const lose = answer(page, 'Sacrifice nothing')
        await expect(win).toHaveCount(0)
        await expect(lose).toHaveCount(0)
        await expect(grid(page)).not.toContainText('must sacrifice exactly')

        await pickCount(page, 0, 2)
        await expect(win).toBeVisible()
        await expect(lose).toHaveCount(0)
    })

    test('a battle with nothing to choose says who won, over Continue', async ({ page }) => {
        await openTable(page, 'wonOutright')
        await expect(grid(page)).toContainText('You win.')
        await expect(grid(page)).not.toContainText('already victorious')
        await expect(answer(page, 'Continue')).toBeVisible()
    })

    test('the spoils: the warbands first, in short words, the site’s picture beside its warbands and no hint', async ({
        page
    }) => {
        await openTable(page, 'spoils')
        await expect(grid(page).locator('h3')).toHaveText('Spoils')
        await expect(spoilsStepCount(page)).toHaveText('1 of 3')
        await expect(grid(page)).not.toContainText('You were victorious')
        await expect(grid(page)).toContainText('Place warbands: 1 of 4.')
        await expect(grid(page)).not.toContainText('This is how you come to rule them')
        await expect(grid(page)).not.toContainText('bandits')
        await expect(grid(page).locator('select')).toHaveCount(0)
        await expect(grid(page).locator('ul')).toHaveCount(0)
        await expect(answer(page, 'Take spoils')).toHaveCount(0)
    })
})

/** The warbands step's pieces: the Nth places N. */
const placeButtons = (page: Page) =>
    grid(page).getByRole('button', { name: /^Place \d+ warbands? at / })
const placeButton = (page: Page, n: number, row = 0) =>
    grid(page)
        .getByRole('list', { name: 'Warbands on the sites taken' })
        .getByRole('listitem')
        .nth(row)
        .getByRole('button', { name: new RegExp(`^Place ${n} warbands? at `) })
const spoilsStepCount = (page: Page) => grid(page).getByText(/^\d of \d$/)
const leavePawn = (page: Page) => grid(page).getByRole('button', { name: /^Leave it at / })
const banishPrompt = (page: Page) =>
    grid(page).getByText(/^Tap a lit site to banish\s+def's\s+pawn there\.$/i)
const takeSpoils = (page: Page) => answer(page, 'Take spoils')
const takeAndBurn = (page: Page) => grid(page).getByRole('button', { name: /^Take and burn 2/ })
const SPOILS_SITE = 'slot.provinces.0'

/** The tooltips on the spoils' own controls; the magnifiers keep theirs. */
const titledSpoilsButtons = (page: Page) => grid(page).locator('button[title]:not(.magnifier)')

/** Scenario 64: the spoils one step at a time, in the Law's order (R-5.5.7). */
test.describe('scenario 64: the spoils one step at a time', () => {
    test('the warbands step: the site’s picture and name, a warband piece per warband in the force, the first ringed, and Next', async ({
        page
    }) => {
        await openTable(page, 'spoils')
        const rows = grid(page)
            .getByRole('list', { name: 'Warbands on the sites taken' })
            .getByRole('listitem')
        await expect(rows).toHaveCount(1)
        await expect(rows.first().getByRole('button', { name: /^Enlarge / })).toHaveCount(1)
        await expect(rows.first().locator('img').first()).toBeVisible()
        await expect(placeButtons(page)).toHaveCount(4)
        await expect(placeButton(page, 0)).toHaveCount(0)
        await expect(placeButton(page, 5)).toHaveCount(0)
        for (let n = 1; n <= 4; n++) {
            const piece = placeButton(page, n)
            await expect(piece).toHaveText('')
            await expect(piece.locator('img')).toHaveCount(1)
            await expect(piece).toBeEnabled()
            await expect(piece).toHaveAttribute('aria-pressed', n === 1 ? 'true' : 'false')
            if (n === 1) await expect(piece).toHaveClass(/ring-oath-accent/)
            else await expect(piece).not.toHaveClass(/ring-oath-accent/)
        }
        await expect(answer(page, 'Next')).toBeVisible()
        await expect(titledSpoilsButtons(page)).toHaveCount(0)
        expect(await clippedLabels(page)).toEqual([])
    })

    test('with one row, a tap on the 3rd places 3 and moves on; a tap on the ringed count places none', async ({
        page
    }) => {
        await openTable(page, 'spoils')
        await placeButton(page, 3).click()
        await expect(spoilsStepCount(page)).toHaveText('2 of 3')
        await undoButton(page).click()
        await expect(spoilsStepCount(page)).toHaveText('1 of 3')
        await expect(grid(page)).toContainText('Place warbands: 3 of 4.')
        for (let n = 1; n <= 4; n++) {
            await expect(placeButton(page, n)).toHaveAttribute(
                'aria-pressed',
                n <= 3 ? 'true' : 'false'
            )
        }

        await placeButton(page, 3).click()
        await expect(spoilsStepCount(page)).toHaveText('2 of 3')
        await undoButton(page).click()
        await expect(grid(page)).toContainText('Place warbands: 0 of 4.')
        for (let n = 1; n <= 4; n++) {
            await expect(placeButton(page, n)).toHaveAttribute('aria-pressed', 'false')
        }
        await answer(page, 'Next').click()
        await leavePawn(page).click()
        await takeSpoils(page).click()
        await expect.poll(async () => (await call(page, 'tableFacts')).campaignUnderway).toBe(false)
        expect((await call(page, 'tableFacts')).warbandsAt[SPOILS_SITE]?.att ?? 0).toBe(0)
    })

    test('a tap on the 2nd warband moves on to the pawn, picked on the map; a lit site moves on to the favor, whose two buttons send', async ({
        page
    }) => {
        await openTable(page, 'spoils')
        await placeButton(page, 2).click()
        await expect(spoilsStepCount(page)).toHaveText('2 of 3')
        await expect(banishPrompt(page)).toBeVisible()
        await expect(leavePawn(page)).toBeVisible()
        await expect(placeButtons(page)).toHaveCount(0)

        const lit = await litSlots(page)
        expect(lit.length).toBeGreaterThan(1)
        expect(lit).not.toContain(SPOILS_SITE)
        for (const slotId of lit) {
            await expect(siteAt(page, slotId).locator('.travel-cost')).toHaveText('banish')
            await expect(siteMagnifier(page, slotId)).toHaveCount(1)
        }
        await expect(dimmedSites(page)).not.toHaveCount(0)

        const [banishTo] = lit
        await (await uncovered(page, `.site[data-slot="${banishTo}"] .board-card`)).click()
        await expect(spoilsStepCount(page)).toHaveText('3 of 3')
        await expect(boardOffers(page)).toHaveCount(0)
        await expect(dimmedSites(page)).toHaveCount(0)
        await expect(grid(page)).toContainText(/def's\s+favor/i)

        const take = takeSpoils(page)
        const burn = takeAndBurn(page)
        await expect(take).toBeVisible()
        await expect(burn).toBeVisible()
        expect(await widthOf(take)).toBe(await widthOf(burn))
        expect(await pairLayout(take, burn)).toBe('side by side')
        expect(await backgroundOf(take)).toBe(await primaryBackground(page))
        await expect(titledSpoilsButtons(page)).toHaveCount(0)

        await take.click()
        await expect.poll(async () => (await call(page, 'tableFacts')).siteOf.def).toBe(banishTo)
        const facts = await call(page, 'tableFacts')
        expect(facts.warbandsAt[SPOILS_SITE]?.att).toBe(2)
        expect(facts.favorOf.def).toBe(4)
        expect(facts.campaignUnderway).toBe(false)
    })

    test('"Leave it" keeps the pawn where it stands; the burn sends the default warband', async ({
        page
    }) => {
        await openTable(page, 'spoils')
        await answer(page, 'Next').click()
        await expect(spoilsStepCount(page)).toHaveText('2 of 3')
        await leavePawn(page).click()
        await expect(spoilsStepCount(page)).toHaveText('3 of 3')
        await takeAndBurn(page).click()
        await expect.poll(async () => (await call(page, 'tableFacts')).campaignUnderway).toBe(false)
        const facts = await call(page, 'tableFacts')
        expect(facts.siteOf.def).toBe(SPOILS_SITE)
        expect(facts.favorOf.def).toBe(2)
        expect(facts.warbandsAt[SPOILS_SITE]?.att).toBe(1)
    })

    test('Undo steps back one step at a time, each with its choice still marked, then to the default', async ({
        page
    }) => {
        await openTable(page, 'spoils')
        await expect(undoButton(page)).toHaveCount(0)
        await placeButton(page, 3).click()
        await (await uncovered(page, '.board-card.offered')).click()
        await expect(spoilsStepCount(page)).toHaveText('3 of 3')

        await undoButton(page).click()
        await expect(spoilsStepCount(page)).toHaveText('2 of 3')
        await expect(boardOffers(page)).not.toHaveCount(0)
        await undoButton(page).click()
        await expect(spoilsStepCount(page)).toHaveText('1 of 3')
        await expect(placeButton(page, 3)).toHaveAttribute('aria-pressed', 'true')
        await expect(boardOffers(page)).toHaveCount(0)
        await undoButton(page).click()
        await expect(placeButton(page, 1)).toHaveAttribute('aria-pressed', 'true')
        await expect(undoButton(page)).toHaveCount(0)
        expect((await call(page, 'tableFacts')).campaignUnderway).toBe(true)
    })

    test('two sites taken: a row each, 1 on each, Next to move on; the relic last, with "Take spoils" once it is chosen', async ({
        page
    }) => {
        await openTable(page, 'spoilsRelicHunter')
        await expect(spoilsStepCount(page)).toHaveText('1 of 2')
        await expect(grid(page)).toContainText('Place warbands: 2 of 4.')
        await expect(placeButton(page, 1, 0)).toHaveAttribute('aria-pressed', 'true')
        await expect(placeButton(page, 1, 1)).toHaveAttribute('aria-pressed', 'true')
        await placeButton(page, 2, 0).click()
        await expect(spoilsStepCount(page)).toHaveText('1 of 2')
        await expect(grid(page)).toContainText('Place warbands: 3 of 4.')
        await expect(placeButton(page, 2, 1)).toBeEnabled()
        await expect(placeButton(page, 3, 1)).toBeDisabled()
        await answer(page, 'Next').click()

        await expect(spoilsStepCount(page)).toHaveText('2 of 2')
        await expect(grid(page)).toContainText('Cup of Plenty')
        const keep = answer(page, 'Keep it')
        const bottom = answer(page, 'Bottom of the relic deck')
        await expect(keep).toHaveAttribute('aria-pressed', 'false')
        await expect(bottom).toHaveAttribute('aria-pressed', 'false')
        expect(await widthOf(keep)).toBe(await widthOf(bottom))
        await expect(takeSpoils(page)).toHaveCount(0)
        await expect(answer(page, 'Next')).toHaveCount(0)
        await bottom.click()
        await expect(spoilsStepCount(page)).toHaveText('2 of 2')
        await expect(bottom).toHaveAttribute('aria-pressed', 'true')
        await expect(takeSpoils(page)).toBeVisible()

        await takeSpoils(page).click()
        await expect.poll(async () => (await call(page, 'tableFacts')).campaignUnderway).toBe(false)
        const facts = await call(page, 'tableFacts')
        expect(facts.warbandsAt[SPOILS_SITE]?.att).toBe(2)
        expect(facts.warbandsAt['slot.provinces.1']?.att).toBe(1)
    })

    test('a warband the other site holds cannot be tapped and keeps its place; none past the force is drawn', async ({
        page
    }) => {
        await openTable(page, 'spoilsRelicHunter')
        await placeButton(page, 3, 0).click()
        await expect(grid(page)).toContainText('Place warbands: 4 of 4.')
        for (const row of [0, 1]) {
            const pieces = grid(page)
                .getByRole('list', { name: 'Warbands on the sites taken' })
                .getByRole('listitem')
                .nth(row)
                .getByRole('button', { name: /^Place \d+ warbands? at / })
            await expect(pieces).toHaveCount(4)
            await expect(placeButton(page, 5, row)).toHaveCount(0)
        }
        for (let n = 1; n <= 4; n++) {
            await expect(placeButton(page, n, 0)).toHaveAttribute(
                'aria-pressed',
                n <= 3 ? 'true' : 'false'
            )
            if (n <= 3) await expect(placeButton(page, n, 0)).toBeEnabled()
            else await expect(placeButton(page, n, 0)).toBeDisabled()
            await expect(placeButton(page, n, 1)).toHaveAttribute(
                'aria-pressed',
                n === 1 ? 'true' : 'false'
            )
            if (n === 1) await expect(placeButton(page, n, 1)).toBeEnabled()
            else await expect(placeButton(page, n, 1)).toBeDisabled()
        }

        await placeButton(page, 3, 0).click()
        await expect(grid(page)).toContainText('Place warbands: 1 of 4.')
        for (let n = 1; n <= 4; n++) {
            await expect(placeButton(page, n, 0)).toHaveAttribute('aria-pressed', 'false')
            await expect(placeButton(page, n, 1)).toBeEnabled()
        }
        await expect(spoilsStepCount(page)).toHaveText('1 of 2')
    })
})

for (const viewport of [
    { width: 402, height: 874 },
    { width: 375, height: 812 }
]) {
    test.describe(`scenario 64 on a phone held upright, ${viewport.width} wide`, () => {
        test.use({ viewport, hasTouch: true })

        test('the warband pieces are 44 px square and the pawn’s button 44 px tall, never the panel’s width', async ({
            page
        }) => {
            await openTable(page, 'spoils')
            const panelWidth = (await layoutSizeOf(grid(page)))?.width ?? 0
            await expect(placeButtons(page)).toHaveCount(4)
            for (let n = 1; n <= 4; n++) {
                expect(await layoutSizeOf(placeButton(page, n))).toEqual({ width: 44, height: 44 })
            }
            expect(await clippedLabels(page)).toEqual([])
            expect(await wrappedLabels(page)).toEqual([])

            await placeButton(page, 2).tap()
            await expect(banishPrompt(page)).toBeVisible()
            const leave = await layoutSizeOf(leavePawn(page))
            expect(leave?.height).toBe(44)
            expect(leave?.width ?? 0).toBeLessThan(panelWidth * 0.8)
            expect(await clippedLabels(page)).toEqual([])
            expect(await wrappedLabels(page)).toEqual([])
        })

        test('the pawn’s step frames the map on its region under region chips; a tap on a lit site banishes it there', async ({
            page
        }) => {
            await openTable(page, 'spoils')
            await placeButton(page, 1).tap()
            await expect(banishPrompt(page)).toBeVisible()
            await expect(regionChip(page, 'Provinces')).toHaveAttribute('aria-pressed', 'true')
            await expect(regionChip(page, 'Provinces')).toHaveAccessibleName(
                /^Provinces: \d+ to banish to$/
            )
            const lit = (await litSlots(page)).filter((slotId) =>
                slotId.startsWith('slot.provinces.')
            )
            expect(lit.length).toBeGreaterThan(0)
            const [banishTo] = lit
            await expect.poll(() => onScreen(page, siteCard(page, banishTo))).toBe(true)
            const chip = await boxOf(siteAt(page, banishTo).locator('.travel-cost'))
            expect(inside(chip, await boxOf(siteCard(page, banishTo)))).toBe(true)

            await siteCard(page, banishTo).tap()
            await expect(spoilsStepCount(page)).toHaveText('3 of 3')
            await expect(regionChips(page)).toHaveCount(0)
            await takeSpoils(page).tap()
            await expect
                .poll(async () => (await call(page, 'tableFacts')).siteOf.def)
                .toBe(banishTo)
        })
    })
}

const CAMPAIGN_STEPS = [
    'campaignTwoDefenders',
    'battleDefenderPlans',
    'attackerPlans',
    'sacrifice',
    'sacrificeMixed',
    'wonOutright',
    'exileDefeated',
    'spoils'
] as const

/** Brings each step to the moment its confirm shows. */
async function completeCampaignStep(page: Page, name: (typeof CAMPAIGN_STEPS)[number]) {
    switch (name) {
        case 'campaignTwoDefenders':
            await tile(page, 'Campaign').click()
            await expect(grid(page)).toContainText('Attack who?')
            expect(await clippedLabels(page)).toEqual([])
            await grid(page).getByRole('button', { name: /^ann$/i }).click()
            await grid(page).locator('button[aria-pressed]').first().click()
            await grid(page)
                .getByRole('button', { name: /^Add attack die 2/ })
                .click()
            await expect(answer(page, 'Declare')).toBeVisible()
            return
        case 'battleDefenderPlans':
        case 'attackerPlans':
            await planCard(page).click()
            await expect(answer(page, 'Use plans')).toBeVisible()
            return
        case 'sacrificeMixed':
            await pickCount(page, 0, 2)
            return
        case 'exileDefeated':
            await pickCount(page, 0, 1)
            await pickCount(page, 1, 1)
            await expect(answer(page, 'Kill')).toBeVisible()
            return
        case 'spoils':
            // The warbands and the pawn come first; the favor's two buttons send.
            expect(await clippedLabels(page)).toEqual([])
            await answer(page, 'Next').click()
            expect(await clippedLabels(page)).toEqual([])
            await leavePawn(page).click()
            await expect(takeSpoils(page)).toBeVisible()
            return
        default:
            return
    }
}

/** The steps whose two confirms share one width, by their names, and how the two sit at 375 px. */
const CONFIRM_PAIRS: Partial<
    Record<(typeof CAMPAIGN_STEPS)[number], [string, RegExp, 'side by side' | 'one per line']>
> = {
    battleDefenderPlans: ['Use plans', /^No plans$/, 'side by side'],
    attackerPlans: ['Use plans', /^No plans$/, 'side by side'],
    sacrifice: ['Sacrifice 3 and win', /^Sacrifice nothing$/, 'one per line'],
    spoils: ['Take spoils', /^Take and burn 2/, 'one per line']
}

test.describe('scenario 62 on a phone: every label inside its button, on one line', () => {
    test.use({ viewport: { width: 375, height: 812 } })

    for (const name of CAMPAIGN_STEPS) {
        test(`${name}: no label is wider than its button or runs onto a second line`, async ({
            page
        }) => {
            await openTable(page, name)
            await completeCampaignStep(page, name)
            expect(await clippedLabels(page)).toEqual([])
            expect(await wrappedLabels(page)).toEqual([])

            const pair = CONFIRM_PAIRS[name]
            if (!pair) return
            // Side by side when the two fit, one per line when they do not; one width and 44 px either
            // way, read from the layout, since a tall step's panel is scaled to fit.
            const first = answer(page, pair[0])
            const second = grid(page).getByRole('button', { name: pair[1] })
            await expect(first).toBeVisible()
            await expect(second).toBeVisible()
            expect(await widthOf(first)).toBe(await widthOf(second))
            expect(await pairLayout(first, second)).toBe(pair[2])
            for (const button of [first, second]) {
                expect(
                    await button.evaluate((element) =>
                        element instanceof HTMLElement ? element.offsetHeight : 0
                    )
                ).toBe(44)
            }
        })
    }
})

/** Scenario 66: every count of warbands, favor or secrets is a row of the pieces themselves. */
test.describe('scenario 66: counts as pieces', () => {
    const boardPiece = (page: Page, n: number) =>
        grid(page).getByRole('button', { name: `${n} of the warbands on your board`, exact: true })
    const sitePiece = (page: Page, n: number) =>
        grid(page).getByRole('button', { name: new RegExp(`^${n} of the warbands at `) })
    const pieces = (page: Page) => grid(page).getByRole('button', { name: /^\d+ of the / })
    const win = (page: Page) => answer(page, 'Sacrifice 3 and win')
    const lose = (page: Page) => answer(page, 'Sacrifice nothing')

    test('the sacrifice from a force in two places: a row of warbands per place, the board first, nothing picked, no defeat rows', async ({
        page
    }) => {
        await openTable(page, 'sacrificeSplit')
        await expect(grid(page)).toContainText('To win, sacrifice 3:')
        await expect(pieces(page)).toHaveCount(5)
        await expect(pieces(page)).toHaveText(['', '', '', '', ''])
        await expect(pieces(page).locator('img')).toHaveCount(5)
        await expect(grid(page).locator('[aria-pressed="true"]')).toHaveCount(0)
        await expect(grid(page)).not.toContainText('If you lose')
        await expect(grid(page)).not.toContainText('Imperial')
        await expect(win(page)).toHaveCount(0)
        await expect(lose(page)).toBeVisible()

        // One column of labels, the board's over the site's, each beside its pieces.
        const boardLabel = grid(page).getByText(/^\s*on your board\s*$/)
        const siteLabel = grid(page).getByText(/^\s*at\s+\S/)
        const [boardBox, siteBox] = [await boxOf(boardLabel), await boxOf(siteLabel)]
        expect(boardBox.y).toBeLessThan(siteBox.y)
        expect(Math.abs(boardBox.x - siteBox.x)).toBeLessThan(1)
        const [firstBoard, firstSite] = [
            await boxOf(boardPiece(page, 1)),
            await boxOf(sitePiece(page, 1))
        ]
        expect(Math.abs(firstBoard.x - firstSite.x)).toBeLessThan(1)
        expect(firstBoard.x).toBeGreaterThan(boardBox.x + boardBox.width)
    })

    test('a tap on the Nth warband sets N, ringed rose; a second tap on it sets 0', async ({
        page
    }) => {
        await openTable(page, 'sacrificeSplit')
        await boardPiece(page, 2).click()
        for (let n = 1; n <= 3; n++) {
            await expect(boardPiece(page, n)).toHaveAttribute(
                'aria-pressed',
                n <= 2 ? 'true' : 'false'
            )
        }
        await expect(boardPiece(page, 1)).toHaveClass(/ring-oath-danger/)
        await expect(boardPiece(page, 1)).not.toHaveClass(/ring-oath-accent/)
        await expect(win(page)).toHaveCount(0)
        await boardPiece(page, 2).click()
        await expect(grid(page).locator('[aria-pressed="true"]')).toHaveCount(0)
    })

    test('"Sacrifice 3 and win" shows only once the picks add up; the rest can no longer be added and keep their place', async ({
        page
    }) => {
        await openTable(page, 'sacrificeSplit')
        await boardPiece(page, 2).click()
        await expect(win(page)).toHaveCount(0)
        await sitePiece(page, 1).click()
        await expect(win(page)).toBeVisible()
        expect(await backgroundOf(win(page))).toBe(await primaryBackground(page))
        expect(await widthOf(win(page))).toBe(await widthOf(lose(page)))
        await expect(boardPiece(page, 3)).toBeDisabled()
        await expect(sitePiece(page, 2)).toBeDisabled()
        await expect(pieces(page)).toHaveCount(5)
        await expect(grid(page)).not.toContainText("Can't win")

        // Lowering the board's count opens the site's second warband again.
        await boardPiece(page, 1).click()
        await expect(win(page)).toHaveCount(0)
        await expect(sitePiece(page, 2)).toBeEnabled()
        await sitePiece(page, 2).click()
        await expect(win(page)).toBeVisible()
        await win(page).click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).machineState)
            .not.toBe('CampaignSacrifice')
        expect((await call(page, 'tableFacts')).boardOf.att).toEqual({ att: 2 })
    })

    test('a split with one answer, the whole force, starts picked', async ({ page }) => {
        await openTable(page, 'sacrificeWhole')
        await expect(pieces(page)).toHaveCount(3)
        await expect(grid(page).locator('[aria-pressed="true"]')).toHaveCount(3)
        await expect(win(page)).toBeVisible()
        await expect(lose(page)).toBeVisible()
    })

    test('when no split can win, no rows show and one red line says why, beside "Sacrifice nothing"', async ({
        page
    }) => {
        await openTable(page, 'sacrificeShort')
        await expect(grid(page)).not.toContainText('To win, sacrifice')
        await expect(pieces(page)).toHaveCount(0)
        await expect(win(page)).toHaveCount(0)
        await expect(lose(page)).toBeVisible()
        const red = grid(page).locator('.text-oath-danger').filter({ hasText: "Can't win" })
        await expect(red).toHaveCount(1)
        await expect(red).toContainText('only 2 warbands in your force')
    })

    test('a force of two owners keeps the defeat rows, each named with its owner', async ({
        page
    }) => {
        await openTable(page, 'sacrificeMixed')
        await expect(grid(page)).toContainText(/If you lose, \d die:/)
        await expect(
            grid(page).getByRole('button', { name: /^1 of the Imperial warbands on your board$/ })
        ).toHaveCount(2)
        await expect(lose(page)).toHaveCount(0)
    })

    test('the Darkest Secret’s price: the secrets held, the least bid picked, those under it ringed but untappable', async ({
        page
    }) => {
        await openTable(page, 'recover')
        await tile(page, 'Recover').click()
        await page.getByRole('button', { name: /^Recover the Darkest Secret: pay/ }).click()
        const secrets = grid(page).getByRole('button', { name: /^pay \d+ secrets$/ })
        await expect(secrets).toHaveCount(3)
        await expect(secrets.locator('img')).toHaveCount(3)
        await expect(secrets).toHaveText(['', '', ''])
        await expect(secrets.nth(0)).toBeDisabled()
        await expect(secrets.nth(0)).toHaveAttribute('aria-pressed', 'true')
        await expect(secrets.nth(1)).toHaveAttribute('aria-pressed', 'true')
        await expect(secrets.nth(1)).toHaveClass(/ring-oath-accent/)
        await expect(secrets.nth(2)).toHaveAttribute('aria-pressed', 'false')

        // A tap on the least bid keeps it; the next sets 3, and a tap on it goes back to the least.
        await secrets.nth(1).click()
        await expect(secrets.nth(1)).toHaveAttribute('aria-pressed', 'true')
        await secrets.nth(2).click()
        await expect(secrets.nth(2)).toHaveAttribute('aria-pressed', 'true')
        await secrets.nth(2).click()
        await expect(secrets.nth(2)).toHaveAttribute('aria-pressed', 'false')
        await expect(secrets.nth(1)).toHaveAttribute('aria-pressed', 'true')
        await expect(
            grid(page).getByRole('button', { name: 'Recover the Darkest Secret', exact: true })
        ).toBeVisible()
    })

    for (const viewport of [
        { width: 375, height: 812 },
        { width: 402, height: 874 }
    ]) {
        test.describe(`on a ${viewport.width} px phone`, () => {
            test.use({ viewport })

            /** Every piece in the panel, laid out 44 px square and drawn inside the panel. */
            async function piecesFit(page: Page, name: RegExp, count: number) {
                const found = grid(page).getByRole('button', { name })
                await expect(found).toHaveCount(count)
                const panel = await boxOf(grid(page))
                for (const box of await boxesOf(found)) expect(inside(box, panel)).toBe(true)
                const sizes = await found.evaluateAll((buttons) =>
                    buttons.map((button) =>
                        button instanceof HTMLElement
                            ? [button.offsetWidth, button.offsetHeight]
                            : [0, 0]
                    )
                )
                for (const [width, height] of sizes) {
                    expect(width).toBeGreaterThanOrEqual(44)
                    expect(height).toBeGreaterThanOrEqual(44)
                }
            }

            test('the sacrifice’s warbands, with each row beside its label', async ({ page }) => {
                await openTable(page, 'sacrificeSplit')
                await piecesFit(page, /^\d+ of the warbands /, 5)
                const boardLabel = await boxOf(grid(page).getByText(/^\s*on your board\s*$/))
                const firstBoard = await boxOf(boardPiece(page, 1))
                expect(firstBoard.x).toBeGreaterThan(boardLabel.x + boardLabel.width)
                expect(firstBoard.y).toBeLessThan(boardLabel.y + boardLabel.height)
                await boardPiece(page, 2).click()
                await sitePiece(page, 1).click()
                expect(await clippedLabels(page)).toEqual([])
            })

            test('the defending side’s losses', async ({ page }) => {
                await openTable(page, 'exileDefeated')
                await piecesFit(page, /^\d+ of the warbands /, 4)
            })

            test('Move warbands', async ({ page }) => {
                await openTable(page, 'moves')
                await grid(page).getByRole('button', { name: 'Move warbands', exact: true }).click()
                await piecesFit(page, /: move \d+$/, 6)
            })

            test('the Darkest Secret’s price', async ({ page }) => {
                await openTable(page, 'recover')
                await tile(page, 'Recover').click()
                await page.getByRole('button', { name: /^Recover the Darkest Secret: pay/ }).click()
                await piecesFit(page, /^pay \d+ secrets$/, 3)
            })

            test('Revelation’s favor', async ({ page }) => {
                await openTable(page, 'askRevelation')
                await piecesFit(page, /^burn \d+ favor$/, 4)
            })
        })
    }
})

/** Scenario 67: a power's players are chips, its warbands and the short bank's favor are pieces. */
test.describe('scenario 67: a power’s picks as chips and pieces', () => {
    const powerRow = (page: Page, cardId: string) =>
        grid(page).locator(`[data-action-power="${cardId}"]`)
    const chips = (page: Page, cardId: string) =>
        powerRow(page, cardId).locator('button[aria-pressed]:not(.magnifier)')
    const chip = (page: Page, cardId: string, name: RegExp) =>
        powerRow(page, cardId).getByRole('button', { name })
    const use = (page: Page) =>
        grid(page).getByRole('button', { name: 'Use, paying 1 secret', exact: true })
    const piece = (page: Page, n: number, where: RegExp) =>
        grid(page).getByRole('button', {
            name: new RegExp(`^${n} of the warbands ${where.source}$`, 'i')
        })
    const pieces = (page: Page) => grid(page).getByRole('button', { name: /^\d+ of the warbands / })

    async function openPower(page: Page, table: TableFixture.TableName) {
        await openTable(page, table)
        await usePower(page).click()
    }

    test('the Whistle: “Call:” and a chip per pawn at another site, one width, nothing picked; a tap picks and Use shows', async ({
        page
    }) => {
        await openPower(page, 'pickerWhistle')
        const row = powerRow(page, 'relic.whistle')
        await expect(row.getByText('Call:', { exact: true })).toBeVisible()
        await expect(row.locator('select')).toHaveCount(0)
        await expect(chips(page, 'relic.whistle')).toHaveCount(2)
        for (const each of await chips(page, 'relic.whistle').all()) {
            await expect(each).toHaveAttribute('aria-pressed', 'false')
        }
        await expectOneWidth(chips(page, 'relic.whistle'))
        await expect(use(page)).toHaveCount(0)
        await expect(row.locator('[title]')).toHaveCount(0)

        await chip(page, 'relic.whistle', /^rhys$/i).click()
        await expect(chip(page, 'relic.whistle', /^rhys$/i)).toHaveAttribute('aria-pressed', 'true')
        await expect(chip(page, 'relic.whistle', /^ann$/i)).toHaveAttribute('aria-pressed', 'false')
        await expect(use(page)).toBeVisible()
        // A required pick stays made: a second tap keeps it.
        await chip(page, 'relic.whistle', /^rhys$/i).click()
        await expect(chip(page, 'relic.whistle', /^rhys$/i)).toHaveAttribute('aria-pressed', 'true')
        await use(page).click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).siteOf.rhys)
            .toBe('slot.cradle.0')
    })

    test('the Whistle with one pawn elsewhere: its chip starts picked and Use shows', async ({
        page
    }) => {
        await openPower(page, 'usePower')
        await expect(chips(page, 'relic.whistle')).toHaveCount(1)
        await expect(chips(page, 'relic.whistle')).toHaveAttribute('aria-pressed', 'true')
        await expect(use(page)).toBeVisible()
    })

    test('Terror Spells: “Kill 2:” over a row per place in the region, your board and another’s among them, nothing picked', async ({
        page
    }) => {
        await openPower(page, 'pickerTerror')
        const row = powerRow(page, 'denizen.arcane.terror-spells')
        await expect(row.getByText('Kill 2:', { exact: true })).toBeVisible()
        await expect(row.locator('select')).toHaveCount(0)
        await expect(pieces(page)).toHaveCount(10)
        await expect(pieces(page).locator('img')).toHaveCount(10)
        await expect(grid(page).locator('[aria-pressed="true"]')).toHaveCount(0)
        await expect(piece(page, 3, /at Mountain/)).toBeVisible()
        await expect(piece(page, 2, /at Marshes/)).toBeVisible()
        await expect(piece(page, 3, /on your board/)).toBeVisible()
        await expect(piece(page, 2, /on rhys's board/)).toBeVisible()
        // Ann's board is in another region: no row.
        await expect(row).not.toContainText(/ann/i)
        await expect(use(page)).toHaveCount(0)
    })

    test('Terror Spells: a tap on the 2nd at the Mountain kills 2 there, rose; every other piece keeps its place, untappable', async ({
        page
    }) => {
        await openPower(page, 'pickerTerror')
        await piece(page, 2, /at Mountain/).click()
        await expect(piece(page, 1, /at Mountain/)).toHaveAttribute('aria-pressed', 'true')
        await expect(piece(page, 2, /at Mountain/)).toHaveAttribute('aria-pressed', 'true')
        await expect(piece(page, 2, /at Mountain/)).toHaveClass(/ring-oath-danger/)
        await expect(piece(page, 3, /at Mountain/)).toBeDisabled()
        for (const where of [/at Marshes/, /on your board/, /on rhys's board/]) {
            await expect(piece(page, 1, where)).toBeDisabled()
        }
        await expect(pieces(page)).toHaveCount(10)
        await expect(use(page)).toBeVisible()
        await use(page).click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).warbandsAt['slot.provinces.0'])
            .toEqual({ rhys: 1 })
    })

    test('Terror Spells: one on your own board and one on another’s; one alone waits, and a second tap clears it', async ({
        page
    }) => {
        await openPower(page, 'pickerTerror')
        await piece(page, 1, /on your board/).click()
        await expect(use(page)).toHaveCount(0)
        await expect(piece(page, 2, /on your board/)).toBeEnabled()
        await piece(page, 1, /on your board/).click()
        await expect(grid(page).locator('[aria-pressed="true"]')).toHaveCount(0)
        await piece(page, 1, /on your board/).click()
        await piece(page, 1, /on rhys's board/).click()
        await expect(use(page)).toBeVisible()
        await use(page).click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).boardOf.dana)
            .toEqual({ dana: 2 })
        expect((await call(page, 'tableFacts')).boardOf.rhys).toEqual({ rhys: 1 })
    })

    test('Blood Pact: “Sacrifice:” and a button per pair, the fifth warband alone untappable; two pairs sacrifice four', async ({
        page
    }) => {
        await openPower(page, 'pickerPact')
        const row = powerRow(page, 'denizen.arcane.blood-pact')
        await expect(row.getByText('Sacrifice:', { exact: true })).toBeVisible()
        // The card names its board, so the pairs stand beside its words with no place named.
        await expect(row.getByText(/on your board/)).toHaveCount(0)
        const [words, firstPair] = [
            await boxOf(row.getByText('Sacrifice:', { exact: true })),
            await boxOf(pieces(page).first())
        ]
        expect(firstPair.x).toBeGreaterThan(words.x + words.width)
        expect(firstPair.y).toBeLessThan(words.y + words.height)
        await expect(pieces(page)).toHaveCount(2)
        await expect(pieces(page).nth(0).locator('img')).toHaveCount(2)
        await expect(row.locator('[data-leftover-piece] img')).toHaveCount(1)
        await expect(grid(page).locator('[aria-pressed="true"]')).toHaveCount(0)
        await expect(use(page)).toHaveCount(0)

        await piece(page, 4, /on your board/).click()
        await expect(piece(page, 2, /on your board/)).toHaveAttribute('aria-pressed', 'true')
        await expect(piece(page, 4, /on your board/)).toHaveClass(/ring-oath-danger/)
        await expect(use(page)).toBeVisible()
        await use(page).click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).boardOf.dana)
            .toEqual({ dana: 1 })
    })

    test('the Obsidian Cage: a row per board its warbands may go to, gold, each colour held to what the Cage holds', async ({
        page
    }) => {
        await openPower(page, 'pickerCage')
        const useFree = grid(page).getByRole('button', { name: 'Use', exact: true })
        await expect(pieces(page)).toHaveCount(7)
        await expect(grid(page).locator('[aria-pressed="true"]')).toHaveCount(0)
        await expect(useFree).toHaveCount(0)
        await piece(page, 1, /to your board/).click()
        await expect(piece(page, 1, /to your board/)).toHaveClass(/ring-oath-accent/)
        await expect(piece(page, 1, /to ann's board/)).toBeEnabled()
        await expect(piece(page, 2, /to ann's board/)).toBeDisabled()
        await expect(piece(page, 3, /to rhys's board/)).toBeEnabled()
        await piece(page, 1, /to ann's board/).click()
        await expect(piece(page, 2, /to your board/)).toBeDisabled()
        await useFree.click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).boardOf.ann)
            .toEqual({ imperial: 1 })
    })

    test('setup’s short bank: favor tokens, filled in map order; the Mine’s third waits until the Salt Flats give one up', async ({
        page
    }) => {
        await openTable(page, 'shortBank')
        await expect(favorOn(page, 2, 'Salt Flats')).toHaveAttribute('aria-pressed', 'true')
        await expect(favorOn(page, 2, 'Mine')).toHaveAttribute('aria-pressed', 'true')
        await expect(favorOn(page, 2, 'Mine')).toHaveClass(/ring-oath-accent/)
        await expect(favorOn(page, 2, 'Mine').locator('img')).toHaveCount(1)
        await expect(favorOn(page, 3, 'Mine')).toHaveAttribute('aria-pressed', 'false')
        await expect(favorOn(page, 3, 'Mine')).toBeDisabled()
        await expect(grid(page)).not.toContainText('placed.')

        await favorOn(page, 1, 'Salt Flats').click()
        await expect(grid(page).getByText('3 of 4 placed.')).toBeVisible()
        await expect(favorOn(page, 3, 'Mine')).toBeEnabled()
        await favorOn(page, 3, 'Mine').click()
        await expect(favorOn(page, 3, 'Mine')).toHaveAttribute('aria-pressed', 'true')
        await expect(favorOn(page, 2, 'Salt Flats')).toBeDisabled()
        await expect(grid(page)).not.toContainText('placed.')
    })

    for (const viewport of [
        { width: 375, height: 812 },
        { width: 402, height: 874 }
    ]) {
        test.describe(`on a ${viewport.width} px phone`, () => {
            test.use({ viewport })

            /** Each control laid out at least 44 px tall (and wide, where it is a piece), inside the panel. */
            async function controlsFit(
                page: Page,
                controls: Locator,
                count: number,
                square: boolean
            ) {
                await expect(controls).toHaveCount(count)
                const panel = await boxOf(grid(page))
                for (const box of await boxesOf(controls)) expect(inside(box, panel)).toBe(true)
                const sizes = await controls.evaluateAll((buttons) =>
                    buttons.map((button) =>
                        button instanceof HTMLElement
                            ? [button.offsetWidth, button.offsetHeight]
                            : [0, 0]
                    )
                )
                for (const [width, height] of sizes) {
                    if (square) expect(width).toBeGreaterThanOrEqual(44)
                    expect(height).toBeGreaterThanOrEqual(44)
                }
                expect(await clippedLabels(page)).toEqual([])
            }

            test('the Whistle’s chips, and Use', async ({ page }) => {
                await openPower(page, 'pickerWhistle')
                await controlsFit(page, chips(page, 'relic.whistle'), 2, false)
                await chip(page, 'relic.whistle', /^ann$/i).click()
                await controlsFit(page, use(page), 1, false)
            })

            test('Terror Spells’ pieces', async ({ page }) => {
                await openPower(page, 'pickerTerror')
                await controlsFit(page, pieces(page), 10, true)
            })

            test('Blood Pact’s pairs, 66 by 44', async ({ page }) => {
                await openPower(page, 'pickerPact')
                await controlsFit(page, pieces(page), 2, true)
                expect(await layoutSizeOf(pieces(page).first())).toEqual({ width: 66, height: 44 })
            })

            test('the Obsidian Cage’s pieces', async ({ page }) => {
                await openPower(page, 'pickerCage')
                await controlsFit(page, pieces(page), 7, true)
            })

            test('the short bank’s favor', async ({ page }) => {
                await openTable(page, 'shortBank')
                await controlsFit(
                    page,
                    grid(page).getByRole('button', { name: /^place \d favor on / }),
                    5,
                    true
                )
            })
        })
    }
})

/** Scenario 68: a power's site is a tap on the lit map, one pick for the whole Use a power panel. */
test.describe('scenario 68: a power’s site on the lit map', () => {
    const CAPTAINS = 'denizen.order.captains'
    const SIEGE_ENGINES = 'denizen.order.siege-engines'
    const PALANQUIN = 'denizen.order.palanquin'
    const [CITY, PLAINS] = ['slot.cradle.0', 'slot.cradle.1']
    const [SLUM, RIVER, MOUNTAIN] = ['slot.provinces.0', 'slot.provinces.1', 'slot.provinces.2']
    const PASS = 'slot.hinterland.0'
    const powerRow = (page: Page, cardId: string) =>
        grid(page).locator(`[data-action-power="${cardId}"]`)
    const siteRow = (page: Page, cardId: string) =>
        powerRow(page, cardId).locator('[data-site-row]')
    const useIn = (page: Page, cardId: string) =>
        powerRow(page, cardId).getByRole('button', { name: /^Use\b/ })
    const chipOn = (page: Page, slotId: string) => siteAt(page, slotId).locator('.travel-cost')

    async function openPower(page: Page, table: TableFixture.TableName) {
        await openTable(page, table)
        await usePower(page).click()
    }

    test('two powers: every site either takes is lit, each chip naming the rows it fills, the rest dimmed; the rows wait', async ({
        page
    }) => {
        await openPower(page, 'pickerSites')
        await expect(siteRow(page, CAPTAINS)).toHaveText(/^\s*Campaign at:\s*tap a lit site\.\s*$/)
        await expect(siteRow(page, SIEGE_ENGINES)).toHaveText(
            /^\s*Kill 2 at:\s*tap a lit site\.\s*$/
        )
        await expect(grid(page).locator('select')).toHaveCount(0)
        await expect(useIn(page, CAPTAINS)).toHaveCount(0)
        await expect(useIn(page, SIEGE_ENGINES)).toHaveCount(0)
        expect(await litSlots(page)).toEqual([CITY, PLAINS, SLUM].sort())
        await expect(dimmedSites(page)).toHaveCount(5)
        await expect(chipOn(page, CITY)).toHaveText('Kill 2')
        // The panel lists an adviser's power before a site's, and the chip names its rows in that order.
        await expect(chipOn(page, PLAINS)).toHaveText('Kill 2 · Campaign')
        await expect(chipOn(page, SLUM)).toHaveText('Campaign')
        await expect(pickedSites(page)).toHaveCount(0)
        for (const slotId of [CITY, PLAINS, SLUM]) await expectPhoneChip(page, slotId)
    })

    test('a tap on a site both offer fills both rows and shows both Uses; nothing is sent until one is pressed', async ({
        page
    }) => {
        await openPower(page, 'pickerSites')
        await siteCard(page, PLAINS).click()
        await expect(siteRow(page, CAPTAINS)).toHaveText(/^\s*Campaign at:\s*Plains\s*$/)
        await expect(siteRow(page, SIEGE_ENGINES)).toHaveText(/^\s*Kill 2 at:\s*Plains\s*$/)
        await expect(useIn(page, CAPTAINS)).toHaveAccessibleName('Use, paying 1 favor')
        await expect(useIn(page, SIEGE_ENGINES)).toHaveAccessibleName('Use, paying 1 favor')
        await expect(pickedSites(page)).toHaveCount(1)
        await expect(siteAt(page, PLAINS).locator('.board-card.picked')).toHaveCount(1)
        expect((await call(page, 'tableFacts')).warbandsAt[PLAINS]).toEqual({ imperial: 2 })

        // Siege Engines kills two at the Plains, even yours.
        await useIn(page, SIEGE_ENGINES).click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).warbandsAt[PLAINS]?.imperial ?? 0)
            .toBe(0)
    })

    test('a tap on a site one row lacks fills only the other; a tap elsewhere moves the one ring; Undo takes back each tap', async ({
        page
    }) => {
        await openPower(page, 'pickerSites')
        await siteCard(page, PLAINS).click()
        await siteCard(page, CITY).click()
        await expect(siteRow(page, SIEGE_ENGINES)).toHaveText(/^\s*Kill 2 at:\s*Drowned City\s*$/)
        await expect(siteRow(page, CAPTAINS)).toHaveText(/^\s*Campaign at:\s*tap a lit site\.\s*$/)
        await expect(useIn(page, CAPTAINS)).toHaveCount(0)
        await expect(useIn(page, SIEGE_ENGINES)).toBeVisible()
        await expect(pickedSites(page)).toHaveCount(1)
        await expect(siteAt(page, CITY).locator('.board-card.picked')).toHaveCount(1)
        expect(await litSlots(page)).toEqual([CITY, PLAINS, SLUM].sort())

        await undoButton(page).click()
        await expect(siteRow(page, CAPTAINS)).toHaveText(/^\s*Campaign at:\s*Plains\s*$/)
        await expect(siteRow(page, SIEGE_ENGINES)).toHaveText(/^\s*Kill 2 at:\s*Plains\s*$/)
        await undoButton(page).click()
        await expect(siteRow(page, CAPTAINS)).toHaveText(/tap a lit site\./)
        await expect(siteRow(page, SIEGE_ENGINES)).toHaveText(/tap a lit site\./)
        await expect(pickedSites(page)).toHaveCount(0)
        expect((await call(page, 'tableFacts')).staged).toBe('useActionPower')
    })

    test('one power wants a site: its sites are lit, and a tap rings one and shows its Use; Use campaigns from there', async ({
        page
    }) => {
        await openPower(page, 'pickerSitesOne')
        await expect(powerRow(page, SIEGE_ENGINES)).toHaveCount(0)
        expect(await litSlots(page)).toEqual([PLAINS, SLUM].sort())
        await expect(chipOn(page, SLUM)).toHaveText('Campaign')
        await siteCard(page, SLUM).click()
        await expect(siteRow(page, CAPTAINS)).toHaveText(/^\s*Campaign at:\s*Great Slum\s*$/)
        await useIn(page, CAPTAINS).click()
        await expect
            .poll(() => call(page, 'cardTokens', CAPTAINS))
            .toEqual({ favor: 1, secrets: 0 })
    })

    test('Palanquin: nothing is lit before its player; then only the sites that player can travel to', async ({
        page
    }) => {
        await openPower(page, 'pickerPalanquin')
        await expect(siteRow(page, PALANQUIN)).toHaveCount(0)
        // Captains, at the Plains Dana rules, is listed too: only its sites are lit.
        expect(await litSlots(page)).toEqual([PLAINS, SLUM].sort())
        await expect(page.locator('.site .travel-cost').filter({ hasText: 'Carry' })).toHaveCount(0)
        await powerRow(page, PALANQUIN)
            .getByRole('button', { name: /^rhys$/i })
            .click()
        await expect(siteRow(page, PALANQUIN)).toHaveText(/^\s*Carry to:\s*tap a lit site\.\s*$/)
        // R-5.6: never the site they stand at; into the Hinterland only through the Narrow Pass.
        expect(await litSlots(page)).toEqual([PLAINS, SLUM, RIVER, MOUNTAIN, PASS].sort())
        await expect(chipOn(page, RIVER)).toHaveText('Carry')
        await expect(chipOn(page, PLAINS)).toHaveText('Carry · Campaign')
        await siteCard(page, RIVER).click()
        await expect(siteRow(page, PALANQUIN)).toHaveText(/^\s*Carry to:\s*River\s*$/)
        await useIn(page, PALANQUIN).click()
        await expect.poll(async () => (await call(page, 'tableFacts')).siteOf.rhys).toBe(RIVER)
        expect((await call(page, 'tableFacts')).siteOf.dana).toBe(RIVER)
    })

    for (const viewport of [
        { width: 375, height: 812 },
        { width: 402, height: 874 }
    ]) {
        test.describe(`on a ${viewport.width} px phone held upright`, () => {
            test.use({ viewport, hasTouch: true })

            test('the map opens framed on the pawn’s region with region chips counting the lit sites; a tap shows Use, 44 px', async ({
                page
            }) => {
                await openTable(page, 'pickerSites')
                await usePower(page).tap()
                await expect(regionChip(page, 'Cradle')).toHaveAccessibleName('Cradle: 2 lit sites')
                await expect(regionChip(page, 'Provinces')).toHaveAccessibleName(
                    'Provinces: 1 lit site'
                )
                await expect(regionChip(page, 'Hinterland')).toHaveCount(0)
                await expect(regionChip(page, 'Cradle')).toHaveAttribute('aria-pressed', 'true')
                await expect.poll(() => onScreen(page, siteCard(page, PLAINS))).toBe(true)
                for (const slotId of [CITY, PLAINS]) {
                    expect(
                        inside(
                            await boxOf(chipOn(page, slotId)),
                            await boxOf(siteCard(page, slotId))
                        )
                    ).toBe(true)
                }

                await siteCard(page, PLAINS).tap()
                await expect(useIn(page, CAPTAINS)).toBeVisible()
                await expect(useIn(page, SIEGE_ENGINES)).toBeVisible()
                const panel = await boxOf(grid(page))
                for (const cardId of [CAPTAINS, SIEGE_ENGINES]) {
                    const use = useIn(page, cardId)
                    expect((await layoutSizeOf(use))?.height).toBeGreaterThanOrEqual(44)
                    expect(inside(await boxOf(use), panel)).toBe(true)
                }
                expect(await clippedLabels(page)).toEqual([])

                await regionChip(page, 'Provinces').tap()
                await expect.poll(() => onScreen(page, siteCard(page, SLUM))).toBe(true)
                await siteCard(page, SLUM).tap()
                await expect(siteRow(page, CAPTAINS)).toHaveText(
                    /^\s*Campaign at:\s*Great Slum\s*$/
                )
                await expect(siteRow(page, SIEGE_ENGINES)).toHaveText(/tap a lit site\./)
            })
        })
    }
})

/** Scenario 32: every panel waits while a send is in flight or a new state is being shown. */
test.describe('scenario 32: waiting on a send', () => {
    test('while a Travel is in flight nothing is offered; refused or accepted, the send ends the draft', async ({
        page
    }) => {
        await openTable(page, 'actPhase')
        // On a desktop too the lit map is Travel's menu: a click on a site with one way to pay sends it.
        const destination = page.locator('.site[data-slot="slot.cradle.1"] .board-card.offered')

        await tile(page, 'Travel').click()
        await expect(destination).toHaveCount(1)
        await call(page, 'holdNextSend')
        await destination.click()
        await expect.poll(() => call(page, 'sendInFlight')).toBe(true)
        await expect(grid(page).locator('button').first()).toBeVisible()
        await expect(grid(page).locator('button:enabled')).toHaveCount(0)
        await expect(boardOffers(page)).toHaveCount(0)

        await call(page, 'releaseSend', false)
        const refused = await call(page, 'tableFacts')
        expect(refused.siteOf.me).toBe('slot.cradle.0')
        expect(refused.staged).toBeUndefined()
        await expect(tile(page, 'Travel')).toBeEnabled()
        await expect(boardOffers(page)).toHaveCount(0)
        await expect(dimmedSites(page)).toHaveCount(0)

        await tile(page, 'Travel').click()
        await call(page, 'holdNextSend')
        await destination.click()
        await expect.poll(() => call(page, 'sendInFlight')).toBe(true)
        await expect(grid(page).locator('button:enabled')).toHaveCount(0)
        await call(page, 'releaseSend', true)
        const accepted = await call(page, 'tableFacts')
        expect(accepted.siteOf.me).toBe('slot.cradle.1')
        expect(accepted.staged).toBeUndefined()
        await expect(tile(page, 'Travel')).toBeEnabled()
        await expect(boardOffers(page)).toHaveCount(0)
    })

    test('while a new state is being shown the panel reads empty and disabled; an update that shows no new state gives the picks back', async ({
        page
    }) => {
        await openTable(page, 'searching')
        await panelCards(page).first().click()
        await expect(page.getByText('How do you play it?', { exact: false })).toBeVisible()

        await call(page, 'setUpdatingVisibleState', true)
        await expect(page.getByText('Keep one.', { exact: true })).toBeVisible()
        await expect(page.getByText('How do you play it?', { exact: false })).toHaveCount(0)
        await expect(grid(page).locator('button:enabled')).toHaveCount(0)

        await call(page, 'setUpdatingVisibleState', false)
        await expect(page.getByText('How do you play it?', { exact: false })).toBeVisible()
        expect((await call(page, 'searchPicks')).kept).toBeDefined()
    })
})

type ColourProperty = 'color' | 'backgroundColor' | 'borderTopColor'

async function rgbOf(locator: ReturnType<Page['locator']>, property: ColourProperty) {
    return locator.evaluate((element, property) => {
        const canvas = document.createElement('canvas')
        canvas.width = 1
        canvas.height = 1
        const context = canvas.getContext('2d')
        if (!context) throw Error('A canvas has a 2d context')
        context.fillStyle = getComputedStyle(element)[property]
        context.fillRect(0, 0, 1, 1)
        const [red, green, blue] = context.getImageData(0, 0, 1, 1).data
        return { red, green, blue }
    }, property)
}

async function luminanceOf(locator: ReturnType<Page['locator']>, property: ColourProperty) {
    const { red, green, blue } = await rgbOf(locator, property)
    return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
}

/** Amber and its tints: red well above blue. Stone and the platform's greys are near neutral. */
async function isAmber(locator: ReturnType<Page['locator']>, property: ColourProperty) {
    const { red, blue } = await rgbOf(locator, property)
    return red - blue > 40
}

const STONE_800 = { red: 41, green: 37, blue: 36 }
const STONE_700 = { red: 68, green: 64, blue: 59 }
const AMBER_300 = { red: 255, green: 210, blue: 48 }

async function expectColour(
    locator: ReturnType<Page['locator']>,
    property: ColourProperty,
    expected: { red: number; green: number; blue: number }
) {
    const actual = await rgbOf(locator, property)
    for (const channel of ['red', 'green', 'blue'] as const) {
        expect(
            Math.abs(actual[channel] - expected[channel]),
            `${property} ${channel}`
        ).toBeLessThanOrEqual(2)
    }
}

/** The palette's primary: a stone-800 fill inside an amber-300 border, with amber-300 text. */
async function expectPrimary(locator: ReturnType<Page['locator']>) {
    await expectColour(locator, 'backgroundColor', STONE_800)
    await expectColour(locator, 'color', AMBER_300)
    await expectColour(locator, 'borderTopColor', AMBER_300)
    expect(
        await locator.evaluate((element) => parseFloat(getComputedStyle(element).borderTopWidth))
    ).toBeGreaterThan(0)
}

test('scenario 38: the side tabs, history controls, chat, panel and Undo wear Oath’s palette on the dark page', async ({
    page
}) => {
    await openTable(page, 'setup')
    expect(await luminanceOf(page.locator('body'), 'backgroundColor')).toBeLessThan(0.2)

    const players = page.getByRole('tab', { name: 'Players' })
    await expect(players).toHaveAttribute('aria-selected', 'true')
    expect(await luminanceOf(players, 'color')).toBeGreaterThan(0.85)
    expect(await isAmber(players, 'borderTopColor')).toBe(true)

    const history = page.getByRole('tab', { name: 'History' })
    await expect(history).toHaveAttribute('aria-selected', 'false')
    const muted = await luminanceOf(history, 'color')
    expect(muted).toBeGreaterThan(0.5)
    expect(muted).toBeLessThan(0.8)

    expect(
        await isAmber(page.getByRole('button', { name: 'fork game' }).locator('svg'), 'color')
    ).toBe(true)
    expect(await isAmber(page.locator('.panel'), 'borderTopColor')).toBe(true)
    expect(await isAmber(page.locator('.info'), 'borderTopColor')).toBe(true)

    await page.getByRole('tab', { name: 'Chat' }).click()
    expect(await luminanceOf(page.locator('textarea'), 'color')).toBeGreaterThan(0.85)

    await openTable(page, 'actPhase')
    await call(page, 'seatTravels', 'slot.cradle.1')
    const undo = page.getByRole('button', { name: 'Undo', exact: true })
    await expect(undo).toBeVisible()
    await expectPrimary(undo)
    await undo.hover()
    await expectColour(undo, 'backgroundColor', STONE_700)
    await expectColour(undo, 'color', AMBER_300)

    await openTable(page, 'warbandMoveAsked')
    await expectPrimary(answer(page, 'Allow'))
})

type TextToken = 'text' | 'text-muted' | 'heading' | 'accent' | 'danger'
const TEXT_TOKENS: TextToken[] = ['text', 'text-muted', 'heading', 'accent', 'danger']

/** The element's text in reading order, each run of one colour joined and named by the palette token it wears. */
async function tokenRuns(locator: ReturnType<Page['locator']>) {
    return locator.evaluate((element, tokens) => {
        const probe = document.createElement('span')
        element.append(probe)
        const tokenOf = new Map<string, string>()
        for (const token of tokens) {
            probe.style.color = `var(--oath-${token})`
            tokenOf.set(getComputedStyle(probe).color, token)
        }
        probe.remove()
        const runs: [string, string][] = []
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const text = node.textContent?.trim()
            if (!text || !node.parentElement) continue
            const colour = getComputedStyle(node.parentElement).color
            const token = tokenOf.get(colour) ?? colour
            const last = runs.at(-1)
            if (last && last[1] === token) last[0] = `${last[0]} ${text}`
            else runs.push([text, token])
        }
        return runs
    }, TEXT_TOKENS)
}

/** docs/ui-interaction-visual-contract.md, Palette: a cost is `accent`; a gain stays `text`, a note and "→" `text-muted`. */
test.describe('palette: every cost in the action panel is accent', () => {
    test('the cost line under each action in the grid; the line under it is the summary alone', async ({
        page
    }) => {
        await openTable(page, 'trade')
        for (const [label, cost] of [
            ['Search', '2–4 Supply'],
            ['Muster', '1 Supply'],
            ['Trade', '1 Supply'],
            ['Recover', '1 Supply'],
            ['Campaign', '2 Supply'],
            ['Travel', '1–4 Supply']
        ]) {
            expect(await tokenRuns(tile(page, label))).toEqual([
                [label, 'text'],
                [cost, 'accent']
            ])
        }
        // The line under a hovered tile is its summary alone, muted: the tile already shows the cost.
        await tile(page, 'Travel').hover()
        expect(await tokenRuns(reasonLine(page))).toEqual([
            [expect.stringMatching(/\S/), 'text-muted']
        ])
    })

    test('Search: the Supply is accent, the draw a muted note', async ({ page }) => {
        await openTable(page, 'trade')
        await tile(page, 'Search').click()
        const deck = grid(page).getByRole('button', {
            name: /^Search the world deck: spend 2 Supply, draw 3$/
        })
        expect(await tokenRuns(deck)).toEqual([
            ['2 Supply', 'accent'],
            ['draw 3', 'text-muted']
        ])
    })

    test('Search with a toll: the Supply, the "+", the favor given and "to" are all accent, then the payee chip', async ({
        page
    }) => {
        await openTable(page, 'searchToll')
        await tile(page, 'Search').click()
        const deck = grid(page).getByRole('button', {
            name: /^Search the world deck: spend 2 Supply, give 1 favor to ann, draw 3$/
        })
        await expect(deck.locator('img')).toHaveCount(1)
        // The payee is their name chip, drawn in the chip's own colours.
        expect(await tokenRuns(deck)).toEqual([
            ['2 Supply + 1 to', 'accent'],
            ['ann', 'rgb(255, 255, 255)'],
            ['draw 3', 'text-muted']
        ])
    })

    test('Trade: what is paid is accent, the arrow muted, the gain text, and an empty bank’s 0 muted', async ({
        page
    }) => {
        await openTable(page, 'trade')
        await tile(page, 'Trade').click()
        const forFavor = grid(page).getByRole('button', {
            name: 'Trade with Book Binders: pay 1 secret, get 3 favor from the Hearth bank'
        })
        expect(await tokenRuns(forFavor)).toEqual([
            ['1', 'accent'],
            ['→', 'text-muted'],
            ['3', 'text']
        ])
        const forSecrets = grid(page).getByRole('button', {
            name: 'Trade with Book Binders: pay 2 favor, get 2 secrets'
        })
        expect(await tokenRuns(forSecrets)).toEqual([
            ['2', 'accent'],
            ['→', 'text-muted'],
            ['2', 'text']
        ])
        const bankEmpty = grid(page).getByRole('button', {
            name: /^Trade with Assassin: pay 1 secret, get 0 favor/
        })
        expect(await tokenRuns(bankEmpty)).toEqual([
            ['1', 'accent'],
            ['→ 0', 'text-muted']
        ])
    })

    test('Muster: the favor placed is accent, the arrow muted, the warbands text', async ({
        page
    }) => {
        await openTable(page, 'trade')
        await tile(page, 'Muster').click()
        const muster = grid(page).getByRole('button', {
            name: /^Muster at Book Binders: place 1 favor, get \d warbands?$/
        })
        expect(await tokenRuns(muster)).toEqual([
            ['1', 'accent'],
            ['→', 'text-muted'],
            [expect.stringMatching(/^\d$/), 'text']
        ])
    })

    test('Recover: a banner’s least bid and its "+" are accent', async ({ page }) => {
        await openTable(page, 'trade')
        await tile(page, 'Recover').click()
        const peoples = grid(page)
            .getByRole('list', { name: 'Banners to recover' })
            .getByRole('button', { name: /^Recover the People’s Favor: pay \d+ favor or more$/ })
        expect(await tokenRuns(peoples)).toEqual([[expect.stringMatching(/^\d+\+$/), 'accent']])
    })

    test('Recover: a relic’s whole price is accent, its joiners with it', async ({ page }) => {
        await openTable(page, 'relics')
        await tile(page, 'Recover').click()
        const relic = grid(page)
            .getByRole('list', { name: 'Relics to recover' })
            .getByRole('button', { name: /: place 3 favor in the Order bank$/ })
        expect(await tokenRuns(relic)).toEqual([['3 to', 'accent']])
    })

    test('Campaign: the cost beside the heading is accent', async ({ page }) => {
        await openTable(page, 'campaign')
        await tile(page, 'Campaign').click()
        expect(await tokenRuns(grid(page).locator('h3').filter({ hasText: 'Campaign' }))).toEqual([
            ['Campaign', 'heading'],
            ['2 Supply', 'accent']
        ])
    })

    test('Use a power: what the card costs is accent', async ({ page }) => {
        await openTable(page, 'cardOpensSearch')
        await usePower(page).click()
        const line = actionCard(page, 'denizen.beast.mushrooms').locator('p')
        expect(await tokenRuns(line)).toEqual([
            ['0 Supply · draw 1 from the bottom', 'text'],
            ['·', 'text-muted'],
            ['put 1 on it', 'accent']
        ])
    })
})

test('scenario 40: panel text shows favor as its token, the word only as the token’s name; the bar names the action', async ({
    page
}) => {
    await openTable(page, 'trade')
    await tile(page, 'Muster').hover()
    await expect(reasonLine(page)).toHaveText('Put on a card here; get 2 warbands.')
    await expect(reasonLine(page).getByRole('img', { name: 'favor' })).toBeVisible()
    await expect(reasonLine(page)).not.toContainText('favor')
    await restMouse(page)

    await tile(page, 'Muster').click()
    await expect(grid(page).getByText('Muster', { exact: true })).toBeVisible()
    await expect(grid(page)).not.toContainText('Choose')
})

test('scenario 39: Trade lists every trade at the site, a strip tap only enlarges, a button sends', async ({
    page
}) => {
    await openTable(page, 'trade')
    await tile(page, 'Trade').click()
    const rows = page.getByRole('list', { name: 'Trades at your site' }).getByRole('listitem')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toContainText('Book Binders')
    await expect(rows.nth(1)).toContainText('Assassin')
    await expect(page.getByRole('list', { name: 'Trades at your site' })).not.toContainText(
        'Council Seat'
    )
    await expect(
        page.getByRole('button', {
            name: 'Trade with Book Binders: pay 1 secret, get 3 favor from the Hearth bank'
        })
    ).toBeVisible()
    await expect(
        page.getByRole('button', { name: 'Trade with Book Binders: pay 2 favor, get 2 secrets' })
    ).toBeVisible()
    await expect(
        page.getByRole('button', {
            name: 'Trade with Assassin: pay 1 secret, get 0 favor from the Discord bank'
        })
    ).toBeVisible()
    await expect(
        page.getByRole('button', { name: 'Trade with Assassin: pay 2 favor, get 0 secrets' })
    ).toBeVisible()
    await expect(rows.nth(1)).not.toContainText('bank')
    await expect(rows.nth(1)).not.toContainText('faceup')
    const name = await rows.nth(0).getByText('Book Binders', { exact: true }).boundingBox()
    const firstButton = await rows.nth(0).getByRole('button').first().boundingBox()
    if (!name || !firstButton) throw Error('The row is on screen')
    expect(firstButton.x - name.x).toBeLessThan(260)

    await (await uncovered(page, '.board-card.offered')).click()
    await expect(preview(page)).toBeVisible()
    expect(await call(page, 'cardTokens', 'denizen.discord.assassin')).toEqual({
        favor: 0,
        secrets: 0
    })
    await page.keyboard.press('Escape')
    await expect(preview(page)).toHaveCount(0)

    await page
        .getByRole('button', {
            name: 'Trade with Book Binders: pay 1 secret, get 3 favor from the Hearth bank'
        })
        .click()
    await expect
        .poll(() => call(page, 'cardTokens', 'denizen.hearth.book-binders'))
        .toEqual({ favor: 0, secrets: 1 })
    await expect(page.getByRole('list', { name: 'Trades at your site' })).toHaveCount(0)
})

test('scenario 39: a trade that gains nothing shows its 0 and no note under it, and is sent like any other', async ({
    page
}) => {
    await openTable(page, 'trade')
    await tile(page, 'Trade').click()
    const forNothing = page.getByRole('button', {
        name: 'Trade with Assassin: pay 2 favor, get 0 secrets'
    })
    await expect(forNothing).toHaveText(/^\s*2\s*→\s*0\s*$/)
    await expect(
        page.getByRole('button', {
            name: 'Trade with Assassin: pay 1 secret, get 0 favor from the Discord bank'
        })
    ).toHaveText(/^\s*1\s*→\s*0\s*$/)
    await forNothing.click()
    await expect
        .poll(() => call(page, 'cardTokens', 'denizen.discord.assassin'))
        .toEqual({ favor: 2, secrets: 0 })
})

test('scenario 39: under Careless a Trade for secrets shows the favor it also gives, its 0 secrets explicit', async ({
    page
}) => {
    await openTable(page, 'careless')
    const before = (await call(page, 'tableFacts')).favorOf.me ?? 0
    await tile(page, 'Trade').click()
    const assassin = page.getByRole('button', {
        name: 'Trade with Assassin: pay 2 favor, get 0 secrets and 1 favor'
    })
    await expect(assassin).toHaveText(/^\s*2\s*→\s*0\s*\+\s*1\s*$/)
    await expect(assassin.locator('img')).toHaveCount(3)
    await expect(
        page.getByRole('button', {
            name: 'Trade with Book Binders: pay 2 favor, get 1 secret and 1 favor'
        })
    ).toHaveText(/^\s*2\s*→\s*1\s*\+\s*1\s*$/)
    await expect(
        page.getByRole('button', {
            name: 'Trade with Book Binders: pay 1 secret, get 3 favor from the Hearth bank'
        })
    ).toHaveText(/^\s*1\s*→\s*3\s*$/)
    await assassin.click()
    await expect.poll(async () => (await call(page, 'tableFacts')).favorOf.me).toBe(before - 2 + 1)
})

test('scenario 4: on a desktop at 1280 the panel reads "Tap a lit site."; Undo puts Travel down, and a click on a lit site travels', async ({
    page
}) => {
    expect(page.viewportSize()?.width).toBe(1280)
    await openTable(page, 'actPhase')
    await tile(page, 'Travel').click()
    await expect(travelPrompt(page)).toBeVisible()
    await expect(grid(page).getByRole('button', { name: /^Travel to / })).toHaveCount(0)
    await expect(dimmedSites(page).first()).toBeVisible()
    await expect(stepBacks(page)).toHaveCount(0)

    await undoButton(page).click()
    await expect(travelPrompt(page)).toHaveCount(0)
    await expect(boardOffers(page)).toHaveCount(0)
    await expect(dimmedSites(page)).toHaveCount(0)
    await expect(undoButton(page)).toHaveCount(0)
    await tile(page, 'Travel').click()
    await siteCard(page, 'slot.cradle.1').click()
    await expect.poll(async () => (await call(page, 'tableFacts')).siteOf.me).toBe('slot.cradle.1')
    await expect(boardOffers(page)).toHaveCount(0)
    await expect(travelPrompt(page)).toHaveCount(0)
})

const destinations = (page: Page, region: string) =>
    page.getByRole('list', { name: `Destinations in the ${region}` })

type Box = { x: number; y: number; width: number; height: number }

const boxesOf = (locator: Locator): Promise<Box[]> =>
    locator.evaluateAll((elements) =>
        elements.map((element) => {
            const box = element.getBoundingClientRect()
            return { x: box.x, y: box.y, width: box.width, height: box.height }
        })
    )

async function boxOf(locator: Locator): Promise<Box> {
    const [box] = await boxesOf(locator)
    if (!box) throw Error('Nothing to measure')
    return box
}

const inside = (inner: Box, outer: Box) =>
    inner.x >= outer.x - 0.5 &&
    inner.y >= outer.y - 0.5 &&
    inner.x + inner.width <= outer.x + outer.width + 0.5 &&
    inner.y + inner.height <= outer.y + outer.height + 0.5

const siteAt = (page: Page, slotId: string) => page.locator(`.site[data-slot="${slotId}"]`)
const siteCard = (page: Page, slotId: string) => siteAt(page, slotId).locator('.board-card')
const siteMagnifier = (page: Page, slotId: string) =>
    siteAt(page, slotId).getByRole('button', { name: /^Enlarge / })
const boardView = (page: Page) => page.locator('.scaling-surface')
const regionChips = (page: Page) => page.getByRole('group', { name: 'Frame the map on a region' })
const regionChip = (page: Page, region: string) =>
    regionChips(page).getByRole('button', { name: new RegExp(`^${region}:`) })
const travelPrompt = (page: Page) => grid(page).getByText('Tap a lit site.', { exact: true })

const litSlots = (page: Page) =>
    page
        .locator('.site')
        .filter({ has: page.locator('.board-card.offered') })
        .evaluateAll((sites) => sites.map((site) => site.getAttribute('data-slot') ?? '').sort())

async function onScreen(page: Page, locator: Locator): Promise<boolean> {
    return inside(await boxOf(locator), await boxOf(boardView(page)))
}

async function chooseTravelOnThePhone(page: Page) {
    await tile(page, 'Travel').last().tap()
    await expect(travelPrompt(page)).toBeVisible()
}

/** Choose a Travel destination: on a phone the lit map is the menu. */
test.describe('scenario 4 on a phone held upright', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true })

    test('the panel is one line and only the legal destinations are lit, each with its cost wholly on its card', async ({
        page
    }) => {
        await openTable(page, 'actPhase')
        await chooseTravelOnThePhone(page)
        await expect(destinations(page, 'Cradle')).toHaveCount(0)
        await expect(stepBacks(page)).toHaveCount(0)

        const legal = await call(page, 'legalTravelDestinations')
        expect(legal.length).toBeGreaterThan(1)
        expect(await litSlots(page)).toEqual([...legal].sort())
        for (const slotId of legal) {
            const chip = await boxOf(siteAt(page, slotId).locator('.travel-cost'))
            expect(inside(chip, await boxOf(siteCard(page, slotId)))).toBe(true)
        }
    })

    test('Travel opens framed on the pawn’s region; a region chip reframes the map and chooses nothing', async ({
        page
    }) => {
        await openTable(page, 'actPhase')
        await chooseTravelOnThePhone(page)
        const legal = await call(page, 'legalTravelDestinations')
        const count = (region: string) =>
            legal.filter((slotId) => slotId.startsWith(`slot.${region.toLowerCase()}.`)).length
        for (const region of ['Cradle', 'Provinces', 'Hinterland']) {
            await expect(regionChip(page, region)).toHaveAccessibleName(
                `${region}: ${count(region)} to travel to`
            )
        }
        await expect(regionChip(page, 'Cradle')).toHaveAttribute('aria-pressed', 'true')
        await expect.poll(() => onScreen(page, siteCard(page, 'slot.cradle.1'))).toBe(true)
        expect(await onScreen(page, siteCard(page, 'slot.provinces.1'))).toBe(false)
        const chipRow = await boxOf(regionChips(page))
        const card = await boxOf(siteCard(page, 'slot.cradle.1'))
        expect(chipRow.y + chipRow.height).toBeLessThan(card.y)

        await regionChip(page, 'Provinces').tap()
        await expect(regionChip(page, 'Provinces')).toHaveAttribute('aria-pressed', 'true')
        await expect(regionChip(page, 'Cradle')).toHaveAttribute('aria-pressed', 'false')
        await expect.poll(() => onScreen(page, siteCard(page, 'slot.provinces.1'))).toBe(true)
        const facts = await call(page, 'tableFacts')
        expect(facts.siteOf.me).toBe('slot.cradle.0')
        expect(facts.staged).toBe('travel')
        await expect(travelPrompt(page)).toBeVisible()
    })

    test('when Travel closes, by Back or by travelling, the map returns to the view it had before Travel opened', async ({
        page
    }) => {
        await openTable(page, 'actPhase')
        await expect(tile(page, 'Travel').last()).toBeVisible()
        // The view as the part of the board it shows: its centre in card widths from a site
        // card, and that card's size. The panel's height after a Travel may differ by a line,
        // which changes the board's box but not the part of the board it shows.
        const card = siteCard(page, 'slot.provinces.1')
        const viewNow = async () => {
            const [seen, view] = [await boxOf(card), await boxOf(boardView(page))]
            return {
                x: (view.x + view.width / 2 - seen.x) / seen.width,
                y: (view.y + view.height / 2 - seen.y) / seen.width,
                width: seen.width
            }
        }
        // The table's first fit has settled when two reads a moment apart agree.
        let before = await viewNow()
        await expect
            .poll(async () => {
                const last = before
                await page.waitForTimeout(200)
                before = await viewNow()
                return before.x === last.x && before.y === last.y && before.width === last.width
            })
            .toBe(true)
        const unmoved = async () => {
            const now = await viewNow()
            return (
                Math.abs(now.x - before.x) < 0.02 &&
                Math.abs(now.y - before.y) < 0.02 &&
                Math.abs(now.width / before.width - 1) < 0.03
            )
        }

        await chooseTravelOnThePhone(page)
        await expect.poll(unmoved).toBe(false)
        await undoButton(page).tap()
        await expect(travelPrompt(page)).toHaveCount(0)
        await expect.poll(unmoved).toBe(true)

        await chooseTravelOnThePhone(page)
        await expect.poll(unmoved).toBe(false)
        await expect.poll(() => onScreen(page, siteCard(page, 'slot.cradle.1'))).toBe(true)
        await siteCard(page, 'slot.cradle.1').tap()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).siteOf.me)
            .toBe('slot.cradle.1')
        await expect.poll(unmoved).toBe(true)
    })

    test('a tap on a lit site with one way to pay travels there', async ({ page }) => {
        await openTable(page, 'actPhase')
        await chooseTravelOnThePhone(page)
        await expect.poll(() => onScreen(page, siteCard(page, 'slot.cradle.1'))).toBe(true)
        await siteCard(page, 'slot.cradle.1').tap()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).siteOf.me)
            .toBe('slot.cradle.1')
        await expect(boardOffers(page)).toHaveCount(0)
    })

    test('a lit site’s corner magnifier, 28 px on screen, opens its card and travels nowhere', async ({
        page
    }) => {
        await openTable(page, 'actPhase')
        await chooseTravelOnThePhone(page)
        await expect.poll(() => onScreen(page, siteCard(page, 'slot.cradle.1'))).toBe(true)
        const magnifier = siteMagnifier(page, 'slot.cradle.1')
        const face = await boxOf(magnifier.locator('.site-magnifier__face'))
        expect(face.width).toBeCloseTo(28, 0)
        expect(face.height).toBeCloseTo(28, 0)
        const card = await boxOf(siteCard(page, 'slot.cradle.1'))
        expect(face.x).toBeLessThan(card.x)
        expect(face.y).toBeGreaterThan(card.y)
        expect(face.y).toBeLessThan(card.y + 6)

        await magnifier.tap()
        await expect(preview(page)).toBeVisible()
        expect((await call(page, 'tableFacts')).siteOf.me).toBe('slot.cradle.0')
        await page.touchscreen.tap(20, 20)
        await expect(preview(page)).toHaveCount(0)
        expect((await call(page, 'tableFacts')).siteOf.me).toBe('slot.cradle.0')
        await expect(travelPrompt(page)).toBeVisible()
    })

    test('a tap on a site with two ways to pay opens the ways above the map and travels nowhere; a way’s button travels', async ({
        page
    }) => {
        await openTable(page, 'leavingBuriedGiant')
        await chooseTravelOnThePhone(page)
        const legal = await call(page, 'legalTravelDestinations')
        const chip = siteAt(page, 'slot.cradle.1').locator('.travel-cost')
        await expect(chip).toHaveText('1 or 0+')
        await expect(chip.getByRole('img', { name: 'secret' })).toBeVisible()
        const hinterlandChip = siteAt(page, 'slot.hinterland.0').locator('.travel-cost')
        await expect(hinterlandChip).toHaveText('0+')
        await expect(hinterlandChip.getByRole('img', { name: 'secret' })).toBeVisible()
        await expect.poll(() => onScreen(page, siteCard(page, 'slot.cradle.1'))).toBe(true)
        await siteCard(page, 'slot.cradle.1').tap()

        const supply = grid(page).getByRole('button', { name: /^Travel to .+: spend 1 Supply$/ })
        const flip = grid(page).getByRole('button', {
            name: /^Travel to .+: spend no Supply, flip a secret facedown$/
        })
        await expect(supply).toHaveText('1 Supply')
        await expect(flip).toBeVisible()
        expect((await call(page, 'tableFacts')).siteOf.me).toBe('slot.cradle.0')
        expect(await litSlots(page)).toEqual([...legal].sort())

        // Upright: the site's name alone (no region line) above its picture, the picture as
        // large as fits, the two ways stacked to its right at one width, their right edge the panel's.
        const ways = grid(page).locator('.ways')
        await expect(ways.getByText('Cradle', { exact: true })).toHaveCount(0)
        const name = await boxOf(ways.locator('.ways__name'))
        const picture = await boxOf(ways.locator('.ways__art'))
        const row = await boxOf(ways)
        const [one, other] = [await boxOf(supply), await boxOf(flip)]
        expect(name.y + name.height).toBeLessThanOrEqual(picture.y + 0.5)
        expect(picture.width / picture.height).toBeCloseTo(1313 / 1016, 1)
        expect(one.x).toBeGreaterThan(picture.x + picture.width - 1)
        expect(one.y).toBeCloseTo(picture.y, 0)
        expect(other.x).toBeCloseTo(one.x, 0)
        expect(other.y).toBeGreaterThan(one.y + one.height - 1)
        expect(other.width).toBeCloseTo(one.width, 0)
        expect(one.x + one.width).toBeCloseTo(row.x + row.width, 0)
        expect(picture.width).toBeGreaterThan(2 * one.width)

        await undoButton(page).tap()
        await expect(supply).toHaveCount(0)
        await expect(travelPrompt(page)).toBeVisible()
        expect(await litSlots(page)).toEqual([...legal].sort())

        await siteCard(page, 'slot.cradle.1').tap()
        await flip.tap()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).siteOf.me)
            .toBe('slot.cradle.1')
    })
})

test.describe('scenario 4 on a phone held sideways', () => {
    test.use({ viewport: { width: 812, height: 375 }, hasTouch: true })

    test('every lit site is framed and no region chip shows; two ways open beside the site on one row', async ({
        page
    }) => {
        await openTable(page, 'leavingBuriedGiant')
        await chooseTravelOnThePhone(page)
        await expect(regionChips(page)).toHaveCount(0)
        const legal = await call(page, 'legalTravelDestinations')
        for (const slotId of legal) {
            await expect.poll(() => onScreen(page, siteCard(page, slotId))).toBe(true)
        }

        await siteCard(page, 'slot.provinces.1').tap()
        const ways = grid(page).getByRole('button', { name: /^Travel to / })
        await expect(ways).toHaveCount(2)
        const [one, other] = await boxesOf(ways)
        expect(other.y).toBeCloseTo(one.y, 0)
        const picture = await boxOf(grid(page).locator('img').first())
        expect(picture.x + picture.width).toBeLessThan(one.x)
        expect(Math.abs(picture.y + picture.height / 2 - (one.y + one.height / 2))).toBeLessThan(
            picture.height / 2
        )
    })
})

/** R-7.1.4 — a toll's way names its payee by their chip; the card is named in the History. */
test.describe('scenario 4 with a toll', () => {
    const tolled = 'slot.provinces.0'
    const tollWay = (page: Page) =>
        grid(page).getByRole('button', { name: /give 1 favor to ann \(Toll Roads\)$/ })

    test('on a desktop a click on the toll site opens its way, which reads its favor and the payee chip, and no note names the card', async ({
        page
    }) => {
        await openTable(page, 'travelToll')
        await tile(page, 'Travel').click()
        await expect(travelPrompt(page)).toBeVisible()
        const chip = siteAt(page, tolled).locator('.travel-cost')
        await expect(chip).toHaveText(/^\s*\d\+$/)
        await expect(chip.getByRole('img', { name: 'favor' })).toBeVisible()
        await expect(tollWay(page)).toHaveCount(0)

        await siteCard(page, tolled).click()
        await expect(tollWay(page)).toHaveCount(1)
        await expect(tollWay(page)).toContainText(/\d Supply\s*\+ 1\s*to\s*ann/)
        expect((await call(page, 'tableFacts')).siteOf.me).toBe('slot.cradle.0')
        await expect(grid(page)).not.toContainText('Toll Roads')

        await tollWay(page).click()
        await expect.poll(async () => (await call(page, 'tableFacts')).siteOf.me).toBe(tolled)
        await page.getByRole('tab', { name: 'History' }).click()
        const row = page.getByRole('tabpanel', { name: 'History' }).getByRole('listitem').first()
        await expect(row).toContainText(
            /traveled to .+, spending \d Supply; paid ann 1\s*\(Toll Roads\)/
        )
        await expect(row.getByRole('img', { name: 'favor' })).toBeVisible()
    })

    test.describe('on a phone held upright', () => {
        test.use({ viewport: { width: 375, height: 812 }, hasTouch: true })

        test('the chip is its number and the favor, the token no taller than the number; a tap opens the way with the payee chip', async ({
            page
        }) => {
            await openTable(page, 'travelToll')
            await chooseTravelOnThePhone(page)
            await regionChip(page, 'Provinces').tap()
            const chip = siteAt(page, tolled).locator('.travel-cost')
            await expect(chip).toHaveText(/^\s*\d\+$/)
            const token = chip.getByRole('img', { name: 'favor' })
            await expect(token).toBeVisible()
            const fontSize = await chip.evaluate((element) =>
                parseFloat(getComputedStyle(element).fontSize)
            )
            expect((await boxOf(token)).height).toBeLessThanOrEqual(fontSize * 0.8)

            await expect.poll(() => onScreen(page, siteCard(page, tolled))).toBe(true)
            await siteCard(page, tolled).tap()
            await expect(tollWay(page)).toContainText(/\d Supply\s*\+ 1\s*to\s*ann/)
            expect((await call(page, 'tableFacts')).siteOf.me).toBe('slot.cradle.0')
            await expect(grid(page)).not.toContainText('Toll Roads')

            await tollWay(page).tap()
            await expect.poll(async () => (await call(page, 'tableFacts')).siteOf.me).toBe(tolled)
        })
    })
})

/** On a desktop too the lit map is Travel's menu, and the board keeps the whole map in view, as Setup's does. */
test('scenario 4: on a desktop the panel shows no region tiles and the map is not framed', async ({
    page
}) => {
    await openTable(page, 'actPhase')
    await tile(page, 'Travel').click()
    await expect(travelPrompt(page)).toBeVisible()
    for (const region of ['Cradle', 'Provinces', 'Hinterland']) {
        await expect(destinations(page, region)).toHaveCount(0)
    }
    await expect(grid(page).getByRole('list', { name: /^Destinations in the / })).toHaveCount(0)
    await expect(grid(page).locator('img')).toHaveCount(0)
    await expect(regionChips(page)).toHaveCount(0)
    const legal = await call(page, 'legalTravelDestinations')
    for (const slotId of legal) {
        expect(await onScreen(page, siteCard(page, slotId))).toBe(true)
    }
})

test('scenario 4: on a desktop every legal destination is lit with its Supply in a gold chip and a magnifier; the rest of the map dims', async ({
    page
}) => {
    await openTable(page, 'actPhase')
    await tile(page, 'Travel').click()
    await expect(travelPrompt(page)).toBeVisible()
    const legal = await call(page, 'legalTravelDestinations')
    expect(legal.length).toBeGreaterThan(1)
    expect(await litSlots(page)).toEqual([...legal].sort())
    for (const slotId of legal) {
        const chip = siteAt(page, slotId).locator('.travel-cost')
        await expect(chip).toHaveText(/^\d Supply$/)
        // Rule G: the cost is gold, amber-400 behind dark text.
        await expect(chip).toHaveCSS('background-color', 'rgb(251, 191, 36)')
        await expect(siteMagnifier(page, slotId)).toHaveCount(1)
    }
    await expect(siteAt(page, 'slot.cradle.1').locator('.travel-cost')).toHaveText('1 Supply')
    await expect(dimmedSites(page)).toHaveCount(
        (await page.locator('.site').count()) - legal.length
    )
})

test('scenario 4: on a desktop a click on a site with two ways to pay opens its ways in the panel and travels nowhere; Undo closes them, a way travels', async ({
    page
}) => {
    await openTable(page, 'leavingBuriedGiant')
    await tile(page, 'Travel').click()
    await expect(travelPrompt(page)).toBeVisible()
    const legal = await call(page, 'legalTravelDestinations')
    // The map's chip reads both ways.
    const chip = siteAt(page, 'slot.provinces.0').locator('.travel-cost')
    await expect(chip).toHaveText('2 or 0+')
    await expect(chip.getByRole('img', { name: 'secret' })).toBeVisible()
    await expect(siteAt(page, 'slot.hinterland.0').locator('.travel-cost')).toHaveText('0+')

    await siteCard(page, 'slot.provinces.0').click()
    const supply = grid(page).getByRole('button', { name: /^Travel to .+: spend 2 Supply$/ })
    const flip = grid(page).getByRole('button', {
        name: /^Travel to .+: spend no Supply, flip a secret facedown$/
    })
    await expect(supply).toHaveText('2 Supply')
    await expect(flip).toBeVisible()
    await expect(travelPrompt(page)).toHaveCount(0)
    expect((await call(page, 'tableFacts')).siteOf.me).toBe('slot.cradle.0')
    expect(await litSlots(page)).toEqual([...legal].sort())
    await expect(siteCard(page, 'slot.provinces.0')).toHaveClass(/picked/)

    // As on a phone held sideways: the site's picture, its name and the ways on one row.
    const ways = grid(page).locator('.ways')
    const picture = await boxOf(ways.locator('.ways__art'))
    const [one, other] = [await boxOf(supply), await boxOf(flip)]
    expect(other.y).toBeCloseTo(one.y, 0)
    expect(other.width).toBeCloseTo(one.width, 0)
    expect(picture.x + picture.width).toBeLessThan(one.x)

    await undoButton(page).click()
    await expect(supply).toHaveCount(0)
    await expect(travelPrompt(page)).toBeVisible()
    expect(await litSlots(page)).toEqual([...legal].sort())

    await siteCard(page, 'slot.provinces.0').click()
    await flip.click()
    await expect
        .poll(async () => (await call(page, 'tableFacts')).siteOf.me)
        .toBe('slot.provinces.0')
})

test('scenario 49: Search lists each source it can draw from, a button draws', async ({ page }) => {
    await openTable(page, 'actPhase')
    await tile(page, 'Search').click()
    const rows = page.getByRole('list', { name: 'Sources to search' }).getByRole('listitem')
    await expect(rows.first()).toContainText('The world deck')
    const deck = page.getByRole('button', {
        name: /^Search the world deck: spend \d Supply, draw 3$/
    })
    await expect(deck).toBeVisible()
    await expect(boardOffers(page).or(page.locator('.deck.pickable'))).not.toHaveCount(0)
    await deck.click()
    await expect.poll(async () => (await call(page, 'tableFacts')).machineState).toBe('Searching')
})

test('scenario 20: Recover lists the banners to outbid, the price is a row of the favor held, from the least bid', async ({
    page
}) => {
    await openTable(page, 'trade')
    const before = (await call(page, 'tableFacts')).favorOf.me ?? 0
    await tile(page, 'Recover').click()
    const banners = page.getByRole('list', { name: 'Banners to recover' })
    const peoples = banners.getByRole('button', {
        name: /^Recover the People’s Favor: pay \d+ favor/
    })
    await expect(peoples).toBeVisible()
    await peoples.click()
    const amounts = grid(page).getByRole('button', { name: /^pay \d+ favor$/ })
    const held = await amounts.count()
    await expect(amounts.first()).toHaveAttribute('aria-pressed', 'true')
    await expect(amounts.first()).toHaveClass(/ring-oath-accent/)
    // The least bid is picked; the favor under it cannot be tapped, and a tap on it keeps it.
    const tappable = await amounts.evaluateAll(
        (pieces) => pieces.filter((piece) => !piece.hasAttribute('disabled')).length
    )
    const least = held - tappable + 1
    for (let n = 1; n <= held; n++) {
        await expect(amounts.nth(n - 1)).toHaveAttribute(
            'aria-pressed',
            n <= least ? 'true' : 'false'
        )
        if (n < least) await expect(amounts.nth(n - 1)).toBeDisabled()
    }
    await amounts.nth(least - 1).click()
    await expect(amounts.nth(least - 1)).toHaveAttribute('aria-pressed', 'true')
    const paid = least < held ? least + 1 : least
    const choice = amounts.nth(paid - 1)
    await choice.click()
    await expect(choice).toHaveAttribute('aria-pressed', 'true')
    await expect(choice).toHaveAccessibleName(`pay ${paid} favor`)
    await grid(page)
        .getByRole('button', { name: /^(Arcane|Order|Hearth|Discord|Beast|Nomad) bank/ })
        .first()
        .click()
    await grid(page)
        .getByRole('button', { name: 'Recover the People’s Favor', exact: true })
        .click()
    await expect.poll(async () => (await call(page, 'tableFacts')).favorOf.me).toBe(before - paid)
})

test('scenario 20: Recover heads the relics "Relics" and gives a banner’s least bid as "N+"', async ({
    page
}) => {
    await openTable(page, 'recover')
    await tile(page, 'Recover').click()
    await expect(grid(page).getByRole('heading', { name: 'Relics', exact: true })).toBeVisible()
    await expect(
        page.getByRole('list', { name: 'Relics to recover' }).getByRole('listitem')
    ).toHaveCount(1)
    const banners = page.getByRole('list', { name: 'Banners to recover' })
    const peoples = banners.getByRole('button', {
        name: /^Recover the People’s Favor: pay \d+ favor or more$/
    })
    await expect(peoples).toHaveText(/^\s*\d+\+\s*$/)
    await expect(banners).not.toContainText('or more')
})

test('scenario 20: a picked banner’s line asks its price; "Recover" shows once the picks are complete, with no red line before', async ({
    page
}) => {
    await openTable(page, 'recover')
    await tile(page, 'Recover').click()
    await page.getByRole('button', { name: /^Recover the People’s Favor: pay/ }).click()
    const line = grid(page).getByText(/^People’s Favor: pay how many\s*\?$/)
    await expect(line).toBeVisible()
    await expect(line.getByRole('img', { name: 'favor' })).toBeVisible()
    const recover = grid(page).getByRole('button', {
        name: 'Recover the People’s Favor',
        exact: true
    })
    await expect(recover).toHaveCount(0)
    await expect(grid(page).locator('.text-oath-danger')).toHaveCount(0)
    await expect(grid(page).getByText('Return its', { exact: false })).toHaveText(
        /^Return its\s*, starting at:$/
    )

    await grid(page)
        .getByRole('button', { name: /^(Arcane|Order|Hearth|Discord|Beast|Nomad) bank/ })
        .first()
        .click()
    await expect(recover).toHaveText('Recover')
    await expect(grid(page).locator('.text-oath-danger')).toHaveCount(0)

    await openTable(page, 'recover')
    await tile(page, 'Recover').click()
    await page.getByRole('button', { name: /^Recover the Darkest Secret: pay/ }).click()
    await expect(grid(page).getByText(/^Darkest Secret: pay how many\s*\?$/)).toBeVisible()
    await expect(
        grid(page).getByRole('button', { name: 'Recover the Darkest Secret', exact: true })
    ).toHaveText('Recover')
})

type Edges = {
    left: number
    top: number
    right: number
    bottom: number
    width: number
    height: number
}

/**
 * Each row of a menu list as drawn, in layout pixels from the row's corner (a tall panel is
 * scaled to fit, so the scale is divided out): its picture, the picture's magnifier, the name's
 * text and its lines, its buttons, and how much of the row its content takes.
 */
async function pictureRows(list: Locator) {
    await expect(list.getByRole('listitem').first()).toBeVisible()
    await list
        .locator('img')
        .evaluateAll((images: HTMLImageElement[]) =>
            Promise.all(images.map((image) => image.decode().catch(() => undefined)))
        )
    return list.getByRole('listitem').evaluateAll((rows: HTMLElement[]) =>
        rows.map((row) => {
            const frame = row.getBoundingClientRect()
            const scale = frame.width / row.offsetWidth
            const local = (rect: DOMRect): Edges => ({
                left: (rect.left - frame.left) / scale,
                top: (rect.top - frame.top) / scale,
                right: (rect.right - frame.left) / scale,
                bottom: (rect.bottom - frame.top) / scale,
                width: rect.width / scale,
                height: rect.height / scale
            })
            const lineCount = (rects: DOMRect[]) =>
                new Set(rects.map((rect) => Math.round(rect.top))).size

            const picture = row.querySelector('img')
            if (!picture) throw Error('A menu row has no picture')
            const magnifier = row.querySelector('button.magnifier')

            // The name is the row's text outside its buttons.
            const texts: Text[] = []
            const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT)
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                if (
                    node instanceof Text &&
                    node.data.trim() &&
                    !node.parentElement?.closest('button')
                ) {
                    texts.push(node)
                }
            }
            const first = texts[0]
            const last = texts[texts.length - 1]
            if (!first || !last) throw Error('A menu row has no name')
            const nameRange = document.createRange()
            nameRange.setStart(first, 0)
            nameRange.setEnd(last, last.length)
            const nameRects = [...nameRange.getClientRects()].filter((rect) => rect.width > 0)
            const nameParts = nameRects.map(local)
            const nameLeft = Math.min(...nameParts.map((part) => part.left))
            const nameTop = Math.min(...nameParts.map((part) => part.top))
            const nameRight = Math.max(...nameParts.map((part) => part.right))
            const nameBottom = Math.max(...nameParts.map((part) => part.bottom))
            const name: Edges = {
                left: nameLeft,
                top: nameTop,
                right: nameRight,
                bottom: nameBottom,
                width: nameRight - nameLeft,
                height: nameBottom - nameTop
            }

            // A facedown relic's "space N", which is not to be split over two lines.
            let spaceLines = 0
            const space = texts.find((text) => /space \d+/.test(text.data))
            const words = space?.data.match(/space \d+/)
            if (space && words?.index !== undefined) {
                const range = document.createRange()
                range.setStart(space, words.index)
                range.setEnd(space, words.index + words[0].length)
                spaceLines = lineCount([...range.getClientRects()].filter((rect) => rect.width > 0))
            }

            const buttons = [...row.querySelectorAll('button:not(.magnifier)')].map((button) => ({
                ...local(button.getBoundingClientRect()),
                label: button.getAttribute('aria-label') ?? '',
                inside: button.scrollWidth <= button.clientWidth + 1
            }))
            const parts = [local(picture.getBoundingClientRect()), name, ...buttons]
            if (magnifier) parts.push(local(magnifier.getBoundingClientRect()))
            return {
                label: nameRange.toString().replace(/\s+/g, ' ').trim(),
                picture: {
                    ...local(picture.getBoundingClientRect()),
                    fit: getComputedStyle(picture).objectFit,
                    natural: picture.naturalWidth / picture.naturalHeight
                },
                magnifier: magnifier
                    ? {
                          ...local(magnifier.getBoundingClientRect()),
                          label: magnifier.getAttribute('aria-label')
                      }
                    : null,
                name,
                nameLines: lineCount(nameRects),
                spaceLines,
                buttons,
                width: row.offsetWidth,
                contentRight: Math.max(...parts.map((part) => part.right)),
                listWidth: row.parentElement?.offsetWidth ?? 0,
                paddingRight: parseFloat(getComputedStyle(row).paddingRight)
            }
        })
    )
}

type PictureRow = Awaited<ReturnType<typeof pictureRows>>[number]

/**
 * A menu row: its picture on the left; the name and every button to its right, clear of the
 * magnifier's 6 px; on a desktop the name and the buttons on one line, on a phone the name over
 * them; every label inside its button; the row as wide as its content.
 */
function expectPictureRow(row: PictureRow, phone: boolean) {
    const clear = row.picture.right + 6
    expect(row.name.left, `${row.label}: the name is right of the picture`).toBeGreaterThanOrEqual(
        clear - 0.5
    )
    expect(row.buttons.length).toBeGreaterThan(0)
    for (const button of row.buttons) {
        expect(button.left, `${button.label}: right of the picture`).toBeGreaterThanOrEqual(
            clear - 0.5
        )
        expect(button.inside, `${button.label}: the label is inside its button`).toBe(true)
        if (phone) {
            expect(button.top, `${button.label}: under the name`).toBeGreaterThanOrEqual(
                row.name.bottom - 0.5
            )
        } else {
            expect(button.left, `${button.label}: beside the name`).toBeGreaterThan(row.name.right)
            expect(button.top, `${button.label}: on the name’s line`).toBeLessThan(row.name.bottom)
        }
    }
    if (phone) {
        expect(
            Math.abs(row.buttons[0].left - row.name.left),
            `${row.label}: the button starts under the name`
        ).toBeLessThanOrEqual(1)
    }
    // A name that wraps, or buttons that go one per line, fill the row's line, so that row reaches
    // the list's edge and no further.
    const buttonLines = new Set(row.buttons.map((button) => Math.round(button.top))).size
    if (row.nameLines > 1 || buttonLines > 1) expect(row.width).toBeLessThanOrEqual(row.listWidth)
    else {
        expect(row.width, `${row.label}: the row is as wide as its content`).toBeLessThanOrEqual(
            row.contentRight + row.paddingRight + 1.5
        )
    }
}

const PICTURE_VIEWPORTS = [
    { width: 1280, height: 900 },
    { width: 402, height: 874 },
    { width: 375, height: 812 },
    { width: 320, height: 1200 }
]

for (const viewport of PICTURE_VIEWPORTS) {
    const phone = viewport.width < 640
    const narrow = viewport.width < 360
    test(`Recover at ${viewport.width} wide: each relic and banner its own row, its whole picture left and its price to the right`, async ({
        page
    }) => {
        await page.setViewportSize(viewport)
        await openTable(page, 'recoverSeen')
        await tile(page, 'Recover').click()

        const relics = await pictureRows(page.getByRole('list', { name: 'Relics to recover' }))
        expect(relics.map((row) => row.label)).toEqual(['Facedown relic, space 1', 'Map'])
        for (const row of relics) {
            expectPictureRow(row, phone)
            // A relic is its card, as tall as a banner's tile: 56 x 56, whole.
            expect(row.picture.width, `${row.label}: 56 wide`).toBeCloseTo(56, 0)
            expect(row.picture.height, `${row.label}: 56 tall`).toBeCloseTo(56, 0)
            expect(row.picture.natural).toBeCloseTo(1, 1)
            expect(row.buttons[0].top, `${row.label}: the price beside the picture`).toBeLessThan(
                row.picture.bottom
            )
        }
        // A back has nothing to enlarge; the relic this player has seen is its face, with its magnifier.
        expect(relics[0].magnifier).toBeNull()
        expect(relics[1].magnifier?.label).toBe('Enlarge Map')
        expect(relics[0].spaceLines, '"space 1" stays on one line').toBe(1)

        const banners = await pictureRows(page.getByRole('list', { name: 'Banners to recover' }))
        expect(banners.map((row) => row.label)).toEqual(['People’s Favor', 'Darkest Secret'])
        for (const row of banners) {
            expectPictureRow(row, phone)
            // A banner is its whole tile, 2:1: 112 x 56, and 88 x 44 below a 360 px screen.
            expect(row.picture.width, `${row.label}: the tile’s width`).toBeCloseTo(
                narrow ? 88 : 112,
                0
            )
            expect(row.picture.height, `${row.label}: the tile’s height`).toBeCloseTo(
                narrow ? 44 : 56,
                0
            )
            expect(row.picture.natural).toBeCloseTo(2, 1)
            expect(row.picture.fit, `${row.label}: never cropped`).not.toBe('cover')
            expect(row.magnifier?.label).toBe(`Enlarge the ${row.label}`)
            expect(row.buttons[0].top, `${row.label}: the price beside the tile`).toBeLessThan(
                row.picture.bottom
            )
        }
        expect(await clippedLabels(page)).toEqual([])
    })
}

/** The rows of every menu built on the same row, with the table and the tile or chip that opens it. */
const MENU_ROWS = [
    { table: 'trade', open: 'Muster', minor: false, list: 'Musters at your site' },
    { table: 'trade', open: 'Trade', minor: false, list: 'Trades at your site' },
    { table: 'searchToll', open: 'Search', minor: false, list: 'Sources to search' },
    { table: 'moves', open: 'Move warbands', minor: true, list: 'Warband moves' },
    { table: 'peek', open: 'Peek', minor: true, list: 'Relics to peek at' }
] as const

for (const viewport of [PICTURE_VIEWPORTS[0], PICTURE_VIEWPORTS[1]]) {
    const phone = viewport.width < 640
    for (const menu of MENU_ROWS) {
        test(`${menu.open} at ${viewport.width} wide: a row as wide as its content, the picture left, the name and buttons to its right`, async ({
            page
        }) => {
            await page.setViewportSize(viewport)
            await openTable(page, menu.table)
            if (menu.minor)
                await grid(page).getByRole('button', { name: menu.open, exact: true }).click()
            else await tile(page, menu.open).click()
            const rows = await pictureRows(page.getByRole('list', { name: menu.list }))
            for (const row of rows) expectPictureRow(row, phone)
            if (menu.open === 'Peek') {
                // A back: 56 x 56, no magnifier, "space 1" together.
                expect(rows[0].picture.width).toBeCloseTo(56, 0)
                expect(rows[0].picture.height).toBeCloseTo(56, 0)
                expect(rows[0].magnifier).toBeNull()
                expect(rows[0].spaceLines).toBe(1)
            }
            if (menu.open === 'Move warbands' && phone) {
                // A row of number buttons is 44 px square on a phone.
                for (const row of rows) {
                    for (const button of row.buttons) {
                        expect(button.width, `${button.label}: 44 wide`).toBeCloseTo(44, 0)
                        expect(button.height, `${button.label}: 44 tall`).toBeCloseTo(44, 0)
                    }
                }
            }
            expect(await clippedLabels(page)).toEqual([])
        })
    }
}

for (const viewport of [PICTURE_VIEWPORTS[0], PICTURE_VIEWPORTS[1], PICTURE_VIEWPORTS[3]]) {
    const phone = viewport.width < 640
    const narrow = viewport.width < 360
    test(`Recover at ${viewport.width} wide: the picked banner’s price beside its tile, ringed${phone ? ', its count buttons and "Recover" 44 px' : ''}`, async ({
        page
    }) => {
        await page.setViewportSize(viewport)
        await openTable(page, 'recover')
        await tile(page, 'Recover').click()
        await page.getByRole('button', { name: /^Recover the People’s Favor: pay/ }).click()

        const magnifier = grid(page).getByRole('button', {
            name: 'Enlarge the People’s Favor',
            exact: true
        })
        await expect(magnifier).toBeVisible()
        const tileImage = magnifier.locator('xpath=..').locator('img')
        await tileImage.evaluate((image: HTMLImageElement) => image.decode().catch(() => undefined))
        const drawn = await tileImage.evaluate((image: HTMLImageElement) => {
            const probe = document.createElement('span')
            probe.style.color = 'var(--oath-accent)'
            document.body.append(probe)
            const accent = getComputedStyle(probe).color
            probe.remove()
            return {
                width: image.offsetWidth,
                height: image.offsetHeight,
                natural: image.naturalWidth / image.naturalHeight,
                ringed: getComputedStyle(image).boxShadow.includes(accent),
                pressable: image.closest('button') !== null
            }
        })
        expect(drawn.width).toBe(narrow ? 88 : 112)
        expect(drawn.height).toBe(narrow ? 44 : 56)
        expect(drawn.natural).toBeCloseTo(2, 1)
        expect(drawn.ringed, 'the tile wears the gold pick ring').toBe(true)
        expect(drawn.pressable, 'the tile is not a button').toBe(false)

        const tileBox = await boxOf(tileImage)
        const line = grid(page).getByText(/^People’s Favor: pay how many\s*\?$/)
        const lineBox = await boxOf(line)
        expect(lineBox.x, 'the line is right of the tile').toBeGreaterThan(
            tileBox.x + tileBox.width
        )
        expect(lineBox.y, 'the line is beside the tile').toBeLessThan(tileBox.y + tileBox.height)
        const amounts = grid(page).getByRole('button', { name: /^pay \d+ favor$/ })
        for (const amount of await amounts.all()) {
            expect((await boxOf(amount)).x, 'a count button is right of the tile').toBeGreaterThan(
                tileBox.x + tileBox.width
            )
            if (phone) {
                const size = await amount.evaluate((button) =>
                    button instanceof HTMLElement ? [button.offsetWidth, button.offsetHeight] : []
                )
                expect(size, 'a count button is 44 px square on a phone').toEqual([44, 44])
            }
        }

        await grid(page)
            .getByRole('button', { name: /^(Arcane|Order|Hearth|Discord|Beast|Nomad) bank/ })
            .first()
            .click()
        const recover = grid(page).getByRole('button', {
            name: 'Recover the People’s Favor',
            exact: true
        })
        await expect(recover).toHaveText('Recover')
        if (phone) {
            const height = await recover.evaluate((button) =>
                button instanceof HTMLElement ? button.offsetHeight : 0
            )
            expect(height, '"Recover" is 44 px tall on a phone').toBeGreaterThanOrEqual(44)
        }
        // Every label inside its button (a bank's count sits on its corner by design).
        for (const button of [...(await amounts.all()), recover]) {
            const fits = await button.evaluate(
                (element) => element.scrollWidth <= element.clientWidth + 1
            )
            expect(
                fits,
                `${await button.getAttribute('aria-label')}: the label is inside its button`
            ).toBe(true)
        }
    })
}

test('scenario 50: Peek lists only the relics not yet seen, Look sends', async ({ page }) => {
    await openTable(page, 'peek')
    const peek = grid(page).getByRole('button', { name: 'Peek', exact: true })
    await peek.click()
    const rows = page.getByRole('list', { name: 'Relics to peek at' }).getByRole('listitem')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('space 1')
    await rows.first().getByRole('button', { name: 'Peek at facedown relic, space 1' }).click()
    await expect(page.getByRole('list', { name: 'Relics to peek at' })).toHaveCount(0)
    await expect(tile(page, 'Search')).toBeVisible()
    await expect(peek).toHaveCount(0)
})

test('scenario 15: a peek shows its actor the notice, "Only you see this." over the cards seen', async ({
    page
}) => {
    await openTable(page, 'tavernSongs')
    await grid(page).getByRole('button', { name: 'Use a power', exact: true }).click()
    await grid(page).getByRole('button', { name: 'Use', exact: true }).click()
    const notice = grid(page).getByText('Only you see this.', { exact: true })
    await expect(notice).toBeVisible()
    expect(await notice.evaluate((line) => line.previousElementSibling === null)).toBe(true)
    await expect(notice.locator('xpath=..').getByRole('img')).toHaveCount(2)
    await expect(grid(page)).not.toContainText('showed you')
    await expect(grid(page)).not.toContainText('You were shown')

    expect(await call(page, 'viewOffTheClock')).toBe('ann')
    await expect(notice).toHaveCount(0)
})

/** R-10.8 — an exchange's terms head each side by its giver, "You give" for the seat's own. */
test('an exchange editor heads the seat’s side "You give" and the other "<chip> gives"; a site given says who moves in', async ({
    page
}) => {
    await openTable(page, 'deedWriter')
    await grid(page).getByRole('button', { name: 'Use a power', exact: true }).click()
    await expect(grid(page).getByText('You give', { exact: true })).toBeVisible()
    await expect(grid(page).getByText(/^ann\s*gives$/)).toHaveCount(1)
    await expect(grid(page)).not.toContainText('me gives')

    await grid(page).getByRole('button', { name: 'c1', exact: true }).click()
    await expect(grid(page).getByText(/^ann\s*moves in$/)).toBeVisible()
    await grid(page).getByRole('button', { name: 'p1', exact: true }).click()
    await expect(grid(page).getByText('You move in', { exact: true })).toBeVisible()
    await expect(
        grid(page).getByRole('button', { name: 'ann gives 1 favor', exact: true })
    ).toBeVisible()
})

/**
 * R-10.8 — the exchange editor (Deed Writer, Tinker's Fair, The Gathering): the player by chip,
 * picks starting empty; only the rows the engine accepts are listed; counts as rows of pieces;
 * "Use" and "Propose" only once the terms are complete, one red line when complete terms are
 * refused.
 */
test.describe('the exchange editor', () => {
    const DEED_WRITER = 'denizen.hearth.deed-writer'
    const row = (page: Page, cardId: string) =>
        grid(page).locator(`[data-action-power="${cardId}"]`)
    const red = (page: Page) => grid(page).locator('.text-oath-danger')
    const chip = (page: Page, cardId: string, name: string) =>
        row(page, cardId).getByRole('button', { name, exact: true })
    const site = (page: Page, name: string) => grid(page).getByRole('button', { name, exact: true })
    const pieces = (page: Page, who: string) =>
        grid(page).getByRole('button', {
            name: new RegExp(`^${who} moves \\d in from their board$`)
        })

    async function openPower(page: Page, table: TableFixture.TableName) {
        await openTable(page, table)
        await grid(page).getByRole('button', { name: 'Use a power', exact: true }).click()
    }

    test('Deed Writer: "With:" chips, none picked; no "Use" and no red line before the terms', async ({
        page
    }) => {
        await openPower(page, 'exchangeDeed')
        await expect(row(page, DEED_WRITER).locator('select')).toHaveCount(0)
        await expect(row(page, DEED_WRITER).getByText('With:', { exact: true })).toBeVisible()
        await expect(chip(page, DEED_WRITER, 'rhys')).toHaveAttribute('aria-pressed', 'false')
        await expect(chip(page, DEED_WRITER, 'ann')).toHaveAttribute('aria-pressed', 'false')
        await expect(grid(page).getByText('You give', { exact: true })).toHaveCount(0)
        await expect(answer(page, 'Use')).toHaveCount(0)

        await chip(page, DEED_WRITER, 'rhys').click()
        await expect(chip(page, DEED_WRITER, 'rhys')).toHaveAttribute('aria-pressed', 'true')
        await expect(grid(page).getByText('You give', { exact: true })).toBeVisible()
        await expect(answer(page, 'Use')).toHaveCount(0)
        await expect(red(page)).toHaveCount(0)
    })

    test('Deed Writer to a Bandit Crown holder: a site is a row with its picture; its count starts empty, runs from 0, and the exchange moves no warbands in', async ({
        page
    }) => {
        await openPower(page, 'exchangeDeed')
        await chip(page, DEED_WRITER, 'rhys').click()
        const plains = site(page, 'Plains')
        await expect(plains).toHaveAttribute('aria-pressed', 'false')
        await expect(plains.locator('img')).toHaveCount(1)
        await expect(site(page, 'Great Slum')).toBeVisible()
        await expect(site(page, 'Mountain')).toBeVisible()

        await plains.click()
        await expect(plains).toHaveAttribute('aria-pressed', 'true')
        await expect(grid(page).getByText(/^rhys\s*moves in$/)).toBeVisible()
        await expect(pieces(page, 'rhys')).toHaveCount(2)
        await expect(
            grid(page).getByRole('button', {
                name: /^rhys moves \d in from their board$/,
                pressed: true
            })
        ).toHaveCount(0)
        await expect(answer(page, 'Use')).toHaveCount(0)

        const one = grid(page).getByRole('button', {
            name: 'rhys moves 1 in from their board',
            exact: true
        })
        await one.click()
        await expect(one).toHaveAttribute('aria-pressed', 'true')
        await expect(answer(page, 'Use')).toBeVisible()
        await one.click()
        await expect(one).toHaveAttribute('aria-pressed', 'false')
        await expect(answer(page, 'Use')).toBeVisible()
        await expect(red(page)).toHaveCount(0)

        const home = (await call(page, 'tableFacts')).siteOf.dana
        if (!home) throw Error('Dana stands at a site')
        await answer(page, 'Use').click()
        await expect.poll(async () => (await call(page, 'tableFacts')).seatId).toBe('rhys')
        await answer(page, 'Accept').click()
        await expect.poll(async () => (await call(page, 'openQuestionKind')) ?? 'none').toBe('none')
        const facts = await call(page, 'tableFacts')
        expect(Object.values(facts.warbandsAt[home] ?? {}).reduce((sum, n) => sum + n, 0)).toBe(0)
        expect(facts.boardOf.dana).toEqual({ imperial: 8 })
        expect(facts.boardOf.rhys).toEqual({ rhys: 2 })
    })

    test('Deed Writer refuses no row it lists: no site between the Chancellor and a Citizen; none to an empty board without the Crown', async ({
        page
    }) => {
        await openPower(page, 'exchangeDeed')
        await chip(page, DEED_WRITER, 'ann').click()
        await expect(grid(page).getByText(/^ann\s*gives$/)).toBeVisible()
        for (const name of ['Plains', 'Great Slum', 'Mountain'])
            await expect(site(page, name)).toHaveCount(0)
        await expect(
            grid(page).getByRole('button', { name: 'ann gives 1 favor', exact: true })
        ).toBeVisible()

        await openPower(page, 'exchangeDeedEmptyBoard')
        await chip(page, DEED_WRITER, 'rhys').click()
        await expect(site(page, 'Plains')).toHaveCount(0)
        await expect(site(page, 'Great Slum')).toHaveCount(0)
        await expect(site(page, 'Mountain')).toBeVisible()
        await site(page, 'Mountain').click()
        await expect(grid(page).getByText('You move in', { exact: true })).toBeVisible()
        await expect(pieces(page, 'dana')).toHaveCount(6)
    })

    for (const viewport of [
        { width: 1280, height: 900 },
        { width: 375, height: 812 }
    ]) {
        test(`Deed Writer: an empty board takes a site once its own site is handed over, counted to the warbands that come home (${viewport.width} px)`, async ({
            page
        }) => {
            await page.setViewportSize(viewport)
            await openPower(page, 'exchangeDeedSwap')
            await chip(page, DEED_WRITER, 'rhys').click()
            const rhysOne = grid(page).getByRole('button', {
                name: 'rhys moves 1 in from their board',
                exact: true
            })

            // Plains waits for a site from Rhys: listed, and picked first with no count until then.
            await expect(site(page, 'Great Slum')).toBeVisible()
            await site(page, 'Plains').click()
            await expect(site(page, 'Plains')).toHaveAttribute('aria-pressed', 'true')
            await expect(pieces(page, 'rhys')).toHaveCount(0)
            await expect(answer(page, 'Use')).toHaveCount(0)
            await expect(red(page)).toHaveCount(0)

            // The Mountain's one warband comes home to Rhys first, so he can move it into Plains.
            await site(page, 'Mountain').click()
            await grid(page)
                .getByRole('button', { name: 'dana moves 1 in from their board', exact: true })
                .click()
            await expect(pieces(page, 'rhys')).toHaveCount(1)
            await expect(rhysOne).toHaveAttribute('aria-pressed', 'false')
            await expect(answer(page, 'Use')).toHaveCount(0)
            await rhysOne.click()
            await expect(rhysOne).toHaveAttribute('aria-pressed', 'true')
            await expect(red(page)).toHaveCount(0)
            await expect(answer(page, 'Use')).toBeVisible()

            // A second tap on the Mountain takes it out: Plains stays picked, its count cleared, and waits again.
            await site(page, 'Mountain').click()
            await expect(site(page, 'Plains')).toHaveAttribute('aria-pressed', 'true')
            await expect(pieces(page, 'rhys')).toHaveCount(0)
            await expect(answer(page, 'Use')).toHaveCount(0)
            await expect(red(page)).toHaveCount(0)
            await site(page, 'Mountain').click()
            await grid(page)
                .getByRole('button', { name: 'dana moves 1 in from their board', exact: true })
                .click()
            await expect(rhysOne).toHaveAttribute('aria-pressed', 'false')
            await expect(answer(page, 'Use')).toHaveCount(0)
            await rhysOne.click()
            await expect(rhysOne).toHaveAttribute('aria-pressed', 'true')

            const home = (await call(page, 'tableFacts')).siteOf.dana
            if (!home) throw Error('Dana stands at a site')
            await answer(page, 'Use').click()
            await expect.poll(async () => (await call(page, 'tableFacts')).seatId).toBe('rhys')
            await answer(page, 'Accept').click()
            await expect
                .poll(async () => (await call(page, 'openQuestionKind')) ?? 'none')
                .toBe('none')
            const facts = await call(page, 'tableFacts')
            expect(facts.warbandsAt[home]?.rhys).toBe(1)
            expect(facts.warbandsAt[home]?.imperial ?? 0).toBe(0)
            expect(facts.boardOf.dana).toEqual({ imperial: 7 })
            expect(facts.boardOf.rhys?.rhys ?? 0).toBe(0)
        })
    }

    test('two sites share one board: the second site’s count stops at the warbands the first leaves; the Crown’s 0 alone is picked at once', async ({
        page
    }) => {
        await openPower(page, 'exchangeDeed')
        await chip(page, DEED_WRITER, 'rhys').click()
        await site(page, 'Plains').click()
        await grid(page)
            .getByRole('button', { name: 'rhys moves 2 in from their board', exact: true })
            .click()
        await site(page, 'Great Slum').click()
        const slums = pieces(page, 'rhys')
        await expect(slums).toHaveCount(4)
        await expect(slums.nth(2)).toBeDisabled()
        await expect(slums.nth(3)).toBeDisabled()
        await expect(slums.nth(2)).toHaveAttribute('aria-pressed', 'false')
        await expect(slums.nth(3)).toHaveAttribute('aria-pressed', 'false')
        await expect(answer(page, 'Use')).toBeVisible()
        await expect(red(page)).toHaveCount(0)
    })

    test('Tinker’s Fair: Vow of Silence keeps its holder’s secret in the row, not tappable; every relic is listed', async ({
        page
    }) => {
        await openPower(page, 'exchangeTinkers')
        await chip(page, 'denizen.hearth.tinkers-fair', 'rhys').click()
        await expect(
            grid(page).getByRole('button', { name: 'rhys gives 1 secret', exact: true })
        ).toBeDisabled()
        await expect(
            grid(page).getByRole('button', { name: 'rhys gives 1 favor', exact: true })
        ).toBeEnabled()
        await expect(
            grid(page).getByRole('button', { name: 'dana gives 2 secrets', exact: true })
        ).toBeEnabled()
        for (const name of ['The Grand Scepter', 'Cup of Plenty', 'Bandit Crown']) {
            await expect(
                panelCards(page).filter({ has: page.getByRole('img', { name, exact: true }) })
            ).toHaveCount(1)
        }
    })

    test('The Gathering: a faceup locked adviser is not listed; too many advisers for the room is the one red line, and "Propose" hides', async ({
        page
    }) => {
        await openTable(page, 'exchangeGathering')
        await grid(page).getByRole('button', { name: 'rhys', exact: true }).click()
        await expect(
            panelCards(page).filter({
                has: page.getByRole('img', { name: 'Vow of Peace', exact: true })
            })
        ).toHaveCount(0)
        const tents = panelCards(page).filter({
            has: page.getByRole('img', { name: 'Tents', exact: true })
        })
        await expect(tents).toHaveCount(1)
        const facedown = panelCards(page).filter({
            has: page.getByRole('img', { name: 'the facedown adviser in row 3', exact: true })
        })
        await expect(facedown).toHaveCount(1)
        await expect(answer(page, 'Propose')).toHaveCount(0)

        await tents.click()
        await expect(answer(page, 'Propose')).toBeVisible()
        await facedown.click()
        await expect(answer(page, 'Propose')).toHaveCount(0)
        await expect(red(page)).toHaveCount(1)
        await expect(red(page)).toContainText('cannot hold 2 more advisers')
        await facedown.click()
        await expect(red(page)).toHaveCount(0)
        await expect(answer(page, 'Propose')).toBeVisible()
    })

    test.describe('on a 375 px phone', () => {
        test.use({ viewport: { width: 375, height: 812 } })

        test('the sides stack; site rows share one width; site rows and pieces are 44 px; every label inside its button', async ({
            page
        }) => {
            await openPower(page, 'exchangeDeed')
            await chip(page, DEED_WRITER, 'rhys').click()
            await site(page, 'Plains').click()
            await panelImagesLoaded(page)
            const give = await boxOf(grid(page).getByText('You give', { exact: true }))
            const gets = await boxOf(grid(page).getByText(/^rhys\s*gives$/))
            expect(gets.y).toBeGreaterThan(give.y + 44)
            expect(Math.abs(give.x - gets.x)).toBeLessThan(1)
            const plains = await layoutSizeOf(site(page, 'Plains'))
            expect(plains?.height).toBeGreaterThanOrEqual(44)
            expect((await layoutSizeOf(site(page, 'Great Slum')))?.width).toBe(plains?.width)
            for (const name of [
                'rhys moves 1 in from their board',
                'dana gives 1 favor',
                'rhys gives 1 secret'
            ]) {
                expect(await layoutSizeOf(answer(page, name))).toEqual({ width: 44, height: 44 })
            }
            expect(await clippedLabels(page)).toEqual([])
            expect(await wrappedLabels(page)).toEqual([])
        })
    })
})

/**
 * Messenger: one move at a time, From, How many and To as tiles and warband pieces, each read on
 * the state the moves before leave; a whole move folds to its line and the next From opens; "Use"
 * once a move is whole and none half-built; Undo takes back one pick, then the move.
 */
test.describe('Messenger’s moves', () => {
    const row = (page: Page) => grid(page).locator('[data-action-power="denizen.order.messenger"]')
    const tile = (page: Page, name: string) => row(page).getByRole('button', { name, exact: true })
    const pieces = (page: Page) => row(page).getByRole('button', { name: /^How many: \d+$/ })
    const piece = (page: Page, n: number) =>
        row(page).getByRole('button', { name: `How many: ${n}`, exact: true })
    const use = (page: Page) =>
        row(page).getByRole('button', { name: 'Use, paying 1 favor', exact: true })
    const moves = (page: Page) => row(page).locator('[data-move]')

    async function openMessenger(page: Page, table: TableFixture.TableName = 'messenger') {
        await openTable(page, table)
        await grid(page).getByRole('button', { name: 'Use a power', exact: true }).click()
    }

    /** Each tile's width, and the widest its content needs (the content, its padding and its border). */
    async function tileWidths(page: Page, names: string[]) {
        return Promise.all(
            names.map((name) =>
                tile(page, name).evaluate((button) => {
                    const content = button.firstElementChild
                    if (!(button instanceof HTMLElement) || !(content instanceof HTMLElement)) {
                        throw Error('a tile is a button holding its content')
                    }
                    const style = getComputedStyle(button)
                    const around = [
                        'paddingLeft',
                        'paddingRight',
                        'borderLeftWidth',
                        'borderRightWidth'
                    ] as const
                    return {
                        width: button.offsetWidth,
                        needs:
                            content.offsetWidth +
                            around.reduce((sum, side) => sum + parseFloat(style[side]), 0)
                    }
                })
            )
        )
    }

    test('move 1 from a site, move 2 from the board it filled; the next From opens under the two lines', async ({
        page
    }) => {
        await openMessenger(page)
        await expect(row(page).locator('select')).toHaveCount(0)
        await expect(row(page).getByText('From:', { exact: true })).toBeVisible()
        await expect(tile(page, 'Ancient City, 3 free')).toBeVisible()
        await expect(tile(page, 'Steppe, 1 free')).toBeVisible()
        await expect(row(page).getByRole('button', { name: /^Marshes/ })).toHaveCount(0)
        await expect(row(page).getByRole('button', { name: /^Your board/ })).toHaveCount(0)
        await expect(pieces(page)).toHaveCount(0)
        await expect(use(page)).toHaveCount(0)

        await tile(page, 'Ancient City, 3 free').click()
        await expect(tile(page, 'Ancient City, 3 free')).toHaveAttribute('aria-pressed', 'true')
        await expect(pieces(page)).toHaveCount(3)
        await expect(row(page).getByText('To:', { exact: true })).toHaveCount(0)
        await piece(page, 2).click()
        await expect(piece(page, 2)).toHaveAttribute('aria-pressed', 'true')
        await expect(piece(page, 1)).toHaveAttribute('aria-pressed', 'true')
        await expect(piece(page, 3)).toHaveAttribute('aria-pressed', 'false')
        for (const name of ['Your board', 'Steppe', 'Marshes'])
            await expect(tile(page, name)).toBeVisible()
        await expect(tile(page, 'Ancient City')).toHaveCount(0)
        await expect(use(page)).toHaveCount(0)

        await tile(page, 'Your board').click()
        await expect(moves(page)).toHaveCount(1)
        await expect(moves(page).first()).toHaveText(/^\s*2\s*Ancient City → your board$/)
        await expect(moves(page).first().getByRole('img', { name: 'warbands' })).toBeVisible()
        for (const name of ['Your board, 2 free', 'Ancient City, 1 free', 'Steppe, 1 free']) {
            await expect(tile(page, name)).toHaveAttribute('aria-pressed', 'false')
        }
        await expect(use(page)).toBeVisible()
        await expect(grid(page).locator('.text-oath-danger')).toHaveCount(0)

        await tile(page, 'Your board, 2 free').click()
        await expect(use(page)).toHaveCount(0)
        await piece(page, 2).click()
        for (const name of ['Ancient City', 'Steppe', 'Marshes'])
            await expect(tile(page, name)).toBeVisible()
        await expect(tile(page, 'Your board')).toHaveCount(0)
        await tile(page, 'Marshes').click()
        await expect(moves(page)).toHaveCount(2)
        await expect(moves(page).nth(1)).toHaveText(/^\s*2\s*your board → Marshes$/)
        for (const name of ['Ancient City, 1 free', 'Steppe, 1 free', 'Marshes, 2 free'])
            await expect(tile(page, name)).toBeVisible()
        await expect(row(page).getByRole('button', { name: /^Your board/ })).toHaveCount(0)

        await use(page).click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).warbandsAt['slot.provinces.1'])
            .toEqual({ imperial: 3 })
        const facts = await call(page, 'tableFacts')
        expect(facts.warbandsAt['slot.cradle.0']).toEqual({ imperial: 2 })
        expect(facts.boardOf.dana.imperial ?? 0).toBe(0)
        await page.getByRole('tab', { name: 'History' }).click()
        const history = page
            .getByRole('tabpanel', { name: 'History' })
            .getByRole('listitem')
            .first()
        await expect(history).toContainText(
            /used Messenger, placing 1\s*on it: 2\s*Ancient City → board; 2\s*board → Marshes/
        )
        await expect(history.getByRole('img', { name: 'Imperial warbands' })).toHaveCount(2)
    })

    test('a tap on the count picked clears it; a tap on the From picked clears the move', async ({
        page
    }) => {
        await openMessenger(page)
        await tile(page, 'Ancient City, 3 free').click()
        await piece(page, 2).click()
        await piece(page, 2).click()
        await expect(row(page).locator('button[aria-pressed="true"]')).toHaveCount(1)
        await expect(row(page).getByText('To:', { exact: true })).toHaveCount(0)
        await tile(page, 'Ancient City, 3 free').click()
        await expect(pieces(page)).toHaveCount(0)
    })

    test('Undo takes back To, then How many, then From, then the move before', async ({ page }) => {
        await openMessenger(page)
        await tile(page, 'Ancient City, 3 free').click()
        await piece(page, 2).click()
        await tile(page, 'Your board').click()
        await tile(page, 'Your board, 2 free').click()
        await piece(page, 1).click()

        await undoButton(page).click()
        await expect(piece(page, 1)).toHaveAttribute('aria-pressed', 'false')
        await expect(tile(page, 'Your board, 2 free')).toHaveAttribute('aria-pressed', 'true')
        await undoButton(page).click()
        await expect(pieces(page)).toHaveCount(0)
        await expect(moves(page)).toHaveCount(1)
        await undoButton(page).click()
        await expect(moves(page)).toHaveCount(0)
        await expect(tile(page, 'Your board')).toHaveAttribute('aria-pressed', 'false')
        await expect(piece(page, 2)).toHaveAttribute('aria-pressed', 'true')
        await undoButton(page).click()
        await expect(pieces(page).first()).toHaveAttribute('aria-pressed', 'false')
        await undoButton(page).click()
        await expect(pieces(page)).toHaveCount(0)
        await expect(tile(page, 'Ancient City, 3 free')).toHaveAttribute('aria-pressed', 'false')
        expect((await call(page, 'tableFacts')).staged).toBe('useActionPower')
    })

    test('two owners at one place (a game from before revision 5): one tile each, its pieces in that owner’s colour', async ({
        page
    }) => {
        await openMessenger(page, 'messengerTwoOwners')
        await expect(tile(page, 'Your board, 2 free')).toBeVisible()
        await expect(tile(page, 'Your board, 1 free')).toBeVisible()
        await expect(tile(page, 'Steppe, 2 free')).toHaveCount(2)
        const colours = await row(page)
            .getByRole('button', { name: /^Steppe, 2 free$/ })
            .evaluateAll((tiles) =>
                tiles.map((tile) => tile.querySelector('img[alt="warbands"]')?.getAttribute('src'))
            )
        expect(new Set(colours).size).toBe(2)
    })

    test('on a desktop each row of tiles shares the width its widest needs, no wider', async ({
        page
    }) => {
        await openMessenger(page)
        await panelImagesLoaded(page)
        const from = await tileWidths(page, ['Ancient City, 3 free', 'Steppe, 1 free'])
        expect(from[1].width).toBe(from[0].width)
        expect(Math.abs(from[0].width - Math.max(...from.map((t) => t.needs)))).toBeLessThanOrEqual(
            1
        )
        await tile(page, 'Ancient City, 3 free').click()
        await piece(page, 2).click()
        const to = await tileWidths(page, ['Your board', 'Steppe', 'Marshes'])
        expect(new Set(to.map((t) => t.width)).size).toBe(1)
        expect(Math.abs(to[0].width - Math.max(...to.map((t) => t.needs)))).toBeLessThanOrEqual(1)
        expect(await clippedLabels(page)).toEqual([])
        expect(await wrappedLabels(page)).toEqual([])
    })

    test('a power’s discard piles are rows as wide as the widest of them, not the panel', async ({
        page
    }) => {
        await openTable(page, 'pickerWhistle')
        await grid(page).getByRole('button', { name: 'Use a power', exact: true }).click()
        // Scryer's pile is a row per pile; a power's site is picked on the map.
        const scryer = grid(page).locator('[data-action-power="denizen.discord.scryer"]')
        await expect(scryer.locator('select')).toHaveCount(0)
        const rows = scryer.getByRole('button', { name: / pile, \d+ cards?$/ })
        await expectOneWidth(rows)
        expect((await boxOf(rows.first())).width).toBeLessThan((await boxOf(scryer)).width / 2)
    })

    test.describe('on a 375 px phone', () => {
        test.use({ viewport: { width: 375, height: 812 } })

        test('every tile and warband piece is at least 44 px and inside the panel; the moves run the width under the card', async ({
            page
        }) => {
            await openMessenger(page)
            await tile(page, 'Ancient City, 3 free').click()
            await piece(page, 2).click()
            await tile(page, 'Your board').click()
            await tile(page, 'Your board, 2 free').click()
            await piece(page, 2).click()
            await panelImagesLoaded(page)
            const panel = await boxOf(grid(page))
            const card = await boxOf(row(page).locator('img').first())
            const controls = [
                ...[
                    'Your board, 2 free',
                    'Ancient City, 1 free',
                    'Steppe, 1 free',
                    'Ancient City',
                    'Steppe',
                    'Marshes'
                ].map((name) => tile(page, name)),
                piece(page, 1),
                piece(page, 2)
            ]
            for (const control of controls) {
                const size = await layoutSizeOf(control)
                expect(
                    size?.height,
                    (await control.getAttribute('aria-label')) ?? ''
                ).toBeGreaterThanOrEqual(44)
                const box = await boxOf(control)
                expect(box.x).toBeGreaterThanOrEqual(panel.x)
                expect(box.x + box.width).toBeLessThanOrEqual(panel.x + panel.width)
            }
            expect(await layoutSizeOf(piece(page, 1))).toEqual({ width: 44, height: 44 })
            expect((await boxOf(tile(page, 'Your board, 2 free'))).x).toBeLessThan(
                card.x + card.width
            )
            expect(await clippedLabels(page)).toEqual([])
            expect(await wrappedLabels(page)).toEqual([])
        })
    })
})

/**
 * Warning Signals: Messenger's text, so Messenger's moves in the defender's battle plans: From,
 * How many and To as tiles and warband pieces, one move at a time; "Use plans" once a move is whole
 * and none half-built; Undo takes back one pick, then the move, then the plan.
 */
test.describe('Warning Signals’ moves', () => {
    const picks = (page: Page) =>
        grid(page).locator('[data-plan-picks="denizen.nomad.warning-signals"]')
    const tile = (page: Page, name: string) =>
        picks(page).getByRole('button', { name, exact: true })
    const pieces = (page: Page) => picks(page).getByRole('button', { name: /^How many: \d+$/ })
    const piece = (page: Page, n: number) =>
        picks(page).getByRole('button', { name: `How many: ${n}`, exact: true })
    const moves = (page: Page) => picks(page).locator('[data-move]')
    const card = (page: Page) => cardToggle(page, 'denizen.nomad.warning-signals')

    async function openWarningSignals(page: Page) {
        await openTable(page, 'warningSignals')
        await card(page).click()
        await expect(card(page)).toHaveAttribute('aria-pressed', 'true')
    }

    test('move 1 from a site, move 2 from the board it filled; Use plans once a move is whole', async ({
        page
    }) => {
        await openWarningSignals(page)
        await expect(picks(page).locator('select')).toHaveCount(0)
        await expect(picks(page).getByText('From:', { exact: true })).toBeVisible()
        await expect(tile(page, 'Ancient City, 3 free')).toBeVisible()
        await expect(tile(page, 'Steppe, 1 free')).toBeVisible()
        await expect(picks(page).getByRole('button', { name: /^Marshes/ })).toHaveCount(0)
        await expect(picks(page).getByRole('button', { name: /^Your board/ })).toHaveCount(0)
        await expect(answer(page, 'Use plans')).toHaveCount(0)
        await expect(answer(page, 'No plans')).toBeVisible()

        await tile(page, 'Ancient City, 3 free').click()
        await expect(pieces(page)).toHaveCount(3)
        await piece(page, 2).click()
        for (const name of ['Your board', 'Steppe', 'Marshes'])
            await expect(tile(page, name)).toBeVisible()
        await expect(tile(page, 'Ancient City')).toHaveCount(0)
        await expect(answer(page, 'Use plans')).toHaveCount(0)

        await tile(page, 'Your board').click()
        await expect(moves(page)).toHaveCount(1)
        await expect(moves(page).first()).toHaveText(/^\s*2\s*Ancient City → your board$/)
        await expect(answer(page, 'Use plans')).toBeVisible()

        await tile(page, 'Your board, 2 free').click()
        await expect(answer(page, 'Use plans')).toHaveCount(0)
        await piece(page, 2).click()
        await tile(page, 'Marshes').click()
        await expect(moves(page)).toHaveCount(2)
        await expect(moves(page).nth(1)).toHaveText(/^\s*2\s*your board → Marshes$/)
        for (const name of ['Ancient City, 1 free', 'Steppe, 1 free', 'Marshes, 2 free'])
            await expect(tile(page, name)).toBeVisible()
        await expect(grid(page).locator('p.text-oath-danger')).toHaveCount(0)

        await answer(page, 'Use plans').click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).warbandsAt['slot.provinces.1'])
            .toEqual({ imperial: 3 })
        const facts = await call(page, 'tableFacts')
        expect(facts.warbandsAt['slot.cradle.0']).toEqual({ imperial: 2 })
        expect(facts.boardOf.dana.imperial ?? 0).toBe(0)
    })

    test('Undo takes back To, then How many, then From, then the move before, then the plan', async ({
        page
    }) => {
        await openWarningSignals(page)
        await tile(page, 'Ancient City, 3 free').click()
        await piece(page, 2).click()
        await tile(page, 'Your board').click()
        await tile(page, 'Your board, 2 free').click()
        await piece(page, 1).click()

        await undoButton(page).click()
        await expect(piece(page, 1)).toHaveAttribute('aria-pressed', 'false')
        await expect(tile(page, 'Your board, 2 free')).toHaveAttribute('aria-pressed', 'true')
        await undoButton(page).click()
        await expect(pieces(page)).toHaveCount(0)
        await expect(moves(page)).toHaveCount(1)
        await undoButton(page).click()
        await expect(moves(page)).toHaveCount(0)
        await expect(piece(page, 2)).toHaveAttribute('aria-pressed', 'true')
        await undoButton(page).click()
        await undoButton(page).click()
        await expect(pieces(page)).toHaveCount(0)
        await expect(tile(page, 'Ancient City, 3 free')).toHaveAttribute('aria-pressed', 'false')
        await expect(card(page)).toHaveAttribute('aria-pressed', 'true')
        await undoButton(page).click()
        await expect(card(page)).toHaveAttribute('aria-pressed', 'false')
        await expect(picks(page)).toHaveCount(0)
    })

    test.describe('on a 375 px phone', () => {
        test.use({ viewport: { width: 375, height: 812 } })

        test('every tile and warband piece is at least 44 px and inside the panel', async ({
            page
        }) => {
            await openWarningSignals(page)
            await tile(page, 'Ancient City, 3 free').click()
            await piece(page, 2).click()
            await tile(page, 'Your board').click()
            await tile(page, 'Your board, 2 free').click()
            await piece(page, 2).click()
            await panelImagesLoaded(page)
            const panel = await boxOf(grid(page))
            const controls = [
                ...[
                    'Your board, 2 free',
                    'Ancient City, 1 free',
                    'Steppe, 1 free',
                    'Ancient City',
                    'Steppe',
                    'Marshes'
                ].map((name) => tile(page, name)),
                piece(page, 1),
                piece(page, 2)
            ]
            for (const control of controls) {
                const size = await layoutSizeOf(control)
                expect(
                    size?.height,
                    (await control.getAttribute('aria-label')) ?? ''
                ).toBeGreaterThanOrEqual(44)
                const box = await boxOf(control)
                expect(box.x).toBeGreaterThanOrEqual(panel.x)
                expect(box.x + box.width).toBeLessThanOrEqual(panel.x + panel.width)
            }
            expect(await layoutSizeOf(piece(page, 1))).toEqual({ width: 44, height: 44 })
            expect(await clippedLabels(page)).toEqual([])
            expect(await wrappedLabels(page)).toEqual([])
        })
    })
})

test('scenario 6: the facedown advisers to play are cards in the panel, a tap shows the placements', async ({
    page
}) => {
    await openTable(page, 'advisers')
    await grid(page).getByRole('button', { name: 'Adviser', exact: true }).click()
    await expect(grid(page).getByRole('button', { name: 'Curfew', exact: true })).toBeVisible()
    await expect(grid(page).getByRole('button', { name: 'Elders', exact: true })).toBeVisible()
    await grid(page).getByRole('button', { name: 'Curfew', exact: true }).click()
    const discard = grid(page).getByRole('button', { name: /^Discard: Curfew$/ })
    await expect(discard).toBeVisible()
    await expect(stepBacks(page)).toHaveCount(0)
    await undoButton(page).click()
    await expect(discard).toHaveCount(0)
    await expect(grid(page).getByRole('button', { name: 'Elders', exact: true })).toBeVisible()
    await undoButton(page).click()
    await expect(grid(page).getByRole('button', { name: 'Elders', exact: true })).toHaveCount(0)
    expect((await call(page, 'tableFacts')).staged).toBeUndefined()
})

test('scenario 18: each warband move is a row of warband pieces, drawn whole and never picked, and a tap on the Nth moves N', async ({
    page
}) => {
    await openTable(page, 'moves')
    await grid(page).getByRole('button', { name: 'Move warbands', exact: true }).click()
    const rows = page.getByRole('list', { name: 'Warband moves' }).getByRole('listitem')
    await expect(rows).toHaveCount(2)
    const onto = rows.filter({ hasText: 'From your board to your site' })
    await expect(onto.getByRole('button')).toHaveCount(4)
    await expect(onto.getByRole('button')).toHaveText(['', '', '', ''])
    await expect(onto.getByRole('button').locator('img')).toHaveCount(4)
    await expect(
        page.getByRole('list', { name: 'Warband moves' }).locator('[aria-pressed]')
    ).toHaveCount(0)
    await expect(onto.getByRole('button').first().locator('img')).toHaveCSS('opacity', '1')
    await expect(
        rows.filter({ hasText: 'From your site to your board' }).getByRole('button')
    ).toHaveCount(2)
    await expect(dimmedSites(page)).toHaveCount(0)
    await onto.getByRole('button', { name: /move 2$/ }).click()
    await expect.poll(async () => (await call(page, 'tableFacts')).boardOf.me).toEqual({ me: 2 })
    await expect(page.getByRole('list', { name: 'Warband moves' })).toHaveCount(0)
})

test('scenario 5: a Campaign target is a row with its picture, a tap adds it and a second drops it', async ({
    page
}) => {
    await openTable(page, 'campaign')
    await tile(page, 'Campaign').click()
    // The Chancellor is the one defender the rules allow, so the panel opens on the targets.
    await expect(grid(page)).toContainText(/Against ann\. Tap targets\./i)
    await expect(grid(page)).not.toContainText('Attack who?')
    await expect(grid(page).locator('h4').first()).toHaveText('Sites')
    const site = grid(page).locator('button[aria-pressed]').first()
    await expect(site).toHaveAttribute('aria-pressed', 'false')
    await site.click()
    await expect(site).toHaveAttribute('aria-pressed', 'true')
    await expect(site).toContainText('target')
    await expect(page.locator('.travel-cost.targeted')).toHaveCount(1)
    await site.click()
    await expect(site).toHaveAttribute('aria-pressed', 'false')

    const rows = grid(page).locator('button[aria-pressed]')
    await rows.nth(0).click()
    await rows.nth(1).click()
    await expect(grid(page).locator('button[aria-pressed="true"]')).toHaveCount(2)
    await expect(stepBacks(page)).toHaveCount(0)
    const undo = undoButton(page)
    await undo.click()
    await expect(grid(page).locator('button[aria-pressed="true"]')).toHaveCount(1)
    await expect(rows.nth(0)).toHaveAttribute('aria-pressed', 'true')
    await undo.click()
    await expect(grid(page).locator('button[aria-pressed="true"]')).toHaveCount(0)
    await expect(page.locator('.travel-cost.targeted')).toHaveCount(0)
    await expect(stepBacks(page)).toHaveCount(0)
    await undo.click()
    await expect(tile(page, 'Campaign')).toBeVisible()
    expect((await call(page, 'tableFacts')).staged).toBeUndefined()
    await expect(undo).toHaveCount(0)
})

/** R-1.23.1 — the start sites of the setup fixture: the top site of each region, faceup. */
const TOP_CRADLE = 'slot.cradle.0'
const START_SITES = [TOP_CRADLE, 'slot.hinterland.0', 'slot.provinces.0']
const startSitesList = (page: Page) => page.getByRole('list', { name: 'Start sites' })
const pickedSites = (page: Page) => page.locator('.site .board-card.picked')
const startHere = (page: Page, slotId: string) =>
    siteAt(page, slotId).getByText('start here', { exact: true })
const siteMagnifiers = (page: Page) =>
    page.locator('.site').getByRole('button', { name: /^Enlarge / })

async function exileAtSetup(page: Page) {
    await openTable(page, 'setup')
    await call(page, 'seatMakesSetupChoice')
    await expect(
        page.getByText('Pick a start site and a card to keep.', { exact: true })
    ).toBeVisible()
}

/** A lit site's name as its magnifier gives it ("Enlarge Great Slum"). */
async function siteNameOf(page: Page, slotId: string): Promise<string> {
    const label = await siteMagnifier(page, slotId).getAttribute('aria-label')
    if (!label) throw Error(`${slotId} has no magnifier`)
    return label.replace(/^Enlarge /, '')
}

/** The button that picks a lit site, by its accessible name; the magnifier's is "Enlarge …". */
const sitePick = (page: Page, slotId: string, name: string) =>
    siteAt(page, slotId).getByRole('button', { name, exact: true })

/** Tab until `target` has the focus; false if it never does. */
async function tabTo(page: Page, target: Locator): Promise<boolean> {
    for (let press = 0; press < 160; press++) {
        await page.keyboard.press('Tab')
        if (await target.evaluate((element) => element === document.activeElement)) return true
    }
    return false
}

/** Rule 1 — a pick on the map is a keyboard control too: a lit site is a button named by its site and its chip. */
test.describe('a lit site picked on the map, by keyboard', () => {
    test('Travel: Tab reaches a lit site, named "<site>, 1 Supply", with the browser’s focus ring; Enter travels; an unlit site is not a control', async ({
        page
    }) => {
        await openTable(page, 'actPhase')
        await tile(page, 'Travel').click()
        await expect(travelPrompt(page)).toBeVisible()
        const lit = sitePick(
            page,
            'slot.cradle.1',
            `${await siteNameOf(page, 'slot.cradle.1')}, 1 Supply`
        )
        await expect(lit).toHaveCount(1)
        await expect(siteAt(page, 'slot.cradle.0').getByRole('button')).toHaveCount(0)

        expect(await tabTo(page, lit)).toBe(true)
        expect(await lit.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('auto')
        await page.keyboard.press('Enter')
        await expect
            .poll(async () => (await call(page, 'tableFacts')).siteOf.me)
            .toBe('slot.cradle.1')
        await expect(boardOffers(page)).toHaveCount(0)
    })

    test('Setup: Space on a lit start site picks it, as a click does', async ({ page }) => {
        await exileAtSetup(page)
        const site = sitePick(page, 'slot.provinces.0', await siteNameOf(page, 'slot.provinces.0'))
        await expect(site).toHaveCount(1)
        await site.focus()
        await page.keyboard.press(' ')
        await expect(startHere(page, 'slot.provinces.0')).toBeVisible()
        await expect(siteCard(page, 'slot.provinces.0')).toHaveClass(/picked/)
    })

    test('the spoils: Enter on a lit site banishes the pawn there, named "<site>, banish"', async ({
        page
    }) => {
        await openTable(page, 'spoils')
        await placeButton(page, 2).click()
        await expect(banishPrompt(page)).toBeVisible()
        const [banishTo] = await litSlots(page)
        const site = sitePick(page, banishTo, `${await siteNameOf(page, banishTo)}, banish`)
        await expect(site).toHaveCount(1)
        await site.focus()
        await page.keyboard.press('Enter')
        await expect(spoilsStepCount(page)).toHaveText('3 of 3')
    })
})

/**
 * A pick on the map wears the phone's chip on a desktop too: its words about 13 px on screen at
 * 1280, where the board shows whole at about 0.37 (the desktop's own chip read about 5 px).
 */
const DESKTOP_CHIP_TEXT_PX = 12.5

/** The chip's words as tall as they show: its font size times the board's zoom at its site. */
const chipTextOnScreen = (chip: Locator): Promise<number> =>
    chip.evaluate((element) => {
        const site = element.closest('.site')
        if (!site) throw Error('The chip is not on a site')
        const zoom = site.getBoundingClientRect().width / site.clientWidth
        return parseFloat(getComputedStyle(element).fontSize) * zoom
    })

const overlaps = (one: Box, other: Box) =>
    one.x < other.x + other.width &&
    other.x < one.x + one.width &&
    one.y < other.y + other.height &&
    other.y < one.y + one.height

/** The site's chip reads at the phone's size, wholly on its card, and clear of its magnifier. */
async function expectPhoneChip(page: Page, slotId: string) {
    const chip = siteAt(page, slotId).locator('.travel-cost')
    await expect(chip).toBeVisible()
    expect(await chipTextOnScreen(chip)).toBeGreaterThanOrEqual(DESKTOP_CHIP_TEXT_PX)
    const box = await boxOf(chip)
    expect(inside(box, await boxOf(siteCard(page, slotId)))).toBe(true)
    const magnifier = siteMagnifier(page, slotId).locator('.site-magnifier__face')
    if ((await magnifier.count()) > 0) expect(overlaps(box, await boxOf(magnifier))).toBe(false)
}

test.describe('a lit site’s chip on a desktop at 1280', () => {
    for (const table of ['actPhase', 'travelToll', 'leavingBuriedGiant'] as const) {
        test(`Travel (${table}): every destination’s chip reads at the phone’s size, wholly on its card`, async ({
            page
        }) => {
            expect(page.viewportSize()?.width).toBe(1280)
            await openTable(page, table)
            await tile(page, 'Travel').click()
            await expect(travelPrompt(page)).toBeVisible()
            const legal = await call(page, 'legalTravelDestinations')
            expect(legal.length).toBeGreaterThan(1)
            for (const slotId of legal) await expectPhoneChip(page, slotId)
        })
    }

    test('Setup: the "start here" chip reads at the phone’s size, wholly on its card', async ({
        page
    }) => {
        await exileAtSetup(page)
        await siteCard(page, 'slot.provinces.0').click()
        await expect(startHere(page, 'slot.provinces.0')).toBeVisible()
        await expectPhoneChip(page, 'slot.provinces.0')
    })

    test('the spoils: every "banish" chip reads at the phone’s size, wholly on its card', async ({
        page
    }) => {
        await openTable(page, 'spoils')
        await placeButton(page, 2).click()
        await expect(banishPrompt(page)).toBeVisible()
        const lit = await litSlots(page)
        expect(lit.length).toBeGreaterThan(1)
        for (const slotId of lit) await expectPhoneChip(page, slotId)
    })
})

test('scenario 2: an Exile picks a start site on the map: a click on a lit site rings it with "start here", and a click on another moves the pick', async ({
    page
}) => {
    await exileAtSetup(page)
    await expect(startSitesList(page)).toHaveCount(0)
    expect(await litSlots(page)).toEqual(START_SITES)
    await expect(dimmedSites(page)).toHaveCount(5)
    await expect(page.getByText('start here', { exact: true })).toHaveCount(0)
    for (const slotId of START_SITES) await expect(siteMagnifier(page, slotId)).toHaveCount(1)

    await siteCard(page, TOP_CRADLE).click()
    await expect(page.getByText('Keep one.', { exact: true })).toBeVisible()
    await expect(preview(page)).toHaveCount(0)
    await expect(pickedSites(page)).toHaveCount(1)
    await expect(siteCard(page, TOP_CRADLE)).toHaveClass(/picked/)
    await expect(startHere(page, TOP_CRADLE)).toBeVisible()
    await expect(page.getByText('start here', { exact: true })).toHaveCount(1)
    await expect(siteMagnifier(page, TOP_CRADLE)).toHaveCount(0)
    await expect(siteMagnifiers(page)).toHaveCount(2)
    expect(await litSlots(page)).toEqual(START_SITES)
    await expect(dimmedSites(page)).toHaveCount(5)

    await siteCard(page, 'slot.provinces.0').click()
    await expect(siteCard(page, 'slot.provinces.0')).toHaveClass(/picked/)
    await expect(pickedSites(page)).toHaveCount(1)
    await expect(startHere(page, 'slot.provinces.0')).toBeVisible()
    await expect(startHere(page, TOP_CRADLE)).toHaveCount(0)
    expect((await call(page, 'tableFacts')).siteOf.me).toBeUndefined()
})

/** The panel keeps the hand and its line; the start sites are on the map at every width. */
for (const viewport of [
    { width: 1280, height: 900 },
    { width: 402, height: 874 },
    { width: 375, height: 812 }
]) {
    test(`scenario 2: no start-site rows in the panel at ${viewport.width}, only the hand and its line`, async ({
        page
    }) => {
        await page.setViewportSize(viewport)
        await exileAtSetup(page)
        await expect(startSitesList(page)).toHaveCount(0)
        await expect(panelCards(page)).toHaveCount(3)
        await expect(magnifiers(page)).toHaveCount(3)
        await expect(grid(page)).not.toContainText(/cradle|provinces|hinterland/i)
        if (viewport.width === 402) expect(await panelScale(page)).toBe(1)
    })
}

test('scenario 2: a card kept first stays marked; the site picked after stays ringed with "start here", the other start sites go dark and nothing dims', async ({
    page
}) => {
    await exileAtSetup(page)
    expect(await litSlots(page)).toEqual(START_SITES)
    expect((await boardOffers(page).count()) + (await dimmedSites(page).count())).toBe(
        await page.locator('.site').count()
    )

    const card = grid(page).locator('button[aria-pressed]').first()
    await card.click()
    await expect(card).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('Pick a start site.', { exact: true })).toBeVisible()
    await expect(boardOffers(page)).toHaveCount(3)
    await siteCard(page, 'slot.hinterland.0').click()
    await expect(
        page.getByText('Tap to discard; the last goes on top.', { exact: true })
    ).toBeVisible()
    expect(await litSlots(page)).toEqual(['slot.hinterland.0'])
    await expect(siteCard(page, 'slot.hinterland.0')).toHaveClass(/picked/)
    await expect(startHere(page, 'slot.hinterland.0')).toBeVisible()
    await expect(dimmedSites(page)).toHaveCount(0)
    await expect(siteMagnifiers(page)).toHaveCount(0)
})

test('scenario 2: Undo takes back the last tap: the site tapped after the card first, then the card, and the lit map returns', async ({
    page
}) => {
    await exileAtSetup(page)
    const card = grid(page).locator('button[aria-pressed]').first()
    await card.click()
    await siteCard(page, 'slot.provinces.0').click()
    await expect(
        page.getByText('Tap to discard; the last goes on top.', { exact: true })
    ).toBeVisible()
    await expect(stepBacks(page)).toHaveCount(0)

    const undo = undoButton(page)
    await undo.click()
    await expect(page.getByText('Pick a start site.', { exact: true })).toBeVisible()
    await expect(pickedSites(page)).toHaveCount(0)
    await expect(grid(page).locator('button[aria-pressed="true"]')).toHaveCount(1)
    expect(await litSlots(page)).toEqual(START_SITES)
    await expect(dimmedSites(page)).toHaveCount(5)

    await undo.click()
    await expect(
        page.getByText('Pick a start site and a card to keep.', { exact: true })
    ).toBeVisible()
    await expect(grid(page).locator('button[aria-pressed="true"]')).toHaveCount(0)
    await expect(undo).toHaveCount(0)
})

test('scenario 1: the Chancellor’s site is ringed with "start here" and cannot be picked; a click enlarges it, and nothing dims', async ({
    page
}) => {
    await openTable(page, 'setup')
    await expect(page.getByText('Keep one.', { exact: true })).toBeVisible()
    expect(await litSlots(page)).toEqual([TOP_CRADLE])
    await expect(siteCard(page, TOP_CRADLE)).toHaveClass(/picked/)
    await expect(startHere(page, TOP_CRADLE)).toBeVisible()
    await expect(dimmedSites(page)).toHaveCount(0)
    await expect(siteMagnifiers(page)).toHaveCount(0)
    await expect(startSitesList(page)).toHaveCount(0)

    await siteCard(page, TOP_CRADLE).click()
    await expect(preview(page)).toBeVisible()
    await expect(undoButton(page)).toHaveCount(0)
})

/** On a phone the lit map is the start sites' menu, framed as Travel's. */
for (const viewport of [
    { width: 402, height: 874 },
    { width: 375, height: 812 }
]) {
    test.describe(`scenario 2 on a ${viewport.width} px phone held upright`, () => {
        test.use({ viewport, hasTouch: true })

        test('the map opens framed on the Cradle under three region chips; the start sites lit, the facedown ones dimmed', async ({
            page
        }) => {
            await exileAtSetup(page)
            for (const region of ['Cradle', 'Provinces', 'Hinterland']) {
                await expect(regionChip(page, region)).toHaveAccessibleName(
                    `${region}: 1 start site`
                )
            }
            await expect(regionChip(page, 'Cradle')).toHaveAttribute('aria-pressed', 'true')
            await expect.poll(() => onScreen(page, siteCard(page, TOP_CRADLE))).toBe(true)
            expect(await onScreen(page, siteCard(page, 'slot.provinces.0'))).toBe(false)
            const chipRow = await boxOf(regionChips(page))
            expect(chipRow.y + chipRow.height).toBeLessThan(
                (await boxOf(siteCard(page, TOP_CRADLE))).y
            )
            expect(await litSlots(page)).toEqual(START_SITES)
            await expect(dimmedSites(page)).toHaveCount(5)
            await expect(page.getByText('start here', { exact: true })).toHaveCount(0)
            const face = await boxOf(
                siteMagnifier(page, TOP_CRADLE).locator('.site-magnifier__face')
            )
            expect(face.width).toBeCloseTo(28, 0)
            expect(face.height).toBeCloseTo(28, 0)
        })

        test('a tap on a lit site rings it with "start here" on its card; a chip and a tap in another region move the pick', async ({
            page
        }) => {
            await exileAtSetup(page)
            await expect.poll(() => onScreen(page, siteCard(page, TOP_CRADLE))).toBe(true)
            await siteCard(page, TOP_CRADLE).tap()
            await expect(page.getByText('Keep one.', { exact: true })).toBeVisible()
            await expect(siteCard(page, TOP_CRADLE)).toHaveClass(/picked/)
            const chip = await boxOf(siteAt(page, TOP_CRADLE).locator('.travel-cost'))
            expect(inside(chip, await boxOf(siteCard(page, TOP_CRADLE)))).toBe(true)
            await expect(startHere(page, TOP_CRADLE)).toBeVisible()
            await expect(preview(page)).toHaveCount(0)

            await regionChip(page, 'Provinces').tap()
            await expect(regionChip(page, 'Provinces')).toHaveAttribute('aria-pressed', 'true')
            await expect.poll(() => onScreen(page, siteCard(page, 'slot.provinces.0'))).toBe(true)
            await expect(page.getByText('Keep one.', { exact: true })).toBeVisible()
            await siteCard(page, 'slot.provinces.0').tap()
            await expect(siteCard(page, 'slot.provinces.0')).toHaveClass(/picked/)
            await expect(pickedSites(page)).toHaveCount(1)
            await expect(startHere(page, 'slot.provinces.0')).toBeVisible()
        })

        test('a start site’s magnifier enlarges it and picks nothing', async ({ page }) => {
            await exileAtSetup(page)
            await expect.poll(() => onScreen(page, siteCard(page, TOP_CRADLE))).toBe(true)
            await siteMagnifier(page, TOP_CRADLE).tap()
            await expect(preview(page)).toBeVisible()
            await page.touchscreen.tap(20, 20)
            await expect(preview(page)).toHaveCount(0)
            await expect(pickedSites(page)).toHaveCount(0)
            await expect(
                page.getByText('Pick a start site and a card to keep.', { exact: true })
            ).toBeVisible()
        })

        test('the discards replace the hand; the pick stays ringed under the chips, and the map undims', async ({
            page
        }) => {
            await exileAtSetup(page)
            await expect.poll(() => onScreen(page, siteCard(page, TOP_CRADLE))).toBe(true)
            await siteCard(page, TOP_CRADLE).tap()
            await panelCards(page).first().tap()
            await expect(
                page.getByText('Tap to discard; the last goes on top.', { exact: true })
            ).toBeVisible()
            await expect(panelCards(page)).toHaveCount(2)
            expect(await litSlots(page)).toEqual([TOP_CRADLE])
            await expect(siteCard(page, TOP_CRADLE)).toHaveClass(/picked/)
            await expect(dimmedSites(page)).toHaveCount(0)
            await expect(regionChips(page)).toBeVisible()
            expect(await onScreen(page, siteCard(page, TOP_CRADLE))).toBe(true)
        })

        test('the Chancellor: the map opens framed on the Cradle with no chips, his site ringed with "start here"', async ({
            page
        }) => {
            await openTable(page, 'setup')
            await expect(page.getByText('Keep one.', { exact: true })).toBeVisible()
            await expect.poll(() => onScreen(page, siteCard(page, TOP_CRADLE))).toBe(true)
            await expect(regionChips(page)).toHaveCount(0)
            await expect(siteCard(page, TOP_CRADLE)).toHaveClass(/picked/)
            await expect(startHere(page, TOP_CRADLE)).toBeVisible()
            await expect(dimmedSites(page)).toHaveCount(0)
            await expect(siteMagnifiers(page)).toHaveCount(0)
        })
    })
}

test.describe('scenario 2 on a phone held sideways', () => {
    test.use({ viewport: { width: 812, height: 375 }, hasTouch: true })

    // The start sites' row across the board's width, where Travel's every-site frame draws it about 0.78 as wide.
    async function rowFillsTheBoard(page: Page): Promise<boolean> {
        const [first, last, view] = [
            await boxOf(siteCard(page, TOP_CRADLE)),
            await boxOf(siteCard(page, 'slot.hinterland.0')),
            await boxOf(boardView(page))
        ]
        return last.x + last.width - first.x > 0.9 * view.width
    }

    test('the three start sites are framed at once with no chips; a tap picks one', async ({
        page
    }) => {
        await exileAtSetup(page)
        await expect(regionChips(page)).toHaveCount(0)
        await expect(startSitesList(page)).toHaveCount(0)
        for (const slotId of START_SITES) {
            await expect.poll(() => onScreen(page, siteCard(page, slotId))).toBe(true)
        }
        await expect.poll(() => rowFillsTheBoard(page)).toBe(true)
        await siteCard(page, 'slot.hinterland.0').tap()
        await expect(siteCard(page, 'slot.hinterland.0')).toHaveClass(/picked/)
        await expect(startHere(page, 'slot.hinterland.0')).toBeVisible()
    })

    test('the Chancellor’s site is framed in its row with no chips', async ({ page }) => {
        await openTable(page, 'setup')
        await expect(page.getByText('Keep one.', { exact: true })).toBeVisible()
        await expect(regionChips(page)).toHaveCount(0)
        for (const slotId of START_SITES) {
            await expect.poll(() => onScreen(page, siteCard(page, slotId))).toBe(true)
        }
        await expect.poll(() => rowFillsTheBoard(page)).toBe(true)
        await expect(siteCard(page, TOP_CRADLE)).toHaveClass(/picked/)
    })
})

const favorOn = (page: Page, n: number, site: string) =>
    grid(page).getByRole('button', { name: `place ${n} favor on ${site}`, exact: true })

/** R-1.16, R-1.23.1 — a real six-seat deal: the bank holds 4, the Salt Flats want 2 and the Mine 3. */
test('setup: a short split keeps the Chancellor at the top Cradle site and holds only the discards', async ({
    page
}) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const { seatId } = await openTable(page, 'shortBank')
    if (seatId === undefined) throw Error('A seat is on the clock')
    await expect(grid(page)).toContainText('Place 4')
    await expect(grid(page).getByText('Salt Flats', { exact: true })).toBeVisible()
    await expect(grid(page)).not.toContainText('prints')
    await expect(grid(page)).not.toContainText('placed.')
    await expect(page.getByText('Keep one.', { exact: true })).toBeVisible()

    await favorOn(page, 1, 'Salt Flats').click()
    const count = grid(page).getByText('3 of 4 placed.')
    await expect(count).toBeVisible()
    await expect(count).toHaveClass(/text-oath-danger/)
    await expect(page.getByRole('list', { name: 'Start sites' })).toHaveCount(0)
    await expect(grid(page)).not.toContainText('Tap the site where your pawn starts')
    await expect(grid(page)).not.toContainText('Pick a start site')
    await expect(page.getByText('Keep one.', { exact: true })).toBeVisible()

    await grid(page).locator('button:not(.magnifier):not([aria-label^="place "])').first().click()
    await expect(favorOn(page, 2, 'Salt Flats')).toBeVisible()
    await expect(grid(page)).toContainText('Place all 4')
    await expect(count).toBeVisible()
    await expect(grid(page)).not.toContainText('Tap to discard')
    expect((await call(page, 'tableFacts')).siteOf[seatId]).toBeUndefined()

    await favorOn(page, 2, 'Salt Flats').click()
    await expect(count).toHaveCount(0)
    await expect(favorOn(page, 2, 'Salt Flats')).toHaveCount(0)
    await expect(
        page.getByText('Tap to discard; the last goes on top.', { exact: true })
    ).toBeVisible()
    await panelCards(page).first().click()
    await expect
        .poll(async () => (await call(page, 'tableFacts')).siteOf[seatId])
        .toBe('slot.cradle.0')
    expect((await call(page, 'cardTokens', 'site.salt-flats')).favor).toBe(2)
    expect(errors).toEqual([])
})

test('scenario 43: a menu row lights what it names on the table while pointed at', async ({
    page
}) => {
    await openTable(page, 'trade')
    await tile(page, 'Trade').click()
    // The click leaves the cursor where the first Trade row then opens: rest it off the panel.
    await restMouse(page)
    const row = page
        .getByRole('list', { name: 'Trades at your site' })
        .getByRole('listitem')
        .first()
    const pointed = page.locator('.board-card.offered.pointed')
    await expect(pointed).toHaveCount(0)
    await row.hover()
    await expect(pointed).toHaveCount(1)
    await restMouse(page)
    await expect(pointed).toHaveCount(0)
    await row.getByRole('button').first().focus()
    await expect(pointed).toHaveCount(1)
    await row.getByRole('button').first().blur()
    await expect(pointed).toHaveCount(0)
})

test('scenario 51: an empty bank shows a plain 0 and no favor token', async ({ page }) => {
    await openTable(page, 'trade')
    await expect(page.locator('.bank .bank-empty')).toHaveCount(1)
    await expect(page.locator('.bank .bank-empty')).toHaveText('0')
    await expect(page.locator('.bank .token')).toHaveCount(6)
})

test('scenario 45: the focus views fill the board; Full restores; a zoom by hand clears the choice; an enlarged site zooms the board to its row', async ({
    page
}) => {
    await openTable(page, 'setup')
    const chooser = page.getByRole('group', { name: 'Focus the board' })
    const site = page.locator('.site .board-card').first()
    const siteWidth = async () => (await site.boundingBox())?.width ?? 0
    await expect.poll(siteWidth).toBeGreaterThan(0)
    await page.waitForTimeout(500)
    const full = await siteWidth()

    await chooser.getByRole('button', { name: 'Cradle' }).click()
    await expect(chooser.getByRole('button', { name: 'Cradle' })).toHaveAttribute(
        'aria-pressed',
        'true'
    )
    await expect.poll(siteWidth).toBeGreaterThan(full * 1.5)

    await chooser.getByRole('button', { name: 'Full' }).click()
    await expect(chooser.getByRole('button', { name: 'Full' })).toHaveAttribute(
        'aria-pressed',
        'true'
    )
    await expect.poll(siteWidth).toBeLessThan(full * 1.1)

    await chooser.getByRole('button', { name: 'Banks' }).click()
    await expect(chooser.getByRole('button', { name: 'Banks' })).toHaveAttribute(
        'aria-pressed',
        'true'
    )
    const board = await page.locator('.scaling-surface').first().boundingBox()
    if (!board) throw Error('The board is on screen')
    await page.mouse.move(board.x + board.width / 2, board.y + board.height / 2)
    await page.mouse.wheel(0, 200)
    await expect(chooser.locator('[aria-pressed="true"]')).toHaveCount(0)

    await chooser.getByRole('button', { name: 'Full' }).click()
    await expect.poll(siteWidth).toBeLessThan(full * 1.1)
    await (await uncovered(page, '.site .board-card')).click()
    await page.getByRole('button', { name: 'Zoom the board here' }).click()
    await expect(preview(page)).toHaveCount(0)
    await expect.poll(siteWidth).toBeGreaterThan(full * 1.5)
})

/** Scenario 54: the focus views are one line on the map's top edge on a desktop, and a phone has none. */
test('scenario 54: the focus views sit in one line along the top of the map on a desktop, and a phone has none', async ({
    page
}) => {
    await openTable(page, 'setup')
    const chooser = page.getByRole('group', { name: 'Focus the board' })
    const full = chooser.getByRole('button', { name: 'Full' })
    const banks = chooser.getByRole('button', { name: 'Banks' })
    await expect(banks).toBeVisible()
    const board = await page.locator('.scaling-surface').first().boundingBox()
    const bar = await chooser.boundingBox()
    if (!board || !bar) throw Error('The board and its focus views are on screen')
    expect(bar.y - board.y).toBeLessThan(12)
    expect(bar.y + bar.height).toBeLessThan(board.y + board.height / 4)
    expect(
        Math.abs(((await full.boundingBox())?.y ?? 0) - ((await banks.boundingBox())?.y ?? -100))
    ).toBeLessThan(2)

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(chooser).toBeHidden()
    // At phone width the board sits below the panel; a card is only reachable once it is on screen.
    await page.locator('.scaling-surface').first().scrollIntoViewIfNeeded()
    await expect(async () => (await uncovered(page, '.site .board-card')).click()).toPass()
    await expect(page.getByRole('button', { name: 'Zoom the board here' })).toBeVisible()
})

/** A box once the board's view has stopped moving: two reads a frame apart agree. */
async function settledBox(locator: Locator): Promise<Box> {
    const read: { last: Box | null } = { last: null }
    await expect
        .poll(async () => {
            const box = await locator.boundingBox()
            const same = box !== null && JSON.stringify(box) === JSON.stringify(read.last)
            read.last = box
            return same
        })
        .toBe(true)
    if (!read.last) throw Error('The element is laid out')
    return read.last
}

/** The wrapper's zoom in, zoom out and full screen, one group. */
const zoomButtons = (page: Page) => page.locator('[aria-label="Zoom in"]').locator('..')

/** The zoom buttons sit flush in the bottom-right corner of the board's area. */
async function expectInBottomRight(page: Page, buttons: Box) {
    const area = await settledBox(page.locator('.scaling-surface').first())
    expect(Math.abs(buttons.x + buttons.width - (area.x + area.width))).toBeLessThan(1)
    expect(Math.abs(buttons.y + buttons.height - (area.y + area.height))).toBeLessThan(1)
}

/**
 * Setup at the board's rest view, in a window of `viewport`: a seat waiting on the one setting up.
 * On a phone the seat setting up has its start site framed, as a pick on the map is while its step
 * is open. The table opens on a desktop, where nothing is framed and the board rests, and the window
 * then takes the phone's size: a board at rest stays at rest.
 */
async function setupAtRest(page: Page, viewport: { width: number; height: number }) {
    await openTable(page, 'setup')
    const { seatId } = await call(page, 'tableFacts')
    if (seatId === undefined) throw Error('A seat sets up')
    expect(await call(page, 'viewOffTheClock')).not.toBe(seatId)
    await expectWaitingOn(page, [seatId])
    await settledBox(page.locator('.board-surface'))
    await page.setViewportSize(viewport)
}

test.describe('the board’s zoom buttons sit in its bottom-right corner, clear of the rail’s goals', () => {
    test('on a phone held sideways, 812 by 375, at Setup’s rest view they cover no part of the goals', async ({
        page
    }) => {
        await setupAtRest(page, { width: 812, height: 375 })
        const area = await settledBox(page.locator('.scaling-surface').first())
        const goals = await settledBox(page.locator('.rail-goals'))
        expect(overlaps(goals, area)).toBe(true)
        const buttons = await settledBox(zoomButtons(page))
        expect(overlaps(buttons, goals)).toBe(false)
        await expectInBottomRight(page, buttons)
    })

    // Held upright, Setup frames the seat's start site with the rail off screen, so the board at rest
    // under a "Keep one." of three cards is the Search's.
    test('on a phone held upright, 375 by 812, under “Keep one.” and panned to the board’s left edge, they cover no part of the Oath’s box', async ({
        page
    }) => {
        await page.setViewportSize({ width: 375, height: 812 })
        await openTable(page, 'searching')
        await expect(grid(page).getByText('Keep one.', { exact: true })).toBeVisible()
        const surface = page.locator('.scaling-surface').first()
        await surface.scrollIntoViewIfNeeded()
        const area = await settledBox(surface)
        const board = await settledBox(page.locator('.board-surface'))
        // A pan by hand that brings the board's left edge to the area's left edge.
        const start = { x: area.x + area.width / 2, y: area.y + area.height / 2 }
        await page.mouse.move(start.x, start.y)
        await page.mouse.down()
        await page.mouse.move(start.x + (area.x - board.x), start.y, { steps: 12 })
        await page.mouse.up()
        const panned = await settledBox(page.locator('.board-surface'))
        expect(Math.abs(panned.x - area.x)).toBeLessThan(2)

        const oath = await settledBox(page.locator('.rail-goals .box').first())
        expect(overlaps(oath, area)).toBe(true)
        const buttons = await settledBox(zoomButtons(page))
        expect(overlaps(buttons, oath)).toBe(false)
        await expectInBottomRight(page, buttons)
    })

    test('on a desktop, 1280 by 900, they sit under the board', async ({ page }) => {
        await setupAtRest(page, { width: 1280, height: 900 })
        const board = await settledBox(page.locator('.board-surface'))
        const buttons = await settledBox(zoomButtons(page))
        expect(buttons.y).toBeGreaterThanOrEqual(board.y + board.height)
        await expectInBottomRight(page, buttons)
    })
})

test('scenario 45: choosing a focus leaves the staged action, the lit sites and the panel unchanged', async ({
    page
}) => {
    await openTable(page, 'actPhase')
    await tile(page, 'Travel').click()
    await expect(travelPrompt(page)).toBeVisible()
    const panelBefore = await grid(page).innerText()
    const offeredBefore = await boardOffers(page).count()
    const stagedBefore = (await call(page, 'tableFacts')).staged
    const cradle = page
        .getByRole('group', { name: 'Focus the board' })
        .getByRole('button', { name: 'Cradle' })
    await cradle.click()
    await expect(cradle).toHaveAttribute('aria-pressed', 'true')
    expect(await grid(page).innerText()).toBe(panelBefore)
    expect(await boardOffers(page).count()).toBe(offeredBefore)
    expect((await call(page, 'tableFacts')).staged).toBe(stagedBefore)
})

test('scenario 46: in full screen the panel is docked above the board, Travel is chosen from it and picked on the map, and a card enlarges inside', async ({
    page
}) => {
    await openTable(page, 'actPhase')
    await page.mouse.move(800, 600)
    await page.keyboard.press('f')
    const dialog = page.locator('dialog[aria-label="Full screen view"]')
    await expect(dialog).toHaveCount(1)
    await dialog.locator('.majors button').filter({ hasText: 'Travel' }).click()
    await expect(dialog.getByText('Tap a lit site.', { exact: true })).toBeVisible()
    const focusCradle = dialog
        .getByRole('group', { name: 'Focus the board' })
        .getByRole('button', { name: 'Cradle' })
    await focusCradle.click()
    await expect(focusCradle).toHaveAttribute('aria-pressed', 'true')
    await dialog.locator('.board-card:not(.offered)').first().click()
    await expect(dialog.locator('.card-preview')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog.locator('.card-preview')).toHaveCount(0)
    await dialog.locator('.site[data-slot="slot.cradle.1"] .board-card.offered').click()
    await expect.poll(async () => (await call(page, 'tableFacts')).siteOf.me).toBe('slot.cradle.1')
})

test('scenario 47: Escape closes one layer at a time: the enlarged card or the open goals before full screen, a seat’s card before the seat', async ({
    page
}) => {
    await openTable(page, 'actPhase')
    await page.mouse.move(800, 600)
    await page.keyboard.press('f')
    const dialog = page.locator('dialog[aria-label="Full screen view"]')
    await expect(dialog).toHaveCount(1)
    await dialog.locator('.board-card').first().click()
    await expect(dialog.locator('.card-preview')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog.locator('.card-preview')).toHaveCount(0)
    await expect(dialog).toHaveCount(1)

    await dialog.getByRole('button', { name: 'Goals: open the enlarged view' }).click()
    const goals = dialog.getByRole('dialog', { name: 'Goals' })
    await expect(goals).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(goals).toHaveCount(0)
    await expect(dialog).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)

    await openTable(page, 'trade')
    await page.getByRole('button', { name: /you/ }).first().click()
    const seat = page.getByRole('dialog', { name: /seat$/ })
    await expect(seat).toBeVisible()
    await seat.getByRole('img', { name: 'A Round of Ale' }).first().click()
    await expect(preview(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(preview(page)).toHaveCount(0)
    await expect(seat).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(seat).toHaveCount(0)
})

/** A point over an offered card that the overlay's backdrop, not its panel, covers. */
async function backdropOverOffer(page: Page, backdrop: string) {
    const point = await page.evaluate((backdrop) => {
        for (const card of document.querySelectorAll('.board-card.offered')) {
            const box = card.getBoundingClientRect()
            const x = box.x + box.width / 2
            const y = box.y + box.height / 2
            if (document.elementFromPoint(x, y)?.matches(backdrop)) return { x, y }
        }
        return undefined
    }, backdrop)
    if (!point) throw Error(`No offered card lies under the ${backdrop} backdrop`)
    return point
}

test('scenario 47: a press outside an open seat or the goals closes it and reaches nothing under it', async ({
    page
}) => {
    await openTable(page, 'trade')
    await tile(page, 'Travel').click()
    // The press outside lands over a lit site, which a press reaching it would travel to.
    const destinations = travelPrompt(page)
    await expect(destinations).toBeVisible()
    const before = await call(page, 'tableFacts')

    await page.getByRole('button', { name: /you/ }).first().click()
    await expect(page.getByRole('dialog', { name: /seat$/ })).toBeVisible()
    const outsideSeat = await backdropOverOffer(page, '.seat-detail')
    await page.mouse.click(outsideSeat.x, outsideSeat.y)
    await expect(page.getByRole('dialog', { name: /seat$/ })).toHaveCount(0)
    await expect(preview(page)).toHaveCount(0)

    await page.getByRole('button', { name: 'Goals: open the enlarged view' }).click()
    await expect(page.getByRole('dialog', { name: 'Goals' })).toBeVisible()
    const outsideGoals = await backdropOverOffer(page, '.goals-layer')
    await page.mouse.click(outsideGoals.x, outsideGoals.y)
    await expect(page.getByRole('dialog', { name: 'Goals' })).toHaveCount(0)
    await expect(preview(page)).toHaveCount(0)

    expect(await call(page, 'tableFacts')).toEqual(before)
    await expect(destinations).toBeVisible()
})

test('scenario 48: History View offers no choice; a click enlarges, the seat, the goals and the focus views work; the live menu returns', async ({
    page
}) => {
    await openTable(page, 'setup')
    await call(page, 'seatMakesSetupChoice')
    const prompt = page.getByText('Pick a start site and a card to keep.', { exact: true })
    await expect(prompt).toBeVisible()
    await page.getByRole('button', { name: 'step backwards' }).click()
    await expect(prompt).toHaveCount(0)
    await expect(boardOffers(page)).toHaveCount(0)
    await expect(page.getByRole('list', { name: 'Start sites' })).toHaveCount(0)

    await (await uncovered(page, '.site .board-card')).click()
    await expect(preview(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(preview(page)).toHaveCount(0)
    await page.getByRole('button', { name: /you/ }).first().click()
    await expect(page.getByRole('dialog', { name: /seat$/ })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Goals: open the enlarged view' }).click()
    await expect(page.getByRole('dialog', { name: 'Goals' })).toBeVisible()
    await page.keyboard.press('Escape')
    const cradle = page
        .getByRole('group', { name: 'Focus the board' })
        .getByRole('button', { name: 'Cradle' })
    await cradle.click()
    await expect(cradle).toHaveAttribute('aria-pressed', 'true')

    await page.getByRole('button', { name: 'go to current' }).click()
    await expect(prompt).toBeVisible()
    await expect(boardOffers(page)).toHaveCount(3)
    await expect(cradle).toHaveAttribute('aria-pressed', 'true')
})

test('scenario 49: with Observatory declared every non-empty pile is listed and ringed, the world deck beside them without it; a pile’s button searches it', async ({
    page
}) => {
    await openTable(page, 'observatory')
    await tile(page, 'Search').click()
    await expect(grid(page).getByRole('button', { name: /^Search the world deck/ })).toBeVisible()
    await panelCards(page).first().click()
    const provinces = grid(page).getByRole('button', { name: /^Search the Provinces discard pile/ })
    await expect(provinces).toBeVisible()
    await expect(
        grid(page).getByRole('button', { name: /^Search the Hinterland discard pile/ })
    ).toBeVisible()
    // R-7.4 — Observatory names no draw from the world deck, so that row is listed and sent without it.
    await expect(grid(page).getByRole('button', { name: /^Search the world deck/ })).toBeVisible()
    await expect(
        grid(page).getByRole('button', { name: /^Search the Cradle discard pile/ })
    ).toHaveCount(0)
    await expect(page.locator('.discard.pickable')).toHaveCount(2)
    await expect(page.locator('.discard.empty.pickable')).toHaveCount(0)
    await expect(page.locator('.deck--laid.pickable')).toHaveCount(1)
    const piles = page.locator('.discard')
    await expect(piles.nth(1)).toContainText('3')
    await provinces.click()
    await expect(page.getByText('Keep one.', { exact: true })).toBeVisible()
    expect((await call(page, 'tableFacts')).machineState).toBe('Searching')
    await expect(piles.nth(1)).toHaveClass(/empty/)
    await expect(piles.nth(2)).toContainText('2')
})

test('scenario 22: with Travel chosen, an open seat’s cards enlarge on a press and pick nothing; a press outside closes it and the destinations are still offered', async ({
    page
}) => {
    await openTable(page, 'trade')
    await tile(page, 'Travel').click()
    const offeredBefore = await boardOffers(page).count()
    expect(offeredBefore).toBeGreaterThan(0)
    await page.getByRole('button', { name: /you/ }).first().click()
    const seat = page.getByRole('dialog', { name: /seat$/ })
    await expect(seat).toBeVisible()
    await seat.getByRole('img', { name: 'A Round of Ale' }).first().click()
    await expect(preview(page)).toBeVisible()
    await page.mouse.click(20, 20)
    await expect(preview(page)).toHaveCount(0)
    await expect(seat).toBeVisible()
    const outside = await backdropOverOffer(page, '.seat-detail')
    await page.mouse.click(outside.x, outside.y)
    await expect(seat).toHaveCount(0)
    expect((await call(page, 'tableFacts')).siteOf.me).toBe('slot.cradle.0')
    expect(await boardOffers(page).count()).toBe(offeredBefore)
})

test('scenario 19: Muster lists every card a favor can go on, a button sends', async ({ page }) => {
    await openTable(page, 'trade')
    await tile(page, 'Muster').click()
    const list = page.getByRole('list', { name: 'Musters at your site' })
    const rows = list.getByRole('listitem')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toContainText('Book Binders')
    await expect(rows.nth(1)).toContainText('Assassin')
    await expect(list).not.toContainText('Council Seat')
    await expect(
        page.getByRole('button', { name: 'Muster at Book Binders: place 1 favor, get 2 warbands' })
    ).toBeVisible()

    await expect(stepBacks(page)).toHaveCount(0)
    await undoButton(page).click()
    await expect(list).toHaveCount(0)
    await expect(undoButton(page)).toHaveCount(0)
    await tile(page, 'Muster').click()
    await page
        .getByRole('button', { name: 'Muster at Assassin: place 1 favor, get 2 warbands' })
        .click()
    await expect
        .poll(() => call(page, 'cardTokens', 'denizen.discord.assassin'))
        .toEqual({ favor: 1, secrets: 0 })
    await expect(list).toHaveCount(0)
})

test('scenario 19: with the warband bank empty, each Muster shows → 0 and no note, and still sends', async ({
    page
}) => {
    await openTable(page, 'musterEmptyBank')
    await tile(page, 'Muster').click()
    const list = page.getByRole('list', { name: 'Musters at your site' })
    await expect(list.getByRole('listitem')).toHaveCount(2)
    const muster = page.getByRole('button', {
        name: 'Muster at Assassin: place 1 favor, get 0 warbands'
    })
    await expect(muster).toHaveText(/^\s*1\s*→\s*0\s*$/)
    await expect(list).not.toContainText('bank')
    await muster.click()
    await expect
        .poll(() => call(page, 'cardTokens', 'denizen.discord.assassin'))
        .toEqual({ favor: 1, secrets: 0 })
})

test('card backs: another seat’s facedown Vision and the Vision in its hand show the Vision back', async ({
    page
}) => {
    await openTable(page, 'visionBacks')
    const backsOf = (label: string) =>
        page
            .getByRole('img', { name: label })
            .evaluateAll((images) =>
                images.map((image) =>
                    (image.getAttribute('src') ?? '').includes('vision') ? 'vision' : 'denizen'
                )
            )
    expect((await backsOf('A facedown adviser')).sort()).toEqual(['denizen', 'vision'])
    expect(await backsOf('A Vision in hand')).toEqual(['vision'])
    expect(await backsOf('A denizen in hand')).toEqual(['denizen'])

    await page.getByRole('button', { name: "Open ann's seat", exact: true }).click()
    expect((await backsOf('A facedown adviser')).sort()).toEqual([
        'denizen',
        'denizen',
        'vision',
        'vision'
    ])
    expect(await backsOf('A Vision in hand')).toEqual(['vision', 'vision'])
})

test('scenario 35, in a game created before the turn-flow revision: a favor bank is chosen by its suit symbol, none until a tap, ringed when picked, and the pick is what is sent', async ({
    page
}) => {
    await openTable(page, 'restBanks')
    const banks = grid(page).getByRole('button', { name: /bank, \d+ favor$/ })
    await expect(banks.first()).toBeVisible()
    await expect(grid(page).locator('select')).toHaveCount(0)
    await expect(grid(page).locator('[aria-pressed="true"]')).toHaveCount(0)
    await expect(grid(page).getByRole('button', { name: 'Use', exact: true })).toHaveCount(0)
    await expect(grid(page)).not.toContainText('Your Supply refreshes')
    await expect(grid(page)).not.toContainText('once each')
    await expect(grid(page).getByRole('button', { name: 'End Rest Phase' })).toBeVisible()

    const arcane = grid(page).getByRole('button', { name: /^Arcane bank, \d+ favor$/ })
    await arcane.click()
    await expect(arcane).toHaveAttribute('aria-pressed', 'true')
    await expect(grid(page).locator('[aria-pressed="true"]')).toHaveCount(1)

    const before = await call(page, 'tableFacts')
    await grid(page).getByRole('button', { name: 'Use', exact: true }).click()
    await expect
        .poll(async () => (await call(page, 'tableFacts')).favorOf.me)
        .toBe(before.favorOf.me + 1)
    expect((await call(page, 'tableFacts')).favorBank.arcane).toBe(before.favorBank.arcane - 1)
})

test('scenario 36: the rolled dice sit in the Campaign panel, faces and totals, for the deciding seat and a waiting one, and not on the rail', async ({
    page
}) => {
    await openTable(page, 'exileDefeated')
    const dice = grid(page).getByRole('region', { name: "the Campaign's dice" })
    await expect(dice).toBeVisible()
    await expect(dice).toContainText(/\d+ swords?/)
    await expect(dice).toContainText(/\d+ defense/)
    await expect(dice.locator('img').first()).toBeVisible()
    await expect(page.locator('.rail').getByText(/swords?$/)).toHaveCount(0)

    const watcher = await call(page, 'viewOffTheClock')
    expect(watcher).not.toBe('def')
    await expectWaitingOn(page, ['def'])
    await expect(grid(page).getByRole('region', { name: "the Campaign's dice" })).toContainText(
        /\d+ defense/
    )
})

test('the unrolled dice: while the defender uses battle plans, the dice row prints no total and the panel names the defender', async ({
    page
}) => {
    await openTable(page, 'defenderPlans')
    expect(await call(page, 'viewOffTheClock')).toBe('att')
    const dice = grid(page).getByRole('region', { name: "the Campaign's dice" })
    await expect(dice.locator('.die--unrolled').first()).toBeVisible()
    await expect(dice).not.toContainText(/waiting/i)
    await expect(dice.locator('.dice__total')).toHaveText(['', ''])
    await expectWaitingOn(page, ['def'])
})

test('the unrolled dice keep the totals’ room: on a phone the dice row does not move when the defender rolls', async ({
    page
}) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await openTable(page, 'defenderPlans')
    const row = grid(page).getByRole('region', { name: "the Campaign's dice" }).locator('.dice')
    const before = await row.boundingBox()
    await grid(page).getByRole('button', { name: 'No plans', exact: true }).click()
    await expect(row.locator('img').first()).toBeVisible()
    await expect(row).toContainText(/\d+ swords?/)
    const after = await row.boundingBox()
    expect(after?.height).toBe(before?.height)
})

test('scenario 37: the goals on the rail, tap-only, with the next win; the seat cards keep only Visions and Successor', async ({
    page
}) => {
    await openTable(page, 'goalsRail')
    const rail = page.getByRole('button', { name: 'Goals: open the enlarged view' })
    await expect(rail).toContainText('Next to win')
    await expect(rail).toContainText('is the Oathkeeper')
    await expect(rail).toContainText('Vision of Conquest')
    await expect(rail).not.toContainText('Goals')
    await expect(rail.getByRole('img', { name: 'sites ruled' })).toHaveCount(2)
    await expect(rail.getByRole('img', { name: 'relics and banners' })).toHaveCount(1)
    await expect(page.getByRole('img', { name: /^Oathkeeper of/ })).toHaveCount(0)
    await expect(page.getByRole('img', { name: 'Oathkeeper', exact: true })).toHaveCount(1)

    const goals = page.getByRole('dialog', { name: 'Goals' })
    await rail.hover()
    await page.waitForTimeout(600)
    await expect(goals).toHaveCount(0)

    await rail.click()
    await expect(goals).toBeVisible()
    await expect(goals).toContainText(
        /wins as the Oathkeeper if the end die ends the game after round 5 \(on a 6\)/
    )
    await expect(goals.locator('[aria-label="ann: 2 sites ruled"]')).toHaveCount(2)
    await expect(goals).not.toContainText('sites ruled')
    await expect(goals.getByText('not met')).toHaveCount(2)
    await page.keyboard.press('Escape')
    await expect(goals).toHaveCount(0)

    await rail.click()
    await expect(goals).toBeVisible()
    await page.mouse.click(5, 5)
    await expect(goals).toHaveCount(0)
})

test('scenario 37: under a banner Oath the Oath is held, one ringed disc and no counts', async ({
    page
}) => {
    await openTable(page, 'goalsRailDevotion')
    const rail = page.getByRole('button', { name: 'Goals: open the enlarged view' })
    await expect(rail).toContainText('The Oath of Devotion')
    await expect(rail.getByRole('img', { name: 'the Darkest Secret' })).toHaveCount(1)
    await expect(rail.locator('[aria-label="ann holds the Darkest Secret"]')).toHaveCount(1)
})

function framesInsidePanel(page: Page) {
    return page.locator('.panel').evaluate((panel) =>
        [...panel.querySelectorAll('*')]
            .filter(
                (element) => !element.closest('button, [role="button"], input, select, textarea')
            )
            .filter((element) => {
                const style = getComputedStyle(element)
                return ['top', 'right', 'bottom', 'left'].every(
                    (side) =>
                        style.getPropertyValue(`border-${side}-style`) !== 'none' &&
                        parseFloat(style.getPropertyValue(`border-${side}-width`)) > 0
                )
            })
            .map((element) => `${element.tagName.toLowerCase()}.${element.className}`)
    )
}

const FRAMED_TABLES: TableFixture.TableName[] = [
    'setup',
    'searching',
    'prophets',
    'actPhase',
    'warbandMoveAsked',
    'joinDefenceAsked',
    'exileDefeated',
    'imperialDefeated',
    'citizenshipShort',
    'citizenshipNone',
    'citizenshipEnough'
]

for (const name of FRAMED_TABLES) {
    test(`one frame per panel: inside the ${name} panel only controls are framed`, async ({
        page
    }) => {
        await openTable(page, name)
        await expect(page.locator('.panel')).toBeVisible()
        expect(await framesInsidePanel(page)).toEqual([])
    })
}

test('the fixture opens the Chancellor setup with the hand offered', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await openTable(page, 'setup')
    await expect(page.getByText('Keep one.', { exact: true })).toBeVisible()
    expect(errors).toEqual([])
})

/** The Search keeps its bar over every step, one short line under it, and hides a refused play. */
test('scenario 23: the Search bar stays over the steps with no Back; the plays share one width', async ({
    page
}) => {
    await openTable(page, 'searching')
    const bar = grid(page).locator('.bg-oath-accent-soft').first()
    await expect(bar).toHaveText('Search')
    await expect(grid(page).getByText('Keep one.', { exact: true })).toBeVisible()
    await expect(stepBacks(page)).toHaveCount(0)

    await panelCards(page).first().click()
    await expect(bar).toHaveText('Search')
    await expect(stepBacks(page)).toHaveCount(0)
    await expect(grid(page).getByText('How do you play it?', { exact: true })).toBeVisible()
    const plays = grid(page).getByRole('button', {
        name: /^(To your site(, .+)?|Adviser, faceup|Adviser, facedown|As your Vision|Play it|Discard)$/
    })
    expect(await plays.count()).toBeGreaterThan(1)
    const widths = await plays.evaluateAll((buttons) =>
        buttons.map((button) => Math.round(button.getBoundingClientRect().width))
    )
    expect(new Set(widths).size).toBe(1)
})

test('scenario 23: a Search toll names who gets the favor on the source’s button, its token no taller than the text', async ({
    page
}) => {
    await openTable(page, 'searchTollByRhys')
    await tile(page, 'Search').click()
    const pile = grid(page).getByRole('button', { name: /^Search the Cradle discard pile/ })
    await expect(pile).toBeVisible()
    await expect(pile).toContainText(/2 Supply\s*\+\s*1\s*to\s*rhys/i)
    const token = pile.getByRole('img', { name: 'favor' })
    const [tokenHeight, fontSize] = await token.evaluate((image) => [
        image.getBoundingClientRect().height,
        parseFloat(getComputedStyle(image.parentElement ?? image).fontSize)
    ])
    expect(tokenHeight).toBeLessThanOrEqual(fontSize)
})

/**
 * Each menu button's size, its list's width, and the width its words, tokens and chips take
 * inside it with the button's padding, in CSS pixels: the panel may be drawn scaled to fit.
 */
async function menuButtonSizes(page: Page, list: string) {
    return page
        .getByRole('list', { name: list })
        .getByRole('button')
        .evaluateAll((buttons) =>
            buttons.map((button) => {
                const style = getComputedStyle(button)
                const width = parseFloat(style.width)
                const scale = button.getBoundingClientRect().width / width
                const insets = [
                    'padding-left',
                    'padding-right',
                    'border-left-width',
                    'border-right-width'
                ]
                    .map((property) => parseFloat(style.getPropertyValue(property)))
                    .reduce((sum, inset) => sum + inset, 0)
                const inks: DOMRect[] = []
                const walker = document.createTreeWalker(
                    button,
                    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
                )
                for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                    // An image, or a box drawn around its words (a player's chip); the layout's own spans are neither.
                    const drawn = (element: Element) =>
                        element.childElementCount === 0 ||
                        getComputedStyle(element).backgroundColor !== 'rgba(0, 0, 0, 0)'
                    if (node instanceof Element && drawn(node)) {
                        inks.push(node.getBoundingClientRect())
                    } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
                        const range = document.createRange()
                        range.selectNodeContents(node)
                        inks.push(range.getBoundingClientRect())
                    }
                }
                const list = button.closest('[role="list"]')
                return {
                    width,
                    height: parseFloat(style.height),
                    list: list ? parseFloat(getComputedStyle(list).width) : 0,
                    content:
                        (Math.max(...inks.map((ink) => ink.right)) -
                            Math.min(...inks.map((ink) => ink.left))) /
                            scale +
                        insets
                }
            })
        )
}

/** Rule 3: on a phone a menu's buttons keep their size: the label's width, one width per menu. */
test.describe('at phone width', () => {
    test.use({ viewport: { width: 375, height: 812 } })

    for (const [table, action, list] of [
        ['searchTollByRhys', 'Search', 'Sources to search'],
        ['trade', 'Trade', 'Trades at your site']
    ] as const) {
        test(`the ${action} menu's buttons are their content's width, one width for the menu, at least 44 px tall`, async ({
            page
        }) => {
            await openTable(page, table)
            await tile(page, action).click()
            await expect(
                page.getByRole('list', { name: list }).getByRole('button').first()
            ).toBeVisible()
            const sizes = await menuButtonSizes(page, list)
            expect(sizes.length).toBeGreaterThan(1)
            expect(new Set(sizes.map((size) => size.width)).size).toBe(1)
            const width = sizes[0].width
            const standard = 8.5 * 16
            const widestContent = Math.max(...sizes.map((size) => size.content))
            for (const size of sizes) {
                expect(size.width).toBeLessThan(size.list * 0.7)
                expect(size.height).toBeGreaterThanOrEqual(44)
            }
            expect(width).toBeLessThanOrEqual(Math.max(standard, widestContent) + 1)
        })
    }

    test('the Careless Trade menu: every label fits inside its button, one width, and a row too narrow for two goes one per line', async ({
        page
    }) => {
        await openTable(page, 'careless')
        await tile(page, 'Trade').click()
        const list = 'Trades at your site'
        await expect(
            page.getByRole('button', {
                name: 'Trade with Assassin: pay 2 favor, get 0 secrets and 1 favor'
            })
        ).toHaveText(/\+\s*1/)
        const sizes = await menuButtonSizes(page, list)
        expect(sizes).toHaveLength(4)
        expect(new Set(sizes.map((size) => size.width)).size).toBe(1)
        for (const size of sizes) {
            expect(size.content).toBeLessThanOrEqual(size.width + 0.5)
            expect(size.height).toBeGreaterThanOrEqual(44)
        }
        const placed = await page
            .getByRole('list', { name: list })
            .getByRole('listitem')
            .evaluateAll((rows) =>
                rows.map((row) => {
                    const buttons = [...row.querySelectorAll('button')]
                    const edge =
                        row.getBoundingClientRect().right -
                        parseFloat(getComputedStyle(row).paddingRight)
                    return {
                        inside: buttons.every(
                            (button) =>
                                button.scrollWidth <= button.clientWidth &&
                                button.getBoundingClientRect().right <= edge + 0.5
                        ),
                        tops: buttons.map((button) =>
                            Math.round(button.getBoundingClientRect().top)
                        ),
                        sideBySide:
                            buttons.length * buttons[0].getBoundingClientRect().width <=
                            edge - row.getBoundingClientRect().left
                    }
                })
            )
        for (const row of placed) {
            expect(row.inside).toBe(true)
            if (!row.sideBySide) expect(new Set(row.tops).size).toBe(row.tops.length)
        }
    })
})

test('scenario 23: the Conspiracy takes from a player’s chip; "Play" shows with nobody picked or a prize, never a player alone', async ({
    page
}) => {
    await openTable(page, 'searchConspiracy')
    await grid(page).getByRole('button', { name: 'Conspiracy', exact: true }).click()
    await grid(page).getByRole('button', { name: 'Play it', exact: true }).click()
    await expect(
        grid(page).getByText('The Conspiracy: take a relic or banner?', { exact: true })
    ).toBeVisible()
    const play = grid(page).getByRole('button', { name: 'Play', exact: true })
    const rhys = grid(page).getByRole('button', { name: /^rhys$/i })
    await expect(grid(page).getByText('From:', { exact: true })).toBeVisible()
    await expect(rhys).toHaveAttribute('aria-pressed', 'false')
    await expect(play).toBeVisible()
    await expect(grid(page).locator('.text-oath-danger')).toHaveCount(0)

    await rhys.click()
    await expect(rhys).toHaveAttribute('aria-pressed', 'true')
    await expect(play).toHaveCount(0)
    await expect(grid(page).locator('.text-oath-danger')).toHaveCount(0)

    await grid(page).getByRole('button', { name: 'Cup of Plenty', exact: true }).click()
    await expect(play).toBeVisible()
    await rhys.click()
    await expect(rhys).toHaveAttribute('aria-pressed', 'false')
    await expect(play).toBeVisible()
})

test('scenario 23: with no one to take from, the take step says why, the name a chip, and "Play" plays it with no take', async ({
    page
}) => {
    await openTable(page, 'searchConspiracyNoTake')
    await grid(page).getByRole('button', { name: 'Conspiracy', exact: true }).click()
    await grid(page).getByRole('button', { name: 'Play it', exact: true }).click()
    await expect(
        grid(page).getByText('The Conspiracy: take a relic or banner?', { exact: true })
    ).toBeVisible()
    await expect(grid(page)).not.toContainText('From:')
    const why = grid(page).locator('.text-oath-danger')
    await expect(why).toHaveCount(1)
    await expect(why).toHaveText(/^\s*Needs 2 advisers matching\s*rhys's; you have 1\.\s*$/i)
    await expect(why.locator('span.rounded')).toHaveText(/^rhys's$/i)
    await grid(page).getByRole('button', { name: 'Play', exact: true }).click()
    await expect(
        grid(page).getByText('Tap to discard; the last goes on top.', { exact: true })
    ).toBeVisible()
})

test('the facedown Conspiracy with no one to take from: why, where the take would be, above "Play Conspiracy"', async ({
    page
}) => {
    await openTable(page, 'flipConspiracyNoTake')
    await grid(page).getByRole('button', { name: 'Adviser', exact: true }).click()
    // The one facedown adviser opens at once, large beside its plays.
    await grid(page).getByRole('button', { name: 'Play it: Conspiracy', exact: true }).click()
    const why = grid(page).locator('.text-oath-danger')
    await expect(why).toHaveCount(1)
    await expect(why).toHaveText(/^\s*Needs 2 advisers matching\s*rhys's; you have 1\.\s*$/i)
    const play = grid(page).getByRole('button', { name: 'Play Conspiracy', exact: true })
    await expect(play).toBeVisible()
    const [line, button] = [await why.boundingBox(), await play.boundingBox()]
    expect((line?.y ?? 0) < (button?.y ?? 0)).toBe(true)
    await play.click()
    await expect(play).toHaveCount(0)
})

test.describe('the Conspiracy with no one to take from, on a phone', () => {
    test.use({ viewport: { width: 402, height: 874 } })

    test('"Play" and "Play Conspiracy" under the red line are 44 px tall and sized to their words', async ({
        page
    }) => {
        await openTable(page, 'searchConspiracyNoTake')
        await grid(page).getByRole('button', { name: 'Conspiracy', exact: true }).click()
        await grid(page).getByRole('button', { name: 'Play it', exact: true }).click()
        const play = grid(page).getByRole('button', { name: 'Play', exact: true })
        const playBox = await play.boundingBox()
        expect(Math.round(playBox?.height ?? 0)).toBeGreaterThanOrEqual(44)
        expect(playBox?.width ?? 0).toBeLessThan(120)

        await openTable(page, 'flipConspiracyNoTake')
        await grid(page).getByRole('button', { name: 'Adviser', exact: true }).click()
        // The one facedown adviser opens at once, large beside its plays.
        await grid(page).getByRole('button', { name: 'Play it: Conspiracy', exact: true }).click()
        const flip = grid(page).getByRole('button', { name: 'Play Conspiracy', exact: true })
        const flipBox = await flip.boundingBox()
        expect(Math.round(flipBox?.height ?? 0)).toBeGreaterThanOrEqual(44)
        expect(flipBox?.width ?? 0).toBeLessThan(200)
    })
})

const usePower = (page: Page) =>
    grid(page).getByRole('button', { name: 'Use a power', exact: true })
const actionCard = (page: Page, cardId: string) =>
    grid(page).locator(`[data-action-card="${cardId}"]`)
/** A card offered as a row (a modifier in a menu, a battle plan): the row, and its toggle. */
const cardRow = (page: Page, cardId: string) => grid(page).locator(`[data-card-row="${cardId}"]`)
const cardToggle = (page: Page, cardId: string) =>
    cardRow(page, cardId).locator('button[aria-pressed]')

/** Each of the rows laid out at one width, the widest's, give or take a pixel. */
async function expectOneWidth(rows: Locator) {
    const widths = await rows.evaluateAll((buttons) =>
        buttons.map((button) => (button instanceof HTMLElement ? button.offsetWidth : 0))
    )
    expect(widths.length).toBeGreaterThan(1)
    expect(
        Math.max(...widths) - Math.min(...widths),
        `one width: ${widths.join(', ')}`
    ).toBeLessThanOrEqual(1)
}
const picked = (page: Page) => grid(page).locator('button[aria-pressed="true"]')
// The ring on Use a power ties it to the reason it answers.
const ringedBy = (page: Page) => grid(page).locator('.minors button[aria-describedby]')

test('scenario 55: a dimmed major no card makes possible leaves Use a power unringed, and the ring clears with the reason', async ({
    page
}) => {
    await openTable(page, 'cardsOpenTravel')
    await expect(usePower(page)).toBeVisible()
    await tile(page, 'Travel').click({ force: true })
    await expect(ringedBy(page)).toHaveCount(1)
    await tile(page, 'Search').click({ force: true })
    await expect(reasonLine(page)).toHaveText('Needs 2 Supply; you have 0.')
    await expect(ringedBy(page)).toHaveCount(0)
    await expect(usePower(page)).not.toHaveAttribute('aria-describedby')
})

test('scenario 55: pointing at the ringed Use a power keeps the reason and the ring; another tile clears both', async ({
    page
}) => {
    await openTable(page, 'cardOpensSearch')
    await tile(page, 'Search').click({ force: true })
    await expect(ringedBy(page)).toHaveCount(1)
    await usePower(page).hover()
    await expect(reasonLine(page)).toHaveText('Needs 2 Supply; you have 1.')
    await expect(ringedBy(page)).toHaveCount(1)
    await expect(usePower(page)).toHaveAccessibleDescription('Needs 2 Supply; you have 1.')
    await tile(page, 'Trade').hover()
    // Trade's summary, its tokens read by their words.
    await expect
        .poll(() =>
            reasonLine(page).evaluate((line) => {
                const words = (node: Node): string =>
                    node instanceof HTMLImageElement
                        ? node.alt
                        : node.hasChildNodes()
                          ? Array.from(node.childNodes, words).join('')
                          : (node.textContent ?? '')
                return words(line).trim()
            })
        )
        .toBe('secrets for favor, or favor for secrets.')
    await expect(ringedBy(page)).toHaveCount(0)
})

test('scenario 55: on a phone the ring on Use a power is drawn whole inside the grid', async ({
    page
}) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await openTable(page, 'cardOpensSearch')
    await tile(page, 'Search').click({ force: true })
    await expect(ringedBy(page)).toHaveCount(1)
    const chip = await usePower(page).boundingBox()
    const actions = await grid(page).locator('.actions').boundingBox()
    expect(chip).not.toBeNull()
    expect(actions).not.toBeNull()
    if (!chip || !actions) return
    expect(chip.x).toBeGreaterThanOrEqual(actions.x)
    expect(chip.x + chip.width).toBeLessThanOrEqual(actions.x + actions.width + 0.5)
    expect(chip.y + chip.height).toBeLessThanOrEqual(actions.y + actions.height + 0.5)
})

test('scenario 55: a card that makes a Search possible is found with the powers; the Search tile stays dimmed and the pile’s button sends', async ({
    page
}) => {
    await openTable(page, 'cardOpensSearch')
    await expect(tile(page, 'Search')).toHaveAttribute('aria-disabled', 'true')
    await tile(page, 'Search').click({ force: true })
    await expect(reasonLine(page)).toHaveText('Needs 2 Supply; you have 1.')
    await expect(reasonLine(page)).not.toContainText('Mushrooms')
    await expect(usePower(page)).toHaveAccessibleDescription('Needs 2 Supply; you have 1.')
    expect(await usePower(page).evaluate((chip) => getComputedStyle(chip).boxShadow)).toContain(
        'inset'
    )
    expect((await call(page, 'tableFacts')).staged).toBeUndefined()

    await expect(usePower(page)).toBeEnabled()
    await usePower(page).click()
    await expect(grid(page)).toContainText('Makes an action possible')
    const card = actionCard(page, 'denizen.beast.mushrooms')
    await expect(card).toContainText('Mushrooms — Search')
    await expect(card).not.toContainText('Spend no Supply')
    await expect(card).toContainText('on it')
    await card.getByRole('button', { name: 'Search with Mushrooms', exact: true }).click()
    expect((await call(page, 'tableFacts')).machineState).toBe('ActPhase')
    expect((await call(page, 'tableFacts')).staged).toBe('search')

    const pile = grid(page).getByRole('button', {
        name: 'Search the Cradle discard pile: spend 0 Supply, draw 1 from the bottom'
    })
    await expect(pile).toBeVisible()
    await expect(pile).not.toContainText('Mushrooms')
    await expect(grid(page).getByRole('button', { name: /^Search the world deck/ })).toHaveCount(0)
    await expect(picked(page)).toHaveCount(1)
    await picked(page).click()
    await expect(picked(page)).toHaveCount(1)
    await expect(pile).toBeVisible()

    await expect(stepBacks(page)).toHaveCount(0)
    await undoButton(page).click()
    await expect(actionCard(page, 'denizen.beast.mushrooms')).toBeVisible()
    expect((await call(page, 'tableFacts')).staged).toBe('useActionPower')

    await actionCard(page, 'denizen.beast.mushrooms')
        .getByRole('button', { name: 'Search with Mushrooms', exact: true })
        .click()
    await pile.click()
    await expect(page.getByText('Keep one.', { exact: true })).toBeVisible()
    const facts = await call(page, 'tableFacts')
    expect(facts.machineState).toBe('Searching')
    expect(facts.secretsOn['denizen.beast.mushrooms']).toBe(1)
    await expect(page.locator('.discard').first()).toContainText('1')
})

test('scenario 56: two cards that make a Travel possible are two rows; one says it ends the Act Phase, and each opens the destinations it reaches', async ({
    page
}) => {
    await openTable(page, 'cardsOpenTravel')
    await tile(page, 'Travel').click({ force: true })
    await expect(reasonLine(page)).not.toContainText('Tents')
    await expect(reasonLine(page)).not.toContainText('Special Envoy')
    await expect(ringedBy(page)).toHaveCount(1)
    await expect(usePower(page)).toHaveAccessibleDescription(await reasonLine(page).innerText())

    await usePower(page).click()
    const tents = actionCard(page, 'denizen.nomad.tents')
    const envoy = actionCard(page, 'denizen.nomad.special-envoy')
    await expect(envoy).toContainText('ends your Act Phase')
    await expect(tents).not.toContainText('ends your Act Phase')

    await tents.getByRole('button', { name: 'Travel with Tents', exact: true }).click()
    await expect(travelPrompt(page)).toBeVisible()
    const withTents = await litSlots(page)
    expect(withTents.length).toBeGreaterThan(0)
    expect(withTents.every((slotId) => slotId.startsWith('slot.cradle.'))).toBe(true)
    for (const slotId of withTents) {
        await expect(siteAt(page, slotId).locator('.travel-cost')).toHaveText('0 Supply')
    }
    await expect(stepBacks(page)).toHaveCount(0)
    await undoButton(page).click()

    await actionCard(page, 'denizen.nomad.special-envoy')
        .getByRole('button', { name: 'Travel with Special Envoy', exact: true })
        .click()
    await expect(travelPrompt(page)).toBeVisible()
    const withEnvoy = await litSlots(page)
    expect(withEnvoy.some((slotId) => slotId.startsWith('slot.provinces.'))).toBe(true)
    expect(withEnvoy.some((slotId) => slotId.startsWith('slot.hinterland.'))).toBe(true)
    const [free] = withEnvoy.filter((slotId) => slotId.startsWith('slot.cradle.'))
    if (free === undefined) throw Error('A Cradle site is lit')
    await expect(siteAt(page, free).locator('.travel-cost')).toHaveText('0 Supply')
    await siteCard(page, free).click()
    await expect
        .poll(async () => (await call(page, 'tableFacts')).siteOf.me)
        .not.toBe('slot.cradle.0')
    const facts = await call(page, 'tableFacts')
    expect(facts.siteOf.me).not.toBe('slot.cradle.0')
    expect(facts.machineState).not.toBe('ActPhase')
})

test('scenario 57: with the Search open, the card is found with the powers and inside the Search menu, and can be put down', async ({
    page
}) => {
    await openTable(page, 'cardChangesSearch')
    await expect(tile(page, 'Search')).toHaveAttribute('aria-disabled', 'false')
    await usePower(page).click()
    await expect(grid(page)).toContainText('Changes an action')
    await actionCard(page, 'denizen.beast.mushrooms')
        .getByRole('button', { name: 'Search with Mushrooms', exact: true })
        .click()
    const free = grid(page).getByRole('button', {
        name: 'Search the Cradle discard pile: spend 0 Supply, draw 1 from the bottom'
    })
    const paid = grid(page).getByRole('button', {
        name: 'Search the Cradle discard pile: spend 2 Supply, draw 3'
    })
    const deck = grid(page).getByRole('button', {
        name: 'Search the world deck: spend 2 Supply, draw 3'
    })
    await expect(free).toBeVisible()
    // R-7.4 — Mushrooms fits the discard pile alone; the world deck is listed and sent without it.
    await expect(deck).toBeVisible()
    await expect(paid).toHaveCount(0)

    await picked(page).click()
    await expect(picked(page)).toHaveCount(0)
    await expect(paid).toBeVisible()
    await expect(deck).toBeVisible()

    await openTable(page, 'cardChangesSearch')
    await tile(page, 'Search').click()
    await expect(paid).toBeVisible()
    await expect(deck).toBeVisible()
    await grid(page)
        .getByRole('button', { name: /^Mushrooms/ })
        .click()
    await expect(free).toBeVisible()
    await expect(free).not.toContainText('Mushrooms')
    await expect(deck).toBeVisible()
})

test('scenario 58: a Vision drawn and the title changing hands are framed History rows; the drawer sees the Vision, another seat its back', async ({
    page
}) => {
    await openTable(page, 'majorEvents')
    await page.getByRole('tab', { name: 'History' }).click()

    const drawn = page.locator('[data-major-event="visionDrawn"]')
    await expect(drawn).toBeVisible()
    await expect(drawn).toContainText('Vision drawn')
    await expect(drawn).toContainText('the draw stopped on a Vision')
    await expect(drawn).toContainText('Search cost up: the world deck now costs 3 Supply')
    await expect(drawn.getByRole('img', { name: 'Conquest' })).toBeVisible()

    const title = page.locator('[data-major-event="oathkeeper"]')
    await expect(title).toBeVisible()
    await expect(title).toContainText('took the Oathkeeper title from')
    await expect(title.getByRole('img', { name: 'the Oathkeeper title' })).toBeVisible()
    await expect(page.locator('.history').getByText('The game was started')).toBeVisible()

    const other = await call(page, 'viewOffTheClock')
    expect(other).toBe('ann')
    await expect(drawn.getByRole('img', { name: 'a Vision, facedown' })).toBeVisible()
    await expect(drawn.getByRole('img', { name: 'Conquest' })).toHaveCount(0)
})

/** A History row's seat chips, the actor's first, read as the words they show. */
async function rowChips(page: Page, hasText: string): Promise<string[]> {
    const row = page.locator('.history p').filter({ hasText })
    await expect(row).toHaveCount(1)
    return row.locator('span[style*="background-color"]').allInnerTexts()
}

test('scenario 63: a seat named inside a History line is its colour chip, for every reader; the reader’s own chip reads “you”', async ({
    page
}) => {
    const asked = await openTable(page, 'joinDefenceAsked')
    expect(asked.seatId).toBe('cit')
    await page.getByRole('tab', { name: 'History' }).click()
    const campaign = 'campaigned against'
    expect(await rowChips(page, campaign)).toEqual(['Att', 'Chan'])
    await expect(page.locator('.history p').filter({ hasText: campaign })).toContainText(
        'campaigned against chan for their pawn and'
    )

    expect(await call(page, 'viewOffTheClock')).toBe('att')
    expect(await rowChips(page, campaign)).toEqual(['You', 'Chan'])

    const defeated = await openTable(page, 'exileDefeated')
    expect(defeated.seatId).toBe('def')
    await page.getByRole('tab', { name: 'History' }).click()
    const sacrificed = page.locator('.history p').filter({ hasText: 'sacrificed' })
    expect(await rowChips(page, 'sacrificed')).toEqual(['Att', 'you'])
    await expect(sacrificed).toContainText("you pick the defense's losses")

    expect(await call(page, 'viewOffTheClock')).toBe('att')
    expect(await rowChips(page, 'sacrificed')).toEqual(['You', 'Def'])
    await expect(sacrificed).toContainText("def picks the defense's losses")
})

/**
 * R-5.5.4-H1 — while the defender may reroll the defense, the attack waits: its dice not rolled, with
 * no total. History's Campaign row says the dice brought; the answer's row carries the roll, the lost
 * warband as its token and the skull as its symbol.
 */
test.describe('the attack held for the defender’s Jinx', () => {
    const dice = (page: Page) => page.getByRole('region', { name: "the Campaign's dice" })
    const historyRow = (page: Page, hasText: string) =>
        page.locator('.history p').filter({ hasText })

    async function heldPanel(page: Page) {
        const asked = await openTable(page, 'heldAttack')
        expect(asked.seatId).toBe('Bea')
        await expect(dice(page).locator('.die--unrolled.die--attack')).toHaveCount(4)
        await expect(dice(page).locator('.die img')).toHaveCount(3)
        await expect(dice(page)).toContainText('6 defense')
        await expect(dice(page)).not.toContainText('sword')
        await expect(answer(page, 'Keep')).toBeVisible()
    }

    test('while Bea decides, the attack is 4 not-rolled dice and no total; the Campaign row says the dice brought', async ({
        page
    }) => {
        await heldPanel(page)
        await page.getByRole('tab', { name: 'History' }).click()
        const campaign = historyRow(page, 'campaigned against')
        await expect(campaign).toContainText('; 4 attack dice against 6 defense')
        await expect(campaign).not.toContainText('swords')
    })

    test('kept: the dice as today; Bea’s row carries the swords and the loss, the warband and skull drawn', async ({
        page
    }) => {
        await openTable(page, 'heldAttackKept')
        await expect(dice(page).locator('.die--unrolled')).toHaveCount(0)
        await expect(dice(page).locator('.die img')).toHaveCount(7)
        await expect(dice(page)).toContainText('4 swords')
        await page.getByRole('tab', { name: 'History' }).click()
        const kept = historyRow(page, 'kept the roll')
        await expect(kept).toContainText('Jinx: kept the roll. 4 swords against 6 defense;')
        await expect(kept).toContainText('lost 1')
        await expect(kept.locator('img[alt="warband"]')).toHaveCount(1)
        await expect(kept.locator('img[alt="skull"]')).toHaveCount(1)
        await expect(kept).not.toContainText('skull')
        expect(await rowChips(page, 'kept the roll')).toEqual(['Bea', 'you'])
        await expect(historyRow(page, 'campaigned against')).toContainText(
            '; 4 attack dice against 6 defense'
        )
    })

    test('rerolled: Bea’s row adds the attack against the new defense, and no skull', async ({
        page
    }) => {
        await openTable(page, 'heldAttackRerolled')
        await expect(dice(page)).toContainText('2 swords')
        await expect(dice(page)).toContainText('7 defense')
        await page.getByRole('tab', { name: 'History' }).click()
        const rerolled = historyRow(page, 'rerolled the defense')
        await expect(rerolled).toContainText(
            'Jinx: rerolled the defense — 7 defense. 2 swords against 7 defense'
        )
        await expect(rerolled.locator('img[alt="skull"]')).toHaveCount(0)
    })

    test.describe('on a phone', () => {
        test.use({ viewport: { width: 375, height: 812 } })

        test('the not-rolled dice fit the width; the History row with its symbols wraps', async ({
            page
        }) => {
            await heldPanel(page)
            const box = await dice(page).boundingBox()
            expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375)

            await openTable(page, 'heldAttackKept')
            await page.getByRole('tab', { name: 'History' }).click()
            const kept = historyRow(page, 'kept the roll')
            await expect(kept.locator('img[alt="skull"]')).toBeVisible()
            const row = await kept.boundingBox()
            expect((row?.x ?? 0) + (row?.width ?? 0)).toBeLessThanOrEqual(375)
        })
    })
})

/** Scenario 65: the History says what each row did from its record, a card's part as what happened then the card. */
test.describe('scenario 65: the History’s words', () => {
    const history = (page: Page) => page.locator('.history')

    test('an Act Phase: the tolls paid, then their card; the Drum’s gain; a facedown play; Careless’s favor; the banner’s price', async ({
        page
    }) => {
        await openTable(page, 'historyAct')
        await page.getByRole('tab', { name: 'History' }).click()
        await expect(history(page)).toContainText(
            'traveled to Great Slum, spending 2 Supply; paid rhys 1 (Toll Roads); gained 1 (Dragonskin Drum)'
        )
        expect(await rowChips(page, 'traveled to')).toEqual(['Dana', 'Rhys'])
        await expect(history(page)).toContainText(
            'searched the world deck, spending 2 Supply; paid rhys 1 (Forced Labor)'
        )
        await expect(history(page)).toContainText(
            'kept a card and played it as an adviser, facedown'
        )
        await expect(history(page)).toContainText(
            'traded at Tavern Songs for 0, spending 1 Supply; gained 1 (Careless)'
        )
        await expect(history(page)).toContainText('mustered 2 at Council Seat, spending 1 Supply')
        await expect(history(page)).toContainText('recovered the People’s Favor for 3')
        await expect(history(page)).not.toContainText(/travelled|defence| — /)
    })

    test('a Campaign: its cost, plans and dice; the defense’s losses picked by a chip; the spoils step by step; "against <chip>"', async ({
        page
    }) => {
        await openTable(page, 'historyCampaign')
        await page.getByRole('tab', { name: 'History' }).click()
        await expect(history(page)).toContainText(
            'spending 2 Supply, using Field Promotion; 6 attack dice against 4 defense dice'
        )
        await expect(history(page)).toContainText(
            'used no battle plans; 5 swords against 4 defense'
        )
        await expect(history(page)).toContainText(
            "sacrificed 1 and won the battle; rhys picks the defense's losses"
        )
        await expect(history(page)).toContainText("picked the defense's losses: 2 killed")
        await expect(history(page)).toContainText(
            'took the spoils: placed 2 at Plains; seized the People’s Favor, burning 2 from it; banished rhys to Salt Flats; burned 3 from rhys; gained 3 (Field Promotion)'
        )
        expect(await rowChips(page, 'took the spoils')).toEqual(['Dana', 'Rhys', 'Rhys'])
        const won = page.locator('[data-major-event="campaignWon"]')
        await expect(won).toContainText('against rhys')
        await expect(won.locator('.text-xs span[style*="background-color"]').first()).toHaveText(
            /rhys/i
        )
    })

    test('deals and the rest: the offer’s terms on its row, the Wood’s pick as the traveller’s Travel, False Prophet, a short bank', async ({
        page
    }) => {
        await openTable(page, 'historyDeals')
        await page.getByRole('tab', { name: 'History' }).click()
        await expect(history(page)).toContainText(
            'used Deed Writer: offered you 2 for Plains (2 move in)'
        )
        expect(await rowChips(page, 'used Deed Writer')).toEqual(['Dana', 'you'])
        await expect(history(page)).toContainText("Deed Writer: accepted dana's exchange")
        await expect(history(page)).toContainText(
            "traveled from Shrouded Wood to The Hidden Place (rhys's pick), spending 2 Supply"
        )
        await expect(history(page)).toContainText(
            'offered dana Citizenship, the relic on Reliquary space 2 and 2, for 1'
        )
        await expect(history(page)).toContainText(
            'False Prophet: 1 on Vision of Faith died; played it as an adviser, facedown'
        )
        await expect(history(page)).toContainText(
            'started at Salt Flats and kept a card facedown, discarding 2 to the Cradle pile; placed 4: Salt Flats 2, Mine 2'
        )
    })
})

const sinceLastTurn = (page: Page) => page.getByRole('dialog', { name: 'Since your last turn' })

test('scenario 59: the seat’s turn opens on one card of what changed since its last, oldest first and Next to win last; Escape and the pig clear it for the turn', async ({
    page
}) => {
    await openTable(page, 'sinceLastTurn')
    const card = sinceLastTurn(page)
    await expect(card).toBeVisible()
    const rows = card.getByRole('listitem')
    await expect(rows).toHaveCount(5)
    await expect(rows.nth(0)).toContainText('bea has seen a Vision')
    await expect(rows.nth(0)).toContainText('World-deck Search · the Search now costs 3 Supply')
    await expect(rows.nth(1)).toContainText('bea became a Citizen')
    await expect(rows.nth(1)).toContainText("Accepted dana's offer")
    await expect(rows.nth(2)).toContainText('rhys took the People’s Favor from dana')
    await expect(rows.nth(2)).toContainText('Seized in a Campaign · now on its Mob side')
    await expect(rows.nth(3)).toContainText('rhys took the Oathkeeper title from dana')
    await expect(rows.nth(3)).toContainText('Holds the People’s Favor')
    await expect(rows.nth(4)).toContainText('Next to win')
    await expect(rows.nth(4)).toContainText(
        'rhys becomes the Usurper at their next Wake and wins at the one after'
    )
    await expect(rows.nth(4)).toContainText(
        'Before: dana, as the Oathkeeper, if the end die ended the game after round 5'
    )
    await expect(card.getByRole('img', { name: 'the People’s Favor, Mob side' })).toBeVisible()
    await expect(card.getByRole('img', { name: 'the Oathkeeper title' })).toBeVisible()
    await expect(card.getByRole('img', { name: 'a Citizen' })).toBeVisible()
    expect(await card.evaluate((element) => element.querySelectorAll('[title]').length)).toBe(0)

    // The turn bar and the action panel stay clear and usable.
    const cardBox = await card.boundingBox()
    for (const above of [page.locator('.info').first(), grid(page)]) {
        const box = await above.boundingBox()
        expect(box && cardBox && box.y + box.height <= cardBox.y).toBe(true)
    }
    await tile(page, 'Travel').click()
    await expect(page.getByText('Tap a lit site.', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Undo' }).click()

    // Rule 7: an open seat closes first; an Escape typed in the chat leaves the card.
    await page.getByRole('button', { name: /you/ }).first().click()
    const seat = page.getByRole('dialog', { name: /seat$/ })
    await expect(seat).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(seat).toHaveCount(0)
    await expect(card).toBeVisible()
    await page.getByRole('tab', { name: 'Chat' }).click()
    await page.locator('textarea').dispatchEvent('keydown', { key: 'Escape' })
    await expect(card).toBeVisible()
    await page.getByRole('tab', { name: 'Players' }).click()
    await page.keyboard.press('Escape')
    await expect(card).toHaveCount(0)

    // Cleared for this turn and remembered: reopening shows nothing until the seat's next turn.
    await call(page, 'open', 'sinceLastTurn')
    await expect(card).toHaveCount(0)
})

test('scenario 59: the pig clears the card; another seat, whose turn it is not, is told nothing; no turn of the seat’s closed yet, no card', async ({
    page
}) => {
    await openTable(page, 'sinceLastTurn')
    const card = sinceLastTurn(page)
    await card.getByRole('button', { name: 'The pig foresaw this: clear' }).click()
    await expect(card).toHaveCount(0)

    await call(page, 'open', 'sinceLastTurn')
    expect(await call(page, 'viewOffTheClock')).not.toBe('ann')
    await expect(card).toHaveCount(0)

    await openTable(page, 'actPhase')
    await expect(page.locator('.panel')).toBeVisible()
    await expect(card).toHaveCount(0)
})

test('scenario 59: another seat’s Vision is its back alone, though the record holds which Vision it was (R-9.4)', async ({
    page
}) => {
    await openTable(page, 'sinceLastTurn')
    const vision = sinceLastTurn(page).getByRole('listitem').first()
    const back = vision.getByRole('img')
    await expect(back).toHaveCount(1)
    await expect(back).toHaveAccessibleName('a Vision, facedown')
    expect(await back.getAttribute('src')).toMatch(/vision/)
    expect(await back.getAttribute('src')).not.toMatch(/conquest/)
    await expect(sinceLastTurn(page)).not.toContainText('Conquest')
})

for (const viewport of [
    { width: 1280, height: 800 },
    { width: 402, height: 874 },
    { width: 375, height: 812 }
]) {
    test(`scenario 59 at ${viewport.width} by ${viewport.height}: the card sits on the board, nothing overflows, the pig is 44 px tall and stays in view while long rows scroll`, async ({
        page
    }) => {
        await page.setViewportSize(viewport)
        for (const table of ['sinceLastTurn', 'sinceLastTurnLong'] as const) {
            await openTable(page, table)
            const card = sinceLastTurn(page)
            await expect(card).toBeVisible()
            const fit = await card.evaluate((element) => {
                const box = element.getBoundingClientRect()
                const board = element.parentElement?.getBoundingClientRect()
                const pig = element.querySelector('.since-last-turn__pig')?.getBoundingClientRect()
                const list = element.querySelector('.since-last-turn__rows')
                const overflowing = [
                    ...element.querySelectorAll('.since-last-turn__text, .since-last-turn__pig')
                ]
                    .filter((part) => part.scrollWidth > part.clientWidth + 1)
                    .map((part) => part.textContent)
                return {
                    width: box.width,
                    inBoard:
                        board !== undefined &&
                        box.left >= board.left &&
                        box.right <= board.right &&
                        box.top >= board.top &&
                        box.bottom <= board.bottom,
                    pig: pig && {
                        height: pig.height,
                        inCard: pig.top >= box.top && pig.bottom <= box.bottom,
                        onScreen: pig.bottom <= innerHeight
                    },
                    scrolls: list !== null && list.scrollHeight > list.clientHeight,
                    overflowing,
                    pageScrolls: document.documentElement.scrollWidth > innerWidth
                }
            })
            expect(fit.inBoard).toBe(true)
            expect(fit.width).toBeLessThanOrEqual(viewport.width > 639 ? 420 : 338)
            expect(fit.pig?.height).toBeGreaterThanOrEqual(44)
            expect(fit.pig?.inCard).toBe(true)
            expect(fit.pig?.onScreen).toBe(true)
            expect(fit.overflowing).toEqual([])
            expect(fit.pageScrolls).toBe(false)
            if (table === 'sinceLastTurnLong') {
                await expect(card.getByRole('listitem')).toHaveCount(9)
                if (viewport.width < 640) expect(fit.scrolls).toBe(true)
            }
            await page.keyboard.press('Escape')
            await expect(card).toHaveCount(0)
        }
    })
}

test('scenario 35: at Rest a row is the card and its buttons, one width; a tap on a bank uses the power; an empty bank is tapped for its 0; a used power is not listed', async ({
    page
}) => {
    await openTable(page, 'restTurnFlow')
    const powers = page.getByRole('list', { name: 'Rest powers' })
    await expect(powers).toBeVisible()
    await expect(grid(page)).not.toContainText('Your Supply has refreshed')
    await expect(grid(page)).not.toContainText('in bank')
    await expect(grid(page)).not.toContainText('take 1 favor from any bank')
    const banks = powers.getByRole('button', { name: /bank: take 1 favor/ })
    await expect(banks).toHaveCount(5)
    await expect(
        powers.getByRole('button', { name: 'Discord bank: take 0 favor, 0 in bank' })
    ).toBeEnabled()
    await expect(powers.getByRole('listitem')).toHaveCount(2)
    await expect(powers).toContainText('Vow of Obedience')
    await expect(powers).toContainText('Insomnia')
    const sizes = await powers
        .locator('.rest-button')
        .evaluateAll((buttons) =>
            buttons.map(
                (button) =>
                    `${Math.round(button.getBoundingClientRect().width)}x${Math.round(button.getBoundingClientRect().height)}`
            )
        )
    expect(sizes).toHaveLength(7)
    expect(new Set(sizes).size).toBe(1)
    expect(sizes[0]).toMatch(/x48$/)
    await expect(grid(page).getByRole('button', { name: 'End Rest Phase' })).toBeVisible()

    const before = await call(page, 'tableFacts')
    await powers.getByRole('button', { name: /^Arcane bank/ }).click()
    await expect
        .poll(async () => (await call(page, 'tableFacts')).favorOf.me)
        .toBe(before.favorOf.me + 1)
    expect((await call(page, 'tableFacts')).favorBank.arcane).toBe(before.favorBank.arcane - 1)
    await expect(powers.getByRole('listitem')).toHaveCount(1)
    await expect(powers).not.toContainText('Vow of Obedience')
    await expect(powers.getByRole('button', { name: /bank: take/ })).toHaveCount(0)
    await expect(
        powers
            .getByRole('listitem')
            .filter({ hasText: 'Insomnia' })
            .getByRole('button', { name: /^1/ })
    ).toBeEnabled()
})

test('scenario 35: at Rest a tap on the empty bank uses the power and takes 0 (R-9.3)', async ({
    page
}) => {
    await openTable(page, 'restTurnFlow')
    const powers = page.getByRole('list', { name: 'Rest powers' })
    const before = await call(page, 'tableFacts')
    await powers.getByRole('button', { name: /^Discord bank/ }).click()
    await expect(powers).not.toContainText('Vow of Obedience')
    const after = await call(page, 'tableFacts')
    expect(after.favorOf.me).toBe(before.favorOf.me)
    expect(after.favorBank).toEqual(before.favorBank)
    await expect(powers).toContainText('Insomnia')
})

/** The Wake (R-4.1): one choice at a time; every tap acts, and the last one sends the Wake. */
test.describe('the Wake', () => {
    const choices = (page: Page) => grid(page).getByRole('group', { name: 'Wake choices' })
    const choice = (page: Page, name: string) =>
        choices(page).getByRole('button', { name, exact: true })

    test('on the Mob side the People’s Favor asks twice, each pick a line above; Return to tied banks acts on the bank; the site’s take sends the Wake', async ({
        page
    }) => {
        await openTable(page, 'wakeMob')
        await expect(grid(page)).toContainText('People’s Favor (1 of 2)')
        await expect(grid(page)).not.toContainText('Wake Phase')
        await expect(
            grid(page).getByRole('button', { name: /Resolve the Wake|End Wake Phase/ })
        ).toHaveCount(0)
        await expect(grid(page).locator('[aria-pressed="true"]')).toHaveCount(0)
        const widths = await choices(page)
            .getByRole('button')
            .evaluateAll((buttons) =>
                buttons.map((button) => Math.round(button.getBoundingClientRect().width))
            )
        expect(widths).toHaveLength(2)
        expect(new Set(widths).size).toBe(1)

        await choice(page, 'Place a favor').click()
        await expect(grid(page)).toContainText('People’s Favor (2 of 2)')
        await expect(grid(page)).toContainText('Placed 1')
        expect((await call(page, 'tableFacts')).machineState).toBe('WakePhase')

        await choice(page, 'Return a favor').click()
        await expect(choices(page).getByRole('button', { name: /bank, 1 favor$/ })).toHaveCount(2)
        await choices(page)
            .getByRole('button', { name: /^Order bank/ })
            .click()
        await expect(grid(page)).toContainText('Drowned City')
        await expect(grid(page)).toContainText('Returned 1')
        await expect(choice(page, 'Take a favor')).toHaveCount(0)
        await expect(choice(page, 'Take nothing')).toBeVisible()
        expect((await call(page, 'tableFacts')).machineState).toBe('WakePhase')

        const before = await call(page, 'tableFacts')
        await choice(page, 'Take a secret').click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).machineState)
            .toBe('ActPhase')
        const after = await call(page, 'tableFacts')
        expect(after.favorOf.me).toBe(before.favorOf.me - 1)
        expect(after.favorBank.order).toBe(before.favorBank.order + 1)
        expect(await call(page, 'cardTokens', 'site.drowned-city')).toEqual({
            favor: 0,
            secrets: 0
        })

        await page.getByRole('tab', { name: 'History' }).click()
        const row = page.locator('.history').getByText(/began the turn; placed 1/)
        await expect(row).toBeVisible()
        await expect(row).toContainText('on the People’s Favor; returned 1')
        await expect(row).toContainText('from their site')
    })

    test('Undo before the send takes back the last pick and sends nothing', async ({ page }) => {
        await openTable(page, 'wakeMob')
        await choice(page, 'Place a favor').click()
        await expect(grid(page)).toContainText('People’s Favor (2 of 2)')
        await page.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(grid(page)).toContainText('People’s Favor (1 of 2)')
        await expect(grid(page)).not.toContainText('Placed 1')
        expect((await call(page, 'tableFacts')).machineState).toBe('WakePhase')
    })

    test('at the site alone, Take nothing sends the Wake and takes nothing', async ({ page }) => {
        await openTable(page, 'wakeSite')
        await expect(grid(page)).toContainText('Drowned City')
        await expect(grid(page)).not.toContainText('People’s Favor')
        await choice(page, 'Take nothing').click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).machineState)
            .toBe('ActPhase')
        expect(await call(page, 'cardTokens', 'site.drowned-city')).toEqual({
            favor: 0,
            secrets: 1
        })
    })

    test('with nothing to choose, End Wake Phase stands alone under the forced step’s line, and sends it', async ({
        page
    }) => {
        await openTable(page, 'wakeForced')
        await expect(choices(page)).toHaveCount(0)
        await expect(grid(page)).toContainText('Placed 1')
        const before = await call(page, 'tableFacts')
        await grid(page).getByRole('button', { name: 'End Wake Phase' }).click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).machineState)
            .toBe('ActPhase')
        expect((await call(page, 'tableFacts')).favorOf.me).toBe(before.favorOf.me - 1)
    })

    // R-4.1.1-H1: step 2 is judged on the banks as step 1's Return leaves them, and its badges count them so.
    async function returnTwice(page: Page) {
        await choice(page, 'Return a favor').click()
        await expect(grid(page)).toContainText('People’s Favor (2 of 2)')
        await expect(grid(page)).toContainText('Returned 1')
        await choice(page, 'Return a favor').click()
        const banks = choices(page).getByRole('button', { name: /bank, \d+ favor$/ })
        await expect(banks).toHaveCount(3)
        expect(
            await banks.evaluateAll((buttons) =>
                buttons.map((button) => button.getAttribute('aria-label'))
            )
        ).toEqual(['Discord bank, 1 favor', 'Arcane bank, 1 favor', 'Order bank, 1 favor'])
        await expect(banks.locator('.bank-empty')).toHaveCount(0)
        return banks
    }

    test('step 2’s banks count the favor step 1 returned, as the table will hold it', async ({
        page
    }) => {
        await openTable(page, 'wakeMobReturn')
        expect((await call(page, 'tableFacts')).favorBank.order).toBe(0)
        await returnTwice(page)
        expect((await call(page, 'tableFacts')).favorBank.order).toBe(0)
        await choices(page)
            .getByRole('button', { name: /^Order bank/ })
            .click()
        await choice(page, 'Take nothing').click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).machineState)
            .toBe('ActPhase')
        expect((await call(page, 'tableFacts')).favorBank.order).toBe(2)
    })

    test.describe('on a phone', () => {
        test.use({ viewport: { width: 375, height: 812 } })

        test('step 2’s banks count the favor step 1 returned, each 44 px square', async ({
            page
        }) => {
            await openTable(page, 'wakeMobReturn')
            const banks = await returnTwice(page)
            for (const box of await banks.evaluateAll((buttons) =>
                buttons
                    .map((button) => button.getBoundingClientRect())
                    .map((box) => ({ width: box.width, height: box.height }))
            )) {
                expect(box.width).toBeGreaterThanOrEqual(44)
                expect(box.height).toBeGreaterThanOrEqual(44)
            }
        })

        test('the choices keep one width, at least 44 px tall, never stretched across the panel', async ({
            page
        }) => {
            await openTable(page, 'wakeSite')
            const boxes = await choices(page)
                .getByRole('button')
                .evaluateAll((buttons) =>
                    buttons
                        .map((button) => button.getBoundingClientRect())
                        .map((box) => ({ width: Math.round(box.width), height: box.height }))
                )
            expect(boxes).toHaveLength(2)
            expect(new Set(boxes.map((box) => box.width)).size).toBe(1)
            for (const box of boxes) expect(box.height).toBeGreaterThanOrEqual(44)
            const panel = await grid(page).boundingBox()
            expect(boxes[0].width).toBeLessThan((panel?.width ?? 0) / 2)
        })
    })
})

/** Every other bank picker, and Salad Days played as an adviser, is judged on the table's banks, so its badges count those. */
test('a bank picker outside the Wake counts each bank as the table holds it: the Rest, a question, Recover, a When Played bank, Salad Days as an adviser', async ({
    page
}) => {
    async function badgesReadTheTable(scene: string) {
        const banks = grid(page).getByRole('button', { name: / bank, \d+ favor$/ })
        await expect(banks.first()).toBeVisible()
        const table = new Map(Object.entries((await call(page, 'tableFacts')).favorBank))
        const shown = await banks.evaluateAll((buttons) =>
            buttons.map((button) => button.getAttribute('aria-label') ?? '')
        )
        const expected = shown.map((label) => {
            const suit = label.split(' ')[0]
            return `${suit} bank, ${table.get(suit.toLowerCase())} favor`
        })
        expect(shown, scene).toEqual(expected)
    }
    await openTable(page, 'restBanks')
    await badgesReadTheTable('Rest')
    await openTable(page, 'askHerald')
    await badgesReadTheTable('Herald')
    await openTable(page, 'recover')
    await tile(page, 'Recover').click()
    await page.getByRole('button', { name: /^Recover the People’s Favor: pay/ }).click()
    await badgesReadTheTable('Recover')
    await openTable(page, 'fabledFeast')
    await grid(page).getByRole('button', { name: 'Fabled Feast', exact: true }).click()
    await grid(page).getByRole('button', { name: 'Adviser, faceup', exact: true }).click()
    await badgesReadTheTable('Fabled Feast')
    await openTable(page, 'pickerSalad')
    await grid(page).getByRole('button', { name: 'Salad Days' }).first().click()
    await grid(page)
        .getByRole('button', { name: /adviser/i })
        .first()
        .click()
    await badgesReadTheTable('Salad Days')
})

test('scenario 60: between rounds the Chancellor rolls the end die; the last seat’s Undo stays until the roll; each seat reads the stakes', async ({
    page
}) => {
    await openTable(page, 'endOfRound')
    const info = page.locator('.info')
    await expect(info).toContainText('Your roll')
    await expect(info).toContainText('End of round 6')
    await expect(grid(page).getByRole('heading', { name: 'End die', exact: true })).toBeVisible()
    await expect(grid(page)).not.toContainText('of 8')
    await expect(grid(page)).not.toContainText('The Empire holds')
    await expect(grid(page)).toContainText(
        'A 5 or higher ends the game: you win as the Chancellor.'
    )
    await expect(grid(page)).not.toContainText("can't be undone")

    expect(await call(page, 'viewOffTheClock')).toBe('dev')
    await expect(info).toContainText("'s roll")
    await expect(grid(page).getByRole('heading', { name: 'End die', exact: true })).toBeVisible()
    await expectWaitingOn(page, ['ann'])
    await expect(grid(page)).toContainText('A 5 or higher ends the game:')
    await expect(grid(page).getByRole('button', { name: 'Roll the end die' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible()

    await openTable(page, 'endOfRound')
    await grid(page).getByRole('button', { name: 'Roll the end die' }).click()
    await expect(
        page.locator('.board-rail').getByRole('region', { name: 'End die', exact: true })
    ).toHaveCount(0)
    await page.getByRole('tab', { name: 'History' }).click()
    await expect(page.locator('[data-major-event="endDie"]')).toContainText('rolled the end die:')
    await expect(page.locator('[data-major-event="endDie"]')).toContainText('end of round 6')
    expect(await call(page, 'viewOffTheClock')).toBe('dev')
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0)
})

/** The roll button is as wide as its label, on a desktop and on a phone, and a phone tap's height. */
for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 }
]) {
    test(`scenario 60: "Roll the end die" fits its label at ${viewport.width}`, async ({
        page
    }) => {
        await page.setViewportSize(viewport)
        await openTable(page, 'endOfRound')
        const roll = grid(page).getByRole('button', { name: 'Roll the end die', exact: true })
        await expect(roll).toBeVisible()
        const { width, height, room } = await roll.evaluate((button) => ({
            width: button instanceof HTMLElement ? button.offsetWidth : 0,
            height: button instanceof HTMLElement ? button.offsetHeight : 0,
            room: button.parentElement?.clientWidth ?? 0
        }))
        expect(width).toBeLessThan(room / 2)
        if (viewport.width < 640) expect(height).toBeGreaterThanOrEqual(44)
    })
}

/** The end die is told by its panel, "Next to win" and the History; the rail keeps only the goals and the banners. */
for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 }
]) {
    test(`scenario 60: the rail has no End die box while the die is live or after the roll, at ${viewport.width}`, async ({
        page
    }) => {
        await page.setViewportSize(viewport)
        await openTable(page, 'endOfRound')
        const rail = page.locator('.board-rail')
        const railPieces = rail.locator('.rail > *')
        await expect(
            grid(page).getByRole('heading', { name: 'End die', exact: true })
        ).toBeVisible()
        await expect(rail.locator('.next')).toContainText(
            'if the end die ends the game after round 6'
        )
        await expect(rail.getByRole('region', { name: 'End die', exact: true })).toHaveCount(0)
        await expect(rail.getByText('End die', { exact: true })).toHaveCount(0)
        await expect(railPieces).toHaveCount(2)
        await expect(railPieces.last()).toContainText('Unclaimed')

        await grid(page).getByRole('button', { name: 'Roll the end die' }).click()
        await page.getByRole('tab', { name: 'History' }).click()
        await expect(page.locator('[data-major-event="endDie"]')).toContainText(
            'rolled the end die:'
        )
        await expect(rail.getByRole('region', { name: 'End die', exact: true })).toHaveCount(0)
        await expect(rail.getByText('End die', { exact: true })).toHaveCount(0)
        await expect(railPieces).toHaveCount(2)
    })
}

/** R-2.11.b — the outgoing holder gives the title to one of the tied players, shown as their chips. */
test('the Oathkeeper title: the holder is asked who takes it, the tied players are chips of one width, and a tap gives it', async ({
    page
}) => {
    await openTable(page, 'oathkeeperTie')
    await expect(grid(page).getByRole('heading', { name: 'Oathkeeper', exact: true })).toBeVisible()
    await expect(grid(page).getByText('Who takes the title?', { exact: true })).toBeVisible()
    await expect(grid(page)).not.toContainText('You no longer')
    await expect(grid(page)).not.toContainText('veto')
    const chips = grid(page).getByRole('button', { name: /^Give it to / })
    await expect(chips).toHaveCount(2)
    await expect(chips.nth(0)).toHaveText('rhys')
    await expect(chips.nth(1)).toHaveText('ann')
    const widths = await chips.evaluateAll((buttons) =>
        buttons.map((button) => (button instanceof HTMLElement ? button.offsetWidth : 0))
    )
    expect(new Set(widths).size).toBe(1)

    await grid(page).getByRole('img', { name: 'the Oathkeeper title' }).click()
    await expect(preview(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(preview(page)).toHaveCount(0)

    await grid(page).getByRole('button', { name: 'Give it to ann', exact: true }).click()
    await expect.poll(async () => (await call(page, 'tableFacts')).machineState).toBe('ActPhase')
    await expect(grid(page).getByText('Who takes the title?', { exact: true })).toHaveCount(0)
})

/** R-3.1 — the game-end panel names the winner and how they won; the History's top row says why. */
test('the game end: "<winner> won as Usurper", without the reason', async ({ page }) => {
    await openTable(page, 'usurperWins')
    const end = page
        .getByRole('heading', { name: 'The game is over', exact: true })
        .locator('xpath=..')
    await expect(end).toBeVisible()
    await expect(end).toContainText('won as Usurper')
    await expect(end).not.toContainText('—')
    await expect(end).not.toContainText('an Exile holding')
})

type PanelFrame = { scale: number; box: number; drawn: number }
type PanelRecord = { frames: PanelFrame[]; errors: string[] }

/** Samples the last fitted panel on every animation frame from the first one it exists, and every error the window reports (a ResizeObserver loop error reaches the window, not `pageerror`). */
function installPanelRecorder() {
    const record: PanelRecord = { frames: [], errors: [] }
    Reflect.set(window, 'panelRecord', record)
    window.addEventListener('error', (event) => record.errors.push(event.message))
    const sample = () => {
        const inners = document.querySelectorAll('.fit__inner')
        const inner = inners[inners.length - 1]
        const box = inner?.parentElement
        if (inner && box) {
            record.frames.push({
                scale: new DOMMatrixReadOnly(getComputedStyle(inner).transform).a,
                box: box.getBoundingClientRect().height,
                drawn: inner.getBoundingClientRect().height
            })
        }
        requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
}

const recordPanel = (page: Page) => page.evaluate(installPanelRecorder)

const panelRecord = (page: Page) =>
    page.evaluate((): PanelRecord => Reflect.get(window, 'panelRecord'))

async function waitFrames(page: Page, count: number) {
    await page.evaluate(async (count) => {
        for (let frame = 0; frame < count; frame++) await new Promise(requestAnimationFrame)
    }, count)
}

async function panelImagesLoaded(page: Page) {
    await page.waitForFunction(() =>
        [...document.querySelectorAll('.fit__inner img')].every(
            (image) => image instanceof HTMLImageElement && image.complete
        )
    )
    await waitFrames(page, 8)
}

function expectFittedOnEveryFrame({ frames, errors }: PanelRecord) {
    expect(frames.length).toBeGreaterThan(0)
    expect(frames.filter((frame) => frame.scale >= 1)).toEqual([])
    expect(frames.filter((frame) => frame.drawn > frame.box + 1)).toEqual([])
    expect(errors).toEqual([])
}

async function stepColumnHeight(page: Page, heights: number[]) {
    for (const height of heights) {
        await page.setViewportSize({ width: 375, height })
        await waitFrames(page, 8)
    }
}

/** A taller step than the grid on a phone: the powers list (Travel picks on the map there). */
async function choosePowers(page: Page) {
    await usePower(page).last().click()
    await expect(page.getByText('Makes an action possible', { exact: true }).last()).toBeVisible()
    await waitFrames(page, 8)
}

test.describe('scenario 61: on a phone the panel is drawn at its fitted scale on every frame', () => {
    test.use({ viewport: { width: 375, height: 540 } })

    test('the panel’s first frame on opening the table is already fitted', async ({ page }) => {
        await page.addInitScript(installPanelRecorder)
        await openTable(page, 'actPhase')
        await expect(tile(page, 'Travel')).toBeVisible()
        await panelImagesLoaded(page)
        expectFittedOnEveryFrame(await panelRecord(page))
    })

    test('the column’s height changing in steps, as an address bar slides, never draws the panel unscaled', async ({
        page
    }) => {
        await openTable(page, 'actPhase')
        await expect(tile(page, 'Travel')).toBeVisible()
        await recordPanel(page)
        await stepColumnHeight(page, [520, 500, 480, 460, 480, 500, 520, 540])
        const record = await panelRecord(page)
        expectFittedOnEveryFrame(record)
        expect(new Set(record.frames.map((frame) => frame.box)).size).toBeGreaterThan(4)
    })

    test('a step with different content refits without an unscaled frame', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 500 })
        await openTable(page, 'cardsOpenTravel')
        await expect(usePower(page)).toBeVisible()
        await panelImagesLoaded(page)
        await recordPanel(page)
        await choosePowers(page)
        await panelImagesLoaded(page)
        const record = await panelRecord(page)
        expectFittedOnEveryFrame(record)
        expect(
            record.frames[0].scale - record.frames[record.frames.length - 1].scale
        ).toBeGreaterThan(0.03)
    })

    test('in full screen, the window’s height changing and a new step never draw the panel unscaled', async ({
        page
    }) => {
        await page.setViewportSize({ width: 375, height: 500 })
        await openTable(page, 'cardsOpenTravel')
        await expect(usePower(page)).toBeVisible()
        await recordPanel(page)
        await page.getByRole('button', { name: 'Enter full screen' }).click()
        await expect(page.locator('.fullscreen-panel .fit__inner')).toBeVisible()
        expect(
            await page
                .locator('.fit__inner')
                .last()
                .evaluate((inner) => inner.closest('.fullscreen-panel') !== null)
        ).toBe(true)
        await panelImagesLoaded(page)
        await stepColumnHeight(page, [480, 460, 440, 460, 480, 500])
        await choosePowers(page)
        const record = await panelRecord(page)
        expectFittedOnEveryFrame(record)
        expect(new Set(record.frames.map((frame) => frame.box)).size).toBeGreaterThan(3)
    })
})

test('scenario 61: a panel image that arrives after its panel changes nothing it was laid out with', async ({
    page
}) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.route(/token\.favor\.png/, async (route) => {
        if (route.request().resourceType() !== 'image') return route.continue()
        await new Promise((resolve) => setTimeout(resolve, 2000))
        await route.continue()
    })
    await page.addInitScript(installPanelRecorder)
    await openTable(page, 'actPhase')
    await call(page, 'seatTravels', 'slot.cradle.1')
    await tile(page, 'Muster').click()
    const musters = page.getByRole('list', { name: 'Musters at your site' })
    await expect(musters).toBeVisible()
    const token = musters.locator('img[src*="token.favor"]').first()
    const box = page.locator('.fit').last()
    const layout = async () => ({
        complete: await token.evaluate(
            (image) => image instanceof HTMLImageElement && image.complete
        ),
        tokenWidth: await token.evaluate((image) => image.getBoundingClientRect().width),
        boxHeight: await box.evaluate((element) => element.getBoundingClientRect().height)
    })
    const before = await layout()
    expect(before.complete).toBe(false)
    expect(before.tokenWidth).toBeGreaterThan(0)
    await panelImagesLoaded(page)
    const after = await layout()
    expect(after.complete).toBe(true)
    expect(after.tokenWidth).toBeCloseTo(before.tokenWidth, 1)
    expect(after.boxHeight).toBe(before.boxHeight)
    const { frames, errors } = await panelRecord(page)
    expect(frames.filter((frame) => frame.drawn > frame.box + 1)).toEqual([])
    expect(errors).toEqual([])
})

test('scenario 61: on a desktop a panel that fits is drawn unscaled', async ({ page }) => {
    await openTable(page, 'actPhase')
    await expect(tile(page, 'Travel')).toBeVisible()
    await expect(page.locator('.fit__inner')).toHaveCSS('transform', 'none')
})

/** docs/user-interactions.md — one contextual Undo, one pick per press, and no Back or step-cancel in any panel. */
test.describe('Undo is the one reversal control', () => {
    test('no panel renders a Back or a step-cancel, on any table or in any menu the grid opens', async ({
        page
    }) => {
        test.setTimeout(180_000)
        await page.goto('/')
        for (const name of await call(page, 'tableNames')) {
            await call(page, 'open', name)
            await expect(stepBacks(page), name).toHaveCount(0)
            const offered = grid(page).locator('.majors button[aria-disabled="false"]')
            for (const label of await offered.allTextContents()) {
                await grid(page).locator('.majors button').filter({ hasText: label.trim() }).click()
                await expect(stepBacks(page), `${name}: ${label.trim()}`).toHaveCount(0)
                await undoButton(page).click()
                await expect(
                    grid(page).locator('.majors'),
                    `${name}: ${label.trim()}`
                ).toBeVisible()
            }
        }
    })

    test('a Sneak Attack’s Campaign: Undo takes the target, then returns to the question with nothing sent', async ({
        page
    }) => {
        await openTable(page, 'sneakAttack')
        await answer(page, 'Campaign').click()
        await grid(page).locator('button[aria-pressed]').first().click()
        await expect(grid(page).locator('button[aria-pressed="true"]')).toHaveCount(1)
        await expect(stepBacks(page)).toHaveCount(0)

        await undoButton(page).click()
        await expect(grid(page).locator('button[aria-pressed="true"]')).toHaveCount(0)
        await expect(answer(page, 'Pass')).toHaveCount(0)
        await undoButton(page).click()
        await expect(answer(page, 'Campaign')).toBeVisible()
        await expect(answer(page, 'Pass')).toBeVisible()
        const facts = await call(page, 'tableFacts')
        expect(facts.machineState).toBe('PowerQuestion')
        expect(facts.staged).toBeUndefined()
    })

    test('a Citizenship offer to the one Exile: Undo takes a term and the relic one press each, then closes the offer', async ({
        page
    }) => {
        await openTable(page, 'citizenship')
        await grid(page).getByRole('button', { name: 'Offer Citizenship', exact: true }).click()
        // The one Exile is no pick: the offer opens at the relic.
        await expect(grid(page)).toContainText('Promise')
        await panelCards(page).first().click()
        const offer = answer(page, 'Offer')
        await expect(offer).toBeVisible()
        const giveOne = grid(page).getByRole('button', { name: 'you give 1 favor', exact: true })
        await giveOne.click()
        await expect(giveOne).toHaveAttribute('aria-pressed', 'true')
        await expect(stepBacks(page)).toHaveCount(0)

        const undo = undoButton(page)
        await undo.click()
        await expect(giveOne).toHaveAttribute('aria-pressed', 'false')
        await undo.click()
        await expect(offer).toHaveCount(0)
        await expect(grid(page)).toContainText('Promise')
        await expect(stepBacks(page)).toHaveCount(0)
        await undo.click()
        await expect(tile(page, 'Travel')).toBeVisible()
        expect((await call(page, 'tableFacts')).staged).toBeUndefined()
        await expect(undo).toHaveCount(0)
    })

    test('a Search: with a card kept, Undo returns to the drawn cards', async ({ page }) => {
        await openTable(page, 'searching')
        await panelCards(page).first().click()
        await expect(page.getByText('How do you play it?', { exact: false })).toBeVisible()
        await expect(stepBacks(page)).toHaveCount(0)

        await undoButton(page).click()
        await expect(grid(page).getByText('Keep one.', { exact: true })).toBeVisible()
        expect(await call(page, 'searchPicks')).toEqual({})
    })

    test('a card-ordering question: Undo untaps the last card, one per press, and never answers', async ({
        page
    }) => {
        await openTable(page, 'stackOrder')
        await panelCards(page)
            .filter({ has: page.getByRole('img', { name: 'Wolves', exact: true }) })
            .click()
        await panelCards(page)
            .filter({ has: page.getByRole('img', { name: 'Longbows', exact: true }) })
            .click()
        const stacked = async () => (await call(page, 'questionPicks')).stacked
        await expect.poll(stacked).toEqual(['denizen.beast.wolves', 'denizen.order.longbows'])
        await expect(stepBacks(page)).toHaveCount(0)

        const undo = undoButton(page)
        await undo.click()
        await expect.poll(stacked).toEqual(['denizen.beast.wolves'])
        await undo.click()
        await expect.poll(stacked).toEqual([])
        await expect(undo).toHaveCount(0)
        expect((await call(page, 'questionPicks')).queued).toBe(1)
    })

    test('let another peek off the clock: Undo or a second press closes the seat card’s picker, and the button keeps its words', async ({
        page
    }) => {
        await openTable(page, 'offTurn')
        expect(await call(page, 'viewOffTheClock')).toBe('me')
        const button = page.locator('.let-peek > button')
        await button.click()
        expect(await call(page, 'letPeekState')).toEqual({ open: true, staged: false })

        await undoButton(page).click()
        expect(await call(page, 'letPeekState')).toEqual({ open: false, staged: false })
        await expect(undoButton(page)).toHaveCount(0)

        await button.click()
        await expect(button).toHaveText('Let another peek')
        await expect(button).toHaveAttribute('aria-expanded', 'true')
        await expect(stepBacks(page)).toHaveCount(0)
        await button.click()
        expect(await call(page, 'letPeekState')).toEqual({ open: false, staged: false })
        await expect(button).toHaveAttribute('aria-expanded', 'false')
    })

    test('let another peek in your Act Phase: Undo or a second press closes the picker, and the seat card’s button keeps its words', async ({
        page
    }) => {
        await openTable(page, 'advisers')
        const button = page.locator('.let-peek > button')
        await button.click()
        expect(await call(page, 'letPeekState')).toEqual({
            open: true,
            staged: true,
            action: 'letPeek'
        })

        await undoButton(page).click()
        expect(await call(page, 'letPeekState')).toEqual({ open: false, staged: true })

        await button.click()
        await expect(button).toHaveText('Let another peek')
        await expect(button).toHaveAttribute('aria-expanded', 'true')
        await expect(stepBacks(page)).toHaveCount(0)
        await button.click()
        expect(await call(page, 'letPeekState')).toEqual({ open: false, staged: true })
        await expect(button).toHaveAttribute('aria-expanded', 'false')
    })
})

/** A power's question: its card small beside one short line, short answers, the yes once its picks are made. */
test.describe('power questions', () => {
    const line = (page: Page) => grid(page).locator('.question-line')
    const smallCard = (page: Page, name: string) =>
        grid(page).locator(`.question-form img[alt="${name}"]`)
    const asked = async (page: Page) => (await call(page, 'openQuestionKind')) !== undefined
    const red = (page: Page) => grid(page).locator('.text-oath-danger')

    test('Blackmail: "Pay <chip> 3 [favor] to keep Ring of Devotion?", Pay and Refuse, the relic beside the line', async ({
        page
    }) => {
        await openTable(page, 'askBlackmail')
        await expect(line(page)).toHaveText(/^Pay\s+ann\s+3\s+to keep Ring of Devotion\?$/i)
        await expect(line(page).locator('img[alt="favor"]')).toHaveCount(1)
        await expect(smallCard(page, 'Ring of Devotion')).toBeVisible()
        await expect(answer(page, 'Pay')).toBeVisible()
        await expect(answer(page, 'Refuse')).toBeVisible()
        await expect(grid(page)).not.toContainText('You have')
        await answer(page, 'Pay').click()
        await expect.poll(() => asked(page)).toBe(false)
    })

    test('Revelation: the favor held, none picked; "None" alone until a favor is tapped, then "Burn"; the favor to burn ringed rose', async ({
        page
    }) => {
        await openTable(page, 'askRevelation')
        await expect(line(page)).toHaveText(/^Burn how many\s+for as many\s*\?$/)
        await expect(line(page).locator('img[alt="favor"]')).toHaveCount(1)
        await expect(line(page).locator('img[alt="secrets"]')).toHaveCount(1)
        await expect(smallCard(page, 'Revelation')).toBeVisible()
        const favor = grid(page).getByRole('button', { name: /^burn \d favor$/ })
        await expect(favor).toHaveCount(4)
        await expect(favor).toHaveText(['', '', '', ''])
        await expect(favor.locator('img')).toHaveCount(4)
        await expect(grid(page).locator('[aria-pressed="true"]')).toHaveCount(0)
        await expect(answer(page, 'Burn')).toHaveCount(0)
        await expect(answer(page, 'None')).toBeVisible()
        await expect(red(page)).toHaveCount(0)

        const second = grid(page).getByRole('button', { name: 'burn 2 favor', exact: true })
        await second.click()
        await expect(grid(page).locator('[aria-pressed="true"]')).toHaveCount(2)
        await expect(second).toHaveClass(/ring-oath-danger/)
        await expect(answer(page, 'Burn')).toBeVisible()
        await second.click()
        await expect(grid(page).locator('[aria-pressed="true"]')).toHaveCount(0)
        await expect(answer(page, 'Burn')).toHaveCount(0)
        await second.click()
        await expect(answer(page, 'Burn')).toBeVisible()
        await answer(page, 'Burn').click()
        await expect.poll(() => asked(page)).toBe(false)
    })

    test('Herald: "Gain 1 [favor] from which bank?", no bank ringed', async ({ page }) => {
        await openTable(page, 'askHerald')
        await expect(line(page)).toHaveText(/^Gain 1\s+from which bank\?$/)
        await expect(smallCard(page, 'Herald')).toBeVisible()
        await expect(grid(page).locator('[aria-pressed="true"]')).toHaveCount(0)
    })

    test('Tinker’s Fair: "Exchange with <chip>?", what you get and give, Accept and Refuse', async ({
        page
    }) => {
        await openTable(page, 'askTinkersFair')
        await expect(line(page)).toHaveText(/^Exchange with\s+ann\s*\?$/i)
        await expect(grid(page)).toContainText('You get')
        await expect(grid(page)).toContainText(/You give\s*Ring of Devotion/)
        await expect(grid(page)).not.toContainText('binding')
        await expect(answer(page, 'Accept')).toBeVisible()
        await expect(answer(page, 'Refuse')).toBeVisible()
    })

    test('The Gathering: "Go to <site>?", Go and Stay', async ({ page }) => {
        await openTable(page, 'askGatheringJoin')
        await expect(line(page)).toHaveText(/^Go to .+\?$/)
        await expect(smallCard(page, 'The Gathering')).toBeVisible()
        await expect(answer(page, 'Go')).toBeVisible()
        await expect(answer(page, 'Stay')).toBeVisible()
    })

    test('The Gathering’s round: "Propose an exchange?", a player by chip; "Propose" once a player and terms are picked', async ({
        page
    }) => {
        await openTable(page, 'askGatheringFloor')
        await expect(line(page)).toHaveText('Propose an exchange?')
        await expect(grid(page).locator('select')).toHaveCount(0)
        await expect(answer(page, 'Propose')).toHaveCount(0)
        await expect(answer(page, 'Pass')).toBeVisible()
        await expect(red(page)).toHaveCount(0)

        await grid(page).getByRole('button', { name: 'ann', exact: true }).click()
        await expect(answer(page, 'Propose')).toHaveCount(0)
        await grid(page).getByRole('button', { name: 'me gives 1 favor', exact: true }).click()
        await expect(answer(page, 'Propose')).toBeVisible()
    })

    test('Family Heirloom: "Take Cup of Plenty?", Take and To the bottom, the relic beside the line', async ({
        page
    }) => {
        await openTable(page, 'askHeirloom')
        await expect(line(page)).toHaveText('Take Cup of Plenty?')
        await expect(smallCard(page, 'Cup of Plenty')).toBeVisible()
        await expect(answer(page, 'Take')).toBeVisible()
        await expect(answer(page, 'To the bottom')).toBeVisible()
    })

    test('Fae Merchant: "Which relic goes to the bottom?", the relics captioned drawn and yours', async ({
        page
    }) => {
        await openTable(page, 'askFaeMerchant')
        await expect(line(page)).toHaveText('Which relic goes to the bottom?')
        await expect(grid(page)).toContainText('drawn')
        await expect(grid(page)).toContainText('yours')
        await expect(grid(page)).not.toContainText('the one drawn')
    })

    test('Skeleton Key: "Take Ring of Devotion?", Take and Leave', async ({ page }) => {
        await openTable(page, 'askSkeletonKey')
        await expect(line(page)).toHaveText('Take Ring of Devotion?')
        await expect(smallCard(page, 'Ring of Devotion')).toBeVisible()
        await expect(answer(page, 'Take')).toBeVisible()
        await expect(answer(page, 'Leave')).toBeVisible()
    })

    test('Jinx: "Reroll …? Now …", the card’s cost in gold on Reroll, and Keep', async ({
        page
    }) => {
        await openTable(page, 'askJinx')
        await expect(line(page)).toHaveText('Reroll the Gambling Hall dice? Now 2 shields.')
        await expect(smallCard(page, 'Jinx')).toBeVisible()
        const reroll = answer(page, 'Reroll, paying 1 secret')
        await expect(reroll).toHaveText(/^Reroll\s*·\s*1$/)
        await expect(reroll.locator('.text-oath-accent img[alt="secret"]')).toHaveCount(1)
        await expect(answer(page, 'Keep')).toBeVisible()
        await expect(grid(page)).not.toContainText('cost')
    })

    test('Relic Thief: "Roll 1 defense die for …? No shields takes it.", the cost in gold on Roll, and Pass', async ({
        page
    }) => {
        await openTable(page, 'askRelicThief')
        await expect(line(page)).toHaveText(
            'Roll 1 defense die for Ring of Devotion? No shields takes it.'
        )
        await expect(smallCard(page, 'Ring of Devotion')).toBeVisible()
        const roll = answer(page, 'Roll, paying 1 favor + 1 secret')
        await expect(roll).toHaveText(/^Roll\s*·\s*1\s*\+\s*1$/)
        await expect(roll.locator('.text-oath-accent img')).toHaveCount(2)
        await expect(answer(page, 'Pass')).toBeVisible()
    })

    test('Brass Horse: "Travel where? Free.", its sites lit on the map, none listed in the panel', async ({
        page
    }) => {
        await openTable(page, 'askBrassHorse')
        await expect(line(page)).toHaveText('Travel where? Free.')
        await expect(smallCard(page, 'Brass Horse')).toBeVisible()
        await expect(grid(page).getByRole('button', { name: /^Travel to / })).toHaveCount(0)
        expect(await litSlots(page)).toEqual([
            'slot.hinterland.0',
            'slot.provinces.0',
            'slot.provinces.1'
        ])
    })

    test('Sneak Attack: "Campaign against <chip> now? Free.", and Pass', async ({ page }) => {
        await openTable(page, 'askSneakAttack')
        await expect(line(page)).toHaveText(/^Campaign against\s+ann\s+now\?\s+Free\.$/i)
        await expect(smallCard(page, 'Sneak Attack')).toBeVisible()
        await expect(answer(page, 'Pass')).toBeVisible()
    })

    test('Inquisitor: "The Conspiracy: how do you play it?"; "Adviser, facedown", "Play it" and "Discard", one width, the choice look', async ({
        page
    }) => {
        await openTable(page, 'askInquisitor')
        await expect(line(page)).toHaveText('The Conspiracy: how do you play it?')
        await expect(smallCard(page, 'Conspiracy')).toBeVisible()
        await expect(grid(page)).not.toContainText('From:')
        const plays = ['Adviser, facedown', 'Play it', 'Discard'].map((name) => answer(page, name))
        const boxes = []
        for (const play of plays) {
            await expect(play).toBeVisible()
            await expect(play).not.toHaveClass(/bg-oath-primary/)
            boxes.push(await play.boundingBox())
        }
        expect(new Set(boxes.map((box) => Math.round(box?.width ?? 0))).size).toBe(1)
        expect(boxes.map((box) => box?.x ?? 0)).toEqual(
            [...boxes.map((box) => box?.x ?? 0)].sort((a, b) => a - b)
        )
    })

    test('Inquisitor: "Play it" opens the take; "Play" at once, waiting while a player is picked with no prize; Undo returns', async ({
        page
    }) => {
        await openTable(page, 'askInquisitor')
        await answer(page, 'Play it').click()
        await expect(line(page)).toHaveText('The Conspiracy: take a relic or banner?')
        await expect(smallCard(page, 'Conspiracy')).toBeVisible()
        await expect(grid(page)).toContainText('From:')
        await expect(answer(page, 'Play')).toBeVisible()
        await expect(answer(page, 'Adviser, facedown')).toHaveCount(0)

        await grid(page).getByRole('button', { name: 'ann', exact: true }).click()
        await expect(answer(page, 'Play')).toHaveCount(0)
        await expect(red(page)).toHaveCount(0)
        await grid(page).getByRole('button', { name: 'Ring of Devotion', exact: true }).click()
        await expect(answer(page, 'Play')).toBeVisible()

        const undo = page.getByRole('button', { name: 'Undo', exact: true })
        for (let press = 0; press < 3; press++) await undo.click()
        await expect(line(page)).toHaveText('The Conspiracy: how do you play it?')
        await expect(answer(page, 'Adviser, facedown')).toBeVisible()
        expect(await asked(page)).toBe(true)
    })

    test('Inquisitor: "Play it" with no one to take from shows why in place of "From:", the name a chip; "Play" plays it', async ({
        page
    }) => {
        await openTable(page, 'askInquisitorNoTake')
        await answer(page, 'Play it').click()
        await expect(line(page)).toHaveText('The Conspiracy: take a relic or banner?')
        await expect(grid(page)).not.toContainText('From:')
        await expect(red(page)).toHaveCount(1)
        await expect(red(page)).toHaveText(
            /^\s*Needs 2 advisers matching\s*ann's; you have 1\.\s*$/i
        )
        await expect(red(page).locator('span.rounded')).toHaveText(/^ann's$/i)
        await answer(page, 'Play').click()
        await expect.poll(() => asked(page)).toBe(false)
    })

    test('Inquisitor: under the limit "Adviser, facedown" sends at once', async ({ page }) => {
        await openTable(page, 'askInquisitor')
        await answer(page, 'Adviser, facedown').click()
        await expect.poll(() => asked(page)).toBe(false)
    })

    test('Inquisitor at the adviser limit: "Adviser, facedown" opens "Discard 1 adviser.", red on the pick, "Play" once picked', async ({
        page
    }) => {
        await openTable(page, 'askInquisitorAtLimit')
        await answer(page, 'Adviser, facedown').click()
        await expect(line(page)).toHaveText('Discard 1 adviser.')
        await expect(smallCard(page, 'Conspiracy')).toBeVisible()
        await expect(answer(page, 'Play')).toHaveCount(0)
        await expect(red(page)).toHaveCount(0)

        const tutor = grid(page).getByRole('button', { name: 'Tutor', exact: true })
        await tutor.click()
        await expect(tutor).toHaveAttribute('aria-pressed', 'true')
        await expect(tutor).toHaveClass(/ring-oath-danger/)
        await expect(answer(page, 'Play')).toBeVisible()
        await answer(page, 'Play').click()
        await expect.poll(() => asked(page)).toBe(false)
    })

    test('Wild Mounts: "Discard one [beast] card instead of …?"; "Discard instead" once a card is picked, no red line before', async ({
        page
    }) => {
        await openTable(page, 'askWildMounts')
        await expect(line(page)).toHaveText(
            /^Discard one\s+card instead of Horse Archers and Lancers\?$/
        )
        await expect(line(page).locator('img[alt="Beast"]')).toHaveCount(1)
        await expect(answer(page, 'Discard instead')).toHaveCount(0)
        await expect(answer(page, 'Discard plans')).toBeVisible()
        await expect(red(page)).toHaveCount(0)

        await grid(page).getByRole('button', { name: 'War Tortoise', exact: true }).click()
        await expect(answer(page, 'Discard instead')).toBeVisible()
    })

    test('False Prophet: "Play Conquest, or discard it?"; a refused play is not listed; "Adviser, facedown" once the adviser to discard is picked', async ({
        page
    }) => {
        await openTable(page, 'askFalseProphet')
        await expect(line(page)).toHaveText('Play Vision of Conquest, or discard it?')
        await expect(smallCard(page, 'Vision of Conquest')).toBeVisible()
        await expect(grid(page)).toContainText('Adviser, facedown: discard 1 first.')
        await expect(answer(page, 'Adviser, facedown')).toHaveCount(0)
        await expect(answer(page, 'Discard')).toBeVisible()
        await expect(grid(page).locator('button:disabled')).toHaveCount(0)

        await grid(page).getByRole('button', { name: 'Messenger', exact: true }).click()
        await expect(answer(page, 'Adviser, facedown')).toBeVisible()
    })

    test('Pilgrimage: "Tap to discard; the last goes on top."; "Discard" once the order is fixed', async ({
        page
    }) => {
        await openTable(page, 'askPilgrimage')
        await expect(line(page)).toHaveText('Tap to discard; the last goes on top.')
        await expect(answer(page, 'Discard')).toHaveCount(0)
        await expect(stepBacks(page)).toHaveCount(0)
        await grid(page).getByRole('button', { name: 'Alchemist', exact: true }).click()
        await grid(page).getByRole('button', { name: 'Assassin', exact: true }).click()
        await expect(answer(page, 'Discard')).toBeVisible()
        await answer(page, 'Discard').click()
        await expect.poll(() => asked(page)).toBe(false)
    })

    test('Enchantress: "Over the adviser limit: discard 1."; the card received is not offered; "Discard" once one is picked', async ({
        page
    }) => {
        await openTable(page, 'askEnchantressDiscard')
        await expect(line(page)).toHaveText('Over the adviser limit: discard 1.')
        for (const name of ['Wolves', 'Wayside Inn', 'Scouts']) {
            await expect(grid(page).getByRole('button', { name, exact: true })).toBeVisible()
        }
        await expect(
            grid(page).getByRole('button', { name: 'Enchantress', exact: true })
        ).toHaveCount(0)
        await expect(answer(page, 'Discard')).toHaveCount(0)
        await expect(red(page)).toHaveCount(0)

        const wolves = grid(page).getByRole('button', { name: 'Wolves', exact: true })
        await wolves.click()
        await expect(wolves).toHaveAttribute('aria-pressed', 'true')
        await expect(wolves).toHaveClass(/ring-oath-danger/)
        await expect(answer(page, 'Discard')).toBeVisible()
        await answer(page, 'Discard').click()
        await expect.poll(() => asked(page)).toBe(false)
    })

    test('a When Played bank starts with none ringed; "Play" shows once one is tapped (Fabled Feast)', async ({
        page
    }) => {
        await openTable(page, 'fabledFeast')
        await grid(page).getByRole('button', { name: 'Fabled Feast', exact: true }).click()
        await grid(page).getByRole('button', { name: 'Adviser, faceup', exact: true }).click()
        const banks = grid(page).getByRole('button', { name: /bank, \d+ favor$/ })
        await expect(banks.first()).toBeVisible()
        await expect(grid(page).locator('[aria-pressed="true"]')).toHaveCount(0)
        await expect(grid(page).getByRole('button', { name: 'Play', exact: true })).toHaveCount(0)
        await expect(red(page)).toHaveCount(0)

        await banks.nth(1).click()
        await expect(banks.nth(1)).toHaveAttribute('aria-pressed', 'true')
        await expect(grid(page).getByRole('button', { name: 'Play', exact: true })).toBeVisible()
    })

    test.describe('at phone width', () => {
        test.use({ viewport: { width: 375, height: 812 } })

        // A Vision's face is printed landscape: the small card shows it whole, as wide as an upright card is tall.
        test('the Conspiracy beside its question is whole and landscape', async ({ page }) => {
            await openTable(page, 'askInquisitor')
            const card = smallCard(page, 'Conspiracy')
            await expect(card).toBeVisible()
            const shape = await card.evaluate((element) => {
                const image = element instanceof HTMLImageElement ? element : undefined
                const box = element.getBoundingClientRect()
                return {
                    width: box.width,
                    height: box.height,
                    natural: image ? image.naturalWidth / image.naturalHeight : 0
                }
            })
            expect(shape.width).toBeGreaterThan(shape.height)
            expect(shape.width).toBeGreaterThanOrEqual(60)
            expect(Math.abs(shape.width / shape.height - shape.natural)).toBeLessThan(0.05)
        })

        test('askEnchantressDiscard: the page does not scroll sideways, and "Discard" is at least 44 px tall', async ({
            page
        }) => {
            await openTable(page, 'askEnchantressDiscard')
            await expect(line(page)).toBeVisible()
            await grid(page).getByRole('button', { name: 'Scouts', exact: true }).click()
            const discard = answer(page, 'Discard')
            await expect(discard).toBeVisible()
            const box = await discard.boundingBox()
            expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
            const overflow = await page.evaluate(
                () => document.documentElement.scrollWidth - document.documentElement.clientWidth
            )
            expect(overflow).toBeLessThanOrEqual(0)
        })

        for (const [table, names] of [
            ['askBlackmail', ['Pay', 'Refuse']],
            ['askHeirloom', ['Take', 'To the bottom']],
            ['askJinx', ['Reroll, paying 1 secret', 'Keep']],
            ['askRelicThief', ['Roll, paying 1 favor + 1 secret', 'Pass']],
            ['askTinkersFair', ['Accept', 'Refuse']],
            ['askGatheringJoin', ['Go', 'Stay']],
            ['askInquisitor', ['Adviser, facedown', 'Play it', 'Discard']],
            ['askFalseProphet', ['As your Vision', 'Discard']],
            ['askFlipToTravel', ['Travel and flip 1 secret', 'Stay']],
            ['askWayStation', ['Give, paying 1 favor', 'Pay 2 Supply']],
            [
                'askHospitalityBank',
                ['+1 favor from the Order bank', '+1 favor from the Nomad bank']
            ],
            [
                'askGamblingHallBank',
                [
                    '+3 favor from the Discord bank',
                    '+2 favor from the Arcane bank',
                    '+4 favor from the Order bank',
                    '+1 favor from the Hearth bank',
                    '+3 favor from the Nomad bank'
                ]
            ]
        ] as const) {
            test(`${table}: no label is wider than its button; the answers share one width, at least 44 px tall`, async ({
                page
            }) => {
                await openTable(page, table)
                await expect(line(page)).toBeVisible()
                const buttons = names.flatMap((name) =>
                    typeof name === 'string'
                        ? [answer(page, name)]
                        : [grid(page).getByRole('button', { name })]
                )
                const sizes = []
                for (const button of buttons) {
                    await expect(button.first()).toBeVisible()
                    sizes.push(
                        ...(await button.evaluateAll((elements) =>
                            elements.map((element) => {
                                const style = getComputedStyle(element)
                                return {
                                    overflow: element.scrollWidth - element.clientWidth,
                                    width: parseFloat(style.width),
                                    height: parseFloat(style.height),
                                    inside: [...element.querySelectorAll('*')].every((child) => {
                                        const outer = element.getBoundingClientRect()
                                        const inner = child.getBoundingClientRect()
                                        return (
                                            inner.left >= outer.left - 0.5 &&
                                            inner.right <= outer.right + 0.5
                                        )
                                    }),
                                    name:
                                        element.getAttribute('aria-label') ??
                                        element.textContent ??
                                        ''
                                }
                            })
                        ))
                    )
                }
                expect(sizes.length).toBeGreaterThan(1)
                for (const size of sizes) {
                    expect(size.overflow, size.name).toBeLessThanOrEqual(0)
                    expect(size.inside, size.name).toBe(true)
                    expect(size.height, size.name).toBeGreaterThanOrEqual(44)
                }
                expect(new Set(sizes.map((size) => Math.round(size.width))).size).toBe(1)
            })
        }
    })
})

/**
 * The Show menu (R-6.1, R-6.6.1, R-9.4): the cards this seat may show as images, its facedown
 * advisers then the Reliquary relics in space order; a tap rings one, and "To:" lists the chips of
 * the players who may see it; a chip shows it.
 */
test.describe('the Show menu', () => {
    const SHOWABLE = [
        'Insect Swarm',
        'Ring of Devotion',
        'Cup of Plenty',
        'Skeleton Key',
        'Brass Horse'
    ]
    const picker = (page: Page) => page.locator('.let-peek-picker')
    const showCard = (page: Page, name: string) =>
        picker(page)
            .locator('button[aria-pressed]')
            .filter({ has: page.getByRole('img', { name, exact: true }) })
    const chips = (page: Page) => picker(page).getByRole('button', { name: /^Show .+ to \w+$/ })

    /** Each card and chip of the picker as drawn, in layout pixels (a tall panel is scaled to fit). */
    async function shown(page: Page) {
        await expect(picker(page).locator('img').first()).toBeVisible()
        await picker(page)
            .locator('img')
            .evaluateAll((images: HTMLImageElement[]) =>
                Promise.all(images.map((image) => image.decode().catch(() => undefined)))
            )
        return picker(page).evaluate((root: HTMLElement) => {
            const frame = root.getBoundingClientRect()
            const scale = frame.width / root.offsetWidth
            const edge = (
                root.closest('.panel') ??
                root.closest('.let-peek') ??
                root
            ).getBoundingClientRect()
            const local = (rect: DOMRect) => ({
                left: (rect.left - frame.left) / scale,
                top: (rect.top - frame.top) / scale,
                right: (rect.right - frame.left) / scale,
                bottom: (rect.bottom - frame.top) / scale,
                width: rect.width / scale,
                height: rect.height / scale,
                inPanel: rect.left >= edge.left - 0.5 && rect.right <= edge.right + 0.5
            })
            const cards = [...root.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].map(
                (button) => {
                    const image = button.querySelector('img')
                    if (!image) throw Error('A card to show has no image')
                    return {
                        name: image.alt,
                        picked: button.getAttribute('aria-pressed') === 'true',
                        ...local(image.getBoundingClientRect())
                    }
                }
            )
            const chipButtons = [
                ...root.querySelectorAll<HTMLButtonElement>(
                    'button:not([aria-pressed]):not(.magnifier)'
                )
            ]
            const chips = chipButtons.map((button) => {
                const outer = button.getBoundingClientRect()
                return {
                    name: button.getAttribute('aria-label') ?? '',
                    text: button.textContent?.trim() ?? '',
                    title: button.getAttribute('title'),
                    inside: [...button.querySelectorAll('*')].every((child) => {
                        const inner = child.getBoundingClientRect()
                        return (
                            inner.left >= outer.left - 0.5 &&
                            inner.right <= outer.right + 0.5 &&
                            inner.top >= outer.top - 0.5 &&
                            inner.bottom <= outer.bottom + 0.5
                        )
                    }),
                    ...local(outer)
                }
            })
            return { cards, chips }
        })
    }

    test('at 1280: the adviser then the Reliquary relics, faces, 100 px, one line, none ringed; a tap rings one and “To:” shows who may see it; a chip shows it', async ({
        page
    }) => {
        await openTable(page, 'show')
        await minor(page, 'Show').click()
        await expect(grid(page).getByText(/^Show .+ to$/)).toHaveCount(0)

        const before = await shown(page)
        // R-6.4-H1 — the Scepter's holder knows every Reliquary relic, so each is its face.
        expect(before.cards.map((card) => card.name)).toEqual(SHOWABLE)
        expect(before.cards.filter((card) => card.picked)).toEqual([])
        expect(before.chips).toEqual([])
        await expect(picker(page).getByText('To:', { exact: true })).toHaveCount(0)
        for (const card of before.cards) {
            expect(card.height, `${card.name}: 100 tall`).toBeCloseTo(100, 0)
            expect(card.top, `${card.name}: on the first card’s line`).toBeCloseTo(
                before.cards[0].top,
                0
            )
            expect(card.inPanel, `${card.name}: inside the panel`).toBe(true)
        }
        await expect(picker(page).locator('button.magnifier')).toHaveCount(SHOWABLE.length)
        await expect(
            picker(page).getByRole('button', { name: 'Enlarge Cup of Plenty', exact: true })
        ).toBeVisible()

        // R-6.1, R-9.4 — an adviser may be shown to every other player.
        await showCard(page, 'Insect Swarm').click()
        await expect(showCard(page, 'Insect Swarm')).toHaveAttribute('aria-pressed', 'true')
        await expect(picker(page).getByText('To:', { exact: true })).toBeVisible()
        await expect(chips(page)).toHaveText(['rhys', 'ann'])
        expect(
            await chips(page).evaluateAll((buttons) =>
                buttons.map((b) => b.getAttribute('aria-label'))
            )
        ).toEqual(['Show Insect Swarm to rhys', 'Show Insect Swarm to ann'])

        // R-6.6.1 — a relic only to an Exile: the Citizen has no chip.
        await showCard(page, 'Cup of Plenty').click()
        await expect(showCard(page, 'Insect Swarm')).toHaveAttribute('aria-pressed', 'false')
        await expect(chips(page)).toHaveText(['rhys'])
        const relicChip = picker(page).getByRole('button', {
            name: 'Show the relic on Reliquary space 2 to rhys',
            exact: true
        })
        await expect(relicChip).toBeVisible()
        const after = await shown(page)
        for (const chip of after.chips) {
            expect(chip.inside, `${chip.name}: the chip inside its button`).toBe(true)
            expect(chip.title, `${chip.name}: no hover text`).toBeNull()
            expect(chip.top, `${chip.name}: under the cards`).toBeGreaterThan(
                Math.max(...after.cards.map((card) => card.bottom))
            )
        }

        await relicChip.click()
        await expect
            .poll(() => call(page, 'lastLetPeek'))
            .toEqual({
                toPlayerId: 'rhys',
                subject: { kind: 'reliquary', slotId: 'reliquary.1' }
            })
    })

    // Four relics at 69 px and their gaps take 300 px: the panel holds them on one line at 402 wide
    // (328 px inside) and at 375 (303.5 px).
    for (const { viewport, oneLine } of [
        { viewport: { width: 402, height: 874 }, oneLine: true },
        { viewport: { width: 375, height: 812 }, oneLine: true }
    ]) {
        test(`at ${viewport.width} wide: the cards 69 px, the Reliquary on its own line, the chips 44 px tall`, async ({
            page
        }) => {
            await page.setViewportSize(viewport)
            await openTable(page, 'show')
            await minor(page, 'Show').click()
            await showCard(page, 'Insect Swarm').click()

            const { cards, chips: drawn } = await shown(page)
            expect(cards.map((card) => card.name)).toEqual(SHOWABLE)
            const [adviser, ...relics] = cards
            for (const card of cards) {
                expect(card.height, `${card.name}: 69 tall`).toBeCloseTo(69, 0)
                expect(card.inPanel, `${card.name}: inside the panel`).toBe(true)
            }
            expect(relics[0].left, 'the Reliquary starts its line').toBeCloseTo(adviser.left, 0)
            for (const relic of relics) {
                expect(relic.top, `${relic.name}: under the adviser`).toBeGreaterThan(
                    adviser.bottom
                )
                if (oneLine) {
                    expect(relic.top, `${relic.name}: on the Reliquary’s one line`).toBeCloseTo(
                        relics[0].top,
                        0
                    )
                }
            }
            expect(drawn.map((chip) => chip.text)).toEqual(['rhys', 'ann'])
            for (const chip of drawn) {
                expect(chip.height, `${chip.name}: 44 tall`).toBeGreaterThanOrEqual(44)
                expect(chip.inside, `${chip.name}: the chip inside its button`).toBe(true)
                expect(chip.inPanel, `${chip.name}: inside the panel`).toBe(true)
            }
        })
    }

    test('one card to show starts ringed with its chips, and Undo then closes the menu', async ({
        page
    }) => {
        await openTable(page, 'showOne')
        await minor(page, 'Show').click()
        await expect(showCard(page, 'Forced Labor')).toHaveAttribute('aria-pressed', 'true')
        await expect(chips(page)).toHaveText(['dana', 'ann'])
        await expect(chips(page).first()).toHaveAccessibleName('Show Forced Labor to dana')

        await undoButton(page).click()
        expect(await call(page, 'letPeekState')).toEqual({ open: false, staged: true })
    })

    test('Undo takes back the picked card, then closes the menu', async ({ page }) => {
        await openTable(page, 'show')
        await minor(page, 'Show').click()
        await showCard(page, 'Skeleton Key').click()
        await expect(chips(page)).toHaveText(['rhys'])

        await undoButton(page).click()
        await expect(picker(page).locator('button[aria-pressed="true"]')).toHaveCount(0)
        await expect(chips(page)).toHaveCount(0)
        expect(await call(page, 'letPeekState')).toEqual({
            open: true,
            staged: true,
            action: 'letPeek'
        })

        await undoButton(page).click()
        expect(await call(page, 'letPeekState')).toEqual({ open: false, staged: true })
    })

    test('off the clock, the seat card’s picker: the same cards at 56 px, the Reliquary on its own line, 44 px chips; Undo unpicks, then closes', async ({
        page
    }) => {
        await openTable(page, 'showOne')
        expect(await call(page, 'viewOffTheClock')).toBe('dana')
        await page.getByRole('button', { name: 'Let another peek', exact: true }).click()
        await expect(page.locator('.let-peek .let-peek-picker')).toHaveCount(1)
        await expect(picker(page).locator('button[aria-pressed="true"]')).toHaveCount(0)

        await showCard(page, 'Cup of Plenty').click()
        await expect(chips(page)).toHaveText(['rhys'])
        await expect(chips(page)).toHaveAccessibleName(
            'Show the relic on Reliquary space 2 to rhys'
        )

        const { cards, chips: drawn } = await shown(page)
        expect(cards.map((card) => card.name)).toEqual(SHOWABLE)
        const [adviser, ...relics] = cards
        for (const card of cards) {
            expect(card.height, `${card.name}: 56 tall`).toBeCloseTo(56, 0)
            expect(card.inPanel, `${card.name}: inside the seat card`).toBe(true)
        }
        for (const relic of relics) {
            expect(relic.top, `${relic.name}: under the adviser`).toBeGreaterThan(adviser.bottom)
            expect(relic.top, `${relic.name}: on the Reliquary’s one line`).toBeCloseTo(
                relics[0].top,
                0
            )
        }
        for (const chip of drawn) {
            expect(chip.height, `${chip.name}: 44 tall`).toBeGreaterThanOrEqual(44)
            expect(chip.inside, `${chip.name}: the chip inside its button`).toBe(true)
        }

        await undoButton(page).click()
        await expect(chips(page)).toHaveCount(0)
        expect(await call(page, 'letPeekState')).toEqual({ open: true, staged: false })
        await undoButton(page).click()
        expect(await call(page, 'letPeekState')).toEqual({ open: false, staged: false })
    })
})

/**
 * Rule 4 and "Choose a card": no panel prints a card's power text, under or beside it; the card is
 * a magnifier press away. Every card in a panel carries its corner magnifier, a small one
 * straddling the top-left corner of a small card, and its picture's name and the magnifier's
 * spoken name are the card's name alone, with no hover title.
 */
test.describe('card power text: none in a panel; every panel card has its magnifier', () => {
    const enlarge = (scope: Locator, name: string) =>
        scope.getByRole('button', { name: `Enlarge ${name}`, exact: true })
    /** Marks only a raw printed text carries: emphasis, token codes, an "Action:" lead. */
    const RAW_MARKS = ['**', '[', 'Action:']
    /** Its laid-out size in CSS pixels, whatever a scaled panel draws it at. */
    const layoutSize = (locator: Locator) =>
        locator.evaluate((element) =>
            element instanceof HTMLElement
                ? { width: element.offsetWidth, height: element.offsetHeight }
                : { width: 0, height: 0 }
        )

    async function expectNoRawText(page: Page) {
        const text = await grid(page).innerText()
        for (const mark of RAW_MARKS) expect(text, `the panel prints "${mark}"`).not.toContain(mark)
    }

    /** Each card row in the panel: its name, its title, the toggle's text and the magnifiers beside it. */
    async function offeredRows(page: Page) {
        return grid(page)
            .locator('[data-card-row]')
            .evaluateAll((rows) =>
                rows.map((row) => {
                    const toggle = row.querySelector('button[aria-pressed]')
                    return {
                        name: toggle?.querySelector('.font-bold')?.textContent?.trim() ?? '',
                        title: toggle?.getAttribute('title') ?? null,
                        text: toggle instanceof HTMLElement ? toggle.innerText : '',
                        magnifiers: [...row.querySelectorAll('button.magnifier')].map(
                            (magnifier) => magnifier.getAttribute('aria-label') ?? ''
                        )
                    }
                })
            )
    }

    /** Each card a row: its name alone, no hover title, a magnifier named for the card beside it. */
    async function expectCardRows(page: Page) {
        const rows = await offeredRows(page)
        expect(rows.length, 'cards offered').toBeGreaterThan(0)
        for (const row of rows) {
            expect(row.name, 'named by its card').not.toBe('')
            expect(row.name, `${row.name}: named by its card alone`).not.toContain('—')
            expect(row.title, `${row.name}: no hover title`).toBeNull()
            expect(row.magnifiers, `${row.name}: one magnifier, named for the card`).toEqual([
                `Enlarge ${row.name}`
            ])
        }
        return rows
    }

    /** The magnifier on a card picture, by the card's name: its laid-out size, and its box and the picture's on screen. */
    async function magnifierOn(scope: Locator, name: string) {
        const glass = enlarge(scope, name)
        await expect(glass).toHaveCount(1)
        const card = glass.locator('xpath=..').getByRole('img', { name, exact: true })
        await expect(card).toHaveCount(1)
        return {
            glass,
            size: (await layoutSize(glass)).width,
            glassBox: await boxOf(glass),
            cardBox: await boxOf(card)
        }
    }

    test('a modifier in an action’s menu: Truthful Harp is a row, its name over its line, no printed text', async ({
        page
    }) => {
        await openTable(page, 'harpSearch')
        await tile(page, 'Search').click()
        const harp = cardToggle(page, 'relic.truthful-harp')
        await expect(harp).toBeVisible()
        await expect(harp).toHaveAttribute('aria-pressed', 'false')
        const [row] = await expectCardRows(page)
        expect(row.text.replace(/\s+/g, ' ').trim()).toBe('Truthful Harp draw +2 · reveal them')
        await expectNoRawText(page)
        await expect(grid(page)).not.toContainText('Draw two more')
        expect(await tokenRuns(harp.locator('.text-xs'))).toEqual([
            ['draw +2', 'text'],
            ['·', 'text-muted'],
            ['reveal them', 'danger']
        ])

        await enlarge(cardRow(page, 'relic.truthful-harp'), 'Truthful Harp').click()
        await expect(preview(page)).toBeVisible()
        await expect(harp).toHaveAttribute('aria-pressed', 'false')
    })

    for (const name of ['battleDefenderPlans', 'attackerPlans'] as const) {
        test(`battle plans (${name}): each plan a row, its name, its magnifier, no printed text`, async ({
            page
        }) => {
            await openTable(page, name)
            await expect(
                grid(page).locator('[data-card-row] button[aria-pressed]').first()
            ).toBeVisible()
            await expectCardRows(page)
            await expectNoRawText(page)
        })
    }

    test('battle plans: each row its name and, in gold, what it costs; "in use" once tapped; one width', async ({
        page
    }) => {
        await openTable(page, 'battlePlanCosts')
        const rows = await expectCardRows(page)
        expect(rows.map((row) => row.text.replace(/\s+/g, ' ').trim())).toEqual([
            'Wild Mounts',
            'Shield Wall 1',
            'Hearts and Minds 3'
        ])
        const shieldWall = cardToggle(page, 'denizen.order.shield-wall')
        expect(await tokenRuns(shieldWall.locator('.text-xs'))).toEqual([['1', 'accent']])
        await expect(
            shieldWall.locator('.text-xs').getByRole('img', { name: 'favor' })
        ).toBeVisible()
        await expect(shieldWall.getByText('in use', { exact: true })).toBeHidden()
        await shieldWall.click()
        await expect(shieldWall).toHaveAttribute('aria-pressed', 'true')
        await expect(shieldWall.getByText('in use', { exact: true })).toBeVisible()
        await expectOneWidth(grid(page).locator('[data-card-row] button[aria-pressed]'))
        await expect(grid(page).locator('[title]')).toHaveCount(0)
    })

    test('Use a power: each card its magnifier, the name and action with no text, the Whistle’s cost on Use in gold', async ({
        page
    }) => {
        await openTable(page, 'usePower')
        await usePower(page).click()
        const entries = [
            {
                entry: actionCard(page, 'denizen.beast.mushrooms'),
                name: 'Mushrooms',
                head: 'Mushrooms — Search'
            },
            {
                entry: actionCard(page, 'denizen.nomad.tents'),
                name: 'Tents',
                head: 'Tents — Travel'
            },
            {
                entry: grid(page).locator('[data-action-power="relic.whistle"]'),
                name: 'Whistle',
                head: 'Whistle'
            }
        ]
        for (const { entry, name, head } of entries) {
            await expect(entry).toBeVisible()
            await expect(entry.locator('button.magnifier'), `${name}: one magnifier`).toHaveCount(1)
            const { size, glassBox, cardBox } = await magnifierOn(entry, name)
            expect(size, `${name}: the mid-sized glass`).toBe(24)
            expect(
                glassBox.x + glassBox.width,
                `${name}: in the card’s top-right corner`
            ).toBeGreaterThan(cardBox.x + cardBox.width)
            expect(glassBox.y, `${name}: straddling its top edge`).toBeLessThan(cardBox.y)
            await expect(entry.locator('.text-sm').first()).toHaveText(head)
        }
        await expect(actionCard(page, 'denizen.beast.mushrooms')).not.toContainText(
            'Spend no Supply'
        )
        await expect(actionCard(page, 'denizen.nomad.tents')).not.toContainText('traveling')
        await expect(grid(page)).not.toContainText('Choose a pawn')
        await expectNoRawText(page)

        const use = grid(page).getByRole('button', { name: 'Use, paying 1 secret', exact: true })
        await expect(use).toBeVisible()
        await expect(use).toHaveText(/^Use\s*·\s*1$/)
        const cost = use.locator('.text-oath-accent')
        await expect(cost.getByRole('img', { name: 'secret' })).toBeVisible()
        expect(await tokenRuns(cost)).toEqual([['1', 'accent']])

        await enlarge(grid(page), 'Whistle').click()
        await expect(preview(page)).toBeVisible()
    })

    for (const viewport of [
        { width: 402, height: 874 },
        { width: 375, height: 812 }
    ]) {
        test(`Use a power at ${viewport.width}: its buttons and its pick 44 px tall, every label inside its button`, async ({
            page
        }) => {
            await page.setViewportSize(viewport)
            await openTable(page, 'usePower')
            await usePower(page).click()
            const controls = [
                grid(page).getByRole('button', { name: 'Search with Mushrooms', exact: true }),
                grid(page).getByRole('button', { name: 'Travel with Tents', exact: true }),
                grid(page).getByRole('button', { name: 'Use, paying 1 secret', exact: true }),
                grid(page).locator('[data-action-power="relic.whistle"] button[aria-pressed]')
            ]
            for (const control of controls) {
                await expect(control).toBeVisible()
                const { height } = await layoutSize(control)
                expect(height, `${await control.textContent()}: 44 tall`).toBeGreaterThanOrEqual(44)
            }
            expect(await clippedLabels(page)).toEqual([])
            expect(await wrappedLabels(page)).toEqual([])
            for (const name of ['Mushrooms', 'Tents', 'Whistle']) {
                await expect(enlarge(grid(page), name)).toBeVisible()
            }
        })
    }

    test('a question’s small card: the small magnifier straddles its top-left corner and enlarges it', async ({
        page
    }) => {
        await openTable(page, 'askBlackmail')
        const form = grid(page).locator('.question-form')
        const { glass, size, glassBox, cardBox } = await magnifierOn(form, 'Ring of Devotion')
        expect(size).toBe(18)
        expect(glassBox.x, 'out past the card’s left edge').toBeLessThan(cardBox.x)
        expect(glassBox.y, 'out past the card’s top edge').toBeLessThan(cardBox.y)
        expect(glassBox.x + glassBox.width, 'clear of the line beside the card').toBeLessThan(
            cardBox.x + cardBox.width
        )
        await glass.click()
        await expect(preview(page)).toBeVisible()
        await expect(answer(page, 'Pay')).toBeVisible()
    })

    test('Search’s kept card at "How do you play it?" carries its magnifier', async ({ page }) => {
        await openTable(page, 'searching')
        const first = panelCards(page).first()
        const name = (await first.getByRole('img').getAttribute('alt')) ?? ''
        expect(name).not.toBe('')
        await first.click()
        await expect(grid(page).getByText('How do you play it?', { exact: true })).toBeVisible()
        const { glass, size } = await magnifierOn(grid(page), name)
        expect(size).toBe(28)
        await glass.click()
        await expect(preview(page)).toBeVisible()
        expect((await call(page, 'searchPicks')).placement).toBeUndefined()
    })

    test('the Wake’s site card carries the small magnifier', async ({ page }) => {
        await openTable(page, 'wakeSite')
        const { glass, size, glassBox, cardBox } = await magnifierOn(grid(page), 'Drowned City')
        expect(size).toBe(18)
        expect(glassBox.x, 'out past the card’s left edge').toBeLessThan(cardBox.x)
        await glass.click()
        await expect(preview(page)).toBeVisible()
    })
})

/** Scenario 13: the Bandit Crown's figure on the map and the enlarged site's words (R-7.6.5, R-6.6.3, R-5.5.1.a). */
const CROWN_SITE = 'slot.provinces.1'
const IMPERIAL_PURPLE = '#943c80'
const boardBandits = (page: Page) => page.locator('.piece-row .bandits')
const previewBandits = (page: Page) => preview(page).locator('.piece', { hasText: 'bandits serve' })
const previewRuledBy = (page: Page) => preview(page).locator('.piece', { hasText: 'ruled by' })
const chipsIn = (piece: Locator) => piece.locator('span.rounded')

/** The body fill of a bandit figure's picture. */
async function figureBody(figure: Locator): Promise<string | undefined> {
    const src = (await figure.getAttribute('src')) ?? ''
    return decodeURIComponent(src).match(/<path fill="(#[0-9a-f]{6})"/)?.[1]
}

async function enlargeCrownSite(page: Page) {
    await (await uncovered(page, `.site[data-slot="${CROWN_SITE}"] .board-card`)).click()
    await expect(preview(page)).toBeVisible()
}

test.describe('scenario 13: the Bandit Crown’s bandits on the map and the enlarged site', () => {
    test('a Citizen holder’s bandits are the Empire’s purple, named Imperial warbands, with no hover', async ({
        page
    }) => {
        await openTable(page, 'banditCrown')
        const figures = boardBandits(page)
        expect(await figures.count()).toBeGreaterThan(1)
        for (const figure of await figures.all()) {
            const picture = figure.locator('img')
            expect(await figureBody(picture)).toBe(IMPERIAL_PURPLE)
            await expect(picture).toHaveAttribute('alt', 'Bandits serving as Imperial warbands')
            await expect(figure).not.toHaveAttribute('title')
        }
    })

    test('the enlarged site draws the board’s figure, names the holder alone, and every Imperial player who rules it as chips', async ({
        page
    }) => {
        await openTable(page, 'banditCrown')
        await enlargeCrownSite(page)
        const bandits = previewBandits(page)
        await expect(bandits).toHaveText(/^\s*bandits serve\s+ann\s+here\s*$/i)
        expect(await chipsIn(bandits).allTextContents()).toEqual(['ann'])
        expect(await figureBody(bandits.locator('img'))).toBe(IMPERIAL_PURPLE)
        expect(await chipsIn(previewRuledBy(page)).allTextContents()).toEqual(['dana', 'ann'])
    })

    test('a Chancellor holder: the same purple; the bandits serve the Chancellor, and both Imperial players rule', async ({
        page
    }) => {
        await openTable(page, 'banditCrownChancellor')
        for (const figure of await boardBandits(page).all()) {
            expect(await figureBody(figure.locator('img'))).toBe(IMPERIAL_PURPLE)
        }
        await enlargeCrownSite(page)
        expect(await chipsIn(previewBandits(page)).allTextContents()).toEqual(['dana'])
        expect(await figureBody(previewBandits(page).locator('img'))).toBe(IMPERIAL_PURPLE)
        expect(await chipsIn(previewRuledBy(page)).allTextContents()).toEqual(['dana', 'ann'])
    })

    test('an Exile holder is unchanged: her colour, hers alone, named as her chip', async ({
        page
    }) => {
        await openTable(page, 'banditCrownExile')
        const red = decodeURIComponent(
            (await boardBandits(page).first().locator('img').getAttribute('src')) ?? ''
        )
        for (const figure of await boardBandits(page).all()) {
            expect(await figureBody(figure.locator('img'))).toBe('#e7665b')
            await expect(figure.locator('img')).toHaveAttribute(
                'alt',
                'Bandits serving as warbands'
            )
        }
        await enlargeCrownSite(page)
        expect(
            decodeURIComponent(
                (await previewBandits(page).locator('img').getAttribute('src')) ?? ''
            )
        ).toBe(red)
        expect(await chipsIn(previewBandits(page)).allTextContents()).toEqual(['rhys'])
        expect(await chipsIn(previewRuledBy(page)).allTextContents()).toEqual(['rhys'])
    })

    test('while her Campaign against the Chancellor suspends the Citizen holder, the bandits are hers alone, in her colour', async ({
        page
    }) => {
        await openTable(page, 'banditCrownCampaign')
        for (const figure of await boardBandits(page).all()) {
            expect(await figureBody(figure.locator('img'))).toBe('#63a3d5')
            await expect(figure.locator('img')).toHaveAttribute(
                'alt',
                'Bandits serving as warbands'
            )
        }
        await enlargeCrownSite(page)
        expect(await figureBody(previewBandits(page).locator('img'))).toBe('#63a3d5')
        expect(await chipsIn(previewBandits(page)).allTextContents()).toEqual(['ann'])
        expect(await chipsIn(previewRuledBy(page)).allTextContents()).toEqual(['ann'])
    })
})

for (const viewport of [
    { width: 402, height: 874 },
    { width: 375, height: 812 }
]) {
    test.describe(`scenario 13 on a phone held upright, ${viewport.width} wide`, () => {
        test.use({ viewport, hasTouch: true })

        test('five Imperial players’ chips wrap between chips, each whole inside the enlarged site’s box', async ({
            page
        }) => {
            await openTable(page, 'banditCrownFive')
            await siteCard(page, CROWN_SITE).tap()
            await expect(preview(page)).toBeVisible()
            const ruledBy = previewRuledBy(page)
            const chips = chipsIn(ruledBy)
            expect(await chips.allTextContents()).toEqual(['dana', 'ann', 'bea', 'dov', 'wes'])
            const box = await boxOf(ruledBy.locator('xpath=..'))
            const lineHeight = (await boxOf(chipsIn(previewBandits(page)))).height
            for (const chip of await boxesOf(chips)) {
                expect(inside(chip, box)).toBe(true)
                expect(chip.height, 'a chip on one line').toBeLessThan(lineHeight * 1.5)
            }
        })
    })
}

/** Toll Roads on a power's move and Forced Labor on Oracle: the moved player's question, the mover's wait, Oracle's toll line. */
test.describe('Toll Roads when a power moves another player', () => {
    const answers = (page: Page) => ({
        pay: grid(page).getByRole('button', { name: 'Pay', exact: true }),
        refuse: grid(page).getByRole('button', { name: 'Refuse', exact: true })
    })

    test('the moved player is asked; Pay sends them, and the History tells the whole story', async ({
        page
    }) => {
        expect((await openTable(page, 'tollAsked')).seatId).toBe('Dana')
        await expect(grid(page).getByRole('heading', { name: 'Toll Roads' })).toBeVisible()
        await expect(grid(page)).toContainText('Pay Rhys 1?')
        const { pay, refuse } = answers(page)
        const [payBox, refuseBox] = [await pay.boundingBox(), await refuse.boundingBox()]
        // Desktop: the two answers share the wider label's width, and nothing stretches.
        expect(payBox?.width).toBeCloseTo(refuseBox?.width ?? 0, 0)
        expect(payBox?.width ?? 999).toBeLessThan(120)

        await pay.click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).siteOf.Dana)
            .toBe('slot.provinces.1')
        expect((await call(page, 'tableFacts')).favorOf).toMatchObject({ Dana: 3, Rhys: 4 })
        await page.getByRole('tab', { name: 'History' }).click()
        const history = page.locator('.history')
        await expect(history).toContainText(
            "used the Whistle on Dana; Dana paid you 1 (Toll Roads) and went to Great Slum, taking the Whistle's 1"
        )
        await expect(history).toContainText('used the Whistle on Dana, placing 1 on it')
    })

    test('Refuse leaves the pawn where it was', async ({ page }) => {
        await openTable(page, 'tollAsked')
        await answers(page).refuse.click()
        await expect(answers(page).refuse).toHaveCount(0)
        expect((await call(page, 'tableFacts')).siteOf.Dana).toBe('slot.provinces.2')
    })

    test('the mover reads only who they are waiting on', async ({ page }) => {
        await openTable(page, 'tollAsked')
        expect(await call(page, 'viewOffTheClock')).toBe('Rhys')
        await expect(grid(page).getByRole('heading', { name: 'Toll Roads' })).toBeVisible()
        await expect(grid(page)).toContainText('Waiting on Dana.')
        await expect(answers(page).pay).toHaveCount(0)
    })

    test('Oracle at a Forced Labor site shows its toll; with no favor its row is hidden', async ({
        page
    }) => {
        await openTable(page, 'oracleToll')
        await usePower(page).click()
        const oracle = grid(page)
            .locator('div.flex.gap-2.items-start')
            .filter({ hasText: 'Oracle' })
        await expect(oracle).toContainText('+1 to Rhys')

        await openTable(page, 'oracleNoFavor')
        await usePower(page).click()
        await expect(grid(page)).toContainText('Whistle')
        await expect(grid(page).getByText('Oracle', { exact: true })).toHaveCount(0)
    })

    test.describe('on a phone', () => {
        test.use({ viewport: { width: 375, height: 812 } })

        test('Pay and Refuse are a standard size: one width, side by side, 44 px tall, never stretched', async ({
            page
        }) => {
            await openTable(page, 'tollAsked')
            const { pay, refuse } = answers(page)
            await expect(pay).toBeVisible()
            const [payBox, refuseBox, panelBox] = [
                await pay.boundingBox(),
                await refuse.boundingBox(),
                await grid(page).boundingBox()
            ]
            expect(payBox?.width).toBeCloseTo(refuseBox?.width ?? 0, 0)
            expect(payBox?.y).toBeCloseTo(refuseBox?.y ?? 0, 0)
            expect(payBox?.height ?? 0).toBeGreaterThanOrEqual(44)
            expect((payBox?.width ?? 999) + (refuseBox?.width ?? 999)).toBeLessThan(
                (panelBox?.width ?? 0) * 0.6
            )
        })
    })
})

const PLAINS = 'slot.provinces.1'
const skullPieces = (page: Page, where: string) =>
    grid(page).getByRole('button', { name: new RegExp(`^kill \\d+ ${where}$`) })

/**
 * R-5.5.5, revision 7 — after the roll the attacker picks where the skulls kill: one row of warband
 * pieces per place in the force, ringed rose once picked; "Kill" only at exactly the skulls.
 */
test.describe('the skulls’ losses, picked after the roll', () => {
    test('one row of warbands per place; a tap on the Nth kills N, a tap on the count kills none; Kill only at the total', async ({
        page
    }) => {
        await openTable(page, 'skullLosses')
        expect((await call(page, 'tableFacts')).seatId).toBe('dana')
        await expect(grid(page).locator('h3')).toHaveText('Battle')
        await expect(grid(page)).toContainText('Skulls: pick 2 to kill.')
        await expect(grid(page).getByText('on your board', { exact: true })).toBeVisible()
        await expect(grid(page).getByText('at p2', { exact: true })).toBeVisible()
        await expect(grid(page)).not.toContainText('Imperial')
        await expect(skullPieces(page, 'on your board')).toHaveCount(3)
        await expect(skullPieces(page, 'at p2')).toHaveCount(2)
        await expect(grid(page).getByRole('button', { name: /^kill 0 / })).toHaveCount(0)
        for (const piece of await skullPieces(page, '.+').all()) {
            await expect(piece).toHaveAttribute('aria-pressed', 'false')
            await expect(piece).not.toHaveAttribute('title')
            expect(await layoutSizeOf(piece)).toEqual({ width: 34, height: 32 })
        }
        const kill = answer(page, 'Kill')
        await expect(grid(page)).toContainText('Chosen 0 of 2')
        await expect(kill).toHaveCount(0)

        const board = skullPieces(page, 'on your board')
        const pressed = async () =>
            Promise.all((await board.all()).map((piece) => piece.getAttribute('aria-pressed')))
        await answer(page, 'kill 2 on your board').click()
        expect(await pressed()).toEqual(['true', 'true', 'false'])
        await expect(grid(page)).toContainText('Chosen 2 of 2')
        await expect(kill).toBeVisible()
        await answer(page, 'kill 2 on your board').click()
        expect(await pressed()).toEqual(['false', 'false', 'false'])
        await expect(kill).toHaveCount(0)

        await answer(page, 'kill 1 on your board').click()
        await answer(page, 'kill 2 at p2').click()
        await expect(grid(page)).toContainText('Chosen 3 of 2')
        await expect(kill).toHaveCount(0)
        await answer(page, 'kill 1 at p2').click()
        await expect(grid(page)).toContainText('Chosen 2 of 2')
        await expect(kill).toBeVisible()
        await kill.click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).machineState)
            .not.toBe('CampaignSkullLosses')
        const after = await call(page, 'tableFacts')
        expect(after.boardOf.dana).toEqual({ imperial: 2 })
        expect(after.warbandsAt[PLAINS]).toEqual({ imperial: 1 })
    })

    test('a picked warband that dies is ringed rose; a given token stays gold', async ({
        page
    }) => {
        await openTable(page, 'skullLosses')
        const piece = answer(page, 'kill 1 at p2')
        await piece.click()
        await expect(piece).toHaveClass(/ring-oath-danger/)
        await expect(piece).not.toHaveClass(/ring-oath-accent/)
        await expect(piece.locator('img')).toHaveCSS('opacity', '1')

        await offerToRhys(page)
        await answer(page, 'you give 1 favor').click()
        await expect(answer(page, 'you give 1 favor')).toHaveClass(/ring-oath-accent/)
        await expect(answer(page, 'you give 1 favor')).not.toHaveClass(/ring-oath-danger/)
    })

    test('Vow of Union: the board and each site it reaches, a row each', async ({ page }) => {
        await openTable(page, 'skullLossesTwoSites')
        await expect(grid(page)).toContainText('Skulls: pick 3 to kill.')
        await expect(skullPieces(page, 'on your board')).toHaveCount(1)
        await expect(skullPieces(page, 'at p2')).toHaveCount(2)
        await expect(skullPieces(page, 'at p3')).toHaveCount(2)
        for (const name of ['kill 1 on your board', 'kill 1 at p2', 'kill 1 at p3']) {
            await answer(page, name).click()
        }
        await expect(grid(page)).toContainText('Chosen 3 of 3')
        await expect(answer(page, 'Kill')).toBeVisible()
    })

    test('the defender waits on the attacker', async ({ page }) => {
        await openTable(page, 'skullLosses')
        expect(await call(page, 'viewOffTheClock')).toBe('rhys')
        await expectWaitingOn(page, ['dana'])
    })

    for (const viewport of [
        { width: 402, height: 874 },
        { width: 375, height: 812 }
    ]) {
        test(`at ${viewport.width}: every warband a 44 px tap target inside the panel, beside its row’s label`, async ({
            page
        }) => {
            await page.setViewportSize(viewport)
            await openTable(page, 'skullLossesTwoSites')
            const panel = await boxOf(grid(page))
            for (const piece of await skullPieces(page, '.+').all()) {
                expect(await layoutSizeOf(piece)).toEqual({ width: 44, height: 44 })
                expect(
                    inside(await boxOf(piece), panel),
                    (await piece.getAttribute('aria-label')) ?? ''
                ).toBe(true)
            }
            const label = await boxOf(grid(page).getByText('at p3', { exact: true }))
            const first = await boxOf(answer(page, 'kill 1 at p3'))
            expect(first.x).toBeGreaterThan(label.x + label.width)
            for (const name of ['kill 1 on your board', 'kill 1 at p2', 'kill 1 at p3']) {
                await answer(page, name).click()
            }
            const kill = answer(page, 'Kill')
            await kill.scrollIntoViewIfNeeded()
            expect((await layoutSizeOf(kill))?.height).toBeGreaterThanOrEqual(44)
            expect(inside(await boxOf(kill), await boxOf(grid(page)))).toBe(true)
            expect(await clippedLabels(page)).toEqual([])
        })
    }
})

/** The declare's attack dice and, in a game from before revision 7, the skulls' loss order. */
test.describe('the declare’s dice and loss order', () => {
    test('before revision 7 the loss order’s ↑ sits beside its row, not at the panel’s edge', async ({
        page
    }) => {
        await openTable(page, 'campaignLossOrder')
        await tile(page, 'Campaign').click()
        await expect(grid(page)).toContainText('Skull losses, in order:')
        const up = grid(page).getByRole('button', { name: /^Lose .+ sooner$/ })
        await expect(up).toHaveCount(1)
        const panel = await boxOf(grid(page))
        expect((await boxOf(up)).x).toBeLessThan(panel.x + panel.width / 2)
    })

    for (const viewport of [
        { width: 402, height: 874 },
        { width: 375, height: 812 }
    ]) {
        test(`at ${viewport.width}: each attack die and the loss order’s ↑ are 44 px`, async ({
            page
        }) => {
            await page.setViewportSize(viewport)
            await openTable(page, 'campaignLossOrder')
            await tile(page, 'Campaign').last().click()
            const dice = grid(page).getByRole('button', { name: /attack die \d/ })
            await expect(dice).toHaveCount(4)
            for (const die of await dice.all()) {
                expect(await layoutSizeOf(die)).toEqual({ width: 44, height: 44 })
            }
            const up = grid(page).getByRole('button', { name: /^Lose .+ sooner$/ })
            await up.scrollIntoViewIfNeeded()
            expect(await layoutSizeOf(up)).toEqual({ width: 44, height: 44 })
            expect(inside(await boxOf(up), await boxOf(grid(page)))).toBe(true)
        })
    }
})

/** R-5.5.6 — a force of one owner ends on one board whatever dies, so the defeat is not a pick. */
test('a sacrifice from a force in two places shows no “If you lose” rows; “Sacrifice nothing” at once', async ({
    page
}) => {
    await openTable(page, 'sacrificeInTwoPlaces')
    await expect(grid(page)).toContainText('To win, sacrifice 3:')
    await expect(grid(page)).not.toContainText('If you lose')
    await expect(answer(page, 'Sacrifice nothing')).toBeVisible()
})

const SLUM = 'slot.hinterland.0'

/**
 * Second Wind out of turn, revision 7: "After you're victorious, you may travel and then may
 * campaign, spending no Supply for either." Each is asked first, in the question form with the
 * card, then opens the action's own panel; Skip gives it up.
 */
test.describe('Second Wind out of turn: the free Travel, then the free Campaign', () => {
    test('"Travel now? Free." opens the lit map; Undo returns to the question; then "Campaign now? Free." opens the declare', async ({
        page
    }) => {
        await openTable(page, 'freeTravelAsked')
        expect((await call(page, 'tableFacts')).seatId).toBe('ann')
        await expect.poll(() => turnBar(page)).toEqual(["rhys's turn is paused", 'Act Phase'])
        await expect(question(page)).toHaveText('Travel now? Free.')
        await expect(
            grid(page).locator('.question-form').getByRole('img', { name: 'Second Wind' })
        ).toBeVisible()
        await expect(grid(page).getByRole('button', { name: /^(Travel|Skip)$/ })).toHaveCount(2)

        await answer(page, 'Travel').click()
        // On a desktop too the lit map is Travel's menu.
        await expect(travelPrompt(page)).toBeVisible()
        expect(await litSlots(page)).toContain(SLUM)
        await undoButton(page).click()
        await expect(question(page)).toHaveText('Travel now? Free.')

        await answer(page, 'Travel').click()
        await siteCard(page, SLUM).click()
        await expect.poll(async () => (await call(page, 'tableFacts')).siteOf.ann).toBe(SLUM)
        await expect(question(page)).toHaveText('Campaign now? Free.')
        await expect.poll(() => turnBar(page)).toEqual(["rhys's turn is paused", 'Act Phase'])

        await answer(page, 'Campaign').click()
        await expect(grid(page)).toContainText('Against dana.')
        await undoButton(page).click()
        await expect(question(page)).toHaveText('Campaign now? Free.')
    })

    test('Skip gives up the Travel and asks the Campaign; Skip again resumes the paused turn', async ({
        page
    }) => {
        await openTable(page, 'freeTravelAsked')
        await answer(page, 'Skip').click()
        await expect(question(page)).toHaveText('Campaign now? Free.')
        expect((await call(page, 'tableFacts')).siteOf.ann).not.toBe(SLUM)
        await answer(page, 'Skip').click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).machineState)
            .toBe('ActPhase')
        expect((await call(page, 'tableFacts')).seatId).toBe('rhys')
        await expect.poll(() => turnBar(page)).toEqual(['Your turn', 'Act Phase'])
    })

    test('"Campaign now? Free." with its card; Campaign opens the declare on the one legal defender', async ({
        page
    }) => {
        await openTable(page, 'freeCampaignAsked')
        await expect(question(page)).toHaveText('Campaign now? Free.')
        await expect(grid(page).getByRole('button', { name: /^(Campaign|Skip)$/ })).toHaveCount(2)
        await answer(page, 'Campaign').click()
        await expect(grid(page)).toContainText('Against dana.')
    })

    test('the other seats wait on the holder, and the turn player’s bar reads paused', async ({
        page
    }) => {
        await openTable(page, 'freeTravelAsked')
        expect(await call(page, 'viewOffTheClock')).toBe('rhys')
        await expectWaitingOn(page, ['ann'])
        await expect.poll(() => turnBar(page)).toEqual(['Your turn is paused', 'Act Phase'])
    })

    for (const viewport of [
        { width: 402, height: 874 },
        { width: 375, height: 812 }
    ]) {
        test(`at ${viewport.width}: the answers 44 px and inside the panel; Travel picks on the lit map`, async ({
            page
        }) => {
            await page.setViewportSize(viewport)
            await openTable(page, 'freeTravelAsked')
            const panel = await boxOf(grid(page))
            for (const name of ['Travel', 'Skip']) {
                const button = answer(page, name)
                expect((await layoutSizeOf(button))?.height).toBeGreaterThanOrEqual(44)
                expect(inside(await boxOf(button), panel)).toBe(true)
            }
            expect(await clippedLabels(page)).toEqual([])
            await answer(page, 'Travel').click()
            await expect(travelPrompt(page)).toBeVisible()
            expect((await litSlots(page)).length).toBeGreaterThan(0)
        })
    }
})

const WITCHS_BARGAIN = 'denizen.arcane.witchs-bargain'
const bargainEntry = (page: Page) => grid(page).locator(`[data-action-power="${WITCHS_BARGAIN}"]`)
const bargainChip = (page: Page, name: string) =>
    bargainEntry(page).getByRole('button', { name, exact: true })
const secretPieces = (page: Page, name: string) =>
    bargainEntry(page).getByRole('button', {
        name: new RegExp(`^give ${name} \\d+ secrets? for \\d+ favor$`)
    })
const favorPairs = (page: Page, name: string) =>
    bargainEntry(page).getByRole('button', {
        name: new RegExp(`^give ${name} \\d+ favor for \\d+ secrets?$`)
    })
const leftoverPieces = (page: Page) => bargainEntry(page).locator('[data-leftover-piece]')
const bargainUse = (page: Page) =>
    bargainEntry(page).getByRole('button', { name: 'Use, paying 1 secret', exact: true })

/**
 * Witch's Bargain, revision 7 (its Q&A: several players in one use). Dana (5 favor, 3 secrets),
 * Rhys (4, 2) and Ann (1, 1) share his site: "With:" and their chips, then two rows of his pieces
 * for each picked player.
 */
test.describe('Witch’s Bargain: the players at your site, then your pieces for each', () => {
    test('the chips first; a pick opens that player’s rows, held to them; the cost secret and the lone favor never tap; Use waits for a count', async ({
        page
    }) => {
        await openTable(page, 'witchsBargain')
        await usePower(page).click()
        await expect(bargainEntry(page)).toContainText('With:')
        for (const name of ['rhys', 'ann']) {
            await expect(bargainChip(page, name)).toHaveAttribute('aria-pressed', 'false')
        }
        await expect(bargainEntry(page).locator('[data-bargain-with]')).toHaveCount(0)
        await expect(bargainUse(page)).toHaveCount(0)

        await bargainChip(page, 'rhys').click()
        await expect(bargainChip(page, 'rhys')).toHaveAttribute('aria-pressed', 'true')
        await expect(secretPieces(page, 'rhys')).toHaveCount(3)
        const secrets = await secretPieces(page, 'rhys').all()
        await expect(secrets[0]).toBeEnabled()
        await expect(secrets[1]).toBeEnabled()
        // The 3rd secret is the one the cost places.
        await expect(secrets[2]).toBeDisabled()
        for (const piece of secrets)
            expect(await layoutSizeOf(piece)).toEqual({ width: 34, height: 32 })
        // 5 favor: two pairs, each one button holding both pieces, and the 5th alone, never a button.
        await expect(favorPairs(page, 'rhys')).toHaveCount(2)
        for (const pair of await favorPairs(page, 'rhys').all()) {
            await expect(pair).toBeEnabled()
            await expect(pair.locator('img')).toHaveCount(2)
            expect(await layoutSizeOf(pair)).toEqual({ width: 54, height: 32 })
        }
        await expect(leftoverPieces(page)).toHaveCount(1)
        await expect(leftoverPieces(page).locator('xpath=ancestor-or-self::button')).toHaveCount(0)
        await expect(bargainUse(page)).toHaveCount(0)

        await answer(page, 'give rhys 1 secret for 2 favor').click()
        await expect(bargainUse(page)).toBeVisible()
        await expect(bargainUse(page).locator('.text-oath-accent')).toBeVisible()
        await answer(page, 'give rhys 2 favor for 1 secret').click()
        await expect(answer(page, 'give rhys 2 favor for 1 secret')).toHaveAttribute(
            'aria-pressed',
            'true'
        )
        await expect(answer(page, 'give rhys 2 favor for 1 secret')).toHaveClass(/ring-oath-accent/)

        // Undo takes back the last pick, one at a time.
        await undoButton(page).click()
        await expect(answer(page, 'give rhys 2 favor for 1 secret')).toHaveAttribute(
            'aria-pressed',
            'false'
        )
        await expect(answer(page, 'give rhys 1 secret for 2 favor')).toHaveAttribute(
            'aria-pressed',
            'true'
        )
        await undoButton(page).click()
        await expect(answer(page, 'give rhys 1 secret for 2 favor')).toHaveAttribute(
            'aria-pressed',
            'false'
        )
        await expect(bargainUse(page)).toHaveCount(0)
        await undoButton(page).click()
        await expect(bargainChip(page, 'rhys')).toHaveAttribute('aria-pressed', 'false')
        await expect(bargainEntry(page).locator('[data-bargain-with]')).toHaveCount(0)
    })

    test('two players in one use: each their own rows, Ann’s held to her one favor and one secret; Use sends both', async ({
        page
    }) => {
        await openTable(page, 'witchsBargain')
        await usePower(page).click()
        await bargainChip(page, 'rhys').click()
        await bargainChip(page, 'ann').click()
        await expect(bargainEntry(page).locator('[data-bargain-with]')).toHaveCount(2)
        // One favor buys none of Dana's secrets; her last secret can be taken for a pair.
        for (const piece of await secretPieces(page, 'ann').all())
            await expect(piece).toBeDisabled()
        const annPairs = await favorPairs(page, 'ann').all()
        await expect(annPairs[0]).toBeEnabled()
        await expect(annPairs[1]).toBeDisabled()

        await answer(page, 'give rhys 2 secrets for 4 favor').click()
        await answer(page, 'give rhys 2 favor for 1 secret').click()
        await answer(page, 'give ann 2 favor for 1 secret').click()
        // Ann's pair leaves Rhys no second one.
        await expect(answer(page, 'give rhys 4 favor for 2 secrets')).toBeDisabled()
        await bargainUse(page).click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).secretsOn[WITCHS_BARGAIN])
            .toBe(1)
        const facts = await call(page, 'tableFacts')
        expect(facts.secretsOf).toEqual({ dana: 2, rhys: 3, ann: 0 })
        expect(facts.favorOf).toEqual({ dana: 5, rhys: 2, ann: 3 })
    })

    test('one other player at your site: their chip starts picked and their rows open; a tap keeps them; Use waits for a count', async ({
        page
    }) => {
        await openTable(page, 'witchsBargainOneOther')
        await usePower(page).click()
        await expect(bargainChip(page, 'ann')).toHaveCount(0)
        await expect(bargainChip(page, 'rhys')).toHaveAttribute('aria-pressed', 'true')
        await expect(bargainChip(page, 'rhys')).toHaveClass(/ring-oath-accent/)
        await expect(bargainEntry(page).locator('[data-bargain-with="rhys"]')).toHaveCount(1)
        await expect(secretPieces(page, 'rhys')).toHaveCount(3)
        await expect(favorPairs(page, 'rhys')).toHaveCount(2)
        await expect(bargainUse(page)).toHaveCount(0)

        // The pick is required: a tap on the one chip does not drop Rhys.
        await bargainChip(page, 'rhys').click()
        await expect(bargainChip(page, 'rhys')).toHaveAttribute('aria-pressed', 'true')
        await expect(favorPairs(page, 'rhys')).toHaveCount(2)
        await expect(bargainUse(page)).toHaveCount(0)

        await answer(page, 'give rhys 2 favor for 1 secret').click()
        await expect(bargainUse(page)).toBeVisible()
        // Undo takes back the pair; Rhys stays picked.
        await undoButton(page).click()
        await expect(answer(page, 'give rhys 2 favor for 1 secret')).toHaveAttribute(
            'aria-pressed',
            'false'
        )
        await expect(bargainChip(page, 'rhys')).toHaveAttribute('aria-pressed', 'true')
        await expect(bargainUse(page)).toHaveCount(0)
    })

    test('with Vow of Silence there is no secrets row; the favor row stays', async ({ page }) => {
        await openTable(page, 'witchsBargainSilenced')
        await usePower(page).click()
        await bargainChip(page, 'rhys').click()
        await expect(bargainEntry(page).locator('[data-bargain-row="secrets"]')).toHaveCount(0)
        await expect(secretPieces(page, 'rhys')).toHaveCount(0)
        await expect(bargainEntry(page).locator('[data-bargain-row="pairs"]')).toHaveCount(1)
        await expect(favorPairs(page, 'rhys')).toHaveCount(2)
    })

    for (const viewport of [
        { width: 402, height: 874 },
        { width: 375, height: 812 }
    ]) {
        test(`at ${viewport.width}: every chip, piece and pair a 44 px target inside the panel; Use 44 px`, async ({
            page
        }) => {
            await page.setViewportSize(viewport)
            await openTable(page, 'witchsBargain')
            await usePower(page).click()
            await bargainChip(page, 'rhys').click()
            await bargainChip(page, 'ann').click()
            const panel = await boxOf(grid(page))
            for (const name of ['rhys', 'ann']) {
                const chip = bargainChip(page, name)
                expect((await layoutSizeOf(chip))?.height, `${name}'s chip`).toBeGreaterThanOrEqual(
                    44
                )
                for (const piece of await secretPieces(page, name).all()) {
                    expect(await layoutSizeOf(piece)).toEqual({ width: 44, height: 44 })
                    expect(
                        inside(await boxOf(piece), panel),
                        (await piece.getAttribute('aria-label')) ?? ''
                    ).toBe(true)
                }
                for (const pair of await favorPairs(page, name).all()) {
                    expect(await layoutSizeOf(pair)).toEqual({ width: 66, height: 44 })
                    expect(
                        inside(await boxOf(pair), panel),
                        (await pair.getAttribute('aria-label')) ?? ''
                    ).toBe(true)
                }
            }
            for (const lone of await leftoverPieces(page).all()) {
                expect(await layoutSizeOf(lone)).toEqual({ width: 44, height: 44 })
            }
            // The chips share one width.
            const widths = await Promise.all(
                ['rhys', 'ann'].map(
                    async (name) => (await layoutSizeOf(bargainChip(page, name)))?.width
                )
            )
            expect(widths[0]).toBe(widths[1])
            await answer(page, 'give rhys 1 secret for 2 favor').click()
            const use = bargainUse(page)
            await use.scrollIntoViewIfNeeded()
            expect((await layoutSizeOf(use))?.height).toBeGreaterThanOrEqual(44)
            expect(inside(await boxOf(use), await boxOf(grid(page)))).toBe(true)
            expect(await clippedLabels(page)).toEqual([])
        })
    }
})

/** Dragonskin Drum when a power moves its holder (revision 7): one question after the move, in the Toll Roads form. */
test.describe('Dragonskin Drum when a power moves its holder', () => {
    const answers = (page: Page) => ({
        gain: grid(page).getByRole('button', { name: 'Gain', exact: true }),
        skip: grid(page).getByRole('button', { name: 'Skip', exact: true })
    })
    const lineToken = (page: Page) => grid(page).locator('.question-line img[alt="warband"]')

    test('after the Whistle the holder is asked "Gain 1 [warband]?" beside the Drum; Gain adds it, and the History says so after the move', async ({
        page
    }) => {
        expect((await openTable(page, 'drumAsked')).seatId).toBe('Dana')
        expect((await call(page, 'tableFacts')).siteOf.Dana).toBe('slot.provinces.1')
        await expect(grid(page).getByRole('heading', { name: 'Dragonskin Drum' })).toBeVisible()
        await expect(grid(page).locator('.question-line')).toHaveText('Gain 1?')
        await expect(lineToken(page)).toHaveAttribute('src', /warband\.blue/)
        await expect(grid(page).locator('.question-form img[alt="Dragonskin Drum"]')).toBeVisible()
        const { gain, skip } = answers(page)
        const [gainBox, skipBox] = [await gain.boundingBox(), await skip.boundingBox()]
        // Desktop: one width, the wider label's, side by side, never stretched; Gain is the primary.
        expect(gainBox?.width).toBeCloseTo(skipBox?.width ?? 0, 0)
        expect(gainBox?.y).toBeCloseTo(skipBox?.y ?? 0, 0)
        expect(gainBox?.width ?? 999).toBeLessThan(120)
        await expect(gain).toHaveClass(/border-oath-primary-border/)
        await expect(skip).not.toHaveClass(/border-oath-primary-border/)

        await gain.click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).boardOf.Dana)
            .toEqual({ Dana: 3 })
        await page.getByRole('tab', { name: 'History' }).click()
        const rows = page.locator('.history .timeline-item')
        await expect(rows.nth(0)).toContainText('+1 (Dragonskin Drum)')
        await expect(rows.nth(0).locator('img[alt="warband"]')).toHaveAttribute(
            'src',
            /warband\.blue/
        )
        await expect(rows.nth(0)).toContainText('Dana')
        await expect(rows.nth(1)).toContainText(
            'used Whistle, placing 1 on it: Dana traveled to Great Slum'
        )
    })

    test('Skip gains nothing', async ({ page }) => {
        await openTable(page, 'drumAsked')
        await answers(page).skip.click()
        await expect(answers(page).skip).toHaveCount(0)
        expect((await call(page, 'tableFacts')).boardOf.Dana).toEqual({ Dana: 2 })
        await page.getByRole('tab', { name: 'History' }).click()
        await expect(page.locator('.history .timeline-item').nth(0)).toContainText(
            'skipped the Dragonskin Drum'
        )
    })

    test('the mover reads only who they are waiting on', async ({ page }) => {
        await openTable(page, 'drumAsked')
        expect(await call(page, 'viewOffTheClock')).toBe('Rhys')
        await expect(grid(page)).toContainText('Waiting on Dana.')
        await expect(answers(page).gain).toHaveCount(0)
        await expect(answers(page).skip).toHaveCount(0)
    })

    test('a Citizen is asked for the Empire’s purple warband, and gains it from the Chancellor’s bank', async ({
        page
    }) => {
        await openTable(page, 'drumAskedCitizen')
        await expect(lineToken(page)).toHaveAttribute('src', /warband\.purple/)
        await answers(page).gain.click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).boardOf.Dana)
            .toEqual({ imperial: 3 })
        await page.getByRole('tab', { name: 'History' }).click()
        await expect(
            page.locator('.history .timeline-item').nth(0).locator('img[alt="warband"]')
        ).toHaveAttribute('src', /warband\.purple/)
    })

    test('with Toll Roads the toll comes first: paid, the Drum is asked next; refused, it is not', async ({
        page
    }) => {
        await openTable(page, 'drumAfterToll')
        await expect(grid(page).getByRole('heading', { name: 'Toll Roads' })).toBeVisible()
        await expect(answers(page).gain).toHaveCount(0)
        await grid(page).getByRole('button', { name: 'Pay', exact: true }).click()
        await expect(grid(page).getByRole('heading', { name: 'Dragonskin Drum' })).toBeVisible()
        await expect(answers(page).gain).toBeVisible()

        await openTable(page, 'drumAfterToll')
        await grid(page).getByRole('button', { name: 'Refuse', exact: true }).click()
        await expect.poll(async () => await call(page, 'openQuestionKind')).toBeUndefined()
        expect((await call(page, 'tableFacts')).siteOf.Dana).toBe('slot.provinces.2')
    })

    test('after Brass Horse its user is asked the same question once they arrive', async ({
        page
    }) => {
        await openTable(page, 'drumAfterBrassHorse')
        await siteCard(page, 'slot.provinces.1').click()
        await expect(grid(page).getByRole('heading', { name: 'Dragonskin Drum' })).toBeVisible()
        expect((await call(page, 'tableFacts')).siteOf.Dana).toBe('slot.provinces.1')
        await expect(answers(page).gain).toBeVisible()
    })

    for (const viewport of [
        { width: 402, height: 874 },
        { width: 375, height: 812 }
    ]) {
        test.describe(`on a phone ${viewport.width} wide`, () => {
            test.use({ viewport })

            test('Gain and Skip: one width, side by side, 44 px tall, inside the panel, never stretched', async ({
                page
            }) => {
                await openTable(page, 'drumAsked')
                const { gain, skip } = answers(page)
                await expect(gain).toBeVisible()
                const [gainBox, skipBox, panelBox] = [
                    await gain.boundingBox(),
                    await skip.boundingBox(),
                    await grid(page).boundingBox()
                ]
                expect(gainBox?.width).toBeCloseTo(skipBox?.width ?? 0, 0)
                expect(gainBox?.y).toBeCloseTo(skipBox?.y ?? 0, 0)
                expect(gainBox?.height ?? 0).toBeGreaterThanOrEqual(44)
                expect(skipBox?.height ?? 0).toBeGreaterThanOrEqual(44)
                expect((gainBox?.width ?? 999) + (skipBox?.width ?? 999)).toBeLessThan(
                    (panelBox?.width ?? 0) * 0.6
                )
                expect((skipBox?.x ?? 0) + (skipBox?.width ?? 0)).toBeLessThanOrEqual(
                    (panelBox?.x ?? 0) + (panelBox?.width ?? 0)
                )
                expect(await clippedLabels(page)).toEqual([])
            })
        })
    }
})

/**
 * "Look on the table, choose in the menus": no element in Oath's own areas has a hover title. What a
 * picture or a symbol means is its accessible name; anything a player needs is on screen, in the
 * enlarged card or in the open seat. The platform's own controls around them (the history controls,
 * the tabs, the chat, the board's zoom buttons) are not Oath's and are not read here.
 */
test.describe('no hover titles in Oath’s own areas', () => {
    /** The panel column, the seat cards, the History, the board and its rail, and the open layers. */
    const OATH_AREAS = [
        '.info',
        '.panel',
        '.seat',
        '.history',
        '.board-surface',
        '.seat-detail',
        '.goals-layer',
        '.card-preview',
        '.since-last-turn',
        '.chooser',
        '.map-pick-framing'
    ]

    /** Every element in those areas whose `title` is not empty, as "tag.class: title". */
    async function hoverTitles(page: Page) {
        return page.evaluate((areas) => {
            const inAreas = new Set(
                areas.flatMap((area) => [...document.querySelectorAll(`${area}, ${area} *`)])
            )
            return [...inAreas]
                .filter((element) => (element.getAttribute('title') ?? '') !== '')
                .map(
                    (element) =>
                        `${element.tagName.toLowerCase()}.${[...element.classList].join('.')}: ${element.getAttribute('title')}`
                )
        }, OATH_AREAS)
    }

    async function expectNoHoverTitles(page: Page, where: string) {
        await expect(grid(page).first()).toBeVisible()
        expect.soft(await hoverTitles(page), where).toEqual([])
    }

    test('the Act Phase: the grid, the seat cards, the map and the rail; a muster menu; the open seat; an enlarged site', async ({
        page
    }) => {
        await openTable(page, 'trade')
        await expectNoHoverTitles(page, 'the Act Phase grid')
        await tile(page, 'Muster').click()
        await expect(page.getByRole('list', { name: 'Musters at your site' })).toBeVisible()
        await expectNoHoverTitles(page, 'the Muster menu')

        await page.locator('.seat .pill').nth(1).click()
        await expect(page.locator('.seat-detail')).toBeVisible()
        await expectNoHoverTitles(page, 'the open seat')
        await page.keyboard.press('Escape')
        await expect(page.locator('.seat-detail')).toHaveCount(0)

        await (await uncovered(page, '.site .board-card')).click()
        await expect(preview(page)).toBeVisible()
        await expectNoHoverTitles(page, 'the enlarged site')
    })

    test('Travel: the lit sites and their chips, and the ways to pay', async ({ page }) => {
        await openTable(page, 'leavingBuriedGiant')
        await tile(page, 'Travel').click()
        await expect(travelPrompt(page)).toBeVisible()
        await expectNoHoverTitles(page, 'the lit sites')
        await siteCard(page, 'slot.provinces.0').click()
        await expect(
            grid(page).getByRole('button', { name: /^Travel to .+: spend 2 Supply$/ })
        ).toBeVisible()
        await expectNoHoverTitles(page, 'the ways to pay')
    })

    test('the goals rail and the open goals', async ({ page }) => {
        await openTable(page, 'goalsRail')
        await expectNoHoverTitles(page, 'the goals rail')
        await page.getByRole('button', { name: 'Goals: open the enlarged view' }).click()
        await expect(page.getByRole('dialog', { name: 'Goals' })).toBeVisible()
        await expectNoHoverTitles(page, 'the open goals')

        await openTable(page, 'goalsRailDevotion')
        await expectNoHoverTitles(page, 'a banner Oath’s holder')
    })

    test('a Campaign: the attack dice, the plans, the unrolled and the rolled dice, the spoils', async ({
        page
    }) => {
        await openTable(page, 'campaign')
        await tile(page, 'Campaign').click()
        await expect(grid(page).getByRole('button', { name: /^Add attack die 2/ })).toBeVisible()
        await expectNoHoverTitles(page, 'the attack dice')

        await openTable(page, 'defenderPlans')
        await expect(grid(page).getByRole('region', { name: "the Campaign's dice" })).toBeVisible()
        await expectNoHoverTitles(page, 'the unrolled dice and the plans')

        await openTable(page, 'exileDefeated')
        await expect(
            grid(page).getByRole('region', { name: "the Campaign's dice" }).locator('img').first()
        ).toBeVisible()
        await expectNoHoverTitles(page, 'the rolled dice')

        await openTable(page, 'spoils')
        await expect(grid(page).locator('h3')).toHaveText('Spoils')
        await expectNoHoverTitles(page, 'the spoils')
    })

    test('Use a power, a modifier row, Recover, the older Rest, the Wake, the end die and the History', async ({
        page
    }) => {
        await openTable(page, 'usePower')
        await usePower(page).click()
        await expectNoHoverTitles(page, 'Use a power')

        await openTable(page, 'harpSearch')
        await tile(page, 'Search').click()
        await expect(grid(page).locator('button[aria-pressed]').first()).toBeVisible()
        await expectNoHoverTitles(page, 'a modifier’s card row')

        await openTable(page, 'recover')
        await tile(page, 'Recover').click()
        await expect(page.getByRole('list', { name: 'Banners to recover' })).toBeVisible()
        await expectNoHoverTitles(page, 'Recover')

        await openTable(page, 'restBanks')
        await expect(
            grid(page)
                .getByRole('button', { name: /bank, \d+ favor$/ })
                .first()
        ).toBeVisible()
        await expectNoHoverTitles(page, 'the older Rest panel')

        await openTable(page, 'wakeMob')
        await expect(grid(page)).toContainText('People’s Favor (1 of 2)')
        await expectNoHoverTitles(page, 'the Wake')

        await openTable(page, 'endOfRound')
        await expect(grid(page).getByRole('button', { name: 'Roll the end die' })).toBeVisible()
        await expectNoHoverTitles(page, 'the End die panel')
        await grid(page).getByRole('button', { name: 'Roll the end die' }).click()
        await page.getByRole('tab', { name: 'History' }).click()
        await expect(page.locator('[data-major-event="endDie"]')).toBeVisible()
        await expectNoHoverTitles(page, 'the end die')

        await openTable(page, 'majorEvents')
        await page.getByRole('tab', { name: 'History' }).click()
        await expect(page.locator('[data-major-event="visionDrawn"]')).toBeVisible()
        await expectNoHoverTitles(page, 'the History')
    })

    test('the open seat: "favor, in the [Nomad] bank" with the bank’s symbol, and "Exile · at" its site', async ({
        page
    }) => {
        await openTable(page, 'kinshipSeat')
        await page.locator('.seat .pill', { hasText: 'me' }).click()
        const seat = page.getByRole('dialog', { name: "me's seat" })
        await expect(seat).toBeVisible()
        await expect(seat.locator('.status')).toHaveText(/^Exile · at \S/)
        await expect(seat.locator('.status')).toHaveCSS('text-transform', 'none')
        const favor = seat.locator('.counters dt').first()
        await expect(favor).toHaveText(/^favor, in the\s+bank$/)
        await expect(favor.getByRole('img', { name: 'Nomad', exact: true })).toBeVisible()
        await expectNoHoverTitles(page, 'the open seat')
    })

    test('a name pill’s accessible name opens the seat and keeps its words, the player’s own pill “you” as it shows', async ({
        page
    }) => {
        await openTable(page, 'trade')
        const own = page.locator('.seat .pill', { hasText: 'you' })
        await expect(own).toHaveText('me · you')
        await expect(own).toHaveAccessibleName("Open me's seat (you)")
        await expect(page.locator('.seat .pill', { hasText: 'ann' })).toHaveAccessibleName(
            "Open ann's seat"
        )
    })

    test('the Rest in a game created before the turn-flow revision lists only the powers the engine accepts', async ({
        page
    }) => {
        await openTable(page, 'restRefused')
        await expect(grid(page)).toContainText('Vow of Obedience')
        await expect(grid(page)).not.toContainText('Vow of Poverty')
        await expect(
            grid(page)
                .getByRole('button', { name: /bank, \d+ favor$/ })
                .first()
        ).toBeVisible()
        await expectNoHoverTitles(page, 'the older Rest panel with a refused power')
    })
})

/**
 * docs/ui-interaction-visual-contract.md, "A card that changes an action" and the menus: an
 * action's optional cards are framed rows under "Cards", the free gains start in use, a card in use
 * applies to the rows it fits, and two cards that only together make an action possible are one
 * entry in Use a power.
 */
test.describe('the cards in every action’s menu', () => {
    const cards = (page: Page) => grid(page).locator('[data-card-row] button[aria-pressed]')
    const tag = (toggle: Locator) => toggle.getByText('in use', { exact: true })
    const lineOf = (page: Page, cardId: string) => cardToggle(page, cardId).locator('.text-xs')

    test('Travel: under "Cards", the Drum starts in use; Tents and Special Envoy are off, each with its line', async ({
        page
    }) => {
        await openTable(page, 'modifierTravel')
        await tile(page, 'Travel').click()
        await expect(grid(page).getByRole('heading', { name: 'Cards', exact: true })).toBeVisible()
        await expect(grid(page)).not.toContainText('Tap a card to use it')
        const drum = cardToggle(page, 'relic.dragonskin-drum')
        await expect(drum).toHaveAttribute('aria-pressed', 'true')
        await expect(tag(drum)).toBeVisible()
        for (const cardId of ['denizen.nomad.tents', 'denizen.nomad.special-envoy']) {
            await expect(cardToggle(page, cardId)).toHaveAttribute('aria-pressed', 'false')
            await expect(tag(cardToggle(page, cardId))).toBeHidden()
        }
        expect(await tokenRuns(lineOf(page, 'relic.dragonskin-drum'))).toEqual([['+ 1', 'text']])
        await expect(
            lineOf(page, 'relic.dragonskin-drum').getByRole('img', { name: 'warband' })
        ).toBeVisible()
        expect(await tokenRuns(lineOf(page, 'denizen.nomad.tents'))).toEqual([
            ['0 Supply', 'text'],
            ['·', 'text-muted'],
            ['1', 'accent']
        ])
        expect(await tokenRuns(lineOf(page, 'denizen.nomad.special-envoy'))).toEqual([
            ['0 Supply', 'text'],
            ['·', 'text-muted'],
            ['ends your Act Phase', 'danger']
        ])
        await expectOneWidth(cards(page))
        await expect(grid(page).locator('[title]')).toHaveCount(0)
        await expect(
            cardRow(page, 'relic.dragonskin-drum').getByRole('button', {
                name: 'Enlarge Dragonskin Drum',
                exact: true
            })
        ).toBeVisible()
    })

    test('Travel: a lit site’s tap travels with the Drum in use; a tap puts it down; Undo brings it back', async ({
        page
    }) => {
        await openTable(page, 'modifierTravel')
        await tile(page, 'Travel').click()
        const drum = cardToggle(page, 'relic.dragonskin-drum')
        await drum.click()
        await expect(drum).toHaveAttribute('aria-pressed', 'false')
        await expect(tag(drum)).toBeHidden()
        await undoButton(page).click()
        await expect(drum).toHaveAttribute('aria-pressed', 'true')
        await expect.poll(async () => (await call(page, 'tableFacts')).staged).toBe('travel')

        const [slot] = await litSlots(page)
        if (slot === undefined) throw Error('A site is lit')
        await siteCard(page, slot).click()
        await expect.poll(async () => (await call(page, 'tableFacts')).siteOf.me).toBe(slot)
        expect((await call(page, 'tableFacts')).boardOf.me.me ?? 0).toBe(1)
    })

    test('Muster: Rowdy Pub in use applies to its own row; the other Musters stay listed without it', async ({
        page
    }) => {
        await openTable(page, 'modifierMuster')
        await tile(page, 'Muster').click()
        await expect(cardToggle(page, 'denizen.hearth.rowdy-pub')).toHaveAttribute(
            'aria-pressed',
            'true'
        )
        const muster = (name: string) =>
            grid(page).getByRole('button', { name: new RegExp(`^Muster at ${name}:`) })
        await expect(muster('Rowdy Pub')).toHaveAccessibleName(
            'Muster at Rowdy Pub: place 1 favor, get 3 warbands'
        )
        await expect(muster('Forced Labor')).toHaveAccessibleName(
            'Muster at Forced Labor: place 1 favor, get 2 warbands'
        )
        await expect(muster('Oracle')).toHaveAccessibleName(
            'Muster at Oracle: place 1 favor, get 2 warbands'
        )

        await muster('Forced Labor').click()
        await expect.poll(async () => (await call(page, 'tableFacts')).boardOf.me.me ?? 0).toBe(2)
    })

    test('Trade: Birdsong starts in use; Awaited Return’s consequence in rose; Master of Disguise’s cost in gold', async ({
        page
    }) => {
        await openTable(page, 'modifierTrade')
        await tile(page, 'Trade').click()
        await expect(cardToggle(page, 'denizen.beast.birdsong')).toHaveAttribute(
            'aria-pressed',
            'true'
        )
        await expect(cardToggle(page, 'denizen.hearth.awaited-return')).toHaveAttribute(
            'aria-pressed',
            'false'
        )
        await expect(cardToggle(page, 'denizen.arcane.master-of-disguise')).toHaveAttribute(
            'aria-pressed',
            'false'
        )
        expect(await tokenRuns(lineOf(page, 'denizen.hearth.awaited-return'))).toEqual([
            ['0 Supply', 'text'],
            ['·', 'text-muted'],
            ['sacrifice 1', 'danger']
        ])
        expect(await tokenRuns(lineOf(page, 'denizen.arcane.master-of-disguise'))).toEqual([
            ['another player’s advisers', 'text'],
            ['·', 'text-muted'],
            ['1', 'accent']
        ])
        await expectOneWidth(cards(page))
    })

    test('Search: Wild Cry and Welcoming Party start in use', async ({ page }) => {
        await openTable(page, 'modifierSearch')
        await tile(page, 'Search').click()
        for (const cardId of ['denizen.beast.wild-cry', 'denizen.hearth.welcoming-party']) {
            await expect(cardToggle(page, cardId)).toHaveAttribute('aria-pressed', 'true')
        }
        expect(await tokenRuns(lineOf(page, 'denizen.beast.wild-cry'))).toEqual([
            ['+1 Supply + 2', 'text']
        ])
    })

    test('a pair: the ring lights for a Trade only Birdsong and Small Friends make possible; one entry, "Trade with both", both stay in use', async ({
        page
    }) => {
        await openTable(page, 'modifierPair')
        await tile(page, 'Trade').click({ force: true })
        await expect(ringedBy(page)).toHaveCount(1)
        await usePower(page).click()
        const entry = grid(page).locator(
            '[data-action-card="denizen.beast.birdsong denizen.beast.small-friends"]'
        )
        await expect(entry).toBeVisible()
        await expect(entry.locator('.text-sm')).toHaveText(
            /^\s*Birdsong \+ Small Friends\s*— Trade\s*$/
        )
        await expect(entry.locator('p')).toContainText('free')
        for (const name of ['Birdsong', 'Small Friends']) {
            await expect(
                entry.getByRole('button', { name: `Enlarge ${name}`, exact: true })
            ).toBeVisible()
        }
        await entry.getByRole('button', { name: 'Trade with both', exact: true }).click()
        for (const cardId of ['denizen.beast.birdsong', 'denizen.beast.small-friends']) {
            await expect(cardToggle(page, cardId)).toHaveAttribute('aria-pressed', 'true')
        }
        await cardToggle(page, 'denizen.beast.birdsong').click()
        await expect(cardToggle(page, 'denizen.beast.birdsong')).toHaveAttribute(
            'aria-pressed',
            'true'
        )
        await expect(grid(page).getByRole('button', { name: /^Trade with Wolves:/ })).toHaveCount(2)
        await undoButton(page).click()
        await expect(entry).toBeVisible()
    })

    test('Use a power: each card’s entry gives the line its menu row gives, before its cost', async ({
        page
    }) => {
        await openTable(page, 'usePower')
        await usePower(page).click()
        expect(await tokenRuns(actionCard(page, 'denizen.nomad.tents').locator('p'))).toEqual([
            ['0 Supply', 'text'],
            ['·', 'text-muted'],
            ['put 1 on it', 'accent']
        ])
    })

    for (const viewport of [
        { width: 402, height: 874 },
        { width: 375, height: 812 }
    ]) {
        test.describe(`on a ${viewport.width} px phone`, () => {
            test.use({ viewport })

            test('each card row is 44 px tall at least, inside the panel, one width; no hover title', async ({
                page
            }) => {
                for (const [scene, action] of [
                    ['modifierTravel', 'Travel'],
                    ['modifierTrade', 'Trade']
                ] as const) {
                    await openTable(page, scene)
                    await tile(page, action).click()
                    const rows = cards(page)
                    await expect(rows.first()).toBeVisible()
                    const panel = await boxOf(grid(page))
                    for (const row of await rows.all()) {
                        // Laid out at 44 px, whatever the fitted panel's scale draws it at.
                        const height = await row.evaluate((element) =>
                            element instanceof HTMLElement ? element.offsetHeight : 0
                        )
                        expect(
                            height,
                            `${await row.textContent()}: 44 tall`
                        ).toBeGreaterThanOrEqual(44)
                        expect(
                            inside(await boxOf(row), panel),
                            `${await row.textContent()}: inside the panel`
                        ).toBe(true)
                    }
                    await expectOneWidth(rows)
                    await expect(grid(page).locator('[title]')).toHaveCount(0)
                    expect(await clippedLabels(page)).toEqual([])
                }
            })
        })
    }
})

/**
 * Play a facedown adviser (R-6.1, R-7.4): the card large on the left, the plays and every later step
 * in one column beside it; each Search card the play may use in the step it changes.
 */
test.describe('the facedown play: the card beside its plays, each card in the step it changes', () => {
    const playCard = (page: Page) => grid(page).locator('[data-play-card]')
    const column = (page: Page) => grid(page).locator('[data-play-column]')
    // "To your site" carries what the play gains: "To your site: War Tortoise, +1 favor".
    const plays = (page: Page) =>
        column(page).getByRole('button', { name: /: War Tortoise(, .+)?$/ })
    const confirm = (page: Page, word: 'Play' | 'Discard') =>
        grid(page).getByRole('button', { name: `${word} War Tortoise`, exact: true })
    const history = (page: Page) => page.locator('.history')
    const cardHeight = (page: Page) =>
        playCard(page)
            .locator('img')
            .first()
            .evaluate((image) => (image instanceof HTMLElement ? image.offsetHeight : 0))

    /** The panel's box inside its border and padding, as drawn (the panel may be fitted smaller). */
    const panelContent = (page: Page): Promise<Box> =>
        grid(page).evaluate((panel) => {
            const box = panel.getBoundingClientRect()
            const style = getComputedStyle(panel)
            const scale =
                panel instanceof HTMLElement && panel.offsetWidth > 0
                    ? box.width / panel.offsetWidth
                    : 1
            const inset = (side: 'left' | 'right' | 'top' | 'bottom') =>
                (parseFloat(style.getPropertyValue(`padding-${side}`)) +
                    parseFloat(style.getPropertyValue(`border-${side}-width`))) *
                scale
            return {
                x: box.x + inset('left'),
                y: box.y + inset('top'),
                width: box.width - inset('left') - inset('right'),
                height: box.height - inset('top') - inset('bottom')
            }
        })

    async function choose(page: Page, scene: TableFixture.TableName, play?: string) {
        await openTable(page, scene)
        await grid(page).getByRole('button', { name: 'Adviser', exact: true }).click()
        if (play)
            await grid(page)
                .getByRole('button', { name: new RegExp(`^${play}: War Tortoise(, .+)?$`) })
                .click()
    }

    test('one facedown adviser opens at once: the card 280 px tall, ringed, its magnifier; the plays in one column to its right, one width', async ({
        page
    }) => {
        await choose(page, 'facedownCards')
        await expect(playCard(page)).toBeVisible()
        // Laid out 280 px tall, to the pixel the card's width rounds to.
        expect(Math.abs((await cardHeight(page)) - 280)).toBeLessThanOrEqual(1)
        await expect(playCard(page)).toHaveClass(/ring-2/)
        await expect(
            playCard(page).getByRole('button', { name: 'Enlarge War Tortoise', exact: true })
        ).toBeVisible()
        await expect(plays(page)).toHaveText([/^To your site/, 'Turn faceup', 'Discard'])
        await expectOneWidth(plays(page))
        const card = await boxOf(playCard(page))
        const panel = await boxOf(grid(page))
        const boxes = await boxesOf(plays(page))
        for (const [i, box] of boxes.entries()) {
            expect(box.x, 'beside the card').toBeGreaterThan(card.x + card.width)
            expect(Math.abs(box.x - (boxes[0]?.x ?? 0)), 'one column').toBeLessThanOrEqual(1)
            if (i > 0) expect(box.y, 'one under another').toBeGreaterThan(boxes[i - 1]?.y ?? 0)
            expect(inside(box, panel)).toBe(true)
        }
        await expect(grid(page).locator('[title]')).toHaveCount(0)
    })

    test('"To your site": Crop Rotation’s cards under "Discard first", Wild Cry in use above "Play"; picking a card uses Crop Rotation', async ({
        page
    }) => {
        await choose(page, 'facedownCards', 'To your site')
        await expect(column(page).locator('[data-chosen-play]')).toHaveText('To your site')
        await expect(plays(page)).toHaveCount(0)
        await expect(column(page).locator('h4')).toHaveText(['Discard first', 'Cards'])
        await expect(cardToggle(page, 'denizen.beast.wild-cry')).toHaveAttribute(
            'aria-pressed',
            'true'
        )
        await expect(cardRow(page, 'denizen.beast.wild-cry')).toContainText('in use')
        await expect(cardRow(page, 'denizen.hearth.crop-rotation')).toHaveCount(0)
        await expect(confirm(page, 'Play')).toHaveText('Play')
        await expect(stepBacks(page)).toHaveCount(0)
        const card = await boxOf(playCard(page))
        expect(
            (await boxOf(confirm(page, 'Play'))).x,
            'in the column on a desktop'
        ).toBeGreaterThan(card.x + card.width)

        await grid(page).getByRole('button', { name: 'Book Binders', exact: true }).click()
        await confirm(page, 'Play').click()
        await page.getByRole('tab', { name: 'History' }).click()
        await expect(history(page)).toContainText(
            'played War Tortoise to their site, discarding Book Binders first (Crop Rotation)'
        )
        await expect(history(page)).toContainText('(Wild Cry)')
    })

    test('a tap puts Wild Cry down, and the play is sent without it; "Turn faceup" shows Wild Cry alone', async ({
        page
    }) => {
        await choose(page, 'facedownCards', 'Turn faceup')
        await expect(column(page).locator('h4')).toHaveText(['Cards'])
        await cardToggle(page, 'denizen.beast.wild-cry').click()
        await expect(cardToggle(page, 'denizen.beast.wild-cry')).toHaveAttribute(
            'aria-pressed',
            'false'
        )
        await undoButton(page).click()
        await expect(cardToggle(page, 'denizen.beast.wild-cry')).toHaveAttribute(
            'aria-pressed',
            'true'
        )
        await cardToggle(page, 'denizen.beast.wild-cry').click()
        await confirm(page, 'Play').click()
        await page.getByRole('tab', { name: 'History' }).click()
        await expect(history(page)).toContainText('turned War Tortoise faceup as an adviser')
        await expect(history(page)).not.toContainText('Wild Cry')
    })

    test('"Discard": the Cracked Horn as a second place, the discard pile picked; "Under the world deck" sends the Horn', async ({
        page
    }) => {
        await choose(page, 'facedownCards', 'Discard')
        await expect(column(page).locator('h4')).toHaveText(['To'])
        const pile = grid(page).getByRole('button', { name: 'The discard pile', exact: true })
        const deck = grid(page).getByRole('button', { name: 'Under the world deck', exact: true })
        await expect(pile).toHaveAttribute('aria-pressed', 'true')
        await expect(deck).toHaveAttribute('aria-pressed', 'false')
        await expectOneWidth(
            grid(page).getByRole('button', { name: /^(The discard pile|Under the world deck)$/ })
        )
        await expect(cardRow(page, 'denizen.beast.wild-cry')).toHaveCount(0)
        await deck.click()
        await expect(deck).toHaveAttribute('aria-pressed', 'true')
        await expect(pile).toHaveAttribute('aria-pressed', 'false')
        await expect(confirm(page, 'Discard')).toHaveText('Discard')
        await confirm(page, 'Discard').click()
        await page.getByRole('tab', { name: 'History' }).click()
        await expect(history(page)).toContainText(
            'discarded a card under the world deck (Cracked Horn)'
        )
    })

    test('a full site: "Play" waits for a card to go first, with no red line; the card picked uses Crop Rotation', async ({
        page
    }) => {
        await choose(page, 'facedownFullSite', 'To your site')
        await expect(
            grid(page).getByRole('button', { name: 'Captains', exact: true })
        ).toBeVisible()
        await expect(confirm(page, 'Play')).toHaveCount(0)
        await expect(grid(page).locator('.text-oath-danger')).toHaveCount(0)
        await grid(page).getByRole('button', { name: 'Captains', exact: true }).click()
        await confirm(page, 'Play').click()
        await page.getByRole('tab', { name: 'History' }).click()
        await expect(history(page)).toContainText('discarding Captains first (Crop Rotation)')
    })

    test('New Growth: its sites join "Play to:", and the site picked uses it; the step grows under the card', async ({
        page
    }) => {
        await choose(page, 'facedownNewGrowth', 'To your site')
        const playTo = grid(page).getByRole('combobox')
        const sites = await playTo.locator('option').allTextContents()
        expect(sites.length).toBeGreaterThan(2)
        const card = await boxOf(playCard(page))
        const steps = await boxOf(column(page))
        expect(steps.y + steps.height, 'the column taller than the card').toBeGreaterThan(
            card.y + card.height
        )
        // The last site is in the Hinterland, which the People's Favor does not reach and New Growth does.
        const far = sites.at(-1) ?? ''
        await playTo.selectOption({ label: far })
        await confirm(page, 'Play').click()
        await page.getByRole('tab', { name: 'History' }).click()
        await expect(history(page)).toContainText(`played War Tortoise to ${far} (New Growth)`)
    })

    test('Great Herd: Tents picked to go first is no longer offered to swap with, and the Oracle is', async ({
        page
    }) => {
        await openTable(page, 'greatHerdFlip')
        await grid(page).getByRole('button', { name: 'Adviser', exact: true }).click()
        await grid(page)
            .getByRole('button', { name: /^To your site: Great Herd(, .+)?$/ })
            .click()
        const tents = grid(page).getByRole('button', { name: 'Tents', exact: true })
        const oracle = grid(page).getByRole('button', { name: 'Oracle', exact: true })
        // Under "Discard first" and as a card to swap with.
        await expect(tents).toHaveCount(2)
        await expect(oracle).toHaveCount(1)

        await tents.first().click()
        await expect(tents).toHaveCount(1)
        await expect(tents).toHaveAttribute('aria-pressed', 'true')
        await expect(oracle).toHaveCount(1)
        await oracle.click()
        await grid(page).getByRole('button', { name: 'Play Great Herd', exact: true }).click()
        await page.getByRole('tab', { name: 'History' }).click()
        await expect(history(page)).toContainText('discarding Tents first (Crop Rotation)')
        await expect(history(page)).toContainText('swapped Great Herd with Oracle')
    })

    for (const viewport of [
        { width: 402, height: 874 },
        { width: 375, height: 812 }
    ]) {
        test.describe(`on a ${viewport.width} px phone`, () => {
            test.use({ viewport })

            test('the card 170 px beside one column, drawn larger than 100 px; every button 44 px tall, inside the panel; the confirm under both, as wide as its words', async ({
                page
            }) => {
                const cases: [TableFixture.TableName, string, 'Play' | 'Discard'][] = [
                    ['facedownCards', 'To your site', 'Play'],
                    ['facedownCards', 'Discard', 'Discard'],
                    ['facedownFullSite', 'To your site', 'Play']
                ]
                for (const [scene, play, word] of cases) {
                    await choose(page, scene, play)
                    if (scene === 'facedownFullSite') {
                        await grid(page)
                            .getByRole('button', { name: 'Captains', exact: true })
                            .click()
                    }
                    expect(Math.abs((await cardHeight(page)) - 170)).toBeLessThanOrEqual(1)
                    const card = await boxOf(playCard(page))
                    expect(
                        card.height,
                        `${scene} ${play}: drawn larger than 100 px`
                    ).toBeGreaterThan(100)
                    const panel = await panelContent(page)
                    const buttons = grid(page).locator('[data-facedown-play] button')
                    for (const button of await buttons.all()) {
                        // The confirm is drawn once, in the column on a desktop and under both on a phone.
                        if (!(await button.isVisible())) continue
                        const label =
                            (await button.getAttribute('aria-label')) ??
                            (await button.textContent()) ??
                            ''
                        expect(
                            inside(await boxOf(button), panel),
                            `${label}: inside the panel`
                        ).toBe(true)
                        // The magnifiers and the small cards to discard first are pictures, not rows of words.
                        if (
                            label.startsWith('Enlarge ') ||
                            ((await button.locator('img').count()) > 0 &&
                                !(await button.getAttribute('aria-pressed')))
                        )
                            continue
                        const height = await button.evaluate((element) =>
                            element instanceof HTMLElement ? element.offsetHeight : 0
                        )
                        expect(height, `${label}: 44 tall`).toBeGreaterThanOrEqual(44)
                    }
                    const done = await boxOf(confirm(page, word))
                    expect(done.y, 'under the card').toBeGreaterThan(card.y + card.height)
                    expect(done.width, 'as wide as its words').toBeLessThan(120)
                    expect(await clippedLabels(page)).toEqual([])
                }
            })
        })
    }
})

/** Scenario 69: a power's discard piles, repeated banks, "may" and "or". */
test.describe('scenario 69: a power’s piles, banks, “may” and “or”', () => {
    const SCRYER = 'denizen.discord.scryer'
    const CONVOYS = 'denizen.nomad.convoys'
    const ALCHEMIST = 'denizen.arcane.alchemist'
    const MEMORY = 'denizen.beast.memory-of-nature'
    const VAULT = 'denizen.arcane.forgotten-vault'
    const powerRow = (page: Page, cardId: string) =>
        grid(page).locator(`[data-action-power="${cardId}"]`)
    const pileRows = (scope: Locator) =>
        scope.getByRole('button', { name: /^(Cradle|Provinces|Hinterland) pile, \d+ cards?$/ })
    const pile = (scope: Locator, region: string) =>
        scope.getByRole('button', { name: new RegExp(`^${region} pile, `) })
    const bankFavor = (scope: Locator, bank: string, n: number) =>
        scope.getByRole('button', { name: `${bank} bank: ${n} favor`, exact: true })
    const bankRows = (scope: Locator) => scope.locator('[data-bank-row]')
    const useButton = (scope: Locator) => scope.getByRole('button', { name: /^Use(, paying .*)?$/ })
    const play = (page: Page) => grid(page).getByRole('button', { name: 'Play', exact: true })
    const pickedIn = (scope: Locator) => scope.locator('button[aria-pressed="true"]')

    async function openPower(page: Page, table: TableFixture.TableName) {
        await openTable(page, table)
        await usePower(page).click()
    }

    /** The Search kept `card` and played it to the advisers: its When Played step, if it asks one. */
    async function keepAsAdviser(page: Page, table: TableFixture.TableName, card: string) {
        await openTable(page, table)
        await grid(page).getByRole('button', { name: card }).first().click()
        await grid(page)
            .getByRole('button', { name: /adviser/i })
            .first()
            .click()
    }

    async function searchWith(page: Page, ...cards: string[]) {
        await openTable(page, 'pickerPiles')
        await tile(page, 'Search').click()
        for (const card of cards)
            await grid(page)
                .getByRole('button', { name: new RegExp(card) })
                .first()
                .click()
    }

    async function discardWithBracken(page: Page) {
        await openTable(page, 'pickerFacedownBracken')
        await grid(page).getByRole('button', { name: 'Adviser', exact: true }).click()
        await grid(page)
            .getByRole('button', { name: /^Discard/ })
            .first()
            .click()
    }

    test('Scryer and Convoys: each pile a row with its back and count, nothing picked; a tap picks and Use shows', async ({
        page
    }) => {
        await openPower(page, 'pickerPiles')
        const scryer = powerRow(page, SCRYER)
        const convoys = powerRow(page, CONVOYS)
        await expect(scryer.getByText('Peek at:', { exact: true })).toBeVisible()
        await expect(convoys.getByText('Take:', { exact: true })).toBeVisible()
        await expect(grid(page).locator('select')).toHaveCount(0)
        await expect(pileRows(scryer)).toHaveCount(3)
        await expect(pileRows(convoys)).toHaveCount(2)
        await expect(pile(convoys, 'Provinces')).toHaveCount(0)
        await expect(scryer.locator('[data-count]')).toHaveText(['5', '3', '8'])
        await expectOneWidth(pileRows(scryer))
        await expect(pickedIn(scryer)).toHaveCount(0)
        await expect(useButton(scryer)).toHaveCount(0)
        await expect(useButton(convoys)).toHaveCount(0)

        await pile(scryer, 'Hinterland').click()
        await expect(pile(scryer, 'Hinterland')).toHaveAttribute('aria-pressed', 'true')
        await expect(useButton(scryer)).toHaveAccessibleName('Use, paying 1 secret')
        await pile(convoys, 'Cradle').click()
        await useButton(convoys).click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).discardPiles)
            .toEqual({ cradle: 0, provinces: 8, hinterland: 8 })
    })

    test('a Search with Errand Boy in use: its own pile stays a plain row; the other piles carry its cost in gold, and no list of its own', async ({
        page
    }) => {
        await searchWith(page, 'Errand Boy')
        const menu = page.getByRole('list', { name: 'Sources to search' })
        await expect(menu.getByRole('button')).toHaveCount(4)
        await expect(
            menu.getByRole('button', {
                name: /^Search the Provinces discard pile: spend 2 Supply, draw 3$/
            })
        ).toBeVisible()
        for (const region of ['Cradle', 'Hinterland']) {
            await expect(
                menu.getByRole('button', {
                    name: new RegExp(
                        `^Search the ${region} discard pile: spend 2 Supply and 1 favor, draw 3$`
                    )
                })
            ).toBeVisible()
        }
        await expect(grid(page).locator('select')).toHaveCount(0)
        await expect(grid(page).locator('[data-modifier-picks]')).toHaveCount(0)
        // The own pile is sent without Errand Boy, so its favor stays with Dana.
        await menu.getByRole('button', { name: /^Search the Provinces discard pile/ }).click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).machineState)
            .toBe('Searching')
        expect((await call(page, 'tableFacts')).favorOf.dana).toBe(3)
    })

    test('Bracken in a Search: "To:" over the three piles, then Top and Bottom, nothing picked; the menu waits for both', async ({
        page
    }) => {
        await searchWith(page, 'Bracken')
        const picks = grid(page).locator('[data-modifier-picks="denizen.beast.bracken"]')
        const menu = page.getByRole('list', { name: 'Sources to search' })
        await expect(picks.getByText('To:', { exact: true })).toBeVisible()
        await expect(pileRows(picks)).toHaveCount(3)
        await expect(picks.getByRole('button', { name: 'Top', exact: true })).toHaveAttribute(
            'aria-pressed',
            'false'
        )
        await expect(picks.getByRole('button', { name: 'Bottom', exact: true })).toHaveAttribute(
            'aria-pressed',
            'false'
        )
        await expect(pickedIn(picks)).toHaveCount(0)
        await expect(menu.getByRole('button')).toHaveCount(0)
        await pile(picks, 'Cradle').click()
        await expect(menu.getByRole('button')).toHaveCount(0)
        await picks.getByRole('button', { name: 'Bottom', exact: true }).click()
        await expect(menu.getByRole('button')).toHaveCount(2)
    })

    test('Alchemist and Memory of Nature: a favor row per bank that holds any, nothing picked; held to four and to X', async ({
        page
    }) => {
        await openPower(page, 'pickerBanks')
        const alchemist = powerRow(page, ALCHEMIST)
        const memory = powerRow(page, MEMORY)
        await expect(alchemist.getByText(/^Gain 4/)).toBeVisible()
        await expect(bankRows(alchemist)).toHaveCount(5)
        // No Beast bank to move from, and the empty Nomad bank has no row.
        await expect(bankRows(memory)).toHaveCount(4)
        await expect(
            memory.locator('[data-bank-row="beast"], [data-bank-row="nomad"]')
        ).toHaveCount(0)
        await expect(pickedIn(grid(page))).toHaveCount(0)
        await expect(useButton(alchemist)).toHaveCount(0)
        // X is 3: the fourth Order favor cannot be reached.
        await expect(bankFavor(memory, 'Order', 4)).toBeDisabled()

        await bankFavor(alchemist, 'Order', 3).click()
        await expect(pickedIn(alchemist)).toHaveCount(3)
        await expect(useButton(alchemist)).toHaveCount(0)
        await expect(bankFavor(alchemist, 'Hearth', 2)).toBeDisabled()
        await bankFavor(alchemist, 'Hearth', 1).click()
        await expect(bankFavor(alchemist, 'Discord', 1)).toBeDisabled()
        await expect(useButton(alchemist)).toHaveAccessibleName('Use, paying 2 secrets')
        await useButton(alchemist).click()
        await expect.poll(async () => (await call(page, 'tableFacts')).favorOf.rhys).toBe(6)
        const banks = (await call(page, 'tableFacts')).favorBank
        expect([banks.order, banks.hearth]).toEqual([1, 2])
    })

    test('Salad Days: one row of the six banks, nothing picked, the empty bank shut; three picks shut the rest and Play shows', async ({
        page
    }) => {
        await keepAsAdviser(page, 'pickerSalad', 'Salad Days')
        const bank = (name: string) =>
            grid(page).getByRole('button', { name: new RegExp(`^${name} bank, \\d favor$`) })
        await expect(grid(page).getByText(/^Gain .* from 3:$/)).toBeVisible()
        await expect(grid(page).getByRole('button', { name: / bank, \d favor$/ })).toHaveCount(6)
        await expect(bank('Nomad')).toBeDisabled()
        await expect(play(page)).toHaveCount(0)
        for (const name of ['Discord', 'Order', 'Hearth']) await bank(name).click()
        await expect(bank('Arcane')).toBeDisabled()
        await bank('Order').click()
        await expect(bank('Arcane')).toBeEnabled()
        await bank('Order').click()
        await play(page).click()
        await expect(
            grid(page).getByText('Tap to discard; the last goes on top.', { exact: true })
        ).toBeVisible()
    })

    test('Salad Days with two banks holding favor: the empty banks fill the third pick', async ({
        page
    }) => {
        await keepAsAdviser(page, 'pickerSaladShort', 'Salad Days')
        const bank = (name: string) =>
            grid(page).getByRole('button', { name: new RegExp(`^${name} bank, \\d favor$`) })
        await expect(bank('Nomad')).toBeEnabled()
        await bank('Order').click()
        await bank('Hearth').click()
        await bank('Nomad').click()
        await expect(play(page)).toBeVisible()
    })

    test('Salad Days with two banks holding favor: once an empty bank fills the third, no other empty bank opens', async ({
        page
    }) => {
        await keepAsAdviser(page, 'pickerSaladShort', 'Salad Days')
        const bank = (name: string) =>
            grid(page).getByRole('button', { name: new RegExp(`^${name} bank, \\d favor$`) })
        await bank('Nomad').click()
        for (const name of ['Discord', 'Arcane', 'Beast']) await expect(bank(name)).toBeDisabled()
        await expect(bank('Order')).toBeEnabled()
        await expect(bank('Hearth')).toBeEnabled()
        await bank('Order').click()
        await expect(play(page)).toHaveCount(0)
        await bank('Hearth').click()
        await expect(play(page)).toBeVisible()
    })

    // R-7.3.3 — played to the River, Salad Days is judged on the banks once the site has given its Hearth favor;
    // the map's discs keep the table's counts until the play is made.
    async function keepToSite(page: Page, table: TableFixture.TableName) {
        await openTable(page, table)
        await grid(page).getByRole('button', { name: 'Salad Days' }).first().click()
        await grid(page)
            .getByRole('button', { name: /^To your site(, .+)?$/ })
            .click()
    }
    const saladBanks = (page: Page) => grid(page).getByRole('button', { name: / bank, \d favor$/ })
    const saladBank = (page: Page, name: string) =>
        grid(page).getByRole('button', { name: new RegExp(`^${name} bank, \\d favor$`) })
    const mapBanks = (page: Page) => page.locator('.bank:not(.bank--shared)')
    const bankLabels = (counts: number[]) =>
        ['Discord', 'Arcane', 'Order', 'Hearth', 'Beast', 'Nomad'].map(
            (name, i) => `${name} bank, ${counts[i]} favor`
        )
    const shownLabels = (page: Page) =>
        saladBanks(page).evaluateAll((buttons) =>
            buttons.map((button) => button.getAttribute('aria-label'))
        )

    for (const viewport of [
        { width: 1280, height: 900 },
        { width: 375, height: 812 }
    ]) {
        test(`Salad Days played to the site at ${viewport.width}: the Hearth bank shows 0 and stays shut while four banks hold favor; the map keeps 1`, async ({
            page
        }) => {
            await page.setViewportSize(viewport)
            await keepToSite(page, 'pickerSaladSite')
            await expect(saladBanks(page)).toHaveCount(6)
            expect(await shownLabels(page)).toEqual(bankLabels([0, 3, 3, 0, 3, 2]))
            await expect(mapBanks(page)).toHaveText(['0', '3', '3', '1', '3', '2'])
            await expect(saladBank(page, 'Hearth')).toBeDisabled()
            await expect(saladBank(page, 'Discord')).toBeDisabled()
            await saladBank(page, 'Arcane').click()
            await saladBank(page, 'Order').click()
            await expect(saladBank(page, 'Hearth')).toBeDisabled()
            await expect(saladBank(page, 'Beast')).toBeEnabled()
            await expect(saladBank(page, 'Nomad')).toBeEnabled()
            await saladBank(page, 'Beast').click()
            await expect(grid(page)).not.toContainText('can be had')
            await play(page).click()
            await expect(
                grid(page).getByText('Tap to discard; the last goes on top.', { exact: true })
            ).toBeVisible()
            await expect(mapBanks(page)).toHaveText(['0', '3', '3', '1', '3', '2'])
        })

        test(`Salad Days played to the site at ${viewport.width}: two banks hold favor after the play, so any bank may be the third`, async ({
            page
        }) => {
            await page.setViewportSize(viewport)
            await keepToSite(page, 'pickerSaladSiteTwo')
            await expect(saladBanks(page)).toHaveCount(6)
            expect(await shownLabels(page)).toEqual(bankLabels([0, 3, 3, 0, 0, 0]))
            await expect(mapBanks(page)).toHaveText(['0', '3', '3', '1', '0', '0'])
            for (const name of ['Discord', 'Hearth', 'Beast', 'Nomad'])
                await expect(saladBank(page, name)).toBeEnabled()
            await saladBank(page, 'Arcane').click()
            await saladBank(page, 'Order').click()
            for (const name of ['Discord', 'Hearth', 'Beast', 'Nomad'])
                await expect(saladBank(page, name)).toBeEnabled()
            await saladBank(page, 'Beast').click()
            await expect(grid(page)).not.toContainText('can be had')
            await play(page).click()
            await expect(
                grid(page).getByText('Tap to discard; the last goes on top.', { exact: true })
            ).toBeVisible()
        })
    }

    test('Royal Ambitions: "Become a Citizen" a row, off, Play at once; on, the relics as backs, none picked, Play waits', async ({
        page
    }) => {
        await keepAsAdviser(page, 'pickerMay', 'Royal Ambitions')
        const row = grid(page).getByRole('button', { name: /Become a Citizen/ })
        await expect(row).toHaveAttribute('aria-pressed', 'false')
        await expect(row).toContainText('ends your Act Phase')
        await expect(grid(page).getByText('Take:', { exact: true })).toHaveCount(0)
        await expect(play(page)).toBeVisible()
        await expect(grid(page).locator('input[type="checkbox"]')).toHaveCount(0)

        await row.click()
        await expect(row).toHaveAttribute('aria-pressed', 'true')
        await expect(grid(page).getByText('Take:', { exact: true })).toBeVisible()
        const relics = grid(page).getByRole('button', { name: /^Reliquary space \d$/ })
        await expect(relics).toHaveCount(4)
        await expect(pickedIn(grid(page))).toHaveCount(1)
        await expect(play(page)).toHaveCount(0)
        await relics.nth(1).click()
        await expect(play(page)).toBeVisible()
        await row.click()
        await expect(grid(page).getByText('Take:', { exact: true })).toHaveCount(0)
        await row.click()
        await expect(play(page)).toHaveCount(0)
    })

    test('Royal Ambitions played by a Citizen: nothing to ask, so the Search goes straight on', async ({
        page
    }) => {
        await keepAsAdviser(page, 'pickerMayCitizen', 'Royal Ambitions')
        await expect(
            grid(page).getByText('Tap to discard; the last goes on top.', { exact: true })
        ).toBeVisible()
        await expect(grid(page).getByRole('button', { name: /Become a Citizen/ })).toHaveCount(0)
    })

    test('Forgotten Vault: "Darkest Secret:" over Place and Burn, one width, neither picked; Burn picked, Use burns one', async ({
        page
    }) => {
        await openPower(page, 'pickerVault')
        const vault = powerRow(page, VAULT)
        const place = vault.getByRole('button', { name: 'Place secret', exact: true })
        const burn = vault.getByRole('button', { name: 'Burn secret', exact: true })
        await expect(vault.getByText('Darkest Secret:', { exact: true })).toBeVisible()
        await expect(place).toHaveAttribute('aria-pressed', 'false')
        await expect(burn).toHaveAttribute('aria-pressed', 'false')
        await expectOneWidth(vault.getByRole('button', { name: /secret$/ }))
        await expect(useButton(vault)).toHaveCount(0)
        await burn.click()
        await expect(burn).toHaveAttribute('aria-pressed', 'true')
        await useButton(vault).click()
        await expect.poll(async () => (await call(page, 'tableFacts')).darkestSecret).toBe(2)
    })

    test('Forgotten Vault at the last secret: no Burn, Place picked, Use shows and places one', async ({
        page
    }) => {
        await openPower(page, 'pickerVaultLast')
        const vault = powerRow(page, VAULT)
        await expect(vault.getByRole('button', { name: 'Burn secret', exact: true })).toHaveCount(0)
        await expect(
            vault.getByRole('button', { name: 'Place secret', exact: true })
        ).toHaveAttribute('aria-pressed', 'true')
        await useButton(vault).click()
        await expect.poll(async () => (await call(page, 'tableFacts')).darkestSecret).toBe(2)
    })

    test('the facedown discard with Bracken: its piles under "To", Top and Bottom, nothing picked; Discard waits, then sends under the pile', async ({
        page
    }) => {
        await discardWithBracken(page)
        const to = grid(page).locator('[data-discard-to]')
        const discard = grid(page).getByRole('button', { name: /^Discard Giant Python$/ })
        await expect(to.getByText('To', { exact: true })).toBeVisible()
        await expect(pileRows(to)).toHaveCount(3)
        await expect(pickedIn(to)).toHaveCount(0)
        await expect(discard).toHaveCount(0)
        await pile(to, 'Hinterland').click()
        await expect(discard).toHaveCount(0)
        await to.getByRole('button', { name: 'Bottom', exact: true }).click()
        await discard.click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).discardPiles.hinterland)
            .toBe(9)
    })

    for (const viewport of [
        { width: 375, height: 812 },
        { width: 402, height: 874 }
    ]) {
        test.describe(`on a ${viewport.width} px phone`, () => {
            test.use({ viewport })

            /** Every control laid out at least 44 px tall inside the panel, no label clipped. */
            async function controlsFit(page: Page, controls: Locator, count: number) {
                await expect(controls).toHaveCount(count)
                const panel = await boxOf(grid(page))
                for (const box of await boxesOf(controls)) expect(inside(box, panel)).toBe(true)
                const heights = await controls.evaluateAll((buttons) =>
                    buttons.map((button) =>
                        button instanceof HTMLElement ? button.offsetHeight : 0
                    )
                )
                for (const height of heights) expect(height).toBeGreaterThanOrEqual(44)
                expect(await clippedLabels(page)).toEqual([])
            }

            test('the pile rows and their Use', async ({ page }) => {
                await openPower(page, 'pickerPiles')
                await controlsFit(page, pileRows(grid(page)), 5)
                await pile(powerRow(page, SCRYER), 'Cradle').click()
                await controlsFit(page, useButton(powerRow(page, SCRYER)), 1)
            })

            test('the favor rows', async ({ page }) => {
                await openPower(page, 'pickerBanks')
                await controlsFit(
                    page,
                    grid(page).getByRole('button', { name: / bank: \d favor$/ }),
                    23
                )
            })

            test('Salad Days’ banks and Play', async ({ page }) => {
                await keepAsAdviser(page, 'pickerSalad', 'Salad Days')
                await controlsFit(
                    page,
                    grid(page).getByRole('button', { name: / bank, \d favor$/ }),
                    6
                )
                for (const name of ['Discord', 'Order', 'Hearth']) {
                    await grid(page)
                        .getByRole('button', { name: new RegExp(`^${name} bank`) })
                        .click()
                }
                await controlsFit(page, play(page), 1)
            })

            test('the "may" row and the relics', async ({ page }) => {
                await keepAsAdviser(page, 'pickerMay', 'Royal Ambitions')
                await controlsFit(
                    page,
                    grid(page).getByRole('button', { name: /Become a Citizen/ }),
                    1
                )
                await controlsFit(page, play(page), 1)
            })

            test('the "or" answers', async ({ page }) => {
                await openPower(page, 'pickerVault')
                await controlsFit(
                    page,
                    powerRow(page, VAULT).getByRole('button', { name: /secret$/ }),
                    2
                )
            })

            test('Bracken in a Search', async ({ page }) => {
                await searchWith(page, 'Bracken')
                const picks = grid(page).locator('[data-modifier-picks="denizen.beast.bracken"]')
                await controlsFit(page, picks.getByRole('button'), 5)
            })

            test('Bracken on the facedown discard: "To" under the card', async ({ page }) => {
                await discardWithBracken(page)
                const to = grid(page).locator('[data-discard-to]')
                await controlsFit(page, to.getByRole('button'), 5)
                const card = await boxOf(grid(page).locator('[data-play-card]'))
                expect((await boxOf(to)).y).toBeGreaterThan(card.y + card.height)
            })
        })
    }
})

/**
 * Scenario 70 (docs/ui-interaction-visual-contract.md, Play a card to your site): "To your site" shows the favor the
 * site play gains, from the engine's plan on the banks as they stand. Rhys at the River draws Salad Days (Hearth 3),
 * Wolves (Beast 0) and Tutor; the History of Wolves' play names the empty bank.
 */
test.describe('scenario 70: the favor a site play gains', () => {
    const plays = (page: Page) =>
        grid(page).getByRole('button', {
            name: /^(To your site(, .+)?|Adviser, faceup|Adviser, facedown|As your Vision|Play it|Discard)$/
        })
    const toSite = (page: Page) => grid(page).getByRole('button', { name: /^To your site, / })
    const line = (page: Page) => toSite(page).locator('[data-site-gain] [data-gains]')

    async function keep(page: Page, card: string) {
        await openTable(page, 'pickerSaladNoBeast')
        await grid(page).getByRole('button', { name: card, exact: true }).first().click()
        await expect(grid(page).getByText('How do you play it?', { exact: true })).toBeVisible()
    }

    for (const viewport of [
        { width: 1280, height: 900 },
        { width: 375, height: 812 }
    ]) {
        test(`at ${viewport.width}: Wolves with the Beast bank empty shows +0 in grey, Salad Days +1 in gold; the plays keep one width`, async ({
            page
        }) => {
            await page.setViewportSize(viewport)
            await keep(page, 'Wolves')
            await expect(toSite(page)).toHaveAccessibleName('To your site, +0 favor')
            await expect(line(page)).toHaveText('+0')
            await expect(line(page)).toHaveClass(/text-oath-text-muted/)
            await expect(line(page).locator('img[alt="favor"]')).toBeVisible()
            const widths = await plays(page).evaluateAll((buttons) =>
                buttons.map((button) => Math.round(button.getBoundingClientRect().width))
            )
            expect(widths.length).toBeGreaterThan(1)
            expect(new Set(widths).size).toBe(1)
            if (viewport.width < 768) {
                for (const height of await plays(page).evaluateAll((buttons) =>
                    buttons.map((button) => button.getBoundingClientRect().height)
                )) {
                    expect(height).toBeGreaterThanOrEqual(44)
                }
            }

            await keep(page, 'Salad Days')
            await expect(toSite(page)).toHaveAccessibleName('To your site, +1 favor')
            await expect(line(page)).toHaveText('+1')
            await expect(line(page)).toHaveClass(/text-oath-accent/)
            // Tutor is an adviser only: no site play, so no line.
            await keep(page, 'Tutor')
            await expect(toSite(page)).toHaveCount(0)
            await expect(grid(page).locator('[data-site-gain]')).toHaveCount(0)
        })
    }

    test('the History of Wolves played to the River with the Beast bank empty: "gaining no [favor]: the [Beast] bank was empty"', async ({
        page
    }) => {
        await keep(page, 'Wolves')
        await grid(page)
            .getByRole('button', { name: /^To your site(, .+)?$/ })
            .click()
        await expect(
            grid(page).getByText('Tap to discard; the last goes on top.', { exact: true })
        ).toBeVisible()
        // The last card goes on top by itself, so one tap sends the Search.
        await grid(page).getByRole('button', { name: 'Salad Days', exact: true }).click()
        await page.getByRole('tab', { name: 'History' }).click()
        const row = page
            .locator('.history p')
            .filter({ hasText: 'kept Wolves and played it to their site' })
        await expect(row).toContainText('kept Wolves and played it to their site, gaining no')
        // The bank is its suit's symbol, "the Beast bank" its words for a screen reader, as on every History row.
        await expect(row).toContainText(/gaining no\s*:\s*was empty; Salad Days, Tutor went to the/)
        await expect(row.getByRole('img', { name: 'favor' })).toBeVisible()
        await expect(row.getByRole('img', { name: 'the Beast bank' })).toBeVisible()
    })
})

/**
 * docs/ui-interaction-visual-contract.md, Choose a Travel destination: Hospitality starts in use
 * and its gain shows on each destination it fits, with its bank's suit, and is sent with the way.
 * Dana is at the River; the Plains match one bank (beast), the Wastes two (beast and nomad), the
 * Drowned City none, and the Great Slum's hearth bank is empty unless the table gives it favor.
 * A chip too wide for its card puts the gain on a dark row under the gold cost: in
 * `hospitalityHiddenPlace` the Wastes' two cards stand at the Hidden Place, whose way flips a secret.
 */
test.describe('Hospitality on a Travel', () => {
    const plains = 'slot.cradle.1'
    const city = 'slot.provinces.0'
    const slum = 'slot.provinces.2'
    const wastes = 'slot.hinterland.2'
    const hidden = 'slot.hinterland.1'
    const hospitality = 'denizen.nomad.hospitality'
    const chipOf = (page: Page, slotId: string) => siteAt(page, slotId).locator('.travel-cost')
    const gainOf = (page: Page, slotId: string) =>
        chipOf(page, slotId).locator('.travel-cost__gain')
    const bankWay = (page: Page, suit: string) =>
        grid(page).getByRole('button', { name: new RegExp(`gain 1 favor from the ${suit} bank$`) })
    const facts = (page: Page) => call(page, 'tableFacts')

    const costsOf = (page: Page, slotId: string) =>
        chipOf(page, slotId).locator('.travel-cost__way')
    const fontSizeOf = (page: Page, slotId: string) =>
        chipOf(page, slotId).evaluate((element) => parseFloat(getComputedStyle(element).fontSize))
    const backgroundOf = (locator: Locator) =>
        locator.evaluate((element) => getComputedStyle(element).backgroundColor)
    const GOLD = 'rgb(251, 191, 36)'
    const DARK = 'rgb(28, 25, 23)'

    /** The smallest box around `boxes`. */
    const around = (boxes: Box[]): Box => {
        const left = Math.min(...boxes.map((box) => box.x))
        const top = Math.min(...boxes.map((box) => box.y))
        const right = Math.max(...boxes.map((box) => box.x + box.width))
        const bottom = Math.max(...boxes.map((box) => box.y + box.height))
        return { x: left, y: top, width: right - left, height: bottom - top }
    }

    /** The box of what an element holds (its words and symbols), not of its padding. */
    const inkOf = (locator: Locator): Promise<Box> =>
        locator.evaluate((element) => {
            const range = document.createRange()
            range.selectNodeContents(element)
            const box = range.getBoundingClientRect()
            return { x: box.x, y: box.y, width: box.width, height: box.height }
        })

    /** The colour the page shows at one point, read from a screenshot of that pixel. */
    async function colourIs(page: Page, x: number, y: number, colour: string, what: string) {
        const png = await page.screenshot({
            clip: { x: Math.round(x), y: Math.round(y), width: 1, height: 1 }
        })
        const shown = await page.evaluate(async (data) => {
            const image = new Image()
            image.src = `data:image/png;base64,${data}`
            await image.decode()
            const canvas = document.createElement('canvas')
            canvas.width = canvas.height = 1
            const context = canvas.getContext('2d')!
            context.drawImage(image, 0, 0)
            return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)]
        }, png.toString('base64'))
        const wanted = (colour.match(/\d+/g) ?? []).map(Number)
        const off = Math.max(...wanted.map((value, index) => Math.abs(value - (shown[index] ?? 0))))
        expect(
            off,
            `${what}: rgb(${shown.join(', ')}) at ${Math.round(x)},${Math.round(y)}`
        ).toBeLessThanOrEqual(12)
    }

    /**
     * Every piece of the chip stands inside the card's visible frame, and inside the chip, which
     * paints no further than its own box. The frame is the yellow outline `.board-card` draws just
     * outside its box, the card's face. The chip's own box is not enough: a chip held to the
     * card's width can still spill its costs and symbols past both edges of the frame.
     */
    async function wholeOnItsFrame(page: Page, slotId: string) {
        const chip = await settledBox(chipOf(page, slotId))
        const frame = await boxOf(siteCard(page, slotId))
        expect(inside(chip, frame), 'the chip inside the frame').toBe(true)
        for (const box of await boxesOf(chipOf(page, slotId).locator('*'))) {
            expect(inside(box, frame), 'a piece of the chip inside the frame').toBe(true)
            expect(inside(box, chip), 'a piece of the chip inside the chip').toBe(true)
        }
    }

    /** The chip stands on one line, wholly on its card, the gain's dark end level with the cost. */
    async function oneLineOnItsCard(page: Page, slotId: string) {
        await wholeOnItsFrame(page, slotId)
        const chip = await boxOf(chipOf(page, slotId))
        const gain = await boxOf(gainOf(page, slotId))
        const fontSize = await fontSizeOf(page, slotId)
        expect(chip.height).toBeLessThan(fontSize * 1.6)
        expect(
            onTwoRows(
                around(await boxesOf(costsOf(page, slotId))),
                await inkOf(gainOf(page, slotId))
            )
        ).toBe(false)
        expect(gain.y).toBeGreaterThanOrEqual(chip.y - 0.5)
        expect(gain.y + gain.height).toBeLessThanOrEqual(chip.y + chip.height + 0.5)
        expect(gain.x + gain.width).toBeCloseTo(chip.x + chip.width, 0)
        const middle = chip.y + chip.height / 2
        await colourIs(page, chip.x + 4, middle, GOLD, 'the gold cost at the left end')
        await colourIs(
            page,
            chip.x + chip.width - 4,
            middle,
            DARK,
            'the dark gain at the right end'
        )
    }

    /** One line where the chip fits on its card, otherwise two rows; either way wholly on it. */
    async function fitsOnItsCard(page: Page, slotId: string) {
        await settledBox(chipOf(page, slotId))
        if (
            onTwoRows(
                around(await boxesOf(costsOf(page, slotId))),
                await inkOf(gainOf(page, slotId))
            )
        )
            await twoRowsOnItsCard(page, slotId)
        else await oneLineOnItsCard(page, slotId)
    }

    /** Whether the gain stands wholly under the cost. */
    const onTwoRows = (cost: Box, gain: Box) => gain.y >= cost.y + cost.height - 0.5

    /** The chip is two rows on its card: the gold cost on top, the dark gain under it, each centred. */
    async function twoRowsOnItsCard(page: Page, slotId: string) {
        await wholeOnItsFrame(page, slotId)
        const frame = await boxOf(siteCard(page, slotId))
        const chip = await boxOf(chipOf(page, slotId))
        const costRow = around(await boxesOf(costsOf(page, slotId)))
        const gainRow = await inkOf(gainOf(page, slotId))
        expect(onTwoRows(costRow, gainRow), 'the gain under the cost').toBe(true)
        const centre = frame.x + frame.width / 2
        expect(
            Math.abs(costRow.x + costRow.width / 2 - centre),
            'the cost centred'
        ).toBeLessThanOrEqual(1)
        expect(
            Math.abs(gainRow.x + gainRow.width / 2 - centre),
            'the gain centred'
        ).toBeLessThanOrEqual(1)
        expect(await backgroundOf(chipOf(page, slotId))).toBe(GOLD)
        expect(await backgroundOf(gainOf(page, slotId))).toBe(DARK)
        // Each row keeps its colour out to both ends of the chip.
        for (const x of [chip.x + 4, chip.x + chip.width - 4]) {
            await colourIs(page, x, costRow.y + costRow.height / 2, GOLD, 'the cost row gold')
            await colourIs(page, x, gainRow.y + gainRow.height / 2, DARK, 'the gain row dark')
        }
    }

    test('on a desktop it starts in use with no bank asked; every destination stays lit, the gain on those it fits', async ({
        page
    }) => {
        await openTable(page, 'hospitality')
        await tile(page, 'Travel').click()
        await expect(travelPrompt(page)).toBeVisible()
        await expect(cardToggle(page, hospitality)).toHaveAttribute('aria-pressed', 'true')
        await expect(grid(page)).not.toContainText('Hospitality:')
        await expect(grid(page)).not.toContainText('a bank matching')
        expect(await litSlots(page)).toEqual(
            [...(await call(page, 'legalTravelDestinations'))].sort()
        )

        await expect(chipOf(page, plains)).toHaveText(/^\s*\d\s*\+1\s*$/)
        await expect(gainOf(page, plains).getByRole('img', { name: 'favor' })).toBeVisible()
        await expect(
            gainOf(page, plains).getByRole('img', { name: 'the Beast bank' })
        ).toBeVisible()
        await expect(
            gainOf(page, wastes).getByRole('img', { name: /^the (Beast|Nomad) bank$/ })
        ).toHaveCount(2)
        await expect(gainOf(page, wastes)).toContainText('or')
        await expect(gainOf(page, city)).toHaveCount(0)
        await expect(gainOf(page, slum)).toHaveCount(0)
        const background = (locator: Locator) =>
            locator.evaluate((element) => getComputedStyle(element).backgroundColor)
        expect(await background(gainOf(page, plains))).not.toBe(
            await background(chipOf(page, plains))
        )

        // One way, one bank and no toll: the click travels, taking the beast bank's favor.
        const before = await facts(page)
        await siteCard(page, plains).click()
        await expect.poll(async () => (await facts(page)).siteOf.dana).toBe(plains)
        const after = await facts(page)
        expect(after.favorBank.beast).toBe(before.favorBank.beast - 1)
        expect(after.favorOf.dana).toBe(before.favorOf.dana + 1)
        await page.getByRole('tab', { name: 'History' }).click()
        const row = page.getByRole('tabpanel', { name: 'History' }).getByRole('listitem').first()
        await expect(row).toContainText(
            /traveled to Plains, spending \d Supply; gained 1\s*from\s*\(Hospitality\)/
        )
        await expect(row.getByRole('img', { name: 'the Beast bank' })).toBeVisible()
    })

    test('on a desktop two banks are two ways, each its cost and gain; Undo closes them; the way clicked sends its bank', async ({
        page
    }) => {
        await openTable(page, 'hospitality')
        await tile(page, 'Travel').click()
        await siteCard(page, wastes).click()
        await expect(bankWay(page, 'Beast')).toHaveCount(1)
        await expect(bankWay(page, 'Nomad')).toHaveCount(1)
        for (const suit of ['Beast', 'Nomad']) {
            await expect(bankWay(page, suit)).toHaveText(/^\s*\d Supply\s*· \+1\s*$/)
            await expect(
                bankWay(page, suit).getByRole('img', { name: `the ${suit} bank` })
            ).toBeVisible()
        }
        const [one, other] = [
            await boxOf(bankWay(page, 'Beast')),
            await boxOf(bankWay(page, 'Nomad'))
        ]
        expect(other.width).toBeCloseTo(one.width, 0)
        expect((await facts(page)).siteOf.dana).toBe('slot.cradle.0')

        await undoButton(page).click()
        await expect(bankWay(page, 'Beast')).toHaveCount(0)
        await expect(travelPrompt(page)).toBeVisible()

        await siteCard(page, wastes).click()
        const before = await facts(page)
        await bankWay(page, 'Nomad').click()
        await expect.poll(async () => (await facts(page)).siteOf.dana).toBe(wastes)
        const after = await facts(page)
        expect(after.favorBank.nomad).toBe(before.favorBank.nomad - 1)
        expect(after.favorBank.beast).toBe(before.favorBank.beast)
    })

    test('put down, the gains leave the sites and the Travel is sent without it', async ({
        page
    }) => {
        await openTable(page, 'hospitality')
        await tile(page, 'Travel').click()
        await cardToggle(page, hospitality).click()
        await expect(cardToggle(page, hospitality)).toHaveAttribute('aria-pressed', 'false')
        await expect(page.locator('.travel-cost__gain')).toHaveCount(0)
        await expect(chipOf(page, plains)).toHaveText(/^\s*\d Supply\s*$/)
        const before = await facts(page)
        await siteCard(page, plains).click()
        await expect.poll(async () => (await facts(page)).siteOf.dana).toBe(plains)
        expect((await facts(page)).favorBank).toEqual(before.favorBank)
    })

    test('on a desktop a chip too wide for its card is two rows, as on a phone; one that fits stays on one line', async ({
        page
    }) => {
        await openTable(page, 'hospitalityHiddenPlace')
        await tile(page, 'Travel').click()
        await expect(travelPrompt(page)).toBeVisible()
        await oneLineOnItsCard(page, plains)
        await twoRowsOnItsCard(page, hidden)
        await siteCard(page, hidden).click()
        await expect(bankWay(page, 'Beast')).toHaveCount(1)
        await expect(bankWay(page, 'Nomad')).toHaveCount(1)
    })

    test('Toll Roads and a gain on one site: one way reads the toll then the gain, and sends both', async ({
        page
    }) => {
        await openTable(page, 'hospitalityToll')
        await tile(page, 'Travel').click()
        await expect(chipOf(page, slum).getByRole('img', { name: 'favor' })).toHaveCount(2)
        await expect(gainOf(page, slum).getByRole('img', { name: 'the Hearth bank' })).toBeVisible()
        await siteCard(page, slum).click()
        const way = bankWay(page, 'Hearth')
        await expect(way).toHaveCount(1)
        await expect(way).toHaveAccessibleName(
            /give 1 favor to rhys \(Toll Roads\), gain 1 favor from the Hearth bank$/
        )
        await expect(way).toContainText(/\d Supply\s*\+ 1\s*to\s*rhys\s*· \+1/)
        const before = await facts(page)
        await way.click()
        await expect.poll(async () => (await facts(page)).siteOf.dana).toBe(slum)
        const after = await facts(page)
        expect(after.favorOf.rhys).toBe(before.favorOf.rhys + 1)
        expect(after.favorBank.hearth).toBe(before.favorBank.hearth - 1)
        expect(after.favorOf.dana).toBe(before.favorOf.dana)
    })

    test.describe('on a phone held upright', () => {
        test.use({ viewport: { width: 375, height: 812 }, hasTouch: true })

        test('one bank: the chip is the gold cost and a dark end with the gain; a tap travels', async ({
            page
        }) => {
            await openTable(page, 'hospitality')
            await chooseTravelOnThePhone(page)
            await expect.poll(() => onScreen(page, siteCard(page, plains))).toBe(true)
            await expect(chipOf(page, plains)).toHaveText(/^\s*\d\s*\+1\s*$/)
            await oneLineOnItsCard(page, plains)
            const token = gainOf(page, plains).getByRole('img', { name: 'the Beast bank' })
            const fontSize = await chipOf(page, plains).evaluate((element) =>
                parseFloat(getComputedStyle(element).fontSize)
            )
            expect((await boxOf(token)).height).toBeLessThanOrEqual(fontSize * 0.8)

            const before = await facts(page)
            await siteCard(page, plains).tap()
            await expect.poll(async () => (await facts(page)).siteOf.dana).toBe(plains)
            expect((await facts(page)).favorBank.beast).toBe(before.favorBank.beast - 1)
        })

        test('two banks: the chip reads both suits, on one line if it fits; a tap opens a way per bank, stacked; Undo closes them', async ({
            page
        }) => {
            await openTable(page, 'hospitality')
            await chooseTravelOnThePhone(page)
            await regionChip(page, 'Hinterland').tap()
            await expect.poll(() => onScreen(page, siteCard(page, wastes))).toBe(true)
            await expect(gainOf(page, wastes)).toContainText('or')
            await fitsOnItsCard(page, wastes)

            await siteCard(page, wastes).tap()
            const [one, other] = [
                await boxOf(bankWay(page, 'Beast')),
                await boxOf(bankWay(page, 'Nomad'))
            ]
            expect(other.x).toBeCloseTo(one.x, 0)
            expect(other.y).toBeGreaterThan(one.y + one.height - 1)
            expect(other.width).toBeCloseTo(one.width, 0)
            expect((await facts(page)).siteOf.dana).toBe('slot.cradle.0')

            await undoButton(page).tap()
            await expect(bankWay(page, 'Beast')).toHaveCount(0)
            await expect(travelPrompt(page)).toBeVisible()

            await regionChip(page, 'Hinterland').tap()
            await expect.poll(() => onScreen(page, siteCard(page, wastes))).toBe(true)
            await siteCard(page, wastes).tap()
            const before = await facts(page)
            await bankWay(page, 'Beast').tap()
            await expect.poll(async () => (await facts(page)).siteOf.dana).toBe(wastes)
            expect((await facts(page)).favorBank.beast).toBe(before.favorBank.beast - 1)
        })

        test('a toll and a gain: the chip reads the toll then the gain on one line, on its card', async ({
            page
        }) => {
            await openTable(page, 'hospitalityToll')
            await chooseTravelOnThePhone(page)
            await regionChip(page, 'Provinces').tap()
            await expect.poll(() => onScreen(page, siteCard(page, slum))).toBe(true)
            await expect(chipOf(page, slum).getByRole('img', { name: 'favor' })).toHaveCount(2)
            await oneLineOnItsCard(page, slum)
        })

        test('a secret to flip and two banks: too wide for one line, the gain drops to a dark row under the gold cost', async ({
            page
        }) => {
            await openTable(page, 'hospitalityHiddenPlace')
            await chooseTravelOnThePhone(page)
            await regionChip(page, 'Hinterland').tap()
            await expect.poll(() => onScreen(page, siteCard(page, hidden))).toBe(true)
            await expect(costsOf(page, hidden).getByRole('img', { name: 'secret' })).toHaveCount(1)
            await expect(
                gainOf(page, hidden).getByRole('img', { name: /^the (Beast|Nomad) bank$/ })
            ).toHaveCount(2)
            await twoRowsOnItsCard(page, hidden)
        })
    })
})

/**
 * R-11.13-H1 — a power-made travel to The Hidden Place asks the moved player to flip: "Travel to The
 * Hidden Place?" with Travel · flip 1 [secret] and Stay; on the Brass Horse's own pick its lit site
 * carries "+[secret]".
 */
test.describe('The Hidden Place on a power-made travel', () => {
    const questionLine = (page: Page) => grid(page).locator('.question-line')

    test('the flip: the line names the site, the card is the Whistle, and Travel pays the flip in gold', async ({
        page
    }) => {
        await openTable(page, 'askFlipToTravel')
        await expect(questionLine(page)).toHaveText('Travel to The Hidden Place?')
        await expect(grid(page).getByRole('heading', { name: 'Whistle' })).toBeVisible()
        await expect(grid(page).locator('.question-form img[alt="Whistle"]')).toBeVisible()
        const travel = answer(page, 'Travel and flip 1 secret')
        await expect(travel).toHaveText(/^Travel\s*·\s*flip 1$/)
        await expect(travel.locator('.text-oath-accent img[alt="secret"]')).toHaveCount(1)
        await expect(travel).toHaveClass(/border-oath-primary-border/)
        await expect(answer(page, 'Stay')).toBeVisible()
        await travel.click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).siteOf.me)
            .toBe('slot.cradle.1')
    })

    test('Stay leaves the pawn where it is', async ({ page }) => {
        await openTable(page, 'askFlipToTravel')
        await answer(page, 'Stay').click()
        await expect(answer(page, 'Stay')).toHaveCount(0)
        expect((await call(page, 'tableFacts')).siteOf.me).toBe('slot.cradle.0')
    })

    test('the Brass Horse on the lit map: The Hidden Place’s chip is "+[secret]", the other site has none, and a click travels there', async ({
        page
    }) => {
        await openTable(page, 'askBrassHorseHidden')
        const hidden = 'slot.cradle.1'
        await expect(siteAt(page, hidden).locator('.travel-cost')).toHaveText(/^\+$/)
        await expect(siteAt(page, hidden).locator('.travel-cost img[alt="secret"]')).toHaveCount(1)
        await expect(
            siteAt(page, hidden).getByRole('button', {
                name: 'The Hidden Place, flip 1 secret',
                exact: true
            })
        ).toHaveCount(1)
        await expect(siteAt(page, 'slot.provinces.0').locator('.travel-cost')).toHaveCount(0)
        await siteCard(page, hidden).click()
        await expect.poll(async () => (await call(page, 'tableFacts')).siteOf.me).toBe(hidden)
    })
})

/**
 * R-11.7-H3 — the Shrouded Wood's ruler sent the traveller to Way Station's site, and both ways are
 * open: "Spend no Supply by giving Ann 1 [favor]?" with Give 1 [favor] and Pay 2 Supply; both travel.
 */
test.describe('Way Station at the Shrouded Wood’s pick', () => {
    const questionLine = (page: Page) => grid(page).locator('.question-line')

    test('the line names the payee; Give pays the favor in gold, travels, and History names Way Station and the ruler’s pick', async ({
        page
    }) => {
        await openTable(page, 'askWayStation')
        await expect(questionLine(page)).toHaveText(/^Spend no Supply by giving \S+\s*1\s*\?$/)
        await expect(questionLine(page).locator('img[alt="favor"]')).toHaveCount(1)
        await expect(grid(page).getByRole('heading', { name: 'Way Station' })).toBeVisible()
        const give = answer(page, 'Give, paying 1 favor')
        // "Give 1 [favor]": the cost straight after the word, no dot.
        await expect(give).toHaveText(/^Give\s*1$/)
        await expect(give.locator('.text-oath-accent img')).toHaveCount(1)
        await expect(give).toHaveClass(/border-oath-primary-border/)
        await expect(answer(page, 'Pay 2 Supply')).toBeVisible()
        await give.click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).siteOf.me)
            .toBe('slot.cradle.1')
        expect((await call(page, 'tableFacts')).favorOf).toMatchObject({ me: 3, ann: 4 })
        await page.getByRole('tab', { name: 'History' }).click()
        await expect(page.locator('.history')).toContainText(
            /traveled from Shrouded Wood to \S+ \((your|ann's) pick\); paid (you|ann) 1\s*\(Way Station\)/
        )
    })

    test('Pay 2 Supply travels and gives no favor', async ({ page }) => {
        await openTable(page, 'askWayStation')
        await answer(page, 'Pay 2 Supply').click()
        await expect
            .poll(async () => (await call(page, 'tableFacts')).siteOf.me)
            .toBe('slot.cradle.1')
        expect((await call(page, 'tableFacts')).favorOf).toMatchObject({ me: 4, ann: 3 })
    })
})

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
        await expect(page.getByText('Tap to discard; the last goes on top.', { exact: true })).toBeVisible()
        await expect(preview(page)).toHaveCount(0)
    })

    test('scenario 44: a tap on an offered site enlarges it and travels nowhere; the next tap closes it', async ({
        page
    }) => {
        await openTable(page, 'actPhase')
        await tile(page, 'Travel').click()
        await (await uncovered(page, '.board-card.offered')).tap()
        await expect(preview(page)).toBeVisible()
        expect((await call(page, 'tableFacts')).siteOf.me).toBe('slot.cradle.0')

        await page.touchscreen.tap(20, 20)
        await expect(preview(page)).toHaveCount(0)
        expect((await call(page, 'tableFacts')).siteOf.me).toBe('slot.cradle.0')
        await expect(page.getByRole('list', { name: 'Destinations in the Cradle' })).toBeVisible()
    })

    test('scenario 41: with Muster chosen, a tap on a ringed denizen enlarges it and musters nothing', async ({ page }) => {
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
        await expect(page.getByText('Pick a start site and a card to keep.', { exact: true })).toBeVisible()
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
    const denizen = page.locator('.board-card[title="Book Binders"]')
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

test('scenario 41: with Recover chosen, a click on a banner on the rail enlarges it and stages nothing', async ({ page }) => {
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
})

test('scenario 44: the click that closes an enlarged card does nothing else, even over a menu row', async ({ page }) => {
    await openTable(page, 'actPhase')
    await tile(page, 'Travel').click()
    const go = page.getByRole('list', { name: 'Destinations in the Cradle' }).getByRole('button').first()
    await expect(go).toBeVisible()
    const row = await go.boundingBox()
    if (!row) throw Error('The destination’s button is on screen')
    await (await uncovered(page, '.board-card')).click()
    await expect(preview(page)).toBeVisible()
    await page.mouse.click(row.x + row.width / 2, row.y + row.height / 2)
    await expect(preview(page)).toHaveCount(0)
    expect((await call(page, 'tableFacts')).siteOf.me).toBe('slot.cradle.0')
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
test('scenario 53: an enlarged site shows its sentence under it, with the suit and favor as symbols', async ({ page }) => {
    await openTable(page, 'setup')
    await (await uncovered(page, '.site .board-card')).click()
    const sentence = preview(page).locator('.site-sentence')
    await expect(sentence).toContainText('card to this site, and you have not discarded a')
    await expect(sentence.getByRole('img', { name: 'Hearth' })).toHaveCount(2)
    await expect(sentence.getByRole('img', { name: 'favor' })).toHaveCount(1)
    await page.keyboard.press('Escape')
    await (await uncovered(page, '.site .board-card[title^="Facedown site"]')).click()
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
    await expect(page.getByText('Pick a start site and a card to keep.', { exact: true })).toBeVisible()
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
    await expect(page.getByText('Tap to discard; the last goes on top.', { exact: true })).toBeVisible()
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

/** A count is a row of number buttons per group, each named "N of the … warbands …". */
async function pickCount(page: Page, group: number, value: number) {
    await grid(page).getByRole('button', { name: new RegExp(`^${value} of the `) }).nth(group).click()
}
const countRows = (page: Page) => grid(page).getByRole('button', { name: /^0 of the / })

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

test('the grid lists the six majors and only the minors that can be taken, under the Supply, with End Act Phase; a dimmed major under the pointer says why', async ({ page }) => {
    await openTable(page, 'actPhase')
    await expect(grid(page).locator('.majors button')).toHaveCount(6)
    await expect(grid(page).locator('.minors button')).toHaveCount(0)
    await expect(grid(page).locator('h3')).toHaveText('Supply 7')
    await expect(grid(page).getByRole('button', { name: 'End Act Phase', exact: true })).toBeVisible()
    await tile(page, 'Muster').hover()
    await expect(reasonLine(page)).toHaveText('No card here.')
    await restMouse(page)
    await expect(reasonLine(page)).toHaveText('')

    await openTable(page, 'advisers')
    const minors = grid(page).locator('.minors button')
    await expect(minors).toHaveText(['Adviser', 'Show'])
    for (const minor of await minors.all()) await expect(minor).not.toHaveAttribute('aria-disabled', 'true')
})

test('a free Travel due: one line beside Skip, Travel lit at no Supply, every other tile dimmed and saying the free Travel comes first', async ({ page }) => {
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

test('Undo reads "Undo" and has no hover, both for a sent move and for a pick', async ({ page }) => {
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
    test('a card asks a seat on another seat’s turn: the bar names the turn and its phase', async ({ page }) => {
        await openTable(page, 'askedOffTurn')
        expect((await call(page, 'tableFacts')).seatId).toBe('ann')
        await expect.poll(() => turnBar(page)).toEqual(["dev's turn", 'Act Phase'])
        expect(await call(page, 'viewOffTheClock')).toBe('dev')
        await expect.poll(() => turnBar(page)).toEqual(['Your turn', 'Act Phase'])
    })

    test('a seat asks another for permission on its own turn: the bar names the asker’s turn', async ({ page }) => {
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

    test('the Oathkeeper title’s choice on another seat’s turn: the bar names the turn', async ({ page }) => {
        await openTable(page, 'oathkeeperChoice')
        expect((await call(page, 'tableFacts')).seatId).toBe('ann')
        await expect.poll(() => turnBar(page)).toEqual(["dev's turn", 'Act Phase'])
        expect(await call(page, 'viewOffTheClock')).toBe('dev')
        await expect.poll(() => turnBar(page)).toEqual(['Your turn', 'Act Phase'])
    })

    test('a Campaign out of turn: the bar says whose turn is paused, not who campaigns', async ({ page }) => {
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
    const line = grid(page).locator('p').filter({ hasText: /^\s*Waiting/ })
    await expect(line).toHaveCount(1)
    await expect(line).toHaveText(new RegExp(`^\\s*Waiting on\\s+${playerIds.join('\\s+')}\\.\\s*$`))
    const chips = line.locator(':scope > span')
    await expect(chips).toHaveText(playerIds)
    for (const chip of await chips.all()) {
        await expect(chip).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    }
}

/** Every seat the engine is not waiting on reads "Waiting on <chip>."; what is being decided is in the History. */
test.describe('the waiting line', () => {
    test('the action panel: the Sneak Attack’s turn seat waits on the campaigner', async ({ page }) => {
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

    test('the Campaign: the attacker waits on the defender’s battle plans, then on its losses', async ({ page }) => {
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
        await expect(grid(page).locator('.text-oath-danger')).toContainText('the last one must stay')
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
    const pieces = (page: Page) => grid(page).getByRole('button', { name: /^(Imperial|Removed): a warband/ })
    const piece = (page: Page, name: string) => grid(page).getByRole('button', { name, exact: true })
    const conversion = (page: Page) => grid(page).getByRole('img', { name: /^Your \d+ warbands become/ })

    test('short: the pieces by place, the first three Imperial, and the rest removed; the line says so', async ({ page }) => {
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

    test('short: Accept is hidden while fewer are picked than the Empire covers, with no red line', async ({ page }) => {
        await openTable(page, 'citizenshipShort')
        await piece(page, 'Imperial: a warband on your board').first().click()
        await expect(grid(page).locator('button[aria-pressed="true"]')).toHaveCount(2)
        await expect(answer(page, 'Accept')).toHaveCount(0)
        await expect(grid(page)).not.toContainText('must choose exactly')
        await expect(answer(page, 'Refuse')).toBeEnabled()

        await piece(page, 'Removed: a warband at Fertile Valley').first().click()
        await expect(answer(page, 'Accept')).toBeEnabled()
    })

    test('short: a tap on a removed piece makes it Imperial and removes the oldest pick', async ({ page }) => {
        await openTable(page, 'citizenshipShort')
        await piece(page, 'Removed: a warband at Fertile Valley').first().click()
        await expect(piece(page, 'Imperial: a warband at Fertile Valley')).toHaveCount(1)
        await expect(piece(page, 'Imperial: a warband on your board')).toHaveCount(2)
        await expect(pieces(page).first()).toHaveAttribute('aria-pressed', 'false')
        await expect(grid(page).locator('button[aria-pressed="true"]')).toHaveCount(3)

        await answer(page, 'Accept').click()
        await expect.poll(async () => (await call(page, 'tableFacts')).machineState).not.toBe('ConsentRequest')
        const accepted = await call(page, 'tableFacts')
        expect(accepted.boardOf.me?.imperial).toBe(2)
        expect(accepted.boardOf.me?.me ?? 0).toBe(0)
    })

    test('none: every piece is removed and none can be tapped; Accept removes them all', async ({ page }) => {
        await openTable(page, 'citizenshipNone')
        await expect(conversion(page)).toHaveAccessibleName(
            'Your 5 warbands become 0 Imperial warbands; 5 are removed'
        )
        await expect(conversion(page)).toContainText('5 Removed')
        await expect(pieces(page)).toHaveCount(5)
        for (const one of await pieces(page).all()) await expect(one).toBeDisabled()
        await expect(grid(page).getByRole('button', { name: /^Removed: a warband/ })).toHaveCount(5)

        await answer(page, 'Accept').click()
        await expect.poll(async () => (await call(page, 'tableFacts')).machineState).not.toBe('ConsentRequest')
        const accepted = await call(page, 'tableFacts')
        expect(accepted.boardOf.me?.imperial ?? 0).toBe(0)
        expect(accepted.boardOf.me?.me ?? 0).toBe(0)
    })

    test('enough: every piece becomes Imperial and none can be tapped; the line names no loss', async ({ page }) => {
        await openTable(page, 'citizenshipEnough')
        await expect(conversion(page)).toHaveAccessibleName('Your 5 warbands become 5 Imperial warbands')
        await expect(conversion(page)).not.toContainText('Removed')
        await expect(pieces(page)).toHaveCount(5)
        for (const one of await pieces(page).all()) await expect(one).toBeDisabled()
        await expect(grid(page).getByRole('button', { name: /^Imperial: a warband/ })).toHaveCount(5)
        await expect(grid(page)).not.toContainText('Removed')
    })

    test('"You give" shows what the Exile gives, its count in gold, and is gone when they give nothing', async ({ page }) => {
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

    test('the relic is drawn as the Exile sees it, and its magnifier enlarges it', async ({ page }) => {
        await openTable(page, 'citizenshipShort')
        await grid(page).getByRole('button', { name: 'Enlarge the facedown relic on Reliquary space 1', exact: true }).click()
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

    test('on a phone the answers fit their label too, share one width and are 44 px tall', async ({ page }) => {
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
    test('“To:” the Exiles’ chips, “Promise <chip> one relic.”, then the terms as rows and “Offer” alone', async ({
        page
    }) => {
        await openTable(page, 'offerCitizenship')
        await minor(page, 'Offer Citizenship').click()
        await expect(grid(page)).toContainText('To:')
        await expect(grid(page)).not.toContainText('Choose an Exile')
        await expect(grid(page)).not.toContainText('yourself')
        await expect(answer(page, 'Cancel the offer')).toHaveCount(0)

        await grid(page).getByRole('button', { name: 'cole', exact: true }).click()
        await expect(grid(page).locator('p').filter({ hasText: 'Promise' })).toHaveText(
            'Promise cole one relic.'
        )
        await expect(grid(page)).not.toContainText('facedown')
        await panelCards(page).filter({ has: page.getByRole('img', { name: 'Cup of Plenty' }) }).click()

        await expect(grid(page).locator('p').filter({ hasText: /^To/ })).toHaveText('To cole')
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

        // The counts given are gold once picked; the counts asked stay plain.
        await answer(page, 'you give 2 favor').click()
        await expect(answer(page, 'you give 2 favor')).toHaveClass(/text-oath-accent/)
        await answer(page, 'they give 1 secrets').click()
        await expect(answer(page, 'they give 1 secrets')).not.toHaveClass(/text-oath-accent/)

        await answer(page, 'Offer').click()
        await expect.poll(async () => (await call(page, 'standing')).asked).toEqual({
            kind: 'citizenshipOffer',
            askedPlayerId: 'cole'
        })
    })

    test('Undo backs out one pick per press: a term, the banner, the relic, the Exile, then the action', async ({
        page
    }) => {
        await openTable(page, 'offerCitizenship')
        await minor(page, 'Offer Citizenship').click()
        await grid(page).getByRole('button', { name: 'cole', exact: true }).click()
        await panelCards(page).first().click()
        await answer(page, 'the Darkest Secret').click()
        await answer(page, 'you give 1 favor').click()

        await undoButton(page).click()
        await expect(answer(page, 'you give 0 favor')).toHaveAttribute('aria-pressed', 'true')
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
            'Promise cole one relic.'
        )
        await expect(grid(page)).not.toContainText('To:')
        await undoButton(page).click()
        await expect(grid(page)).toContainText('Act Phase')
        expect((await call(page, 'tableFacts')).staged).toBeUndefined()
    })
})

/** Exile (R-6.7, R-6.8): each button is the price and whom it goes to. */
test.describe('exiling', () => {
    test('Exile Citizen: one button per Citizen, “5 [favor] to <chip>”, the People’s Favor’s holder 6; a tap exiles', async ({
        page
    }) => {
        await openTable(page, 'exileCitizens')
        await minor(page, 'Exile Citizen').click()
        const cole = answer(page, '5 favor to cole')
        const ann = answer(page, '6 favor to ann')
        await expect(cole).toHaveText('5 to cole')
        await expect(ann).toHaveText('6 to ann')
        await expect(cole.getByRole('img', { name: 'favor' })).toBeVisible()
        await expect(cole.locator('.text-oath-accent')).toHaveText('5')
        await expect(grid(page)).not.toContainText('Exile cole')
        const [coleBox, annBox] = [await cole.boundingBox(), await ann.boundingBox()]
        expect(coleBox?.width).toBe(annBox?.width)

        await ann.click()
        await expect.poll(async () => (await call(page, 'standing')).statusOf.ann).toBe('exile')
        expect((await call(page, 'tableFacts')).favorOf).toMatchObject({ jacob: 6, ann: 8 })
    })

    test('Exile yourself is staged: the bar names it, one button “3 [favor] to <chip>” sends it, and Undo puts it down', async ({
        page
    }) => {
        await openTable(page, 'selfExile')
        await minor(page, 'Exile yourself').click()
        const facts = await call(page, 'tableFacts')
        expect(facts.staged).toBe('selfExile')
        expect(facts.favorOf).toEqual({ cole: 5, jacob: 4 })
        expect((await call(page, 'standing')).statusOf.cole).toBe('citizen')
        await expect(minor(page, 'Exile yourself')).toHaveCount(0)
        await expect(grid(page)).toContainText('Exile yourself')
        const pay = answer(page, '3 favor to jacob')
        await expect(pay).toHaveText('3 to jacob')

        await undoButton(page).click()
        expect((await call(page, 'tableFacts')).staged).toBeUndefined()
        await expect(pay).toHaveCount(0)

        await minor(page, 'Exile yourself').click()
        await answer(page, '3 favor to jacob').click()
        await expect.poll(async () => (await call(page, 'standing')).statusOf.cole).toBe('exile')
        expect((await call(page, 'tableFacts')).favorOf).toEqual({ cole: 2, jacob: 7 })

        // The History names who got the favor.
        await page.getByRole('tab', { name: 'History' }).click()
        await expect(page.locator('.history')).toContainText('went into exile, giving 3')
        await expect(page.locator('.history')).toContainText('to jacob')
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
            [answer(page, '5 favor to cole'), answer(page, '6 favor to ann')].map((button) =>
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
        const [cole, ann] = sizes
        expect(cole.width).toBe(ann.width)
        for (const size of sizes) {
            expect(size.width).toBeLessThan(size.panel * 0.5)
            expect(size.height).toBeGreaterThanOrEqual(44)
        }
        expect(cole.top).toBe(ann.top)
    })
})

/** Scenario 31: the defending side's losses after a won battle (R-5.5.6.a). */
test.describe('scenario 31: choosing the defending side’s losses', () => {
    test('one row of number buttons per group and a count; Kill shows only once the count is right; Undo clears every count', async ({
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
                    return tops.length > 0 && Math.max(...tops) - Math.min(...tops) >= lineHeight / 2
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
        await grid(page).getByRole('button', { name: /^Add attack die 2/ }).click()
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

    test('the spoils: what is taken in short words, the banish with the defender’s chip, and the two buttons at one width', async ({
        page
    }) => {
        await openTable(page, 'spoils')
        await expect(grid(page).locator('h3')).toHaveText('Spoils')
        await expect(grid(page)).not.toContainText('You were victorious')
        const list = grid(page).locator('ul')
        await expect(list).toContainText(/ · 0 warbands/)
        await expect(list).toContainText('The People')
        await expect(list).toContainText(/def's\s+pawn\s+and\s+favor/i)
        await expect(list).not.toContainText('their pawn sent away')
        await expect(grid(page)).toContainText('Place warbands: 0 of 4.')
        await expect(grid(page)).not.toContainText('This is how you come to rule them')
        await expect(grid(page)).toContainText(/Banish def to:/i)
        await expect(grid(page).locator('select option').first()).toHaveText('nowhere')

        const take = answer(page, 'Take spoils')
        const burn = grid(page).getByRole('button', { name: /^Take and burn 2/ })
        await expect(take).toBeVisible()
        await expect(burn).toBeVisible()
        expect(await widthOf(take)).toBe(await widthOf(burn))
        expect(await pairLayout(take, burn)).toBe('side by side')
    })
})

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
            await grid(page).getByRole('button', { name: /^Add attack die 2/ }).click()
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

/** Scenario 32: every panel waits while a send is in flight or a new state is being shown. */
test.describe('scenario 32: waiting on a send', () => {
    test('while a Travel is in flight nothing is offered; refused or accepted, the send ends the draft', async ({
        page
    }) => {
        await openTable(page, 'actPhase')
        const destination = page
            .getByRole('list', { name: 'Destinations in the Cradle' })
            .getByRole('button', { name: /^Travel to .+: spend 1 Supply$/ })

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
        expect(Math.abs(actual[channel] - expected[channel]), `${property} ${channel}`).toBeLessThanOrEqual(2)
    }
}

/** The palette's primary: a stone-800 fill inside an amber-300 border, with amber-300 text. */
async function expectPrimary(locator: ReturnType<Page['locator']>) {
    await expectColour(locator, 'backgroundColor', STONE_800)
    await expectColour(locator, 'color', AMBER_300)
    await expectColour(locator, 'borderTopColor', AMBER_300)
    expect(await locator.evaluate((element) => parseFloat(getComputedStyle(element).borderTopWidth))).toBeGreaterThan(0)
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

    expect(await isAmber(page.getByRole('button', { name: 'fork game' }).locator('svg'), 'color')).toBe(true)
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
    test('the cost line under each action in the grid; the line under it is the summary alone', async ({ page }) => {
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
        expect(await tokenRuns(reasonLine(page))).toEqual([[expect.stringMatching(/\S/), 'text-muted']])
    })

    test('Search: the Supply is accent, the draw a muted note', async ({ page }) => {
        await openTable(page, 'trade')
        await tile(page, 'Search').click()
        const deck = grid(page).getByRole('button', { name: /^Search the world deck: spend 2 Supply, draw 3$/ })
        expect(await tokenRuns(deck)).toEqual([
            ['2 Supply', 'accent'],
            ['draw 3', 'text-muted']
        ])
    })

    test('Search with a toll: the Supply, the "+", the favor given and "to" are all accent, then the payee chip', async ({ page }) => {
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

    test('Trade: what is paid is accent, the arrow muted, the gain text, and an empty bank’s 0 muted', async ({ page }) => {
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
        const forSecrets = grid(page).getByRole('button', { name: 'Trade with Book Binders: pay 2 favor, get 2 secrets' })
        expect(await tokenRuns(forSecrets)).toEqual([
            ['2', 'accent'],
            ['→', 'text-muted'],
            ['2', 'text']
        ])
        const bankEmpty = grid(page).getByRole('button', { name: /^Trade with Assassin: pay 1 secret, get 0 favor/ })
        expect(await tokenRuns(bankEmpty)).toEqual([
            ['1', 'accent'],
            ['→ 0', 'text-muted']
        ])
    })

    test('Muster: the favor placed is accent, the arrow muted, the warbands text', async ({ page }) => {
        await openTable(page, 'trade')
        await tile(page, 'Muster').click()
        const muster = grid(page).getByRole('button', { name: /^Muster at Book Binders: place 1 favor, get \d warbands?$/ })
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
        const cost = actionCard(page, 'denizen.beast.mushrooms').locator('p')
        expect(await tokenRuns(cost)).toEqual([['put 1 on it', 'accent']])
    })
})

test('scenario 40: panel text shows favor as its token, the word only as the token’s name; the bar names the action', async ({ page }) => {
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

test('scenario 39: Trade lists every trade at the site, a strip tap only enlarges, a button sends', async ({ page }) => {
    await openTable(page, 'trade')
    await tile(page, 'Trade').click()
    const rows = page.getByRole('list', { name: 'Trades at your site' }).getByRole('listitem')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toContainText('Book Binders')
    await expect(rows.nth(1)).toContainText('Assassin')
    await expect(page.getByRole('list', { name: 'Trades at your site' })).not.toContainText('Council Seat')
    await expect(
        page.getByRole('button', { name: 'Trade with Book Binders: pay 1 secret, get 3 favor from the Hearth bank' })
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Trade with Book Binders: pay 2 favor, get 2 secrets' })).toBeVisible()
    await expect(
        page.getByRole('button', { name: 'Trade with Assassin: pay 1 secret, get 0 favor from the Discord bank' })
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Trade with Assassin: pay 2 favor, get 0 secrets' })).toBeVisible()
    await expect(rows.nth(1)).not.toContainText('bank')
    await expect(rows.nth(1)).not.toContainText('faceup')
    const name = await rows.nth(0).getByText('Book Binders', { exact: true }).boundingBox()
    const firstButton = await rows.nth(0).getByRole('button').first().boundingBox()
    if (!name || !firstButton) throw Error('The row is on screen')
    expect(firstButton.x - name.x).toBeLessThan(260)

    await (await uncovered(page, '.board-card.offered')).click()
    await expect(preview(page)).toBeVisible()
    expect(await call(page, 'cardTokens', 'denizen.discord.assassin')).toEqual({ favor: 0, secrets: 0 })
    await page.keyboard.press('Escape')
    await expect(preview(page)).toHaveCount(0)

    await page.getByRole('button', { name: 'Trade with Book Binders: pay 1 secret, get 3 favor from the Hearth bank' }).click()
    await expect.poll(() => call(page, 'cardTokens', 'denizen.hearth.book-binders')).toEqual({ favor: 0, secrets: 1 })
    await expect(page.getByRole('list', { name: 'Trades at your site' })).toHaveCount(0)
})

test('scenario 39: a trade that gains nothing shows its 0 and no note under it, and is sent like any other', async ({ page }) => {
    await openTable(page, 'trade')
    await tile(page, 'Trade').click()
    const forNothing = page.getByRole('button', { name: 'Trade with Assassin: pay 2 favor, get 0 secrets' })
    await expect(forNothing).toHaveText(/^\s*2\s*→\s*0\s*$/)
    await expect(
        page.getByRole('button', { name: 'Trade with Assassin: pay 1 secret, get 0 favor from the Discord bank' })
    ).toHaveText(/^\s*1\s*→\s*0\s*$/)
    await forNothing.click()
    await expect.poll(() => call(page, 'cardTokens', 'denizen.discord.assassin')).toEqual({ favor: 2, secrets: 0 })
})

test('scenario 39: under Careless a Trade for secrets shows the favor it also gives, its 0 secrets explicit', async ({ page }) => {
    await openTable(page, 'careless')
    const before = (await call(page, 'tableFacts')).favorOf.me ?? 0
    await tile(page, 'Trade').click()
    const assassin = page.getByRole('button', { name: 'Trade with Assassin: pay 2 favor, get 0 secrets and 1 favor' })
    await expect(assassin).toHaveText(/^\s*2\s*→\s*0\s*\+\s*1\s*$/)
    await expect(assassin.locator('img')).toHaveCount(3)
    await expect(page.getByRole('button', { name: 'Trade with Book Binders: pay 2 favor, get 1 secret and 1 favor' })).toHaveText(
        /^\s*2\s*→\s*1\s*\+\s*1\s*$/
    )
    await expect(
        page.getByRole('button', { name: 'Trade with Book Binders: pay 1 secret, get 3 favor from the Hearth bank' })
    ).toHaveText(/^\s*1\s*→\s*3\s*$/)
    await assassin.click()
    await expect.poll(async () => (await call(page, 'tableFacts')).favorOf.me).toBe(before - 2 + 1)
})

test('scenario 4: Travel lists every affordable destination under its region, a button travels', async ({ page }) => {
    await openTable(page, 'actPhase')
    await tile(page, 'Travel').click()
    const cradle = page.getByRole('list', { name: 'Destinations in the Cradle' })
    await expect(cradle.getByRole('listitem')).toHaveCount(1)
    const go = cradle.getByRole('button', { name: /^Travel to .+: spend 1 Supply$/ })
    await expect(go).toBeVisible()
    await expect(dimmedSites(page).first()).toBeVisible()
    await expect(stepBacks(page)).toHaveCount(0)

    await undoButton(page).click()
    await expect(cradle).toHaveCount(0)
    await expect(dimmedSites(page)).toHaveCount(0)
    await expect(undoButton(page)).toHaveCount(0)
    await tile(page, 'Travel').click()
    await go.click()
    await expect.poll(async () => (await call(page, 'tableFacts')).siteOf.me).toBe('slot.cradle.1')
    await expect(cradle).toHaveCount(0)
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

    test('the panel is one line and only the legal destinations are lit, each with its cost wholly on its card', async ({ page }) => {
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

    test('Travel opens framed on the pawn’s region; a region chip reframes the map and chooses nothing', async ({ page }) => {
        await openTable(page, 'actPhase')
        await chooseTravelOnThePhone(page)
        const legal = await call(page, 'legalTravelDestinations')
        const count = (region: string) =>
            legal.filter((slotId) => slotId.startsWith(`slot.${region.toLowerCase()}.`)).length
        for (const region of ['Cradle', 'Provinces', 'Hinterland']) {
            await expect(regionChip(page, region)).toHaveAccessibleName(`${region}: ${count(region)} to travel to`)
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

    test('when Travel closes, by Back or by travelling, the map returns to the view it had before Travel opened', async ({ page }) => {
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
        await expect.poll(async () => (await call(page, 'tableFacts')).siteOf.me).toBe('slot.cradle.1')
        await expect.poll(unmoved).toBe(true)
    })

    test('a tap on a lit site with one way to pay travels there', async ({ page }) => {
        await openTable(page, 'actPhase')
        await chooseTravelOnThePhone(page)
        await expect.poll(() => onScreen(page, siteCard(page, 'slot.cradle.1'))).toBe(true)
        await siteCard(page, 'slot.cradle.1').tap()
        await expect.poll(async () => (await call(page, 'tableFacts')).siteOf.me).toBe('slot.cradle.1')
        await expect(boardOffers(page)).toHaveCount(0)
    })

    test('a lit site’s corner magnifier, 28 px on screen, opens its card and travels nowhere', async ({ page }) => {
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

    test('a tap on a site with two ways to pay opens the ways above the map and travels nowhere; a way’s button travels', async ({ page }) => {
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
        await expect.poll(async () => (await call(page, 'tableFacts')).siteOf.me).toBe('slot.cradle.1')
    })
})

test.describe('scenario 4 on a phone held sideways', () => {
    test.use({ viewport: { width: 812, height: 375 }, hasTouch: true })

    test('every lit site is framed and no region chip shows; two ways open beside the site on one row', async ({ page }) => {
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
        expect(Math.abs(picture.y + picture.height / 2 - (one.y + one.height / 2))).toBeLessThan(picture.height / 2)
    })
})

/** R-7.1.4 — a toll's way names its payee by their chip; the card is named in the History. */
test.describe('scenario 4 with a toll', () => {
    const tolled = 'slot.provinces.0'
    const tollWay = (page: Page) =>
        grid(page).getByRole('button', { name: /give 1 favor to ann \(Toll Roads\)$/ })

    test('on a desktop the bar reads Travel, the way reads its favor and the payee chip, and no note names the card', async ({ page }) => {
        await openTable(page, 'travelToll')
        await tile(page, 'Travel').click()
        await expect(grid(page).locator('.bg-oath-accent-soft').first()).toHaveText('Travel')
        await expect(tollWay(page)).toHaveCount(1)
        await expect(tollWay(page)).toContainText(/\d Supply\s*\+\s*1\s*to\s*ann/)
        await expect(grid(page)).not.toContainText('Toll Roads')

        await tollWay(page).click()
        await expect.poll(async () => (await call(page, 'tableFacts')).siteOf.me).toBe(tolled)
        await page.getByRole('tab', { name: 'History' }).click()
        const row = page.getByRole('tabpanel', { name: 'History' }).getByRole('listitem').first()
        await expect(row).toContainText(/travelled to .+, spending \d Supply; 1\s*to ann \(Toll Roads\)/)
        await expect(row.getByRole('img', { name: 'favor' })).toBeVisible()
    })

    test.describe('on a phone held upright', () => {
        test.use({ viewport: { width: 375, height: 812 }, hasTouch: true })

        test('the chip is its number and the favor, the token no taller than the number; a tap opens the way with the payee chip', async ({ page }) => {
            await openTable(page, 'travelToll')
            await chooseTravelOnThePhone(page)
            await regionChip(page, 'Provinces').tap()
            const chip = siteAt(page, tolled).locator('.travel-cost')
            await expect(chip).toHaveText(/^\s*\d\+$/)
            const token = chip.getByRole('img', { name: 'favor' })
            await expect(token).toBeVisible()
            const fontSize = await chip.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))
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

test('scenario 4: on a desktop the regions stand side by side as columns in the board’s order, each region’s destinations stacked, costs in gold', async ({ page }) => {
    await openTable(page, 'actPhase')
    await tile(page, 'Travel').click()
    await expect(regionChips(page)).toHaveCount(0)
    const [cradle, provinces, hinterland] = [
        await boxOf(destinations(page, 'Cradle')),
        await boxOf(destinations(page, 'Provinces')),
        await boxOf(destinations(page, 'Hinterland'))
    ]
    expect(provinces.y).toBeCloseTo(cradle.y, 0)
    expect(hinterland.y).toBeCloseTo(cradle.y, 0)
    expect(provinces.x).toBeGreaterThan(cradle.x + cradle.width - 1)
    expect(hinterland.x).toBeGreaterThan(provinces.x + provinces.width - 1)

    const [top, middle, bottom] = await boxesOf(destinations(page, 'Provinces').getByRole('listitem'))
    expect(middle.x).toBeCloseTo(top.x, 0)
    expect(bottom.x).toBeCloseTo(top.x, 0)
    expect(middle.y).toBeGreaterThan(top.y + top.height - 1)
    expect(bottom.y).toBeGreaterThan(middle.y + middle.height - 1)

    const go = destinations(page, 'Cradle').getByRole('button', { name: /^Travel to .+: spend 1 Supply$/ })
    // Rule G: the cost is in the accent, amber-300.
    await expect(go.getByText('1 Supply')).toHaveCSS('color', 'oklch(0.879 0.169 91.605)')
    const [art] = await boxesOf(destinations(page, 'Cradle').locator('img'))
    expect(art.width / art.height).toBeCloseTo(1313 / 1016, 1)
})

test('scenario 4: on a desktop a destination with two ways to pay keeps its tile, with a button per way under the name, each as wide as the wider label', async ({ page }) => {
    await openTable(page, 'leavingBuriedGiant')
    await tile(page, 'Travel').click()
    const item = destinations(page, 'Provinces').getByRole('listitem').first()
    const ways = item.getByRole('button')
    await expect(ways).toHaveCount(2)
    await expect(ways.first()).toHaveAccessibleName(/^Travel to .+: spend 2 Supply$/)
    const flip = ways.last()
    await expect(flip).toHaveAccessibleName(/^Travel to .+: spend no Supply, flip a secret facedown$/)
    // The map's chip reads both ways on a desktop too.
    const chip = siteAt(page, 'slot.provinces.0').locator('.travel-cost')
    await expect(chip).toHaveText('2 or 0+')
    await expect(chip.getByRole('img', { name: 'secret' })).toBeVisible()
    await expect(siteAt(page, 'slot.hinterland.0').locator('.travel-cost')).toHaveText('0+')
    const [supply, flipped] = await boxesOf(ways)
    expect(flipped.x).toBeCloseTo(supply.x, 0)
    expect(flipped.y).toBeGreaterThan(supply.y + supply.height - 1)
    expect(flipped.width).toBeCloseTo(supply.width, 0)
    const text = await boxOf(item.locator('.tile__text'))
    expect(flipped.x + flipped.width).toBeLessThanOrEqual(text.x + text.width + 0.5)

    await flip.click()
    await expect.poll(async () => (await call(page, 'tableFacts')).siteOf.me).toBe('slot.provinces.0')
})

test('scenario 49: Search lists each source it can draw from, a button draws', async ({ page }) => {
    await openTable(page, 'actPhase')
    await tile(page, 'Search').click()
    const rows = page.getByRole('list', { name: 'Sources to search' }).getByRole('listitem')
    await expect(rows.first()).toContainText('The world deck')
    const deck = page.getByRole('button', { name: /^Search the world deck: spend \d Supply, draw 3$/ })
    await expect(deck).toBeVisible()
    await expect(boardOffers(page).or(page.locator('.deck.pickable'))).not.toHaveCount(0)
    await deck.click()
    await expect.poll(async () => (await call(page, 'tableFacts')).machineState).toBe('Searching')
})

test('scenario 20: Recover lists the banners to outbid, the price is a row of number buttons', async ({ page }) => {
    await openTable(page, 'trade')
    const before = (await call(page, 'tableFacts')).favorOf.me ?? 0
    await tile(page, 'Recover').click()
    const banners = page.getByRole('list', { name: 'Banners to recover' })
    const peoples = banners.getByRole('button', { name: /^Recover the People’s Favor: pay \d+ favor/ })
    await expect(peoples).toBeVisible()
    await peoples.click()
    const amounts = grid(page).getByRole('button', { name: /^pay \d+ favor$/ })
    await expect(amounts.first()).toHaveAttribute('aria-pressed', 'true')
    const count = await amounts.count()
    const choice = amounts.nth(count > 1 ? 1 : 0)
    const paid = Number((await choice.textContent())?.trim())
    await choice.click()
    await expect(choice).toHaveAttribute('aria-pressed', 'true')
    await grid(page).getByRole('button', { name: /^(Arcane|Order|Hearth|Discord|Beast|Nomad) bank/ }).first().click()
    await grid(page).getByRole('button', { name: 'Recover the People’s Favor', exact: true }).click()
    await expect.poll(async () => (await call(page, 'tableFacts')).favorOf.me).toBe(before - paid)
})

test('scenario 20: Recover heads the relics "Relics" and gives a banner’s least bid as "N+"', async ({ page }) => {
    await openTable(page, 'recover')
    await tile(page, 'Recover').click()
    await expect(grid(page).getByRole('heading', { name: 'Relics', exact: true })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Relics to recover' }).getByRole('listitem')).toHaveCount(1)
    const banners = page.getByRole('list', { name: 'Banners to recover' })
    const peoples = banners.getByRole('button', { name: /^Recover the People’s Favor: pay \d+ favor or more$/ })
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
    const recover = grid(page).getByRole('button', { name: 'Recover the People’s Favor', exact: true })
    await expect(recover).toHaveCount(0)
    await expect(grid(page).locator('.text-oath-danger')).toHaveCount(0)
    await expect(grid(page).getByText('Return its', { exact: false })).toHaveText(/^Return its\s*, starting at:$/)

    await grid(page).getByRole('button', { name: /^(Arcane|Order|Hearth|Discord|Beast|Nomad) bank/ }).first().click()
    await expect(recover).toHaveText('Recover')
    await expect(grid(page).locator('.text-oath-danger')).toHaveCount(0)

    await openTable(page, 'recover')
    await tile(page, 'Recover').click()
    await page.getByRole('button', { name: /^Recover the Darkest Secret: pay/ }).click()
    await expect(grid(page).getByText(/^Darkest Secret: pay how many\s*\?$/)).toBeVisible()
    await expect(grid(page).getByRole('button', { name: 'Recover the Darkest Secret', exact: true })).toHaveText('Recover')
})

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

test('scenario 6: the facedown advisers to play are cards in the panel, a tap shows the placements', async ({ page }) => {
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

test('scenario 18: each warband move is a row of counts, and a count sends', async ({ page }) => {
    await openTable(page, 'moves')
    await grid(page).getByRole('button', { name: 'Move warbands', exact: true }).click()
    const rows = page.getByRole('list', { name: 'Warband moves' }).getByRole('listitem')
    await expect(rows).toHaveCount(2)
    const onto = rows.filter({ hasText: 'From your board to your site' })
    await expect(onto.getByRole('button')).toHaveCount(4)
    await expect(rows.filter({ hasText: 'From your site to your board' }).getByRole('button')).toHaveCount(2)
    await expect(dimmedSites(page)).toHaveCount(0)
    await onto.getByRole('button', { name: /move 2$/ }).click()
    await expect.poll(async () => (await call(page, 'tableFacts')).boardOf.me).toEqual({ me: 2 })
    await expect(page.getByRole('list', { name: 'Warband moves' })).toHaveCount(0)
})

test('scenario 5: a Campaign target is a row with its picture, a tap adds it and a second drops it', async ({ page }) => {
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

test('scenario 2: an Exile chooses a start site from the rows, and a tap on another moves the choice', async ({ page }) => {
    await openTable(page, 'setup')
    await call(page, 'seatMakesSetupChoice')
    const sites = page.getByRole('list', { name: 'Start sites' }).locator('button[aria-pressed]')
    await expect(sites.first()).toBeVisible()
    expect(await sites.count()).toBeGreaterThan(1)
    await sites.nth(0).click()
    await expect(sites.nth(0)).toHaveAttribute('aria-pressed', 'true')
    await expect(sites.nth(0).getByText('start here')).toBeVisible()
    await expect(sites.nth(1).getByText('start here')).toBeHidden()
    await sites.nth(1).click()
    await expect(sites.nth(1)).toHaveAttribute('aria-pressed', 'true')
    await expect(sites.nth(0)).toHaveAttribute('aria-pressed', 'false')
    await expect(sites.nth(0).getByText('start here')).toBeHidden()
    await expect(sites.nth(1).getByText('start here')).toBeVisible()
})

/** The start-site rows share the widest row's width, which a pick does not change, and stretch across nothing. */
for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
    test(`scenario 2: the start-site rows are one width and fit their names at ${viewport.width}`, async ({ page }) => {
        await page.setViewportSize(viewport)
        await openTable(page, 'setup')
        await call(page, 'seatMakesSetupChoice')
        const sites = page.getByRole('list', { name: 'Start sites' }).locator('button[aria-pressed]')
        await expect(sites.first()).toBeVisible()
        const widths = async () => sites.evaluateAll((rows) => rows.map((row) => row instanceof HTMLElement ? row.offsetWidth : 0))
        const before = await widths()
        expect(new Set(before).size).toBe(1)
        const room = await page.getByRole('list', { name: 'Start sites' }).evaluate((list) => list.parentElement?.clientWidth ?? 0)
        expect(before[0]).toBeLessThan(room)
        if (viewport.width < 640) {
            const heights = await sites.evaluateAll((rows) => rows.map((row) => row instanceof HTMLElement ? row.offsetHeight : 0))
            for (const height of heights) expect(height).toBeGreaterThanOrEqual(44)
        }
        await sites.nth(0).click()
        await expect(sites.nth(0)).toHaveAttribute('aria-pressed', 'true')
        expect(await widths()).toEqual(before)
    })
}

test('scenario 2: the other sites dim; a card kept first stays marked, and the site picked after takes the ring off the map', async ({
    page
}) => {
    await openTable(page, 'setup')
    await call(page, 'seatMakesSetupChoice')
    await expect(page.getByRole('list', { name: 'Start sites' })).toBeVisible()
    const lit = await boardOffers(page).count()
    expect(lit).toBeGreaterThan(1)
    expect(await dimmedSites(page).count()).toBeGreaterThan(0)
    expect(lit + (await dimmedSites(page).count())).toBe(await page.locator('.site').count())

    const card = grid(page).locator('button[aria-pressed]').first()
    await card.click()
    await expect(card).toHaveAttribute('aria-pressed', 'true')
    await expect(boardOffers(page)).toHaveCount(lit)
    await page.getByRole('list', { name: 'Start sites' }).locator('button[aria-pressed]').first().click()
    await expect(boardOffers(page)).toHaveCount(0)
    await expect(dimmedSites(page)).toHaveCount(0)
    await expect(page.getByText('Tap to discard; the last goes on top.', { exact: true })).toBeVisible()
})

test('scenario 2: Undo unwinds an Exile’s picks, the card then the site, and the lit map returns', async ({ page }) => {
    await openTable(page, 'setup')
    await call(page, 'seatMakesSetupChoice')
    const sites = page.getByRole('list', { name: 'Start sites' }).locator('button[aria-pressed]')
    await expect(sites.first()).toBeVisible()
    const litBefore = await boardOffers(page).count()
    expect(litBefore).toBeGreaterThan(1)
    const pickedSites = page.getByRole('list', { name: 'Start sites' }).locator('button[aria-pressed="true"]')

    await sites.nth(0).click()
    await expect(pickedSites).toHaveCount(1)
    await panelCards(page).filter({ hasNotText: /start here/ }).first().click()
    await expect(page.getByText('Tap to discard; the last goes on top.', { exact: true })).toBeVisible()
    await expect(stepBacks(page)).toHaveCount(0)
    const undo = undoButton(page)
    await undo.click()
    await expect(page.getByText('Tap to discard; the last goes on top.', { exact: true })).toHaveCount(0)
    await expect(pickedSites).toHaveCount(1)
    await undo.click()
    await expect(pickedSites).toHaveCount(0)
    await expect(boardOffers(page)).toHaveCount(litBefore)
})

const favorOn = (page: Page, n: number, site: string) =>
    grid(page).getByRole('button', { name: `place ${n} favor on ${site}`, exact: true })

/** R-1.16, R-1.23.1 — a real six-seat deal: the bank holds 4, the Salt Flats want 2 and the Mine 3. */
test('setup: a short split keeps the Chancellor at the top Cradle site and holds only the discards', async ({ page }) => {
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

    await panelCards(page).filter({ hasNotText: /^\d$/ }).first().click()
    await expect(favorOn(page, 2, 'Salt Flats')).toBeVisible()
    await expect(grid(page)).toContainText('Place all 4')
    await expect(count).toBeVisible()
    await expect(grid(page)).not.toContainText('Tap to discard')
    expect((await call(page, 'tableFacts')).siteOf[seatId]).toBeUndefined()

    await favorOn(page, 2, 'Salt Flats').click()
    await expect(count).toHaveCount(0)
    await expect(favorOn(page, 2, 'Salt Flats')).toHaveCount(0)
    await expect(page.getByText('Tap to discard; the last goes on top.', { exact: true })).toBeVisible()
    await panelCards(page).first().click()
    await expect.poll(async () => (await call(page, 'tableFacts')).siteOf[seatId]).toBe('slot.cradle.0')
    expect((await call(page, 'cardTokens', 'site.salt-flats')).favor).toBe(2)
    expect(errors).toEqual([])
})

test('scenario 43: a menu row lights what it names on the table while pointed at', async ({ page }) => {
    await openTable(page, 'actPhase')
    await tile(page, 'Travel').click()
    const row = page.getByRole('list', { name: 'Destinations in the Cradle' }).getByRole('listitem').first()
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

test('scenario 45: the focus views fill the board; Full restores; a zoom by hand clears the choice; an enlarged site zooms the board to its row', async ({ page }) => {
    await openTable(page, 'setup')
    const chooser = page.getByRole('group', { name: 'Focus the board' })
    const site = page.locator('.site .board-card').first()
    const siteWidth = async () => (await site.boundingBox())?.width ?? 0
    await expect.poll(siteWidth).toBeGreaterThan(0)
    await page.waitForTimeout(500)
    const full = await siteWidth()

    await chooser.getByRole('button', { name: 'Cradle' }).click()
    await expect(chooser.getByRole('button', { name: 'Cradle' })).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(siteWidth).toBeGreaterThan(full * 1.5)

    await chooser.getByRole('button', { name: 'Full' }).click()
    await expect(chooser.getByRole('button', { name: 'Full' })).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(siteWidth).toBeLessThan(full * 1.1)

    await chooser.getByRole('button', { name: 'Banks' }).click()
    await expect(chooser.getByRole('button', { name: 'Banks' })).toHaveAttribute('aria-pressed', 'true')
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
test('scenario 54: the focus views sit in one line along the top of the map on a desktop, and a phone has none', async ({ page }) => {
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
    expect(Math.abs(((await full.boundingBox())?.y ?? 0) - ((await banks.boundingBox())?.y ?? -100))).toBeLessThan(2)

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(chooser).toBeHidden()
    // At phone width the board sits below the panel; a card is only reachable once it is on screen.
    await page.locator('.scaling-surface').first().scrollIntoViewIfNeeded()
    await expect(async () => (await uncovered(page, '.site .board-card')).click()).toPass()
    await expect(page.getByRole('button', { name: 'Zoom the board here' })).toBeVisible()
})

test('scenario 45: choosing a focus leaves the staged action, the lit sites and the panel unchanged', async ({ page }) => {
    await openTable(page, 'actPhase')
    await tile(page, 'Travel').click()
    await expect(page.getByRole('list', { name: 'Destinations in the Cradle' })).toBeVisible()
    const panelBefore = await grid(page).innerText()
    const offeredBefore = await boardOffers(page).count()
    const stagedBefore = (await call(page, 'tableFacts')).staged
    const cradle = page.getByRole('group', { name: 'Focus the board' }).getByRole('button', { name: 'Cradle' })
    await cradle.click()
    await expect(cradle).toHaveAttribute('aria-pressed', 'true')
    expect(await grid(page).innerText()).toBe(panelBefore)
    expect(await boardOffers(page).count()).toBe(offeredBefore)
    expect((await call(page, 'tableFacts')).staged).toBe(stagedBefore)
})

test('scenario 46: in full screen the panel is docked above the board, a Travel goes from it, and a card enlarges inside', async ({ page }) => {
    await openTable(page, 'actPhase')
    await page.mouse.move(800, 600)
    await page.keyboard.press('f')
    const dialog = page.locator('dialog[aria-label="Full screen view"]')
    await expect(dialog).toHaveCount(1)
    await dialog.locator('.majors button').filter({ hasText: 'Travel' }).click()
    const cradle = dialog.getByRole('list', { name: 'Destinations in the Cradle' })
    await expect(cradle).toBeVisible()
    await dialog.getByRole('group', { name: 'Focus the board' }).getByRole('button', { name: 'Provinces' }).click()
    await expect(dialog.getByRole('group', { name: 'Focus the board' }).getByRole('button', { name: 'Provinces' })).toHaveAttribute('aria-pressed', 'true')
    await dialog.locator('.board-card').first().click()
    await expect(dialog.locator('.card-preview')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog.locator('.card-preview')).toHaveCount(0)
    await cradle.getByRole('button', { name: /^Travel to .+: spend 1 Supply$/ }).click()
    await expect.poll(async () => (await call(page, 'tableFacts')).siteOf.me).toBe('slot.cradle.1')
})

test('scenario 47: Escape closes one layer at a time: the enlarged card or the open goals before full screen, a seat’s card before the seat', async ({ page }) => {
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

test('scenario 47: a press outside an open seat or the goals closes it and reaches nothing under it', async ({ page }) => {
    await openTable(page, 'trade')
    await tile(page, 'Travel').click()
    const destinations = page.getByRole('list', { name: /^Destinations in the / }).first()
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
    const cradle = page.getByRole('group', { name: 'Focus the board' }).getByRole('button', { name: 'Cradle' })
    await cradle.click()
    await expect(cradle).toHaveAttribute('aria-pressed', 'true')

    await page.getByRole('button', { name: 'go to current' }).click()
    await expect(prompt).toBeVisible()
    await expect(page.getByRole('list', { name: 'Start sites' })).toBeVisible()
    await expect(cradle).toHaveAttribute('aria-pressed', 'true')
})

test('scenario 49: with Observatory declared every non-empty pile is listed and ringed and the world deck is not; a pile’s button searches it', async ({
    page
}) => {
    await openTable(page, 'observatory')
    await tile(page, 'Search').click()
    await expect(grid(page).getByRole('button', { name: /^Search the world deck/ })).toBeVisible()
    await panelCards(page).first().click()
    const provinces = grid(page).getByRole('button', { name: /^Search the Provinces discard pile/ })
    await expect(provinces).toBeVisible()
    await expect(grid(page).getByRole('button', { name: /^Search the Hinterland discard pile/ })).toBeVisible()
    await expect(grid(page).getByRole('button', { name: /^Search the world deck/ })).toHaveCount(0)
    await expect(grid(page).getByRole('button', { name: /^Search the Cradle discard pile/ })).toHaveCount(0)
    await expect(page.locator('.discard.pickable')).toHaveCount(2)
    await expect(page.locator('.discard.empty.pickable')).toHaveCount(0)
    await expect(page.locator('.deck--laid.pickable')).toHaveCount(0)
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
    await expect(page.getByRole('button', { name: 'Muster at Book Binders: place 1 favor, get 2 warbands' })).toBeVisible()

    await expect(stepBacks(page)).toHaveCount(0)
    await undoButton(page).click()
    await expect(list).toHaveCount(0)
    await expect(undoButton(page)).toHaveCount(0)
    await tile(page, 'Muster').click()
    await page.getByRole('button', { name: 'Muster at Assassin: place 1 favor, get 2 warbands' }).click()
    await expect.poll(() => call(page, 'cardTokens', 'denizen.discord.assassin')).toEqual({ favor: 1, secrets: 0 })
    await expect(list).toHaveCount(0)
})

test('scenario 19: with the warband bank empty, each Muster shows → 0 and no note, and still sends', async ({ page }) => {
    await openTable(page, 'musterEmptyBank')
    await tile(page, 'Muster').click()
    const list = page.getByRole('list', { name: 'Musters at your site' })
    await expect(list.getByRole('listitem')).toHaveCount(2)
    const muster = page.getByRole('button', { name: 'Muster at Assassin: place 1 favor, get 0 warbands' })
    await expect(muster).toHaveText(/^\s*1\s*→\s*0\s*$/)
    await expect(list).not.toContainText('bank')
    await muster.click()
    await expect.poll(() => call(page, 'cardTokens', 'denizen.discord.assassin')).toEqual({ favor: 1, secrets: 0 })
})

test('card backs: another seat’s facedown Vision and the Vision in its hand show the Vision back', async ({ page }) => {
    await openTable(page, 'visionBacks')
    const backsOf = (label: string) =>
        page.getByRole('img', { name: label }).evaluateAll((images) =>
            images.map((image) => (image.getAttribute('src') ?? '').includes('vision') ? 'vision' : 'denizen')
        )
    expect((await backsOf('A facedown adviser')).sort()).toEqual(['denizen', 'vision'])
    expect(await backsOf('A Vision in hand')).toEqual(['vision'])
    expect(await backsOf('A denizen in hand')).toEqual(['denizen'])

    await page.getByTitle("Open ann's seat").click()
    expect((await backsOf('A facedown adviser')).sort()).toEqual(['denizen', 'denizen', 'vision', 'vision'])
    expect(await backsOf('A Vision in hand')).toEqual(['vision', 'vision'])
})

test('scenario 35, in a game created before the turn-flow revision: a favor bank is chosen by its suit symbol, none until a tap, ringed when picked, and the pick is what is sent', async ({ page }) => {
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
    await expect.poll(async () => (await call(page, 'tableFacts')).favorOf.me).toBe(before.favorOf.me + 1)
    expect((await call(page, 'tableFacts')).favorBank.arcane).toBe(before.favorBank.arcane - 1)
})

test('scenario 36: the rolled dice sit in the Campaign panel, faces and totals, for the deciding seat and a waiting one, and not on the rail', async ({ page }) => {
    await openTable(page, 'exileDefeated')
    const dice = grid(page).getByRole('region', { name: 'the Campaign\'s dice' })
    await expect(dice).toBeVisible()
    await expect(dice).toContainText(/\d+ swords?/)
    await expect(dice).toContainText(/\d+ defense/)
    await expect(dice.locator('img').first()).toBeVisible()
    await expect(page.locator('.rail').getByText(/swords?$/)).toHaveCount(0)

    const watcher = await call(page, 'viewOffTheClock')
    expect(watcher).not.toBe('def')
    await expectWaitingOn(page, ['def'])
    await expect(grid(page).getByRole('region', { name: 'the Campaign\'s dice' })).toContainText(/\d+ defense/)
})

test('the unrolled dice: while the defender uses battle plans, the dice row prints no total and the panel names the defender', async ({ page }) => {
    await openTable(page, 'defenderPlans')
    expect(await call(page, 'viewOffTheClock')).toBe('att')
    const dice = grid(page).getByRole('region', { name: 'the Campaign\'s dice' })
    await expect(dice.locator('[title$="not yet rolled"]').first()).toBeVisible()
    await expect(dice).not.toContainText(/waiting/i)
    await expect(dice.locator('.dice__total')).toHaveText(['', ''])
    await expectWaitingOn(page, ['def'])
})

test('the unrolled dice keep the totals’ room: on a phone the dice row does not move when the defender rolls', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await openTable(page, 'defenderPlans')
    const row = grid(page).getByRole('region', { name: 'the Campaign\'s dice' }).locator('.dice')
    const before = await row.boundingBox()
    await grid(page).getByRole('button', { name: 'No plans', exact: true }).click()
    await expect(row.locator('img').first()).toBeVisible()
    await expect(row).toContainText(/\d+ swords?/)
    const after = await row.boundingBox()
    expect(after?.height).toBe(before?.height)
})

test('scenario 37: the goals on the rail, tap-only, with the next win; the seat cards keep only Visions and Successor', async ({ page }) => {
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
    await expect(goals).toContainText(/wins as the Oathkeeper if the end die ends the game after round 5 \(on a 6\)/)
    await expect(goals.locator('[title="ann: 2 sites ruled"]')).toHaveCount(2)
    await expect(goals).not.toContainText('sites ruled')
    await expect(goals.getByText('not met')).toHaveCount(2)
    await page.keyboard.press('Escape')
    await expect(goals).toHaveCount(0)

    await rail.click()
    await expect(goals).toBeVisible()
    await page.mouse.click(5, 5)
    await expect(goals).toHaveCount(0)
})

test('scenario 37: under a banner Oath the Oath is held, one ringed disc and no counts', async ({ page }) => {
    await openTable(page, 'goalsRailDevotion')
    const rail = page.getByRole('button', { name: 'Goals: open the enlarged view' })
    await expect(rail).toContainText('The Oath of Devotion')
    await expect(rail.getByRole('img', { name: 'the Darkest Secret' })).toHaveCount(1)
    await expect(rail.locator('[title="ann holds the Darkest Secret"]')).toHaveCount(1)
})

function framesInsidePanel(page: Page) {
    return page.locator('.panel').evaluate((panel) =>
        [...panel.querySelectorAll('*')]
            .filter((element) => !element.closest('button, [role="button"], input, select, textarea'))
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
    test(`one frame per panel: inside the ${name} panel only controls are framed`, async ({ page }) => {
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
test('scenario 23: the Search bar stays over the steps with no Back; the plays share one width', async ({ page }) => {
    await openTable(page, 'searching')
    const bar = grid(page).locator('.bg-oath-accent-soft').first()
    await expect(bar).toHaveText('Search')
    await expect(grid(page).getByText('Keep one.', { exact: true })).toBeVisible()
    await expect(stepBacks(page)).toHaveCount(0)

    await panelCards(page).first().click()
    await expect(bar).toHaveText('Search')
    await expect(stepBacks(page)).toHaveCount(0)
    await expect(grid(page).getByText('How do you play it?', { exact: true })).toBeVisible()
    const plays = grid(page).getByRole('button', { name: /^(To your site|Adviser, faceup|Adviser, facedown|As your Vision|Play it|Discard)$/ })
    expect(await plays.count()).toBeGreaterThan(1)
    const widths = await plays.evaluateAll((buttons) => buttons.map((button) => Math.round(button.getBoundingClientRect().width)))
    expect(new Set(widths).size).toBe(1)
})

test('scenario 23: a Search toll names who gets the favor on the source’s button, its token no taller than the text', async ({ page }) => {
    await openTable(page, 'searchTollByCole')
    await tile(page, 'Search').click()
    const pile = grid(page).getByRole('button', { name: /^Search the Cradle discard pile/ })
    await expect(pile).toBeVisible()
    await expect(pile).toContainText(/2 Supply\s*\+\s*1\s*to\s*cole/i)
    const token = pile.getByRole('img', { name: 'favor' })
    const [tokenHeight, fontSize] = await token.evaluate((image) => [
        image.getBoundingClientRect().height,
        parseFloat(getComputedStyle(image.parentElement ?? image).fontSize)
    ])
    expect(tokenHeight).toBeLessThanOrEqual(fontSize)
})

/**
 * Each menu button's size, its row's width, and the width its words, tokens and chips take
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
                const insets = ['padding-left', 'padding-right', 'border-left-width', 'border-right-width']
                    .map((property) => parseFloat(style.getPropertyValue(property)))
                    .reduce((sum, inset) => sum + inset, 0)
                const inks: DOMRect[] = []
                const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
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
                const row = button.closest('[role="listitem"]')
                return {
                    width,
                    height: parseFloat(style.height),
                    row: row ? parseFloat(getComputedStyle(row).width) : 0,
                    content:
                        (Math.max(...inks.map((ink) => ink.right)) - Math.min(...inks.map((ink) => ink.left))) / scale +
                        insets
                }
            })
        )
}

/** Rule 3: on a phone a menu's buttons keep their size: the label's width, one width per menu. */
test.describe('at phone width', () => {
    test.use({ viewport: { width: 375, height: 812 } })

    for (const [table, action, list] of [
        ['searchTollByCole', 'Search', 'Sources to search'],
        ['trade', 'Trade', 'Trades at your site']
    ] as const) {
        test(`the ${action} menu's buttons are their content's width, one width for the menu, at least 44 px tall`, async ({
            page
        }) => {
            await openTable(page, table)
            await tile(page, action).click()
            await expect(page.getByRole('list', { name: list }).getByRole('button').first()).toBeVisible()
            const sizes = await menuButtonSizes(page, list)
            expect(sizes.length).toBeGreaterThan(1)
            expect(new Set(sizes.map((size) => size.width)).size).toBe(1)
            const width = sizes[0].width
            const standard = 8.5 * 16
            const widestContent = Math.max(...sizes.map((size) => size.content))
            for (const size of sizes) {
                expect(size.width).toBeLessThan(size.row * 0.7)
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
        await expect(page.getByRole('button', { name: 'Trade with Assassin: pay 2 favor, get 0 secrets and 1 favor' })).toHaveText(
            /\+\s*1/
        )
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
                    const edge = row.getBoundingClientRect().right - parseFloat(getComputedStyle(row).paddingRight)
                    return {
                        inside: buttons.every(
                            (button) =>
                                button.scrollWidth <= button.clientWidth &&
                                button.getBoundingClientRect().right <= edge + 0.5
                        ),
                        tops: buttons.map((button) => Math.round(button.getBoundingClientRect().top)),
                        sideBySide: buttons.length * buttons[0].getBoundingClientRect().width <= edge - row.getBoundingClientRect().left
                    }
                })
            )
        for (const row of placed) {
            expect(row.inside).toBe(true)
            if (!row.sideBySide) expect(new Set(row.tops).size).toBe(row.tops.length)
        }
    })
})

test('scenario 23: the Conspiracy takes from a player’s chip; "Play" shows with nobody picked or a prize, never a player alone', async ({ page }) => {
    await openTable(page, 'searchConspiracy')
    await grid(page).getByRole('button', { name: 'Conspiracy', exact: true }).click()
    await grid(page).getByRole('button', { name: 'Play it', exact: true }).click()
    await expect(grid(page).getByText('The Conspiracy: take a relic or banner?', { exact: true })).toBeVisible()
    const play = grid(page).getByRole('button', { name: 'Play', exact: true })
    const cole = grid(page).getByRole('button', { name: /^cole$/i })
    await expect(grid(page).getByText('From:', { exact: true })).toBeVisible()
    await expect(cole).toHaveAttribute('aria-pressed', 'false')
    await expect(play).toBeVisible()

    await cole.click()
    await expect(cole).toHaveAttribute('aria-pressed', 'true')
    await expect(play).toHaveCount(0)
    await expect(grid(page).locator('.text-oath-danger')).toHaveCount(0)

    await grid(page).getByRole('button', { name: 'Cup of Plenty', exact: true }).click()
    await expect(play).toBeVisible()
    await cole.click()
    await expect(cole).toHaveAttribute('aria-pressed', 'false')
    await expect(play).toBeVisible()
})

const usePower = (page: Page) => grid(page).getByRole('button', { name: 'Use a power', exact: true })
const actionCard = (page: Page, cardId: string) => grid(page).locator(`[data-action-card="${cardId}"]`)
const picked = (page: Page) => grid(page).locator('button[aria-pressed="true"]')
// The ring on Use a power ties it to the reason it answers.
const ringedBy = (page: Page) => grid(page).locator('.minors button[aria-describedby]')

test('scenario 55: a dimmed major no card makes possible leaves Use a power unringed, and the ring clears with the reason', async ({ page }) => {
    await openTable(page, 'cardsOpenTravel')
    await expect(usePower(page)).toBeVisible()
    await tile(page, 'Travel').click({ force: true })
    await expect(ringedBy(page)).toHaveCount(1)
    await tile(page, 'Search').click({ force: true })
    await expect(reasonLine(page)).toHaveText('Needs 2 Supply; you have 0.')
    await expect(ringedBy(page)).toHaveCount(0)
    await expect(usePower(page)).not.toHaveAttribute('aria-describedby')
})

test('scenario 55: pointing at the ringed Use a power keeps the reason and the ring; another tile clears both', async ({ page }) => {
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

test('scenario 55: on a phone the ring on Use a power is drawn whole inside the grid', async ({ page }) => {
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

test('scenario 55: a card that makes a Search possible is found with the powers; the Search tile stays dimmed and the pile’s button sends', async ({ page }) => {
    await openTable(page, 'cardOpensSearch')
    await expect(tile(page, 'Search')).toHaveAttribute('aria-disabled', 'true')
    await tile(page, 'Search').click({ force: true })
    await expect(reasonLine(page)).toHaveText('Needs 2 Supply; you have 1.')
    await expect(reasonLine(page)).not.toContainText('Mushrooms')
    await expect(usePower(page)).toHaveAccessibleDescription('Needs 2 Supply; you have 1.')
    expect(await usePower(page).evaluate((chip) => getComputedStyle(chip).boxShadow)).toContain('inset')
    expect((await call(page, 'tableFacts')).staged).toBeUndefined()

    await expect(usePower(page)).toBeEnabled()
    await usePower(page).click()
    await expect(grid(page)).toContainText('Makes an action possible')
    const card = actionCard(page, 'denizen.beast.mushrooms')
    await expect(card).toContainText('Search:')
    await expect(card).toContainText('on it')
    await card.getByRole('button', { name: 'Search with Mushrooms', exact: true }).click()
    expect((await call(page, 'tableFacts')).machineState).toBe('ActPhase')
    expect((await call(page, 'tableFacts')).staged).toBe('search')

    const pile = grid(page).getByRole('button', { name: 'Search the Cradle discard pile: spend 0 Supply, draw 1 from the bottom' })
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

    await actionCard(page, 'denizen.beast.mushrooms').getByRole('button', { name: 'Search with Mushrooms', exact: true }).click()
    await pile.click()
    await expect(page.getByText('Keep one.', { exact: true })).toBeVisible()
    const facts = await call(page, 'tableFacts')
    expect(facts.machineState).toBe('Searching')
    expect(facts.secretsOn['denizen.beast.mushrooms']).toBe(1)
    await expect(page.locator('.discard').first()).toContainText('1')
})

test('scenario 56: two cards that make a Travel possible are two rows; one says it ends the Act Phase, and each opens the destinations it reaches', async ({ page }) => {
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
    const cradle = grid(page).getByRole('list', { name: 'Destinations in the Cradle' })
    await expect(cradle).toBeVisible()
    await expect(grid(page).getByRole('list', { name: 'Destinations in the Provinces' })).toHaveCount(0)
    await expect(grid(page).getByRole('list', { name: 'Destinations in the Hinterland' })).toHaveCount(0)
    const ways = cradle.getByRole('button', { name: /^Travel to / })
    await expect(ways).toHaveCount(await cradle.getByRole('button', { name: /^Travel to .*: spend no Supply/ }).count())
    expect(await ways.count()).toBeGreaterThan(0)
    await expect(stepBacks(page)).toHaveCount(0)
    await undoButton(page).click()

    await actionCard(page, 'denizen.nomad.special-envoy').getByRole('button', { name: 'Travel with Special Envoy', exact: true }).click()
    await expect(grid(page).getByRole('list', { name: 'Destinations in the Provinces' })).toBeVisible()
    await expect(grid(page).getByRole('list', { name: 'Destinations in the Hinterland' })).toBeVisible()
    const first = grid(page).getByRole('list', { name: 'Destinations in the Cradle' }).getByRole('button', { name: /^Travel to .*: spend no Supply$/ }).first()
    await first.click()
    const facts = await call(page, 'tableFacts')
    expect(facts.siteOf.me).not.toBe('slot.cradle.0')
    expect(facts.machineState).not.toBe('ActPhase')
})

test('scenario 57: with the Search open, the card is found with the powers and inside the Search menu, and can be put down', async ({ page }) => {
    await openTable(page, 'cardChangesSearch')
    await expect(tile(page, 'Search')).toHaveAttribute('aria-disabled', 'false')
    await usePower(page).click()
    await expect(grid(page)).toContainText('Changes an action')
    await actionCard(page, 'denizen.beast.mushrooms').getByRole('button', { name: 'Search with Mushrooms', exact: true }).click()
    const free = grid(page).getByRole('button', { name: 'Search the Cradle discard pile: spend 0 Supply, draw 1 from the bottom' })
    const paid = grid(page).getByRole('button', { name: 'Search the Cradle discard pile: spend 2 Supply, draw 3' })
    const deck = grid(page).getByRole('button', { name: 'Search the world deck: spend 2 Supply, draw 3' })
    await expect(free).toBeVisible()
    await expect(deck).toHaveCount(0)

    await picked(page).click()
    await expect(picked(page)).toHaveCount(0)
    await expect(paid).toBeVisible()
    await expect(deck).toBeVisible()

    await openTable(page, 'cardChangesSearch')
    await tile(page, 'Search').click()
    await expect(paid).toBeVisible()
    await expect(deck).toBeVisible()
    await grid(page).locator('button[title^="Mushrooms"]').click()
    await expect(free).toBeVisible()
    await expect(free).not.toContainText('Mushrooms')
    await expect(deck).toHaveCount(0)
})

test('scenario 58: a Vision drawn and the title changing hands are framed History rows; the drawer sees the Vision, another seat its back', async ({ page }) => {
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

test('scenario 59: every seat is told a Vision was seen, the drawer too; each clears it for itself, and it stays cleared on reopening', async ({ page }) => {
    await openTable(page, 'majorEvents')
    const seen = page.getByRole('dialog', { name: 'A Vision was seen' })
    await expect(seen).toBeVisible()
    await expect(seen).toContainText('have seen a Vision')
    await expect(seen.getByRole('img', { name: 'a Vision, facedown' })).toBeVisible()
    await expect(page.locator('.panel')).toBeVisible()

    await magnifiers(page).first().click()
    await expect(preview(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(preview(page)).toHaveCount(0)
    await expect(seen).toBeVisible()

    await seen.getByRole('button', { name: 'The pig foresaw this: clear' }).click()
    await expect(seen).toHaveCount(0)

    expect(await call(page, 'viewOffTheClock')).toBe('ann')
    await expect(seen).toBeVisible()
    await expect(seen).toContainText('me has seen a Vision')
    await page.getByRole('tab', { name: 'Chat' }).click()
    await page.locator('textarea').dispatchEvent('keydown', { key: 'Escape' })
    await expect(seen).toBeVisible()

    await call(page, 'open', 'majorEvents')
    await expect(seen).toHaveCount(0)
    expect(await call(page, 'viewOffTheClock')).toBe('ann')
    await expect(seen).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(seen).toHaveCount(0)
})

test('scenario 35: at Rest a row is the card and its buttons, one width; a tap on a bank uses the power; an empty bank is tapped for its 0; a used power is not listed', async ({ page }) => {
    await openTable(page, 'restTurnFlow')
    const powers = page.getByRole('list', { name: 'Rest powers' })
    await expect(powers).toBeVisible()
    await expect(grid(page)).not.toContainText('Your Supply has refreshed')
    await expect(grid(page)).not.toContainText('in bank')
    await expect(grid(page)).not.toContainText('take 1 favor from any bank')
    const banks = powers.getByRole('button', { name: /bank: take 1 favor/ })
    await expect(banks).toHaveCount(5)
    await expect(powers.getByRole('button', { name: 'Discord bank: take 0 favor, 0 in bank' })).toBeEnabled()
    await expect(powers.getByRole('listitem')).toHaveCount(2)
    await expect(powers).toContainText('Vow of Obedience')
    await expect(powers).toContainText('Insomnia')
    const sizes = await powers.locator('.rest-button').evaluateAll((buttons) =>
        buttons.map((button) => `${Math.round(button.getBoundingClientRect().width)}x${Math.round(button.getBoundingClientRect().height)}`)
    )
    expect(sizes).toHaveLength(7)
    expect(new Set(sizes).size).toBe(1)
    expect(sizes[0]).toMatch(/x48$/)
    await expect(grid(page).getByRole('button', { name: 'End Rest Phase' })).toBeVisible()

    const before = await call(page, 'tableFacts')
    await powers.getByRole('button', { name: /^Arcane bank/ }).click()
    await expect.poll(async () => (await call(page, 'tableFacts')).favorOf.me).toBe(before.favorOf.me + 1)
    expect((await call(page, 'tableFacts')).favorBank.arcane).toBe(before.favorBank.arcane - 1)
    await expect(powers.getByRole('listitem')).toHaveCount(1)
    await expect(powers).not.toContainText('Vow of Obedience')
    await expect(powers.getByRole('button', { name: /bank: take/ })).toHaveCount(0)
    await expect(powers.getByRole('listitem').filter({ hasText: 'Insomnia' }).getByRole('button', { name: /^1/ })).toBeEnabled()
})

test('scenario 35: at Rest a tap on the empty bank uses the power and takes 0 (R-9.3)', async ({ page }) => {
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
    const choice = (page: Page, name: string) => choices(page).getByRole('button', { name, exact: true })

    test('on the Mob side the People’s Favor asks twice, each pick a line above; Return to tied banks acts on the bank; the site’s take sends the Wake', async ({ page }) => {
        await openTable(page, 'wakeMob')
        await expect(grid(page)).toContainText('People’s Favor (1 of 2)')
        await expect(grid(page)).not.toContainText('Wake Phase')
        await expect(grid(page).getByRole('button', { name: /Resolve the Wake|End Wake Phase/ })).toHaveCount(0)
        await expect(grid(page).locator('[aria-pressed="true"]')).toHaveCount(0)
        const widths = await choices(page).getByRole('button').evaluateAll((buttons) =>
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
        await choices(page).getByRole('button', { name: /^Order bank/ }).click()
        await expect(grid(page)).toContainText('Drowned City')
        await expect(grid(page)).toContainText('Returned 1')
        await expect(choice(page, 'Take a favor')).toHaveCount(0)
        await expect(choice(page, 'Take nothing')).toBeVisible()
        expect((await call(page, 'tableFacts')).machineState).toBe('WakePhase')

        const before = await call(page, 'tableFacts')
        await choice(page, 'Take a secret').click()
        await expect.poll(async () => (await call(page, 'tableFacts')).machineState).toBe('ActPhase')
        const after = await call(page, 'tableFacts')
        expect(after.favorOf.me).toBe(before.favorOf.me - 1)
        expect(after.favorBank.order).toBe(before.favorBank.order + 1)
        expect(await call(page, 'cardTokens', 'site.drowned-city')).toEqual({ favor: 0, secrets: 0 })

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
        await expect.poll(async () => (await call(page, 'tableFacts')).machineState).toBe('ActPhase')
        expect(await call(page, 'cardTokens', 'site.drowned-city')).toEqual({ favor: 0, secrets: 1 })
    })

    test('with nothing to choose, End Wake Phase stands alone under the forced step’s line, and sends it', async ({ page }) => {
        await openTable(page, 'wakeForced')
        await expect(choices(page)).toHaveCount(0)
        await expect(grid(page)).toContainText('Placed 1')
        const before = await call(page, 'tableFacts')
        await grid(page).getByRole('button', { name: 'End Wake Phase' }).click()
        await expect.poll(async () => (await call(page, 'tableFacts')).machineState).toBe('ActPhase')
        expect((await call(page, 'tableFacts')).favorOf.me).toBe(before.favorOf.me - 1)
    })

    test.describe('on a phone', () => {
        test.use({ viewport: { width: 375, height: 812 } })

        test('the choices keep one width, at least 44 px tall, never stretched across the panel', async ({ page }) => {
            await openTable(page, 'wakeSite')
            const boxes = await choices(page).getByRole('button').evaluateAll((buttons) =>
                buttons.map((button) => button.getBoundingClientRect()).map((box) => ({ width: Math.round(box.width), height: box.height }))
            )
            expect(boxes).toHaveLength(2)
            expect(new Set(boxes.map((box) => box.width)).size).toBe(1)
            for (const box of boxes) expect(box.height).toBeGreaterThanOrEqual(44)
            const panel = await grid(page).boundingBox()
            expect(boxes[0].width).toBeLessThan((panel?.width ?? 0) / 2)
        })
    })
})

test('scenario 60: between rounds the Chancellor rolls the end die; the last seat’s Undo stays until the roll; each seat reads the stakes', async ({ page }) => {
    await openTable(page, 'endOfRound')
    const info = page.locator('.info')
    await expect(info).toContainText('Your roll')
    await expect(info).toContainText('End of round 6')
    await expect(grid(page)).toContainText('End of round 6 of 8')
    await expect(grid(page)).toContainText('The Empire holds the Oathkeeper title, so you roll the end die.')
    await expect(grid(page)).toContainText('A 5 or higher ends the game: you win as the Chancellor.')
    await expect(grid(page)).toContainText("The roll can't be undone.")

    expect(await call(page, 'viewOffTheClock')).toBe('dev')
    await expect(info).toContainText("'s roll")
    await expectWaitingOn(page, ['ann'])
    await expect(grid(page)).toContainText('A 5 or higher ends the game:')
    await expect(grid(page).getByRole('button', { name: 'Roll the end die' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible()

    await openTable(page, 'endOfRound')
    await grid(page).getByRole('button', { name: 'Roll the end die' }).click()
    await expect(page.getByTitle('the end die, rolled at the close of each round from round 5')).toContainText(/last [1-6]/)
    await page.getByRole('tab', { name: 'History' }).click()
    await expect(page.locator('[data-major-event="endDie"]')).toContainText('rolled the end die:')
    await expect(page.locator('[data-major-event="endDie"]')).toContainText('end of round 6')
    expect(await call(page, 'viewOffTheClock')).toBe('dev')
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0)
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

const panelRecord = (page: Page) => page.evaluate((): PanelRecord => Reflect.get(window, 'panelRecord'))

async function waitFrames(page: Page, count: number) {
    await page.evaluate(async (count) => {
        for (let frame = 0; frame < count; frame++) await new Promise(requestAnimationFrame)
    }, count)
}

async function panelImagesLoaded(page: Page) {
    await page.waitForFunction(() =>
        [...document.querySelectorAll('.fit__inner img')].every((image) => image instanceof HTMLImageElement && image.complete)
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

    test('the column’s height changing in steps, as an address bar slides, never draws the panel unscaled', async ({ page }) => {
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
        expect(record.frames[0].scale - record.frames[record.frames.length - 1].scale).toBeGreaterThan(0.03)
    })

    test('in full screen, the window’s height changing and a new step never draw the panel unscaled', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 500 })
        await openTable(page, 'cardsOpenTravel')
        await expect(usePower(page)).toBeVisible()
        await recordPanel(page)
        await page.getByRole('button', { name: 'Enter full screen' }).click()
        await expect(page.locator('.fullscreen-panel .fit__inner')).toBeVisible()
        expect(await page.locator('.fit__inner').last().evaluate((inner) => inner.closest('.fullscreen-panel') !== null)).toBe(true)
        await panelImagesLoaded(page)
        await stepColumnHeight(page, [480, 460, 440, 460, 480, 500])
        await choosePowers(page)
        const record = await panelRecord(page)
        expectFittedOnEveryFrame(record)
        expect(new Set(record.frames.map((frame) => frame.box)).size).toBeGreaterThan(3)
    })
})

test('scenario 61: a panel image that arrives after its panel changes nothing it was laid out with', async ({ page }) => {
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
        complete: await token.evaluate((image) => image instanceof HTMLImageElement && image.complete),
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
    test('no panel renders a Back or a step-cancel, on any table or in any menu the grid opens', async ({ page }) => {
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
                await expect(grid(page).locator('.majors'), `${name}: ${label.trim()}`).toBeVisible()
            }
        }
    })

    test('a Sneak Attack’s Campaign: Undo takes the target, then returns to the question with nothing sent', async ({ page }) => {
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

    test('a Citizenship offer to the one Exile: Undo takes a term and the relic one press each, then closes the offer', async ({ page }) => {
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

    test('a card-ordering question: Undo untaps the last card, one per press, and never answers', async ({ page }) => {
        await openTable(page, 'stackOrder')
        await panelCards(page).filter({ has: page.getByRole('img', { name: 'Wolves', exact: true }) }).click()
        await panelCards(page).filter({ has: page.getByRole('img', { name: 'Longbows', exact: true }) }).click()
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

    test('let another peek off the clock: Undo or a second press closes the seat card’s picker, and the button keeps its words', async ({ page }) => {
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

    test('let another peek in your Act Phase: Undo or a second press closes the picker, and the seat card’s button keeps its words', async ({ page }) => {
        await openTable(page, 'advisers')
        const button = page.locator('.let-peek > button')
        await button.click()
        expect(await call(page, 'letPeekState')).toEqual({ open: true, staged: true, action: 'letPeek' })

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
    const smallCard = (page: Page, name: string) => grid(page).locator(`.question-form img[alt="${name}"]`)
    const asked = async (page: Page) => (await call(page, 'openQuestionKind')) !== undefined
    const red = (page: Page) => grid(page).locator('.text-oath-danger')

    test('Blackmail: "Pay <chip> 3 [favor] to keep Ring of Devotion?", Pay and Refuse, the relic beside the line', async ({ page }) => {
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

    test('Revelation: the count runs from 1 with none picked; "None" alone until a count is picked, then "Burn"', async ({ page }) => {
        await openTable(page, 'askRevelation')
        await expect(line(page)).toHaveText(/^Burn how many\s+for as many\s*\?$/)
        await expect(line(page).locator('img[alt="favor"]')).toHaveCount(1)
        await expect(line(page).locator('img[alt="secrets"]')).toHaveCount(1)
        await expect(smallCard(page, 'Revelation')).toBeVisible()
        await expect(grid(page).getByRole('button', { name: /^burn \d favor$/ })).toHaveText(['1', '2', '3', '4'])
        await expect(grid(page).locator('[aria-pressed="true"]')).toHaveCount(0)
        await expect(answer(page, 'Burn')).toHaveCount(0)
        await expect(answer(page, 'None')).toBeVisible()
        await expect(red(page)).toHaveCount(0)

        await grid(page).getByRole('button', { name: 'burn 2 favor', exact: true }).click()
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

    test('Tinker’s Fair: "Exchange with <chip>?", what you get and give, Accept and Refuse', async ({ page }) => {
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

    test('The Gathering’s round: "Propose an exchange?", a player by chip; "Propose" once a player and terms are picked', async ({ page }) => {
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

    test('Family Heirloom: "Take Cup of Plenty?", Take and To the bottom, the relic beside the line', async ({ page }) => {
        await openTable(page, 'askHeirloom')
        await expect(line(page)).toHaveText('Take Cup of Plenty?')
        await expect(smallCard(page, 'Cup of Plenty')).toBeVisible()
        await expect(answer(page, 'Take')).toBeVisible()
        await expect(answer(page, 'To the bottom')).toBeVisible()
    })

    test('Fae Merchant: "Which relic goes to the bottom?", the relics captioned drawn and yours', async ({ page }) => {
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

    test('Jinx: "Reroll …? Now …", the card’s cost in gold on Reroll, and Keep', async ({ page }) => {
        await openTable(page, 'askJinx')
        await expect(line(page)).toHaveText('Reroll the Gambling Hall dice? Now 2 shields.')
        await expect(smallCard(page, 'Jinx')).toBeVisible()
        const reroll = answer(page, 'Reroll, paying 1 secret')
        await expect(reroll).toHaveText(/^Reroll\s*·\s*1$/)
        await expect(reroll.locator('.text-oath-accent img[alt="secret"]')).toHaveCount(1)
        await expect(answer(page, 'Keep')).toBeVisible()
        await expect(grid(page)).not.toContainText('cost')
    })

    test('Relic Thief: "Roll 1 defense die for …? No shields takes it.", the cost in gold on Roll, and Pass', async ({ page }) => {
        await openTable(page, 'askRelicThief')
        await expect(line(page)).toHaveText('Roll 1 defense die for Ring of Devotion? No shields takes it.')
        await expect(smallCard(page, 'Ring of Devotion')).toBeVisible()
        const roll = answer(page, 'Roll, paying 1 favor + 1 secret')
        await expect(roll).toHaveText(/^Roll\s*·\s*1\s*\+\s*1$/)
        await expect(roll.locator('.text-oath-accent img')).toHaveCount(2)
        await expect(answer(page, 'Pass')).toBeVisible()
    })

    test('Brass Horse: "Travel where? Free.", each site an equal choice of one width', async ({ page }) => {
        await openTable(page, 'askBrassHorse')
        await expect(line(page)).toHaveText('Travel where? Free.')
        const sites = grid(page).getByRole('button', { name: /^Travel to / })
        await expect(sites).toHaveCount(3)
        const widths = await sites.evaluateAll((buttons) => buttons.map((b) => b.getBoundingClientRect().width))
        expect(new Set(widths.map(Math.round)).size).toBe(1)
    })

    test('Sneak Attack: "Campaign against <chip> now? Free.", and Pass', async ({ page }) => {
        await openTable(page, 'askSneakAttack')
        await expect(line(page)).toHaveText(/^Campaign against\s+ann\s+now\?\s+Free\.$/i)
        await expect(smallCard(page, 'Sneak Attack')).toBeVisible()
        await expect(answer(page, 'Pass')).toBeVisible()
    })

    test('Inquisitor: "The Conspiracy: how do you play it?"; "Adviser, facedown", "Play it" and "Discard", one width, the choice look', async ({ page }) => {
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
        expect(boxes.map((box) => box?.x ?? 0)).toEqual([...boxes.map((box) => box?.x ?? 0)].sort((a, b) => a - b))
    })

    test('Inquisitor: "Play it" opens the take; "Play" at once, waiting while a player is picked with no prize; Undo returns', async ({ page }) => {
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

    test('Inquisitor: under the limit "Adviser, facedown" sends at once', async ({ page }) => {
        await openTable(page, 'askInquisitor')
        await answer(page, 'Adviser, facedown').click()
        await expect.poll(() => asked(page)).toBe(false)
    })

    test('Inquisitor at the adviser limit: "Adviser, facedown" opens "Discard 1 adviser.", red on the pick, "Play" once picked', async ({ page }) => {
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

    test('Wild Mounts: "Discard one [beast] card instead of …?"; "Discard instead" once a card is picked, no red line before', async ({ page }) => {
        await openTable(page, 'askWildMounts')
        await expect(line(page)).toHaveText(/^Discard one\s+card instead of Horse Archers and Lancers\?$/)
        await expect(line(page).locator('img[alt="Beast"]')).toHaveCount(1)
        await expect(answer(page, 'Discard instead')).toHaveCount(0)
        await expect(answer(page, 'Discard plans')).toBeVisible()
        await expect(red(page)).toHaveCount(0)

        await grid(page).getByRole('button', { name: 'War Tortoise', exact: true }).click()
        await expect(answer(page, 'Discard instead')).toBeVisible()
    })

    test('False Prophet: "Play Conquest, or discard it?"; a refused play is not listed; "Adviser, facedown" once the adviser to discard is picked', async ({ page }) => {
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

    test('Pilgrimage: "Tap to discard; the last goes on top."; "Discard" once the order is fixed', async ({ page }) => {
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

    test('a When Played bank starts with none ringed; "Play" shows once one is tapped (Fabled Feast)', async ({ page }) => {
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
                return { width: box.width, height: box.height, natural: image ? image.naturalWidth / image.naturalHeight : 0 }
            })
            expect(shape.width).toBeGreaterThan(shape.height)
            expect(shape.width).toBeGreaterThanOrEqual(60)
            expect(Math.abs(shape.width / shape.height - shape.natural)).toBeLessThan(0.05)
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
            ['askBrassHorse', [/^Travel to /]]
        ] as const) {
            test(`${table}: no label is wider than its button; the answers share one width, at least 44 px tall`, async ({ page }) => {
                await openTable(page, table)
                await expect(line(page)).toBeVisible()
                const buttons = names.flatMap((name) =>
                    typeof name === 'string' ? [answer(page, name)] : [grid(page).getByRole('button', { name })]
                )
                const sizes = []
                for (const button of buttons) {
                    await expect(button.first()).toBeVisible()
                    sizes.push(
                        ...(await button.evaluateAll((elements) => elements.map((element) => {
                            const style = getComputedStyle(element)
                            return {
                                overflow: element.scrollWidth - element.clientWidth,
                                width: parseFloat(style.width),
                                height: parseFloat(style.height),
                                inside: [...element.querySelectorAll('*')].every((child) => {
                                    const outer = element.getBoundingClientRect()
                                    const inner = child.getBoundingClientRect()
                                    return inner.left >= outer.left - 0.5 && inner.right <= outer.right + 0.5
                                }),
                                name: element.getAttribute('aria-label') ?? element.textContent ?? ''
                            }
                        })))
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

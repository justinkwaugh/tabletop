import { expect, test, type Page } from '@playwright/test'
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
const panelCards = (page: Page) =>
    page.locator('.panel button:not(.magnifier)').filter({ hasNotText: /Back|Undo/ })
const magnifiers = (page: Page) => page.locator('.panel button.magnifier')

/** docs/ui-interaction-visual-contract.md, rules 1 and 4 and scenarios 7, 24 and 44, on touch. */
test.describe('on touch', () => {
    test.use({ hasTouch: true, viewport: { width: 1024, height: 768 } })

    test('scenario 7: a panel card’s magnifier enlarges it and the next tap closes it; a tap on the card picks it', async ({
        page
    }) => {
        await openTable(page, 'setup')
        await expect(page.getByText('Tap the card to keep', { exact: false })).toBeVisible()
        await magnifiers(page).first().tap()
        await expect(preview(page)).toBeVisible()
        await expect(page.locator('[aria-pressed="true"]')).toHaveCount(0)

        await page.touchscreen.tap(20, 20)
        await expect(preview(page)).toHaveCount(0)
        await panelCards(page).first().tap()
        await expect(page.getByText('Tap the card that is discarded first', { exact: false })).toBeVisible()
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

    test('scenario 24: an enlarged card closes when its card leaves the table, and the new offers show with no ring left over', async ({
        page
    }) => {
        await openTable(page, 'setup')
        await magnifiers(page).first().tap()
        await expect(preview(page)).toBeVisible()

        await call(page, 'seatMakesSetupChoice')
        await expect(preview(page)).toHaveCount(0)
        await expect(page.getByText('Tap the site where your pawn starts', { exact: false })).toBeVisible()
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
    const card = await uncovered(page, '.board-card')
    await card.hover()
    await page.waitForTimeout(600)
    await expect(preview(page)).toHaveCount(0)
    await card.click()
    await expect(preview(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(preview(page)).toHaveCount(0)
})

/** Item 12: a wide card runs to its source art. */
test('a banner enlarges to its 920 px source on a desktop', async ({ page }) => {
    await openTable(page, 'trade')
    await (await uncovered(page, '.banner')).click()
    const shown = preview(page).locator('img').first()
    await expect(shown).toBeVisible()
    expect(Math.round((await shown.boundingBox())?.width ?? 0)).toBe(920)
})

/** Item 28: an enlarged site says what it does, its printed symbols drawn. */
test('an enlarged site shows its sentence under it, with the suit and favor as symbols', async ({ page }) => {
    await openTable(page, 'setup')
    await (await uncovered(page, '.site .board-card')).click()
    const sentence = preview(page).locator('.site-sentence')
    await expect(sentence).toContainText('card to this site, and you have not discarded a')
    await expect(sentence.getByRole('img', { name: 'Hearth' })).toHaveCount(2)
    await expect(sentence.getByRole('img', { name: 'favor' })).toHaveCount(1)
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
    await expect(page.getByText('Tap the site where your pawn starts', { exact: false })).toBeVisible()
    await expect(preview(page).locator(`img[alt="${name}"]`)).toHaveCount(0)
    await expect(page.locator('[aria-pressed="true"]')).toHaveCount(0)
})

/** Scenario 25: another seat's Action processed mid-pick, as a Search is under way. */
test('scenario 25: another seat acting mid-pick starts the Search panel again with nothing picked', async ({
    page
}) => {
    await openTable(page, 'searching')
    await panelCards(page).first().click()
    await page.getByRole('button', { name: 'Discard it', exact: true }).click()
    await expect(page.getByText('Tap the card that is discarded first', { exact: false })).toBeVisible()
    expect((await call(page, 'searchPicks')).placement).toBe('discard')

    await call(page, 'anotherSeatLetsPeek')
    expect(await call(page, 'searchPicks')).toEqual({})
    await expect(page.getByText('Tap the card to keep', { exact: false })).toBeVisible()
})

/** Scenario 16: a second question after the first starts with nothing picked. */
test('scenario 16: after one False Prophet question is answered, the next offers the same advisers with none picked', async ({
    page
}) => {
    await openTable(page, 'prophets')
    const row = page.getByText('tap the adviser to discard', { exact: false }).locator('..')
    await row.getByRole('button').first().click()
    const picked = await call(page, 'questionPicks')
    expect(picked.visionDiscard).toBeDefined()
    expect(picked.queued).toBe(2)

    await page.getByRole('button', { name: 'Discard it', exact: true }).click()
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
const tile = (page: Page, label: string) =>
    grid(page).locator('.majors button').filter({ hasText: label })
const reasonLine = (page: Page) => grid(page).locator('.strip')
const boardOffers = (page: Page) => page.locator('.board-card.offered')
const dimmedSites = (page: Page) => page.locator('.site.dimmed')
const answer = (page: Page, name: string) => grid(page).getByRole('button', { name, exact: true })

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
test('scenario 29: a hover writes the cost and summary, a dimmed tile the reason; a hover replaces the reason and a new state clears it', async ({
    page
}) => {
    await openTable(page, 'actPhase')
    const muster = tile(page, 'Muster')
    const travel = tile(page, 'Travel')
    await expect(muster).toHaveAttribute('aria-disabled', 'true')

    await travel.hover()
    await expect(reasonLine(page)).toContainText('Travel')
    await expect(reasonLine(page)).toContainText('1–4 Supply')
    await expect(reasonLine(page)).toContainText('Move your pawn to any site')
    await restMouse(page)
    await expect(reasonLine(page)).toHaveText('')

    await tapDimmed(muster)
    await expect(reasonLine(page)).toContainText('no card at your site to place')
    await travel.hover()
    await expect(reasonLine(page)).toContainText('Move your pawn to any site')
    await expect(reasonLine(page)).not.toContainText('no card at your site')
    await restMouse(page)
    await expect(reasonLine(page)).toHaveText('')

    await tapDimmed(muster)
    await restMouse(page)
    await expect(reasonLine(page)).toContainText('no card at your site to place')
    await muster.hover()
    await expect(reasonLine(page)).toContainText('no card at your site to place')
    await restMouse(page)
    await expect(boardOffers(page)).toHaveCount(0)
    await expect(dimmedSites(page)).toHaveCount(0)

    await call(page, 'anotherSeatLetsPeek')
    await expect(reasonLine(page)).toHaveText('')
    await expect(muster).toHaveAttribute('aria-disabled', 'true')

    await tapDimmed(muster)
    await restMouse(page)
    await expect(reasonLine(page)).toContainText('no card at your site to place')
    await call(page, 'seatTravels', 'slot.cradle.1')
    await expect(muster).toHaveAttribute('aria-disabled', 'false')
    await expect(reasonLine(page)).toHaveText('')
    await expect(boardOffers(page)).toHaveCount(0)
    await expect(dimmedSites(page)).toHaveCount(0)
})

test('Undo reads "Undo"; its tooltip names the action it reverses, or the picks it steps back through', async ({
    page
}) => {
    await openTable(page, 'actPhase')
    const undo = page.getByRole('button', { name: 'Undo', exact: true })
    await expect(undo).toHaveCount(0)

    await call(page, 'seatTravels', 'slot.cradle.1')
    await expect(undo).toBeVisible()
    await expect(undo).toHaveAttribute('title', /travelled to/)

    await tile(page, 'Travel').click()
    await expect(undo).toHaveText('Undo')
    await expect(undo).toHaveAttribute('title', /picks not yet sent/)
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
        await expect(grid(page)).toContainText(
            'cit asks your permission, as Chancellor, to move 2 Imperial warbands off their site to their board.'
        )
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
        await expect(grid(page)).toContainText('Waiting on chan to answer cit.')
        await expect(answer(page, 'Allow')).toHaveCount(0)
        await expect(answer(page, 'Refuse')).toHaveCount(0)
    })

    test('Allow is dimmed with the engine’s reason when the board no longer allows the move', async ({
        page
    }) => {
        await openTable(page, 'staleWarbandMoveAsked')
        await expect(answer(page, 'Allow')).toBeDisabled()
        await expect(grid(page)).toContainText('the last one must stay')
        await expect(answer(page, 'Refuse')).toBeEnabled()
    })

    test('a Citizen answers Join or Stay out, then the defender Allow or Refuse; nothing is rolled until both answer', async ({
        page
    }) => {
        await openTable(page, 'joinDefenceAsked')
        const joining = await call(page, 'tableFacts')
        expect(joining.seatId).toBe('cit')
        expect(joining.campaignUnderway).toBe(false)
        await expect(grid(page)).toContainText(
            'att is campaigning against chan. Your pawn is in the battle: join the defence as an Ally?'
        )
        await expect(answer(page, 'Stay out')).toBeEnabled()
        await answer(page, 'Join').click()

        await expect.poll(async () => (await call(page, 'tableFacts')).seatId).toBe('chan')
        expect((await call(page, 'tableFacts')).campaignUnderway).toBe(false)
        await expect(grid(page)).toContainText('cit asks to join your defence as an Ally.')
        await answer(page, 'Allow').click()

        await expect.poll(async () => (await call(page, 'tableFacts')).campaignUnderway).toBe(true)
        expect((await call(page, 'tableFacts')).machineState).not.toBe('ConsentRequest')
    })
})

/** Scenario 31: the defending side's losses after a won battle (R-5.5.6.a). */
test.describe('scenario 31: choosing the defending side’s losses', () => {
    test('one row of number buttons per group and a count; Kill is dimmed with the reason until the count is right; Undo clears every count', async ({
        page
    }) => {
        await openTable(page, 'exileDefeated')
        const facts = await call(page, 'tableFacts')
        expect(facts.seatId).toBe('def')
        expect(facts.machineState).toBe('CampaignDefeat')
        expect((await call(page, 'defeatPicks')).required).toBe(2)

        const kill = answer(page, 'Kill these warbands')
        await expect(countRows(page)).toHaveCount(2)
        await expect(grid(page)).toContainText('Chosen 0 of 2')
        await expect(kill).toBeDisabled()
        await expect(grid(page)).toContainText('must kill exactly 2 of the defeated force, not 0')

        await pickCount(page, 0, 1)
        await expect(grid(page)).toContainText('Chosen 1 of 2')
        await expect(kill).toBeDisabled()
        await pickCount(page, 1, 1)
        await expect(grid(page)).toContainText('Chosen 2 of 2')
        await expect(kill).toBeEnabled()
        await expect(grid(page)).not.toContainText('must kill exactly')

        await page.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(grid(page)).toContainText('Chosen 0 of 2')
        await expect(kill).toBeDisabled()
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

    test('for an Imperial defence the Chancellor chooses, not the defending Citizen', async ({
        page
    }) => {
        await openTable(page, 'imperialDefeated')
        expect((await call(page, 'tableFacts')).seatId).toBe('chan')
        await expect(countRows(page)).toHaveCount(2)
        await expect(answer(page, 'Kill these warbands')).toBeDisabled()
    })
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
        await expect(page.getByText('Tap the card to keep', { exact: false })).toBeVisible()
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
    expect(await isAmber(undo, 'backgroundColor')).toBe(true)
    expect(await luminanceOf(undo, 'color')).toBeGreaterThan(0.9)
})

test('scenario 40: panel text shows favor as its token, the word only as the token’s name', async ({ page }) => {
    await openTable(page, 'actPhase')
    await tapDimmed(tile(page, 'Muster'))
    await expect(reasonLine(page)).toContainText('no card at your site to place')
    await expect(reasonLine(page).getByRole('img', { name: 'favor' })).toBeVisible()
    await expect(reasonLine(page)).not.toContainText('favor')
    await restMouse(page)

    await call(page, 'seatTravels', 'slot.cradle.1')
    await tile(page, 'Muster').click()
    const prompt = page.locator('.panel').getByText('Choose a card at your site to place')
    await expect(prompt).toBeVisible()
    await expect(prompt.getByRole('img', { name: 'favor' })).toBeVisible()
    await expect(prompt).not.toContainText('favor')
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
    await expect(rows.nth(1)).toContainText('bank empty')
    await expect(rows.nth(1)).toContainText('no faceup')
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

test('scenario 4: Travel lists every affordable destination under its region, a button travels', async ({ page }) => {
    await openTable(page, 'actPhase')
    await tile(page, 'Travel').click()
    const cradle = page.getByRole('list', { name: 'Destinations in the Cradle' })
    await expect(cradle.getByRole('listitem')).toHaveCount(1)
    const go = cradle.getByRole('button', { name: /^Travel to .+: spend 1 Supply$/ })
    await expect(go).toBeVisible()
    await expect(dimmedSites(page).first()).toBeVisible()

    await page.locator('.panel').getByRole('button', { name: 'Back', exact: true }).click()
    await expect(cradle).toHaveCount(0)
    await expect(dimmedSites(page)).toHaveCount(0)
    await tile(page, 'Travel').click()
    await go.click()
    await expect.poll(async () => (await call(page, 'tableFacts')).siteOf.me).toBe('slot.cradle.1')
    await expect(cradle).toHaveCount(0)
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

test('scenario 50: Peek lists only the relics not yet seen, Look sends', async ({ page }) => {
    await openTable(page, 'peek')
    const peek = grid(page).getByRole('button', { name: 'Peek at a relic', exact: true })
    await peek.click()
    const rows = page.getByRole('list', { name: 'Relics to peek at' }).getByRole('listitem')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('space 1')
    await rows.first().getByRole('button', { name: 'Peek at facedown relic, space 1' }).click()
    await expect(page.getByRole('list', { name: 'Relics to peek at' })).toHaveCount(0)
    await expect(peek).toHaveAttribute('aria-disabled', 'true')
    await expect(peek).toHaveJSProperty('disabled', false)
    await tapDimmed(peek)
    await expect(reasonLine(page)).toContainText('you have already seen every relic here')
})

test('scenario 6: the facedown advisers to play are cards in the panel, a tap shows the placements', async ({ page }) => {
    await openTable(page, 'advisers')
    await grid(page).getByRole('button', { name: 'Play or discard an adviser', exact: true }).click()
    await expect(grid(page).getByRole('button', { name: 'Curfew', exact: true })).toBeVisible()
    await expect(grid(page).getByRole('button', { name: 'Elders', exact: true })).toBeVisible()
    await grid(page).getByRole('button', { name: 'Curfew', exact: true }).click()
    const discard = grid(page).getByRole('button', { name: /^Discard it: Curfew$/ })
    await expect(discard).toBeVisible()
    await grid(page).getByRole('button', { name: 'Back', exact: true }).click()
    await expect(discard).toHaveCount(0)
    await expect(grid(page).getByRole('button', { name: 'Elders', exact: true })).toBeVisible()
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
    await grid(page).getByRole('button', { name: /^ann$/i }).click()
    const site = grid(page).locator('button[aria-pressed]').first()
    await expect(site).toHaveAttribute('aria-pressed', 'false')
    await site.click()
    await expect(site).toHaveAttribute('aria-pressed', 'true')
    await expect(site).toContainText('target')
    await expect(page.locator('.travel-cost.targeted')).toHaveCount(1)
    await site.click()
    await expect(site).toHaveAttribute('aria-pressed', 'false')
})

test('scenario 2: an Exile chooses a start site from the rows, and a tap on another moves the choice', async ({ page }) => {
    await openTable(page, 'setup')
    await call(page, 'seatMakesSetupChoice')
    const sites = page.getByRole('list', { name: 'Start sites' }).locator('button[aria-pressed]')
    await expect(sites.first()).toBeVisible()
    expect(await sites.count()).toBeGreaterThan(1)
    await sites.nth(0).click()
    await expect(sites.nth(0)).toHaveAttribute('aria-pressed', 'true')
    await expect(sites.nth(0)).toContainText('start here')
    await sites.nth(1).click()
    await expect(sites.nth(1)).toHaveAttribute('aria-pressed', 'true')
    await expect(sites.nth(0)).toHaveAttribute('aria-pressed', 'false')
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

/** Item 13c: the focus views are one line on the map's top edge on a desktop, and a phone has none. */
test('the focus views sit in one line along the top of the map on a desktop, and a phone has none', async ({ page }) => {
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

    await page.locator('.panel').getByRole('button', { name: 'Back', exact: true }).click()
    await expect(list).toHaveCount(0)
    await tile(page, 'Muster').click()
    await page.getByRole('button', { name: 'Muster at Assassin: place 1 favor, get 2 warbands' }).click()
    await expect.poll(() => call(page, 'cardTokens', 'denizen.discord.assassin')).toEqual({ favor: 1, secrets: 0 })
    await expect(list).toHaveCount(0)
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

test('scenario 35: a favor bank is chosen by its suit symbol, ringed when picked, and the pick is what is sent', async ({ page }) => {
    await openTable(page, 'restBanks')
    const banks = grid(page).getByRole('button', { name: /bank, \d+ favor$/ })
    await expect(banks.first()).toBeVisible()
    await expect(grid(page).locator('select')).toHaveCount(0)
    await expect(banks.first()).toHaveAttribute('aria-pressed', 'true')

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
    await expect(grid(page).getByText('Waiting for another player')).toBeVisible()
    await expect(grid(page).getByRole('region', { name: 'the Campaign\'s dice' })).toContainText(/\d+ defense/)
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
    'imperialDefeated'
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
    await expect(page.getByText('Tap the card to keep', { exact: false })).toBeVisible()
    expect(errors).toEqual([])
})

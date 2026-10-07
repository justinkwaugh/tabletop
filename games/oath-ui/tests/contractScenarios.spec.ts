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
const panelCards = (page: Page) => page.locator('.panel button:not(.magnifier)')
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
const undoButton = (page: Page) => page.getByRole('button', { name: 'Undo', exact: true })
/** docs/user-interactions.md — Undo is the one reversal control, so no panel renders a Back or a step-cancel. */
const stepBacks = (page: Page) => page.getByRole('button', { name: /^(Back|Cancel)\b/ })
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
        await expect(answer(page, 'Accept Citizenship')).toBeEnabled()
    })

    test('short: a tap on a removed piece makes it Imperial and removes the oldest pick', async ({ page }) => {
        await openTable(page, 'citizenshipShort')
        await piece(page, 'Removed: a warband at Fertile Valley').first().click()
        await expect(piece(page, 'Imperial: a warband at Fertile Valley')).toHaveCount(1)
        await expect(piece(page, 'Imperial: a warband on your board')).toHaveCount(2)
        await expect(pieces(page).first()).toHaveAttribute('aria-pressed', 'false')
        await expect(grid(page).locator('button[aria-pressed="true"]')).toHaveCount(3)

        await answer(page, 'Accept Citizenship').click()
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

        await answer(page, 'Accept Citizenship').click()
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
        await expect(grid(page).getByText('You receive', { exact: true })).toBeVisible()
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
        await expect(grid(page).getByText('You receive', { exact: true })).toBeVisible()
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
        const accept = await answer(page, 'Accept Citizenship').boundingBox()
        const refuse = await answer(page, 'Refuse').boundingBox()
        const panel = await grid(page).boundingBox()
        expect(accept && refuse && panel).toBeTruthy()
        if (!accept || !refuse || !panel) return
        expect(Math.abs(accept.width - refuse.width)).toBeLessThan(1)
        expect(accept.width + refuse.width).toBeLessThan(panel.width / 2)
    })

    test('on a phone the answers take the full width', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 })
        await openTable(page, 'citizenshipShort')
        const accept = await answer(page, 'Accept Citizenship').boundingBox()
        const refuse = await answer(page, 'Refuse').boundingBox()
        const panel = await grid(page).boundingBox()
        expect(accept && refuse && panel).toBeTruthy()
        if (!accept || !refuse || !panel) return
        expect(Math.abs(accept.width - refuse.width)).toBeLessThan(1)
        expect(refuse.x + refuse.width - accept.x).toBeGreaterThan(panel.width * 0.8)
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
    test('the cost line under each action in the grid, and in the line under it', async ({ page }) => {
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
        await tile(page, 'Travel').hover()
        expect((await tokenRuns(reasonLine(page))).slice(0, 3)).toEqual([
            ['Travel', 'text'],
            ['1–4 Supply', 'accent'],
            [expect.stringMatching(/^— /), 'text-muted']
        ])
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

    test('Search with a toll: the Supply, the "+" and the favor given are all accent', async ({ page }) => {
        await openTable(page, 'searchToll')
        await tile(page, 'Search').click()
        const deck = grid(page).getByRole('button', {
            name: /^Search the world deck: spend 2 Supply, give 1 favor to ann, draw 3$/
        })
        await expect(deck.locator('img')).toHaveCount(1)
        expect(await tokenRuns(deck)).toEqual([
            ['2 Supply + 1', 'accent'],
            ['draw 3', 'text-muted']
        ])
    })

    test('Trade: what is paid is accent, the arrow muted, the gain text and the bank note muted', async ({ page }) => {
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
            ['→ 0 bank empty', 'text-muted']
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

    test('Recover: a banner’s least bid is accent and "or more" is not', async ({ page }) => {
        await openTable(page, 'trade')
        await tile(page, 'Recover').click()
        const peoples = grid(page)
            .getByRole('list', { name: 'Banners to recover' })
            .getByRole('button', { name: /^Recover the People’s Favor: pay \d+ favor or more$/ })
        expect(await tokenRuns(peoples)).toEqual([
            [expect.stringMatching(/^\d+$/), 'accent'],
            ['or more', 'text']
        ])
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
    await grid(page).getByRole('button', { name: /^ann$/i }).click()
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
    await undo.click()
    await expect(grid(page).getByRole('button', { name: /^ann$/i })).toBeVisible()
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
    await expect(sites.nth(0)).toContainText('start here')
    await sites.nth(1).click()
    await expect(sites.nth(1)).toHaveAttribute('aria-pressed', 'true')
    await expect(sites.nth(0)).toHaveAttribute('aria-pressed', 'false')
})

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
    await expect(page.getByText(/^Keeping /)).toBeVisible()
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
    await expect(page.getByText('Tap the card that is discarded first', { exact: false })).toBeVisible()
    await expect(stepBacks(page)).toHaveCount(0)
    const undo = undoButton(page)
    await undo.click()
    await expect(page.getByText('Tap the card that is discarded first', { exact: false })).toHaveCount(0)
    await expect(pickedSites).toHaveCount(1)
    await undo.click()
    await expect(pickedSites).toHaveCount(0)
    await expect(boardOffers(page)).toHaveCount(litBefore)
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
    const prompt = page.getByText('Tap the site where your pawn starts', { exact: false })
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
    await expect(page.getByText('Tap the card to keep', { exact: false })).toBeVisible()
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

test('scenario 35, in a game created before the turn-flow revision: a favor bank is chosen by its suit symbol, ringed when picked, and the pick is what is sent', async ({ page }) => {
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
    await expect(page.getByText('Tap the card to keep', { exact: false })).toBeVisible()
    expect(errors).toEqual([])
})

const usePower = (page: Page) => grid(page).getByRole('button', { name: 'Use a power', exact: true })
const actionCard = (page: Page, cardId: string) => grid(page).locator(`[data-action-card="${cardId}"]`)
const picked = (page: Page) => grid(page).locator('button[aria-pressed="true"]')

test('scenario 55: a card that makes a Search possible is found with the powers; the Search tile stays dimmed and the pile’s button sends', async ({ page }) => {
    await openTable(page, 'cardOpensSearch')
    await expect(tile(page, 'Search')).toHaveAttribute('aria-disabled', 'true')
    await tile(page, 'Search').click({ force: true })
    await expect(reasonLine(page)).toContainText('costs 2 Supply')
    await expect(reasonLine(page)).toContainText('Mushrooms can: see Use a power.')
    expect((await call(page, 'tableFacts')).staged).toBeUndefined()

    await expect(usePower(page)).toHaveAttribute('aria-disabled', 'false')
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
    await expect(page.getByText('Tap the card to keep', { exact: false })).toBeVisible()
    const facts = await call(page, 'tableFacts')
    expect(facts.machineState).toBe('Searching')
    expect(facts.secretsOn['denizen.beast.mushrooms']).toBe(1)
    await expect(page.locator('.discard').first()).toContainText('1')
})

test('scenario 56: two cards that make a Travel possible are two rows; one says it ends the Act Phase, and each opens the destinations it reaches', async ({ page }) => {
    await openTable(page, 'cardsOpenTravel')
    await tile(page, 'Travel').click({ force: true })
    await expect(reasonLine(page)).toContainText('Tents or Special Envoy can: see Use a power.')

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

test('scenario 35: at Rest every bank a power names is a button of one size; a tap on one uses the power; an empty bank is not tappable', async ({ page }) => {
    await openTable(page, 'restTurnFlow')
    const powers = page.getByRole('list', { name: 'Rest powers' })
    await expect(powers).toBeVisible()
    await expect(grid(page)).toContainText('Your Supply has refreshed. Rest powers, once each:')
    const banks = powers.getByRole('button', { name: /bank: take 1 favor/ })
    await expect(banks).toHaveCount(5)
    await expect(powers.getByRole('button', { name: 'Discord bank: take 0 favor, 0 in bank' })).toBeVisible()
    await expect(powers.getByRole('listitem')).toHaveCount(2)
    await expect(powers).toContainText('Vow of Obedience')
    await expect(powers).toContainText('Insomnia')
    await expect(powers.getByRole('button', { name: /^Discord bank/ })).toBeDisabled()
    const sizes = await powers.locator('.rest-button').evaluateAll((buttons) =>
        buttons.map((button) => `${Math.round(button.getBoundingClientRect().width)}x${Math.round(button.getBoundingClientRect().height)}`)
    )
    expect(new Set(sizes)).toEqual(new Set(['80x48']))
    await expect(grid(page).getByRole('button', { name: 'End your turn' })).toBeVisible()

    const before = await call(page, 'tableFacts')
    await powers.getByRole('button', { name: /^Arcane bank/ }).click()
    await expect.poll(async () => (await call(page, 'tableFacts')).favorOf.me).toBe(before.favorOf.me + 1)
    expect((await call(page, 'tableFacts')).favorBank.arcane).toBe(before.favorBank.arcane - 1)
    const used = powers.locator('.rest-row--used')
    await expect(used).toHaveCount(1)
    await expect(used).toContainText('Vow of Obedience')
    await expect(used).toContainText('used: took 1')
    await expect(used.getByRole('button', { name: /bank: take/ })).toHaveCount(0)
    await expect(powers.getByRole('listitem').filter({ hasText: 'Insomnia' }).getByRole('button', { name: /^1/ })).toBeEnabled()
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
    await expect(grid(page)).toContainText('to roll the end die.')
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

async function chooseTravel(page: Page) {
    await tile(page, 'Travel').last().click()
    await expect(page.getByRole('list', { name: 'Destinations in the Cradle' }).last()).toBeVisible()
    await waitFrames(page, 8)
}

test.describe('scenario 61: on a phone the panel is drawn at its fitted scale on every frame', () => {
    test.use({ viewport: { width: 375, height: 660 } })

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
        await stepColumnHeight(page, [640, 620, 600, 580, 600, 620, 640, 660])
        const record = await panelRecord(page)
        expectFittedOnEveryFrame(record)
        expect(new Set(record.frames.map((frame) => frame.box)).size).toBeGreaterThan(4)
    })

    test('a step with different content refits without an unscaled frame', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 620 })
        await openTable(page, 'actPhase')
        await expect(tile(page, 'Travel')).toBeVisible()
        await recordPanel(page)
        await chooseTravel(page)
        const record = await panelRecord(page)
        expectFittedOnEveryFrame(record)
        expect(record.frames[0].scale - record.frames[record.frames.length - 1].scale).toBeGreaterThan(0.3)
    })

    test('in full screen, the window’s height changing and a new step never draw the panel unscaled', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 580 })
        await openTable(page, 'actPhase')
        await expect(tile(page, 'Travel')).toBeVisible()
        await recordPanel(page)
        await page.getByRole('button', { name: 'Enter full screen' }).click()
        await expect(page.locator('.fullscreen-panel .fit__inner')).toBeVisible()
        expect(await page.locator('.fit__inner').last().evaluate((inner) => inner.closest('.fullscreen-panel') !== null)).toBe(true)
        await panelImagesLoaded(page)
        await stepColumnHeight(page, [560, 540, 520, 540, 560, 580])
        await chooseTravel(page)
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
    const prompt = page.locator('.panel').getByText('Choose a card at your site to place')
    await expect(prompt).toBeVisible()
    const token = prompt.getByRole('img', { name: 'favor' })
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

    test('a Citizenship offer: Undo takes the terms, the space and the Exile one press each, then closes the offer', async ({ page }) => {
        await openTable(page, 'citizenship')
        await grid(page).getByRole('button', { name: 'Offer Citizenship', exact: true }).click()
        await grid(page).getByRole('button', { name: /^ann$/i }).click()
        const spaces = grid(page).getByRole('button', { name: /^Facedown relic on / })
        await spaces.first().click()
        const offer = grid(page).getByRole('button', { name: /^Put the offer to / })
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
        await expect(spaces.first()).toBeVisible()
        await undo.click()
        await expect(grid(page).getByRole('button', { name: /^ann$/i })).toBeVisible()
        await expect(stepBacks(page)).toHaveCount(0)
        await undo.click()
        await expect(grid(page).getByRole('button', { name: /^ann$/i })).toHaveCount(0)
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
        await expect(page.getByText('Tap the card to keep', { exact: false })).toBeVisible()
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

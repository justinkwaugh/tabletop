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

async function pressAndHold(page: Page, x: number, y: number) {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    await page.waitForTimeout(600)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

async function holdCard(page: Page, card: ReturnType<Page['locator']>) {
    const box = await card.boundingBox()
    if (!box) throw Error('The card is on screen')
    await pressAndHold(page, box.x + box.width / 2, box.y + box.height / 2)
}

const preview = (page: Page) => page.locator('.card-preview')
const panelCards = (page: Page) =>
    page.locator('.panel').getByRole('button').filter({ hasNotText: /Back|Undo/ })

/** docs/ui-interaction-visual-contract.md, scenario 7 (touch half). */
test.describe('on touch', () => {
    test.use({ hasTouch: true, viewport: { width: 1024, height: 768 } })

    test('scenario 7: a hold on a pickable card keeps its preview open and picks nothing; the next tap closes it', async ({
        page
    }) => {
        await openTable(page, 'setup')
        await expect(page.getByText('Tap the card to keep', { exact: false })).toBeVisible()
        await holdCard(page, panelCards(page).first())
        await expect(preview(page)).toBeVisible()
        await expect(page.getByText('Tap the card to keep', { exact: false })).toBeVisible()

        await page.touchscreen.tap(20, 20)
        await expect(preview(page)).toHaveCount(0)
        await expect(page.getByText('Tap the card to keep', { exact: false })).toBeVisible()
    })

    test('scenario 24: a preview held open closes when its card leaves the table, and the new offers show with no ring left over', async ({
        page
    }) => {
        await openTable(page, 'setup')
        await holdCard(page, panelCards(page).first())
        await expect(preview(page)).toBeVisible()

        await call(page, 'seatMakesSetupChoice')
        await expect(preview(page)).toHaveCount(0)
        await expect(page.getByText('Tap the site where your pawn starts', { exact: false })).toBeVisible()
        await expect(page.locator('[aria-pressed="true"]')).toHaveCount(0)
    })

    test('scenario 24: a preview held open over a card still on the table stays, while the picks under it end', async ({
        page
    }) => {
        await openTable(page, 'searching')
        await panelCards(page).first().tap()
        await expect(page.getByText('How do you play it?', { exact: false })).toBeVisible()
        await page.locator('.board-card:not(.pickable)').first().tap()
        await expect(preview(page)).toBeVisible()

        await call(page, 'anotherSeatLetsPeek')
        await expect(preview(page)).toBeVisible()
        expect(await call(page, 'searchPicks')).toEqual({})
    })
})

/** Scenario 24 on desktop: a remote Action lands while the mouse rests on a card. */
test('scenario 24: a hovered preview closes when its card leaves the table, and the new offers show with no ring left over', async ({
    page
}) => {
    await openTable(page, 'setup')
    await panelCards(page).first().hover()
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
const boardOffers = (page: Page) => page.locator('.board-card.pickable')
const dimmedSites = (page: Page) => page.locator('.site.dimmed')
const answer = (page: Page, name: string) => grid(page).getByRole('button', { name, exact: true })

async function restMouse(page: Page) {
    await page.mouse.move(2, 2)
}

/** A dimmed tile is `aria-disabled`, which Playwright treats as not clickable, yet it takes the tap. */
async function tapDimmed(tile: ReturnType<Page['locator']>) {
    await tile.click({ force: true })
}

async function setSlider(slider: ReturnType<Page['locator']>, value: number) {
    await slider.evaluate((input, next) => {
        if (!(input instanceof HTMLInputElement)) throw Error('A slider is a range input')
        input.value = String(next)
        input.dispatchEvent(new Event('input', { bubbles: true }))
    }, value)
}

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
    await expect(reasonLine(page)).toHaveText('no card at your site to place favor on')
    await travel.hover()
    await expect(reasonLine(page)).toContainText('Move your pawn to any site')
    await expect(reasonLine(page)).not.toContainText('no card at your site')
    await restMouse(page)
    await expect(reasonLine(page)).toHaveText('')

    await tapDimmed(muster)
    await restMouse(page)
    await expect(reasonLine(page)).toHaveText('no card at your site to place favor on')
    await muster.hover()
    await expect(reasonLine(page)).toHaveText('no card at your site to place favor on')
    await restMouse(page)
    await expect(boardOffers(page)).toHaveCount(0)
    await expect(dimmedSites(page)).toHaveCount(0)

    await call(page, 'anotherSeatLetsPeek')
    await expect(reasonLine(page)).toHaveText('')
    await expect(muster).toHaveAttribute('aria-disabled', 'true')

    await tapDimmed(muster)
    await restMouse(page)
    await expect(reasonLine(page)).toHaveText('no card at your site to place favor on')
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
    test('one slider per group and a count; Kill is dimmed with the reason until the count is right; Undo clears every count', async ({
        page
    }) => {
        await openTable(page, 'exileDefeated')
        const facts = await call(page, 'tableFacts')
        expect(facts.seatId).toBe('def')
        expect(facts.machineState).toBe('CampaignDefeat')
        expect((await call(page, 'defeatPicks')).required).toBe(2)

        const sliders = grid(page).locator('input[type="range"]')
        const kill = answer(page, 'Kill these warbands')
        await expect(sliders).toHaveCount(2)
        await expect(grid(page)).toContainText('Chosen 0 of 2')
        await expect(kill).toBeDisabled()
        await expect(grid(page)).toContainText('must kill exactly 2 of the defeated force, not 0')

        await setSlider(sliders.nth(0), 1)
        await expect(grid(page)).toContainText('Chosen 1 of 2')
        await expect(kill).toBeDisabled()
        await setSlider(sliders.nth(1), 1)
        await expect(grid(page)).toContainText('Chosen 2 of 2')
        await expect(kill).toBeEnabled()
        await expect(grid(page)).not.toContainText('must kill exactly')

        await page.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(grid(page)).toContainText('Chosen 0 of 2')
        await expect(kill).toBeDisabled()
        expect((await call(page, 'defeatPicks')).picked).toEqual([0, 0])

        await setSlider(sliders.nth(0), 1)
        await setSlider(sliders.nth(1), 1)
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
        await expect(grid(page).locator('input[type="range"]')).toHaveCount(2)
        await expect(answer(page, 'Kill these warbands')).toBeDisabled()
    })
})

/** Scenario 32: every panel waits while a send is in flight or a new state is being shown. */
test.describe('scenario 32: waiting on a send', () => {
    test('while a Travel is in flight nothing is offered; refused or accepted, the send ends the draft', async ({
        page
    }) => {
        await openTable(page, 'actPhase')
        const destination = boardOffers(page).and(
            page.getByRole('button', { name: 'c2', exact: true })
        )

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

async function luminanceOf(locator: ReturnType<Page['locator']>, property: 'color' | 'backgroundColor') {
    return locator.evaluate((element, property) => {
        const canvas = document.createElement('canvas')
        canvas.width = 1
        canvas.height = 1
        const context = canvas.getContext('2d')
        if (!context) throw Error('A canvas has a 2d context')
        context.fillStyle = getComputedStyle(element)[property]
        context.fillRect(0, 0, 1, 1)
        const [red, green, blue] = context.getImageData(0, 0, 1, 1).data
        return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
    }, property)
}

test('the side tabs and the chat read light on the dark page', async ({ page }) => {
    await openTable(page, 'setup')
    expect(await luminanceOf(page.locator('body'), 'backgroundColor')).toBeLessThan(0.2)
    const history = page.getByRole('tab', { name: 'History' })
    await expect(history).toHaveAttribute('aria-selected', 'false')
    expect(await luminanceOf(history, 'color')).toBeGreaterThan(0.6)

    await page.getByRole('tab', { name: 'Chat' }).click()
    expect(await luminanceOf(page.getByRole('tab', { name: 'Players' }), 'color')).toBeGreaterThan(0.6)
    expect(await luminanceOf(page.locator('textarea'), 'color')).toBeGreaterThan(0.6)
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
    await expect(page.getByRole('img', { name: /^Oathkeeper of/ })).toHaveCount(0)
    await expect(page.getByRole('img', { name: 'Oathkeeper', exact: true })).toHaveCount(1)

    const goals = page.getByRole('dialog', { name: 'Goals' })
    await rail.hover()
    await page.waitForTimeout(600)
    await expect(goals).toHaveCount(0)

    await rail.click()
    await expect(goals).toBeVisible()
    await expect(goals).toContainText(/wins as the Oathkeeper if the end die ends the game after round 5 \(on a 6\)/)
    await expect(goals).toContainText('2 sites')
    await expect(goals.getByText('not met')).toHaveCount(2)
    await page.keyboard.press('Escape')
    await expect(goals).toHaveCount(0)

    await rail.click()
    await expect(goals).toBeVisible()
    await page.mouse.click(5, 5)
    await expect(goals).toHaveCount(0)
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

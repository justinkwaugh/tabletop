import { expect } from '@playwright/test'
import { ActionType } from '@tabletop/feudum'
import { scenario, type ScenarioTable } from './scenarioTable.js'

/** The contract's writ, round-end and game-end scenarios, on the real table at both widths. */

const atWill = (table: ScenarioTable) => table.panel().locator('[data-rows="at-will"]')
/** The general supply's card, opened by the Supply button beside the zoom controls. */
async function supply(table: ScenarioTable) {
    const card = table.page.getByRole('group', { name: 'General supply' })
    if ((await card.count()) === 0) {
        await table.press(table.page.getByRole('button', { name: 'Supply' }))
    }
    return card
}
const closeSupply = (table: ScenarioTable) => table.page.keyboard.press('Escape')
const seen = (table: ScenarioTable) => table.page.locator('[data-general="deck-seen"]')
const MandateA = 'A: 1 food → 3s'

/** R-4.4.2 The at-will row's Writs chip, by its count. */
const openWrits = async (table: ScenarioTable) =>
    table.press(atWill(table).getByRole('button', { name: /^Writs \d/ }))

scenario('S50 R-4.4.2 At-will row', 'writs-at-will', async (table) => {
    // The chip is drawn as a writ back and its count; its words are its accessible name.
    await expect(atWill(table).getByRole('button')).toHaveCount(1)
    await expect(atWill(table).getByRole('button')).toHaveAccessibleName('Writs 1')
    await table.press(table.card('Tax'))
    await expect(atWill(table)).toHaveCount(0)
    await table.press(table.undo())
    await openWrits(table)
    await expect(table.panel().locator('[data-writ-offer="writ.mandate.5"]')).toContainText(
        MandateA
    )
    const deck = (await supply(table)).locator('[data-general-count="deck"]')
    await expect(seen(table)).toHaveCount(0)
    const before = Number(await deck.textContent())
    await closeSupply(table)
    const flights = await table.flightsOf(() => table.press(table.row(MandateA)))
    expect(flights).toEqual(expect.arrayContaining(['goods: food', 'writs: Mandate 5']))
    await supply(table)
    await expect(seen(table)).toHaveText('seen: Mandate 5')
    await expect(deck).toHaveText(`${before + 1}`)
    await closeSupply(table)
    await table.showSeat('p2')
    await supply(table)
    await expect(seen(table)).toHaveText('seen: Mandate 5')
    await closeSupply(table)
})

scenario('S51 R-4.4.3 No charter is sealed during play', 'writs-charter-held', async (table) => {
    await openWrits(table)
    await expect(table.row('Seal · 1 seal')).toHaveCount(0)
    const own = await table.seatPanel('p1')
    const face = own.locator('[data-writ-face="writ.charter.central-kingdom"]')
    await expect(face).toBeVisible()
    await expect(face).not.toHaveAttribute('data-writ-sealed', '')
    await table.closeSeatPanel()
})

/** R-4.4.4 The Explore played, and one of its two kept: four writs held. */
async function overTheLimit(table: ScenarioTable) {
    await table.press(table.card('Explore'))
    await table.press(table.primary())
    await table.press(table.row('Mandate 6'))
    await table.press(table.primaryNamed('Keep 1 · 1 under the deck'))
    await expect(table.flowLine().first()).toHaveText('Hold at most 3 writs: 4 now')
    await expect(table.panel().locator('[data-writs] > div')).toHaveCount(4)
}

scenario('S52 R-4.4.4 Writ limit: a discard', 'writs-limit', async (table) => {
    await overTheLimit(table)
    await table.press(table.panel().locator('[data-writs] button').first())
    const flights = await table.flightsOf(() => table.press(table.primary()))
    // R-4.4-H8 A discard goes under face down: a back flies, and the table sees no face.
    expect(flights.filter((flight) => flight.startsWith('writs:'))).toEqual(['writs: Writ back'])
    await expect(seen(table)).toHaveCount(0)
    expect(await table.activeSeats()).not.toContain('p1')
})

scenario('S52 R-4.4.4 Writ limit: a mandate from the row', 'writs-limit', async (table) => {
    await overTheLimit(table)
    await openWrits(table)
    await table.press(table.row(MandateA))
    await supply(table)
    await expect(seen(table)).toHaveText('seen: Mandate 5')
    await closeSupply(table)
    expect(await table.activeSeats()).not.toContain('p1')
})

scenario('S53 R-4.10.1 Nourish choice', 'nourish-choice', async (table) => {
    const pawns = table.panel().locator('[data-nourish-pawn]')
    const feeds = pawns.locator('[data-feed][data-picked]')
    const fed = () => feeds.evaluateAll((all) => all.map((one) => one.getAttribute('data-feed')))
    await expect(pawns).toHaveCount(3)
    expect(await fed()).toEqual(['food', 'wine', 'unfed'])
    await expect(feeds.nth(1)).toContainText('feeds 2 rounds · 0 strength next round')
    // R-4.10.1 The pawn left unfed is rose, with what it loses.
    await expect(pawns.nth(2)).toHaveClass(/border-feudum-danger/)
    await expect(feeds.nth(2)).toContainText('back to your supply · its vessel stays')
    // Contract, Phone layout: a phone says the unfed rule in its short words, beside the send.
    await expect(table.panel().locator('[data-nourish-rule]')).toHaveText(
        table.phone ? 'Unfed: back to supply' : /^Every pawn must eat if you can feed it\./
    )
    await expect(table.primary()).toHaveText(/^Feed 2 · leave the [a-z]+$/)
    if (table.phone) {
        await expect(table.primary()).toBeInViewport({ ratio: 1 })
    }
    await expect(table.panel().locator('[data-order-seat="Bram"] [data-fed-by-game]')).toHaveText(
        '· nothing to decide'
    )
    // R-4.10.1 Each fed pawn's chip is its payment; the unfed one's, what it loses.
    expect(Object.values(await table.litChips()).sort()).toEqual(
        ['1 food', '1 wine', 'returns to supply'].sort()
    )

    const unfed = table.panel().getByRole('button', { name: /^Unfed/ })
    await table.press(unfed.first())
    await expect.poll(fed).toEqual(['unfed', 'wine', 'food'])
    const flights = await table.flightsOf(() => table.press(table.primary()))
    expect(flights).toEqual(
        expect.arrayContaining(['goods: food', 'goods: sulfur', "pawns: Ana's monk pawn"])
    )
})

scenario('S53 R-4.10.1 Nourish, every pawn fed', 'nourish-fed', async (table) => {
    const pawns = table.panel().locator('[data-nourish-pawn]')
    await expect(pawns).toHaveCount(3)
    await expect(table.panel().locator('[data-nourish-pawn][data-unfed]')).toHaveCount(0)
    await expect(table.primary()).toHaveAccessibleName('Feed 3 pawns · 3 food')
    expect(Object.values(await table.litChips())).toEqual(['1 food', '1 food', '1 food'])
    if (table.phone) {
        // Contract, Phone layout: compact rows within the width, the order row as dots, the send as art.
        const width = table.page.viewportSize()?.width ?? 0
        for (const box of await pawns.evaluateAll((all) =>
            all.map((one) => one.getBoundingClientRect().right)
        )) {
            expect(box).toBeLessThanOrEqual(width)
        }
        await expect(table.panel().locator('[data-order-seat="Ana"] [data-phone-word]')).toHaveText(
            'you'
        )
        await expect(table.primary().locator('[data-send-phone]')).toHaveText(
            /^Feed 3\s*·\s*food\s*3\s*$/
        )
        // No preview path beside each feed, and the send stays in sight in the action area's cap.
        await expect(table.panel().locator('[data-nourish-rows] [data-preview]')).toHaveCount(6)
        for (const preview of await table
            .panel()
            .locator('[data-nourish-rows] [data-preview]')
            .all()) {
            await expect(preview).toBeHidden()
        }
        await expect(table.primary()).toBeInViewport({ ratio: 1 })
    } else {
        await expect(table.panel().locator('[data-nourish-pays]')).toContainText('you keep')
        await expect(table.primary()).toHaveText('Feed 3 pawns · 3 food')
    }
    const flights = await table.flightsOf(() => table.press(table.primary()))
    expect(flights).toEqual(expect.arrayContaining(['goods: food']))
})

/** Every face the die shows from now until the table settles, in order. */
async function dieFacesOf(table: ScenarioTable, press: () => Promise<void>): Promise<string[]> {
    await table.page.evaluate(() => {
        const faces: string[] = []
        Object.assign(window, { feudumDieFaces: faces })
        const sample = () => {
            const face = document.querySelector('[data-token="die-face"] text')?.textContent ?? ''
            if (face && faces.at(-1) !== face) {
                faces.push(face)
            }
            if (Reflect.get(window, 'feudumDieFaces') === faces) {
                requestAnimationFrame(sample)
            }
        }
        requestAnimationFrame(sample)
    })
    await press()
    return table.page.evaluate(() => {
        const faces = Reflect.get(window, 'feudumDieFaces')
        Object.assign(window, { feudumDieFaces: undefined })
        return Array.isArray(faces) ? faces.map(String) : []
    })
}

scenario('S54 R-4.11.2, R-4.12 Progress roll and dawn', 'dawn-roll', async (table) => {
    const forfeit = { type: ActionType.ForfeitCard, kind: 'migrate' }
    let flights: string[] = []
    const faces = await dieFacesOf(table, async () => {
        flights = await table.flightsOf(() => table.another('p3', forfeit))
    })
    expect(faces.at(-1)).toMatch(/desert/i)
    expect(flights).toEqual(
        expect.arrayContaining([
            'board: progress-die',
            'token: die-face',
            'token: tile',
            'board: stack:desert',
            'board: epoch-marker',
            'token: glow',
            'board: score:p1',
            'board: score:p2'
        ])
    )
    // R-4.11 The roll is told in the history; the panel keeps the sheet.
    await expect(table.panel().locator('[data-round-line]')).toHaveCount(0)
    await table.press(table.page.getByRole('tab', { name: 'History' }))
    await expect(table.page.locator('[data-history-list]')).toContainText('Desert I removed')
    await expect(table.page.locator('[data-history-list]')).toContainText('Epoch II dawned')
    const sheet = table.panel().locator('[data-dawn-sheet]')
    await expect(sheet.locator('[data-dawn-row]')).toHaveCount(3)
    for (const cell of ['ranks', 'landscapes', 'regions', 'disloyalty', 'total']) {
        await expect(sheet.locator(`[data-dawn-row] [data-dawn-${cell}]`)).toHaveCount(3)
    }
    const disloyalty = sheet.locator('[data-dawn-row="Bram"] [data-dawn-disloyalty]')
    await expect(disloyalty).toHaveText(/^-\d/)
    await expect(disloyalty).toHaveClass(/text-feudum-danger/)
})

/** Every good a seat's panel says it holds, summed. */
async function goodsOf(table: ScenarioTable, of: string): Promise<number> {
    const panel = await table.seatPanel(of)
    const held = await panel.locator('[data-supply-good]').allTextContents()
    await table.closeSeatPanel()
    return held.reduce((sum, text) => sum + Number(text.replace(/\D/g, '')), 0)
}

scenario('S55 R-4.12.3 Collect landscapes', 'dawn-collect', async (table) => {
    expect(Object.keys(await table.litChips()).sort()).toEqual([
        'space:space.island.3',
        'space:space.sea.2'
    ])
    const [ana, bram] = [await goodsOf(table, 'p1'), await goodsOf(table, 'p2')]
    // The island's orchard, by its light: food, so the haversacks show it.
    await table.pressPick('space:space.island.3')
    await expect(table.primary()).toHaveText('Collect 1')
    const flights = await table.flightsOf(() => table.press(table.primary()))
    expect(flights.filter((flight) => flight === 'token: good')).toHaveLength(6)
    expect(await goodsOf(table, 'p1')).toBe(ana + 5)
    expect(await goodsOf(table, 'p2')).toBe(bram + 1)
})

scenario('S56 R-6.1, R-6.3 End of game', 'game-end', async (table) => {
    const summary = table.panel().locator('[data-game-end]')
    await expect(summary.locator('[data-game-winner]')).toHaveText('Ana wins')
    await expect(summary.locator('[data-game-tie-break]')).toHaveText(
        'Tie on vp broken by barrel sulfur: Ana 2, Bram 1'
    )
    await expect(summary.locator('[data-game-end-seat]')).toHaveCount(3)
    for (const row of [
        'before-dawn',
        'dawn',
        'voyage',
        'empire',
        'shillings',
        'charters',
        'total'
    ]) {
        await expect(summary.locator(`[data-game-end-row="${row}"]`).first()).toBeVisible()
    }
    const charter = summary.locator('[data-game-end-charter="writ.charter.sulfur-barrel"]')
    await expect(charter).toHaveCount(1)
    await expect(charter.getByRole('img')).not.toHaveAccessibleName(/back/i)
    await expect(charter).toContainText('5')
    await expect(table.primary()).toHaveCount(0)
})

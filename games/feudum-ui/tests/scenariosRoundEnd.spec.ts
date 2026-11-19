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
    const before = Number(await deck.textContent())
    await closeSupply(table)
    const reference = await table.writReference()
    const flights = await table.flightsOf(() => table.press(table.row(MandateA)))
    expect(flights).toEqual(expect.arrayContaining(['goods: food', 'writs: Mandate 5']))
    // Contract, Supply: the deck is its count; nothing tells the played writ lies in it.
    const writDeck = (await supply(table)).getByRole('group', { name: 'Writ deck' })
    await expect(deck).toHaveText(`${before + 1}`)
    await expect(writDeck).not.toContainText('Mandate 5')
    const line = await writDeck.innerHTML()
    await closeSupply(table)
    expect(await table.writReference()).toEqual(reference)
    await table.showSeat('p2')
    await expect((await supply(table)).getByRole('group', { name: 'Writ deck' })).toHaveJSProperty(
        'innerHTML',
        line
    )
    await closeSupply(table)
    expect(await table.writReference()).toEqual(reference)
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
    await expect(table.flowLine().first()).toHaveText('Discard 1')
    await expect(table.panel().locator('[data-writs] > div')).toHaveCount(4)
}

scenario('S52 R-4.4.4 Writ limit: a discard', 'writs-limit', async (table) => {
    await overTheLimit(table)
    await table.press(table.panel().locator('[data-writs] button').first())
    const flights = await table.flightsOf(() => table.press(table.primary()))
    // R-4.4-H8 A discard goes under face down: a back flies, and the table sees no face.
    expect(flights.filter((flight) => flight.startsWith('writs:'))).toEqual(['writs: Writ back'])
    expect(await table.activeSeats()).not.toContain('p1')
})

scenario('S52 R-4.4.4 Writ limit: a mandate from the row', 'writs-limit', async (table) => {
    await overTheLimit(table)
    await openWrits(table)
    await table.press(table.row(MandateA))
    // Contract, Supply: the played writ goes under the deck, which shows its count alone.
    const writDeck = (await supply(table)).getByRole('group', { name: 'Writ deck' })
    await expect(writDeck).not.toContainText('Mandate')
    await closeSupply(table)
    expect(await table.activeSeats()).not.toContain('p1')
})

scenario('S53 R-4.10.1 Nourish choice', 'nourish-choice', async (table) => {
    const pawns = table.panel().locator('[data-nourish-pawn]')
    const feeds = pawns.locator('[data-feed][data-picked]')
    const fed = () => feeds.evaluateAll((all) => all.map((one) => one.getAttribute('data-feed')))
    await expect(pawns).toHaveCount(3)
    expect(await fed()).toEqual(['food', 'wine', 'unfed'])
    // R-4.10.2 Wine alone keeps a line, its cost; food is its piece, "unfed" its word.
    const caption = feeds.nth(1).locator('[data-caption]')
    await expect(caption).toHaveText('2 rounds · 0 strength')
    await expect(caption).toBeVisible({ visible: !table.phone })
    await expect(feeds.nth(0).locator('[data-caption]')).toHaveCount(0)
    await expect(feeds.nth(0)).not.toContainText('1 food')
    // R-4.10.1 The pawn left unfed is rose; the History says where it goes.
    await expect(pawns.nth(2)).toHaveClass(/border-feudum-danger/)
    await expect(feeds.nth(2)).toHaveText('unfed')
    await expect(table.panel().locator('[data-nourish-rule]')).toHaveCount(0)
    await expect(table.panel().locator('[data-nourish-summary]')).toHaveCount(0)
    await expect(table.panel()).not.toContainText('Every pawn must eat')
    await expect(table.primary()).toHaveText('Feed 2 · leave 1')
    if (table.phone) {
        await expect(table.primary()).toBeInViewport({ ratio: 1 })
    }
    // The seat the game fed is a chip with a tick, and no words.
    const bram = table.panel().locator('[data-order-seat="Bram"]')
    await expect(bram.getByRole('img', { name: 'done' })).toBeVisible()
    await expect(table.panel().locator('[data-order-row]')).not.toContainText('nothing to decide')
    // R-4.10.1 Each fed pawn's chip is its payment; the unfed one's, that it goes home.
    expect(Object.values(await table.litChips()).sort()).toEqual(
        ['1 food', '1 wine', 'home'].sort()
    )

    const unfed = table.panel().getByRole('button', { name: /^Unfed/ })
    await table.press(unfed.first())
    await expect.poll(fed).toEqual(['unfed', 'wine', 'food'])
    const flights = await table.flightsOf(() => table.press(table.primary()))
    expect(flights).toEqual(
        expect.arrayContaining(['goods: food', 'goods: sulfur', "pawns: Ana's monk pawn"])
    )
})

scenario(
    'S53 R-4.10.1 Nourish, every pawn fed, and the order row reads out who is deciding',
    'nourish-fed',
    async (table) => {
        const pawns = table.panel().locator('[data-nourish-pawn]')
        await expect(pawns).toHaveCount(3)
        await expect(table.panel().locator('[data-nourish-pawn][data-unfed]')).toHaveCount(0)
        await expect(table.primary()).toHaveAccessibleName('Feed 3 · 3 food')
        expect(Object.values(await table.litChips())).toEqual(['1 food', '1 food', '1 food'])
        // The order row's status is read out at every width, the phone's dots too.
        expect(await table.panel().locator('[data-order-seat="Ana"]').ariaSnapshot()).toMatch(
            /Ana.*deciding/s
        )
        if (table.phone) {
            // Contract, Phone layout: compact rows within the width, the order row as dots, the send as art.
            const width = table.page.viewportSize()?.width ?? 0
            for (const box of await pawns.evaluateAll((all) =>
                all.map((one) => one.getBoundingClientRect().right)
            )) {
                expect(box).toBeLessThanOrEqual(width)
            }
            await expect(table.panel().locator('[data-order-seat="Ana"]')).not.toContainText('you')
            // No preview path beside each feed, and the send stays in sight in the action area's cap.
            await expect(table.panel().locator('[data-nourish-rows] [data-preview]')).toHaveCount(6)
            for (const preview of await table
                .panel()
                .locator('[data-nourish-rows] [data-preview]')
                .all()) {
                await expect(preview).toBeHidden()
            }
            await expect(table.primary()).toBeInViewport({ ratio: 1 })
        }
        // The send draws what is paid as art, at every width.
        await expect(table.primary().locator('[data-send-art]')).toHaveText(
            /^Feed 3\s*·\s*food\s*3\s*$/
        )
        const flights = await table.flightsOf(() => table.press(table.primary()))
        expect(flights).toEqual(expect.arrayContaining(['goods: food']))
    }
)

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
    const scoreMotions = [await table.scoreMotion('p1'), await table.scoreMotion('p2')]
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
            ...scoreMotions
        ])
    )
    // R-4.11 The roll is told in the history; the panel keeps the sheet.
    await expect(table.panel()).not.toContainText('removed')
    await expect(table.panel()).not.toContainText('Epoch II dawn')
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
    await expect(summary.locator('[data-game-winner]')).toHaveText(/^\s*Ana\s*wins\s*$/)
    await expect(summary.locator('[data-game-winner] [data-seat-chip="Ana"]')).toBeVisible()
    const tie = summary.locator('[data-game-tie-break]')
    await expect(tie).toHaveText(/^\s*Tie broken by barrel sulfur:\s*Ana\s*2\s*and\s*Bram\s*1\s*$/)
    await expect(tie.locator('[data-seat-chip]')).toHaveCount(2)
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

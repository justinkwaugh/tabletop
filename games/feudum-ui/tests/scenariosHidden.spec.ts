import { expect } from '@playwright/test'
import { scenario, type ScenarioTable } from './scenarioTable.js'

/** The contract's Hidden information scenarios, on the real table at both widths. */

const Charter = 'writ.charter.central-kingdom'
const enlarged = (table: ScenarioTable) => table.page.locator('[data-enlarged]')

/** The log, as the History tab lists it: every line a seat can read. */
async function logText(table: ScenarioTable): Promise<string> {
    await table.press(table.page.getByRole('tab', { name: 'History' }))
    const list = table.page.locator('[data-history-list]')
    await expect(list).toBeVisible()
    const text = await list.evaluate((element) => element.outerHTML)
    await table.press(table.page.getByRole('tab', { name: 'Players' }))
    return text
}

/** A press that enlarges, read, then Escape: what the enlarged layer showed. */
async function enlargedBy(table: ScenarioTable, target: string, panelOf: string) {
    const panel = await table.seatPanel(panelOf)
    await table.press(panel.locator(target).first())
    await expect(enlarged(table)).toBeVisible()
    const shown = {
        kind: await enlarged(table).getAttribute('data-enlarged'),
        html: await enlarged(table).innerHTML()
    }
    await table.page.keyboard.press('Escape')
    await expect(enlarged(table)).toHaveCount(0)
    await table.closeSeatPanel()
    return shown
}

scenario(
    "S57 R-3.1, R-4.4.4, R-5.1 Others' hands and writs",
    'writs-charter-held',
    async (table) => {
        // The owner's own panel names the kept charter and counts the one card left in hand.
        const own = await table.seatPanel('p1')
        const face = own.locator(`[data-writ-face="${Charter}"]`)
        await expect(face).toBeVisible()
        const writName = await face.evaluate(
            (element) =>
                (
                    element.closest('[data-enlarge]') ?? element.querySelector('[data-enlarge]')
                )?.getAttribute('data-enlarge') ?? 'no name'
        )
        expect(writName).not.toBe('no name')
        await expect(own.locator('[data-in-hand]')).toHaveText('1 in hand')
        await expect(own.locator('[data-seat-card]:not([data-card-played])')).toHaveCount(0)
        await expect(own.locator('[data-set-aside]')).toHaveCount(0)
        await table.closeSeatPanel()
        expect(await logText(table)).toContain('kept')

        await table.showSeat('p2')
        const theirs = await table.seatPanel('p1')
        await expect(theirs.locator('[data-hand-backs]')).toHaveAttribute('data-hand-backs', '1')
        await expect(theirs.locator('[data-set-aside]')).toHaveCount(0)
        await expect(theirs.locator('[data-seat-card]:not([data-card-played])')).toHaveCount(0)
        await expect(theirs.locator('[data-writ-back="open"]')).toHaveCount(1)
        await expect(theirs.locator('[data-writ-face]')).toHaveCount(0)
        const html = await theirs.innerHTML()
        expect(html).not.toContain(Charter)
        expect(html).not.toContain(writName)
        await table.closeSeatPanel()

        const back = await enlargedBy(table, '[data-enlarge="card back"]', 'p1')
        expect(back.kind).toBe('card')
        expect(back.html).toContain('card back')
        expect(back.html).not.toContain('Tax')
        const writBack = await enlargedBy(table, '[data-enlarge="writ back"]', 'p1')
        expect(writBack.kind).toBe('writ')
        expect(writBack.html).toContain('Writ back')
        expect(writBack.html).not.toContain(Charter)
        expect(writBack.html).not.toContain(writName)

        const log = await logText(table)
        expect(log).toContain('kept')
        expect(log).not.toContain(Charter)
        expect(log).not.toContain(writName)
    }
)

scenario(
    'S78 R-4.4.1, R-4.4.4 The writ reference is the same for every seat',
    'writs-charter-held',
    async (table) => {
        // p1 holds the charter and knows two writs under the deck; p2 knows neither.
        const own = await table.writReference()
        expect(own.writs).toHaveLength(16)
        expect(new Set(own.writs).size).toBe(16)
        expect(own.writs).toContain(Charter)
        const supply = table.page.getByRole('group', { name: 'Writ deck' })
        await table.press(table.page.getByRole('button', { name: 'Supply', exact: true }))
        await expect(supply).not.toContainText('know')
        await table.page.keyboard.press('Escape')

        await table.showSeat('p2')
        expect(await table.writReference()).toEqual(own)

        // A writ in it enlarges with its rules note, and closes back to the reference.
        await table.press(table.page.getByRole('button', { name: 'Supply', exact: true }))
        await table.press(table.page.getByRole('button', { name: 'Writ reference', exact: true }))
        const layer = table.page.locator('[data-table-layer="writs"]')
        await table.press(layer.locator(`[data-reference-writ="${Charter}"] [data-enlarge]`))
        await expect(enlarged(table)).toHaveAttribute('data-enlarged', 'writ')
        await expect(table.page.locator('[data-rules-note]')).not.toBeEmpty()
        await table.page.keyboard.press('Escape')
        await expect(enlarged(table)).toHaveCount(0)
        await expect(layer).toBeVisible()
        await table.page.keyboard.press('Escape')
        await expect(layer).toHaveCount(0)
    }
)

/**
 * S57 Host View: the platform grants it to a game's host, and this page hosts no game, so the view a
 * host's browser takes is stood in for here: the session is told it views as host and is handed the
 * game's whole state, as a hosted game's server hands it.
 */
scenario('S57 R-5.1 In Host View the faces show', 'writs-charter-held', async (table) => {
    await table.showSeat('p2')
    await table.page.evaluate(() => {
        const session = window.feudumSession
        const shown = session.gameState
        const whole: typeof shown = Reflect.construct(shown.constructor, [
            structuredClone(window.feudumFixture.host.state)
        ])
        Object.defineProperty(session, 'isViewingHost', { get: () => true })
        session.gameState = whole
    })
    await table.settled()
    const theirs = await table.seatPanel('p1')
    await expect(theirs.locator(`[data-writ-face="${Charter}"]`)).toBeVisible()
    await expect(theirs.locator('[data-writ-back]')).toHaveCount(0)
    await expect(theirs.locator('[data-hand-backs]')).toHaveCount(0)
    await expect(theirs.locator('[data-seat-card="tax"]:not([data-card-played])')).toHaveCount(1)
    await table.closeSeatPanel()
})

scenario('S58 R-5-H1, R-4.6.5 Seals for everyone', 'seals-noble-push', async (table) => {
    // The buyer's seal is a crowned disc to its owner too: a count, and no value.
    await table.showSeat('p2')
    const owner = await table.seatPanel('p2')
    const held = owner.locator('[data-seals]')
    await expect(held).toHaveAttribute('data-seals', '1')
    await expect(held.getByRole('img', { name: "king's seal" })).toHaveCount(1)
    expect(await held.innerText()).not.toMatch(/\+\d/)
    await table.closeSeatPanel()
    await expect(table.page.locator('[data-board-surface] [data-motion^="seal:"]')).toHaveCount(3)

    await table.showSeat('p1')
    const shownTo = await table.seatPanel('p2')
    await expect(shownTo.locator('[data-seals]')).toHaveAttribute('data-seals', '1')
    await table.closeSeatPanel()
    const rosary = table.page.locator('[data-board-surface] [data-motion^="bead:"]')
    const before = await rosary.count()

    await table.press(table.card('Guild'))
    await table.pressPick('guild:noble')
    await table.press(table.popupRowStarting('Push'))
    for (const scroll of ['r1c3', 'r2c2']) {
        await table.press(
            table.page.locator(`[data-bench-place="scroll:guild.noble.scroll.${scroll}"] button`)
        )
    }
    const send = table.page.locator('[data-primary]')
    await expect(send).toHaveText("Flip 2 seals · can't be undone")
    const flights = await table.flightsOf(() => table.press(send))
    // Both seals leave the scrolls in the one Action, and fly to the rosary.
    expect(flights.filter((flight) => flight.startsWith('seals: '))).toHaveLength(2)
    expect(flights).toEqual(
        expect.arrayContaining([
            'board: seal:guild.noble.scroll.r1c3',
            'board: seal:guild.noble.scroll.r2c2'
        ])
    )

    // One Action names both values; every seat's table reads the same rosary and the same line.
    await expect(rosary).toHaveCount(before + 2)
    await expect(table.page.locator('[data-board-surface] [data-motion^="seal:"]')).toHaveCount(1)
    const beads = async () =>
        (await rosary.evaluateAll((all) => all.map((bead) => bead.getAttribute('data-motion'))))
            .map(String)
            .sort()
    const pushLine = async () =>
        (await logText(table)).match(/flipped seals to [^<"]*/)?.[0] ?? 'no line'
    const seen = { beads: await beads(), line: await pushLine() }
    expect(seen.line).toMatch(/^flipped seals to bead \+\d+, bead \+\d+ · rosary now \d+/)
    for (const other of ['p2', 'p3']) {
        await table.showSeat(other)
        expect(await beads()).toEqual(seen.beads)
        expect(await pushLine()).toBe(seen.line)
    }
})

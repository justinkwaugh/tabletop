import { expect, test, type Page } from '@playwright/test'
import {
    facts,
    failOnPageErrors,
    openTable,
    playerIdOf,
    revealedHand,
    seatRow,
    viewAs
} from './support/table.js'

// Contract, "Seat ledger": the seats as one table in the side column's Players tab.
failOnPageErrors()

const RAILROADS = ['railroad.cp', 'railroad.up', 'railroad.kp', 'railroad.sp'] as const
const TAGS = ['CP', 'UP', 'KP', 'SP']
// The palette's paper, var(--pp-paper).
const PAPER = 'rgb(233, 221, 182)'

const ledger = (page: Page) => page.locator('[data-seat-ledger]')
const rows = (page: Page) => ledger(page).locator('[data-ledger-row]')
const enlarged = (page: Page) => page.locator('[data-enlarged-view]')
const openSeat = (page: Page) => page.locator('[data-open-seat]')

// R-1.2: a price is its track index less the four extra 0 spaces, never below 0.
const priceAt = (priceIndex: number) => Math.max(0, priceIndex - 4)

test('contract, "Seat ledger": a row per seat in seat order, a column per railroad at today’s price, cash and score; no hand pieces or share cards', async ({
    page
}) => {
    await openTable(page, 'Opening turn')
    const table = await facts(page)
    await expect(rows(page)).toHaveCount(4)
    expect(
        await rows(page).evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute('data-ledger-row'))
        )
    ).toEqual(table.turnOrder)
    const head = ledger(page).locator('thead th')
    await expect(head).toHaveText([
        'Seat',
        ...RAILROADS.map(
            (railroadId, index) =>
                new RegExp(`^${TAGS[index]}\\s*\\$${priceAt(table.priceIndex[railroadId])}$`)
        ),
        'Cash',
        'Score'
    ])
    // Every seat always holds its pieces, and the cards read as counts: neither is drawn.
    await expect(ledger(page).locator('[data-hand-piece], img, [data-seat-share]')).toHaveCount(0)
    await expect(page.locator('[data-seat-card]')).toHaveCount(0)
})

test('R-6.2: each seat’s count and worth by railroad, its cash and its score (cash + shares at today’s price), with no leader mark', async ({
    page
}) => {
    await openTable(page, 'Repairs one short')
    const table = await facts(page)
    const prices = RAILROADS.map((railroadId) => priceAt(table.priceIndex[railroadId]))
    const scores = table.players.map(
        (player) =>
            player.money +
            RAILROADS.reduce(
                (sum, railroadId, index) => sum + player.shares[railroadId] * prices[index],
                0
            )
    )
    expect(new Set(scores).size).toBeGreaterThan(1)

    for (const playerId of table.turnOrder) {
        const player = table.players.find((seat) => seat.playerId === playerId)
        if (!player) throw Error(`No seat ${playerId}`)
        const score = scores[table.players.indexOf(player)]
        const row = ledger(page).locator(`[data-ledger-row="${playerId}"]`)
        for (const [index, railroadId] of RAILROADS.entries()) {
            const count = player.shares[railroadId]
            const cell = row.locator(`[data-ledger-share="${railroadId}"]`)
            await expect(cell).toHaveAttribute('data-count', String(count))
            await expect(cell).toHaveText(
                count === 0 ? '–' : new RegExp(`^${count}\\s*\\$${count * prices[index]}$`)
            )
        }
        await expect(row.locator('[data-seat-money]')).toHaveText(`$${player.money}`)
        await expect(row.locator('[data-ledger-score]')).toHaveAttribute(
            'data-ledger-score',
            String(score)
        )
        // The score is the figure alone: no star marks the seat ahead.
        await expect(row.locator('[data-ledger-score]')).toHaveText(`$${score}`)
    }
    await expect(ledger(page)).not.toContainText('★')
    await expect(ledger(page).locator('[data-leader]')).toHaveCount(0)
})

test('R-X.1, R-2.2 step 1: the acting seat’s row is amber and names its revealed hand to every seat; no other hand is named', async ({
    page
}) => {
    await openTable(page, 'Opening turn')
    const table = await facts(page)
    const tags = table.turnPieces.map((railroadId) => railroadId.slice(-2).toUpperCase())
    const mara = seatRow(page, 'Mara')
    await expect(mara).toHaveAttribute('data-active', 'true')
    const amber = await mara.evaluate((node) => getComputedStyle(node).backgroundColor)
    expect(amber).not.toBe(PAPER)
    expect(amber).not.toBe('rgba(0, 0, 0, 0)')
    expect(await revealedHand(page, 'Mara')).toEqual(table.turnPieces)
    await expect(mara.locator('[data-ledger-hand]')).toHaveText(
        new RegExp(`^hand\\s*${tags.join('\\s*')}$`)
    )
    for (const seat of ['Royce', 'Ines', 'Tobias'] as const) {
        await expect(seatRow(page, seat)).toHaveAttribute('data-active', 'false')
        expect(await revealedHand(page, seat)).toEqual([])
    }

    // R-5: Royce's own client names Mara's revealed hand, and not even his own concealed one.
    await viewAs(page, 'Royce')
    expect(await revealedHand(page, 'Mara')).toEqual(table.turnPieces)
    expect(await revealedHand(page, 'Royce')).toEqual([])
    await expect(seatRow(page, 'Royce').locator('[data-ledger-hand]')).toHaveCount(0)
})

test('contract, "Open seat": a press anywhere on a row opens that seat; Escape closes one layer at a time', async ({
    page
}) => {
    await openTable(page, 'Opening turn')
    const playerId = await playerIdOf(page, 'Ines')
    // A press on the row's cash, away from the name, opens the seat.
    const cash = await seatRow(page, 'Ines').locator('[data-seat-money]').boundingBox()
    if (!cash) throw Error("Ines's cash has a box")
    await page.mouse.click(cash.x + cash.width / 2, cash.y + cash.height / 2)
    await expect(openSeat(page)).toHaveAttribute('data-open-seat', playerId)
    await expect(openSeat(page)).toContainText('Money this turn')

    await openSeat(page).locator('[data-seat-share="railroad.up"]').click()
    await expect(enlarged(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(enlarged(page)).toHaveCount(0)
    await expect(openSeat(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(openSeat(page)).toHaveCount(0)

    await seatRow(page, 'Ines').getByRole('button', { name: "Open Ines's seat" }).click()
    await openSeat(page)
        .getByRole('button', { name: /^Close .*'s seat$/ })
        .click()
    await expect(openSeat(page)).toHaveCount(0)
})

test('O-10: the open seat keeps the stock certificate: number, dotted name, cash coupon, four shares, italic footer', async ({
    page
}) => {
    await openTable(page, 'Opening turn')
    await seatRow(page, 'Royce').click()
    const card = openSeat(page).locator('[data-seat-card]')
    const parts = await card.evaluate((node) => {
        const style = (selector: string) => {
            const element = node.querySelector(selector)
            return element ? getComputedStyle(element) : undefined
        }
        const probe = document.createElement('span')
        probe.style.color = (node as HTMLElement).style.getPropertyValue('--seat')
        node.appendChild(probe)
        const seat = getComputedStyle(probe).color
        probe.remove()
        return {
            seat,
            number: node.querySelector('[data-seat-number]')?.textContent?.trim(),
            numberFont: style('[data-seat-number]')?.fontStyle,
            dot: style('[data-seat-dot]')?.backgroundColor,
            frame: style('[data-seat-frame]')?.borderTopColor,
            money: style('[data-seat-money]')?.borderTopStyle,
            footFamily: style('[data-seat-foot]')?.fontFamily,
            footStyle: style('[data-seat-foot]')?.fontStyle
        }
    })
    expect(parts.number).toBe('No. 2')
    expect(parts.numberFont).toBe('italic')
    expect(parts.dot).toBe(parts.seat)
    expect(parts.frame).toBe(parts.seat)
    expect(parts.money).toBe('dashed')
    expect(parts.footFamily).toContain('Libre Caslon Text')
    expect(parts.footStyle).toBe('italic')
    await expect(card.locator('[data-seat-share]')).toHaveCount(4)
    await expect(card.locator('[data-seat-foot]')).toContainText('shares worth $')
})

test('R-5: another seat opened over the table shows its concealed hand as grey discs, even in a game that holds them', async ({
    page
}) => {
    await openTable(page, 'Opening turn')
    await seatRow(page, 'Ines').click()
    const faces = await openSeat(page)
        .locator('[data-hand-piece]')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-hand-piece')))
    expect(faces).toEqual(['hidden', 'hidden', 'hidden'])
    await expect(openSeat(page)).toContainText('hand: 3 hidden')
})

test('the Libre Caslon Text faces load for the secondary lines', async ({ page }) => {
    await openTable(page, 'Opening turn')
    await expect
        .poll(() =>
            page.evaluate(async () => {
                const fonts = [
                    '400 12px "Libre Caslon Text"',
                    'italic 400 12px "Libre Caslon Text"'
                ]
                const loaded = await Promise.all(fonts.map((font) => document.fonts.load(font)))
                return loaded.map((faces) =>
                    faces.map((face) => `${face.family} ${face.style} ${face.status}`)
                )
            })
        )
        .toEqual([['Libre Caslon Text normal loaded'], ['Libre Caslon Text italic loaded']])
})

test('contract, "The principle": a deck and the bag enlarge or count, and the next press only closes', async ({
    page
}) => {
    await openTable(page, 'Opening turn')
    await page.locator('[data-deck-target="railroad.kp"]').click()
    await expect(enlarged(page).getByRole('img')).toHaveAttribute('alt', 'Kansas Pacific share')
    await page.keyboard.press('Escape')
    await expect(enlarged(page)).toHaveCount(0)

    const remaining = await page.locator('[data-bag]').getAttribute('data-bag')
    await page.locator('[data-bag-target]').click()
    await expect(enlarged(page)).toHaveAttribute('data-enlarged-view', 'Bag')
    await expect(enlarged(page)).toContainText(`${remaining} pieces in the bag`)
    await expect(enlarged(page).getByRole('img')).toHaveCount(0)
    await enlarged(page).getByRole('button', { name: 'Close' }).click()
    await expect(enlarged(page)).toHaveCount(0)
    await expect(openSeat(page)).toHaveCount(0)
})

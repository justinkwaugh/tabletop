import { expect, test as base, type Page } from '@playwright/test'
import {
    WIDTHS,
    facts,
    failOnPageErrors,
    handOver,
    header,
    hexTarget,
    history,
    openTable,
    playerIdOf,
    press,
    settled,
    trackPiece,
    turnPiece,
    undoButton,
    viewAs,
    type SeatName,
    type TableName
} from './support/table.js'

// docs/ui-interaction-visual-contract.md, "Verification scenarios", Repairs (16–22).
// Where several seats decide, each seat is its own browser context in the harness's protected
// mode: it holds only its own projection, and what it sends reaches the others by `handOver`.

type Width = (typeof WIDTHS)[number]

// A further seat's client: a fresh browser context at the test's width, failing on page errors.
const test = base.extend<{ seatClient: () => Promise<Page> }>({
    seatClient: async ({ browser, baseURL }, use, testInfo) => {
        const opened: { page: Page; errors: string[] }[] = []
        const width = WIDTHS.find((candidate) => testInfo.titlePath.includes(candidate.name))
        if (width === undefined) throw Error('Every Repairs scenario runs at a named width')
        await use(async () => {
            const context = await browser.newContext({ ...width.use, baseURL })
            const page = await context.newPage()
            const errors: string[] = []
            page.on('pageerror', (error) => errors.push(error.message))
            opened.push({ page, errors })
            return page
        })
        for (const { page, errors } of opened) {
            expect(errors).toEqual([])
            await page.context().close()
        }
    }
})

test.describe.configure({ mode: 'parallel' })
failOnPageErrors()

const SP = 'railroad.sp'
const CP = 'railroad.cp'
const UP = 'railroad.up'

const repairsPanel = (page: Page) => page.locator('[data-repairs-panel]')
const waitingView = (page: Page) => page.locator('[data-waiting-view]')
const runningLine = (page: Page) => page.locator('[data-repairs-running-line]')
const billNote = (page: Page) => page.locator('[data-repairs-bill-note]')
const sendButton = (page: Page) => page.locator('[data-repairs-panel] button.send')
const sellOne = (page: Page, railroadId: string) =>
    page.locator(`[data-repairs-entry="${railroadId}"] button.pp-button`)
const sellButtons = (page: Page) => page.locator('[data-repairs-entry] button.pp-button')
const rowChip = (page: Page, playerId: string) =>
    page.locator(`[data-repairs-row] [data-repairs-seat="${playerId}"]`)
const repairsRow = (page: Page) => page.locator('[data-repairs-row]')
// A row chip's words, spaces collapsed: "You bill $2 · paid $2 ✓".
const chipText = (page: Page, playerId: string) =>
    rowChip(page, playerId).evaluate((chip) => (chip.textContent ?? '').replace(/\s+/g, ' ').trim())

async function playerOf(page: Page, seat: SeatName) {
    const playerId = await playerIdOf(page, seat)
    const player = (await facts(page)).players.find((held) => held.playerId === playerId)
    if (player === undefined) throw Error(`No player ${playerId}`)
    return player
}

// The lit Repairs town Southern Pacific track runs to, from the displayed state.
function litRepairsTown(page: Page): Promise<string> {
    return page.evaluate(() => {
        const session = window.promontoryPointTableSession
        const spaceId = session.boardOffer.lit.find(
            (candidate) => session.gameState.towns[candidate] === 'tile.red.hammer'
        )
        if (spaceId === undefined) throw Error('No lit Repairs town')
        return spaceId
    })
}

// R-4.2, R-4.3: Mara places SP on the Repairs town; returns the town.
async function placeOnRepairs(page: Page): Promise<string> {
    await press(turnPiece(page, 'SP'))
    const town = await litRepairsTown(page)
    await press(hexTarget(page, town))
    await expect(trackPiece(page, town)).toHaveCount(1)
    await settled(page)
    return town
}

// Mara's client on the table, her placement on the Repairs town made and sent to every other
// seat's client given.
async function maraPlacesOnRepairs(
    mara: Page,
    table: TableName,
    others: { page: Page; seat: SeatName }[]
): Promise<string> {
    await openTable(mara, table)
    await viewAs(mara, 'Mara')
    for (const { page, seat } of others) {
        await openTable(page, table)
        await viewAs(page, seat)
    }
    const town = await placeOnRepairs(mara)
    for (const { page } of others) await handOver(mara, page)
    return town
}

// The seat's money as its seat card reads it (desktop) or its seat-strip chip (phone).
function seatMoney(page: Page, width: Width, seat: SeatName) {
    return width.name === 'desktop'
        ? page.locator(`[aria-label="${seat}'s seat"] [data-seat-money]`)
        : page.locator('[data-seat-strip] button').filter({ hasText: seat })
}

// R-X.1: the seat is the one the state asks to decide: its card's "repairs" tag on desktop,
// its seat-strip chip marked active on a phone.
async function expectDecidingSeat(page: Page, width: Width, seat: SeatName) {
    const playerId = await playerIdOf(page, seat)
    if (width.name === 'desktop') {
        await expect(page.locator(`[aria-label="${seat}'s seat"] [data-seat-tag]`)).toHaveAttribute(
            'data-seat-tag',
            'repairs'
        )
    } else {
        await expect(page.locator(`[data-seat-chip="${playerId}"]`)).toHaveAttribute(
            'data-active',
            'true'
        )
    }
}

for (const width of WIDTHS) {
    test.describe(width.name, () => {
        test.use(width.use)

        test('scenario 16 (R-4.2, R-4.3, R-4.3-H1): with no one short every holder pays at once and play goes on; Undo reverses the placement and every payment', async ({
            page
        }) => {
            await openTable(page, 'Repairs all pay')
            const before = await facts(page)
            await press(turnPiece(page, 'SP'))
            const town = await litRepairsTown(page)
            await press(hexTarget(page, town))
            if (width.name === 'desktop') {
                // Each payer's loss rises from its seat card as the bill is paid.
                for (const change of ['-4', '-2', '-6']) {
                    await expect(page.locator(`[data-money-chip="${change}"]`)).toBeAttached()
                }
            }
            await settled(page)

            const paid = await facts(page)
            expect(paid.players.map((player) => player.money)).toEqual(
                before.players.map((player) => player.money - 2 * player.shares[SP])
            )
            // No stop: Mara places on, with no Repairs row and no seat asked to decide.
            expect(paid.machineState).toBe('Placing')
            expect(paid.activePlayerIds).toEqual([await playerIdOf(page, 'Mara')])
            await expect(header(page)).toHaveText('Your turn')
            await expect(repairsRow(page)).toHaveCount(0)
            await expect(turnPiece(page, 'CP')).toHaveCount(1)
            await expect(await history(page)).toContainText(
                'bills you $4, Royce $2, Ines $6, all paid'
            )

            await press(undoButton(page))
            await settled(page)
            const undone = await facts(page)
            expect(undone.players).toEqual(before.players)
            expect(undone.turnPieces).toEqual(before.turnPieces)
            await expect(trackPiece(page, town)).toHaveCount(0)
        })

        test('scenario 17 (R-4.3, R-4.3-H4, R-X.1): one short seat decides out of turn; every other seat waits on it', async ({
            page: mara,
            seatClient
        }) => {
            const royce = await seatClient()
            const ines = await seatClient()
            await maraPlacesOnRepairs(mara, 'Repairs one short', [
                { page: royce, seat: 'Royce' },
                { page: ines, seat: 'Ines' }
            ])
            const royceId = await playerIdOf(royce, 'Royce')

            // Royce decides out of Mara's turn: his header, his tag, his shares at half price.
            await expect(header(royce)).toHaveText('Your turn')
            await expectDecidingSeat(royce, width, 'Royce')
            await expect(repairsPanel(royce)).toContainText(
                'Mara placed SP on a Repairs town. You owe $10 (5 SP shares × $2) and have $7.'
            )
            await expect(royce.locator('[data-repairs-entry]')).toHaveCount(3)
            if (width.name === 'desktop') {
                await expect(royce.locator(`[data-repairs-entry="${SP}"]`)).toContainText(
                    'price $6 → $3 each'
                )
                await expect(royce.locator(`[data-repairs-entry="${CP}"]`)).toContainText(
                    'price $5 → $2 each'
                )
            }
            await expect(runningLine(royce)).toHaveText('Have $7 of $10 · short $3')

            // Mara and Ines read Royce's turn and wait on him; neither has a panel to decide.
            for (const watcher of [mara, ines]) {
                await expect(header(watcher)).toHaveText("Royce's turn")
                await expect(repairsPanel(watcher)).toHaveCount(0)
                await expect(waitingView(watcher)).toContainText(
                    'Repairs on Southern Pacific. Royce owes $10 and has $7, and is choosing shares to sell at half price.'
                )
                await expect(rowChip(watcher, royceId)).toHaveAttribute(
                    'data-repairs-state',
                    'Choosing'
                )
                await expect(rowChip(watcher, royceId)).toHaveClass(/deciding/)
            }
            await expect(waitingView(mara)).toContainText(
                'Your turn continues once the bill is paid.'
            )
            await expect(waitingView(ines)).toContainText(
                "Mara's turn continues once the bill is paid."
            )
            const maraId = await playerIdOf(mara, 'Mara')
            await expect.poll(() => chipText(mara, maraId)).toBe('You bill $2 · paid $2 ✓')
            await expect(rowChip(ines, await playerIdOf(ines, 'Tobias'))).toContainText('no shares')
        })

        test('scenario 18 (R-4.3, R-4.3-H1, R-4.3-H2, R-X.1): one staged SP sale covers the bill and locks every other Sell; Undo pops it; the send pays and Mara places on', async ({
            page: mara,
            seatClient
        }) => {
            const royce = await seatClient()
            await maraPlacesOnRepairs(mara, 'Repairs one short', [{ page: royce, seat: 'Royce' }])
            await expect(billNote(royce)).toContainText('Selling SP does not lower the bill')

            await press(sellOne(royce, SP))
            await expect(runningLine(royce)).toHaveText('Have $7 + sale $3 = $10 of $10 · enough')
            await expect(sellOne(royce, CP)).toBeDisabled()
            await expect(sellOne(royce, UP)).toBeDisabled()
            await expect(sellOne(royce, SP)).toBeDisabled()
            await expect(sendButton(royce)).toHaveText('Sell 1 SP share · pay $10')
            await expect(sendButton(royce)).toBeEnabled()
            // R-4.3-H1: the bill was fixed when the piece arrived.
            await expect(billNote(royce)).toContainText('Selling SP does not lower the bill')

            await press(undoButton(royce))
            await expect(runningLine(royce)).toHaveText('Have $7 of $10 · short $3')
            await expect(sellButtons(royce)).toHaveCount(3)
            for (const railroadId of [SP, CP, UP])
                await expect(sellOne(royce, railroadId)).toBeEnabled()
            await expect(sendButton(royce)).toBeDisabled()

            await press(sellOne(royce, SP))
            const deckBefore = (await facts(royce)).deck[SP]
            await press(sendButton(royce))
            await settled(royce)
            const sent = await facts(royce)
            expect(sent.deck[SP]).toBe(deckBefore + 1)
            expect((await playerOf(royce, 'Royce')).money).toBe(0)
            expect((await playerOf(royce, 'Royce')).shares[SP]).toBe(4)
            await expect(seatMoney(royce, width, 'Royce')).toContainText('$0')
            await expect(header(royce)).toHaveText("Mara's turn")

            // Mara's turn continues where it stood.
            await handOver(royce, mara)
            await expect(header(mara)).toHaveText('Your turn')
            expect((await facts(mara)).machineState).toBe('Placing')
            await expect(turnPiece(mara, 'CP')).toHaveCount(1)
            await expect(turnPiece(mara, 'UP')).toHaveCount(1)
        })

        test('scenario 19 (R-4.3-H4): two short seats decide one at a time, the placing seat first; the second waits with no panel until the first sends', async ({
            page: mara,
            seatClient
        }) => {
            const ines = await seatClient()
            await maraPlacesOnRepairs(mara, 'Repairs two short', [{ page: ines, seat: 'Ines' }])
            const maraId = await playerIdOf(mara, 'Mara')
            const inesId = await playerIdOf(mara, 'Ines')
            const royceId = await playerIdOf(mara, 'Royce')

            // Mara, the placing seat and short, decides first.
            await expect(header(mara)).toHaveText('Your turn')
            await expect(repairsPanel(mara)).toContainText(
                'You owe $6 (3 SP shares × $2) and have $3.'
            )
            // Ines waits: "waiting" in the row, no panel, Mara's dashed chip deciding.
            await expect(header(ines)).toHaveText("Mara's turn")
            await expect(repairsPanel(ines)).toHaveCount(0)
            await expect(waitingView(ines)).toContainText(
                'Mara owes $6 and has $3, and is choosing shares to sell at half price.'
            )
            await expect(waitingView(ines)).toContainText(
                "Mara's turn continues once the bills are paid."
            )
            await expect(rowChip(ines, maraId)).toHaveAttribute('data-repairs-state', 'Choosing')
            await expect(rowChip(ines, royceId)).toHaveAttribute('data-repairs-state', 'Paid')
            await expect(rowChip(ines, inesId)).toHaveAttribute('data-repairs-state', 'Waiting')
            await expect.poll(() => chipText(ines, inesId)).toBe('You bill $4 · waiting')
            // The row reads from the placing seat in seat order.
            expect(
                await ines
                    .locator('[data-repairs-row] [data-repairs-seat]')
                    .evaluateAll((chips) =>
                        chips.map((chip) => chip.getAttribute('data-repairs-seat'))
                    )
            ).toEqual((await facts(ines)).turnOrder)

            await press(sellOne(mara, SP))
            await press(sellOne(mara, SP))
            await expect(sendButton(mara)).toHaveText('Sell 2 SP shares · pay $6')
            await press(sendButton(mara))
            await settled(mara)
            // Mara has paid; Ines now decides, so Mara waits on her.
            await expect(header(mara)).toHaveText("Ines's turn")
            await expect(repairsPanel(mara)).toHaveCount(0)
            await expect.poll(() => chipText(mara, maraId)).toBe('You bill $6 · paid $6 ✓')

            await handOver(mara, ines)
            await expect(header(ines)).toHaveText('Your turn')
            await expect(repairsPanel(ines)).toContainText(
                'You owe $4 (2 SP shares × $2) and have $1.'
            )
            await expect(rowChip(ines, inesId)).toHaveAttribute('data-repairs-state', 'Choosing')
            await expect(rowChip(ines, maraId)).toHaveAttribute('data-repairs-state', 'Paid')
        })

        test('scenario 20 (R-4.3-H3, R-X.1): a seat short after every sale stages them all in one press, still sends by its own press, ends at $0 and stays in the game', async ({
            page: mara,
            seatClient
        }) => {
            const royce = await seatClient()
            await maraPlacesOnRepairs(mara, 'Repairs short after everything', [
                { page: royce, seat: 'Royce' }
            ])
            const royceId = await playerIdOf(royce, 'Royce')
            const actionsAfterPlacing = await royce.evaluate(
                () => window.promontoryPointTableSession.actions.length
            )

            // R-X.1: nothing is sold or paid for him. He decides, and only his client can send.
            await expect(header(royce)).toHaveText('Your turn')
            await expect(runningLine(royce)).toHaveText('Have $1 of $8 · short $7')
            await expect(sendButton(royce)).toBeDisabled()
            await expect(repairsPanel(mara)).toHaveCount(0)
            await expect(header(mara)).toHaveText("Royce's turn")
            const waiting = await facts(royce)
            expect(waiting.machineState).toBe('PayingRepairs')
            expect(waiting.activePlayerIds).toEqual([royceId])

            // One press stages every share.
            await press(sellOne(royce, SP))
            await expect(sendButton(royce)).toHaveText('Sell all 4 · pay $5 · $3 forgiven')
            await expect(runningLine(royce)).toHaveText(
                'Have $1 + sales $4 = $5 of $8 · $3 forgiven'
            )
            await expect(sellOne(royce, SP)).toBeDisabled()
            // Staged is not sent: the state still waits on Royce's press.
            expect(
                await royce.evaluate(() => window.promontoryPointTableSession.actions.length)
            ).toBe(actionsAfterPlacing)
            expect((await facts(royce)).machineState).toBe('PayingRepairs')

            await press(sendButton(royce))
            await settled(royce)
            const paid = await playerOf(royce, 'Royce')
            expect(paid.money).toBe(0)
            expect(paid.shares[SP]).toBe(0)
            const sent = await royce.evaluate(() => {
                const action = window.promontoryPointTableSession.actions.at(-1)
                return { type: action?.type, playerId: action?.playerId }
            })
            expect(sent).toEqual({ type: 'PayRepairs', playerId: royceId })

            // He stays in the game: still in the turn order, his seat at $0, Mara places on.
            await handOver(royce, mara)
            const table = await facts(mara)
            expect(table.turnOrder).toContain(royceId)
            expect(table.machineState).toBe('Placing')
            await expect(header(mara)).toHaveText('Your turn')
            await expect(seatMoney(mara, width, 'Royce')).toContainText('$0')
            await expect(await history(mara)).toContainText(
                'sold all (4 SP) at half price ($4), paid $5, $3 forgiven'
            )
        })

        test("scenario 21 (R-X.2, R-4.3): while Royce stages a sale, Mara's Undo reverses the placement and the Repairs step; Royce's panel closes and his staged sales are gone", async ({
            page: mara,
            seatClient
        }) => {
            const royce = await seatClient()
            const before = await (async () => {
                await openTable(mara, 'Repairs one short')
                return facts(mara)
            })()
            await viewAs(mara, 'Mara')
            await openTable(royce, 'Repairs one short')
            await viewAs(royce, 'Royce')
            const town = await placeOnRepairs(mara)
            await handOver(mara, royce)

            await press(sellOne(royce, SP))
            await expect(sendButton(royce)).toHaveText('Sell 1 SP share · pay $10')

            // Mara, waiting on Royce, takes her placement back.
            await expect(header(mara)).toHaveText("Royce's turn")
            await press(undoButton(mara))
            await settled(mara)
            const undone = await facts(mara)
            expect(undone.machineState).toBe(before.machineState)
            expect(undone.players).toEqual(before.players)
            expect(undone.turnPieces).toEqual(before.turnPieces)
            await expect(trackPiece(mara, town)).toHaveCount(0)
            await expect(header(mara)).toHaveText('Your turn')

            await handOver(mara, royce)
            await expect(repairsPanel(royce)).toHaveCount(0)
            await expect(repairsRow(royce)).toHaveCount(0)
            await expect(header(royce)).toHaveText("Mara's turn")
            expect(
                await royce.evaluate(() => window.promontoryPointTableSession.repairsDraft)
            ).toBeUndefined()
            await expect(trackPiece(royce, town)).toHaveCount(0)

            // Placed again, the new Repairs step opens on Royce's panel with nothing staged.
            await placeOnRepairs(mara)
            await handOver(mara, royce)
            await expect(runningLine(royce)).toHaveText('Have $7 of $10 · short $3')
            await expect(sendButton(royce)).toBeDisabled()
        })

        test('scenario 22 (R-4.3, R-X.1): no other seat sees the staged sales before the send; after it the log names them', async ({
            page: mara,
            seatClient
        }) => {
            const royce = await seatClient()
            const ines = await seatClient()
            await maraPlacesOnRepairs(mara, 'Repairs one short', [
                { page: royce, seat: 'Royce' },
                { page: ines, seat: 'Ines' }
            ])

            await press(sellOne(royce, SP))
            await expect(sendButton(royce)).toHaveText('Sell 1 SP share · pay $10')

            // The game as it stands while Royce stages reaches every other client: no sale in it.
            await handOver(royce, mara)
            await handOver(royce, ines)
            for (const watcher of [mara, ines]) {
                const table = await facts(watcher)
                expect(table.machineState).toBe('PayingRepairs')
                expect((await playerOf(watcher, 'Royce')).shares[SP]).toBe(5)
                expect((await playerOf(watcher, 'Royce')).money).toBe(7)
                await expect(waitingView(watcher)).toContainText('is choosing shares to sell')
                await expect(waitingView(watcher)).not.toContainText('sold')
                await expect(rowChip(watcher, await playerIdOf(watcher, 'Royce'))).toContainText(
                    'choosing shares to sell'
                )
                const log = await history(watcher)
                await expect(log).toContainText('Royce is selling')
                await expect(log).not.toContainText('Royce sold')
            }

            await press(sendButton(royce))
            await settled(royce)
            for (const watcher of [mara, ines]) {
                await handOver(royce, watcher)
                await expect(await history(watcher)).toContainText(
                    'sold 1 SP at half price ($3) and paid $10'
                )
            }
        })
    })
}

import { expect, test, type Locator, type Page } from '@playwright/test'
import { BORDER_TRACK_SPACES, boxCentre } from '../src/lib/utils/boardGeometry.js'
import {
    WIDTHS,
    board,
    facts,
    failOnPageErrors,
    header,
    hexTarget,
    history,
    lit,
    openTable,
    placeOnOpenCountry,
    playerIdOf,
    press,
    settled,
    shareEntry,
    trackPiece,
    turnPiece,
    undoButton,
    type SeatName
} from './support/table.js'

// docs/ui-interaction-visual-contract.md, "Verification scenarios", Board, panels and history
// (23, 26–31; 24, 25, 32 and 33 are checked by hand, see the contract's exercise record).
test.describe.configure({ mode: 'parallel' })
failOnPageErrors()

type Width = (typeof WIDTHS)[number]

const UP = 'railroad.up'
const MARA = 'p1'
// The palette's amber, var(--pp-accent).
const AMBER = 'rgb(245, 165, 36)'

const enlarged = (page: Page) => page.locator('[data-enlarged-view]')
const openSeat = (page: Page) => page.locator('[data-open-seat]')
const turnPieces = (page: Page) => page.locator('[aria-label="Turn pieces"]')
const flightCopies = (page: Page) => page.locator('[data-flight-layer] [data-flight]')
const historyButton = (page: Page, name: 'step backwards' | 'go to current') =>
    page.getByRole('button', { name, exact: true }).locator('visible=true')
const viewingHistory = (page: Page) =>
    page.evaluate(() => window.promontoryPointTableSession.isViewingHistory)

// One turn's entry in the log, by its turn number.
const turnEntry = (log: Locator, turnNumber: number) =>
    log.locator('.turn').filter({
        has: log.page().locator('.turn-number', { hasText: new RegExp(`^Turn ${turnNumber}$`) })
    })

// The seat's money as its seat card reads it (desktop) or its seat-strip chip (phone).
function seatMoney(page: Page, width: Width, seat: SeatName): Locator {
    return width.name === 'desktop'
        ? page.locator(`[aria-label="${seat}'s seat"] [data-seat-money]`)
        : page.locator('[data-seat-strip] button').filter({ hasText: seat })
}

// The seat as a seat card: the card in the side column on a desktop, the bottom sheet the seat
// strip opens on a phone.
async function seatCard(page: Page, width: Width, seat: SeatName): Promise<Locator> {
    if (width.name === 'desktop')
        return page.locator(`[data-seat-cards] [aria-label="${seat}'s seat"]`)
    const playerId = await playerIdOf(page, seat)
    await press(page.locator(`[data-seat-chip="${playerId}"]`))
    await expect(openSeat(page)).toHaveAttribute('data-open-seat', playerId)
    return openSeat(page)
}

// Plays the turn player's turn through the session, placing on the last lit hex or setting a
// piece aside, then ends it. Only for setting up turns the scenario does not look at.
async function playTurnThroughSession(page: Page): Promise<void> {
    await page.evaluate(async () => {
        const session = window.promontoryPointTableSession
        for (let step = 0; step < 6 && session.pickablePieces.length > 0; step++) {
            const railroadId = session.pickablePieces[0]
            if (session.pickedPiece !== railroadId) session.pressPiece(railroadId)
            if (session.pickedPieceHasNoRoom) await session.scrapTrack()
            else await session.placeTrack(session.boardOffer.lit[session.boardOffer.lit.length - 1])
            await session.waitForVisibleTransitionSettled()
        }
        await session.endTurn()
        await session.waitForVisibleTransitionSettled()
    })
}

// The lit town of the kind, from the displayed state.
function litTownOf(page: Page, kindId: string): Promise<string> {
    return page.evaluate((kindId) => {
        const session = window.promontoryPointTableSession
        const spaceId = session.boardOffer.lit.find(
            (candidate) => session.gameState.towns[candidate] === kindId
        )
        if (spaceId === undefined) throw Error(`No lit ${kindId} town`)
        return spaceId
    }, kindId)
}

async function placeOnTown(page: Page, tag: string, kindId: string): Promise<string> {
    await press(turnPiece(page, tag))
    const town = await litTownOf(page, kindId)
    await press(hexTarget(page, town))
    await expect(trackPiece(page, town)).toHaveCount(1)
    await settled(page)
    return town
}

// R-1.3-H1: where the marker rests alone on a border-track space.
function restingOn(space: number): string {
    const { x, y } = boxCentre(BORDER_TRACK_SPACES[space].box)
    return `translate(${x} ${y})`
}

// The border-track space nearest a point in map units.
function nearestSpace(point: { x: number; y: number }): number {
    let nearest = 0
    let best = Infinity
    for (const space of BORDER_TRACK_SPACES) {
        const centre = boxCentre(space.box)
        const distance = Math.hypot(centre.x - point.x, centre.y - point.y)
        if (distance < best) {
            best = distance
            nearest = space.value
        }
    }
    return nearest
}

// Records, every frame, where the seat's money marker is drawn: its resting place plus the
// offset its motion group stands away from it.
function traceMoneyMarker(page: Page, playerId: string): Promise<void> {
    return page.evaluate((playerId) => {
        const drawn: { x: number; y: number }[] = []
        const numbers = (value: string | null) =>
            (value?.match(/-?[\d.]+(?:e-?\d+)?/g) ?? []).map(Number)
        const record = () => {
            const marker = document.querySelector(`[data-money-marker="${playerId}"]`)
            const motion = marker?.querySelector(':scope > .motion')
            if (marker && motion) {
                const [restX, restY] = numbers(marker.getAttribute('transform'))
                const [offsetX, offsetY] = numbers(motion.getAttribute('transform'))
                drawn.push({ x: restX + (offsetX ?? 0), y: restY + (offsetY ?? 0) })
            }
            if (Reflect.get(window, 'promontoryPointTraceOn')) requestAnimationFrame(record)
        }
        Object.assign(window, { promontoryPointTrace: drawn, promontoryPointTraceOn: true })
        requestAnimationFrame(record)
    }, playerId)
}

async function tracedSpaces(page: Page): Promise<number[]> {
    const drawn = await page.evaluate(() => {
        Object.assign(window, { promontoryPointTraceOn: false })
        const trace: unknown = Reflect.get(window, 'promontoryPointTrace')
        return Array.isArray(trace) ? trace.map((point) => ({ x: point.x, y: point.y })) : []
    })
    const spaces = drawn.map(nearestSpace)
    return spaces.filter((space, index) => index === 0 || spaces[index - 1] !== space)
}

for (const width of WIDTHS) {
    test.describe(width.name, () => {
        test.use(width.use)

        test('scenario 23 (R-1.3-H1): money past 99 steps forward through 0 and shows "+100" by the marker; the seat card shows the true amount', async ({
            page
        }) => {
            await openTable(page, 'Money wrap')
            const marker = board(page).locator(`[data-money-marker="${MARA}"]`)
            await expect(marker).toHaveAttribute('transform', restingOn(97))
            await expect(marker).toHaveAttribute('data-plus-100', 'false')
            await expect(seatMoney(page, width, 'Mara')).toContainText('$97')

            await traceMoneyMarker(page, MARA)
            await press(shareEntry(page, 'Union Pacific').getByRole('button', { name: /^Sell/ }))
            await settled(page)
            await expect(marker).toHaveAttribute('transform', restingOn(2))
            expect(await tracedSpaces(page)).toEqual([97, 98, 99, 0, 1, 2])
            await expect(marker).toHaveAttribute('data-plus-100', 'true')
            await expect(marker.locator('text').filter({ hasText: '+100' })).toHaveCount(1)
            await expect(seatMoney(page, width, 'Mara')).toContainText('$102')
            expect((await facts(page)).players[0].money).toBe(102)

            await press(undoButton(page))
            await settled(page)
            await expect(marker).toHaveAttribute('transform', restingOn(97))
            await expect(marker).toHaveAttribute('data-plus-100', 'false')
            await expect(marker.locator('text').filter({ hasText: '+100' })).toHaveCount(0)
            await expect(seatMoney(page, width, 'Mara')).toContainText('$97')
        })

        test('scenario 26 (contract, "The principle"): a share stack, a deck and a town tile enlarge; the next press or Escape only closes', async ({
            page
        }) => {
            await openTable(page, 'Opening turn')
            const before = await facts(page)

            const royce = await seatCard(page, width, 'Royce')
            await press(royce.locator('[data-seat-share="railroad.cp"]'))
            await expect(enlarged(page)).toHaveAttribute('data-enlarged-view', 'Share')
            await expect(enlarged(page).getByRole('img')).toHaveAttribute(
                'alt',
                'Central Pacific share'
            )
            // Art plan: 300 px on a desktop, the screen less 32 px (up to 343) on a phone.
            const face = await enlarged(page).getByRole('img').boundingBox()
            const viewport = width.use.viewport.width
            expect(face?.width).toBeCloseTo(
                width.name === 'phone' ? Math.min(343, viewport - 32) : 300,
                0
            )
            await press(enlarged(page))
            await expect(enlarged(page)).toHaveCount(0)
            // The closing press did nothing else: the seat stays as it was, nothing changed.
            if (width.name === 'desktop') await expect(openSeat(page)).toHaveCount(0)
            else await expect(openSeat(page)).toBeVisible()
            if (width.name === 'phone') {
                await page.keyboard.press('Escape')
                await expect(openSeat(page)).toHaveCount(0)
            }

            await page.locator('[data-deck-target="railroad.kp"]').dispatchEvent('click')
            await expect(enlarged(page).getByRole('img')).toHaveAttribute(
                'alt',
                'Kansas Pacific share'
            )
            await press(enlarged(page))
            await expect(enlarged(page)).toHaveCount(0)

            const town = await page.evaluate(() => {
                const state = window.promontoryPointTableSession.gameState
                const spaceId = Object.keys(state.towns).find(
                    (candidate) => !(candidate in state.track)
                )
                if (spaceId === undefined) throw Error('An open town')
                return spaceId
            })
            await hexTarget(page, town).dispatchEvent('click')
            await expect(enlarged(page)).toHaveAttribute('data-enlarged-view', 'TownTile')
            await page.keyboard.press('Escape')
            await expect(enlarged(page)).toHaveCount(0)

            expect(await facts(page)).toEqual(before)
            expect(await lit(page)).toEqual([])
        })

        test('scenario 27 (contract, "Open seat"): a seat opens over the table, a share inside enlarges above it, and Escape closes one layer at a time', async ({
            page
        }) => {
            await openTable(page, 'Opening turn')
            const playerId = await playerIdOf(page, 'Ines')
            if (width.name === 'desktop') {
                await press(page.getByRole('button', { name: "Open Ines's seat", exact: true }))
            } else {
                await press(page.locator(`[data-seat-chip="${playerId}"]`))
            }
            await expect(openSeat(page)).toHaveAttribute('data-open-seat', playerId)
            await expect(openSeat(page)).toContainText('Money this turn')
            await page.keyboard.press('Escape')
            await expect(openSeat(page)).toHaveCount(0)

            if (width.name === 'desktop') {
                await press(page.getByRole('button', { name: "Open Ines's seat", exact: true }))
            } else {
                await press(page.locator(`[data-seat-chip="${playerId}"]`))
            }
            await press(openSeat(page).locator('[data-seat-share="railroad.up"]'))
            await expect(enlarged(page)).toHaveAttribute('data-enlarged-view', 'Share')
            // The enlarged share is drawn above the open seat: its middle belongs to the share.
            const box = await enlarged(page).getByRole('img').boundingBox()
            if (box === null) throw Error('The enlarged share has a box')
            const onTop = await page.evaluate(
                ({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[data-enlarged-view]'),
                { x: box.x + box.width / 2, y: box.y + box.height / 2 }
            )
            expect(onTop).toBe(true)
            await page.keyboard.press('Escape')
            await expect(enlarged(page)).toHaveCount(0)
            await expect(openSeat(page)).toBeVisible()
            await page.keyboard.press('Escape')
            await expect(openSeat(page)).toHaveCount(0)
        })

        test('scenario 28 (R-2.1, R-2.2): each turn is one entry growing line by line, under its round', async ({
            page
        }) => {
            await openTable(page, 'Towns in reach')
            const log = await history(page)
            const rows = (turnNumber: number) => turnEntry(log, turnNumber).locator('.rows > li')
            await expect(log.locator('.round')).toHaveCount(1)

            await placeOnTown(page, 'CP', 'tile.red.dividend')
            await expect(rows(1)).toHaveCount(1)
            await expect(rows(1).first()).toContainText('Dividend pays')
            await placeOnOpenCountry(page, 'UP')
            await expect(rows(1)).toHaveCount(2)
            await placeOnOpenCountry(page, 'KP')
            await expect(rows(1)).toHaveCount(3)
            await press(page.getByRole('button', { name: 'End turn · draw 3', exact: true }))
            await settled(page)
            await expect(rows(1)).toHaveCount(4)
            await expect(turnEntry(log, 1)).toHaveCount(1)
            // The hotseat harness now views as Royce: his entry opens with his revealed hand.
            await expect(turnEntry(log, 2).locator('.rows > li').first()).toContainText('revealed')
            await expect(turnEntry(log, 2)).toContainText('playing')

            for (let turn = 2; turn <= 4; turn++) await playTurnThroughSession(page)
            // Newest round first; the first round holds the four seats' turns in seat order.
            await expect(log.locator('.round')).toHaveCount(2)
            await expect(log.locator('.round-head')).toHaveText(['Round 2', 'Round 1'])
            const second = log.locator('.round').nth(0)
            await expect(second.locator('.turn')).toHaveCount(1)
            await expect(turnEntry(second, 5)).toContainText('playing')
            const first = log.locator('.round').nth(1)
            await expect(first.locator('.turn .turn-number')).toHaveText([
                'Turn 4',
                'Turn 3',
                'Turn 2',
                'Turn 1'
            ])
        })

        test('scenario 28 (R-2.2): Jump on a turn shows the table as it ended, with no panel and no lit hex', async ({
            page
        }) => {
            await openTable(page, 'Opening turn')
            for (const tag of ['CP', 'KP', 'KP']) await placeOnOpenCountry(page, tag)
            await press(page.getByRole('button', { name: 'End turn · draw 3', exact: true }))
            await settled(page)
            const ended = await facts(page)
            await page.evaluate(async () => {
                const session = window.promontoryPointTableSession
                session.pressPiece(session.pickablePieces[0])
                await session.placeTrack(session.boardOffer.lit[0])
                await session.waitForVisibleTransitionSettled()
                session.pressPiece(session.pickablePieces[0])
            })
            const live = await facts(page)
            expect(Object.keys(live.track)).toHaveLength(4)
            expect(await lit(page)).not.toEqual([])

            const log = await history(page)
            await press(turnEntry(log, 1).getByRole('button', { name: 'Jump' }))
            await expect.poll(() => viewingHistory(page)).toBe(true)
            await settled(page)
            expect((await facts(page)).track).toEqual(ended.track)
            const shown = await facts(page)
            expect(shown.players.map((player) => player.money)).toEqual(
                ended.players.map((player) => player.money)
            )
            await expect(turnPieces(page)).toHaveCount(0)
            expect(await lit(page)).toEqual([])

            await press(historyButton(page, 'go to current'))
            await expect.poll(() => viewingHistory(page)).toBe(false)
            await settled(page)
            expect((await facts(page)).track).toEqual(live.track)
            await expect(turnPieces(page)).toBeVisible()
        })

        test('scenario 28 (R-2.2, R-4.2): Replay plays the turn’s placements and payments, then returns to the table as it stands', async ({
            page
        }) => {
            await openTable(page, 'Towns in reach')
            const town = await placeOnTown(page, 'CP', 'tile.red.dividend')
            await placeOnOpenCountry(page, 'UP')
            await placeOnOpenCountry(page, 'KP')
            await press(page.getByRole('button', { name: 'End turn · draw 3', exact: true }))
            await settled(page)
            const live = await facts(page)
            expect(live.players[0].money).toBe(24)

            // Every frame, Mara's money and whether the Dividend town holds its piece.
            await page.evaluate((town) => {
                const seen: string[] = []
                const record = () => {
                    const session = window.promontoryPointTableSession
                    const shown = `${session.gameState.players[0].money} ${town in session.gameState.track}`
                    if (seen.at(-1) !== shown) seen.push(shown)
                    if (Reflect.get(window, 'promontoryPointTraceOn')) requestAnimationFrame(record)
                }
                Object.assign(window, { promontoryPointTrace: seen, promontoryPointTraceOn: true })
                requestAnimationFrame(record)
            }, town)

            const log = await history(page)
            const entry = turnEntry(log, 1)
            await press(entry.getByRole('button', { name: 'Replay' }))
            await expect(entry.locator('.replaying-tag')).toBeVisible()
            await expect(entry.locator('.replaying-tag')).toHaveCount(0, { timeout: 20_000 })
            await expect.poll(() => viewingHistory(page)).toBe(false)
            await settled(page)
            const shown = await page.evaluate(() => {
                Object.assign(window, { promontoryPointTraceOn: false })
                const trace: unknown = Reflect.get(window, 'promontoryPointTrace')
                return Array.isArray(trace) ? trace.map(String) : []
            })
            // From the table as it stands, back to the turn's start, the Dividend placement and
            // its payment, and back again.
            expect(shown[0]).toBe('24 true')
            expect(shown).toContain('20 false')
            expect(shown.indexOf('24 true', 1)).toBeGreaterThan(shown.indexOf('20 false'))
            expect(shown.at(-1)).toBe('24 true')
            expect(await facts(page)).toEqual(live)
        })

        test('scenario 28 (R-4.3, R-X.1): History View during a Repairs keeps the Repairs row and the outline, with no panel and no lit hex', async ({
            page
        }) => {
            await openTable(page, 'Repairs one short')
            const town = await placeOnTown(page, 'SP', 'tile.red.hammer')
            const royceId = await playerIdOf(page, 'Royce')
            // The harness decides for whoever the state asks: Royce sells one SP and pays.
            const sellSp = page.locator('[data-repairs-entry="railroad.sp"] button.pp-button')
            // Each width shows its own label only, as drawn: buttons are set in caps.
            expect(
                await sellSp.evaluate((button) =>
                    (button instanceof HTMLElement ? button.innerText : '')
                        .replace(/\s+/g, ' ')
                        .trim()
                )
            ).toBe(width.name === 'desktop' ? 'SELL ONE +$3' : 'SP ×5 +$3 EACH')
            await press(sellSp)
            await press(page.locator('[data-repairs-panel] button.send'))
            await settled(page)
            await expect(page.locator('[data-repairs-panel]')).toHaveCount(0)
            await press(turnPiece(page, 'CP'))
            expect(await lit(page)).not.toEqual([])

            await press(historyButton(page, 'step backwards'))
            await expect.poll(() => viewingHistory(page)).toBe(true)
            await settled(page)
            await expect(page.locator('[data-waiting-view]')).toBeVisible()
            await expect(
                page.locator(`[data-repairs-row] [data-repairs-seat="${royceId}"]`)
            ).toBeVisible()
            await expect(trackPiece(page, town)).toHaveCount(1)
            await expect(board(page).locator('[data-placement-order="1"]')).toHaveCount(1)
            await expect(page.locator('[data-repairs-panel]')).toHaveCount(0)
            await expect(turnPieces(page)).toHaveCount(0)
            expect(await lit(page)).toEqual([])

            await press(historyButton(page, 'go to current'))
            await expect.poll(() => viewingHistory(page)).toBe(false)
            await expect(turnPieces(page)).toBeVisible()
        })

        test('scenario 29 (R-6.1, R-6.1-H1, R-6.2, R-6.2-H1): covering the next to last red tile with Promontory taken ends the game; the score names both tied leaders in amber', async ({
            page
        }) => {
            await openTable(page, 'Two red tiles left')
            const tracker = board(page).locator('[data-end-tracker]')
            await expect(tracker).toHaveAttribute('data-red-tiles-uncovered', '2')
            await expect(tracker).toHaveAttribute('data-promontory-taken', 'true')
            await placeOnTown(page, 'CP', 'tile.red.dividend')
            await expect(tracker).toHaveAttribute('data-red-tiles-uncovered', '1')
            await placeOnOpenCountry(page, 'UP')
            await placeOnOpenCountry(page, 'KP')
            await expect(header(page)).not.toHaveText('End of game')
            await press(page.getByRole('button', { name: 'End turn · draw 3', exact: true }))
            await settled(page)

            await expect(header(page)).toHaveText('End of game')
            const score = page.locator('[data-score]')
            await expect(score.locator('[data-score-winners]')).toContainText('Mara')
            await expect(score.locator('[data-score-winners]')).toContainText('Royce')
            await expect(score.locator('[data-score-winners]')).toContainText('win with $34.')
            await expect(score.locator('[data-score-reason]')).toContainText(
                'Promontory is taken and at most one red tile is uncovered'
            )
            await expectScoreRows(page, [
                ['Mara', '$24', '$10', '$34', true],
                ['Royce', '$29', '$5', '$34', true],
                ['Tobias', '$14', '$5', '$19', false],
                ['Ines', '$12', '$5', '$17', false]
            ])
            await expect(undoButton(page)).toHaveCount(0)
        })

        test('scenario 29 (R-6.1-H2, R-6.2): a draw that empties the bag ends the game the same way, with one winner', async ({
            page
        }) => {
            await openTable(page, 'Bag running out')
            for (const tag of ['CP', 'UP', 'KP']) await placeOnOpenCountry(page, tag)
            await press(page.getByRole('button', { name: 'End turn · draw 2', exact: true }))
            await settled(page)

            await expect(header(page)).toHaveText('End of game')
            const score = page.locator('[data-score]')
            await expect(score.locator('[data-score-winners]')).toHaveText(
                /^\s*Ines\s+wins with \$51\.\s*$/
            )
            await expect(score.locator('[data-score-reason]')).toContainText('The bag is empty')
            await expectScoreRows(page, [
                ['Ines', '$31', '$20', '$51', true],
                ['Mara', '$20', '$20', '$40', false],
                ['Royce', '$20', '$20', '$40', false],
                ['Tobias', '$20', '$20', '$40', false]
            ])
        })

        test('scenario 30 (O-2, R-X.2): Undo unpicks the piece, then undoes the second placement, the first and the buy; after the end-turn draw Undo is hidden', async ({
            page
        }) => {
            // A three-piece hand auto-picks its last railroad (scenario 8), so the walk needs the
            // variant's four pieces for a pick after two placements.
            await openTable(page, 'Variant opening turn')
            await press(shareEntry(page, 'Union Pacific').getByRole('button', { name: /^Buy/ }))
            await settled(page)
            const first = await placeOnOpenCountry(page, 'CP')
            const second = await placeOnOpenCountry(page, 'UP')
            await press(turnPiece(page, 'KP'))
            await expect(turnPiece(page, 'KP')).toHaveAttribute('aria-pressed', 'true')
            expect(await lit(page)).not.toEqual([])

            await press(undoButton(page))
            await expect(turnPiece(page, 'KP')).toHaveAttribute('aria-pressed', 'false')
            expect(await lit(page)).toEqual([])
            expect((await facts(page)).placementsMade).toBe(2)

            await press(undoButton(page))
            await settled(page)
            await expect(trackPiece(page, second)).toHaveCount(0)
            await expect(trackPiece(page, first)).toHaveCount(1)
            expect((await facts(page)).placementsMade).toBe(1)

            await press(undoButton(page))
            await settled(page)
            await expect(trackPiece(page, first)).toHaveCount(0)
            const unplaced = await facts(page)
            expect(unplaced.placementsMade).toBe(0)
            expect(unplaced.players[0].money).toBe(15)

            await press(undoButton(page))
            await settled(page)
            expect((await facts(page)).players[0].money).toBe(20)
            expect((await facts(page)).players[0].shares[UP]).toBe(1)
            await expect(undoButton(page)).toHaveCount(0)

            for (const tag of ['CP', 'UP', 'KP']) await placeOnOpenCountry(page, tag)
            await expect(undoButton(page)).toBeVisible()
            await press(page.getByRole('button', { name: 'Keep SP · draw 3', exact: true }))
            await settled(page)
            await expect(undoButton(page)).toHaveCount(0)
        })

        test('scenario 31 (R-3.3): history waits while a piece flies; a step back then shows the earlier table at once, with no piece in flight and nothing hidden', async ({
            page
        }) => {
            await openTable(page, 'Opening turn')
            await press(turnPiece(page, 'CP'))
            const [target] = await lit(page)
            const before = await facts(page)
            await press(hexTarget(page, target))
            await expect(flightCopies(page)).toHaveCount(1)

            // The shared history controls are disabled while a state transition plays, so a
            // step back pressed during the flight changes nothing and the piece lands.
            expect(
                await page.evaluate(() => window.promontoryPointTableSession.history.isDisabled())
            ).toBe(true)
            await press(historyButton(page, 'step backwards'))
            expect(await viewingHistory(page)).toBe(false)
            await expect(flightCopies(page)).toHaveCount(0)
            await expect(trackPiece(page, target)).toHaveCount(1)
            await settled(page)

            // Every frame from here on: the most pieces and shares in flight at once.
            await page.evaluate(() => {
                const most = { copies: 0 }
                const record = () => {
                    most.copies = Math.max(
                        most.copies,
                        document.querySelectorAll('[data-flight-layer] [data-flight]').length
                    )
                    if (Reflect.get(window, 'promontoryPointTraceOn')) requestAnimationFrame(record)
                }
                Object.assign(window, { promontoryPointTrace: most, promontoryPointTraceOn: true })
                requestAnimationFrame(record)
            })
            await press(historyButton(page, 'step backwards'))
            await expect.poll(() => viewingHistory(page)).toBe(true)
            await expect(trackPiece(page, target)).toHaveCount(0)
            await settled(page)
            expect((await facts(page)).track).toEqual(before.track)
            // Nothing a flight would hide stays hidden.
            const hidden = await page.evaluate(
                () =>
                    [
                        ...document.querySelectorAll<HTMLElement | SVGElement>(
                            '[data-turn-piece] svg, [data-hand-piece], [data-seat-share] img, [data-share-deck] image'
                        )
                    ].filter((node) => node.style.visibility === 'hidden').length
            )
            expect(hidden).toBe(0)

            await press(historyButton(page, 'go to current'))
            await expect.poll(() => viewingHistory(page)).toBe(false)
            await settled(page)
            await expect(trackPiece(page, target)).toHaveCount(1)
            const most = await page.evaluate(() => {
                Object.assign(window, { promontoryPointTraceOn: false })
                return Number(Reflect.get(Reflect.get(window, 'promontoryPointTrace'), 'copies'))
            })
            expect(most).toBe(0)
        })
    })
}

// The score table's rows, winner first: seat, money, shares at final prices, total, and
// whether the row is the winner's, drawn in amber.
async function expectScoreRows(
    page: Page,
    rows: [SeatName, string, string, string, boolean][]
): Promise<void> {
    const table = page.locator('[data-score] [data-score-row]')
    await expect(table).toHaveCount(rows.length)
    for (const [index, [seat, money, shares, total, winner]] of rows.entries()) {
        const row = table.nth(index)
        await expect(row.locator('td.seat')).toContainText(seat)
        const cells = await row.locator('td').allTextContents()
        expect(cells[1]).toBe(money)
        expect(cells.at(-2)).toBe(shares)
        expect(cells.at(-1)).toBe(total)
        const colour = await row
            .locator('td.total')
            .evaluate((cell) => getComputedStyle(cell).color)
        if (winner) expect(colour).toBe(AMBER)
        else expect(colour).not.toBe(AMBER)
    }
}

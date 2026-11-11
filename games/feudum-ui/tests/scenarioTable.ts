import { expect, test, type Locator, type Page } from '@playwright/test'
import type { ActionType } from '@tabletop/feudum'
import type { FixturePage } from '../src/lib/testing/fixtureTablePage.js'

declare global {
    interface Window {
        feudumFixture: FixturePage
    }
}

/**
 * A contract scenario on the real table, at both of the contract's widths: desktop by the mouse, the
 * phone (375 x 812) by touch. Its table comes from a named fixture; every press goes where a seat
 * presses, and what a scenario reads it reads off the page.
 */

const Widths = {
    desktop: { viewport: { width: 1280, height: 900 } },
    phone: { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true },
    /** The phone held sideways, for the scenarios the contract also runs at 812 x 375. */
    sideways: { viewport: { width: 812, height: 375 }, hasTouch: true, isMobile: true }
} as const

export type Width = keyof typeof Widths

/** The page, by what a scenario's sentences name. */
export class ScenarioTable {
    constructor(
        readonly page: Page,
        readonly phone: boolean
    ) {}

    readonly panel = () => this.page.locator('[data-action-panel]')
    readonly primary = () => this.panel().locator('[data-primary]')
    readonly undo = () => this.page.getByRole('button', { name: 'Undo', exact: true })
    readonly popup = () => this.page.locator('[data-board-popup]')
    readonly lit = () => this.page.locator('[data-board-surface] [data-pick-role="lit"]')
    readonly count = () => this.panel().locator('[data-hand-count]')

    readonly turnLine = () => this.panel().locator('[data-turn-line]')
    readonly flowLine = () => this.panel().locator('[data-flow-line]')
    readonly waitingLine = () => this.panel().locator('[data-waiting]')
    readonly notes = () => this.panel().locator('[data-note-line]')
    readonly picked = () => this.panel().locator('[data-cards] [data-row][data-picked]')
    readonly stacksLit = () =>
        this.page.locator('[data-board-surface] [data-pick^="stack:"][data-pick-role="lit"]')

    /** A card of the hand or the draft, by its face's press. */
    card(label: string): Locator {
        return this.panel().locator(`[data-cards] [data-row="${label}"]`).locator('button').first()
    }

    /** A row of one block of the panel. */
    rowIn(block: string, label: string): Locator {
        return this.panel()
            .locator(`[data-rows="${block}"] [data-row="${label}"]`)
            .locator('button')
            .first()
    }

    /** A primary of the panel, where it shows more than one. */
    primaryNamed(label: string): Locator {
        return this.primary().filter({ hasText: label })
    }

    /** Presses each card of the draft or the hand in turn. */
    async pressCards(...labels: readonly string[]): Promise<void> {
        for (const label of labels) {
            await this.press(this.card(label))
        }
    }

    /** The map's rest has stepped back from what is lit. */
    async mapDims(): Promise<boolean> {
        return this.page
            .locator('[data-board-surface] g[opacity]:not([data-unused])')
            .evaluateAll((groups) =>
                groups.some((group) => Number(group.getAttribute('opacity')) < 1)
            )
    }

    /** Which of the board's pieces now stand, of those named so. */
    piecesNamed(prefix: string): Promise<string[]> {
        return this.page
            .locator(`[data-world^="${prefix}"]`)
            .evaluateAll((pieces) => pieces.map((piece) => piece.getAttribute('data-world') ?? ''))
    }

    /** Where a piece of the board stands now: its world placement. */
    placeOf(piece: string): Promise<string | null> {
        return this.page.locator(`[data-world="${piece}"]`).getAttribute('transform')
    }

    /** A row of the panel, or of what it asks beside itself, by its whole label. */
    row(label: string): Locator {
        return this.panel().locator(`[data-row="${label}"]`).locator('button').first()
    }

    /** A row of the panel whose label starts so: the goods' counts follow the haversack. */
    rowStarting(label: string): Locator {
        return this.panel().locator(`[data-row^="${label}"]`).locator('button').first()
    }

    /** A board target, at rest: what a seat presses, once the board has framed it. */
    pick(target: string): Locator {
        return this.page.locator(`[data-board-surface] [data-pick="${target}"]`)
    }

    popupRow(label: string): Locator {
        return this.popup().locator(`[data-row="${label}"]`).locator('button').first()
    }

    popupRowStarting(label: string): Locator {
        return this.popup().locator(`[data-row^="${label}"]`).locator('button').first()
    }

    /** Whatever the last press or send set off has finished. */
    async settled(): Promise<void> {
        await this.page.evaluate(() => window.feudumFixture.settled())
    }

    /** A press, then whatever it set off has finished. By touch on the phone. */
    async press(target: Locator): Promise<void> {
        await (this.phone ? target.tap() : target.click())
        await this.settled()
    }

    /** A target on the board: on the phone a pick frames it first, so it waits for the board. */
    async pressPick(target: string): Promise<void> {
        await this.boardAtRest()
        await this.press(this.pick(target).locator('[role="button"]').first())
    }

    /** A row that only looks disabled takes the press, to say why. */
    async pressDimmed(target: Locator): Promise<void> {
        await (this.phone ? target.tap({ force: true }) : target.click({ force: true }))
        await this.settled()
    }

    /** Waits out a view's animation: the board stands still across two reads. */
    async boardAtRest(): Promise<void> {
        const surface = this.page.locator('[data-board-surface]')
        let last = ''
        await expect
            .poll(
                async () => {
                    const now = JSON.stringify(await surface.boundingBox())
                    const still = now === last
                    last = now
                    return still
                },
                { intervals: [120] }
            )
            .toBe(true)
    }

    /** Another seat, in another browser, sends this. This browser hears, as it would. */
    async another(playerId: string, move: Record<string, unknown> & { type: ActionType }) {
        await this.page.evaluate(([id, sent]) => window.feudumFixture.host.send(id, sent), [
            playerId,
            move
        ] as const)
        await this.settled()
    }

    /** Spaces lit at this moment, and each chip they carry, by target. */
    async litChips(): Promise<Record<string, string>> {
        return Object.fromEntries(
            await this.lit().evaluateAll((picks) =>
                picks.map((pick) => [
                    pick.getAttribute('data-pick') ?? '',
                    // A chip drawn as art is named by its words, not its pieces.
                    pick.querySelector('[data-chip]')?.getAttribute('aria-label') ??
                        pick.querySelector('[data-chip]')?.textContent?.trim() ??
                        ''
                ])
            )
        )
    }

    /** A seat's panel, where this width holds it: the side column, or the sheet its chip opens. */
    async seatPanel(playerId: string): Promise<Locator> {
        if (!this.phone) {
            return this.page.locator(`[data-seat-column] [data-seat-panel="${playerId}"]`)
        }
        await this.press(this.page.locator(`[data-seat-chip="${playerId}"]`))
        return this.page.locator(`[data-open-seat="${playerId}"] [data-seat-panel="${playerId}"]`)
    }

    /** Closes what `seatPanel` opened on the phone. */
    async closeSeatPanel(): Promise<void> {
        if (this.phone) {
            await this.page.keyboard.press('Escape')
            await expect(this.page.locator('[data-open-seat]')).toHaveCount(0)
        }
    }

    /** How many of a good a seat's panel says it holds. */
    /** The seats the game waits on, as the host has them. */
    activeSeats(): Promise<readonly string[]> {
        return this.page.evaluate(() => window.feudumFixture.host.state.activePlayerIds)
    }

    async goodsHeld(playerId: string, good: string): Promise<number> {
        const panel = await this.seatPanel(playerId)
        const held = await panel.locator(`[data-supply-good="${good}"]`).textContent()
        await this.closeSeatPanel()
        return Number(held?.replace(/\D/g, ''))
    }

    /** This seat's browser shows from here on. */
    async showSeat(playerId: string): Promise<void> {
        await this.page.evaluate((id) => window.feudumFixture.show(id), playerId)
        await this.settled()
    }

    /**
     * What a press set moving, from every painted frame until the table settles: each flight's row and
     * what it reads as ("goods: food"), each token the board flew ("token: good") and each board piece
     * that moved ("board: score:p1"). A flight's
     * path is proved in its own spec; this proves the scenario's Action set it off.
     */
    async flightsOf(press: () => Promise<void>): Promise<string[]> {
        await this.page.evaluate(() => {
            const seen = new Map<string, string>()
            Object.assign(window, { feudumFlightsSeen: seen })
            const sample = () => {
                for (const copy of document.querySelectorAll('[data-flight]')) {
                    const label = copy.querySelector('[aria-label]')?.getAttribute('aria-label')
                    seen.set(
                        copy.getAttribute('data-flight') ?? '',
                        `${copy.getAttribute('data-flight-row')}: ${label ?? ''}`
                    )
                }
                for (const token of document.querySelectorAll('[data-transient]')) {
                    const id = token.getAttribute('data-transient')
                    seen.set(`token-${id}`, `token: ${token.getAttribute('data-token')}`)
                }
                for (const piece of document.querySelectorAll('[data-motion]')) {
                    if (piece.getAttribute('transform') || piece.getAttribute('style')) {
                        const name = piece.getAttribute('data-motion')
                        seen.set(`board-${name}`, `board: ${name}`)
                    }
                }
                if (Reflect.get(window, 'feudumFlightsSeen') === seen) {
                    requestAnimationFrame(sample)
                }
            }
            requestAnimationFrame(sample)
        })
        await press()
        return this.page.evaluate(() => {
            const seen = Reflect.get(window, 'feudumFlightsSeen')
            Object.assign(window, { feudumFlightsSeen: undefined })
            return seen instanceof Map ? [...seen.values()].map(String).sort() : []
        })
    }
}

/** Opens a named fixture on the page. A name that is no fixture throws here, with the loader's words. */
export async function openFixture(page: Page, name: string): Promise<void> {
    await page.goto('/')
    await page.addScriptTag({
        type: 'module',
        content: `import { openFixture } from '/src/lib/testing/fixtureTablePage.ts'
            try {
                await openFixture(${JSON.stringify(name)})
                document.body.dataset.fixtureOpen = ''
            } catch (error) {
                document.body.dataset.fixtureError = error.message
            }`
    })
    await page.waitForSelector('body[data-fixture-open], body[data-fixture-error]', {
        timeout: 45_000
    })
    const refused = await page.locator('body').getAttribute('data-fixture-error')
    if (refused !== null) {
        throw new Error(refused)
    }
}

/**
 * One numbered scenario, at both widths (or those named), on its fixture. A page error or the
 * session's own "Error applying" or "Error handling" fails it, whatever it asserted.
 */
export function scenario(
    title: string,
    fixture: string,
    body: (table: ScenarioTable) => Promise<void>,
    widths: readonly Width[] = ['desktop', 'phone']
): void {
    for (const width of widths) {
        test.describe(width, () => {
            test.use(Widths[width])
            test(title, async ({ page }) => {
                const problems: string[] = []
                page.on('pageerror', (error) => problems.push(error.message))
                page.on('console', (message) => {
                    if (/Error (applying|handling)/.test(message.text())) {
                        problems.push(message.text())
                    }
                })
                await openFixture(page, fixture)
                await body(new ScenarioTable(page, width !== 'desktop'))
                expect(problems).toEqual([])
            })
        })
    }
}

import { expect, test } from '@playwright/test'
import { ActionType } from '@tabletop/feudum'
import { openFixture, scenario, ScenarioTable } from './scenarioTable.js'

/** The contract's hand selection scenarios, on the real table at both widths. */

const FourCards = ['Move', 'Tax', 'Guild', 'Harvest'] as const
const AnotherHand = ['tax', 'guild', 'harvest', 'migrate']
const Finalise = "Long live the king · finalise · can't be undone"

scenario('S4 R-3.1-H1 Draft and finalise in any order', 'hands-second-sulfur', async (table) => {
    await table.pressCards(...FourCards)
    await table.press(table.rowStarting('Sulfur'))
    await expect(table.primary()).toHaveAccessibleName(Finalise)
    await expect(table.primary()).toBeEnabled()

    await table.another('p1', {
        type: ActionType.FinaliseHand,
        revealsInfo: true,
        cards: ['move', 'tax', 'guild', 'harvest', 'migrate'],
        pouchGood: 'saltpeter'
    })
    await expect(table.picked()).toHaveCount(4)
    const ana = table.panel().locator('[data-finalise-seat="Ana"]')
    await expect(ana).toHaveAttribute('data-finalised')
    await expect(ana).not.toContainText('saltpeter')
    await expect(table.primary()).toHaveAccessibleName(Finalise)
    await expect(table.primary()).toBeEnabled()
})

scenario('S5 R-3.3 Saltpeter count', 'hands-first-saltpeter', async (table) => {
    await table.pressCards(...FourCards)
    await expect(table.page.locator('[data-empty-pouch]')).toHaveCount(0)
    await table.press(table.rowStarting('Saltpeter'))
    await expect(table.rowStarting('Saltpeter')).toHaveAttribute('aria-pressed', 'true')
    await expect(table.count()).toHaveText('4 of 5')
    await expect(table.primary()).toHaveCount(0)
    await table.pressCards('Migrate')
    await expect(table.count()).toHaveText('5 of 5')
    await expect(table.primary()).toBeEnabled()
    // R-3.3 A second press on the chosen good clears it.
    await table.press(table.rowStarting('Saltpeter'))
    await expect(table.rowStarting('Saltpeter')).toHaveAttribute('aria-pressed', 'false')
    await expect(table.count()).toHaveText('5 of 4')
    await expect(table.primary()).toHaveCount(0)
    await table.press(table.undo())
    await expect(table.count()).toHaveText('5 of 5')
    await expect(table.primary()).toBeEnabled()
})

scenario('S6 R-3.3 Pouch from barrel refused', 'hands-barrel-sulfur', async (table) => {
    // Contract, Hand selection: a pouch good the seat can't commit is not drawn, and no line
    // says why.
    await expect(table.panel().locator('[data-cards="draft"]')).toBeVisible()
    await expect(table.panel().locator('[data-row^="Sulfur"]')).toHaveCount(0)
    await expect(table.panel().locator('[data-pouch-reason]')).toHaveCount(0)
    await expect(table.panel().getByText("Barrel sulfur can't go in the pouch.")).toHaveCount(0)
})

scenario('S7 R-3.13-H1 Conquer warning', 'hands-first-saltpeter', async (table) => {
    await expect(table.panel().locator('[data-warning]')).toHaveCount(0)
    await table.pressCards('Conquer', 'Move', 'Tax', 'Guild')
    await expect(table.panel().locator('[data-warning]')).toHaveText('Conquer last is forfeited.')
    await expect(table.primary()).toHaveAccessibleName(Finalise)
    await expect(table.primary()).toBeEnabled()
})

scenario(
    'S8 R-3.1, R-3.1-H1 Finalise is a barrier; pouches are told together',
    'hands-first-sulfur',
    async (table) => {
        await table.pressCards(...FourCards)
        await table.press(table.rowStarting('Sulfur'))
        await expect(table.primary()).toHaveAccessibleName(Finalise)
        await table.press(table.primary())
        await expect(table.undo()).toHaveCount(0)
        await expect(table.waitingLine()).toHaveText('Waiting on Bram and Cleo.')
        // Contract, Hand selection: tray A holds the hand as set and the pouch sealed; the seats
        // still choosing are the ones waited on. No seat is next: the header names the step.
        const set = table.panel().locator('[data-hand-set]')
        await expect(set.locator('[data-set-card]')).toHaveCount(4)
        await expect(set.locator('[data-set-pouch="sulfur"]')).toBeVisible()
        await expect(table.panel().locator('[data-awaited]')).toHaveCount(2)
        await expect(table.panel().locator('[data-round-lead]')).toHaveText(/^Round \d+$/)
        await expect(table.page.locator('[data-table-header]')).toHaveText('Hand set')
        if (table.phone) {
            await expect(table.page.locator('[data-hand-sheet]')).toHaveCount(1)
        } else {
            // The line stands beside the tray.
            const tray = await set.boundingBox()
            const line = await table.waitingLine().boundingBox()
            expect(line && tray && line.x).toBeGreaterThan((tray?.x ?? 0) + (tray?.width ?? 0))
        }
        const own = await table.seatPanel('p1')
        await expect(own.locator('[data-pouch="committed"]')).toHaveAttribute(
            'data-pouch-good',
            'sulfur'
        )
        await expect(own.locator('[data-pouch="committed"] [aria-label="sealed"]')).toHaveCount(1)
        await table.closeSeatPanel()

        await table.showSeat('p2')
        // Another seat, still choosing, sees no seat waited on and no tray set.
        await expect(table.panel().locator('[data-awaited]')).toHaveCount(0)
        await expect(table.panel().locator('[data-hand-set]')).toHaveCount(0)
        await expect(table.page.locator('[data-table-header]')).toHaveText('Your turn')
        const before = await table.seatPanel('p1')
        await expect(before.locator('[data-pouch-good]')).toHaveCount(0)
        await expect(before.locator('[data-pouch="sealed"]')).toHaveText('')
        await expect(before.locator('[data-pouch="sealed"] [aria-label="sealed"]')).toHaveCount(1)
        await expect(before.locator('[data-hand-backs="4"]')).toHaveCount(0)
        await table.closeSeatPanel()

        for (const playerId of ['p2', 'p3']) {
            await table.another(playerId, {
                type: ActionType.FinaliseHand,
                revealsInfo: true,
                cards: AnotherHand
            })
        }
        const after = await table.seatPanel('p1')
        await expect(after.locator('[data-hand-backs="4"]')).toBeVisible()
        await expect(after.locator('[data-pouch="finalised"]')).toHaveAttribute(
            'data-pouch-good',
            'sulfur'
        )
        await table.closeSeatPanel()
        // R-3.1-H1 One line tells every pouch good, and the seats without one.
        await table.press(table.page.getByRole('tab', { name: 'History' }))
        await expect(table.page.locator('[data-history-list]')).toContainText(
            'All finalised · pouch goods revealed: Ana sulfur 2 in a row · You, Cleo: none'
        )

        // A step back across the reveal shows the pouch sealed at once, and a step forward shows the
        // good at once: with no Action to tell, nothing turns, either way. (The desk's history
        // controls stand beside the seat column.)
        if (table.phone) return
        await table.press(table.page.getByRole('tab', { name: 'Players' }))
        const panel = await table.seatPanel('p1')
        await expect(panel.locator('[data-pouch="finalised"]')).toHaveCount(1)
        const turns = async (step: () => Promise<void>) => {
            await table.page.evaluate(() => {
                const seen: string[] = []
                Object.assign(window, { feudumPouchTurns: seen })
                const until = performance.now() + 900
                const look = () => {
                    for (const pouch of document.querySelectorAll('[data-seat-section="pouch"]')) {
                        const holder = pouch.parentElement
                        const animations = holder?.getAnimations({ subtree: true }) ?? []
                        if (animations.length > 0) seen.push('animation')
                        if (holder instanceof HTMLElement && holder.style.transform) {
                            seen.push(holder.style.transform)
                        }
                    }
                    if (performance.now() < until) requestAnimationFrame(look)
                }
                requestAnimationFrame(look)
            })
            await step()
            await table.page.waitForTimeout(1000)
            return table.page.evaluate(
                () => (window as unknown as { feudumPouchTurns: string[] }).feudumPouchTurns
            )
        }
        expect(
            await turns(() => table.page.getByRole('button', { name: 'step backwards' }).click())
        ).toEqual([])
        await expect(panel.locator('[data-pouch-good]')).toHaveCount(0)
        expect(
            await turns(() => table.page.getByRole('button', { name: 'go to current' }).click())
        ).toEqual([])
        await expect(panel.locator('[data-pouch="finalised"]')).toHaveCount(1)
    }
)

scenario('S9 R-3.1-H1 Draft survives a reconciliation', 'hands-second-sulfur', async (table) => {
    await table.pressCards(...FourCards)
    await expect(table.picked()).toHaveCount(4)
    await table.page.evaluate(
        async (move) => {
            window.feudumFixture.host.sendUnheard('p1', move)
            await window.feudumFixture.host.reconcile('p2')
        },
        { type: ActionType.FinaliseHand, revealsInfo: true, cards: AnotherHand }
    )
    await expect(table.picked()).toHaveCount(4)
    await expect(table.count()).toHaveText('4 of 4')
    await expect(table.panel().locator('[data-finalise-seat="Ana"]')).toHaveAttribute(
        'data-finalised'
    )

    await table.press(table.primary())
    await table.another('p3', {
        type: ActionType.FinaliseHand,
        revealsInfo: true,
        cards: AnotherHand
    })
    await table.page.evaluate(() => window.feudumFixture.forfeitRound())
    await table.settled()
    await expect(table.count()).toHaveText('0 of 4')
    await expect(table.picked()).toHaveCount(0)
})

declare global {
    interface Window {
        feudumPouchWatch?: { readonly before: string[]; readonly observer: MutationObserver }
    }
}

/**
 * The rotateY of every style the step writes to the seat's pouch, in order, and its transform once
 * settled. A MutationObserver keeps each write's previous value, so every write is seen whatever
 * the frame timing.
 */
async function pouchTurn(table: ScenarioTable, playerId: string, step: () => Promise<void>) {
    await table.page.evaluate((id) => {
        const before: string[] = []
        const isPouch = (node: Node) =>
            node instanceof HTMLElement &&
            node.closest(`[data-seat-panel="${id}"]`) !== null &&
            node.querySelector(':scope > [data-seat-section="pouch"]') !== null
        const observer = new MutationObserver((records) => {
            for (const record of records) {
                if (isPouch(record.target)) {
                    before.push(record.oldValue ?? '')
                }
            }
        })
        observer.observe(document.body, {
            subtree: true,
            attributeFilter: ['style'],
            attributeOldValue: true
        })
        window.feudumPouchWatch = { before, observer }
    }, playerId)
    await step()
    await table.settled()
    return table.page.evaluate((id) => {
        const pouch = document.querySelector(
            `[data-seat-panel="${id}"] [data-seat-section="pouch"]`
        )?.parentElement
        const watch = window.feudumPouchWatch
        if (!pouch || !watch) {
            return { turns: [], left: 'no pouch' }
        }
        for (const record of watch.observer.takeRecords()) {
            if (record.target === pouch) {
                watch.before.push(record.oldValue ?? '')
            }
        }
        watch.observer.disconnect()
        const written = [...watch.before.slice(1), pouch.getAttribute('style') ?? '']
        const turns = written.flatMap((style) => {
            const turned = style.match(/rotateY\((-?[\d.]+)deg\)/)
            return turned ? [Number(turned[1])] : []
        })
        return { turns, left: pouch.style.transform }
    }, playerId)
}

/** R-3.1-H1 Every hand final but the last seat's, with this seat's pouch shown. */
async function beforeTheLastFinalise(table: ScenarioTable) {
    await table.pressCards(...FourCards)
    await table.press(table.rowStarting('Sulfur'))
    await table.press(table.primary())
    await table.another('p2', {
        type: ActionType.FinaliseHand,
        revealsInfo: true,
        cards: AnotherHand
    })
    return table.seatPanel('p1')
}

const lastFinalise = (table: ScenarioTable) =>
    table.another('p3', { type: ActionType.FinaliseHand, revealsInfo: true, cards: AnotherHand })

/** Edge on at the first write, through the turn, flat at the end, and nothing left on the element. */
function expectTurned({ turns, left }: { turns: number[]; left: string }) {
    expect(turns.length).toBeGreaterThan(3)
    expect(turns[0]).toBe(90)
    expect(turns.some((degrees) => degrees > 5 && degrees < 85)).toBe(true)
    expect(turns.slice(1).every((degrees, index) => degrees <= turns[index])).toBe(true)
    expect(Math.min(...turns)).toBeLessThan(5)
    expect(left).toBe('')
}

const Seats = {
    desk: { viewport: { width: 1440, height: 900 } },
    phone: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }
} as const

for (const [width, use] of Object.entries(Seats)) {
    test.describe(`the pouch turn on a ${width}`, () => {
        test.use(use)
        const problems: string[] = []
        test.beforeEach(({ page }) => {
            problems.length = 0
            page.on('pageerror', (error) => problems.push(error.message))
        })
        test.afterEach(() => expect(problems).toEqual([]))

        test(`R-3.1-H1 the last finalise turns the pouch over on the seat panel, and History's animated step forward turns it again`, async ({
            page
        }) => {
            await openFixture(page, 'hands-first-sulfur')
            const table = new ScenarioTable(page, width === 'phone')
            const panel = await beforeTheLastFinalise(table)
            await expect(panel.locator('[data-pouch="committed"]')).toHaveCount(1)
            const live = await pouchTurn(table, 'p1', () => lastFinalise(table))
            await expect(panel.locator('[data-pouch="finalised"]')).toHaveCount(1)
            expectTurned(live)

            // A step back across the reveal, then the step forward with its Action, as Shift and the
            // step forwards button play it: the pouch turns as it did live.
            const control = (label: string) => page.locator(`button[aria-label="${label}"]`).first()
            const shown = panel.locator('[data-pouch="finalised"]')
            for (let steps = 0; steps < 3 && (await shown.count()) > 0; steps += 1) {
                await control('step backwards').dispatchEvent('click')
                await table.settled()
            }
            await expect(shown).toHaveCount(0)
            const replayed = await pouchTurn(table, 'p1', async () => {
                await control('step forwards').dispatchEvent('click', { shiftKey: true })
            })
            await expect(panel.locator('[data-pouch="finalised"]')).toHaveCount(1)
            expectTurned(replayed)
        })

        test('R-3.1-H1 with reduced motion the pouch shows its good at once: nothing turns', async ({
            page
        }) => {
            await page.emulateMedia({ reducedMotion: 'reduce' })
            await openFixture(page, 'hands-first-sulfur')
            const table = new ScenarioTable(page, width === 'phone')
            const panel = await beforeTheLastFinalise(table)
            const still = await pouchTurn(table, 'p1', () => lastFinalise(table))
            await expect(panel.locator('[data-pouch="finalised"]')).toHaveAttribute(
                'data-pouch-good',
                'sulfur'
            )
            expect(still).toEqual({ turns: [], left: '' })
        })
    })
}

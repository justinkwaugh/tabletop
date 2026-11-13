import { expect } from '@playwright/test'
import { ActionType } from '@tabletop/feudum'
import { scenario } from './scenarioTable.js'

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
    await expect(table.primary()).toBeDisabled()
    await table.pressCards('Migrate')
    await expect(table.count()).toHaveText('5 of 5')
    await expect(table.primary()).toBeEnabled()
    // R-3.3 A second press on the chosen good clears it.
    await table.press(table.rowStarting('Saltpeter'))
    await expect(table.rowStarting('Saltpeter')).toHaveAttribute('aria-pressed', 'false')
    await expect(table.count()).toHaveText('5 of 4')
    await expect(table.primary()).toBeDisabled()
    await table.press(table.undo())
    await expect(table.count()).toHaveText('5 of 5')
    await expect(table.primary()).toBeEnabled()
})

scenario('S6 R-3.3 Pouch from barrel refused', 'hands-barrel-sulfur', async (table) => {
    const sulfur = table.rowStarting('Sulfur')
    await expect(sulfur).toHaveAttribute('aria-disabled', 'true')
    // Contract, Hand selection: it says why in place of what it does; a phone, without that line,
    // in one line under the pair, before any press.
    const why = "Barrel sulfur can't go in the pouch."
    const reason = table.panel().locator('[data-pouch-reason]')
    if (table.phone) await expect(reason).toContainText(`2 in a row · ${why}`)
    else {
        await expect(sulfur.locator('[data-pouch-caption]')).toHaveText(why)
        await expect(reason).toBeHidden()
    }
    await table.pressDimmed(sulfur)
    await expect(table.panel().locator('[data-refusal]')).toHaveCount(0)
    await expect(table.panel().locator('[data-row^="Sulfur"][data-picked]')).toHaveCount(0)
})

scenario('S7 R-3.13-H1 Conquer warning', 'hands-first-saltpeter', async (table) => {
    await expect(table.panel().locator('[data-warning]')).toHaveCount(0)
    await table.pressCards('Conquer', 'Move', 'Tax', 'Guild')
    await expect(table.panel().locator('[data-warning]')).toHaveText(
        'Conquer may end up your last card; it would be forfeited.'
    )
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
        await expect(table.waitingLine()).toHaveText('Waiting for Bram and Cleo to finalise')
        // No seat is next: the header names the step, not a seat's turn.
        await expect(table.page.locator('[data-table-header]')).toHaveText('Choosing hands')
        const own = await table.seatPanel('p1')
        await expect(own.locator('[data-pouch="committed"]')).toHaveAttribute(
            'data-pouch-good',
            'sulfur'
        )
        await table.closeSeatPanel()

        await table.showSeat('p2')
        const before = await table.seatPanel('p1')
        await expect(before.locator('[data-pouch-good]')).toHaveCount(0)
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

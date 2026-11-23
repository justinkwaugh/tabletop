import { expect, type Locator } from '@playwright/test'
import { scenario, type ScenarioTable } from './scenarioTable.js'

/** The contract's looking layers over the board: the Key and Supply cards, the site card, Escape. */

const keyToggle = (table: ScenarioTable) => table.page.locator('[data-symbol-key-toggle]')
const supplyToggle = (table: ScenarioTable) => table.page.locator('[data-supply-toggle]')
const keyCard = (table: ScenarioTable) => table.page.locator('#feudum-symbol-key')
const supplyCard = (table: ScenarioTable) => table.page.locator('#feudum-supply')
const siteCard = (table: ScenarioTable) => table.page.locator('[data-site-card]')

/** An unlit location disc whose press the view shows whole, so a tap reaches it on a phone. */
async function siteInView(table: ScenarioTable): Promise<Locator> {
    const view = await table.page.locator('[data-board-view]').boundingBox()
    for (const disc of await table.page.locator('[data-open-site]').all()) {
        const box = await disc.boundingBox()
        if (
            view &&
            box &&
            box.x >= view.x &&
            box.y >= view.y + 40 &&
            box.x + box.width <= view.x + view.width &&
            box.y + box.height <= view.y + view.height - 60
        ) {
            return disc
        }
    }
    throw new Error('No location disc stands whole in the board view')
}

scenario(
    'S79 Symbol key: its button opens and closes it, one card at a time',
    'cards-migrate',
    async (table) => {
        await expect(keyToggle(table)).toHaveAttribute('aria-expanded', 'false')
        await table.press(keyToggle(table))
        await expect(keyCard(table)).toBeVisible()
        await expect(keyToggle(table)).toHaveAttribute('aria-expanded', 'true')
        await expect(keyCard(table)).toContainText('a cost or threat')
        await table.press(keyToggle(table))
        await expect(keyCard(table)).toHaveCount(0)

        await table.press(keyToggle(table))
        await table.press(supplyToggle(table))
        await expect(keyCard(table)).toHaveCount(0)
        await expect(supplyCard(table)).toBeVisible()
        await table.press(keyToggle(table))
        await expect(supplyCard(table)).toHaveCount(0)
        await expect(keyCard(table)).toBeVisible()
        await table.page.keyboard.press('Escape')
        await expect(keyCard(table)).toHaveCount(0)
        await expect(keyToggle(table)).toHaveAttribute('aria-expanded', 'false')
    }
)

scenario(
    'S80 Supply: a press on it or off it closes the card; a seat opened over the Key leaves the Key open beneath',
    'cards-migrate',
    async (table) => {
        await table.press(supplyToggle(table))
        await expect(supplyCard(table)).toBeVisible()
        await table.press(supplyCard(table).locator('[data-general-count]').first())
        await expect(supplyCard(table)).toHaveCount(0)

        await table.press(supplyToggle(table))
        await expect(supplyCard(table)).toBeVisible()
        await table.press(table.panel())
        await expect(supplyCard(table)).toHaveCount(0)

        // The Key coexists with an open seat, which stands over it; Escape closes the seat first.
        await table.press(keyToggle(table))
        const opener = table.phone
            ? table.page.locator('[data-seat-chip]').first()
            : table.page.locator('[data-open-seat-of]').first()
        await table.press(opener)
        await expect(table.page.locator('[data-open-seat]')).toBeVisible()
        await expect(keyCard(table)).toBeAttached()
        await table.page.keyboard.press('Escape')
        await expect(table.page.locator('[data-open-seat]')).toHaveCount(0)
        await expect(keyCard(table)).toBeVisible()
        await table.page.keyboard.press('Escape')
        await expect(keyCard(table)).toHaveCount(0)
    }
)

scenario(
    'S81 Site card: an unlit disc opens it; a second press, Escape, or an open seat closes it',
    'cards-migrate',
    async (table) => {
        const disc = await siteInView(table)
        const spaceId = await disc.getAttribute('data-open-site')
        await table.press(disc)
        await expect(siteCard(table)).toHaveAttribute('data-site-card', spaceId ?? '')
        await table.press(disc)
        if (!table.phone) {
            // The pressed card is closed; the pointer still over the disc shows it until it leaves.
            await table.panel().hover()
        }
        await expect(siteCard(table)).toHaveCount(0)

        await table.press(disc)
        await expect(siteCard(table)).toBeVisible()
        await table.page.keyboard.press('Escape')
        await expect(siteCard(table)).toHaveCount(0)

        await table.press(disc)
        await expect(siteCard(table)).toBeVisible()
        const opener = table.phone
            ? table.page.locator('[data-seat-chip]').first()
            : table.page.locator('[data-open-seat-of]').first()
        await table.press(opener)
        await expect(siteCard(table)).toHaveCount(0)
        await table.page.keyboard.press('Escape')
        await expect(table.page.locator('[data-open-seat]')).toHaveCount(0)
        await expect(siteCard(table)).toHaveCount(0)

        if (!table.phone) {
            // A desk pointer over the disc shows the card while it stays there.
            await disc.hover()
            await expect(siteCard(table)).toBeVisible()
            await table.panel().hover()
            await expect(siteCard(table)).toHaveCount(0)
        }
    }
)

scenario(
    'S83 Escape closes one layer at a time: an open seat or an enlarged piece before the guild side, a site card before the Key',
    'cards-migrate',
    async (table) => {
        const disc = await siteInView(table)
        await table.press(disc)
        await expect(siteCard(table)).toBeVisible()
        const west = table.page.locator('[data-guild-view="west"]')
        await table.press(table.page.locator('[data-guild-side="west"]'))
        await expect(west).toBeVisible()
        // A side opening closes the site card.
        await expect(siteCard(table)).toHaveCount(0)
        await table.press(table.page.locator('[data-open-seat-of]').first())
        const seat = table.page.locator('[data-open-seat]')
        await expect(seat).toBeVisible()
        await table.page.keyboard.press('Escape')
        await expect(seat).toHaveCount(0)
        await expect(west).toBeVisible()

        await west.locator('[data-enlarge="Merchant guild"]').click({ position: { x: 12, y: 12 } })
        const enlarged = table.page.locator('[data-enlarged]')
        await expect(enlarged).toBeVisible()
        await table.page.keyboard.press('Escape')
        await expect(enlarged).toHaveCount(0)
        await expect(west).toBeVisible()
        await table.page.keyboard.press('Escape')
        await expect(table.page.locator('[data-guild-view]')).toHaveCount(0)

        await table.press(disc)
        await expect(siteCard(table)).toBeVisible()
        await table.press(keyToggle(table))
        await table.page.keyboard.press('Escape')
        await expect(siteCard(table)).toHaveCount(0)
        await expect(keyCard(table)).toBeVisible()
        await table.page.keyboard.press('Escape')
        await expect(keyCard(table)).toHaveCount(0)
    },
    ['desktop']
)

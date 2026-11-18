import { expect, test, type Page } from '@playwright/test'
import {
    activePlayerId,
    board,
    collectPageErrors,
    flyersDuring,
    litHex,
    moneyOf,
    openScenario,
    pressHex,
    settled
} from './helpers.js'

// R-8 (Intercolonial, Greater Germany): a map's connection bonus shows in the turn line as the
// Transcontinental's twin, a dashed gold ring while open, and each link city wears a gold ring.
// The placement that first joins the link cities pays the bonus once: its gold coin flies to the
// chip, the chip turns claimed and the rings go. Desktop 1440 × 900, phone 390 × 844.
collectPageErrors()

function onPhone(): boolean {
    return test.info().project.use.hasTouch === true
}

const CASES = [
    {
        map: 'Canada',
        scenario: 'Canada link in reach',
        name: 'Intercolonial',
        amount: 8,
        cityBonus: 3,
        cities: 'Sault Ste. Marie, Windsor and Québec City',
        linkCities: 3,
        hex: 'Toronto: place Yellow, $3, $8 Intercolonial'
    },
    {
        map: 'Germany',
        scenario: 'Germany link in reach',
        name: 'Greater Germany',
        amount: 12,
        cityBonus: 3,
        cities: 'Berlin, Hamburg, Köln, Dresden and München',
        linkCities: 5,
        hex: 'Berlin: place Yellow, $3, $12 Greater Germany'
    }
] as const

async function open(page: Page, scenario: string) {
    await page.setViewportSize(
        onPhone() ? { width: 390, height: 844 } : { width: 1440, height: 900 }
    )
    await openScenario(page, scenario)
}

for (const bonus of CASES) {
    test(`${bonus.map}: the placement that joins the link cities claims ${bonus.name}`, async ({
        page
    }) => {
        await open(page, bonus.scenario)
        await expect(board(page)).toHaveAccessibleName(`Map of ${bonus.map}`)
        const playerId = (await activePlayerId(page)) ?? ''
        expect(playerId).toBe('p1')
        const money = (await moneyOf(page, playerId)) ?? 0

        // Open: the chip's dashed ring and terms, and a gold ring round each link city.
        const chip = page.getByRole('button', { name: new RegExp(`^${bonus.name}: `) })
        await expect(chip).toHaveAccessibleName(
            `${bonus.name}: unclaimed, $${bonus.amount} to the first network joining ${bonus.cities}`
        )
        await expect(chip).toBeInViewport()
        await expect(chip).toContainText(`$${bonus.amount}`)
        await expect(chip.locator('circle[stroke-dasharray]')).toHaveCount(1)
        const rings = board(page).locator('[data-link-ring]')
        await expect(rings).toHaveCount(bonus.linkCities)
        // The USA's Transcontinental is not on this map.
        await expect(page.getByRole('button', { name: /^Transcontinental: / })).toHaveCount(0)

        const flyers = await flyersDuring(page, () => pressHex(page, litHex(page, bonus.hex)))
        expect(flyers).toContain(`coin $${bonus.amount}`)
        expect(flyers).toContain('outline')
        await settled(page)
        expect(await moneyOf(page, playerId)).toBe(money + bonus.cityBonus + bonus.amount)

        // Claimed: the gold medallion with the amount and Ada's seat, and no rings.
        await expect(chip).toHaveAccessibleName(
            `${bonus.name}: claimed by Ada for $${bonus.amount}`
        )
        await expect(chip.locator('circle[stroke-dasharray]')).toHaveCount(0)
        await expect(chip.locator('text')).toHaveText(`$${bonus.amount}`)
        await expect(rings).toHaveCount(0)
    })
}

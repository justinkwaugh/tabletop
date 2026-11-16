import { expect, test, type Page } from '@playwright/test'
import { collectPageErrors, openScenario, settled } from './helpers.js'

// The contract's Seat card: the acting seat's card is ringed in its seat colour, 3 px drawn inside
// its edge, and the ring shows whole, on all four sides, inside the side panel (on a phone, the
// players drawer). The cards come in the order the phase under way is played.
collectPageErrors()

const onPhone = () => test.info().project.use.isMobile === true

type Edges = { left: number; top: number; right: number; bottom: number }

/** On a phone the side panel is a drawer off to the left: scroll the table to show it. */
async function openPlayers(page: Page) {
    if (!onPhone()) return
    await page.locator('.table-scroller').evaluate((scroller) => scroller.scrollTo({ left: 0 }))
    await expect
        .poll(() => page.locator('.table-scroller').evaluate((scroller) => scroller.scrollLeft))
        .toBe(0)
}

test('The acting first seat’s ring shows on all four sides inside the panel', async ({ page }) => {
    // Ada, first in turn order, places locomotives.
    await openScenario(page, 'First placement')
    await settled(page)
    await openPlayers(page)
    const first = page.locator('section[data-flight-target^="seat:"]').first()
    await expect(first).toHaveAccessibleName('Ada')
    await expect(first).toHaveClass(/\bacting\b/)

    const ring = await first.evaluate((card) => {
        const style = getComputedStyle(card)
        const shadow = style.boxShadow
        const spreads = [
            ...shadow.matchAll(/(?:^|,)\s*(?:rgba?\([^)]*\)\s*)?((?:-?[\d.]+px\s*){4})/g)
        ].map((match) => Number(match[1].trim().split(/\s+/)[3].replace('px', '')))
        const reach = shadow.includes('inset') ? 0 : Math.max(0, ...spreads)
        const box = card.getBoundingClientRect()
        const ringBox = {
            left: box.left - reach,
            top: box.top - reach,
            right: box.right + reach,
            bottom: box.bottom + reach
        }
        // Every ancestor that clips what overflows it, as the area it shows.
        const clips: { left: number; top: number; right: number; bottom: number }[] = []
        for (let element = card.parentElement; element; element = element.parentElement) {
            const own = getComputedStyle(element)
            if (own.overflowX === 'visible' && own.overflowY === 'visible') continue
            const rect = element.getBoundingClientRect()
            const left = rect.left + element.clientLeft
            const top = rect.top + element.clientTop
            clips.push({
                left,
                top,
                right: left + element.clientWidth,
                bottom: top + element.clientHeight
            })
        }
        return { shadow, spreads, ringBox, clips }
    })
    test.info().annotations.push({ type: 'ring', description: ring.shadow })
    // A ring of the seat's colour, 3 px wide, inside the card's edge.
    expect(ring.shadow).toContain('inset')
    expect(ring.shadow).toContain(
        await first.evaluate((card) => {
            const probe = document.createElement('span')
            probe.style.color = 'var(--seat)'
            card.append(probe)
            const colour = getComputedStyle(probe).color
            probe.remove()
            return colour
        })
    )
    expect(ring.spreads).toEqual([3])
    // Drawn whole: nothing that holds the card cuts any side of it.
    const ringBox: Edges = ring.ringBox
    for (const clip of ring.clips) {
        expect(ringBox.left).toBeGreaterThanOrEqual(clip.left - 0.5)
        expect(ringBox.top).toBeGreaterThanOrEqual(clip.top - 0.5)
        expect(ringBox.right).toBeLessThanOrEqual(clip.right + 0.5)
        expect(ringBox.bottom).toBeLessThanOrEqual(clip.bottom + 0.5)
    }
})

/** The seat cards' names, top to bottom. */
function seatOrder(page: Page): Promise<string[]> {
    return page
        .locator('section[data-flight-target^="seat:"]')
        .evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label') ?? ''))
}

test('The seat cards follow the phase: reverse turn order for shares, turn order to build', async ({
    page
}) => {
    // R-2.2: shares are taken in reverse turn order, so Dell's card leads.
    await openScenario(page, 'First share')
    await expect.poll(() => seatOrder(page)).toEqual(['Dell', 'Cora', 'Ben', 'Ada'])
    const dell = page.getByRole('region', { name: 'Dell', exact: true })
    await expect(dell).toHaveClass(/\bacting\b/)
    // Six share slots, one a round, all empty; no turn position, no count, no caption.
    await expect(dell.locator('.slots .slot')).toHaveCount(6)
    await expect(dell.locator('.slots .empty')).toHaveCount(6)
    const text = (await dell.textContent())?.replace(/\s+/g, ' ').trim()
    expect(text).toMatch(/^Dell \$\d+$/)

    // R-2.3: building goes in turn order.
    await openScenario(page, 'First placement')
    await expect.poll(() => seatOrder(page)).toEqual(['Ada', 'Ben', 'Cora', 'Dell'])
    const ada = page.getByRole('region', { name: 'Ada', exact: true })
    await expect(ada.locator('.slots .slot')).toHaveCount(6)
    await expect(ada.getByRole('group', { name: 'Shares' }).getByRole('button')).toHaveCount(1)
    await expect(ada.locator('.slots .empty')).toHaveCount(5)
})

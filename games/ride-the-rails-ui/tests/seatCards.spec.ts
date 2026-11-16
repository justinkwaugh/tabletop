import { expect, test, type Page } from '@playwright/test'
import { collectPageErrors, openScenario, settled } from './helpers.js'

// The contract's Seat card: the acting seat's card is ringed in the accent colour, and the ring
// shows whole, on all four sides, inside the side panel (on a phone, the players drawer).
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
    await expect(first).toHaveAccessibleName(/^Ada, 1st$/)
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
    // A ring of the accent colour, 3 px wide, with its 1.5 px halo.
    expect(ring.shadow).toContain(
        await first.evaluate((card) => {
            const probe = document.createElement('span')
            probe.style.color = 'var(--rtr-accent)'
            card.append(probe)
            const colour = getComputedStyle(probe).color
            probe.remove()
            return colour
        })
    )
    expect(ring.spreads).toEqual([3, 4.5])
    // Drawn whole: nothing that holds the card cuts any side of it.
    const ringBox: Edges = ring.ringBox
    for (const clip of ring.clips) {
        expect(ringBox.left).toBeGreaterThanOrEqual(clip.left - 0.5)
        expect(ringBox.top).toBeGreaterThanOrEqual(clip.top - 0.5)
        expect(ringBox.right).toBeLessThanOrEqual(clip.right + 0.5)
        expect(ringBox.bottom).toBeLessThanOrEqual(clip.bottom + 0.5)
    }
})

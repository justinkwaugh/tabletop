import { expect, test, type Page } from '@playwright/test'
import { collectPageErrors, openScenario } from './helpers.js'

// The contract's Turn header: rounds I to VI in the turn line on wider screens, each ticket
// filled with the colour of the railroads its round makes available (R-2.1, R-1.4), beside the
// Transcontinental chip and Undo, on one line.
collectPageErrors()

const onPhone = () => test.info().project.use.isMobile === true

function tickets(page: Page) {
    return page.getByRole('list', { name: 'Rounds' })
}

function ticket(page: Page, name: string) {
    return tickets(page).getByRole('listitem', { name, exact: true })
}

type Paint = { colours: string[]; ink: string; outline: string; width: number; height: number }

/** A ticket's fill colours (one, or each part of a split), its numeral's colour and its ring. */
function paintOf(page: Page, name: string): Promise<Paint> {
    return ticket(page, name).evaluate((item) => {
        const style = getComputedStyle(item)
        const box = item.getBoundingClientRect()
        const image = style.backgroundImage
        return {
            colours:
                image && image !== 'none'
                    ? (image.match(/rgba?\([^)]*\)/g) ?? [])
                    : [style.backgroundColor],
            ink: style.color,
            outline:
                style.outlineStyle === 'none'
                    ? 'none'
                    : `${style.outlineWidth} ${style.outlineColor}`,
            width: box.width,
            height: box.height
        }
    })
}

/** A palette token's colour as the page computes it. */
function tokenColour(page: Page, token: string): Promise<string> {
    return tickets(page).evaluate((list, name) => {
        const probe = document.createElement('span')
        probe.style.color = `var(${name})`
        list.append(probe)
        const colour = getComputedStyle(probe).color
        probe.remove()
        return colour
    }, token)
}

test('Each round ticket is filled with the colour its round adds, round I split Red and Blue', async ({
    page
}) => {
    test.skip(onPhone(), 'Phones show no round tickets.')
    await openScenario(page, 'First share')
    const colour = (token: string) => tokenColour(page, `--rtr-${token}`)
    const roundOne = await paintOf(page, 'Round 1, Red and Blue arrive')
    // Two halves, Red then Blue, left to right: two stops of each colour.
    expect(roundOne.colours).toEqual([
        await colour('railroad-red'),
        await colour('railroad-red'),
        await colour('railroad-blue'),
        await colour('railroad-blue')
    ])
    expect(roundOne.ink).toBe(await colour('ink-light'))
    for (const [name, railroad] of [
        ['Round 2, Orange arrives', 'orange'],
        ['Round 3, Yellow arrives', 'yellow'],
        ['Round 4, Purple arrives', 'purple'],
        ['Round 5, Black arrives', 'black']
    ]) {
        const paint = await paintOf(page, name)
        expect(paint.colours, name).toEqual([await colour(`railroad-${railroad}`)])
        expect(paint.ink, name).toBe(await colour(`railroad-${railroad}-ink`))
    }
    // Round VI adds no railroad: the plain light ticket.
    expect((await paintOf(page, 'Round 6')).colours).toEqual([await colour('panel-raised')])
    for (const name of ['Round 1, Red and Blue arrive', 'Round 6']) {
        const paint = await paintOf(page, name)
        expect(paint.width).toBeCloseTo(28, 0)
        expect(paint.height).toBeCloseTo(26, 0)
    }
})

test('The current ticket is ringed in ink, whatever its colour', async ({ page }) => {
    test.skip(onPhone(), 'Phones show no round tickets.')
    const ink = async () => `2px ${await tokenColour(page, '--rtr-ink')}`
    await openScenario(page, 'First share')
    await expect(ticket(page, 'Round 1, Red and Blue arrive')).toHaveAttribute(
        'aria-current',
        'step'
    )
    expect((await paintOf(page, 'Round 1, Red and Blue arrive')).outline).toBe(await ink())
    expect((await paintOf(page, 'Round 2, Orange arrives')).outline).toBe('none')
    await openScenario(page, 'Purple arrives')
    const current = ticket(page, 'Round 4, Purple arrives')
    await expect(current).toHaveAttribute('aria-current', 'step')
    expect((await paintOf(page, 'Round 4, Purple arrives')).outline).toBe(await ink())
    expect((await paintOf(page, 'Round 1, Red and Blue arrive')).outline).toBe('none')
    await expect(tickets(page).locator('[aria-current="step"]')).toHaveCount(1)
})

for (const width of [1440, 1024]) {
    test(`At ${width} px the turn line holds the tickets, the Transcontinental chip and Undo`, async ({
        page
    }) => {
        test.skip(onPhone(), 'Phones show no round tickets.')
        await page.setViewportSize({ width, height: width === 1440 ? 900 : 768 })
        await openScenario(page, 'First share')
        // Undo keeps its place while there is nothing to undo, only hidden.
        const line = await page.locator('button', { hasText: /^Undo$/ }).evaluate((undo) => {
            const row = undo.parentElement?.parentElement
            const box = (element: Element | null | undefined) => {
                const rect = element?.getBoundingClientRect()
                return rect
                    ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
                    : { left: 0, right: 0, top: 0, bottom: 0 }
            }
            const start = row?.firstElementChild
            return {
                row: box(row),
                start: box(start),
                startOverflows: start ? start.scrollWidth > start.clientWidth : true,
                end: box(undo.parentElement),
                tickets: box(document.querySelector('[role="list"][aria-label="Rounds"]')),
                chip: box(document.querySelector('[role="img"][aria-label^="Transcontinental"]')),
                undo: box(undo)
            }
        })
        test.info().annotations.push({
            type: 'turn line',
            description: `tickets to Undo ${(line.end.right - line.end.left).toFixed(0)} px; line ${(line.row.right - line.row.left).toFixed(0)} px`
        })
        // One line: the tickets, the chip and Undo sit side by side, inside the row and clear of
        // whose turn it is.
        for (const part of [line.tickets, line.chip, line.undo]) {
            expect(part.left).toBeGreaterThanOrEqual(line.row.left)
            expect(part.right).toBeLessThanOrEqual(line.row.right + 0.5)
            expect(part.top).toBeGreaterThanOrEqual(line.row.top)
            expect(part.bottom).toBeLessThanOrEqual(line.row.bottom)
        }
        expect(line.tickets.right).toBeLessThanOrEqual(line.chip.left)
        expect(line.chip.right).toBeLessThanOrEqual(line.undo.left)
        expect(line.start.right).toBeLessThanOrEqual(line.end.left)
        // Whose turn it is fits beside them, with no round or phase written next to it.
        expect(line.startOverflows).toBe(false)
        const start = await page
            .locator('button', { hasText: /^Undo$/ })
            .evaluate((undo) => undo.parentElement?.parentElement?.firstElementChild?.textContent)
        expect(start ?? '').not.toMatch(/Round|Shares|Build|Ride|phase/i)
    })
}

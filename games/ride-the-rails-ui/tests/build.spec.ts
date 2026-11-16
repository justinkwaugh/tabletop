import { expect, test, type Page } from '@playwright/test'
import {
    activePlayerId,
    board,
    collectPageErrors,
    flyersDuring,
    litHex,
    litHexAt,
    litHexes,
    litLabels,
    moneyOf,
    openScenario,
    pressHex,
    settled,
    undo
} from './helpers.js'

// The contract's verification scenarios for Build (R-3.2, R-4), each at desktop and phone width.
collectPageErrors()

const EAST_COAST = [
    'New York',
    'Philadelphia',
    'Baltimore',
    'Washington',
    'Charleston',
    'Jacksonville'
]

function actionPanel(page: Page) {
    return page.locator('div.action')
}

/**
 * The build panel's count, "2 / 5" in large figures (on desktop and on a phone alike), and its
 * words for screen readers, "2 of 5 placed".
 */
async function placed(page: Page, text: string) {
    const [, count, limit] = /^(\d+) of (\d+) placed$/.exec(text) ?? []
    const figures = actionPanel(page).locator('.rtr-display', {
        hasText: new RegExp(`^${count} / ${limit}(,|$)`)
    })
    await expect(figures).toBeVisible()
    await expect(actionPanel(page).getByText(text)).toHaveCount(1)
}

function scrim(page: Page) {
    return board(page).locator('g.scrim path')
}

/** The picked hex's ring; a lit hex has none, only its hole in the scrim. */
function pickedRing(page: Page) {
    return board(page).locator('g.picks [data-ring="picked"]')
}

/** Every railroad's start band colours on the map, by the city they band. */
function bandedCities(page: Page, railroadId: string): Promise<string[]> {
    return board(page)
        .locator(`[data-city-marks]:has([data-band-colour="${railroadId}"])`)
        .evaluateAll((cities) =>
            cities.map((city) => city.getAttribute('data-city-marks') ?? '').toSorted()
        )
}

/** A city's own bonus pills on the map: "$2" for Chicago, "$5" for each $5 city not yet taken. */
function bonusPills(page: Page, kind: 'chicago' | 'five') {
    return board(page).locator(`g.bonuses [data-bonus="${kind}"]`)
}

function marks(page: Page, text: string) {
    return board(page).locator('g.picks text', { hasText: new RegExp(`^\\${text}$`) })
}

function railroadPopup(page: Page, place: string) {
    return page.getByRole('group', { name: `${place}: which railroad?`, exact: true })
}

function trackCount(page: Page): Promise<number> {
    return page.evaluate(
        () =>
            Object.values(window.rtrSession.gameState.track).flatMap((railroads) => railroads)
                .length
    )
}

function lastActionType(page: Page): Promise<string | undefined> {
    return page.evaluate(() => window.rtrSession.actions.at(-1)?.type)
}

/** Doubled-coordinate neighbours: (r, c ± 2) and (r ± 1, c ± 1). */
function isNeighbour(hexId: string, of: string): boolean {
    const [row, col] = (hexId.split('.').at(-1) ?? '').split('-').map(Number)
    const [ofRow, ofCol] = (of.split('.').at(-1) ?? '').split('-').map(Number)
    const rows = Math.abs((row ?? 0) - (ofRow ?? 0))
    const cols = Math.abs((col ?? 0) - (ofCol ?? 0))
    return (rows === 0 && cols === 2) || (rows === 1 && cols === 1)
}

const PLAIN_RED = /^[^:]+: place Red$/

test('3. First placement: the East Coast lights, New York starts Red, undo', async ({ page }) => {
    await openScenario(page, 'First placement')
    expect(await activePlayerId(page)).toBe('p1')
    await placed(page, '0 of 5 placed')

    await expect(
        actionPanel(page).getByText('Choose spaces on the map to build track')
    ).toHaveCount(test.info().project.use.isMobile ? 0 : 1)
    await expect(actionPanel(page).getByRole('button', { name: 'Skip', exact: true })).toBeVisible()

    // R-4.2.1: Red starts in any East Coast city; nothing else lights and the rest dims. A lit
    // hex is a hole in the scrim, with no ring and no ghost cube.
    expect(await litLabels(page)).toEqual(EAST_COAST.map((city) => `${city}: start Red`))
    await expect(scrim(page)).toHaveCount(1)
    await expect(board(page).locator('[data-ghost]')).toHaveCount(0)
    await expect(board(page).locator('g.picks polygon')).toHaveCount(0)

    const flyers = await flyersDuring(page, () =>
        pressHex(page, litHex(page, 'New York: start Red'))
    )
    expect(flyers).toContain('locomotive')
    await placed(page, '1 of 5 placed')
    expect(await trackCount(page)).toBe(1)
    // R-4.1.2: Red now extends to New York's neighbours, and starts nowhere else.
    const lit = await litHexes(page).evaluateAll((hexes) =>
        hexes.map((hex) => hex.getAttribute('data-hex-id') ?? '')
    )
    expect(lit.length).toBeGreaterThan(0)
    for (const hexId of lit) {
        expect(isNeighbour(hexId, 'hex.usa.6-60'), hexId).toBe(true)
    }
    expect((await litLabels(page)).every((label) => label.includes('place Red'))).toBe(true)

    await undo(page)
    expect(await trackCount(page)).toBe(0)
    await placed(page, '0 of 5 placed')
    expect(await litLabels(page)).toEqual(EAST_COAST.map((city) => `${city}: start Red`))
    await expect(actionPanel(page).getByRole('button', { name: 'Skip', exact: true })).toBeVisible()
})

test('4. Red and Blue never share an East Coast city', async ({ page }) => {
    await openScenario(page, 'Philadelphia taken')
    expect(await activePlayerId(page)).toBe('p2')
    // R-4.2.1: Blue holds Philadelphia, so Red may start in the other five only.
    expect(await litLabels(page)).toEqual(
        EAST_COAST.filter((city) => city !== 'Philadelphia').map((city) => `${city}: start Red`)
    )
    await expect(board(page).locator('[data-hex-id="hex.usa.7-57"][role="button"]')).toHaveCount(0)
})

test('5. Two railroads possible: the popup, its undo, and choosing Blue', async ({ page }) => {
    await openScenario(page, 'Two railroads meet')
    expect(await activePlayerId(page)).toBe('p1')
    const before = await trackCount(page)
    // A placement earlier in the turn, for the second Undo to take back.
    await expect(litHexAt(page, 'hex.usa.8-54')).toHaveAccessibleName(PLAIN_RED)
    await pressHex(page, litHexAt(page, 'hex.usa.8-54'))
    await placed(page, '1 of 5 placed')

    // R-3.2: a hex both railroads may enter asks which.
    const both = litHexAt(page, 'hex.usa.10-54')
    await expect(both).toHaveAccessibleName(/: place Red or Blue$/)
    const place = ((await both.getAttribute('aria-label')) ?? '').split(':')[0] ?? ''
    await pressHex(page, both)
    const popup = railroadPopup(page, place)
    await expect(popup).toBeVisible()
    await expect(popup.getByRole('button', { name: /^Place Red, / })).toBeVisible()
    await expect(popup.getByRole('button', { name: /^Place Blue, / })).toBeVisible()
    // The picked hex alone wears a ring; its buttons are cubes with no words.
    await expect(pickedRing(page)).toHaveCount(1)
    for (const button of await popup.getByRole('button').all()) {
        expect((await button.innerText()).trim()).toBe('')
    }
    await expect(actionPanel(page).getByRole('button', { name: 'Done', exact: true })).toBeVisible()
    expect(await trackCount(page)).toBe(before + 1)

    // Undo closes the popup and places nothing; a second Undo takes back the earlier placement.
    await undo(page)
    await expect(popup).toHaveCount(0)
    await expect(pickedRing(page)).toHaveCount(0)
    expect(await trackCount(page)).toBe(before + 1)
    await placed(page, '1 of 5 placed')
    await undo(page)
    expect(await trackCount(page)).toBe(before)
    await placed(page, '0 of 5 placed')

    await pressHex(page, litHexAt(page, 'hex.usa.10-54'))
    await popup.getByRole('button', { name: /^Place Blue, / }).click()
    await settled(page)
    await expect(popup).toHaveCount(0)
    await placed(page, '1 of 5 placed')
    expect(await page.evaluate(() => window.rtrSession.gameState.track['hex.usa.10-54'])).toEqual([
        'railroad.blue'
    ])
})

test('6. Mountain limit: no mountain at 4 of 5, and a mountain lowers the limit', async ({
    page
}) => {
    await openScenario(page, 'First placement')
    const mountain = /lowers the limit by 1$/
    await pressHex(page, litHex(page, 'Philadelphia: start Red'))
    for (let count = 2; count <= 4; count++) {
        const labels = await litLabels(page)
        const plain = labels.find((label) => PLAIN_RED.test(label))
        expect(plain).toBeDefined()
        await pressHex(page, litHex(page, plain ?? ''))
        await placed(page, `${count} of 5 placed`)
    }
    // R-3.2.4: a mountain now would lower the limit to 4, already reached.
    const atFour = await litLabels(page)
    expect(atFour.length).toBeGreaterThan(0)
    expect(atFour.filter((label) => mountain.test(label))).toEqual([])
    expect(atFour.every((label) => PLAIN_RED.test(label))).toBe(true)

    for (let count = 3; count >= 0; count--) {
        await undo(page)
        await placed(page, `${count} of 5 placed`)
    }
    await pressHex(page, litHex(page, 'Philadelphia: start Red'))
    const climb = (await litLabels(page)).find((label) => mountain.test(label))
    expect(climb).toBeDefined()
    await pressHex(page, litHex(page, climb ?? ''))
    await placed(page, '2 of 4 placed')
    // R-3.2.4: the rose −1 pill beside the count, said in words only for screen readers.
    await expect(actionPanel(page).getByText('−1', { exact: true })).toBeVisible()
    await expect(
        actionPanel(page).locator('.sr-only', { hasText: 'Mountain used: limit 4' })
    ).toHaveCount(1)
    for (let count = 3; count <= 4; count++) {
        const plain = (await litLabels(page)).find((label) => PLAIN_RED.test(label))
        expect(plain).toBeDefined()
        await pressHex(page, litHex(page, plain ?? ''))
        if (count < 4) {
            await placed(page, `${count} of 4 placed`)
        }
    }
    // The fourth placement ends the turn by itself.
    await expect.poll(() => activePlayerId(page)).toBe('p2')
    expect(await lastActionType(page)).toBe('FinishBuilding')
})

test('7. Bonus marks and pay: Chicago $2, Denver $5, and a start that uses the $5 up', async ({
    page
}) => {
    await openScenario(page, 'Black unstarted')
    expect(await activePlayerId(page)).toBe('p1')
    const money = (await moneyOf(page, 'p1')) ?? 0

    // R-4.3.1: Chicago pays $2 to the seat that places there. The city's own pill shows it; the
    // lit hex is not marked again.
    const chicago = litHex(page, 'Chicago: start Black, $2')
    await expect(chicago).toBeVisible()
    await expect(bonusPills(page, 'chicago')).toHaveCount(1)
    await expect(marks(page, '$2')).toHaveCount(0)
    const flyers = await flyersDuring(page, () => pressHex(page, chicago))
    expect(flyers).toContain('coin $2')
    expect(await moneyOf(page, 'p1')).toBe(money + 2)
    await expect(bonusPills(page, 'chicago')).toHaveCount(1)
    await undo(page)
    expect(await moneyOf(page, 'p1')).toBe(money)

    // R-4.3.2: an empty $5 city pays $5 to an adjacent railroad; a start there pays nothing and
    // uses the bonus up. Its pill shows while the bonus is to be had and is gone once taken.
    const fives = await bonusPills(page, 'five').count()
    expect(fives).toBeGreaterThan(0)
    await expect(marks(page, '$5')).toHaveCount(0)
    const denver = litHex(page, 'Denver: place Orange or start Black, $5')
    await expect(denver).toBeVisible()
    await pressHex(page, denver)
    const popup = railroadPopup(page, 'Denver')
    const orange = popup.getByRole('button', { name: /^Place Orange, .*, pays \$5$/ })
    const black = popup.getByRole('button', { name: /^Start Black, / })
    await expect(orange).toBeVisible()
    await expect(orange).toHaveText('+$5')
    await expect(black).toHaveAccessibleName(/pays nothing: a start uses up the \$5$/)
    await expect(black).not.toHaveAccessibleName(/pays \$5/)
    await expect(black).toHaveText('')
    const blackFlyers = await flyersDuring(page, () => black.click())
    expect(blackFlyers.filter((kind) => kind.startsWith('coin'))).toEqual([])
    expect(await moneyOf(page, 'p1')).toBe(money)
    expect(await page.evaluate(() => window.rtrSession.gameState.track['hex.usa.8-22'])).toEqual([
        'railroad.black'
    ])
    await expect(bonusPills(page, 'five')).toHaveCount(fives - 1)
    await expect(board(page).locator('[data-bonus="used"]')).toHaveCount(0)

    await undo(page)
    await expect(bonusPills(page, 'five')).toHaveCount(fives)
    await pressHex(page, litHex(page, 'Denver: place Orange or start Black, $5'))
    const orangeFlyers = await flyersDuring(page, () => orange.click())
    expect(orangeFlyers).toContain('coin $5')
    expect(await moneyOf(page, 'p1')).toBe(money + 5)
    await expect(bonusPills(page, 'five')).toHaveCount(fives - 1)
})

test('8. Transcontinental: $12 in a city, once; $8 elsewhere', async ({ page }) => {
    await openScenario(page, 'Transcontinental in reach')
    expect(await activePlayerId(page)).toBe('p1')
    const money = (await moneyOf(page, 'p1')) ?? 0
    // The Transcontinental's chip in the turn line shows the terms while open. Once claimed it is
    // a button that shows or hides the claimed line, and says the claim in its description.
    const chip = page.getByRole('img', { name: /^Transcontinental: / })
    const toggle = page.getByRole('button', { name: /^(Show|Hide) the Transcontinental line$/ })
    const claimed = async (text: string) => {
        await expect(chip).toHaveCount(0)
        await expect(toggle).toHaveAccessibleDescription(`Transcontinental: ${text}`)
    }
    const unclaimed = async () => {
        await expect(toggle).toHaveCount(0)
        await expect(chip).toHaveAccessibleName(
            'Transcontinental: unclaimed, $12 when every switch is in a city, $8 otherwise'
        )
    }
    const goldLine = board(page).locator('g.lines polyline[stroke="var(--rtr-gold)"]')
    const lineFlyer = page.locator('[data-flyer="line:transcontinental"]')
    const lineShown = async (shown: boolean) => {
        await expect(toggle).toHaveAttribute('aria-pressed', String(shown))
        await expect(toggle).toHaveAccessibleName(
            `${shown ? 'Hide' : 'Show'} the Transcontinental line`
        )
        await expect(goldLine).toHaveCount(shown ? 1 : 0)
    }
    await unclaimed()
    await expect(goldLine).toHaveCount(0)

    // R-4.3.3: Purple meets Orange in Denver, a city, completing a line coast to coast.
    const denver = litHex(page, 'Denver: place Purple, $12 Transcontinental')
    await expect(denver).toBeVisible()
    const flyers = await flyersDuring(page, () => pressHex(page, denver))
    expect(flyers).toContain('coin $12')
    expect(flyers).toContain('line')
    await settled(page)
    expect(await moneyOf(page, 'p1')).toBe(money + 12)
    await claimed('claimed by Ada for $12')
    // Once its claim has played, the line is no longer drawn; the chip turns it on and off.
    await expect(lineFlyer).toHaveCount(0)
    await lineShown(false)
    await toggle.click()
    await lineShown(true)
    await toggle.click()
    await lineShown(false)
    await toggle.click()
    await lineShown(true)
    // Paid once: no hex offers it again.
    expect((await litLabels(page)).filter((label) => label.includes('Transcontinental'))).toEqual(
        []
    )
    await expect(marks(page, '$12')).toHaveCount(0)
    await expect(marks(page, '$8')).toHaveCount(0)
    const another = (await litLabels(page))[0]
    expect(another).toBeDefined()
    await pressHex(page, litHex(page, another ?? ''))
    await claimed('claimed by Ada for $12')
    // The viewer's choice outlasts the turn's next placement.
    await lineShown(true)
    expect(await moneyOf(page, 'p1')).toBeGreaterThanOrEqual(money + 12)

    await undo(page)
    await undo(page)
    await unclaimed()
    await expect(goldLine).toHaveCount(0)
    expect(await moneyOf(page, 'p1')).toBe(money)

    // The same line meeting Orange in a plain hex pays $8.
    const plain = litHexAt(page, 'hex.usa.8-24')
    await expect(plain).toHaveAccessibleName(/: place Purple, \$8 Transcontinental$/)
    await expect(marks(page, '$8')).not.toHaveCount(0)
    await pressHex(page, plain)
    expect(await moneyOf(page, 'p1')).toBe(money + 8)
    await claimed('claimed by Ada for $8')
    // The line stays shown: the choice is the viewer's, not the claim's.
    await lineShown(true)
})

test("9. Yellow's starts: Chicago or the westernmost set, and only one", async ({ page }) => {
    await openScenario(page, 'Yellow starts')
    expect(await activePlayerId(page)).toBe('p1')
    const yellowStarts = async () =>
        (await litLabels(page))
            .filter((label) => /start Yellow/.test(label))
            .map((label) => label.split(':')[0])
            .toSorted()

    // R-4.2.3: Chicago and the westernmost occupied cities holding exactly one locomotive.
    expect(await yellowStarts()).toEqual(['Chicago', 'Des Moines', 'Kansas City', 'Omaha'])
    // Every seat sees Yellow join those cities' start bands; Chicago's is printed.
    expect(await bandedCities(page, 'railroad.yellow')).toEqual([
        'city.usa.chicago',
        'city.usa.des-moines',
        'city.usa.kansas-city',
        'city.usa.omaha'
    ])

    const chicago = litHexAt(page, 'hex.usa.5-43')
    await pressHex(page, chicago)
    const popup = railroadPopup(page, 'Chicago')
    if (await popup.isVisible()) {
        await popup.getByRole('button', { name: /^Start Yellow, / }).click()
        await settled(page)
    }
    expect(await page.evaluate(() => window.rtrSession.gameState.track['hex.usa.5-43'])).toContain(
        'railroad.yellow'
    )
    // R-4.2.3: one start only. The western cities no longer light for Yellow, it leaves their
    // bands, and Yellow lights only next to Chicago (R-4.1.2).
    const nextToChicago = [
        'hex.usa.4-42',
        'hex.usa.4-44',
        'hex.usa.5-41',
        'hex.usa.5-45',
        'hex.usa.6-42',
        'hex.usa.6-44'
    ]
    const yellowLit = async () =>
        (
            await litHexes(page).evaluateAll((hexes) =>
                hexes
                    .filter((hex) => /Yellow/.test(hex.getAttribute('aria-label') ?? ''))
                    .map((hex) => hex.getAttribute('data-hex-id') ?? '')
            )
        ).toSorted()
    expect(await yellowStarts()).toEqual([])
    await expect.poll(() => bandedCities(page, 'railroad.yellow')).toEqual(['city.usa.chicago'])
    expect(await yellowLit()).not.toEqual([])
    for (const hexId of await yellowLit()) expect(nextToChicago).toContain(hexId)

    // Orange builds on west to Cheyenne, moving the westernmost cities; still no Yellow start.
    for (const hexId of ['hex.usa.5-29', 'hex.usa.5-27', 'hex.usa.5-25', 'hex.usa.5-23']) {
        await expect(litHexAt(page, hexId)).toHaveAccessibleName(/place Orange/)
        await pressHex(page, litHexAt(page, hexId))
    }
    expect(await yellowStarts()).toEqual([])
    expect(await bandedCities(page, 'railroad.yellow')).toEqual(['city.usa.chicago'])
})

test('9. Black unstarted in round 5: nearly every city lit, starts and extensions alike', async ({
    page
}) => {
    await openScenario(page, 'Black unstarted')
    const labels = await litLabels(page)
    // R-4.2.5: Black may start in any city with room, so most cities light.
    expect(labels.filter((label) => label.includes('start Black')).length).toBeGreaterThan(40)
    expect(labels.some((label) => /^[^:]+: start Black(, \$\d+)?$/.test(label))).toBe(true)
    // A city lit for a start only is lit as any other: a hole in the scrim, with no ring.
    await expect(board(page).locator('g.picks polygon')).toHaveCount(0)
    await expect(scrim(page)).toHaveCount(1)
    await expect(litHex(page, 'Buffalo: place Red or start Black')).toBeVisible()
})

test('10. Skip: the next seat builds; undo restores the turn', async ({ page }) => {
    await openScenario(page, 'First placement')
    await page.getByRole('button', { name: 'Skip', exact: true }).click()
    await settled(page)
    // R-3.2.1: a seat may place no locomotive at all.
    await expect.poll(() => activePlayerId(page)).toBe('p2')
    expect(await lastActionType(page)).toBe('EndBuilding')
    expect(await trackCount(page)).toBe(0)

    await undo(page)
    await expect.poll(() => activePlayerId(page)).toBe('p1')
    await placed(page, '0 of 5 placed')
    await expect(page.getByRole('button', { name: 'Skip', exact: true })).toBeVisible()
    expect(await litLabels(page)).toEqual(EAST_COAST.map((city) => `${city}: start Red`))
})

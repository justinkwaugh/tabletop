import { expect, test, type Locator, type Page } from '@playwright/test'
import { createGame, playToCards, settled, shot } from './helpers.js'

/**
 * A real hotseat session, which holds every seat's hidden fields: what another seat's panel keeps
 * out of the DOM is kept out by rule, not by the data being absent.
 */

const problems = new WeakMap<Page, string[]>()

test.beforeEach(({ page }) => {
    const seen: string[] = []
    problems.set(page, seen)
    page.on('pageerror', (error) => seen.push(error.message))
    page.on('console', (message) => {
        if (/Error (applying|handling)/.test(message.text())) {
            seen.push(message.text())
        }
    })
})

test.afterEach(({ page }) => {
    expect(problems.get(page)).toEqual([])
})

const seatLayer = (page: Page) => page.locator('[data-table-layer="seat"]')
const enlarged = (page: Page) => page.locator('[data-enlarged]')
const columnPanel = (page: Page, playerId: string) =>
    page.locator(`[data-seat-column] [data-seat-panel="${playerId}"]`)

const seats = (page: Page) =>
    page.evaluate(() => {
        const session = window.feudumSession
        const me = session.myPlayerId
        const others = session.gameState.players.filter(({ playerId }) => playerId !== me)
        return {
            me,
            others: others.map(({ playerId }) => playerId),
            hiddenHands: others.map((player) => player.hand ?? []),
            handCounts: others.map((player) => player.handCount)
        }
    })

const PrintedNames = ['Migrate', 'Move', 'Influence', 'Improve', 'Explore', 'Harvest', 'Tax']

/** R-3.1, R-4.4.4 What another seat's panel holds at all, visible or not. */
async function expectNoFaces(panel: Locator) {
    const html = await panel.innerHTML()
    expect(html).not.toContain('data-seat-card')
    expect(html).not.toContain('data-set-aside')
    expect(html).not.toContain('data-writ-face')
    expect(html).not.toContain('data-deck-note')
    for (const name of PrintedNames) {
        expect(html).not.toContain(name)
    }
}

test('S57, S58 a hotseat holds every hand, and another seat is still backs and a count', async ({
    page
}) => {
    await createGame(page)
    await playToCards(page)
    await settled(page)
    const { me, others, hiddenHands, handCounts } = await seats(page)

    // Nothing is played yet, so another seat's panel has no reason to name a card.
    expect(hiddenHands[0].length).toBeGreaterThan(0)
    for (const [index, other] of others.entries()) {
        const panel = columnPanel(page, other)
        await expectNoFaces(panel)
        await expect(panel.locator('[data-hand-backs]')).toHaveAttribute(
            'data-hand-backs',
            String(handCounts[index])
        )
    }

    const mine = columnPanel(page, me ?? '')
    await expect(mine.locator('[data-seat-card]')).toHaveCount(11)
    await expect(mine.locator('[data-set-aside]')).toHaveCount(11 - handCounts[0])
    await expect(mine.locator('[data-hand-backs]')).toHaveCount(0)
    await shot(page, 'column')
})

test('S59 a back enlarges as a back; a face enlarges; Escape closes one layer at a time', async ({
    page
}) => {
    await createGame(page)
    await playToCards(page)
    await settled(page)
    const { me, others, hiddenHands } = await seats(page)
    const [other] = others

    await columnPanel(page, other).locator('[data-enlarge="card back"]').click()
    await expect(enlarged(page)).toHaveAttribute('data-enlarged', 'card')
    const back = await enlarged(page).innerHTML()
    expect(back).toContain('card back')
    for (const name of PrintedNames) {
        expect(back).not.toContain(name)
    }
    expect(hiddenHands[0].length).toBeGreaterThan(0)
    await shot(page, 'enlarged-back')
    await page.keyboard.press('Escape')
    await expect(enlarged(page)).toHaveCount(0)

    await columnPanel(page, me ?? '')
        .locator('[data-enlarge="Move card"]')
        .click()
    await expect(enlarged(page)).toHaveAttribute('data-enlarged', 'card')
    expect(await enlarged(page).innerHTML()).toContain('Move')
    await shot(page, 'enlarged-face')
    await page.keyboard.press('Escape')
    await expect(enlarged(page)).toHaveCount(0)
})

/**
 * A table some way into a game, on the page's displayed state only (no Action is sent, and no rule
 * runs): reaching it through play would take most of an epoch. Each seat holds a writ, a sealed
 * charter, and a little of everything else. Returns each seat's hidden writ ids.
 */
async function midGame(page: Page) {
    return page.evaluate(() => {
        const session = window.feudumSession
        const shown = session.gameState
        const next: typeof shown = Reflect.construct(shown.constructor, [
            JSON.parse(JSON.stringify(shown.dehydrate()))
        ])
        const vault = next.requireVault()
        const tiles = Object.values(next.regionStacks).flat()
        const held: Record<string, string[]> = {}
        next.players.forEach((player, index) => {
            const [writ, sealed, known] = vault.writDeck.splice(0, 3).map(({ writId }) => writId)
            held[player.playerId] = [writ, sealed]
            player.writs = [writ]
            player.sealedCharters = [sealed]
            player.writCount = 2
            player.sealedCharterCount = 1
            player.deckKnowledge = [{ slot: 40 + index, writId: known }]
            player.played = [
                { kind: 'guild', use: 'special' },
                { kind: 'conquer', use: 'forfeited' },
                { kind: 'defend', use: 'defend-flip' },
                { kind: 'repeat', use: 'regular', replayedKind: 'harvest', dejaVu: true }
            ]
            player.pouch = index === 0 ? 'saltpeter' : 'sulfur'
            player.regionTiles = [tiles[index]]
            next.tileLandscapes[tiles[index]] = 'orchard'
            player.beads = vault.sealPile.splice(0, 1)
            player.sealCount = 2
            player.barrel = 2
            next.voyageTrack[player.playerId] = 3
            next.militaryService[player.playerId] = 2
        })
        session.gameState = next
        return held
    })
}

test('R-4.4.4, S59 writs: backs for another seat, faces for their owner; each enlarges', async ({
    page
}) => {
    await createGame(page)
    await playToCards(page)
    await settled(page)
    const { me, others, hiddenHands } = await seats(page)
    const [other] = others
    const held = await midGame(page)
    await settled(page)
    await shot(page, 'column-mid-game')

    const theirs = columnPanel(page, other)
    const html = await theirs.innerHTML()
    expect(html).not.toContain('data-writ-face')
    expect(html).not.toContain('data-deck-note')
    for (const writId of held[other]) {
        expect(html).not.toContain(writId)
    }
    for (const kind of hiddenHands[0]) {
        expect(html).not.toContain(`data-seat-card="${kind}"`)
    }
    await expect(theirs.locator('[data-writ-back="open"]')).toHaveCount(1)
    await expect(theirs.locator('[data-writ-back="sealed"]')).toHaveCount(1)
    await expect(theirs.locator('[data-card-mark]')).toHaveText([
        'special',
        'forfeited',
        'flipped as Defend',
        'Déjà Vu Harvest'
    ])

    await theirs.locator('[data-enlarge="sealed writ back"]').click()
    await expect(enlarged(page)).toHaveAttribute('data-enlarged', 'writ')
    const back = await enlarged(page).innerHTML()
    expect(back).toContain('Writ back, sealed')
    for (const writId of held[other]) {
        expect(back).not.toContain(writId)
    }
    await shot(page, 'enlarged-writ-back')
    await page.keyboard.press('Escape')
    await expect(enlarged(page)).toHaveCount(0)

    const own = columnPanel(page, me ?? '')
    const [writ, sealed] = held[me ?? '']
    await expect(own.locator(`[data-writ-face="${writ}"]`)).toBeVisible()
    await expect(own.locator(`[data-writ-face="${sealed}"][data-writ-sealed]`)).toBeVisible()
    await expect(own.locator('[data-writ-back]')).toHaveCount(0)
    await expect(own.locator('[data-deck-note]')).toHaveText('you know 1 under the deck')
    await own.locator(`[data-writ-face="${writ}"]`).click()
    await expect(enlarged(page)).toHaveAttribute('data-enlarged', 'writ')
    expect(await enlarged(page).innerHTML()).not.toContain('Writ back')
    await shot(page, 'enlarged-writ-face')
    await page.keyboard.press('Escape')
    await expect(enlarged(page)).toHaveCount(0)

    await own.locator('[data-open-seat-of]').click()
    await settled(page)
    await shot(page, 'open-seat-mid-game')
    await page.keyboard.press('Escape')
    await columnPanel(page, other).locator('[data-open-seat-of]').click()
    await settled(page)
    await shot(page, 'open-seat-other-mid-game')
})

test('the column scrolls to the last seat; an open seat fits a phone and scrolls to its end', async ({
    page
}) => {
    await createGame(page)
    await playToCards(page)
    await settled(page)
    const { others } = await seats(page)
    const last = columnPanel(page, others[others.length - 1]).locator('[data-open-seat-of]')
    await last.click()
    await expect(seatLayer(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(seatLayer(page)).toHaveCount(0)
    await shot(page, 'column-scrolled')

    await page.setViewportSize({ width: 375, height: 812 })
    await settled(page)
    await page.evaluate(() => {
        const session = window.feudumSession
        session.layers.openSeat(session.myPlayerId ?? '')
    })
    await expect(seatLayer(page)).toBeVisible()
    await settled(page)
    const roll = await seatLayer(page).locator('[data-seat-panel]').boundingBox()
    expect(roll?.x ?? -1).toBeGreaterThanOrEqual(0)
    expect((roll?.x ?? 0) + (roll?.width ?? 999)).toBeLessThanOrEqual(375)
    await shot(page, 'phone-open-seat')
    const end = seatLayer(page).locator('[data-seat-section="service"]')
    await end.scrollIntoViewIfNeeded()
    await expect(end).toBeInViewport()
    await shot(page, 'phone-open-seat-end')
})

test('Contract, Seat panel: the ribbon opens the seat at a readable size; three ways close it', async ({
    page
}) => {
    await createGame(page)
    await playToCards(page)
    await settled(page)
    const { me, others } = await seats(page)
    const ribbon = columnPanel(page, me ?? '').locator('[data-open-seat-of]')
    const columnSize = await ribbon.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))
    const columnCard = await columnPanel(page, me ?? '')
        .locator('[data-seat-card] svg')
        .first()
        .boundingBox()

    await ribbon.click()
    await expect(seatLayer(page)).toBeVisible()
    await settled(page)
    const opened = seatLayer(page).locator('[data-open-seat]')
    const openedCard = await opened.locator('[data-seat-card] svg').first().boundingBox()
    const openedSize = await opened
        .locator('[data-open-seat-of]')
        .evaluate((node) => parseFloat(getComputedStyle(node).fontSize))
    expect(openedSize).toBeGreaterThan(columnSize)
    expect(openedCard?.width ?? 0).toBeGreaterThan((columnCard?.width ?? 0) * 1.5)
    await shot(page, 'open-seat-own')

    await opened.locator('[data-open-seat-of]').click()
    await expect(seatLayer(page)).toHaveCount(0)

    await columnPanel(page, others[0]).locator('[data-open-seat-of]').click()
    await expect(seatLayer(page)).toBeVisible()
    await expectNoFaces(seatLayer(page).locator('[data-open-seat]'))
    await settled(page)
    await shot(page, 'open-seat-other')

    await seatLayer(page).locator('[data-enlarge="card back"]').click()
    await expect(enlarged(page)).toBeVisible()
    await shot(page, 'open-seat-enlarged-back')
    await page.keyboard.press('Escape')
    await expect(enlarged(page)).toHaveCount(0)
    await expect(seatLayer(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(seatLayer(page)).toHaveCount(0)

    await columnPanel(page, others[0]).locator('[data-open-seat-of]').click()
    await page.mouse.click(4, 450)
    await expect(seatLayer(page)).toHaveCount(0)
})

// @vitest-environment node
import type { WritId } from '@tabletop/feudum'
import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import WritFace from '$lib/components/pieces/WritFace.svelte'
import type { ActionBlock, ActionRow, LineRole, SeatNames } from '$lib/model/actionPanel.js'
import type { PanelChoice } from '$lib/model/cardFlows.js'
import ActionPanelOnTable from '$lib/testing/ActionPanelOnTable.svelte'

const paint = {
    fill: 'var(--feudum-map-ink)',
    ink: 'var(--feudum-text)',
    edge: 'var(--feudum-map-ink)',
    initial: 'B'
}
const pointer = {
    pointAtRow: () => {},
    leaveRow: () => {},
    toggleRowPreview: () => {},
    isRowPointedAt: () => false
}
const nothing = () => {}

function markupOf(...blocks: readonly ActionBlock[]) {
    return render(ActionPanelOnTable, { props: { view: { blocks }, pointer } }).body
}

/** A row that presses nothing, as `rows` draws it. */
function aRow(label: string, more: Partial<PanelChoice> = {}): ActionRow {
    return { choice: { label, picked: false, ...more }, press: nothing }
}

function rowsBlock(name: string, rows: readonly ActionRow[], heading?: string): ActionBlock {
    return { kind: 'rows', name, rows, heading }
}

/** The element's own text: tags and the markers svelte leaves are dropped. */
function textOf(markup: string, attribute: string): string | undefined {
    const match = new RegExp(`<[a-z]+[^>]*${attribute}[^>]*>(.*?)</(p|button|span)>`, 's').exec(
        markup
    )
    return match?.[1].replace(/<!--.*?-->|<[^>]+>/gs, '').trim()
}

describe('R-3.1 the finalise row', () => {
    const row = markupOf({
        kind: 'finalise',
        entries: [
            {
                playerId: 'p1',
                name: 'Ana',
                paint,
                finalised: true,
                pouchGood: 'saltpeter',
                next: false
            },
            { playerId: 'p2', name: 'Ben', paint, finalised: false, next: true },
            { playerId: 'p3', name: 'Cyd', paint, finalised: false, next: false }
        ]
    })

    it('S4 S8 names the seats in order, ticks those done with their pouch good, marks the next', () => {
        expect(row).toContain('Finalise order')
        const seats = [...row.matchAll(/data-finalise-seat="([^"]+)"/g)].map(([, name]) => name)
        expect(seats).toEqual(['Ana', 'Ben', 'Cyd'])
        const [, ana, ben, cyd] = row.split('data-finalise-seat=')
        expect(ana).toContain('data-finalised')
        expect(ana).toContain('✓')
        expect(ana).toContain('aria-label="saltpeter"')
        expect(ana).not.toContain('data-next')
        expect(ben).toContain('data-next')
        expect(ben).not.toContain('data-finalised')
        expect(cyd).not.toContain('data-next')
        expect(cyd).not.toContain('✓')
    })
})

describe('R-X the lines of the panel', () => {
    it.each<readonly [LineRole, string]>([
        ['turn', 'data-turn-line'],
        ['flow', 'data-flow-line'],
        ['warning', 'data-warning'],
        ['note', 'data-note-line'],
        ['waiting', 'data-waiting'],
        ['refusal', 'data-refusal-line'],
        ['previous', 'data-previous-seat']
    ])('a %s line stands in its own place with its text', (role, attribute) => {
        expect(textOf(markupOf({ kind: 'line', role, text: 'The words' }), attribute)).toBe(
            'The words'
        )
    })

    it('S5 R-3.1 the hand count reads with the round beside it', () => {
        const markup = markupOf({
            kind: 'line',
            role: 'count',
            text: '4 of 4',
            lead: 'Round 1 · choose your hand'
        })
        expect(textOf(markup, 'data-hand-count')).toBe('4 of 4')
        expect(markup.replace(/<!--.*?-->|<[^>]+>/gs, '')).toContain(
            'Round 1 · choose your hand · 4 of 4'
        )
    })
})

describe('R-X.3 the rows of the panel', () => {
    const lit = aRow('Move', { lights: () => [] })
    const plain = aRow('Forfeit')

    it('a row with lights has its touch preview; one without has none', () => {
        const markup = markupOf(rowsBlock('modes', [lit, plain]))
        expect(markup).toContain('data-preview="Move"')
        expect(markup).toContain('aria-label="Preview Move on the board"')
        expect(markup).not.toContain('data-preview="Forfeit"')
    })

    it('a dimmed row stays pressable and gives no reason until pressed', () => {
        const markup = markupOf(
            rowsBlock('goods', [aRow('Sulfur', { refusal: 'Already in your pouch.' })])
        )
        expect(markup).toContain('aria-disabled="true"')
        expect(markup).not.toContain('data-refusal')
        expect(markup).not.toContain('Already in your pouch.')
        expect(markup).not.toMatch(/<button[^>]*\bdisabled\b(?!=")/)
    })

    it('R-3.11 a cost and a threat are rose, anything else is the accent', () => {
        const markup = markupOf(
            rowsBlock('flow', [
                aRow('A', { note: { kind: 'cost', label: '1 food' } }),
                aRow('B', { note: { kind: 'threat', label: '3 vs 4' } }),
                aRow('C', { note: { kind: 'role', label: 'squire' } })
            ])
        )
        expect(markup).toMatch(/text-feudum-danger" data-note="cost"/)
        expect(markup).toMatch(/text-feudum-danger" data-note="threat"/)
        expect(markup).toMatch(/text-feudum-accent" data-note="role"/)
    })

    it('a block carries its heading, and a picked row says so', () => {
        const markup = markupOf(rowsBlock('pouch', [aRow('Iron', { picked: true })], 'Pouch'))
        expect(markup).toContain('data-rows="pouch"')
        expect(markup).toContain('Pouch')
        expect(markup).toContain('data-picked')
        expect(markup).toContain('aria-pressed="true"')
    })

    it('S1 R-1.4.8 the good and the character stand in their rows as pieces', () => {
        const markup = markupOf(
            rowsBlock('goods', [{ ...aRow('Iron'), art: { kind: 'good', good: 'iron' } }]),
            rowsBlock('characters', [
                {
                    ...aRow('Noble', { note: { kind: 'role', label: 'knight' } }),
                    art: { kind: 'pawn', character: 'noble', paint }
                }
            ])
        )
        expect(markup).toContain('aria-label="iron"')
        expect(markup).toContain('aria-label="B noble"')
    })

    it('S2 R-1.4.8 the sulfur asks beside itself where it goes', () => {
        const markup = markupOf(
            rowsBlock('goods', [
                {
                    ...aRow('Sulfur', { picked: true }),
                    popup: [aRow('Sulfur in the pouch'), aRow('Sulfur in the barrel')]
                }
            ])
        )
        const [, asked] = markup.split('data-row-popup="Sulfur"')
        expect(asked).toContain('data-row="Sulfur in the pouch"')
        expect(asked).toContain('data-row="Sulfur in the barrel"')
    })

    it('S1 the haversack counts stand for the seats that watch', () => {
        const markup = markupOf({
            kind: 'goods-counts',
            counts: [{ good: 'iron', count: 7 }]
        })
        expect(markup).toContain('data-good-count="iron"')
        expect(markup).toContain('7')
    })
})

describe('R-3.1 Departure 6 the cards as faces', () => {
    const cards = (tone: 'draft' | 'hand') =>
        markupOf({
            kind: 'cards',
            tone,
            paint,
            rows: [
                {
                    kind: 'tax',
                    label: 'Tax',
                    number: 3,
                    picked: true,
                    lights: () => [],
                    press: nothing
                },
                { kind: 'move', label: 'Move', number: 2, picked: false, press: nothing }
            ]
        })

    it('S5 each is a face with its name for a reader, a magnifier, and the amber ring when picked', () => {
        const markup = cards('hand')
        expect(markup).toContain('aria-label="Tax"')
        expect(markup).toContain('aria-label="Move"')
        expect(markup).toContain('data-row="Tax" data-picked')
        expect(markup).toContain('outline-feudum-accent')
        expect(markup).toContain('data-enlarge="Tax card"')
        expect(markup).toContain('data-enlarge="Move card"')
        expect(markup).toContain('data-preview="Tax"')
        expect(markup).not.toContain('data-preview="Move"')
    })

    it('the eleven of a draft stand in rows of six; the hand in one row', () => {
        expect(cards('draft')).toContain('grid-template-columns: repeat(6, minmax(0, 88px))')
        expect(cards('hand')).toContain('grid-template-columns: repeat(2, minmax(0, 72px))')
    })
})

describe('R-4.4.1 the writs as faces', () => {
    it('S18 each drawn writ has its name and a magnifier', () => {
        const markup = markupOf({
            kind: 'writs',
            rows: [{ writId: 'writ.mandate.1', ...aRow('Keep the first writ') }]
        })
        expect(markup).toContain('aria-label="Keep the first writ"')
        expect(markup).toContain('data-enlarge="Keep the first writ"')
    })
})

describe('R-4.8 the combat tally', () => {
    it('stands attack and defence by source, with its note', () => {
        const markup = markupOf({
            kind: 'tally',
            lines: [
                { source: 'Knight', attack: 3 },
                { source: 'Serf', defence: 1 }
            ],
            note: 'Defence may rise by 1 if Ana flips Defend.'
        })
        expect(markup).toContain('data-combat-tally')
        expect(markup).toContain('Knight')
        expect(markup).toContain('Attack')
        expect(markup).toContain('Defence')
        expect(textOf(markup, 'data-tally-note')).toBe('Defence may rise by 1 if Ana flips Defend.')
    })
})

describe('R-X.2 the primary', () => {
    it("S8 reads what it sends, and can't be pressed until it may", () => {
        const on = markupOf({
            kind: 'primary',
            label: "Long live the king · can't be undone",
            enabled: true,
            send: nothing
        })
        expect(textOf(on, 'data-primary')).toBe("Long live the king · can't be undone")
        expect(on).not.toMatch(/<button[^>]*\bdisabled\b/)
        const off = markupOf({
            kind: 'primary',
            label: 'Waiting for Ana to finalise',
            enabled: false,
            send: nothing
        })
        expect(off).toMatch(/<button[^>]*\bdisabled\b/)
    })
})

const Charter: WritId = 'writ.charter.sulfur-barrel'

const seats: SeatNames = {
    nameOf: (playerId) => ({ p1: 'Ana', p2: 'Ben' })[playerId] ?? playerId,
    paintOf: () => paint
}

/** What one marked element holds, up to the next of its kind. */
function partsOf(markup: string, attribute: string): readonly string[] {
    return markup.split(`${attribute}=`).slice(1)
}

describe('R-4.10, R-4.12.3 the order row', () => {
    const row = markupOf({
        kind: 'order-row',
        step: 'nourish',
        seats,
        entries: [
            { playerId: 'p1', done: true, next: false, fedByGame: true },
            { playerId: 'p2', done: false, next: true }
        ]
    })

    it('S53 names the seats in order, ticks those done, marks the next', () => {
        expect(row).toContain('Nourish')
        const [ana, ben] = partsOf(row, 'data-order-seat')
        expect(ana).toContain('✓')
        expect(ana).not.toContain('data-next')
        expect(ben).toContain('data-next')
        expect(ben).not.toContain('✓')
    })

    it('S53 D11 the seat the game fed says so, and only that seat', () => {
        const [ana, ben] = partsOf(row, 'data-order-seat')
        expect(ana).toContain('fed by the game')
        expect(ben).not.toContain('fed by the game')
    })

    it('S55 the landscapes step heads the same row', () => {
        const landscapes = markupOf({
            kind: 'order-row',
            step: 'landscapes',
            seats,
            entries: [{ playerId: 'p1', done: false, next: true }]
        })
        expect(landscapes).toContain('Landscapes')
        expect(landscapes).toContain('data-order-row="landscapes"')
    })
})

describe('R-4.12 the dawn sheet', () => {
    const sheet = markupOf({
        kind: 'dawn-sheet',
        seats,
        sheet: {
            epoch: 2,
            rows: [
                {
                    playerId: 'p1',
                    ranks: [{ guild: 'farmer', rank: 'master', vp: 5 }],
                    landscapes: { empty: 1, filled: 2, vp: 4 },
                    activeRegions: { regions: ['forest', 'desert'], vp: 2 },
                    disloyaltyVp: -3,
                    total: 8
                },
                {
                    playerId: 'p2',
                    ranks: [],
                    landscapes: { empty: 0, filled: 0, vp: 0 },
                    activeRegions: { regions: [], vp: 0 },
                    disloyaltyVp: 0,
                    total: 0
                }
            ],
            fills: ['Sea 2: archery-butt +3'],
            notes: ['New goods on the map']
        }
    })

    it('S54 a row per seat with ranks, landscapes, active regions, disloyalty and total', () => {
        const [ana] = partsOf(sheet, 'data-dawn-row')
        expect(ana).toMatch(/data-dawn-ranks[^>]*>[\s\S]*Farmer master · 5/)
        expect(ana).toMatch(/data-dawn-landscapes[^>]*>\s*1 empty, 2 filled · 4/)
        expect(ana).toMatch(/data-dawn-regions[^>]*>\s*2 · 2/)
        expect(ana).toMatch(/data-dawn-total[^>]*>8/)
    })

    it('S54 disloyalty stands in rose only where it costs', () => {
        const [ana, ben] = partsOf(sheet, 'data-dawn-row')
        expect(ana).toMatch(/text-feudum-danger[^>]*data-dawn-disloyalty[^>]*>-3/)
        expect(ben).not.toContain('text-feudum-danger')
    })

    it('R-4.12.3, R-4.12.4 the fills and what came after follow the rows', () => {
        expect(sheet).toContain('Sea 2: archery-butt +3')
        expect(sheet).toContain('New goods on the map')
        expect(sheet.indexOf('data-dawn-row')).toBeLessThan(sheet.indexOf('data-dawn-note'))
    })
})

describe('R-6.2, R-6.3 the game-end summary', () => {
    const score = { label: '0', vp: 0 }
    const column = {
        fifthDawn: 3,
        voyage: { label: 'No disc', vp: 0 },
        largeEmpire: score,
        shillings: score
    }
    const summary = (tieBreak?: string) =>
        markupOf({
            kind: 'game-end',
            seats,
            summary: {
                winnerLine: 'Ana wins',
                ...(tieBreak ? { tieBreak } : {}),
                columns: [
                    {
                        ...column,
                        playerId: 'p1',
                        charters: [{ writId: Charter, vp: 6 }],
                        score: 9,
                        winner: true
                    },
                    { ...column, playerId: 'p2', charters: [], score: 3, winner: false }
                ]
            }
        })

    it('S56 lists every category for every seat', () => {
        const rows = [...summary().matchAll(/data-game-end-row="([^"]+)"/g)].map(([, name]) => name)
        expect(rows).toEqual(['dawn', 'voyage', 'empire', 'shillings', 'charters', 'total'])
        const seatsDrawn = [...summary().matchAll(/data-game-end-seat="([^"]+)"/g)]
        expect(seatsDrawn.map(([, name]) => name)).toEqual(['Ana', 'Ben'])
    })

    it('S56 a sealed charter stands face up, with its score', () => {
        const props = { writId: Charter, width: 72 }
        const face = render(WritFace, { props: { ...props, faceShown: true } }).body
        const back = render(WritFace, { props: { ...props, faceShown: false } }).body
        expect(face).not.toEqual(back)
        const [charter] = partsOf(summary(), 'data-game-end-charter')
        const drawing = (markup: string) =>
            markup.slice(markup.indexOf('<svg'), markup.indexOf('</svg>'))
        expect(charter).toContain(drawing(face))
        expect(charter).not.toContain(drawing(back))
        expect(charter).toMatch(/<span>6<\/span>/)
    })

    it('S56 R-6.3 the tie-break is named when it broke a tie, and is absent otherwise', () => {
        expect(textOf(summary('Ana has the fuller barrel'), 'data-game-tie-break')).toBe(
            'Ana has the fuller barrel'
        )
        expect(summary()).not.toContain('data-game-tie-break')
    })
})

describe('R-4.4 the writ rows of a seat and of those watching', () => {
    it('S18 the drawn count stands as that many backs, naming no writ', () => {
        const backs = markupOf({ kind: 'backs', count: 2 })
        const back = render(WritFace, { props: { faceShown: false, width: 48 } }).body
        const svg = back.slice(back.indexOf('<svg'), back.indexOf('</svg>'))
        expect(backs).toContain('data-writ-backs="2"')
        expect(backs.split(svg).length - 1).toBe(2)
    })

    it('S50 each writ offered is a face, with its own buttons beneath', () => {
        const offers = markupOf({
            kind: 'writ-offers',
            offers: [
                { writId: Charter, name: 'Charter', rows: [aRow('Seal')] },
                { writId: 'writ.mandate.3', name: 'Mandate', rows: [aRow('A'), aRow('Discard')] }
            ]
        })
        const [charter, mandate] = partsOf(offers, 'data-writ-offer')
        expect(charter).toContain('Seal')
        expect(charter).not.toContain('Discard')
        expect(mandate).toContain('Discard')
    })
})

describe('contract, Render ownership: one component draws each shared row', () => {
    it('only the panel blocks draw them, so the panel and the waiting view cannot differ', () => {
        const components = import.meta.glob('./**/*.svelte', {
            query: '?raw',
            import: 'default',
            eager: true
        })
        const shared = ['CombatTally', 'DawnSheet', 'FinaliseRow', 'GameEndSummary', 'OrderRow']
        for (const name of shared) {
            const importers = Object.entries(components)
                .filter(([, source]) => String(source).includes(`import ${name} from`))
                .map(([file]) => file)
            expect(importers, name).toEqual(['./panel/PanelBlocks.svelte'])
        }
    })
})

// @vitest-environment node
import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import type { ActionBlock, ActionRow, LineRole } from '$lib/model/actionPanel.js'
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
        ['refusal', 'data-refusal-line']
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

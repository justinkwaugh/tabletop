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
    owner: "Bram's"
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
    return { kind: 'rows', name, rows, ...(heading ? { heading } : {}) }
}

/** The element's own text: tags and the markers svelte leaves are dropped. */
function textOf(markup: string, attribute: string): string | undefined {
    const match = new RegExp(`<[a-z]+[^>]*${attribute}[^>]*>(.*?)</(p|button|span)>`, 's').exec(
        markup
    )
    return match?.[1].replace(/<!--.*?-->|<[^>]+>/gs, '').trim()
}

/** The markup without each piece's title, so only the words beside the art are left. */
function untitled(markup: string): string {
    return markup.replace(/<title>.*?<\/title>/gs, '')
}

describe('R-3.1 the finalise row', () => {
    const row = markupOf({
        kind: 'finalise',
        entries: [
            { playerId: 'p1', name: 'Ana', paint, finalised: true, you: true, awaited: false },
            { playerId: 'p2', name: 'Ben', paint, finalised: true, you: false, awaited: false },
            { playerId: 'p3', name: 'Cyd', paint, finalised: false, you: false, awaited: true }
        ],
        caption: 'everyone at once · pouch goods shown when all have finalised',
        lead: 'Round 2 · choose your hand'
    })
    const words = (markup: string) =>
        markup
            .replace(/<title>.*?<\/title>|<!--.*?-->|<[^>]+>/gs, '')
            .replace(/\s+/g, ' ')
            .trim()

    it('R-3.1-H1 one heading and one caption: everyone at once, the pouch goods shown when all have finalised', () => {
        expect(row).toContain('data-finalise-caption')
        expect(words(row)).toContain(
            'Round 2 · choose your hand everyone at once · pouch goods shown when all have finalised'
        )
        expect(row).not.toContain('Finalise order')
    })

    it('R-3.1-H1 each seat says choosing or finalised and nothing else; the viewer is "you"', () => {
        const body = row.slice(0, row.lastIndexOf('</div>'))
        const chips = body
            .split('data-finalise-seat=')
            .slice(1)
            .map((chip) => words(chip.slice(chip.indexOf('>') + 1).replace(/<[^>]*$/, '')))
        expect(chips).toEqual(['Ana (you) · finalised ✓', 'Ben · finalised ✓', 'Cyd · choosing'])
    })

    it('S4 S8 R-3.1-H1 names the seats in order, ticks those done, shows no pouch good, marks no next', () => {
        const seats = [...row.matchAll(/data-finalise-seat="([^"]+)"/g)].map(([, name]) => name)
        expect(seats).toEqual(['Ana', 'Ben', 'Cyd'])
        const [, ana, ben, cyd] = row.split('data-finalise-seat=')
        expect(ana).toContain('data-finalised')
        expect(ana).toContain('✓')
        expect(row).not.toContain('aria-label="saltpeter"')
        expect(row).not.toContain('<svg')
        expect(ben).toContain('data-finalised')
        expect(cyd).not.toContain('data-finalised')
        expect(cyd).not.toContain('✓')
        expect(row).not.toContain('data-next')
        expect(row).not.toContain('next to finalise')
    })

    it('S8 a finalised seat is said once: its tick is hidden from a screen reader, which reads the words', () => {
        const [, ana] = row.split('data-finalise-seat=')
        expect(ana).toMatch(/<span aria-hidden="true"[^>]*>✓<\/span>/)
        expect(ana).not.toContain('aria-label="finalised"')
    })

    it('S8 a seat still choosing, while the viewer waits on it, is marked waited on', () => {
        const [, ana, ben, cyd] = row.split('data-finalise-seat=')
        expect(cyd).toContain('data-awaited')
        expect(ana).not.toContain('data-awaited')
        expect(ben).not.toContain('data-awaited')
    })
})

describe('R-3.1-H1 the hand once set: tray A shows it and the sealed pouch', () => {
    const cards = [
        { kind: 'move', number: 2, label: 'Move' },
        { kind: 'tax', number: 7, label: 'Tax' },
        { kind: 'guild', number: 9, label: 'Guild' },
        { kind: 'explore', number: 1, label: 'Explore' }
    ] as const
    const waiting: ActionBlock = {
        kind: 'line',
        role: 'waiting',
        text: 'Waiting for Ben and Cyd to finalise'
    }
    const sealed = markupOf(
        { kind: 'hand-set', paint, cards, pouch: { good: 'sulfur', title: '2 in a row' } },
        waiting
    )
    const plain = (markup: string) =>
        markup
            .replace(/<title>.*?<\/title>|<!--.*?-->|<[^>]+>/gs, ' ')
            .replace(/\s+/g, ' ')
            .trim()

    it('S8 the hand as its four faces, in the order chosen, under "Hand · set"', () => {
        expect(sealed).toContain('data-hand-set')
        const faces = [...sealed.matchAll(/data-set-card="([^"]+)"/g)].map(([, name]) => name)
        expect(faces).toEqual(['Move', 'Tax', 'Guild', 'Explore'])
        expect(plain(textOf(sealed, 'data-tray-label="hand"') ?? '')).toBe('Hand set')
        // Nothing to press: the hand is final.
        expect(sealed.slice(sealed.indexOf('data-hand-set'))).not.toContain('<button')
    })

    it('S8 R-3.1-H1 the pouch sealed: its good, its short name, a lock, hidden from the others', () => {
        expect(plain(textOf(sealed, 'data-tray-label="pouch"') ?? '')).toBe('Pouch sealed')
        const pouch = sealed.slice(sealed.indexOf('data-set-pouch'))
        expect(sealed).toContain('data-set-pouch="sulfur"')
        expect(pouch).toContain('aria-label="sulfur"')
        expect(pouch).toContain('data-lock')
        expect(plain(untitled(pouch))).toContain(
            '2 in a row hidden from the others until the reveal'
        )
    })

    it('S8 without a good the pouch reads none', () => {
        const none = markupOf({ kind: 'hand-set', paint, cards })
        expect(none).toContain('data-set-pouch="none"')
        expect(plain(textOf(none, 'data-tray-label="pouch"') ?? '')).toBe('Pouch none')
        expect(none).not.toContain('data-lock')
    })

    it('S8 R-3.1-H1 the waiting line stands right after the tray, in the accent', () => {
        expect(sealed.indexOf('data-waiting')).toBeGreaterThan(sealed.indexOf('data-set-pouch'))
        expect(textOf(sealed, 'data-waiting')).toBe('Waiting for Ben and Cyd to finalise')
        expect(sealed).toMatch(/class="[^"]*text-feudum-accent[^"]*"[^>]*data-waiting/)
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
        expect(markup).toContain('aria-label="Show on board: Move"')
        expect(markup).not.toContain('data-preview="Forfeit"')
    })

    it('the touch preview says on its face what it does, not only to a screen reader', () => {
        const markup = markupOf(rowsBlock('modes', [lit]))
        expect(textOf(markup, 'label-wide')).toBe('Show on board')
        expect(textOf(markup, 'label-narrow')).toBe('On board')
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

    it('R-4.5 a guild choice is its die: the badge gives the rank, the caption the guild, the label the name', () => {
        const markup = markupOf(
            rowsBlock('characters', [
                {
                    choice: { label: 'Farmer, journeyman', picked: true },
                    press: nothing,
                    art: { kind: 'die', guild: 'farmer', rank: 'journeyman' }
                }
            ])
        )
        expect(markup).toContain('aria-label="Farmer, journeyman"')
        expect(markup).toContain('title="Farmer, journeyman"')
        expect(markup).toContain('data-die="farmer"')
        expect(textOf(markup, 'data-badge')).toBe('J')
        expect(textOf(markup, 'data-die-caption')).toBe('Farmer')
        expect(markup).toContain('aria-pressed="true"')
        // The rank stays in the name only: no rank words, no pawn in the press.
        expect(markup.replace(/"[^"]*"/g, '')).not.toContain('journeyman')
        expect(markup).not.toContain('data-pawn')
    })

    it.each([
        ['master', 'M'],
        ['apprentice', 'A'],
        ['none', '–']
    ] as const)('R-4.5 a die badged %s reads %s', (rank, badge) => {
        const markup = markupOf(
            rowsBlock('characters', [
                {
                    choice: { label: 'Knight', picked: false },
                    press: nothing,
                    art: { kind: 'die', guild: 'knight', rank }
                }
            ])
        )
        expect(textOf(markup, 'data-badge')).toBe(badge)
        expect(/class="badge[^"]*\bnone\b/.test(markup)).toBe(rank === 'none')
    })

    it('a guild that gives no rank of its own has a die without a badge', () => {
        const markup = markupOf(
            rowsBlock('guilds', [
                {
                    choice: { label: 'Monk', picked: false },
                    press: nothing,
                    art: { kind: 'die', guild: 'monk' }
                }
            ])
        )
        expect(markup).toContain('data-die="monk"')
        expect(markup).not.toContain('data-badge')
    })

    it("R-3.13 a block's heading stands before its rows: the attack's saltpeter count", () => {
        const markup = markupOf(rowsBlock('saltpeter', [aRow('Add')], 'Saltpeter 2'))
        const rowsAt = markup.indexOf('data-rows="saltpeter"')
        const headingAt = markup.indexOf('>Saltpeter 2</span>')
        expect(rowsAt).toBeGreaterThan(-1)
        expect(headingAt).toBeGreaterThan(rowsAt)
        expect(markup.indexOf('Add', rowsAt)).toBeGreaterThan(headingAt)
    })

    it('the pouch block is the group named Pouch, and a picked row says so', () => {
        const markup = markupOf(rowsBlock('pouch', [aRow('Iron', { picked: true })]))
        expect(markup).toContain('data-rows="pouch"')
        expect(markup).toContain('aria-label="Pouch"')
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
        expect(markup).toContain(`aria-label="Bram's noble pawn"`)
    })

    it('S13 R-3.6 a pawn from supply stands in its row as a cube with a bare top face', () => {
        const markup = markupOf(
            rowsBlock('flow', [{ ...aRow('Pawn from supply'), art: { kind: 'pawn', paint } }])
        )
        expect(markup).toContain('data-row="Pawn from supply"')
        expect(markup).toContain(`aria-label="Bram's pawn"`)
        expect(markup).toContain('Pawn from supply</span>')
    })

    it("R-4.3 a held tile stands in its row as its art, its name kept as the row's name", () => {
        const markup = markupOf(
            rowsBlock('covers', [
                {
                    ...aRow('Badlands I tile: food', { shown: 'for food' }),
                    art: {
                        kind: 'tile',
                        name: 'Badlands I',
                        epoch: 1,
                        region: 'badlands',
                        landscape: 'orchard'
                    }
                }
            ])
        )
        expect(markup).toContain('aria-label="Badlands I tile: food"')
        expect(markup).toContain('aria-label="orchard"')
        // The text beside the art says what the row does; the name is no longer written out.
        expect(markup).toContain('<span class="beside-art">for food</span>')
        expect(markup).not.toContain('>Badlands I')
    })

    it('S1 R-1.4.8 the sulfur’s line stands under the goods on a line of its own, each choice named for what it does', () => {
        const markup = markupOf(
            { kind: 'rows', name: 'goods', rows: [aRow('Sulfur 25', { picked: true })] },
            {
                kind: 'rows',
                name: 'sulfur',
                heading: 'Sulfur:',
                line: true,
                rows: [
                    aRow('Keep the sulfur', { shown: 'Keep it', picked: true }),
                    aRow('Put the sulfur into the barrel', { shown: 'Into the barrel' })
                ]
            }
        )
        const [goods, line] = markup.split('data-rows="sulfur"')
        expect(goods).toContain('data-row="Sulfur 25"')
        expect(goods).not.toContain('Keep it')
        expect(line).toContain('Sulfur:')
        expect(line).toContain('aria-label="Keep the sulfur"')
        expect(line).toContain('aria-label="Put the sulfur into the barrel"')
        expect(line).toContain('>Into the barrel<')
        expect(markup).toMatch(/class="[^"]*w-full[^"]*"[^>]*data-rows="sulfur"/)
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

    it('the eleven of a draft stand in rows of six; the hand in one line', () => {
        expect(cards('draft')).toContain('grid-template-columns: repeat(6, minmax(0, 72px))')
        expect(cards('hand')).toContain('data-hand-line')
        expect(cards('hand')).not.toContain('grid-template-columns')
    })
})

describe('R-3.1 the hand draft: the eleven, the plan, the pouch and the send', () => {
    const tax = {
        kind: 'tax',
        label: 'Tax',
        number: 3,
        picked: true,
        slot: 1,
        press: nothing
    } as const
    const move = { kind: 'move', label: 'Move', number: 2, picked: false, press: nothing } as const
    const pouch = (refusal?: string): ActionRow[] => [
        {
            choice: {
                label: 'Saltpeter: 5 cards',
                picked: false,
                shown: '+1 card',
                ...(refusal ? { refusal } : {})
            },
            art: { kind: 'good', good: 'saltpeter' },
            caption: 'opens a fifth slot',
            press: nothing
        },
        {
            choice: { label: 'Sulfur: two cards back to back', picked: true, shown: '2 in a row' },
            art: { kind: 'good', good: 'sulfur' },
            caption: 'once this round',
            press: nothing
        }
    ]
    const draft = (refusal?: string) =>
        markupOf(
            { kind: 'cards', tone: 'draft', paint, rows: [tax, move] },
            {
                kind: 'finalise',
                entries: [
                    {
                        playerId: 'p1',
                        name: 'Ana',
                        paint,
                        finalised: false,
                        you: true,
                        awaited: false
                    }
                ],
                caption: 'everyone at once · pouch goods shown when all have finalised',
                lead: 'Round 2 · choose your hand',
                stands: 'draft'
            },
            { kind: 'line', role: 'count', text: '1 of 4', lead: 'Hand', stands: 'draft' },
            {
                kind: 'slots',
                paint,
                slots: [{ at: 1, card: tax }, { at: 2 }, { at: 3 }, { at: 4 }],
                caption: 'play in any order',
                stands: 'draft'
            },
            {
                kind: 'rows',
                name: 'pouch',
                heading: 'Pouch',
                hint: 'one or none',
                rows: pouch(refusal),
                stands: 'draft'
            },
            {
                kind: 'primary',
                label: 'Long live the king',
                note: "finalise · can't be undone",
                enabled: false,
                send: nothing,
                stands: 'draft'
            }
        )
    const all = (markup: string, attribute: string) =>
        [...markup.matchAll(new RegExp(`${attribute}[^>]*>([^<]*)<`, 'g'))].map(([, t]) => t)

    it('a drafted card stands dimmed among the eleven with its slot number', () => {
        const markup = draft()
        expect(markup.match(/data-slot-badge="1"/g)).toHaveLength(1)
        expect(markup.match(/data-slot-badge=/g)).toHaveLength(1)
        const tax = markup.slice(
            markup.indexOf('data-row="Tax"'),
            markup.indexOf('data-row="Move"')
        )
        expect(tax).toContain('opacity-40')
        expect(tax).toContain('data-slot-badge="1"')
    })

    it('the slots are numbered, the filled one takes its card back, their name says play in any order', () => {
        const markup = draft()
        const slots = [...markup.matchAll(/data-slot="(\d)"/g)].map(([, at]) => Number(at))
        expect(slots).toEqual([1, 2, 3, 4])
        expect(markup).toContain('aria-label="Tax, slot 1: take back"')
        expect(markup.match(/data-slot-empty/g)).toHaveLength(3)
        expect(markup).toContain('aria-label="Your hand · play in any order"')
        // One heading and one caption: the plan has no caption of its own.
        expect(markup).not.toContain('data-plan-caption')
    })

    it('R-3.3 each pouch choice is its art, its short name and what it does; the full words its name', () => {
        const markup = untitled(draft())
        expect(markup).toContain('aria-label="saltpeter"')
        expect(markup).toContain('aria-label="Saltpeter: 5 cards"')
        expect(all(markup, 'data-pouch-title')).toEqual(['+1 card', '2 in a row'])
        expect(all(markup, 'data-pouch-caption')).toEqual(['opens a fifth slot', 'once this round'])
    })

    it('R-3.3 the two goods are the only choices: no empty pouch, and the chosen one is ringed', () => {
        const markup = draft()
        expect(markup).not.toContain('data-empty-pouch')
        const choices = markup.split('data-row=').slice(1)
        const sulfur = choices.find((choice) => choice.startsWith('"Sulfur'))
        const saltpeter = choices.find((choice) => choice.startsWith('"Saltpeter'))
        expect(sulfur).toMatch(/class="[^"]*\bring-2\b/)
        expect(saltpeter).not.toMatch(/class="[^"]*\bring-2\b/)
    })

    it('R-3.3 one that cannot be chosen is dimmed and says why in place of what it does, once', () => {
        const markup = untitled(draft('You hold no saltpeter.'))
        expect(all(markup, 'data-pouch-caption')).toEqual([
            'You hold no saltpeter.',
            'once this round'
        ])
        expect(markup).toContain('aria-label="Saltpeter: 5 cards: You hold no saltpeter."')
        expect(markup).toContain('title="You hold no saltpeter."')
        expect(markup).toContain('aria-disabled="true"')
        expect(markup).not.toContain('data-refusal')
    })

    it('R-3.3 tray A: the reason stands under the pair for a phone, without a press, one line', () => {
        const markup = untitled(draft('You hold no saltpeter.'))
        expect(all(markup, 'data-pouch-reason')).toEqual(['+1 card · You hold no saltpeter.'])
        expect(markup.indexOf('data-pouch-reason')).toBeGreaterThan(
            markup.lastIndexOf('data-pouch-choice')
        )
        // The choice's own name already says why: the line is not read twice.
        expect(markup).toMatch(/aria-hidden="true"[^>]*data-pouch-reason/)
    })

    it('R-3.3 tray A: with both goods to hand there is no reason line', () => {
        expect(draft()).not.toContain('data-pouch-reason')
    })

    it("R-X.2 the send's second line says it finalises and can't be undone", () => {
        const markup = draft()
        expect(textOf(markup, 'data-primary-label')).toBe('Long live the king')
        expect(markup.replace(/<!--.*?-->|<[^>]+>/gs, '')).toContain("finalise · can't be undone")
        expect(markup).toContain(`aria-label="Long live the king · finalise · can't be undone"`)
    })

    it('tray A: the hand, the pouch and the send stand in one tray, each row by its label', () => {
        const markup = draft()
        const tray = markup.slice(markup.indexOf('data-hand-tray'))
        expect(markup.indexOf('data-hand-draft')).toBeLessThan(markup.indexOf('data-cards="draft"'))
        // The heading stands over the eleven, outside the tray; the eleven stand before it.
        expect(markup.indexOf('data-finalise-row')).toBeLessThan(
            markup.indexOf('data-cards="draft"')
        )
        expect(markup.indexOf('data-cards="draft"')).toBeLessThan(markup.indexOf('data-hand-tray'))
        const rows = [...tray.matchAll(/data-tray-row="([a-z]+)"/g)].map(([, name]) => name)
        expect(rows).toEqual(['hand', 'pouch', 'send'])
        const labels = [...tray.matchAll(/data-tray-label="([a-z]+)"/g)].map(([, name]) => name)
        expect(labels).toEqual(['hand', 'pouch'])
        const labelWords = (name: string) => {
            const at = tray.indexOf(`data-tray-label="${name}"`)
            return tray
                .slice(at, tray.indexOf('data-tray-row', at))
                .replace(/^[^>]*>/, '')
                .replace(/<!--.*?-->|<[^>]+>/gs, ' ')
                .replace(/\s+/g, ' ')
                .replace(/<[^>]*$/, '')
                .trim()
        }
        expect(labelWords('hand')).toBe('Hand 1 of 4')
        expect(labelWords('pouch')).toBe('Pouch one or none')
        expect(textOf(tray, 'data-hand-count')).toBe('1 of 4')
        expect(tray.indexOf('data-tray-row="hand"')).toBeLessThan(tray.indexOf('data-plan'))
        expect(tray.indexOf('data-rows="pouch"')).toBeGreaterThan(tray.indexOf('data-plan'))
        expect(tray.indexOf('data-primary')).toBeGreaterThan(tray.indexOf('data-rows="pouch"'))
        expect(markup).toContain('aria-label="Your hand, pouch and finalise"')
    })
})

describe('R-3.2 the picked card’s tray', () => {
    const hand: ActionBlock = {
        kind: 'cards',
        tone: 'hand',
        paint,
        rows: [
            { kind: 'tax', label: 'Tax', number: 7, picked: false, press: nothing },
            { kind: 'improve', label: 'Improve', number: 4, picked: true, press: nothing },
            { kind: 'move', label: 'Move', number: 2, picked: false, press: nothing }
        ]
    }
    const tray = markupOf(
        hand,
        { kind: 'line', role: 'flow', text: 'Pick a place you rule.', stands: 'tray' },
        {
            kind: 'rows',
            name: 'modes',
            stands: 'tray',
            rows: [
                { ...aRow('Improve', { picked: true }), explained: true },
                {
                    ...aRow('Tend Landscape · 1 wood', {
                        shown: 'Tend Landscape',
                        cost: { kind: 'good', good: 'wood', count: 1 },
                        refusal: 'You hold no wood.'
                    }),
                    explained: true
                }
            ]
        },
        { kind: 'primary', label: 'Improve', enabled: true, send: nothing, stands: 'tray' },
        { kind: 'rows', name: 'card', stands: 'tray', rows: [{ ...aRow('Forfeit'), quiet: true }] }
    )
    const at = (text: string) => tray.indexOf(text)

    it('stands right after the picked card, before the next, under the card’s name', () => {
        expect(at('data-card-tray')).toBeGreaterThan(at('data-row="Improve" data-picked'))
        expect(at('data-card-tray')).toBeGreaterThan(at('data-row="Tax"'))
        expect(at('data-card-tray')).toBeLessThan(at('data-row="Move"'))
        expect(tray).toContain('aria-label="Improve: what the card does"')
    })

    it('holds the line, the modes, the send, then Forfeit last and quiet', () => {
        const order = ['Pick a place you rule.', 'data-rows="modes"', 'data-primary', 'Forfeit']
        const places = order.map(at)
        expect(places.every((place) => place > at('data-card-tray'))).toBe(true)
        expect([...places].sort((a, b) => a - b)).toEqual(places)
        expect(places.at(-1)).toBeLessThan(at('data-row="Move"'))
        expect(tray).toMatch(/data-row="Forfeit"[^]*?data-quiet/)
    })

    it('R-3.4 a special shows its cost as goods art and, refused, its reason beneath', () => {
        const special = tray.slice(at('data-row="Tend Landscape · 1 wood"'))
        expect(special).toContain('aria-label="Tend Landscape · 1 wood: You hold no wood."')
        expect(special).toContain('title="You hold no wood."')
        expect(special).toContain('aria-label="wood"')
        const cost = special.slice(special.indexOf('data-cost'), special.indexOf('data-reason'))
        // The drawn wood (its title), then its count.
        expect(cost.replace(/<!--.*?-->|<[^>]+>/gs, '')).toMatch(/wood\s*1\b/)
        expect(special).toContain('data-reason')
        expect(special).toContain('You hold no wood.')
    })

    it('the at-will chips stand at the end of the hand line, after every card', () => {
        const chips = markupOf(hand, {
            ...rowsBlock('at-will', [aRow('Tiles 1')]),
            stands: 'hand-end'
        })
        expect(chips.indexOf('data-hand-end')).toBeGreaterThan(chips.indexOf('data-row="Move"'))
        expect(chips.indexOf('data-row="Tiles 1"')).toBeGreaterThan(chips.indexOf('data-hand-end'))
        expect(chips).not.toContain('data-card-tray')
    })
})

describe('Contract, Pick conventions: art first, words second', () => {
    it('an at-will chip is its piece and its count; its words stay its accessible name', () => {
        const markup = markupOf(
            rowsBlock('at-will', [
                { ...aRow('Writs 1', { shown: '1' }), art: { kind: 'writ-back' } },
                { ...aRow('Immunity 1', { shown: '1' }), art: { kind: 'seal' } },
                { ...aRow('Vessels 2', { shown: '2' }), art: { kind: 'vessel', vessel: 'ship' } }
            ])
        )
        expect(markup).toContain('aria-label="Writs 1"')
        expect(markup).toContain('aria-label="Writ back"')
        expect(markup).toContain('aria-label="king\'s seal"')
        expect(markup).toContain('aria-label="ship"')
        expect(textOf(untitled(markup), 'data-row="Writs 1"')).toBe('1')
    })

    it('R-3.9-H1 a disc choice is the disc with its back peeking behind it, captioned by the back', () => {
        const markup = markupOf(
            rowsBlock('discs', [
                {
                    ...aRow('Town disc, back: farm', { shown: 'back: farm' }),
                    art: { kind: 'disc', location: 'town', back: 'farm' }
                }
            ])
        )
        const choice = markup.slice(markup.indexOf('data-row="Town disc, back: farm"'))
        expect(choice).toContain('aria-label="Town disc, back: farm"')
        expect(choice).toContain('data-disc-back="farm"')
        expect(choice.indexOf('aria-label="farm"')).toBeLessThan(
            choice.indexOf('aria-label="town"')
        )
        const words = untitled(choice.slice(choice.indexOf('>') + 1))
            .replace(/<!--.*?-->|<[^>]+>/gs, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        expect(words).toBe('back: farm')
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
            label: 'Long live the king',
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
            { playerId: 'p1', done: true, deciding: false },
            { playerId: 'p2', done: false, deciding: true }
        ]
    })

    it('S53 R-4.10-H4 the seats in order as chips: a tick on those done, a solid ring on each deciding, no words', () => {
        expect(row).not.toContain('Nourish')
        const [ana, ben] = partsOf(row, 'data-order-seat')
        expect(ana).toContain('✓')
        expect(ana).toContain('aria-label="done"')
        expect(ana).not.toContain('data-deciding')
        expect(ana).not.toContain('ring-1')
        expect(ben).toContain('data-deciding')
        expect(ben).toContain('ring-1')
        expect(ben).not.toContain('✓')
        expect(row).not.toContain('data-next')
        // The ring's state is read out, not shown.
        expect(ben).toContain('<span class="sr-only">deciding</span>')
        for (const word of ['next', 'deciding', 'nothing to decide', 'you']) {
            expect(row).not.toContain(`· ${word}`)
        }
        expect(row).not.toContain('data-phone-word')
        expect(row).not.toContain('>you<')
        expect(row).not.toContain('border-dashed')
    })

    it('S55 the landscapes step heads the same row, with the next seat marked', () => {
        const landscapes = markupOf({
            kind: 'order-row',
            step: 'landscapes',
            seats,
            entries: [
                { playerId: 'p1', done: false, next: true },
                { playerId: 'p2', done: false, next: false }
            ]
        })
        expect(landscapes).not.toContain('Landscapes')
        expect(landscapes).toContain('data-order-row="landscapes"')
        const [ana, ben] = partsOf(landscapes, 'data-order-seat')
        expect(ana).toContain('data-next')
        expect(ana).toContain('ring-1')
        expect(ana).not.toContain('· next')
        expect(ben).not.toContain('data-next')
        expect(ben).not.toContain('ring-1')
        expect(landscapes).not.toContain('data-deciding')
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
        beforeDawn: 0,
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
        expect(rows).toEqual([
            'before-dawn',
            'dawn',
            'voyage',
            'empire',
            'shillings',
            'charters',
            'total'
        ])
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
        expect(charter).toMatch(/data-charter-score[^>]*>6 vp<\/span>/)
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

    it('S50 each writ offered is a group named by its writ, so its buttons say whose they are', () => {
        const offers = markupOf({
            kind: 'writ-offers',
            offers: [
                { writId: Charter, name: 'Charter', rows: [aRow('Seal')] },
                { writId: 'writ.mandate.3', name: 'Mandate 3', rows: [aRow('A')] }
            ]
        })
        const groups = [...offers.matchAll(/<div[^>]*data-writ-offer=[^>]*>/g)].map(([tag]) => tag)
        expect(groups).toHaveLength(2)
        expect(groups[0]).toMatch(
            /role="group"[^>]*aria-label="Charter"|aria-label="Charter"[^>]*role="group"/
        )
        expect(groups[1]).toMatch(
            /role="group"[^>]*aria-label="Mandate 3"|aria-label="Mandate 3"[^>]*role="group"/
        )
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

describe('R-4.10 S53 the nourish picker', () => {
    const option = (
        label: string,
        good: 'food' | 'sulfur' | undefined,
        shown: string,
        caption: string | undefined,
        more: Partial<PanelChoice> & { spent?: boolean } = {}
    ) => {
        const { spent = false, ...choice } = more
        return {
            ...aRow(label, { shown, ...choice }),
            ...(good ? { art: { kind: 'good' as const, good } } : {}),
            feed: label.toLowerCase() as 'food' | 'wine' | 'unfed',
            ...(caption ? { caption } : {}),
            spent
        }
    }
    const block = (unfed: boolean): ActionBlock => ({
        kind: 'nourish-picker',
        pawns: [
            {
                n: 1,
                character: 'knight',
                name: 'Knight',
                place: 'Badlands 1',
                paint,
                unfed: false,
                options: [
                    option('Food', 'food', '', undefined, { picked: true }),
                    option('Wine', 'sulfur', '', '2 rounds · 0 strength')
                ]
            },
            {
                n: 2,
                character: 'merchant',
                name: 'Merchant',
                place: 'Badlands 4',
                paint,
                unfed,
                options: [
                    option('Food', 'food', '', undefined, { picked: !unfed, spent: unfed }),
                    ...(unfed
                        ? [option('Unfed', undefined, 'unfed', undefined, { picked: true })]
                        : [])
                ]
            }
        ],
        send: {
            kind: 'primary',
            label: unfed ? 'Feed 1 · leave 1' : 'Feed 2 · 2 food',
            enabled: true,
            send: nothing,
            tally: { fed: unfed ? 1 : 2, food: unfed ? 1 : 2, wine: 0 }
        }
    })

    it('S53 each pawn is its cube, its name and place, and its feeds as art; wine alone has a line, its cost', () => {
        const markup = markupOf(block(false))
        const [knight, merchant] = partsOf(markup, 'data-nourish-pawn')
        expect(knight).toContain('data-pawn-cube')
        expect(textOf(knight, 'data-pawn-name')).toBe('Knight')
        expect(textOf(knight, 'data-pawn-place')).toBe('Badlands 1')
        expect(knight).toMatch(/data-feed="food"[^>]*data-picked/)
        expect(knight).toMatch(/<title>food<\/title>/)
        expect(knight.split('data-caption')).toHaveLength(2)
        expect(knight).toContain('2 rounds · 0 strength')
        for (const gone of ['1 food', 'to the haversack', 'none left', 'barrel empty', '>wine<']) {
            expect(untitled(markup)).not.toContain(gone)
        }
        expect(merchant).not.toContain('data-feed="wine"')
        expect(merchant).not.toContain('data-unfed')
    })

    it('S53 no summary and no rule: the send follows the rows and draws what is paid as art', () => {
        const markup = markupOf(block(false))
        expect(markup).not.toContain('data-nourish-summary')
        expect(markup).not.toContain('data-nourish-rule')
        for (const gone of ['Pays', 'you keep', 'Every pawn must eat', 'its vessel stays']) {
            expect(untitled(markup)).not.toContain(gone)
        }
        const send = partsOf(markup, 'data-nourish-send')[0]
        expect(send).toContain('data-primary')
        expect(send).toContain('data-send-art')
        expect(send).toContain('<title>food</title>')
        const words = untitled(send).replace(/<!--.*?-->|<[^>]+>/gs, '')
        expect(words).toMatch(/Feed 2\s*·\s*2\b/)
        expect(words).not.toContain('food')
    })

    it('S53 short of food, the unfed row is rose, the spent food dimmed, and the send counts who is left', () => {
        const markup = markupOf(block(true))
        const merchant = partsOf(markup, 'data-nourish-pawn')[1]
        expect(merchant.split('>')[0]).toContain('border-feudum-danger')
        expect(merchant).toContain('data-unfed')
        expect(merchant).toMatch(/data-feed="food"[^>]*data-spent/)
        expect(merchant).not.toContain('back to your supply')
        expect(merchant).not.toContain('none left')
        expect(textOf(markup, 'data-primary')).toBe('Feed 1 · leave 1')
        expect(markup).not.toContain('data-send-art')
    })
})

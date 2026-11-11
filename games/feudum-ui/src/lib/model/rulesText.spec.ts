import { describe, expect, it } from 'vitest'
import { ActionCards, Charters, GuildById, GuildIds, Mandates, RoyalWrits } from '@tabletop/feudum'
import { NotedIds, RulesNotes, rulesNoteOf } from './rulesText.js'

const paint = { fill: '#336699', ink: '#000', edge: '#000', owner: "Ana's" }

/** The data's own wording, which is the rulebook's: no note repeats it. */
const PrintedWording: readonly string[] = [
    ...ActionCards.flatMap(({ regularAction, special }) => [regularAction, special.effect]),
    ...Charters.map(({ text }) => text),
    ...Mandates.flatMap((mandate) =>
        mandate.kind === 'turn-in' ? mandate.alternatives.map(({ text }) => text) : [mandate.text]
    )
]

const lines = (id: string) => RulesNotes[id]?.lines ?? []

describe('the rules beside an enlarged piece (contract: Card preview)', () => {
    it('R-3.5, R-4.4, R-4.6 every card, writ and guild that can be enlarged face up reads a note', () => {
        expect(NotedIds).toHaveLength(11 + RoyalWrits.length + GuildIds.length)
        for (const id of NotedIds) {
            const note = RulesNotes[id]
            expect(note?.title, id).toBeTruthy()
            expect(note?.lines.length, id).toBeGreaterThan(0)
            for (const { term, text } of note?.lines ?? []) {
                expect(term.trim(), id).not.toBe('')
                expect(text.trim(), id).not.toBe('')
            }
        }
    })

    it('holds a note for nothing else', () => {
        expect(new Set(Object.keys(RulesNotes))).toEqual(new Set(NotedIds))
    })

    it('R-7 no note repeats the printed wording the data holds', () => {
        for (const id of NotedIds) {
            for (const { text } of lines(id)) {
                for (const printed of PrintedWording) {
                    expect(text.toLowerCase(), id).not.toContain(printed.toLowerCase())
                }
            }
        }
    })

    it('R-3.4, R-3.15 a card reads as repeatable exactly where it carries the x2', () => {
        for (const card of ActionCards) {
            const repeat = lines(card.id).find(({ term }) => term === 'Repeat')?.text ?? ''
            if (card.symbols.replay === 'x2') {
                expect(repeat, card.id).toMatch(/may play it again/)
            } else if (card.symbols.replay === 'crossed-x2') {
                expect(repeat, card.id).toMatch(/^Neither/)
            } else {
                expect(repeat, card.id).toBe('')
            }
        }
    })

    it('R-3.5 a card names its special ability by its printed title', () => {
        for (const card of ActionCards) {
            expect(lines(card.id).map(({ term }) => term)).toContain(card.special.name)
        }
    })

    it('R-4.6 a guild reads its trade, its pull and its push', () => {
        for (const guild of GuildIds) {
            const note = RulesNotes[`guild.${guild}`]
            expect(note?.title).toBe(`${GuildById[guild].name} Guild`)
            expect(note?.lines.map(({ term }) => term.split(' ')[0])).toEqual([
                'Trade',
                'Pull',
                'Push'
            ])
        }
    })

    it('R-6.2-H1 a kingdom charter names each space it counts', () => {
        for (const charter of Charters) {
            if (charter.kind === 'kingdom') {
                const scores = lines(charter.id)[0]?.text ?? ''
                expect(scores).toContain(charter.vpByLocationsRuled.join(' / '))
                expect(scores.match(/[A-Z][a-z]+ \d/g)).toHaveLength(charter.spaces.length)
            }
        }
    })

    it('R-4.4.4, R-5.1 a back, a tile and a bead read none; a face its own', () => {
        expect(rulesNoteOf({ kind: 'card', faceShown: false, paint })).toBeUndefined()
        expect(rulesNoteOf({ kind: 'card', faceShown: true, card: 'tax', paint })?.title).toBe(
            'Tax'
        )
        expect(rulesNoteOf({ kind: 'writ', faceShown: false })).toBeUndefined()
        expect(
            rulesNoteOf({ kind: 'writ', faceShown: true, writId: 'writ.mandate.6' })?.title
        ).toBe('Mandate 6')
        expect(rulesNoteOf({ kind: 'tile', faceShown: true, epoch: 1 })).toBeUndefined()
        expect(rulesNoteOf({ kind: 'bead', faceShown: true, beadValue: 2 })).toBeUndefined()
    })
})

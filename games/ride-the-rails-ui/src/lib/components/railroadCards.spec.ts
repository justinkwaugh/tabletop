import { describe, expect, it } from 'vitest'

// Contract, The table: what the railroad cards' and the round tickets' sources must hold.
const SOURCES = import.meta.glob(
    ['./RailroadCards.svelte', './PhoneSupplyRail.svelte', './panel/RoundTickets.svelte'],
    { query: '?raw', import: 'default', eager: true }
)

function source(file: string): string {
    return String(SOURCES[file])
}

describe('the desktop railroad cards', () => {
    it('draw the name and the pile alone: no track count, and no holders (the seat cards show the shares)', () => {
        const cards = source('./RailroadCards.svelte')
        expect(cards).toMatch(/<SupplyPile\b/)
        expect(cards).not.toMatch(/track/)
        expect(cards).not.toMatch(/shareholders/)
        expect(cards).not.toMatch(/seatInitials/)
        expect(cards).not.toMatch(/class="(?:holders?|disc)"/)
        expect(cards).toMatch(/label=\{card\.label\}/)
    })
})

describe('the phone rail', () => {
    it('opens a pile’s holders without its track count, its name listing the holders', () => {
        const rail = source('./PhoneSupplyRail.svelte')
        expect(rail).toMatch(/\{#each card\.shareholders as holding/)
        expect(rail).not.toMatch(/trackCount|class="track"/)
        expect(rail).toMatch(/label=\{card\.pileLabel\}/)
    })
})

describe('the round tickets', () => {
    it('fill each ticket with its round’s arriving railroads, and name them', () => {
        const tickets = source('./panel/RoundTickets.svelte')
        expect(tickets).toMatch(/roundTickets\(/)
        expect(tickets).toMatch(/style:background=\{ticket\.paint\?\.background\}/)
        expect(tickets).toMatch(/style:color=\{ticket\.paint\?\.ink\}/)
        expect(tickets).toMatch(/aria-label=\{ticket\.label\}/)
        expect(tickets).toMatch(/aria-current=/)
        expect(tickets).toMatch(/use:flights\.register=\{roundTicketKey\(ticket\.round\)\}/)
    })
})

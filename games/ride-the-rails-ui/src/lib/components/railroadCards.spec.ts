import { describe, expect, it } from 'vitest'

// Contract, The table: what the railroad cards' and the round tickets' sources must hold.
const SOURCES = import.meta.glob(
    [
        './RailroadCards.svelte',
        './ShareButton.svelte',
        './panel/TakeSharePanel.svelte',
        './panel/BuildPanel.svelte',
        './panel/RoundTickets.svelte'
    ],
    { query: '?raw', import: 'default', eager: true }
)

function source(file: string): string {
    return String(SOURCES[file])
}

describe('the desktop railroad cards', () => {
    it('draw the supply alone: no name head, no track count, and no holders (the seat cards show the shares)', () => {
        const cards = source('./RailroadCards.svelte')
        expect(cards).toMatch(/<SupplyCount\b/)
        expect(cards).not.toMatch(/class="head\b/)
        expect(cards).not.toMatch(/\.name\b|railroadName/)
        expect(cards).not.toMatch(/trackCount|\.track\b/)
        expect(cards).not.toMatch(/shareholders/)
        expect(cards).toMatch(/label=\{button\.label\}/)
    })

    it('become the share buttons while the viewer takes a share', () => {
        expect(source('./RailroadCards.svelte')).toMatch(
            /\{#if sharing\}\s*<ShareButton \{button\} dots=\{false\} \/>/
        )
        const share = source('./ShareButton.svelte')
        expect(share).toMatch(/<SupplyCount\b/)
        expect(share).toMatch(/aria-label=\{button\.shareLabel\}/)
        expect(share).toMatch(/gameSession\.takeShare\(button\.railroadId\)/)
    })
})

describe('the action panel’s piles', () => {
    it('draw Take a share’s buttons as the desktop cards’ share buttons, with no railroad names', () => {
        const panel = source('./panel/TakeSharePanel.svelte')
        expect(panel).toMatch(/<ShareButton \{button\} \/>/)
        expect(panel).not.toMatch(/railroadName|RailroadPieceIcon|\.name\b/)
    })

    it('show only the building seat’s buildable railroads, each holding its spotlight', () => {
        const panel = source('./panel/BuildPanel.svelte')
        expect(panel).toMatch(/buildableRailroads\(/)
        expect(panel).toMatch(/<RailroadSpotlightControl\b/)
        expect(panel).toMatch(/<SupplyCount\b/)
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

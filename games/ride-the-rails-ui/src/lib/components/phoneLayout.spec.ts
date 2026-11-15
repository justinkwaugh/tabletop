import { describe, expect, it } from 'vitest'

// Contract, Phone layout: what the table's sources must hold for a phone.
const SOURCES = import.meta.glob(['./*.svelte', './board/*.svelte', './panel/*.svelte'], {
    query: '?raw',
    import: 'default',
    eager: true
})

function source(file: string): string {
    return String(SOURCES[file])
}

describe('the phone layout', () => {
    it('reads the table’s components', () => {
        expect(Object.keys(SOURCES).length).toBeGreaterThanOrEqual(30)
    })

    it('moves the view from the board’s overlay, so it follows the offer in full screen too', () => {
        expect(source('./GameTable.svelte')).toMatch(
            /\{#snippet overlay\(viewport\)\}\s*<BoardViewFollower\b/
        )
    })

    it('renders the action area in the wrapper’s toolbar, so a turn can be played in full screen', () => {
        expect(source('./GameTable.svelte')).toMatch(
            /\{#snippet toolbar\(\)\}[\s\S]*<FullScreenControls \/>[\s\S]*\{\/snippet\}/
        )
        expect(source('./panel/FullScreenControls.svelte')).toMatch(/<TableControls \/>/)
        expect(source('./panel/TableControls.svelte')).toMatch(/<ActionArea \/>/)
    })

    it('keeps the railroad cards above the board and the supply rail beside it, outside the scaling', () => {
        const table = source('./GameTable.svelte')
        const wrapper = table.search(/^\s*<ScalingWrapper\b/m)
        const wrapperEnd = table.indexOf('</ScalingWrapper>')
        const cards = table.indexOf('<RailroadCards />')
        const rail = table.indexOf('<PhoneSupplyRail />')
        expect(cards).toBeGreaterThan(-1)
        expect(cards).toBeLessThan(wrapper)
        expect(rail).toBeGreaterThan(wrapperEnd)
        expect(source('./RailroadCards.svelte')).toMatch(
            /class="railroad-cards flex max-sm:hidden"/
        )
        expect(source('./PhoneSupplyRail.svelte')).toMatch(/class="phone-rail flex sm:hidden"/)
    })

    it('makes every lit target the whole hex', () => {
        expect(source('./board/HitLayer.svelte')).toMatch(
            /<polygon\s+points=\{hex\.points\}[^>]*role="button"/
        )
    })

    it('puts no information behind hover: no tooltips and no hover-only styles', () => {
        for (const [file, text] of Object.entries(SOURCES)) {
            expect(String(text), `a tooltip in ${file}`).not.toMatch(/\btitle="[^"]+"|\btitle=\{/)
            expect(String(text), `a hover rule in ${file}`).not.toMatch(/:hover\b/)
            expect(String(text), `a hover-only reveal in ${file}`).not.toMatch(/group-hover:/)
        }
    })
})

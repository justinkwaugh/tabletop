import { describe, expect, it } from 'vitest'

const components = import.meta.glob<string>('./*.svelte', {
    query: '?raw',
    import: 'default',
    eager: true
})

/** A toggle button that draws a player's name chip: a player chip of the component's own. */
function ownPlayerChips(source: string): string[] {
    return [...source.matchAll(/<button\b[\s\S]*?<\/button>/g)]
        .map((match) => match[0])
        .filter((button) => button.includes('<PlayerName') && button.includes('aria-pressed'))
}

/**
 * Contract, "A card that changes an action": a player a power names is a chip button, each in a
 * frame, the group at the widest one's width and 44 px tall on a phone, drawn by `PlayerChips`
 * alone, so every power's players look and answer a tap alike, Witch's Bargain's from revision 7 too.
 */
describe('a power’s players are its chips', () => {
    it('the power picker and Witch’s Bargain draw their players with PlayerChips, never a chip of their own', () => {
        for (const name of ['./PowerChoicePicker.svelte', './BargainPicker.svelte']) {
            const source = components[name] ?? ''
            expect(source, name).toContain('<PlayerChips')
            expect(ownPlayerChips(source), name).toEqual([])
        }
    })
})

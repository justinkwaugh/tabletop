// @vitest-environment node
import { render } from 'svelte/server'
import { describe, expect, it, vi } from 'vitest'
import { GuildById, GuildIds, HydratedFeudumGameState, RoyalWrits } from '@tabletop/feudum'
import GuildAreas from '$lib/components/guilds/GuildAreas.svelte'
import { PlainChrome, type BoardChrome } from '$lib/model/boardChrome.js'
import { guildTarget } from '$lib/model/boardOffer.js'
import { RulesNotes } from '$lib/model/rulesText.js'
import type { EnlargedFace } from '$lib/model/tableLayers.svelte.js'
import EnlargedOnTable from '$lib/testing/EnlargedOnTable.svelte'
import GuildAreasOnTable from '$lib/testing/GuildAreasOnTable.svelte'
import { atPlayingCards } from '$lib/testing/turnTable.js'
import EnlargedLayer from './EnlargedLayer.svelte'

const paint = {
    fill: '#336699',
    ink: 'var(--feudum-text)',
    edge: 'var(--feudum-map-ink)',
    owner: "Ana's"
}

const Faces: readonly EnlargedFace[] = [
    { kind: 'card', faceShown: true, card: 'conquer', paint, number: 3 },
    { kind: 'card', faceShown: false, paint },
    { kind: 'writ', faceShown: true, writId: RoyalWrits[0].id },
    { kind: 'tile', faceShown: true, epoch: 2, landscape: 'orchard' },
    { kind: 'bead', faceShown: true, beadValue: 4 }
]

function layer(face: EnlargedFace): string {
    return render(EnlargedLayer, { props: { face, width: 420, onClose: () => {} } }).body
}

describe('Card preview (contract: Card preview)', () => {
    it.each(Faces)(
        'R-X.1 the enlarged $kind is its own close press, named Close; no close button stands over it',
        (face) => {
            const markup = layer(face)
            expect(markup).not.toMatch(/>\s*Close\s*</)
            const presses = markup.match(/<button[^>]*>/g) ?? []
            expect(presses.filter((press) => press.includes('data-close'))).toHaveLength(1)
            const close = presses.find((press) => press.includes('data-close')) ?? ''
            expect(close).toContain('aria-label="Close"')
            expect(close).toContain(`data-enlarged="${face.kind}"`)
            expect(markup).toContain('data-backdrop')
        }
    )
})

describe('The rules beside the enlarged piece (contract: Card preview)', () => {
    const note = (markup: string) =>
        /<aside[^>]*data-rules-note[^>]*>([\s\S]*?)<\/aside>/.exec(markup)?.[1]

    it('R-3.5 a face-up card reads its action and its special ability beside it, outside the close press', () => {
        const markup = layer(Faces[0])
        const beside = note(markup) ?? ''
        expect(beside).toContain('Conquer')
        expect(beside).toContain('Starve the People')
        for (const { text } of RulesNotes['card.action.conquer']?.lines ?? []) {
            expect(beside).toContain(text)
        }
        const close = /<button[^>]*data-close[^>]*>[\s\S]*?<\/button>/.exec(markup)?.[0] ?? ''
        expect(close).not.toContain('data-rules-note')
    })

    it('R-4.4 a face-up writ reads its note', () => {
        expect(note(layer(Faces[2]))).toContain(RulesNotes[RoyalWrits[0].id]?.title)
    })

    it('R-4.4.4, R-5.1 a back, a tile and a bead stand alone', () => {
        for (const face of [Faces[1], Faces[3], Faces[4]]) {
            expect(layer(face)).not.toContain('data-rules-note')
        }
    })
})

describe('Guild areas enlarge (contract: Card preview)', () => {
    const paintOf = () => paint

    async function stateAtCards() {
        const { host } = await atPlayingCards(['explore'])
        return new HydratedFeudumGameState(structuredClone(host.state))
    }

    it('R-1.3 on a table each guild area is a press that enlarges it; alone, a plain area', async () => {
        const state = await stateAtCards()
        const onTable = render(GuildAreasOnTable, {
            props: { state, paintOf, colourPaintOf: paintOf }
        }).body
        for (const guild of GuildIds) {
            expect(onTable).toContain(`aria-label="Enlarge ${GuildById[guild].name} guild"`)
        }
        // A bead on the rosary keeps its own press beside the area's.
        expect(onTable).toContain('data-enlarge="bead"')
        const alone = render(GuildAreas, { props: { state, paintOf, colourPaintOf: paintOf } }).body
        expect(alone).not.toContain('data-enlarge=')
    })

    it('R-4.6 a guild lit for a pick is picked by the press, not enlarged; the others still enlarge', async () => {
        const state = await stateAtCards()
        const chrome: BoardChrome = {
            ...PlainChrome,
            offer: { targets: new Map([[guildTarget('monk'), { role: 'lit' }]]), dimsRest: true },
            press: vi.fn()
        }
        const markup = render(GuildAreasOnTable, {
            props: { state, paintOf, colourPaintOf: paintOf, chrome }
        }).body
        expect(markup).not.toContain('data-enlarge="Monk guild"')
        expect(markup).toContain('data-enlarge="Farmer guild"')
    })

    it('R-1.3 the enlarged guild area draws its state at the width given, its beads plain, as one close press', async () => {
        const state = await stateAtCards()
        const face: EnlargedFace = {
            kind: 'guild',
            guild: 'monk',
            state,
            paintOf,
            colourPaintOf: paintOf
        }
        const markup = render(EnlargedOnTable, { props: { face, width: 640 } }).body
        expect(markup).toContain('data-guild="monk"')
        expect(markup).toMatch(/<svg[^>]*\bwidth="640"/)
        expect(markup).not.toContain('data-enlarge=')
        expect(markup.match(/<button/g)).toHaveLength(2)
        expect(markup).toContain('Pull (journeyman)')
    })

    it('R-1.3 the enlarged guild area stands upright, as the trade picker shows it: its long side the size given', async () => {
        const state = await stateAtCards()
        const face: EnlargedFace = {
            kind: 'guild',
            guild: 'monk',
            state,
            paintOf,
            colourPaintOf: paintOf
        }
        const markup = render(EnlargedOnTable, { props: { face, width: 640 } }).body
        const upright = markup.match(/<div[^>]*data-enlarged-upright="monk"[^>]*>/)?.[0]
        expect(upright).toContain('width: 453.12px')
        expect(upright).toContain('height: 640px')
        const turned = markup.match(/<div[^>]*data-upright-turned[^>]*>/)?.[0]
        expect(turned).toContain('width: 640px')
        expect(turned).toContain('height: 453.12px')
    })
})

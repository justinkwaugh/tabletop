import { describe, expect, it } from 'vitest'
import { ActionSource, assert, type Visibility } from '@tabletop/common'
import { engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { registerFixtureSites } from '../testing/fixture.js'
import { served, spectator } from '../testing/projection.js'
import { OathGameStateValidator, type OathProjectedState } from '../model/gameState.js'
import { Region } from '../model/oathEnums.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'
import recorded from './tests/recorded-harp-revision-28.json'

const ROAR = 'denizen.beast.threatening-roar'
const game = testGame(recorded.players)
const SEATS: Record<string, Visibility.Perspective> = {
    spectator,
    dana: { kind: 'player', playerId: 'dana' },
    rhys: { kind: 'player', playerId: 'rhys' }
}

type Segment = (typeof recorded.segments)[number]

function replay(segment: Segment, revision?: OathRevision) {
    registerFixtureSites()
    assert(OathGameStateValidator.Check(segment.initial), 'The recorded state is canonical')
    let state: OathProjectedState = structuredClone(segment.initial)
    if (revision !== undefined) state.oathRevision = revision
    const processed: string[] = []
    for (const action of segment.actions) {
        const result = engine.executeCanonicalAction({
            game,
            state,
            action: { ...action, source: ActionSource.User }
        })
        processed.push(...result.processedActions.map((a) => `${a.type}/${a.source}`))
        state = result.updatedState
    }
    return { state, processed }
}

/** The plays where the kept or second card is Threatening Roar, which discards itself with no question asked. */
const roarDiscardsItself = new Set([
    "Threatening Roar kept and played to the searcher's site discards itself",
    "the same from the Cradle's discard pile",
    'Land Warden: Threatening Roar kept to the site, Rangers played second'
])

// Truthful Harp, then a Search whose kept or second card reaches a pile through its own When Played
// power. Recorded under revision 28 by the engine before the edifices; a game created then replays as it
// was played, every seat's view included.
describe('Truthful Harp plays recorded under revision 28 replay as they were played', () => {
    it.each(recorded.segments)('$name', (segment) => {
        expect(segment.initial.oathRevision).toBe(OathRevision.EngineFixes24)
        const { state, processed } = replay(segment)
        expect(processed).toEqual(segment.processed)
        expect(state).toEqual(segment.expected)
        for (const [seat, perspective] of Object.entries(SEATS))
            expect(served(state, perspective), seat).toEqual(
                segment.served[seat as keyof Segment['served']]
            )
    })
})

// From revision 29 the table knows a card it saw drawn wherever the Search sends it, so Threatening Roar,
// played faceup and discarded by its own power, is known at its place; nothing else changes.
describe('from revision 29, the table knows the Harp-drawn card its own power discards', () => {
    it.each(recorded.segments)('$name', (segment) => {
        const { state, processed } = replay(segment, OathRevision.EngineFixes25)
        expect(processed).toEqual(segment.processed)
        const pile = segment.expected.seenDiscardPiles[Region.Provinces]
        const roarKnown = roarDiscardsItself.has(segment.name)
        if (roarKnown) expect(pile.at(-1)).toEqual({ back: 'denizen' })
        const provinces = roarKnown
            ? [...pile.slice(0, -1), { among: [ROAR], back: 'denizen' }]
            : pile
        expect(state).toEqual({
            ...segment.expected,
            oathRevision: OathRevision.EngineFixes25,
            seenDiscardPiles: {
                ...segment.expected.seenDiscardPiles,
                [Region.Provinces]: provinces
            }
        })
        for (const [seat, perspective] of Object.entries(SEATS))
            expect(served(state, perspective).seenDiscardPiles[Region.Provinces], seat).toEqual(
                provinces
            )
    })
})

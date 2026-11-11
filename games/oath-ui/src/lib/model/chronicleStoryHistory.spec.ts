import { afterEach, describe, expect, it } from 'vitest'
import type { PresentedTransition, TransitionKind } from '@tabletop/frontend-components'
import { gameOneAt } from '$lib/testing/chronicleTables.js'
import { disposeSessions, openSessionOn } from '$lib/testing/sessionHarness.js'

afterEach(() => disposeSessions())

/** What the platform hands `beforeNewState` as it publishes a state of `kind`. */
const transition = (kind: TransitionKind): PresentedTransition => ({
    kind,
    actions: [],
    intent: 'silent'
})

// Policy item 33: a draft's lifetime is decided from the transition kind. Stepping into History
// and back publishes `history` transitions, and toggling full screen a `view-switch`; neither
// changes the live game the story is written for.
describe('the story the winner is typing', () => {
    for (const kind of ['history', 'view-switch'] as const) {
        it(`stays through a ${kind} transition, there and back`, async () => {
            const session = await openSessionOn(gameOneAt('story'))
            session.chronicleStory.edit('The title stayed.')
            session.beforeNewState(transition(kind))
            expect(session.chronicleStory.text).toBe('The title stayed.')
            session.beforeNewState(transition(kind))
            expect(session.chronicleStory.text).toBe('The title stayed.')
        })
    }

    for (const kind of ['own-action', 'other-action', 'undo', 'reconciliation'] as const) {
        it(`is cleared by a ${kind} transition`, async () => {
            const session = await openSessionOn(gameOneAt('story'))
            session.chronicleStory.edit('The title stayed.')
            session.beforeNewState(transition(kind))
            expect(session.chronicleStory.text).toBe('')
        })
    }
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color, assert } from '@tabletop/common'
import {
    ActionType,
    MachineState,
    OathRevision,
    PowerChoiceKind,
    PowerTiming,
    Region,
    SearchSource,
    isSearch,
    powerIndexOf
} from '@tabletop/oath'
import { openTurn, required, testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'
import { withBranch, withOptionPick } from './powerChoices.js'
import type { OathGameSession } from './session.svelte.js'

// R-7.4-H2: from revision 31 Bracken and the Cracked Horn, which name different places for the discards, are not
// used together, so the Search's modifier picker does not offer one while the other is in use.

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const BRACKEN = 'denizen.beast.bracken'
const HORN = 'relic.cracked-horn'
const ERRAND_BOY = 'denizen.beast.errand-boy'
const OBSERVATORY = 'denizen.arcane.observatory'

const FIXED = OathRevision.EngineFixes26
const BEFORE = OathRevision.Chronicle

const use = (cardId: string) => ({ cardId, powerIndex: powerIndexOf(cardId, PowerTiming.Modifier) })

/** Dana at c1 with Bracken and Errand Boy as advisers, the Cracked Horn, and the Observatory at c1. */
async function searching(revision: OathRevision) {
    const state = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                supply: 5,
                relicIds: [HORN],
                advisers: [
                    { cardId: BRACKEN, faceUp: true },
                    { cardId: ERRAND_BOY, faceUp: true }
                ]
            })
        ],
        {
            oathRevision: revision,
            machineState: MachineState.ActPhase,
            denizensBySite: { c1: [OBSERVATORY], c2: [], p1: [], h1: [] },
            discardPileCounts: { cradle: 4, provinces: 3, hinterland: 2 }
        }
    )
    openTurn(state, 'dana')
    const session = await openSessionOn(tableOf(state))
    const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
    session.chooseAction(ActionType.Search)
    return { session, sent }
}

const offered = (session: OathGameSession) => session.modifiers.options.map((p) => p.cardId)
const listed = (session: OathGameSession) => session.modifiers.listed.map((p) => p.cardId)

/** Bracken's pile, then its side: the top of the pile (its first branch) or the bottom. */
function pickBracken(session: OathGameSession, region: Region, bottom: boolean) {
    const power = required(
        session.modifiers.options.find((p) => p.cardId === BRACKEN),
        'Bracken is usable'
    )
    const choice = required(session.modifiers.choicesOf(power)[0], 'Bracken asks for a pile')
    const pick = choice.options.findIndex(
        (o) => o.kind === PowerChoiceKind.Region && o.region === region
    )
    session.modifiers.setPicks(
        use(BRACKEN),
        withOptionPick(session.modifiers.picksOf(use(BRACKEN)), choice, 0, pick)
    )
    session.modifiers.setPicks(
        use(BRACKEN),
        withBranch(session.modifiers.picksOf(use(BRACKEN)), 1, bottom)
    )
}

async function sendWorldDeckSearch(session: OathGameSession) {
    await session.searchFrom(
        required(
            session.searchRows.find((row) => row.source === SearchSource.WorldDeck),
            'the world deck is listed'
        )
    )
}

describe('R-7.4-H2 — the Search picker leaves out a card whose answer disagrees with one in use', () => {
    it('at revision 31, with Bracken in use the Cracked Horn is not offered, before or after its picks', async () => {
        const { session, sent } = await searching(FIXED)
        expect(listed(session)).toContain(HORN)
        expect(listed(session)).toContain(BRACKEN)

        session.modifiers.declare(use(BRACKEN), true)
        expect(offered(session)).not.toContain(HORN)
        expect(listed(session)).not.toContain(HORN)
        pickBracken(session, Region.Hinterland, true)
        expect(offered(session)).not.toContain(HORN)
        expect(listed(session)).not.toContain(HORN)
        session.modifiers.declare(use(HORN), true)
        expect(session.modifiers.isDeclared(use(HORN))).toBe(false)

        await sendWorldDeckSearch(session)
        const action = sent.mock.calls[0][0]
        assert(isSearch(action), 'a Search is sent')
        expect(action.modifiers?.map((m) => m.cardId)).toEqual([BRACKEN])
    })

    it('at revision 31, with the Cracked Horn in use Bracken is not offered, and returns once it is put down', async () => {
        const { session, sent } = await searching(FIXED)
        expect(listed(session)).toContain(BRACKEN)
        session.modifiers.declare(use(HORN), true)
        expect(offered(session)).not.toContain(BRACKEN)
        expect(listed(session)).not.toContain(BRACKEN)
        expect(listed(session)).toContain(HORN)

        session.modifiers.declare(use(HORN), false)
        expect(listed(session)).toContain(BRACKEN)
        expect(listed(session)).toContain(HORN)

        session.modifiers.declare(use(HORN), true)
        await sendWorldDeckSearch(session)
        const action = sent.mock.calls[0][0]
        assert(isSearch(action), 'a Search is sent')
        expect(action.modifiers).toEqual([use(HORN)])
    })

    it('at revision 31 the cards that name the pile are offered as before: declaring one puts the other down', async () => {
        const { session } = await searching(FIXED)
        session.modifiers.declare(use(ERRAND_BOY), true)
        expect(offered(session)).toContain(OBSERVATORY)
        session.modifiers.declare(use(OBSERVATORY), true)
        expect(session.modifiers.isDeclared(use(ERRAND_BOY))).toBe(false)
        expect(session.modifiers.isDeclared(use(OBSERVATORY))).toBe(true)
        expect(offered(session)).toContain(ERRAND_BOY)
    })

    it('before revision 31 both are offered and sent together, as before', async () => {
        const { session, sent } = await searching(BEFORE)
        session.modifiers.declare(use(BRACKEN), true)
        pickBracken(session, Region.Hinterland, true)
        expect(offered(session)).toContain(HORN)
        expect(listed(session)).toContain(HORN)
        session.modifiers.declare(use(HORN), true)
        expect(session.modifiers.isDeclared(use(HORN))).toBe(true)
        expect(session.modifiers.isDeclared(use(BRACKEN))).toBe(true)

        await sendWorldDeckSearch(session)
        const action = sent.mock.calls[0][0]
        assert(isSearch(action), 'a Search is sent')
        expect(action.modifiers?.map((m) => m.cardId)).toEqual([BRACKEN, HORN])
    })
})

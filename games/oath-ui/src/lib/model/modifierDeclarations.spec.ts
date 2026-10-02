import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color, assert } from '@tabletop/common'
import { ActionType, MachineState, PowerChoiceKind, PowerTiming, Region, SearchSource, isSearch, powerIndexOf } from '@tabletop/oath'
import { openTurn, required, testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'
import { emptyPicks, withOptionPick } from './powerChoices.js'
import type { OathGameSession } from './session.svelte.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const BRACKEN = 'denizen.beast.bracken'
const ERRAND_BOY = 'denizen.beast.errand-boy'
const OBSERVATORY = 'denizen.arcane.observatory'

const use = (cardId: string) => ({ cardId, powerIndex: powerIndexOf(cardId, PowerTiming.Modifier) })

function searching(advisers: string[]) {
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                supply: 5,
                advisers: advisers.map((cardId) => ({ cardId, faceUp: true }))
            })
        ],
        {
            machineState: MachineState.ActPhase,
            denizensBySite: { c1: [OBSERVATORY], c2: [], p1: [], h1: [] },
            discardPileCounts: { cradle: 4, provinces: 3, hinterland: 2 }
        }
    )
    openTurn(state, 'me')
    const session = openSessionOn(tableOf(state))
    const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
    session.chooseAction(ActionType.Search)
    return { session, sent }
}

const piles = (session: OathGameSession) =>
    session.searchRows.filter((row) => row.source === SearchSource.Discard).map((row) => row.region)

function pickRegion(session: OathGameSession, cardId: string, region: Region) {
    const power = required(session.modifiers.options.find((p) => p.cardId === cardId), `${cardId} is usable`)
    const choice = required(session.modifiers.choicesOf(power)[0], `${cardId} asks for a region`)
    const pick = choice.options.findIndex((o) => o.kind === PowerChoiceKind.Region && o.region === region)
    session.modifiers.setPicks(use(cardId), withOptionPick(emptyPicks(), choice, 0, pick))
}

describe('R-7.4 — the piles a declared modifier lets a Search name', () => {
    it('lists the pawn’s pile once when the only region named is where the discards go (Bracken)', () => {
        const { session } = searching([BRACKEN])
        session.modifiers.declare(use(BRACKEN), true)
        expect(piles(session)).toEqual([Region.Cradle])
    })

    it('a Search from a pile Observatory names keeps the pile Bracken sends the discards to', async () => {
        const { session, sent } = searching([BRACKEN])
        session.modifiers.declare(use(BRACKEN), true)
        pickRegion(session, BRACKEN, Region.Hinterland)
        session.modifiers.declare(use(OBSERVATORY), true)
        expect(piles(session)).toEqual([Region.Cradle, Region.Provinces, Region.Hinterland])

        await session.searchFrom(required(session.searchRows.find((row) => row.region === Region.Provinces), 'the Provinces pile is listed'))
        const action = sent.mock.calls[0][0]
        assert(isSearch(action), 'a Search is sent')
        expect(action.modifiers).toEqual([
            { ...use(BRACKEN), choices: [{ kind: PowerChoiceKind.Region, region: Region.Hinterland }] },
            { ...use(OBSERVATORY), choices: [{ kind: PowerChoiceKind.Region, region: Region.Provinces }] }
        ])
    })

    it('one Search draws from one pile, so declaring a second modifier that names it puts the first down', () => {
        const { session } = searching([ERRAND_BOY])
        session.modifiers.declare(use(ERRAND_BOY), true)
        expect(piles(session)).toEqual([Region.Provinces, Region.Hinterland])

        session.modifiers.declare(use(OBSERVATORY), true)
        expect(session.modifiers.isDeclared(use(ERRAND_BOY))).toBe(false)
        expect(piles(session)).toEqual([Region.Cradle, Region.Provinces, Region.Hinterland])

        session.modifiers.declare(use(ERRAND_BOY), true)
        expect(session.modifiers.isDeclared(use(OBSERVATORY))).toBe(false)
        expect(piles(session)).toEqual([Region.Provinces, Region.Hinterland])
    })
})

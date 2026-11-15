import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color, assert, type Visibility } from '@tabletop/common'
import {
    ActionType,
    HydratedOathGameState,
    HydratedPlayFacedownAdviser,
    MachineState,
    OathRevision,
    PowerTiming,
    SearchPlay,
    adviserDiscardsNeeded,
    isPlayFacedownAdviser,
    reasonCannotPlaceCard,
    type PlayFacedownAdviser,
    powerIndexOf
} from '@tabletop/oath'
import { openTurn, served, testPlayer, testState } from '@tabletop/oath/testing'
import {
    disposeSessions,
    openSessionOn,
    tableOf,
    type PlayedTable
} from '$lib/testing/sessionHarness.js'
import { adviserPlacements } from './adviserPlacements.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

// Law 6.1 plays a facedown adviser "as if you searched", and Law 7.4.3 bars discarding a modifier during the action
// it modifies. From revision 31 the "Discard first" picker leaves out a modifier the play uses, as the engine
// refuses it; before it the picker offers it, as the engine accepts it.

const WILD_CRY = 'denizen.beast.wild-cry'
const CROP_ROTATION = 'denizen.hearth.crop-rotation'
const INN = 'denizen.hearth.wayside-inn'
const WOLVES = 'denizen.beast.wolves'
const RANGERS = 'denizen.beast.rangers'
const PIPER = 'denizen.beast.pied-piper'

const FIXED = OathRevision.EngineFixes26
const BEFORE = OathRevision.Chronicle

const use = (cardId: string) => ({ cardId, powerIndex: powerIndexOf(cardId, PowerTiming.Modifier) })

/** Dana on turn at c1 with the Wolves facedown beside Crop Rotation; Wild Cry and the Inn at their site. */
function table(revision: OathRevision): HydratedOathGameState {
    const state = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                supply: 3,
                favor: 2,
                secrets: 2,
                advisers: [
                    { cardId: WOLVES, faceUp: false },
                    { cardId: CROP_ROTATION, faceUp: true }
                ]
            }),
            testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'p1' })
        ],
        {
            machineState: MachineState.ActPhase,
            oathRevision: revision,
            denizensBySite: { c1: [WILD_CRY, INN], c2: [], p1: [], h1: [] }
        }
    )
    openTurn(state, 'dana')
    return state
}

async function sitePlayOf(state: HydratedOathGameState) {
    const session = await openSessionOn(tableOf(state))
    const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
    session.chooseAction(ActionType.PlayFacedownAdviser)
    await session.chooseAdviserPlay(WOLVES, SearchPlay.Site)
    const lastSent = () => {
        const action = sent.mock.calls.at(-1)?.[0]
        assert(isPlayFacedownAdviser(action), 'a facedown adviser’s play is sent')
        return action
    }
    return { session, sent, lastSent }
}

const declared = (action: PlayFacedownAdviser) => (action.modifiers ?? []).map((m) => m.cardId)

describe('R-6.1, R-7.4.3 — "Discard first" leaves out Wild Cry while the play uses it', () => {
    it('from revision 31 Wild Cry, in use from the start, is not offered; the Inn is, and the play sent is accepted', async () => {
        const state = table(FIXED)
        const { session, sent, lastSent } = await sitePlayOf(state)
        expect(sent).not.toHaveBeenCalled()
        expect(session.adviserCardRows.map((power) => power.cardId)).toEqual([WILD_CRY])
        expect(session.adviserRowsInUse).toEqual([use(WILD_CRY)])
        expect(session.adviserDiscardFirstOptions).toEqual([INN])

        session.setAdviserDiscardFirst(WILD_CRY)
        expect(session.adviserDiscardFirst).toBeUndefined()
        session.setAdviserDiscardFirst(INN)
        await session.confirmAdviserPlay()
        const action = lastSent()
        expect(action.discardFirstCardId).toBe(INN)
        expect(declared(action)).toEqual([WILD_CRY, CROP_ROTATION])
        expect(HydratedPlayFacedownAdviser.reasonCannotPlay(state, 'dana', action)).toBeUndefined()
        expect(
            HydratedPlayFacedownAdviser.reasonCannotPlay(state, 'dana', {
                ...action,
                discardFirstCardId: WILD_CRY
            })
        ).toBe(
            `${WILD_CRY} is a modifier in use and cannot be discarded during the action it modifies`
        )
    })

    it('from revision 31, with the Wild Cry row put down, Wild Cry is offered again', async () => {
        const { session } = await sitePlayOf(table(FIXED))
        session.toggleAdviserCardRow(use(WILD_CRY))
        expect(session.adviserRowsInUse).toEqual([])
        expect(session.adviserDiscardFirstOptions).toEqual([WILD_CRY, INN])
    })

    it('from revision 31, with the row put down, Wild Cry picked to go first stays picked and is sent without Wild Cry', async () => {
        const state = table(FIXED)
        const { session, lastSent } = await sitePlayOf(state)
        session.toggleAdviserCardRow(use(WILD_CRY))
        session.setAdviserDiscardFirst(WILD_CRY)
        expect(session.adviserRowsInUse).toEqual([])
        expect(session.adviserDiscardFirst).toBe(WILD_CRY)
        await session.confirmAdviserPlay()
        const action = lastSent()
        expect(action.discardFirstCardId).toBe(WILD_CRY)
        expect(declared(action)).toEqual([CROP_ROTATION])
        expect(HydratedPlayFacedownAdviser.reasonCannotPlay(state, 'dana', action)).toBeUndefined()
    })

    it('from revision 31, Wild Cry picked to go first, then its row put back in use: the pick goes, and the Inn is offered', async () => {
        const { session } = await sitePlayOf(table(FIXED))
        session.toggleAdviserCardRow(use(WILD_CRY))
        session.setAdviserDiscardFirst(WILD_CRY)
        session.toggleAdviserCardRow(use(WILD_CRY))
        expect(session.adviserRowsInUse).toEqual([use(WILD_CRY)])
        expect(session.adviserDiscardFirst).toBeUndefined()
        expect(session.adviserDiscardFirstOptions).toEqual([INN])
    })

    it('before revision 31 Wild Cry in use is offered, and picking it is sent as the engine accepts it', async () => {
        const state = table(BEFORE)
        const { session, lastSent } = await sitePlayOf(state)
        expect(session.adviserRowsInUse).toEqual([use(WILD_CRY)])
        expect(session.adviserDiscardFirstOptions).toEqual([WILD_CRY, INN])
        session.setAdviserDiscardFirst(WILD_CRY)
        await session.confirmAdviserPlay()
        const action = lastSent()
        expect(action.discardFirstCardId).toBe(WILD_CRY)
        expect(declared(action)).toEqual([WILD_CRY, CROP_ROTATION])
        expect(HydratedPlayFacedownAdviser.reasonCannotPlay(state, 'dana', action)).toBeUndefined()
    })
})

// Law 5.1.4.II: at the limit "you must first discard an adviser". Pied Piper "ignores the adviser limit": kept faceup
// at the limit it prompts no discard, and once held it counts (its Q&A). So Dana, holding Wild Cry, the Rangers and a
// facedown Wolves at a limit of three, keeps the Piper and holds four; turning the Wolves faceup must discard one.
// Wild Cry ("If you play a beast card, gain 1 Supply and 2 warbands") is in use from the start of that play.

const dana: Visibility.Perspective = { kind: 'player', playerId: 'dana' }

/** Dana on turn at c1 holding `faceup` in that order, then the Wolves facedown. */
function limitTable(
    revision: OathRevision,
    faceup = [WILD_CRY, RANGERS, PIPER]
): HydratedOathGameState {
    const state = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                supply: 3,
                favor: 2,
                secrets: 2,
                advisers: [
                    ...faceup.map((cardId) => ({ cardId, faceUp: true })),
                    { cardId: WOLVES, faceUp: false }
                ]
            }),
            testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'p1' })
        ],
        {
            machineState: MachineState.ActPhase,
            oathRevision: revision,
            denizensBySite: { c1: [], c2: [], p1: [], h1: [] }
        }
    )
    openTurn(state, 'dana')
    return state
}

const turnFaceup = (discarded: string, modifiers = [use(WILD_CRY)]) => ({
    cardId: WOLVES,
    play: SearchPlay.Adviser,
    discardedAdviserCardIds: [discarded],
    modifiers
})

async function faceupPlayOf(played: PlayedTable) {
    const session = await openSessionOn(played)
    const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
    session.chooseAction(ActionType.PlayFacedownAdviser)
    await session.chooseAdviserPlay(WOLVES, SearchPlay.Adviser)
    const lastSent = () => {
        const action = sent.mock.calls.at(-1)?.[0]
        assert(isPlayFacedownAdviser(action), 'a facedown adviser’s play is sent')
        return action
    }
    return { session, sent, lastSent }
}

describe('R-6.1, R-7.4.3 — "Turn faceup" at the limit never needs the modifier the play uses as its discard', () => {
    it('the table is reachable: with three advisers, Pied Piper kept faceup prompts no discard and is accepted', () => {
        const before = limitTable(FIXED, [WILD_CRY, RANGERS])
        expect(adviserDiscardsNeeded(before, 'dana', PIPER, { faceUp: true })).toBe(0)
        expect(
            reasonCannotPlaceCard(before, 'dana', PIPER, SearchPlay.Adviser, { faceUp: true })
        ).toBeUndefined()
        const state = limitTable(FIXED)
        expect(
            adviserDiscardsNeeded(state, 'dana', WOLVES, { faceUp: true, fromAdvisers: true })
        ).toBe(1)
    })

    for (const [name, played] of [
        ['the table', tableOf(limitTable(FIXED))],
        ["Dana's own view", { state: served(limitTable(FIXED), dana), actions: [] }]
    ] as const) {
        it(`from revision 31, on ${name}: "Turn faceup" is offered and its discards leave out Wild Cry`, () => {
            const state = new HydratedOathGameState(played.state)
            const faceup = adviserPlacements(state, 'dana', WOLVES).find(
                (p) => p.play === SearchPlay.Adviser
            )
            expect(faceup?.room.needed).toBe(1)
            expect(faceup?.room.discardable).toEqual([RANGERS, PIPER])
            expect(faceup?.room.discards).toEqual([[RANGERS], [PIPER]])
        })
    }

    it('the engine agrees: Wild Cry in use is refused as the discard, the Rangers and the Piper are accepted', () => {
        const state = limitTable(FIXED)
        expect(
            HydratedPlayFacedownAdviser.reasonCannotPlace(state, 'dana', turnFaceup(WILD_CRY))
        ).toBe(
            `${WILD_CRY} is a modifier in use and cannot be discarded during the action it modifies`
        )
        for (const discarded of [RANGERS, PIPER]) {
            expect(
                HydratedPlayFacedownAdviser.reasonCannotPlay(state, 'dana', turnFaceup(discarded))
            ).toBeUndefined()
        }
    })

    it('from revision 31 the picker offers the Rangers and the Piper, a tap on Wild Cry picks nothing, and the play sent is accepted', async () => {
        const state = limitTable(FIXED)
        const { session, sent, lastSent } = await faceupPlayOf(tableOf(state))
        expect(sent).not.toHaveBeenCalled()
        expect(session.adviserRowsInUse).toEqual([use(WILD_CRY)])
        expect(session.adviserPlayRoom.needed).toBe(1)
        expect(session.adviserPlayDiscardable).toEqual([RANGERS, PIPER])

        session.toggleAdviserPlayDiscard(WILD_CRY)
        expect(session.adviserPlayDiscards).toEqual([])
        session.toggleAdviserPlayDiscard(RANGERS)
        await session.confirmAdviserPlay()
        const action = lastSent()
        expect(action.discardedAdviserCardIds).toEqual([RANGERS])
        expect(declared(action)).toEqual([WILD_CRY])
        expect(HydratedPlayFacedownAdviser.reasonCannotPlay(state, 'dana', action)).toBeUndefined()
    })

    it('from revision 31, with the row put down Wild Cry is offered and sent without it; put back in use, it leaves the picker and the pick', async () => {
        const state = limitTable(FIXED)
        const { session, lastSent } = await faceupPlayOf(tableOf(state))
        session.toggleAdviserCardRow(use(WILD_CRY))
        expect(session.adviserRowsInUse).toEqual([])
        expect(session.adviserPlayDiscardable).toEqual([WILD_CRY, RANGERS, PIPER])
        session.toggleAdviserPlayDiscard(WILD_CRY)
        expect(session.adviserPlayDiscards).toEqual([WILD_CRY])

        session.toggleAdviserCardRow(use(WILD_CRY))
        expect(session.adviserRowsInUse).toEqual([use(WILD_CRY)])
        expect(session.adviserPlayDiscards).toEqual([])
        expect(session.adviserPlayDiscardable).toEqual([RANGERS, PIPER])

        session.toggleAdviserCardRow(use(WILD_CRY))
        session.toggleAdviserPlayDiscard(WILD_CRY)
        await session.confirmAdviserPlay()
        const action = lastSent()
        expect(action.discardedAdviserCardIds).toEqual([WILD_CRY])
        expect(declared(action)).toEqual([])
        expect(HydratedPlayFacedownAdviser.reasonCannotPlay(state, 'dana', action)).toBeUndefined()
    })

    it('Undo takes back the discard picked after the row was put down, then brings the row back in use', async () => {
        const { session } = await faceupPlayOf(tableOf(limitTable(FIXED)))
        session.toggleAdviserCardRow(use(WILD_CRY))
        session.toggleAdviserPlayDiscard(WILD_CRY)
        await session.undo()
        expect(session.adviserPlayDiscards).toEqual([])
        expect(session.adviserRowsInUse).toEqual([])
        expect(session.adviserPlayDiscardable).toEqual([WILD_CRY, RANGERS, PIPER])
        await session.undo()
        expect(session.adviserRowsInUse).toEqual([use(WILD_CRY)])
        expect(session.adviserPlayDiscardable).toEqual([RANGERS, PIPER])
        expect(session.adviserPlay).toBe(SearchPlay.Adviser)
    })

    it('before revision 31 the picker offers Wild Cry in use, and picking it is sent as the engine accepts it', async () => {
        const state = limitTable(BEFORE)
        expect(
            adviserPlacements(state, 'dana', WOLVES).find((p) => p.play === SearchPlay.Adviser)
                ?.room.discards
        ).toEqual([[WILD_CRY], [RANGERS], [PIPER]])
        const { session, lastSent } = await faceupPlayOf(tableOf(state))
        expect(session.adviserRowsInUse).toEqual([use(WILD_CRY)])
        expect(session.adviserPlayDiscardable).toEqual([WILD_CRY, RANGERS, PIPER])
        session.toggleAdviserPlayDiscard(WILD_CRY)
        await session.confirmAdviserPlay()
        const action = lastSent()
        expect(action.discardedAdviserCardIds).toEqual([WILD_CRY])
        expect(declared(action)).toEqual([WILD_CRY])
        expect(HydratedPlayFacedownAdviser.reasonCannotPlay(state, 'dana', action)).toBeUndefined()
    })
})

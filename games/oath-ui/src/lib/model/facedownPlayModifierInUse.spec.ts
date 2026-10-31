import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color, assert } from '@tabletop/common'
import {
    ActionType,
    HydratedOathGameState,
    HydratedPlayFacedownAdviser,
    MachineState,
    OathRevision,
    PowerTiming,
    SearchPlay,
    isPlayFacedownAdviser,
    type PlayFacedownAdviser,
    powerIndexOf
} from '@tabletop/oath'
import { openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'

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

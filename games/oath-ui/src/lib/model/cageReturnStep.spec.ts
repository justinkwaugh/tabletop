import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color } from '@tabletop/common'
import {
    CURRENT_OATH_REVISION,
    IMPERIAL_WARBANDS,
    MachineState,
    OathRevision,
    PlayerStatus,
    PowerQuestionKind
} from '@tabletop/oath'
import { testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'
import { cageCeilingAt, cageCountsAfterTap, cagePlacementOf } from './cagePlacement.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const CAGE = 'relic.obsidian-cage'
const RING = 'relic.ring-of-devotion'
const CUP = 'relic.cup-of-plenty'

type Scene = {
    /** Bea, a third Imperial board, as a Citizen. */
    bea?: boolean
    /** Rhys an Exile, so the Chancellor's is the only Imperial board. */
    rhysExile?: boolean
    caged?: Record<string, number>
    oathRevision?: number
}

/**
 * Dana, an Exile, holds the Obsidian Cage and Ring of Devotion and is asked Fae Merchant's question,
 * the Cup of Plenty drawn; Ann is the Chancellor, Rhys a Citizen.
 */
async function faeMerchant({
    bea = false,
    rhysExile = false,
    caged = { [IMPERIAL_WARBANDS]: 2 },
    oathRevision = CURRENT_OATH_REVISION
}: Scene = {}) {
    const state = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                relicIds: [CAGE, RING],
                warbandsOnBoard: { dana: 3 }
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1',
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 }
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Blue,
                status: rhysExile ? PlayerStatus.Exile : PlayerStatus.Citizen,
                siteId: 'c1'
            }),
            ...(bea
                ? [
                      testPlayer({
                          playerId: 'bea',
                          color: Color.Yellow,
                          status: PlayerStatus.Citizen,
                          siteId: 'c1'
                      })
                  ]
                : [])
        ],
        {
            machineState: MachineState.PowerQuestion,
            chancellorPlayerId: 'ann',
            oathRevision,
            warbandsOnCards: { [CAGE]: caged },
            pendingQuestions: {
                queue: [
                    {
                        kind: PowerQuestionKind.BottomRelic,
                        cardId: 'denizen.beast.fae-merchant',
                        askedPlayerId: 'dana',
                        relicCardId: CUP
                    }
                ],
                askingPlayerId: 'dana',
                resumeMachineState: MachineState.ActPhase
            }
        }
    )
    const session = await openSessionOn(tableOf(state))
    const sent = vi.spyOn(session, 'answerQuestion').mockResolvedValue()
    return { draft: session.question, sent }
}

describe('Fae Merchant sends the Obsidian Cage down: the step that places its Imperial warbands (R-10.13-H1)', () => {
    it('picking the Cage opens the step and sends nothing: a row per Imperial board, none placed, "Return them" waiting', async () => {
        const { draft, sent } = await faeMerchant()
        expect(draft.cageBoards).toEqual([])
        await draft.putOnBottom(CAGE)
        expect(sent).not.toHaveBeenCalled()
        expect(draft.cageBoards).toEqual(['ann', 'rhys'])
        expect(draft.cageWarbands).toBe(2)
        expect(draft.cageCounts).toEqual([0, 0])
        expect(draft.cageReturnReady).toBe(false)
        await draft.returnCage()
        expect(sent).not.toHaveBeenCalled()
    })

    it('two boards: a tap on one row fills the other with the rest, so the rows always total them all', async () => {
        const { draft, sent } = await faeMerchant()
        await draft.putOnBottom(CAGE)
        draft.setCageCount(0, 1)
        expect(draft.cageCounts).toEqual([1, 1])
        expect(draft.cageReturnReady).toBe(true)
        await draft.returnCage()
        expect(sent).toHaveBeenLastCalledWith({
            kind: PowerQuestionKind.BottomRelic,
            heldRelicCardId: CAGE,
            cagePlacement: [
                { playerId: 'ann', count: 1 },
                { playerId: 'rhys', count: 1 }
            ]
        })
        draft.setCageCount(1, 2)
        expect(draft.cageCounts).toEqual([0, 2])
        await draft.returnCage()
        expect(sent).toHaveBeenLastCalledWith({
            kind: PowerQuestionKind.BottomRelic,
            heldRelicCardId: CAGE,
            cagePlacement: [{ playerId: 'rhys', count: 2 }]
        })
        expect([draft.cageCeilingAt(0), draft.cageCeilingAt(1)]).toEqual([2, 2])
        // A tap on the piece at the count sets the row to 0: the other takes them all.
        draft.setCageCount(1, 0)
        expect(draft.cageCounts).toEqual([2, 0])
    })

    it('three boards: no row fills another; a row takes what the others leave, and "Return them" waits until all are placed', async () => {
        const { draft, sent } = await faeMerchant({ bea: true })
        await draft.putOnBottom(CAGE)
        expect(draft.cageBoards).toEqual(['ann', 'rhys', 'bea'])
        draft.setCageCount(0, 1)
        expect(draft.cageCounts).toEqual([1, 0, 0])
        expect(draft.cageReturnReady).toBe(false)
        expect([draft.cageCeilingAt(0), draft.cageCeilingAt(1), draft.cageCeilingAt(2)]).toEqual([
            2, 1, 1
        ])
        draft.setCageCount(2, 2)
        expect(draft.cageCounts).toEqual([1, 0, 1])
        expect(draft.cageReturnReady).toBe(true)
        await draft.returnCage()
        expect(sent).toHaveBeenLastCalledWith({
            kind: PowerQuestionKind.BottomRelic,
            heldRelicCardId: CAGE,
            cagePlacement: [
                { playerId: 'ann', count: 1 },
                { playerId: 'bea', count: 1 }
            ]
        })
    })

    it('back unwinds the rows, then the step', async () => {
        const { draft } = await faeMerchant()
        await draft.putOnBottom(CAGE)
        draft.setCageCount(0, 1)
        expect(draft.hasManualSelection()).toBe(true)
        expect(draft.back()).toBe(true)
        expect(draft.cageCounts).toEqual([0, 0])
        expect(draft.back()).toBe(true)
        expect(draft.cageBoards).toEqual([])
    })

    it.each([
        ['the Chancellor’s is the only Imperial board', { rhysExile: true }],
        ['the Cage holds no Imperial warbands', { caged: { rhys: 2 } }],
        ['the game was created before revision 17', { oathRevision: OathRevision.EngineFixes12 }]
    ])(
        'no step when nobody chooses: %s, so a tap on the Cage sends it',
        async (_, scene: Scene) => {
            const { draft, sent } = await faeMerchant(scene)
            await draft.putOnBottom(CAGE)
            expect(draft.cageBoards).toEqual([])
            expect(sent).toHaveBeenLastCalledWith({
                kind: PowerQuestionKind.BottomRelic,
                heldRelicCardId: CAGE
            })
        }
    )

    it('another relic sent down never opens the step', async () => {
        const { draft, sent } = await faeMerchant()
        await draft.putOnBottom(RING)
        expect(draft.cageBoards).toEqual([])
        expect(sent).toHaveBeenLastCalledWith({
            kind: PowerQuestionKind.BottomRelic,
            heldRelicCardId: RING
        })
    })
})

describe('the rows’ counts', () => {
    it('two rows always total the warbands; three or more take only what the others leave', () => {
        expect(cageCountsAfterTap([0, 0], 0, 1, 3)).toEqual([1, 2])
        expect(cageCountsAfterTap([1, 2], 1, 3, 3)).toEqual([0, 3])
        expect(cageCountsAfterTap([0, 0, 0], 1, 2, 3)).toEqual([0, 2, 0])
        expect(cageCountsAfterTap([0, 2, 0], 0, 3, 3)).toEqual([1, 2, 0])
        expect(cageCeilingAt([0, 2, 0], 2, 3)).toBe(1)
        expect(cageCeilingAt([3, 0], 1, 3)).toBe(3)
        expect(cagePlacementOf(['ann', 'rhys', 'bea'], [0, 2, 1])).toEqual([
            { playerId: 'rhys', count: 2 },
            { playerId: 'bea', count: 1 }
        ])
    })
})

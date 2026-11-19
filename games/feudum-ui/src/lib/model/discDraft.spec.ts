import { flushSync } from 'svelte'
import { ActionSource, assertExists, type GameAction } from '@tabletop/common'
import {
    ActionType,
    Goods,
    isNourishPawns,
    MachineState,
    queueFollowUp,
    returnGoodToHaversack,
    Spaces,
    type DiscFollowUp,
    type HydratedFeudumGameState,
    type SpaceId
} from '@tabletop/feudum'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    atDisc,
    fillBarrel,
    holdFood,
    holdWrit,
    seatedAtCards,
    shortenWritDeck,
    threePawns,
    type SeatTable
} from '$lib/testing/followUpTable.js'
import { guildTable, setCarts, setMarket, setMaster } from '$lib/testing/guildTable.js'
import {
    atPlayingCards,
    addPawn,
    emptySpaces,
    giveGood,
    returnGoods
} from '$lib/testing/turnTable.js'
import { settled, type FeudumHost } from '$lib/testing/sessionHarness.js'
import {
    guildTarget,
    militaryTarget,
    pawnTarget,
    roleOf,
    spaceTarget,
    voyageTarget
} from './boardOffer.js'
import type { DraftChoice } from './deciderDraft.svelte.js'
import { DiscStageOrder, type DiscValues } from './discDraft.svelte.js'
import type { FeudumGameSession } from './session.svelte.js'
import { StagedDraft } from './stagedDraft.svelte.js'

const OutOfOrder = /does not exist in stage order/
const Inland: SpaceId = 'space.desert.3'
const RoadEnd: SpaceId = 'space.desert.1'

let host: FeudumHost | undefined

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
    host?.close()
    host = undefined
    vi.restoreAllMocks()
})

function hold<T extends { readonly host: FeudumHost }>(table: T): T {
    host = table.host
    return table
}

function lastAction(table: SeatTable): GameAction | undefined {
    return table.host.actions.findLast(({ source }) => source === ActionSource.User)
}

async function press(session: FeudumGameSession, choice: DraftChoice | undefined) {
    assertExists(choice, 'The panel has this button')
    await session.pressDraftChoice(choice)
    await settled(session)
}

/** A voyage disc on this space, or none yet; `arrange` sets the rest. */
const voyage = (space?: number, arrange?: (state: HydratedFeudumGameState, seat: string) => void) =>
    atDisc(
        (playerId): DiscFollowUp => ({ kind: 'voyage', playerId }),
        (state, { seat }) => {
            if (space !== undefined) {
                state.voyageTrack[seat] = space
            }
            arrange?.(state, seat)
        }
    )

const military = (arrange?: (state: HydratedFeudumGameState, seat: string) => void) =>
    atDisc(
        (playerId): DiscFollowUp => ({ kind: 'military', playerId }),
        (state, { seat }) => {
            arrange?.(state, seat)
        }
    )

/** R-3.7.1 One farmer inland and no goods about, so a step is a press and nothing to pilfer. */
function oneFarmerInland(state: HydratedFeudumGameState, seat: string) {
    for (const { id } of Spaces) {
        const { goods } = state.spaces[id]
        for (const good of Goods) {
            returnGoodToHaversack(state, good, goods[good])
            goods[good] = 0
        }
    }
    returnGoods(state, seat)
    state.getPlayerState(seat).pawns.forEach((pawn, index) => {
        if (index === 0) {
            pawn.spaceId = Inland
            pawn.character = 'farmer'
        } else {
            delete pawn.spaceId
            delete pawn.character
        }
    })
    state.recomputeRanks()
}

/** R-3.7.5, R-3.15.1 The round's second successful Move, by a Repeat: the voyage question follows. */
async function afterRepeatedMove() {
    const table = hold(
        await seatedAtCards(['repeat', 'tax'], (state, { seat }) => {
            const player = state.getPlayerState(seat)
            player.played.push({ kind: 'move', use: 'regular' })
            player.successfulMoves = 1
            oneFarmerInland(state, seat)
        })
    )
    const { session } = table
    session.pressTurnCard('repeat')
    flushSync()
    await session.pressTurnTarget(spaceTarget(RoadEnd))
    flushSync()
    await session.sendTurnCard()
    await settled(session)
    expect(session.gameState.machineState).toBe(MachineState.PlacingDisc)
    return table
}

/** R-4.7, R-4.6.5 A Merchant master's scoring push, sent for real: the reeve is offered. */
async function afterMerchantPush() {
    const table = hold(
        await guildTable((state, { seat }) => {
            setMaster(state, seat, 'merchant')
            setMarket(state, { wood: 1 })
            setCarts(state, { wood: 2, iron: 3, food: 3, sulfur: 3, saltpeter: 3 })
        })
    )
    await table.host.send(table.seat, {
        type: ActionType.GuildAction,
        guildId: 'merchant',
        fn: 'push',
        params: { goods: ['wood'] }
    })
    await settled(table.session)
    expect(table.session.gameState.machineState).toBe(MachineState.PlacingDisc)
    return table
}

/** S36 R-4.8, R-4.9-H1 A Conquer won with what the seat adds: the service question follows. */
async function afterWonConquer() {
    let spaceId: SpaceId = 'space.desert.1'
    const table = hold(
        await seatedAtCards(['conquer', 'tax', 'move'], (state, { seat, other }) => {
            spaceId = emptySpaces(state, 'outpost')[0]
            addPawn(state, seat, 'noble', spaceId)
            addPawn(state, other, 'knight', spaceId)
            state.recomputeRanks()
            state.getPlayerState(other).played.push({ kind: 'defend', use: 'regular' })
            returnGoods(state, seat)
            giveGood(state, seat, 'saltpeter')
            holdWrit(state, seat, 'writ.mandate.3')
        })
    )
    const { session, other } = table
    session.pressTurnCard('conquer')
    flushSync()
    const pawn = session.gameState
        .getPlayerState(other)
        .pawns.find((candidate) => candidate.spaceId === spaceId)
    assertExists(pawn, 'The other seat has a pawn there')
    await session.pressTurnTarget(pawnTarget(other, pawn.n))
    await settled(session)
    await press(session, session.commitPanel?.saltpeter.add)
    await press(
        session,
        session.commitPanel?.weapons.find(({ writId }) => writId === 'writ.mandate.3')
            ?.alternatives[0]
    )
    await session.sendFollowUp()
    await settled(session)
    expect(session.gameState.machineState).toBe(MachineState.PlacingDisc)
    return table
}

describe('S31 R-3.7.5 The voyage disc', () => {
    it('S31 a Repeat of Move asks "Voyage space 1?"; Place sends and the disc lands', async () => {
        const table = await afterRepeatedMove()
        const { session, seat } = table
        expect(session.discPanel).toMatchObject({
            line: 'Voyage space 1?',
            freeDiscs: '3/3 discs free'
        })
        expect(session.discPanel?.primary).toBeUndefined()
        expect(roleOf(session.boardOffer, voyageTarget(1))).toBe('lit')
        await press(session, session.discPanel?.place)
        expect(lastAction(table)).toMatchObject({
            type: ActionType.PlaceDisc,
            place: true,
            metadata: { disc: 'voyage', space: 1 }
        })
        expect(lastAction(table)?.revealsInfo).toBeFalsy()
        expect(session.gameState.voyageTrack[seat]).toBe(1)
        expect(session.discPanel).toBeUndefined()
    })

    it('S31 with a disc on 1, "To 2? +2 writs · can\'t be undone" stages for the primary', async () => {
        const table = hold(await voyage(1))
        const { session, seat } = table
        const count = table.host.actions.length
        expect(session.discPanel?.line).toBe("To 2? +2 writs · can't be undone")
        expect(session.discPanel?.place).toMatchObject({ label: 'Advance to 2', shown: 'Advance' })
        expect(session.discPanel?.primary).toBeUndefined()

        await press(session, session.discPanel?.place)
        expect(table.host.actions).toHaveLength(count)
        expect(session.discPanel?.place?.picked).toBe(true)
        expect(session.discPanel?.primary).toEqual({
            label: "Advance to 2 · can't be undone",
            enabled: true
        })
        expect(roleOf(session.boardOffer, voyageTarget(2))).toBe('picked')

        await session.sendFollowUp()
        await settled(session)
        expect(lastAction(table)).toMatchObject({
            type: ActionType.PlaceDisc,
            place: true,
            revealsInfo: true,
            metadata: { disc: 'voyage', space: 2, drawnCount: 2 }
        })
        expect(session.gameState.machineState).toBe(MachineState.KeepingWrits)
        expect(session.keepWritsPanel?.line).toBe('Keep 1 of 2')
        expect(session.gameState.voyageTrack[seat]).toBe(2)
    })

    it('S31 a press on the lit space is the same press: it stages a draw, and sends a step that draws none', async () => {
        const drawing = hold(await voyage(1))
        const count = drawing.host.actions.length
        await drawing.session.pressTurnTarget(voyageTarget(2))
        flushSync()
        expect(drawing.host.actions).toHaveLength(count)
        expect(drawing.session.discPanel?.primary?.enabled).toBe(true)
        drawing.host.close()

        const plain = hold(await voyage(2))
        expect(plain.session.discPanel?.line).toBe('To 3?')
        await plain.session.pressTurnTarget(voyageTarget(3))
        await settled(plain.session)
        expect(lastAction(plain)).toMatchObject({
            type: ActionType.PlaceDisc,
            place: true,
            metadata: { space: 3 }
        })
    })

    it('R-3.7-H1 with no free disc, a disc on the track still steps', async () => {
        const table = hold(
            await voyage(2, (state, seat) => {
                state.militaryService[seat] = 2
            })
        )
        expect(table.session.discPanel?.freeDiscs).toBe('0/3 discs free')
        expect(table.session.discPanel?.place?.press).toBeDefined()
        expect(table.session.discPanel?.place?.refusal).toBeUndefined()
    })

    it('R-4.4-H2 a deck of one draws one, still a barrier; an empty deck draws none and sends on the press', async () => {
        const one = hold(
            await voyage(1, (state) => {
                shortenWritDeck(state, 1)
            })
        )
        expect(one.session.discPanel?.line).toBe("To 2? +1 writ · can't be undone")
        const count = one.host.actions.length
        await press(one.session, one.session.discPanel?.place)
        expect(one.host.actions).toHaveLength(count)
        one.host.close()

        const empty = hold(
            await voyage(1, (state) => {
                shortenWritDeck(state, 0)
            })
        )
        expect(empty.session.discPanel?.line).toBe('To 2?')
        await press(empty.session, empty.session.discPanel?.place)
        expect(lastAction(empty)).toMatchObject({
            type: ActionType.PlaceDisc,
            place: true,
            metadata: { space: 2, drawnCount: 0 }
        })
        expect(lastAction(empty)?.revealsInfo).toBeFalsy()
    })

    it('R-3.7.5 Keep the disc sends on its press, draws nothing, and leaves the disc where it is', async () => {
        const table = hold(await voyage(1))
        const { session, seat } = table
        await press(session, session.discPanel?.keep)
        expect(session.discPanel).toBeUndefined()
        expect(lastAction(table)).toMatchObject({ type: ActionType.PlaceDisc, place: false })
        expect(lastAction(table)?.revealsInfo).toBeFalsy()
        expect(session.gameState.voyageTrack[seat]).toBe(1)
    })
})

describe('S49 R-4.7 The reeve offer', () => {
    it('S49 a scoring push asks "Reeve in Merchant?"; Place sends, +1 vp', async () => {
        const table = await afterMerchantPush()
        const { session, seat } = table
        expect(session.discPanel).toMatchObject({
            line: 'Reeve in Merchant?',
            freeDiscs: '3/3 discs free'
        })
        expect(session.discPanel?.place?.label).toBe('Place')
        expect(session.discPanel?.keep).toMatchObject({ label: 'Keep the disc', shown: 'Keep' })
        expect(roleOf(session.boardOffer, guildTarget('merchant'))).toBe('lit')
        const score = session.gameState.getPlayerState(seat).score
        await press(session, session.discPanel?.place)
        expect(lastAction(table)).toMatchObject({
            type: ActionType.PlaceDisc,
            place: true,
            metadata: { disc: 'reeve', guildId: 'merchant', reevePoints: 1 }
        })
        expect(session.gameState.getPlayerState(seat).score).toBe(score + 1)
        expect(session.gameState.freeDiscs(seat)).toBe(2)
    })

    it('S49 "Keep the disc" leaves it: no reeve, no point, the disc still free', async () => {
        const table = await afterMerchantPush()
        const { session, seat } = table
        const score = session.gameState.getPlayerState(seat).score
        await press(session, session.discPanel?.keep)
        expect(lastAction(table)).toMatchObject({
            type: ActionType.PlaceDisc,
            place: false,
            metadata: { disc: 'reeve', guildId: 'merchant' }
        })
        expect(session.gameState.guilds.tracks.merchant.master?.reeve).toBeFalsy()
        expect(session.gameState.getPlayerState(seat).score).toBe(score)
        expect(session.gameState.freeDiscs(seat)).toBe(3)
    })

    it('R-4.7 a Place the logic refuses is not drawn, and only the keep is left to press', async () => {
        const table = hold(
            await atDisc(
                (playerId) => ({ kind: 'reeve', playerId, guildId: 'merchant' }),
                (state, { seat }) => {
                    setMaster(state, seat, 'merchant')
                    state.recomputeRanks()
                    state.militaryService[seat] = 3
                }
            )
        )
        const { session } = table
        expect(session.discPanel?.place).toBeUndefined()
        expect(roleOf(session.boardOffer, guildTarget('merchant'))).toBe('dimmed')
        const count = table.host.actions.length
        await session.pressTurnTarget(guildTarget('merchant'))
        await session.pressDraftChoice(session.discPanel?.place ?? {})
        await session.sendFollowUp()
        expect(table.host.actions).toHaveLength(count)
        expect(session.discPanel?.keep.press).toBeDefined()
    })
})

describe('R-4.9-H1 The military service question', () => {
    it('S36 after a won Conquer it reads the space and the penalty from the offer', async () => {
        const table = await afterWonConquer()
        const { session, seat } = table
        expect(session.discPanel).toMatchObject({
            line: 'Service disc?',
            covers: 'Space 1 · covers −3',
            freeDiscs: '3/3 discs free'
        })
        expect(roleOf(session.boardOffer, militaryTarget(1))).toBe('lit')
        await press(session, session.discPanel?.place)
        expect(lastAction(table)).toMatchObject({
            type: ActionType.PlaceDisc,
            place: true,
            metadata: { disc: 'military', space: 1 }
        })
        expect(session.gameState.militaryService[seat]).toBe(1)
    })

    it('R-4.9.1, R-1.1 a seat with a disc there is asked about its next space, with the discs left', async () => {
        const { session } = hold(
            await military((state, seat) => {
                state.militaryService[seat] = 1
            })
        )
        expect(session.discPanel).toMatchObject({
            covers: 'Space 2 · covers −4',
            freeDiscs: '2/3 discs free'
        })
        expect(roleOf(session.boardOffer, militaryTarget(2))).toBe('lit')
    })

    it('R-4.9-H1 Keep the disc leaves the space uncovered', async () => {
        const table = hold(await military())
        await press(table.session, table.session.discPanel?.keep)
        expect(lastAction(table)).toMatchObject({ place: false, metadata: { disc: 'military' } })
        expect(table.session.gameState.militaryService[table.seat]).toBe(0)
    })
})

describe('R-X.1 Who the question is for', () => {
    it('R-X.1 reads only for the decider: another seat has no panel, an outline and no press', async () => {
        const table = hold(await voyage(1))
        const other = await table.host.openSeat(table.other)
        await settled(other)
        const count = table.host.actions.length
        expect(other.discPanel).toBeUndefined()
        expect(other.disc.selection).toEqual({})
        expect(roleOf(other.boardOffer, voyageTarget(2))).toBe('being-decided')
        other.disc.set('place', true)
        flushSync()
        expect(other.disc.value('place')).toBeUndefined()
        await other.pressTurnTarget(voyageTarget(2))
        await other.sendFollowUp()
        expect(table.host.actions).toHaveLength(count)
    })

    it('R-X.1 reads only in its own state: another follow-up has no question', async () => {
        const table = await afterRepeatedMove()
        const { session } = table
        await press(session, session.discPanel?.place)
        expect(session.gameState.machineState).not.toBe(MachineState.PlacingDisc)
        expect(session.discPanel).toBeUndefined()
        expect(session.disc.selection).toEqual({})
    })

    it('R-X.1 an ask never answers itself: nothing is staged and nothing sent until a press', async () => {
        const table = hold(await voyage())
        const { session } = table
        const sent = table.host.sent.get(table.seat)
        expect(session.disc.selection).toEqual({})
        expect(session.disc.play).toBeUndefined()
        await session.sendFollowUp()
        await settled(session)
        expect(table.host.sent.get(table.seat)).toEqual(sent)
        expect(session.discPanel).toBeDefined()
    })

    it('R-X.1 even where only the keep is legal, the keep is a press', async () => {
        const table = hold(
            await atDisc(
                (playerId) => ({ kind: 'voyage', playerId }),
                (state, { seat }) => {
                    state.militaryService[seat] = 3
                }
            )
        )
        const { session } = table
        const count = table.host.actions.length
        expect(session.discPanel?.place).toBeUndefined()
        expect(session.disc.selection).toEqual({})
        await session.sendFollowUp()
        expect(table.host.actions).toHaveLength(count)
    })
})

describe('DiscDraft minimum tests', () => {
    it('1 the one stage: a keep replaces a staged advance, and sends only the keep', async () => {
        const table = hold(await voyage(1))
        const { session } = table
        await press(session, session.discPanel?.place)
        await press(session, session.discPanel?.keep)
        expect(lastAction(table)).toMatchObject({ type: ActionType.PlaceDisc, place: false })
        expect(session.gameState.voyageTrack[table.seat]).toBe(1)
    })

    it('2 Undo pops the staged advance and undoes no action', async () => {
        const table = hold(await voyage(1))
        const { session } = table
        const count = table.host.actions.length
        await press(session, session.discPanel?.place)
        await session.undo()
        flushSync()
        expect(session.disc.value('place')).toBeUndefined()
        expect(session.discPanel?.primary).toBeUndefined()
        expect(table.host.actions).toHaveLength(count)
    })

    it('3 with nothing staged, Undo goes on to the Action: the Move before the question', async () => {
        const table = await afterRepeatedMove()
        const { session } = table
        expect(session.disc.localSelection.undo()).toBe(false)
        await session.undo()
        await settled(session)
        expect(session.gameState.machineState).toBe(MachineState.PlayingCards)
        expect(session.discPanel).toBeUndefined()
        expect(table.host.actions.at(-1)?.type).not.toBe(ActionType.Move)
    })

    it('3 Undo after an undoable Place takes the disc back and asks again', async () => {
        const table = await afterRepeatedMove()
        const { session, seat } = table
        await press(session, session.discPanel?.place)
        expect(session.gameState.voyageTrack[seat]).toBe(1)
        await session.undo()
        await settled(session)
        expect(session.gameState.voyageTrack[seat]).toBeUndefined()
        expect(session.discPanel?.line).toBe('Voyage space 1?')
        expect(session.disc.selection).toEqual({})
    })

    it('4 a stage out of the order throws', () => {
        const draft = new StagedDraft<DiscValues>(DiscStageOrder.filter((s) => s !== 'place'))
        expect(() => {
            draft.set('place', true)
        }).toThrow(OutOfOrder)
    })

    it('5 pressing the staged advance again unpicks it', async () => {
        const table = hold(await voyage(1))
        const { session } = table
        const count = table.host.actions.length
        await press(session, session.discPanel?.place)
        await press(session, session.discPanel?.place)
        expect(session.disc.value('place')).toBeUndefined()
        expect(session.discPanel?.place?.picked).toBe(false)
        expect(session.discPanel?.primary).toBeUndefined()
        expect(table.host.actions).toHaveLength(count)
    })

    it('8 the draft ends with the displayed state: this seat answers from another browser', async () => {
        const table = hold(await voyage(1))
        const { session, seat } = table
        await press(session, session.discPanel?.place)
        await table.host.send(seat, { type: ActionType.PlaceDisc, place: false })
        await settled(session)
        expect(session.discPanel).toBeUndefined()
        expect(session.disc.selection).toEqual({})
        await session.sendFollowUp()
        expect(table.host.sent.get(seat)).toBeUndefined()
    })

    it('8 a staged advance does not carry onto the next disc: the same seat is asked about a reeve', async () => {
        const table = hold(
            await atDisc(
                (playerId) => ({ kind: 'reeve', playerId, guildId: 'merchant' }),
                (state, { seat }) => {
                    setMaster(state, seat, 'merchant')
                    state.recomputeRanks()
                    state.voyageTrack[seat] = 1
                    queueFollowUp(state, { kind: 'voyage', playerId: seat })
                }
            )
        )
        const { session, seat } = table
        await press(session, session.discPanel?.place)
        expect(session.discPanel?.primary).toBeDefined()
        await table.host.send(seat, { type: ActionType.PlaceDisc, place: false })
        await settled(session)
        expect(session.discPanel?.line).toBe('Reeve in Merchant?')
        expect(session.discPanel?.place?.picked).toBe(false)
        expect(session.disc.selection).toEqual({})
        expect(session.disc.play).toBeUndefined()
        expect(roleOf(session.boardOffer, guildTarget('merchant'))).toBe('lit')
    })

    it('8 a reconciliation clears it too', async () => {
        const table = hold(await voyage(1))
        const { session, seat } = table
        await press(session, session.discPanel?.place)
        table.host.sendUnheard(seat, { type: ActionType.PlaceDisc, place: false })
        await table.host.reconcile(seat)
        expect(session.discPanel).toBeUndefined()
        expect(session.disc.selection).toEqual({})
        expect(session.gameState.voyageTrack[seat]).toBe(1)
    })
})

describe('S61 History View', () => {
    /** R-3.7.1 One farmer inland, the Move card picked. */
    async function pickedMove() {
        const table = hold(
            await seatedAtCards(['move', 'tax'], (state, { seat }) => {
                oneFarmerInland(state, seat)
            })
        )
        table.session.pressTurnCard('move')
        flushSync()
        return table
    }

    it('S61 stepping back with a Move picked: no panel, no lit target, nothing dimmed, no send', async () => {
        const table = await pickedMove()
        const { session, seat } = table
        expect(session.movePanel).toBeDefined()
        expect(roleOf(session.boardOffer, spaceTarget(RoadEnd))).toBe('lit')
        expect(session.boardOffer.dimsRest).toBe(true)
        await session.history.goToPreviousAction()
        await settled(session)
        expect(session.isViewingHistory).toBe(true)
        expect(session.turnPanel).toBeUndefined()
        expect(session.movePanel).toBeUndefined()
        expect(session.watchingPanel).toBeUndefined()
        expect(session.boardOffer.targets.size).toBe(0)
        expect(session.boardOffer.dimsRest).toBe(false)

        session.pressTurnCard('move')
        await session.pressTurnTarget(spaceTarget(RoadEnd))
        await session.sendTurnCard()
        await session.sendFollowUp()
        expect(table.host.sent.get(seat)).toBeUndefined()
    })

    it('S61 the staged steps and the card do not come back on leaving History View', async () => {
        const table = await pickedMove()
        const { session } = table
        await session.pressTurnTarget(spaceTarget(RoadEnd))
        flushSync()
        expect(session.boardOffer.trail).toHaveLength(1)
        await session.history.goToPreviousAction()
        await settled(session)
        expect(session.boardOffer.trail).toBeUndefined()

        session.history.goToEnd()
        await settled(session)
        expect(session.isViewingHistory).toBe(false)
        expect(session.turnPanel).toBeDefined()
        expect(session.turn.card).toBeUndefined()
        expect(session.movePanel).toBeUndefined()
        expect(session.boardOffer.trail).toBeUndefined()
    })

    it('S61 stepping back with an advance staged clears it: no question, no send, and the staged press is gone on the way back', async () => {
        const table = hold(await voyage(1))
        const { session, seat } = table
        await press(session, session.discPanel?.place)
        expect(session.disc.value('place')).toBe(true)
        await session.history.goToPreviousAction()
        await settled(session)
        expect(session.isViewingHistory).toBe(true)
        expect(session.discPanel).toBeUndefined()
        expect(session.disc.selection).toEqual({})
        await session.sendFollowUp()
        expect(table.host.sent.get(seat)).toBeUndefined()

        session.history.goToEnd()
        await settled(session)
        expect(session.discPanel?.line).toBe("To 2? +2 writs · can't be undone")
        expect(session.discPanel?.place?.picked).toBe(false)
        expect(session.discPanel?.primary).toBeUndefined()
    })

    it('S61 stepping back into the question itself: for the decider too it is the outline, with no panel and no press', async () => {
        const table = await afterRepeatedMove()
        const { session, seat } = table
        await press(session, session.discPanel?.place)
        const sent = table.host.sent.get(seat)?.length
        // The Place, then whatever the machine played after it.
        for (let steps = 0; steps < 5; steps += 1) {
            if (session.gameState.machineState === MachineState.PlacingDisc) {
                break
            }
            await session.history.goToPreviousAction()
            await settled(session)
        }
        expect(session.isViewingHistory).toBe(true)
        expect(session.gameState.machineState).toBe(MachineState.PlacingDisc)
        expect(session.discPanel).toBeUndefined()
        expect(roleOf(session.boardOffer, voyageTarget(1))).toBe('being-decided')
        expect(session.boardOffer.dimsRest).toBe(false)
        await session.pressTurnTarget(voyageTarget(1))
        await settled(session)
        expect(table.host.sent.get(seat)?.length).toBe(sent)
    })
})

describe('S53 R-4.10, R-4.10-H4 "nothing to decide", on the real session', () => {
    it('S53 the row reads the NourishPawns Action: the seats it fed, not the seat it asks, nor one with no pawn', async () => {
        const table = hold(await atPlayingCards(['tax'], { otherCards: [] }))
        const { host: game, seat, other } = table
        const third = game.order.find((id) => id !== seat && id !== other)
        assertExists(third, 'Three seats play')
        game.edit((state) => {
            threePawns(state, seat)
            holdFood(state, seat, 1)
            fillBarrel(state, seat, 1)
            for (const pawn of state.getPlayerState(third).pawns) {
                delete pawn.spaceId
                delete pawn.character
            }
            state.recomputeRanks()
        })
        const watcher = await game.openSeat(other)
        await game.send(seat, { type: ActionType.ForfeitCard, kind: 'tax' })
        await settled(watcher)
        expect(watcher.gameState.machineState).toBe(MachineState.Nourishing)
        const fed = watcher.actions.findLast((action) => isNourishPawns(action))
        expect(fed?.metadata).toMatchObject({ fed: [{ playerId: other }] })
        const row = watcher.orderRow?.entries
        const of = (playerId: string) => row?.find((entry) => entry.playerId === playerId)
        expect(of(other)).toMatchObject({ done: true })
        expect(of(seat)).toMatchObject({ deciding: true, done: false })
    })

    it('R-4.10-H4, R-4.4-H1 a seat with no feeding choice but a writ is asked: its feeding whole, and the at-will row', async () => {
        const table = hold(await atPlayingCards(['tax'], { otherCards: [] }))
        const { host: game, seat, other } = table
        game.edit((state) => {
            threePawns(state, seat)
            holdFood(state, seat, 3)
            holdWrit(state, seat, 'writ.mandate.5')
        })
        const asked = await game.openSeat(seat)
        await game.send(seat, { type: ActionType.ForfeitCard, kind: 'tax' })
        await settled(asked)
        expect(asked.gameState.machineState).toBe(MachineState.Nourishing)
        expect(asked.gameState.activePlayerIds).toEqual([seat])
        expect(asked.nourishPanel?.primary.label).toBe('Feed 3 · 3 food')
        expect(asked.atWillPanel?.chips.map(({ list }) => list)).toContain('writs')
        const row = asked.orderRow?.entries
        expect(row?.find((entry) => entry.playerId === seat)).toMatchObject({ deciding: true })
        expect(row?.find((entry) => entry.playerId === other)?.done).toBe(true)
    })
})

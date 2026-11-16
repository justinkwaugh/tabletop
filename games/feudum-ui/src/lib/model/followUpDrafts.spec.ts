import { flushSync } from 'svelte'
import { ActionSource, assertExists, type GameAction } from '@tabletop/common'
import {
    ActionType,
    chooseFavoursOffer,
    HydratedFeudumGameState,
    keepWritsOffer,
    MachineState,
    nourishGroup,
    nourishOffer,
    placeMarker,
    type ActionCardKind,
    type SpaceId,
    type TileId
} from '@tabletop/feudum'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    atCollecting,
    atNourishing,
    atNourishingTogether,
    fillBarrel,
    holdFood,
    holdWrit,
    seatedAtCards,
    threePawns,
    type SeatTable
} from '$lib/testing/followUpTable.js'
import { settled, type FeudumHost } from '$lib/testing/sessionHarness.js'
import {
    addPawn,
    buildFeudum,
    emptySpace,
    giveGood,
    giveTile,
    returnGoods
} from '$lib/testing/turnTable.js'
import { markerTarget, pawnTarget, roleOf, spaceTarget } from './boardOffer.js'
import { CommitAttackStageOrder, type CommitAttackValues } from './commitAttackDraft.svelte.js'
import type { DraftChoice } from './deciderDraft.svelte.js'
import { AnswerStarveStageOrder, type AnswerStarveValues } from './answerStarveDraft.svelte.js'
import { FavoursStageOrder, type FavoursValues } from './favoursDraft.svelte.js'
import { KeepWritsStageOrder, type KeepWritsValues } from './keepWritsDraft.svelte.js'
import { LandscapesStageOrder, type LandscapesValues } from './landscapesDraft.svelte.js'
import { NourishStageOrder, type NourishValues } from './nourishDraft.svelte.js'
import type { FeudumGameSession } from './session.svelte.js'
import { StagedDraft } from './stagedDraft.svelte.js'
import { tileName } from './tileName.js'
import { orderRowOf } from './sharedRows.js'
import { spaceLabel } from './cardFlows.js'
import { WritLimitStageOrder, type WritLimitValues } from './writLimitDraft.svelte.js'

const OutOfOrder = /does not exist in stage order/

let host: FeudumHost | undefined

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
    host?.close()
    host = undefined
    vi.restoreAllMocks()
})

function hold<T extends SeatTable>(table: T): T {
    host = table.host
    return table
}

/** The seat's press; what the machine plays after it (a turn passing, a dawn) doesn't count. */
function lastAction(table: SeatTable): GameAction | undefined {
    return table.host.actions.findLast(({ source }) => source === ActionSource.User)
}

function row(rows: readonly DraftChoice[] | undefined, label: string | RegExp): DraftChoice {
    const found = rows?.find((choice) =>
        typeof label === 'string' ? choice.label === label : label.test(choice.label)
    )
    if (!found) {
        throw new Error(`No row ${label} in ${rows?.map((choice) => choice.label).join(' | ')}`)
    }
    return found
}

async function press(session: FeudumGameSession, choice: DraftChoice | undefined) {
    assertExists(choice, 'The panel has this row')
    await session.pressDraftChoice(choice)
    flushSync()
}

async function sendAndSettle(session: FeudumGameSession) {
    await session.sendFollowUp()
    await settled(session)
}

/** R-3.10.1 A seat ruling an outpost and a feudum sends its Explore, and keeps as asked. */
async function explored(arrange?: (state: HydratedFeudumGameState, seat: string) => void) {
    const table = hold(
        await seatedAtCards(['explore', 'tax'] satisfies ActionCardKind[], (state, { seat }) => {
            placeMarker(state, seat, emptySpace(state, 'outpost'))
            buildFeudum(state, seat, emptySpace(state, 'farm'))
            state.recomputeRanks()
            returnGoods(state, seat)
            arrange?.(state, seat)
        })
    )
    table.session.pressTurnCard('explore')
    flushSync()
    await table.session.sendTurnCard()
    await settled(table.session)
    expect(table.session.gameState.machineState).toBe(MachineState.KeepingWrits)
    return table
}

describe('R-4.4.1 The keep', () => {
    it('S18 faces, one pick, the primary, the keep, the note; others see backs and no Undo', async () => {
        const table = await explored((state, seat) => {
            giveGood(state, seat, 'iron')
        })
        const { session, seat, other } = table
        const watcher = await table.host.openSeat(other)
        await settled(watcher)
        const panel = session.keepWritsPanel
        expect(panel?.line).toBe('Keep 1 of 3')
        expect(panel?.writs).toHaveLength(3)
        expect(panel?.primary).toEqual({ label: 'Keep 1 · 2 under the deck', enabled: false })
        expect(watcher.keepWritsPanel).toBeUndefined()
        expect(watcher.watchingPanel?.waitingOn).toEqual([seat])
        expect(watcher.watchingPanel?.backs).toBe(3)
        expect(watcher.gameState.flow.writDraw?.drawn).toBeUndefined()
        expect(session.undoableAction).toBeUndefined()

        await press(session, panel?.writs[0])
        const picked = session.keepWritsPanel
        expect(picked?.writs[0].picked).toBe(true)
        expect(picked?.primary).toEqual({ label: 'Keep 1 · 2 under the deck', enabled: true })
        expect(picked?.shovels).toEqual({
            label: "Keep, then Shovels & Swords · 1 iron · draw 2 more · can't be undone",
            enabled: true
        })
        expect(lastAction(table)?.type).not.toBe(ActionType.KeepWrits)
        const [kept] = keepWritsOffer(session.gameState, seat)?.drawn ?? []

        await sendAndSettle(session)
        expect(lastAction(table)).toMatchObject({
            type: ActionType.KeepWrits,
            keep: [kept]
        })
        expect(session.deckNote).toBe('you know 2 under the deck')
        await settled(watcher)
        expect(watcher.deckNote).toBeUndefined()
        expect(session.undoableAction?.type).not.toBe(ActionType.Explore)
    })

    it('S19 Shovels & Swords draws two more, and the second keep has no such button', async () => {
        const table = await explored((state, seat) => {
            giveGood(state, seat, 'iron')
        })
        const { session } = table
        await press(session, session.keepWritsPanel?.writs[0])
        await session.keepThenShovels()
        await settled(session)
        expect(lastAction(table)).toMatchObject({
            type: ActionType.KeepWrits,
            shovelsAndSwords: true,
            revealsInfo: true
        })
        expect(session.gameState.machineState).toBe(MachineState.KeepingWrits)
        const second = session.keepWritsPanel
        expect(second?.line).toBe('Keep 1 of 2')
        expect(second?.writs).toHaveLength(2)
        expect(second?.shovels).toBeUndefined()
        await press(session, second?.writs[1])
        expect(session.keepWritsPanel?.primary.label).toBe('Keep 1 · 1 under the deck')
        await sendAndSettle(session)
        expect(session.keepWritsPanel).toBeUndefined()
    })

    it('R-4.4-H1 with no iron, a lone tile is named by the button, by region and epoch, as an auto stage', async () => {
        let tileId: TileId | undefined
        const { session } = await explored((state, seat) => {
            tileId = giveTile(state, seat)
        })
        assertExists(tileId)
        await press(session, session.keepWritsPanel?.writs[0])
        expect(session.keepWritsPanel?.shovels).toEqual({
            label: `Keep, then Shovels & Swords · ${tileName(tileId)} tile for iron · draw 2 more · can't be undone`,
            enabled: true
        })
        expect(session.keepWrits.entry('cover')?.source).toBe('auto')
    })

    it('R-4.4-H1 with no iron and two tiles, the button waits for the tile', async () => {
        const table = await explored((state, seat) => {
            giveTile(state, seat)
            giveTile(state, seat)
        })
        const { session } = table
        await press(session, session.keepWritsPanel?.writs[0])
        const covers = session.keepWritsPanel?.covers
        expect(covers).toHaveLength(2)
        // R-4.3 A held tile shows its art, turned to its landscape; its name stays the row's name.
        const [first] = session.gameState.getPlayerState(table.seat).regionTiles
        expect(covers?.[0]).toMatchObject({
            label: `${tileName(first)} tile: iron`,
            shown: 'for iron',
            art: {
                kind: 'tile',
                name: tileName(first),
                landscape: session.gameState.tileLandscapes[first]
            }
        })
        expect(session.keepWritsPanel?.shovels?.enabled).toBe(false)
        await press(session, covers?.[1])
        expect(session.keepWritsPanel?.shovels?.enabled).toBe(true)
        await session.keepThenShovels()
        await settled(session)
        expect(lastAction(table)).toMatchObject({
            shovelsAndSwords: true,
            wildTiles: [{ good: 'iron' }]
        })
    })

    it('R-4.4.1 without iron or tile, no Shovels & Swords button', async () => {
        const { session } = await explored()
        await press(session, session.keepWritsPanel?.writs[0])
        expect(session.keepWritsPanel?.shovels).toBeUndefined()
    })

    it('R-4.4.1 reads only in KeepingWrits and only for the drawer; History View sees no panel', async () => {
        const table = await explored()
        const { session, seat } = table
        await press(session, session.keepWritsPanel?.writs[0])
        await session.history.goToPreviousAction()
        await settled(session)
        expect(session.keepWritsPanel).toBeUndefined()
        expect(session.watchingPanel).toBeUndefined()
        expect(session.keepWrits.selection).toEqual({})
        session.history.goToEnd()
        await settled(session)
        expect(keepWritsOffer(session.gameState, seat)).toBeDefined()
        expect(session.keepWritsPanel).toBeDefined()

        const other = await table.host.openSeat(table.other)
        await settled(other)
        expect(other.keepWrits.selection).toEqual({})
        other.keepWrits.push('keep', ['writ.mandate.1'])
        expect(other.keepWrits.selection).toEqual({})
    })

    describe('the five minimum tests', () => {
        async function twoTiles() {
            return explored((state, seat) => {
                giveTile(state, seat)
                giveTile(state, seat)
            })
        }

        it('1, 7 a keep press clears the later tile', async () => {
            const { session } = await twoTiles()
            await press(session, session.keepWritsPanel?.writs[0])
            await press(session, session.keepWritsPanel?.covers?.[0])
            expect(session.keepWrits.value('cover')).toHaveLength(1)
            await press(session, session.keepWritsPanel?.writs[0])
            expect(session.keepWrits.value('cover')).toBeUndefined()
        })

        it('2, 6 Undo pops the tile, then the latest pick, and undoes no action', async () => {
            const table = await twoTiles()
            const { session } = table
            const count = table.host.actions.length
            await press(session, session.keepWritsPanel?.writs[0])
            await press(session, session.keepWritsPanel?.covers?.[0])
            await session.undo()
            expect(session.keepWrits.value('cover')).toBeUndefined()
            expect(session.keepWrits.value('keep')).toHaveLength(1)
            await session.undo()
            expect(session.keepWrits.value('keep') ?? []).toHaveLength(0)
            expect(table.host.actions).toHaveLength(count)
        })

        it('3 with only an auto tile, Undo has nothing to pop', async () => {
            const { session } = await explored((state, seat) => {
                giveTile(state, seat)
            })
            expect(session.keepWrits.hasManual).toBe(false)
            expect(session.keepWrits.localSelection.undo()).toBe(false)
        })

        it('4 a stage out of the order throws', () => {
            const draft = new StagedDraft<KeepWritsValues>(
                KeepWritsStageOrder.filter((stage) => stage !== 'keep')
            )
            expect(() => {
                draft.set('keep', [])
            }).toThrow(OutOfOrder)
        })

        it('5 pressing a pick again unpicks it, so another may be picked', async () => {
            const { session } = await explored()
            const first = session.keepWritsPanel?.writs[0]
            await press(session, first)
            expect(session.keepWritsPanel?.writs[1].refusal).toBeDefined()
            await press(session, session.keepWritsPanel?.writs[0])
            await press(session, session.keepWritsPanel?.writs[1])
            expect(session.keepWritsPanel?.writs[1].picked).toBe(true)
            expect(session.keepWritsPanel?.writs[0].picked).toBe(false)
        })
    })
})

/** R-3.11.3 A Farmer's seat inspects the harvest of a farm it rules, and the favours are asked. */
async function inspecting(edit?: (state: HydratedFeudumGameState) => void) {
    let spaceId: SpaceId = 'space.desert.1'
    const table = hold(
        await seatedAtCards(['harvest', 'tax'], (state, { seat }) => {
            spaceId = emptySpace(state, 'farm')
            placeMarker(state, seat, spaceId)
            state.getPlayerState(seat).pawns[0].character = 'farmer'
            state.recomputeRanks()
        })
    )
    const { session } = table
    session.pressTurnCard('harvest')
    flushSync()
    await session.pressTurnTarget(spaceTarget(spaceId))
    flushSync()
    const inspect = session.turn.flow?.popup?.choices.find(({ label }) =>
        label.startsWith('Inspect')
    )
    assertExists(inspect, 'The Farmer may inspect')
    await session.pressTurnChoice(inspect)
    flushSync()
    await session.sendTurnCard()
    await settled(session)
    expect(session.gameState.machineState).toBe(MachineState.InspectingHarvest)
    if (!edit) {
        return table
    }
    table.host.edit(edit)
    return { ...table, session: await table.host.openSeat(table.seat) }
}

async function pickAll(session: FeudumGameSession) {
    for (let count = 0; count < 12; count += 1) {
        const panel = session.favoursPanel
        const next = panel?.goods.find((good) => good.press && good.taken < good.count)
        if (!next || panel?.primary.enabled) {
            return
        }
        await press(session, next)
    }
}

describe('R-3.11.3 The favours', () => {
    it('S21 the drawn goods, "Take N as favours", the picks; Undo takes back a pick, not the Harvest', async () => {
        const table = await inspecting()
        const { session, seat } = table
        const offer = chooseFavoursOffer(session.gameState, seat)
        assertExists(offer, 'The harvester is asked')
        const panel = session.favoursPanel
        expect(panel?.line).toBe(`Take ${offer.favours} as favours`)
        expect(panel?.noFavours).toBe('No favours')
        expect(panel?.primary.enabled).toBe(session.favours.value('goods') !== undefined)
        await pickAll(session)
        expect(session.favoursPanel?.primary.enabled).toBe(true)
        if (session.favours.hasManual) {
            await session.undo()
            expect(session.favoursPanel?.primary.enabled).toBe(false)
            await pickAll(session)
        }
        expect(lastAction(table)?.type).not.toBe(ActionType.ChooseFavours)
        await sendAndSettle(session)
        expect(lastAction(table)).toMatchObject({ type: ActionType.ChooseFavours })
        expect(session.favoursPanel).toBeUndefined()
        expect(session.undoableAction?.type).not.toBe(ActionType.Harvest)
    })

    it('S21 "No favours" sends null', async () => {
        const table = await inspecting()
        await table.session.chooseNoFavours()
        await settled(table.session)
        expect(lastAction(table)).toMatchObject({
            type: ActionType.ChooseFavours,
            favours: null
        })
    })

    /** The draw and the count fixed by hand, keeping totals: the goods are already off the bag. */
    function drawnIs(
        state: HydratedFeudumGameState,
        drawn: Partial<Record<'food' | 'iron' | 'sulfur', number>>,
        favours: number
    ) {
        const { harvest } = state.flow
        assertExists(harvest, 'The harvest is open')
        harvest.drawn = { food: 0, iron: 0, sulfur: 0, wood: 0, saltpeter: 0, ...drawn }
        harvest.favours = favours
    }

    it('R-3.11.3 the only legal picks are an auto stage: the primary waits for a press', async () => {
        const table = await inspecting((state) => {
            drawnIs(state, { food: 2 }, 2)
        })
        const { session } = table
        expect(session.favours.entry('goods')?.source).toBe('auto')
        expect(session.favoursPanel?.primary.enabled).toBe(true)
        expect(lastAction(table)?.type).not.toBe(ActionType.ChooseFavours)
        expect(session.favours.localSelection.undo()).toBe(false)
    })

    it('R-3.11.3, R-4.10.2 at the count a sulfur may go in the barrel', async () => {
        const { session } = await inspecting((state) => {
            drawnIs(state, { sulfur: 2, food: 1 }, 2)
        })
        const sulfur = () => session.favoursPanel?.goods.find(({ good }) => good === 'sulfur')
        await press(session, sulfur())
        await press(session, sulfur())
        expect(session.favoursPanel?.primary.enabled).toBe(true)
        expect(
            session.favoursPanel?.goods.find(({ good }) => good === 'food')?.refusal
        ).toBeDefined()
        const barrel = session.favoursPanel?.barrel
        expect(barrel?.map(({ label }) => label)).toContain('Keep it all')
        expect(barrel?.map(({ label }) => label)).toContain('1 into the barrel')
        await press(session, row(barrel, '1 into the barrel'))
        expect(session.favours.value('barrel')).toBe(1)
    })

    it('R-X.1 another seat and History View have no panel', async () => {
        const table = await inspecting()
        const other = await table.host.openSeat(table.other)
        await settled(other)
        expect(other.favoursPanel).toBeUndefined()
        await table.session.history.goToPreviousAction()
        await settled(table.session)
        expect(table.session.favoursPanel).toBeUndefined()
    })

    describe('the five minimum tests', () => {
        const sulfurDraw = () =>
            inspecting((state) => {
                drawnIs(state, { sulfur: 2, food: 1 }, 2)
            })
        const pressGood = async (session: FeudumGameSession, good: string) => {
            await press(
                session,
                session.favoursPanel?.goods.find((row) => row.good === good)
            )
        }

        it('1, 7 a further press on the goods clears the barrel', async () => {
            const { session } = await sulfurDraw()
            await pressGood(session, 'sulfur')
            await pressGood(session, 'sulfur')
            await press(session, row(session.favoursPanel?.barrel, '1 into the barrel'))
            await pressGood(session, 'sulfur')
            expect(session.favours.value('barrel')).toBeUndefined()
        })

        it('2, 6 Undo pops the barrel, then the latest good, undoing no action', async () => {
            const table = await sulfurDraw()
            const { session } = table
            const count = table.host.actions.length
            await pressGood(session, 'sulfur')
            await pressGood(session, 'food')
            await press(session, row(session.favoursPanel?.barrel, 'Keep it all'))
            await session.undo()
            expect(session.favours.value('barrel')).toBeUndefined()
            expect(session.favours.value('goods')).toEqual(['sulfur', 'food'])
            await session.undo()
            expect(session.favours.value('goods')).toEqual(['sulfur'])
            expect(table.host.actions).toHaveLength(count)
        })

        it('3 with only auto goods, nothing pops', async () => {
            const { session } = await inspecting((state) => {
                drawnIs(state, { food: 2 }, 2)
            })
            expect(session.favours.localSelection.undo()).toBe(false)
        })

        it('4 a stage out of the order throws', () => {
            const draft = new StagedDraft<FavoursValues>(
                FavoursStageOrder.filter((stage) => stage !== 'goods')
            )
            expect(() => {
                draft.set('goods', [])
            }).toThrow(OutOfOrder)
        })

        it('5 at the count, a press on a picked good takes one back', async () => {
            const { session } = await sulfurDraw()
            await pressGood(session, 'sulfur')
            await pressGood(session, 'food')
            await pressGood(session, 'food')
            expect(session.favours.value('goods')).toEqual(['sulfur'])
        })
    })
})

/** R-3.13, R-4.8 The seat sent a Conquer no one may answer, and may add to its attack. */
async function committing(arrange?: (state: HydratedFeudumGameState, seat: string) => void) {
    let spaceId: SpaceId = 'space.desert.1'
    const table = hold(
        await seatedAtCards(['conquer', 'tax', 'move'], (state, { seat, other }) => {
            spaceId = emptySpace(state, 'outpost')
            addPawn(state, seat, 'noble', spaceId)
            addPawn(state, other, 'knight', spaceId)
            state.recomputeRanks()
            state.getPlayerState(other).played.push({ kind: 'defend', use: 'regular' })
            returnGoods(state, seat)
            arrange?.(state, seat)
        })
    )
    const { session, other } = table
    session.pressTurnCard('conquer')
    flushSync()
    const n = session.gameState.getPlayerState(other).pawns.find((pawn) => pawn.spaceId === spaceId)
    assertExists(n, 'The other seat has a pawn there')
    await session.pressTurnTarget(pawnTarget(other, n.n))
    await settled(session)
    expect(session.gameState.machineState).toBe(MachineState.CommittingAttack)
    return { ...table, spaceId }
}

describe('R-4.8 The commit', () => {
    const swordAndSaltpeter = (state: HydratedFeudumGameState, seat: string) => {
        giveGood(state, seat, 'saltpeter')
        holdWrit(state, seat, 'writ.mandate.3')
    }

    it('S36 saltpeter and the free sword raise the tally; Undo removes the sword, then the saltpeter', async () => {
        const table = await committing(swordAndSaltpeter)
        const { session } = table
        const total = () =>
            session.commitPanel?.tally.find(({ source }) => source === 'total')?.attack ?? 0
        const before = total()
        expect(session.commitPanel?.saltpeter).toMatchObject({ count: 0 })
        await press(session, session.commitPanel?.saltpeter.add)
        expect(total()).toBe(before + 1)
        const sword = session.commitPanel?.weapons.find(({ writId }) => writId === 'writ.mandate.3')
        expect(sword?.alternatives.map(({ label }) => label)).toContain(
            'Use sword for free: +1 attack'
        )
        await press(session, sword?.alternatives[0])
        expect(total()).toBe(before + 2)
        const defence =
            session.commitPanel?.tally.find(({ source }) => source === 'total')?.defence ?? 0
        expect(session.commitPanel?.primary.label).toMatch(
            new RegExp(`^Attack ${before + 2} vs ${defence}: (wins · \\+\\d+ vp|fails)$`)
        )
        await session.undo()
        expect(total()).toBe(before + 1)
        expect(session.commitPanel?.saltpeter.count).toBe(1)
        await session.undo()
        expect(total()).toBe(before)
        expect(session.commitPanel?.saltpeter.count).toBe(0)
        expect(session.gameState.machineState).toBe(MachineState.CommittingAttack)
    })

    it('S36 the send carries what was added; S37 a loss or a win comes from the logic package', async () => {
        const table = await committing(swordAndSaltpeter)
        const { session } = table
        await press(session, session.commitPanel?.saltpeter.add)
        await press(
            session,
            session.commitPanel?.weapons.find(({ writId }) => writId === 'writ.mandate.3')
                ?.alternatives[0]
        )
        await sendAndSettle(session)
        expect(lastAction(table)).toMatchObject({
            type: ActionType.CommitAttack,
            saltpeter: 1,
            weapons: [{ writId: 'writ.mandate.3', alternative: 0 }]
        })
        expect(session.commitPanel).toBeUndefined()
    })

    it('R-4.8.2 one saltpeter without a knight; a second is refused with its line', async () => {
        const { session } = await committing((state, seat) => {
            giveGood(state, seat, 'saltpeter')
            giveGood(state, seat, 'saltpeter')
        })
        await press(session, session.commitPanel?.saltpeter.add)
        expect(session.commitPanel?.saltpeter.add.refusal).toBeDefined()
        expect(session.commitPanel?.saltpeter.add.press).toBeUndefined()
    })

    it('R-4.4-H1 a turn-in short of a good offers the tile cover, and the send spends it', async () => {
        const table = await committing((state, seat) => {
            holdWrit(state, seat, 'writ.mandate.3')
            giveTile(state, seat)
            giveTile(state, seat)
        })
        const { session } = table
        const longsword = () =>
            session.commitPanel?.weapons.find(({ writId }) => writId === 'writ.mandate.3')
                ?.alternatives[1]
        await press(session, longsword())
        expect(session.commitPanel?.primary.enabled).toBe(false)
        const covers = session.commitPanel?.covers
        expect(covers).toHaveLength(2)
        await press(session, covers?.[0])
        expect(session.commitPanel?.primary.enabled).toBe(true)
        await sendAndSettle(session)
        expect(lastAction(table)).toMatchObject({
            type: ActionType.CommitAttack,
            wildTiles: [{ good: 'iron' }]
        })
    })

    it('R-X.1 reads only for the attacker; History View sees no panel', async () => {
        const table = await committing(swordAndSaltpeter)
        const other = await table.host.openSeat(table.other)
        await settled(other)
        expect(other.commitPanel).toBeUndefined()
        await table.session.history.goToPreviousAction()
        await settled(table.session)
        expect(table.session.commitPanel).toBeUndefined()
    })

    describe('the five minimum tests', () => {
        const longswordCover = (state: HydratedFeudumGameState, seat: string) => {
            holdWrit(state, seat, 'writ.mandate.3')
            giveTile(state, seat)
            giveTile(state, seat)
            giveGood(state, seat, 'saltpeter')
        }
        const weapon = (session: FeudumGameSession, alternative: number) =>
            session.commitPanel?.weapons.find(({ writId }) => writId === 'writ.mandate.3')
                ?.alternatives[alternative]

        it('1, 7 a further add clears the tiles', async () => {
            const { session } = await committing(longswordCover)
            await press(session, weapon(session, 1))
            await press(session, session.commitPanel?.covers?.[0])
            expect(session.commitAttack.value('cover')).toHaveLength(1)
            await press(session, session.commitPanel?.saltpeter.add)
            expect(session.commitAttack.value('cover')).toBeUndefined()
        })

        it('2, 6 Undo pops the tile, then the latest add, and undoes no action', async () => {
            const table = await committing(longswordCover)
            const { session } = table
            const count = table.host.actions.length
            await press(session, session.commitPanel?.saltpeter.add)
            await press(session, weapon(session, 1))
            await press(session, session.commitPanel?.covers?.[0])
            await session.undo()
            expect(session.commitAttack.value('cover')).toBeUndefined()
            await session.undo()
            expect(session.commitAttack.value('adds')).toEqual([{ kind: 'saltpeter' }])
            expect(table.host.actions).toHaveLength(count)
        })

        it('3 with no manual stage, Undo takes back the Conquer', async () => {
            const table = await committing(swordAndSaltpeter)
            const { session } = table
            expect(session.undoableAction).toBeDefined()
            await session.undo()
            await settled(session)
            expect(session.gameState.machineState).toBe(MachineState.PlayingCards)
        })

        it('4 a stage out of the order throws', () => {
            const draft = new StagedDraft<CommitAttackValues>(
                CommitAttackStageOrder.filter((stage) => stage !== 'adds')
            )
            expect(() => {
                draft.set('adds', [])
            }).toThrow(OutOfOrder)
        })

        it('5 the other alternative replaces a weapon; pressed again it comes off', async () => {
            const { session } = await committing(longswordCover)
            await press(session, weapon(session, 0))
            await press(session, weapon(session, 1))
            expect(session.commitAttack.value('adds')).toEqual([
                { kind: 'weapon', writId: 'writ.mandate.3', alternative: 1 }
            ])
            await press(session, weapon(session, 1))
            expect(session.commitAttack.value('adds')).toEqual([])
        })
    })
})

/** R-3.14.1 Ana conquers: the defender is asked, with or without Defend. */
async function askedToDefend(
    otherCards: ActionCardKind[],
    before?: (defender: FeudumGameSession) => void
) {
    let spaceId: SpaceId = 'space.desert.1'
    const table = hold(
        await seatedAtCards(
            ['conquer', 'tax', 'move'],
            (state, { seat, other }) => {
                spaceId = emptySpace(state, 'outpost')
                addPawn(state, seat, 'knight', spaceId)
                addPawn(state, other, 'knight', spaceId)
                state.recomputeRanks()
            },
            { otherCards }
        )
    )
    const { session, other, host: game } = table
    const third = game.order.find((id) => id !== table.seat && id !== other)
    assertExists(third, 'Three seats')
    const defender = await game.openSeat(other)
    const watcher = await game.openSeat(third)
    before?.(defender)
    session.pressTurnCard('conquer')
    flushSync()
    const pawn = session.gameState
        .getPlayerState(other)
        .pawns.find((row) => row.spaceId === spaceId)
    assertExists(pawn, 'The defender has a pawn there')
    await session.pressTurnTarget(pawnTarget(other, pawn.n))
    flushSync()
    await session.sendTurnCard()
    await settled(session)
    await settled(defender)
    await settled(watcher)
    expect(session.gameState.machineState).toBe(MachineState.AwaitingDefence)
    return { ...table, spaceId, defender, watcher, pawnN: pawn.n }
}

describe('R-3.14.1 AnswerAttack', () => {
    it('S33 with Defend: both buttons, and only a press answers', async () => {
        const table = await askedToDefend(['defend', 'tax'])
        const { defender, session } = table
        const panel = defender.answerAttackPanel
        const ana = defender.getPlayerName(table.seat)
        expect(panel?.line).toMatch(
            new RegExp(`^${ana} conquers your knight at .+: attack \\d+, defence \\d+\\.$`)
        )
        expect(panel?.flip?.label).toBe("Flip Defend · +1 defence · +1 vp · can't be undone")
        expect(panel?.letStand.label).toBe("Let it stand · can't be undone")
        expect(panel?.noDefend).toBeUndefined()
        expect(lastAction(table)?.type).toBe(ActionType.Conquer)
        await defender.answerAttack(true)
        await settled(defender)
        await settled(session)
        expect(lastAction(table)).toMatchObject({
            type: ActionType.AnswerAttack,
            flipDefend: true,
            revealsInfo: true
        })
        expect(defender.answerAttackPanel).toBeUndefined()
    })

    it('S34 without Defend: the line, "You hold no Defend.", one button, and no answer sent', async () => {
        const table = await askedToDefend(['tax', 'guild'])
        const { defender } = table
        const panel = defender.answerAttackPanel
        expect(panel?.noDefend).toBe('You hold no Defend.')
        expect(panel?.flip).toBeUndefined()
        expect(panel?.letStand.label).toBe("Let it stand · can't be undone")
        expect(defender.gameState.machineState).toBe(MachineState.AwaitingDefence)
        expect(lastAction(table)?.type).toBe(ActionType.Conquer)
        await defender.answerAttack(true)
        expect(lastAction(table)?.type).toBe(ActionType.Conquer)
        await defender.answerAttack(false)
        await settled(defender)
        expect(lastAction(table)).toMatchObject({
            type: ActionType.AnswerAttack,
            flipDefend: false
        })
    })

    it('S34 the attacker and the third seat see the same with or without Defend', async () => {
        const held = await askedToDefend(['defend', 'tax'])
        const withDefend = [held.session.watchingPanel, held.watcher.watchingPanel]
        const boardWith = roleOf(held.watcher.boardOffer, pawnTarget(held.other, held.pawnN))
        expect(withDefend[0]).toEqual(withDefend[1])
        expect(withDefend[0]?.waitingOn).toEqual([held.other])
        expect(boardWith).toBe('being-decided')
        expect(held.defender.watchingPanel).toBeUndefined()
        expect(roleOf(held.defender.boardOffer, pawnTarget(held.other, held.pawnN))).toBe('plain')
        held.host.close()

        const without = await askedToDefend(['tax', 'guild'])
        expect(without.session.watchingPanel).toEqual(withDefend[0])
        expect(without.watcher.watchingPanel).toEqual(withDefend[1])
        expect(roleOf(without.watcher.boardOffer, pawnTarget(without.other, without.pawnN))).toBe(
            boardWith
        )
    })

    it('R-X.1 History View sees no panel, no line, only the outline', async () => {
        const { defender, other, pawnN } = await askedToDefend(['defend', 'tax'])
        await defender.history.goToPreviousAction()
        await settled(defender)
        expect(defender.answerAttackPanel).toBeUndefined()
        expect(defender.watchingPanel).toBeUndefined()
        defender.history.goToEnd()
        await settled(defender)
        expect(defender.answerAttackPanel).toBeDefined()
        expect(roleOf(defender.boardOffer, pawnTarget(other, pawnN))).toBe('plain')
    })

    it('Coexistence: a local draft held when the ask arrives is cleared with the new state', async () => {
        const table = await askedToDefend(['defend', 'tax'], (defender) => {
            defender.turn.set('card', 'tax')
        })
        const { defender, other } = table
        expect(defender.gameState.machineState).toBe(MachineState.AwaitingDefence)
        expect(defender.answerAttackPanel).toBeDefined()
        const onTurn = defender.gameState.dehydrate()
        onTurn.machineState = MachineState.PlayingCards
        onTurn.activePlayerIds = [other]
        assertExists(onTurn.flow.turn, 'The turn is still under way')
        onTurn.flow.turn.playerId = other
        defender.gameState = new HydratedFeudumGameState(onTurn)
        flushSync()
        expect(defender.turnPanel).toBeDefined()
        expect(defender.turn.card).toBeUndefined()
        defender.turn.set('card', 'tax')
        expect(defender.turn.card).toBe('tax')
    })
})

/** R-3.13.2 Ana starves Ben's serf; Ben is asked. */
async function askedToAnswerStarve(
    otherCards: ActionCardKind[],
    arrange?: (state: HydratedFeudumGameState, other: string) => void
) {
    let spaceId: SpaceId = 'space.desert.1'
    const table = hold(
        await seatedAtCards(
            ['conquer', 'tax', 'move'],
            (state, { seat, other }) => {
                spaceId = emptySpace(state, 'outpost')
                addPawn(state, seat, 'noble', spaceId)
                placeMarker(state, seat, spaceId)
                placeMarker(state, other, spaceId)
                state.recomputeRanks()
                holdFood(state, other, 1)
                arrange?.(state, other)
            },
            { otherCards }
        )
    )
    const { session, other, host: game } = table
    const third = game.order.find((id) => id !== table.seat && id !== other)
    assertExists(third, 'Three seats')
    const answerer = await game.openSeat(other)
    const watcher = await game.openSeat(third)
    session.pressTurnCard('conquer')
    flushSync()
    const starve = session.turnPanel?.modes.find(({ label }) => label === 'Starve the People')
    assertExists(starve, 'Conquer may starve')
    await session.pressTurnChoice(starve)
    flushSync()
    await session.pressTurnTarget(markerTarget(spaceId, other, 'serf'))
    flushSync()
    await session.sendTurnCard()
    await settled(session)
    await settled(answerer)
    await settled(watcher)
    expect(session.gameState.machineState).toBe(MachineState.AwaitingImmunity)
    return { ...table, spaceId, answerer, watcher }
}

describe('R-3.14.2 AnswerStarve', () => {
    it('S38 Royal Immunity with Defend and a food: the press cancels the starve', async () => {
        const table = await askedToAnswerStarve(['defend', 'tax'])
        const { answerer, seat } = table
        const panel = answerer.answerStarvePanel
        const ana = answerer.getPlayerName(seat)
        expect(panel?.line).toMatch(new RegExp(`^${ana} starves your serf at .+\\.$`))
        expect(panel?.immunity).toEqual({
            label: "Royal Immunity · 1 food · can't be undone",
            enabled: true
        })
        expect(panel?.cantAnswer).toBeUndefined()
        expect(panel?.letGo.label).toBe("Let it go · can't be undone")
        expect(lastAction(table)?.type).toBe(ActionType.StarveThePeople)
        await answerer.answerStarveWith(true)
        await settled(answerer)
        expect(lastAction(table)).toMatchObject({
            type: ActionType.AnswerStarve,
            royalImmunity: true,
            revealsInfo: true
        })
        expect(answerer.answerStarvePanel).toBeUndefined()
    })

    it('S38 without Defend: "You can\'t answer." and "Let it go"; no answer is sent for the seat', async () => {
        const table = await askedToAnswerStarve(['tax', 'guild'])
        const { answerer, spaceId, other } = table
        const panel = answerer.answerStarvePanel
        expect(panel?.cantAnswer).toBe("You can't answer.")
        expect(panel?.immunity).toBeUndefined()
        expect(lastAction(table)?.type).toBe(ActionType.StarveThePeople)
        expect(answerer.gameState.machineState).toBe(MachineState.AwaitingImmunity)
        await answerer.answerStarveWith(true)
        expect(lastAction(table)?.type).toBe(ActionType.StarveThePeople)
        expect(roleOf(answerer.boardOffer, markerTarget(spaceId, other, 'serf'))).toBe('plain')
        await answerer.answerStarveWith(false)
        await settled(answerer)
        expect(lastAction(table)).toMatchObject({
            type: ActionType.AnswerStarve,
            royalImmunity: false
        })
    })

    it('S38 others see the line, "answers", and the marker outlined, whatever Ben holds', async () => {
        const held = await askedToAnswerStarve(['defend', 'tax'])
        expect(held.watcher.watchingPanel).toEqual(held.session.watchingPanel)
        expect(held.watcher.watchingPanel?.waitingOn).toEqual([held.other])
        expect(
            roleOf(held.watcher.boardOffer, markerTarget(held.spaceId, held.other, 'serf'))
        ).toBe('being-decided')
        const line = held.watcher.watchingPanel
        held.host.close()
        const without = await askedToAnswerStarve(['tax', 'guild'])
        expect(without.watcher.watchingPanel).toEqual(line)
    })

    it('R-3.14-H3 no food and one tile: an auto stage names the tile by region and epoch and waits for the press', async () => {
        let tileId: TileId | undefined
        const { answerer } = await askedToAnswerStarve(['defend', 'tax'], (state, other) => {
            holdFood(state, other, 0)
            tileId = giveTile(state, other)
        })
        assertExists(tileId)
        expect(answerer.answerStarve.entry('cover')?.source).toBe('auto')
        expect(answerer.answerStarvePanel?.immunity?.label).toBe(
            `Royal Immunity · ${tileName(tileId)} tile for food · can't be undone`
        )
    })

    it('R-3.14.2 asked with no Defend: the seat cannot answer, and can only let it go', async () => {
        const { answerer } = await askedToAnswerStarve(['tax', 'guild'])
        expect(answerer.answerStarvePanel?.cantAnswer).toBe("You can't answer.")
        expect(answerer.answerStarvePanel?.immunity).toBeUndefined()
    })

    it('R-X.1 History View has no panel', async () => {
        const { answerer } = await askedToAnswerStarve(['defend', 'tax'])
        await answerer.history.goToPreviousAction()
        await settled(answerer)
        expect(answerer.answerStarvePanel).toBeUndefined()
        expect(answerer.answerStarve.selection).toEqual({})
    })

    describe('the five minimum tests', () => {
        const twoTiles = () =>
            askedToAnswerStarve(['defend', 'tax'], (state, other) => {
                holdFood(state, other, 0)
                giveTile(state, other)
                giveTile(state, other)
            })

        it('1, 5 pressing a tile again unpicks it, so the other may be picked', async () => {
            const { answerer } = await twoTiles()
            const [first, second] = answerer.answerStarvePanel?.covers ?? []
            await press(answerer, first)
            expect(answerer.answerStarvePanel?.immunity?.enabled).toBe(true)
            expect(answerer.answerStarvePanel?.covers?.[1].refusal).toBeDefined()
            await press(answerer, answerer.answerStarvePanel?.covers?.[0])
            expect(answerer.answerStarvePanel?.immunity?.enabled).toBe(false)
            await press(answerer, second)
            expect(answerer.answerStarve.value('cover')).toHaveLength(1)
        })

        it('2, 6 Undo pops the tile, and answers nothing', async () => {
            const table = await twoTiles()
            const { answerer } = table
            await press(answerer, answerer.answerStarvePanel?.covers?.[0])
            await answerer.undo()
            expect(answerer.answerStarve.value('cover') ?? []).toHaveLength(0)
            expect(lastAction(table)?.type).toBe(ActionType.StarveThePeople)
        })

        it('3 with only an auto tile, nothing pops', async () => {
            const { answerer } = await askedToAnswerStarve(['defend', 'tax'], (state, other) => {
                holdFood(state, other, 0)
                giveTile(state, other)
            })
            expect(answerer.answerStarve.hasManual).toBe(false)
            expect(answerer.answerStarve.localSelection.undo()).toBe(false)
        })

        it('4 a stage out of the order throws', () => {
            const draft = new StagedDraft<AnswerStarveValues>(
                AnswerStarveStageOrder.filter((stage) => stage !== 'cover')
            )
            expect(() => {
                draft.set('cover', [])
            }).toThrow(OutOfOrder)
        })
    })
})

/** R-4.4.4 The seat ends a card holding four writs, by forfeiting it. */
async function overLimit() {
    const table = hold(
        await seatedAtCards(['tax', 'move'], (state, { seat }) => {
            holdFood(state, seat, 1)
            for (const writId of [
                'writ.mandate.5',
                'writ.mandate.2',
                'writ.mandate.4',
                'writ.mandate.7'
            ] as const) {
                holdWrit(state, seat, writId)
            }
        })
    )
    const { session } = table
    session.pressTurnCard('tax')
    flushSync()
    await session.forfeitTurnCard()
    await settled(session)
    expect(session.gameState.machineState).toBe(MachineState.DiscardingWrits)
    return table
}

describe('R-4.4.4 The writ limit', () => {
    it('S52 "Hold at most 3 writs": a press picks, the primary sends, and the turn passes', async () => {
        const table = await overLimit()
        const { session, seat } = table
        const panel = session.writLimitPanel
        expect(panel?.line).toBe('Hold at most 3 writs: 4 now')
        expect(panel?.writs).toHaveLength(4)
        expect(panel?.primary).toEqual({
            label: "Discard to the deck's bottom · face down",
            enabled: false
        })
        await press(session, panel?.writs[1])
        expect(lastAction(table)?.type).not.toBe(ActionType.DiscardWrit)
        expect(session.writLimitPanel?.primary.enabled).toBe(true)
        await sendAndSettle(session)
        expect(lastAction(table)).toMatchObject({ type: ActionType.DiscardWrit })
        expect(session.gameState.getPlayerState(seat).writCount).toBe(3)
        expect(session.gameState.machineState).not.toBe(MachineState.DiscardingWrits)
        expect(session.writLimitPanel).toBeUndefined()
    })

    it('S52 playing a mandate from the row instead also brings it to 3', async () => {
        const table = await overLimit()
        const { session, seat } = table
        await press(
            session,
            session.atWillPanel?.chips.find(({ list }) => list === 'writs')
        )
        const panel = session.atWillPanel
        expect(session.writLimitPanel).toBeDefined()
        const mandate = panel?.writs?.find(({ writId }) => writId === 'writ.mandate.5')
        await press(session, mandate?.choices[0])
        await settled(session)
        expect(lastAction(table)).toMatchObject({
            type: ActionType.PlayMandate,
            writId: 'writ.mandate.5'
        })
        expect(session.gameState.getPlayerState(seat).writCount).toBe(3)
    })

    it('R-X.1 reads only in DiscardingWrits and only for the holder', async () => {
        const table = await overLimit()
        const other = await table.host.openSeat(table.other)
        await settled(other)
        expect(other.writLimitPanel).toBeUndefined()
        await table.session.history.goToPreviousAction()
        await settled(table.session)
        expect(table.session.writLimitPanel).toBeUndefined()
    })

    it('R-4.4.4 in PlayingCards an at-will Discard is not this draft', async () => {
        const table = hold(
            await seatedAtCards(['tax', 'move'], (state, { seat }) => {
                holdWrit(state, seat, 'writ.mandate.5')
            })
        )
        expect(table.session.gameState.machineState).toBe(MachineState.PlayingCards)
        expect(table.session.writLimitPanel).toBeUndefined()
    })

    describe('the five minimum tests', () => {
        it('1, 5 a press on another writ replaces the pick; pressed again it unpicks', async () => {
            const { session } = await overLimit()
            const [first, second] = session.writLimitPanel?.writs ?? []
            await press(session, first)
            await press(session, second)
            expect(session.writLimit.value('writ')).toBe(second.writId)
            await press(session, session.writLimitPanel?.writs[1])
            expect(session.writLimit.value('writ')).toBeUndefined()
        })

        it('2 Undo pops the pick and undoes no action', async () => {
            const table = await overLimit()
            const { session } = table
            const count = table.host.actions.length
            await press(session, session.writLimitPanel?.writs[0])
            await session.undo()
            expect(session.writLimit.value('writ')).toBeUndefined()
            expect(table.host.actions).toHaveLength(count)
        })

        it('3 with no manual stage, Undo reaches the action', async () => {
            const { session } = await overLimit()
            expect(session.writLimit.hasManual).toBe(false)
            expect(session.writLimit.localSelection.undo()).toBe(false)
        })

        it('4 a stage out of the order throws', () => {
            const draft = new StagedDraft<WritLimitValues>(
                WritLimitStageOrder.filter((stage) => stage !== 'writ')
            )
            expect(() => {
                draft.set('writ', 'writ.mandate.1')
            }).toThrow(OutOfOrder)
        })
    })
})

describe('R-4.10 Nourish', () => {
    const scarce = () =>
        atNourishing((state, { seat }) => {
            threePawns(state, seat)
            holdFood(state, seat, 1)
            fillBarrel(state, seat, 1)
        })

    function feeding(session: FeudumGameSession): string[] {
        return (session.nourishPanel?.pawns ?? []).map(({ feed }) => feed)
    }

    it('S53 the preselection feeds food, wine, and leaves the third unfed, in rose; no press sends', async () => {
        const table = hold(await scarce())
        const { session, seat } = table
        expect(session.gameState.machineState).toBe(MachineState.Nourishing)
        expect(session.nourish.entry('feeding')?.source).toBe('auto')
        expect(feeding(session)).toEqual(['food', 'wine', 'unfed'])
        const third = session.nourishPanel?.pawns[2]
        expect(third).toMatchObject({ name: 'Farmer', unfed: true })
        expect(third?.place).toBe(third && spaceLabel(third.spaceId))
        expect(third?.choices.map(({ label }) => label)).toEqual(['Food', 'Wine', 'Unfed'])
        expect(row(third?.choices, 'Unfed')).toMatchObject({ shown: 'unfed' })
        expect(row(third?.choices, 'Unfed')).not.toHaveProperty('caption')
        // R-4.10.1 The food and the wine are taken: pressing one swaps it from the pawn eating it.
        expect(row(third?.choices, 'Food')).toMatchObject({ spent: true })
        expect(row(third?.choices, 'Food')).not.toHaveProperty('caption')
        expect(row(third?.choices, 'Food').press).toBeDefined()
        expect(session.nourishPanel?.primary).toEqual({
            label: 'Feed 2 · leave 1',
            enabled: true
        })
        const pawn = session.gameState.getPlayerState(seat).pawns.find((row) => row.spaceId)
        assertExists(pawn, 'A pawn stands on the board')
        expect(roleOf(session.boardOffer, pawnTarget(seat, pawn.n))).toBe('lit')
        expect(lastAction(table)?.type).not.toBe(ActionType.Nourish)
    })

    it('R-4.10.2 each pawn pays food or wine, drawn; wine alone keeps its cost; the send says what is paid', async () => {
        const table = hold(
            await atNourishing((state, { seat }) => {
                threePawns(state, seat)
                holdFood(state, seat, 4)
                fillBarrel(state, seat, 1)
            })
        )
        const panel = table.session.nourishPanel
        const [first] = panel?.pawns ?? []
        expect(first.choices.map(({ label }) => label)).toEqual(['Food', 'Wine'])
        expect(row(first.choices, 'Food')).toMatchObject({
            picked: true,
            shown: '',
            good: 'food'
        })
        expect(row(first.choices, 'Food')).not.toHaveProperty('caption')
        expect(row(first.choices, 'Wine')).toMatchObject({
            picked: false,
            shown: '',
            caption: '2 rounds · 0 strength',
            good: 'sulfur'
        })
        expect(panel).not.toHaveProperty('summary')
        expect(panel).not.toHaveProperty('rule')
        expect(panel?.primary.label).toBe('Feed 3 · 3 food')
        expect(panel?.send).toEqual({ fed: 3, food: 3, wine: 0 })
        await press(table.session, row(first.choices, 'Wine'))
        expect(table.session.nourishPanel?.primary.label).toBe('Feed 3 · 2 food · 1 wine')
        expect(table.session.nourishPanel?.send).toEqual({ fed: 3, food: 2, wine: 1 })
    })

    it('R-4.10.1 each fed pawn shows its payment on the map; the unfed one, what it loses', async () => {
        const table = hold(await scarce())
        const { session, seat } = table
        const notes = (session.nourish.pick?.targets ?? []).map(({ notes }) => notes)
        expect(notes).toEqual([
            [{ kind: 'role', label: '1 food', art: [{ kind: 'good', good: 'food', count: 1 }] }],
            [{ kind: 'role', label: '1 wine', art: [{ kind: 'good', good: 'sulfur', count: 1 }] }],
            [{ kind: 'threat', label: 'home' }]
        ])
        expect(session.nourish.pick?.targets[0].target).toContain(seat)
    })

    it('S53 the seat picks which pawn goes unfed, and can never leave one it could feed', async () => {
        const table = hold(await scarce())
        const { session } = table
        await press(session, row(session.nourishPanel?.pawns[0].choices, 'Unfed'))
        expect(feeding(session)).toEqual(['unfed', 'wine', 'food'])
        await press(session, row(session.nourishPanel?.pawns[1].choices, 'Food'))
        expect(feeding(session)).toEqual(['unfed', 'food', 'wine'])
        expect(session.nourishPanel?.primary.label).toBe('Feed 2 · leave 1')
        const [first, second, third] = session.gameState
            .getPlayerState(table.seat)
            .pawns.filter((pawn) => pawn.spaceId)
        await sendAndSettle(session)
        expect(lastAction(table)).toMatchObject({
            type: ActionType.Nourish,
            unfed: [first.n],
            wineFed: [third.n]
        })
        expect(second.n).toBeDefined()
        expect(session.nourishPanel).toBeUndefined()
    })

    it('R-4.10-H3 "Unfed" shows only when food and wine fall short', async () => {
        const table = hold(
            await atNourishing((state, { seat }) => {
                threePawns(state, seat)
                holdFood(state, seat, 2)
                fillBarrel(state, seat, 1)
            })
        )
        const labels = table.session.nourishPanel?.pawns[0].choices.map(({ label }) => label)
        expect(labels).toEqual(['Food', 'Wine'])
    })

    it('R-4.10.2 an empty barrel hides "Wine", and no food at all hides "Food"', async () => {
        const table = hold(
            await atNourishing((state, { seat }) => {
                threePawns(state, seat)
                holdFood(state, seat, 2)
            })
        )
        const choices = table.session.nourishPanel?.pawns[0].choices
        expect(choices?.map(({ label }) => label)).toEqual(['Food', 'Unfed'])
        const none = hold(
            await atNourishing((state, { seat }) => {
                threePawns(state, seat)
                holdFood(state, seat, 0)
                fillBarrel(state, seat, 1)
            })
        )
        const labels = none.session.nourishPanel?.pawns[0].choices.map(({ label }) => label)
        expect(labels).toEqual(['Wine', 'Unfed'])
    })

    it('R-4.10.1 a pawn press on the map moves it to the next feed', async () => {
        const table = hold(await scarce())
        const { session, seat } = table
        const [first] = session.gameState.getPlayerState(seat).pawns.filter((pawn) => pawn.spaceId)
        await session.pressTurnTarget(pawnTarget(seat, first.n))
        flushSync()
        expect(feeding(session)[0]).toBe('wine')
    })

    it('R-4.3.3 short with a tile: the cover offers food or wine, and the preselection follows', async () => {
        const table = hold(
            await atNourishing((state, { seat }) => {
                threePawns(state, seat)
                holdFood(state, seat, 1)
                giveTile(state, seat)
            })
        )
        const { session } = table
        expect(feeding(session)).toEqual(['food', 'unfed', 'unfed'])
        expect(session.nourishPanel?.coverLine).toBe('A tile feeds 1')
        const food = session.nourishPanel?.covers?.find(({ label }) => label.endsWith('food'))
        const [tileId] = session.gameState.getPlayerState(table.seat).regionTiles
        expect(food).toMatchObject({
            label: `${tileName(tileId)} tile → food`,
            shown: 'for food',
            art: { kind: 'tile', name: tileName(tileId) }
        })
        await press(session, food)
        expect(feeding(session)).toEqual(['food', 'food', 'unfed'])
        expect(session.nourishPanel?.primary.label).toBe('Feed 2 · leave 1')
        await sendAndSettle(session)
        expect(lastAction(table)).toMatchObject({
            type: ActionType.Nourish,
            wildTiles: [{ good: 'food' }]
        })
    })

    it('S53 another seat sees the row and its ticks; History View no panel', async () => {
        const table = hold(await scarce())
        const other = await table.host.openSeat(table.other)
        await settled(other)
        expect(other.nourishPanel).toBeUndefined()
        const row = other.orderRow?.entries
        expect(row?.map(({ playerId }) => playerId)).toEqual(table.host.order)
        expect(row?.find(({ playerId }) => playerId === table.seat)).toMatchObject({
            deciding: true,
            done: false
        })
        expect(row?.find(({ playerId }) => playerId === table.other)?.done).toBe(true)
        expect(orderRowOf(other.gameState)?.entries).toEqual(row)
        await table.session.history.goToPreviousAction()
        await settled(table.session)
        expect(table.session.nourishPanel).toBeUndefined()
    })

    describe('R-4.10-H4 two seats at once', () => {
        /** Both seats short: three pawns, one food and one barrel sulfur each. */
        const together = () =>
            atNourishingTogether((state, { seat, other }) => {
                for (const playerId of [seat, other]) {
                    threePawns(state, playerId)
                    holdFood(state, playerId, 1)
                    fillBarrel(state, playerId, 1)
                }
            })

        /** The seat nourishing doesn't ask. */
        function watcherOf(table: SeatTable): string {
            const watcher = table.host.order.find(
                (playerId) => playerId !== table.seat && playerId !== table.other
            )
            assertExists(watcher, 'A third seat watches')
            return watcher
        }

        it("each seat deciding has its own panel at once, and one's send keeps the other's draft", async () => {
            const table = hold(await together())
            const { session } = table
            const other = await table.host.openSeat(table.other)
            await settled(other)
            expect(session.nourishPanel).toBeDefined()
            expect(other.nourishPanel).toBeDefined()
            await press(session, row(session.nourishPanel?.pawns[0].choices, 'Unfed'))
            expect(feeding(session)).toEqual(['unfed', 'wine', 'food'])

            await sendAndSettle(other)
            await settled(session)

            expect(lastAction(table)).toMatchObject({
                type: ActionType.Nourish,
                playerId: table.other,
                simultaneousGroupId: nourishGroup(session.gameState)
            })
            expect(other.nourishPanel).toBeUndefined()
            expect(feeding(session)).toEqual(['unfed', 'wine', 'food'])
            const group = nourishGroup(session.gameState)
            await sendAndSettle(session)
            expect(lastAction(table)).toMatchObject({
                type: ActionType.Nourish,
                playerId: table.seat,
                simultaneousGroupId: group
            })
        })

        it('the waiting line names every seat still deciding; the row marks them deciding, none next', async () => {
            const table = hold(await together())
            const watcher = await table.host.openSeat(watcherOf(table))
            await settled(watcher)
            const [first, second] = table.host.order.filter(
                (playerId) => playerId === table.seat || playerId === table.other
            )
            expect(watcher.watchingPanel?.waitingOn).toEqual([first, second])
            const entries = watcher.orderRow?.entries ?? []
            for (const playerId of [first, second]) {
                expect(entries.find((entry) => entry.playerId === playerId)).toMatchObject({
                    done: false,
                    deciding: true
                })
            }
            expect(entries.some((entry) => 'next' in entry && entry.next)).toBe(false)

            await sendAndSettle(table.session)
            await settled(watcher)

            const still = first === table.seat ? second : first
            expect(watcher.watchingPanel?.waitingOn).toEqual([still])
            expect(
                watcher.orderRow?.entries.find(({ playerId }) => playerId === table.seat)
            ).toMatchObject({
                done: true
            })
        })

        it("a hotseat serves each seat's panel in turn, each its own draft, never the last seat's", async () => {
            const table = hold(await together())
            const screen = await table.host.openHotseat()
            const [first, second] = table.host.state.activePlayerIds
            expect(screen.myPlayerId).toBe(first)
            await press(screen, row(screen.nourishPanel?.pawns[0].choices, 'Unfed'))
            expect(feeding(screen)).toEqual(['unfed', 'wine', 'food'])

            await sendAndSettle(screen)

            expect(screen.myPlayerId).toBe(second)
            expect(screen.nourishPanel).toBeDefined()
            expect(screen.nourish.hasManual).toBe(false)
            expect(screen.nourish.value('feeding')).toEqual(
                nourishOffer(screen.gameState, second)?.preselected
            )
        })

        it("R-4.4-H1 this seat's own at-will play starts its draft afresh, as another seat's send does not", async () => {
            const table = hold(
                await atNourishingTogether((state, { seat, other }) => {
                    for (const playerId of [seat, other]) {
                        threePawns(state, playerId)
                        holdFood(state, playerId, 1)
                        fillBarrel(state, playerId, 1)
                    }
                    giveTile(state, seat)
                })
            )
            const { session } = table
            await press(session, row(session.nourishPanel?.pawns[0].choices, 'Unfed'))
            expect(session.nourish.hasManual).toBe(true)
            const [tileId] = session.gameState.getPlayerState(table.seat).regionTiles

            await table.host.send(table.seat, {
                type: ActionType.SpendRegionTile,
                tileId,
                good: 'food'
            })
            await settled(session)

            expect(session.nourishPanel).toBeDefined()
            expect(session.nourish.hasManual).toBe(false)
            expect(feeding(session)).toEqual(['food', 'food', 'wine'])
        })

        it("R-4.3.3 another seat's tile takes the haversack's last sulfur: this seat's tile offer says so; a good it can't bring isn't drawn", async () => {
            const table = hold(
                await atNourishingTogether((state, { seat, other, host }) => {
                    const watcher = host.order.find((id) => id !== seat && id !== other) ?? ''
                    for (const playerId of [seat, other]) {
                        addPawn(state, playerId, 'farmer', emptySpace(state, 'town'))
                        holdFood(state, playerId, 0)
                        giveTile(state, playerId)
                    }
                    const watching = state.getPlayerState(watcher)
                    watching.goods.food += state.supply.haversack.food
                    state.supply.haversack.food = 0
                    watching.goods.sulfur += state.supply.haversack.sulfur - 1
                    state.supply.haversack.sulfur = 1
                    state.recomputeRanks()
                })
            )
            const { session } = table
            const other = await table.host.openSeat(table.other)
            await settled(other)
            const wine = (seat: FeudumGameSession) =>
                seat.nourishPanel?.covers?.find(({ label }) => label.endsWith('wine'))
            const food = (seat: FeudumGameSession) =>
                seat.nourishPanel?.covers?.find(({ label }) => label.endsWith('food'))
            expect(food(session)).toBeUndefined()
            expect(wine(session)?.refusal).toBeUndefined()
            await press(session, wine(session))
            expect(session.nourishPanel?.primary.enabled).toBe(true)

            await press(other, wine(other))
            await sendAndSettle(other)
            await settled(session)

            expect(wine(session)).toMatchObject({ picked: true, shown: 'for wine · none left' })
            expect(wine(session)?.press).toBeDefined()
            expect(session.nourishPanel?.primary.enabled).toBe(false)
            await press(session, wine(session))
            expect(session.nourishPanel?.covers).toBeUndefined()
            expect(session.nourishPanel?.primary.enabled).toBe(true)
        })
    })

    describe('the five minimum tests', () => {
        const withTile = () =>
            atNourishing((state, { seat }) => {
                threePawns(state, seat)
                holdFood(state, seat, 1)
                giveTile(state, seat)
            })

        it('1, 7 a tile press replaces the feeding with a new preselection', async () => {
            const { session } = hold(await withTile())
            await press(session, row(session.nourishPanel?.pawns[1].choices, 'Food'))
            expect(feeding(session)).toEqual(['unfed', 'food', 'unfed'])
            await press(
                session,
                session.nourishPanel?.covers?.find(({ label }) => label.endsWith('food'))
            )
            expect(feeding(session)).toEqual(['food', 'food', 'unfed'])
            expect(session.nourish.entry('feeding')?.source).toBe('auto')
        })

        it('2, 6 Undo pops the latest press and undoes no action', async () => {
            const table = hold(await scarce())
            const { session } = table
            const count = table.host.actions.length
            await press(session, row(session.nourishPanel?.pawns[0].choices, 'Unfed'))
            await press(session, row(session.nourishPanel?.pawns[1].choices, 'Food'))
            await session.undo()
            expect(feeding(session)).toEqual(['unfed', 'wine', 'food'])
            expect(table.host.actions).toHaveLength(count)
        })

        it('3 back at the preselection, nothing is manual: Undo never returns to it', async () => {
            const { session } = hold(await scarce())
            await press(session, row(session.nourishPanel?.pawns[0].choices, 'Unfed'))
            expect(session.nourish.hasManual).toBe(true)
            await session.undo()
            expect(session.nourish.hasManual).toBe(false)
            expect(session.nourish.entry('feeding')?.source).toBe('auto')
            expect(feeding(session)).toEqual(['food', 'wine', 'unfed'])
            expect(session.nourish.localSelection.undo()).toBe(false)
        })

        it('4 a stage out of the order throws', () => {
            const draft = new StagedDraft<NourishValues>(
                NourishStageOrder.filter((stage) => stage !== 'feeding')
            )
            expect(() => {
                draft.set('feeding', { wineFed: [], unfed: [] })
            }).toThrow(OutOfOrder)
        })

        it("5 a press on the pawn's own feed changes nothing", async () => {
            const { session } = hold(await scarce())
            await press(session, row(session.nourishPanel?.pawns[0].choices, 'Food'))
            expect(feeding(session)).toEqual(['food', 'wine', 'unfed'])
            expect(session.nourish.hasManual).toBe(false)
        })
    })
})

describe('R-4.3.4 Collect landscapes', () => {
    it("S55 the serf's landscapes light; collect one, leave one", async () => {
        const table = hold(await atCollecting())
        const { session, spaces } = table
        expect(session.gameState.machineState).toBe(MachineState.CollectingLandscapes)
        const panel = session.landscapesPanel
        expect(panel?.spaces).toHaveLength(2)
        expect(panel?.spaces[0].label).toMatch(/^collect \d+ · 1 to the ruler$/)
        expect(panel?.primary).toEqual({ label: 'Leave all', enabled: true })
        expect(roleOf(session.boardOffer, spaceTarget(spaces[0]))).toBe('lit')
        await session.pressTurnTarget(spaceTarget(spaces[0]))
        flushSync()
        expect(roleOf(session.boardOffer, spaceTarget(spaces[0]))).toBe('picked')
        expect(session.landscapesPanel?.primary.label).toBe('Collect 1')
        await press(session, session.landscapesPanel?.spaces[1])
        expect(session.landscapesPanel?.primary.label).toBe('Collect 2')
        await press(session, session.landscapesPanel?.spaces[1])
        await sendAndSettle(session)
        expect(lastAction(table)).toMatchObject({
            type: ActionType.CollectLandscapes,
            spaceIds: [spaces[0]]
        })
        expect(session.landscapesPanel).toBeUndefined()
    })

    it('S55 others see the order row; History View no panel', async () => {
        const table = hold(await atCollecting())
        const other = await table.host.openSeat(table.other)
        await settled(other)
        expect(other.landscapesPanel).toBeUndefined()
        expect(other.orderRow?.entries.find(({ next }) => next)?.playerId).toBe(table.seat)
        expect(roleOf(other.boardOffer, spaceTarget(table.spaces[0]))).toBe('plain')
        await table.session.history.goToPreviousAction()
        await settled(table.session)
        expect(table.session.landscapesPanel).toBeUndefined()
    })

    describe('the five minimum tests', () => {
        it('1, 7 a further space clears the barrel count', async () => {
            const { session } = hold(await atCollecting())
            await press(session, session.landscapesPanel?.spaces[0])
            session.landscapes.set('barrel', 1)
            await press(session, session.landscapesPanel?.spaces[1])
            expect(session.landscapes.value('barrel')).toBeUndefined()
        })

        it('2, 6 Undo pops the latest pick, keeps the earlier, and undoes no action', async () => {
            const table = hold(await atCollecting())
            const { session, spaces } = table
            const count = table.host.actions.length
            await press(session, session.landscapesPanel?.spaces[0])
            await press(session, session.landscapesPanel?.spaces[1])
            await session.undo()
            expect(session.landscapes.value('spaces')).toEqual([spaces[0]])
            expect(table.host.actions).toHaveLength(count)
        })

        it('3 with no manual stage, Undo reaches the action', async () => {
            const { session } = hold(await atCollecting())
            expect(session.landscapes.hasManual).toBe(false)
            expect(session.landscapes.localSelection.undo()).toBe(false)
        })

        it('4 a stage out of the order throws', () => {
            const draft = new StagedDraft<LandscapesValues>(
                LandscapesStageOrder.filter((stage) => stage !== 'spaces')
            )
            expect(() => {
                draft.set('spaces', [])
            }).toThrow(OutOfOrder)
        })

        it('5 pressing a pick again unpicks it', async () => {
            const { session } = hold(await atCollecting())
            await press(session, session.landscapesPanel?.spaces[0])
            await press(session, session.landscapesPanel?.spaces[0])
            expect(session.landscapes.value('spaces')).toEqual([])
            expect(session.landscapesPanel?.primary.label).toBe('Leave all')
        })
    })
})

import { flushSync } from 'svelte'
import { ActionSource, assertExists, type GameAction } from '@tabletop/common'
import {
    ActionType,
    MachineState,
    placeMarker,
    playMandateOffers,
    type HydratedFeudumGameState
} from '@tabletop/feudum'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    atNourishing,
    fillBarrel,
    holdFood,
    holdWrit,
    sealMarker,
    seatedAtCards,
    threePawns,
    type SeatTable
} from '$lib/testing/followUpTable.js'
import { linesOf, pressCard, rowLabels, rowNamed } from '$lib/testing/actionPanelView.js'
import { FeudumHost, settled } from '$lib/testing/sessionHarness.js'
import {
    atPlayingCards,
    emptySpace,
    giveSeal,
    giveTile,
    returnGoods
} from '$lib/testing/turnTable.js'
import { AtWillStageOrder, type AtWillList, type AtWillValues } from './atWillDraft.svelte.js'
import { pawnTarget, roleOf } from './boardOffer.js'
import type { ActionBlock } from './actionPanel.js'
import type { DraftChoice } from './deciderDraft.svelte.js'
import type { FeudumGameSession } from './session.svelte.js'
import { StagedDraft } from './stagedDraft.svelte.js'

let host: FeudumHost | undefined

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
    host?.close()
    host = undefined
    vi.restoreAllMocks()
})

type Arrange = (state: HydratedFeudumGameState, seat: string) => void

async function atWill(arrange: Arrange): Promise<SeatTable> {
    const table = await seatedAtCards(['tax', 'move', 'guild'], (state, { seat }) => {
        returnGoods(state, seat)
        arrange(state, seat)
    })
    host = table.host
    expect(table.session.gameState.machineState).toBe(MachineState.PlayingCards)
    return table
}

/** The seat's press; what the machine plays after it (a turn passing, a dawn) doesn't count. */
function lastAction(table: SeatTable): GameAction | undefined {
    return table.host.actions.findLast(({ source }) => source === ActionSource.User)
}

async function press(session: FeudumGameSession, choice: DraftChoice | undefined) {
    assertExists(choice, 'The panel has this row')
    await session.pressDraftChoice(choice)
    flushSync()
}

async function open(session: FeudumGameSession, list: AtWillList) {
    await press(
        session,
        session.atWillPanel?.chips.find((chip) => chip.list === list)
    )
}

function blocksOf<K extends ActionBlock['kind']>(
    view: FeudumGameSession['actionPanel'],
    kind: K
): Extract<ActionBlock, { kind: K }>[] {
    return view.blocks.filter(
        (block): block is Extract<ActionBlock, { kind: K }> => block.kind === kind
    )
}

function chipLabels(session: FeudumGameSession): readonly string[] {
    return session.atWillPanel?.chips.map(({ label }) => label) ?? []
}

function writChoices(session: FeudumGameSession, writId: string): readonly DraftChoice[] {
    return session.atWillPanel?.writs?.find((writ) => writ.writId === writId)?.choices ?? []
}

const Mandate5 = 'writ.mandate.5'
const Charter = 'writ.charter.monster-defeat'

describe('R-4.4-H1 The at-will row', () => {
    it('S50 chips show only where something can be done', async () => {
        const nothing = await atWill(() => undefined)
        expect(nothing.session.atWillPanel).toBeUndefined()
        nothing.host.close()

        const { session } = await atWill((state, seat) => {
            holdFood(state, seat, 1)
            holdWrit(state, seat, Mandate5)
        })
        expect(chipLabels(session)).toEqual(['Writs 1'])
    })

    it('S50 Writs opens: mandate 5 shows "A: 1 food → 3s"; the press sends', async () => {
        const table = await atWill((state, seat) => {
            holdFood(state, seat, 1)
            holdWrit(state, seat, Mandate5)
        })
        const { session, seat } = table
        expect(session.atWillPanel?.writs).toBeUndefined()
        await open(session, 'writs')
        const choices = writChoices(session, Mandate5)
        expect(choices.map(({ label }) => label)).toContain('A: 1 food → 3s')
        const short = choices.find(({ label }) => label.startsWith('B:'))
        expect(short?.refusal).toBeDefined()
        expect(short?.press).toBeUndefined()
        await press(session, choices[0])
        await settled(session)
        expect(lastAction(table)).toMatchObject({
            type: ActionType.PlayMandate,
            writId: Mandate5,
            alternative: 0
        })
        expect(session.gameState.getPlayerState(seat).writCount).toBe(0)
        expect(session.atWill.selection).toEqual({})
    })

    it('S50 picking a card hides the row and closes a list; Undo back shows the row, closed', async () => {
        const { session } = await atWill((state, seat) => {
            holdFood(state, seat, 1)
            holdWrit(state, seat, Mandate5)
        })
        await open(session, 'writs')
        expect(session.atWill.value('list')).toBe('writs')
        session.pressTurnCard('tax')
        flushSync()
        expect(session.turn.card).toBe('tax')
        expect(session.atWillPanel).toBeUndefined()
        await session.undo()
        flushSync()
        expect(session.turn.card).toBeUndefined()
        expect(chipLabels(session)).toEqual(['Writs 1'])
        expect(session.atWill.value('list')).toBeUndefined()
    })

    it('S50 a lone card is not an auto stage while the row has something to do, or it would hide it', async () => {
        const table = await seatedAtCards(['tax'], (state, { seat }) => {
            holdFood(state, seat, 1)
            holdWrit(state, seat, Mandate5)
        })
        host = table.host
        expect(table.session.turn.card).toBeUndefined()
        expect(chipLabels(table.session)).toEqual(['Writs 1'])
    })

    it('R-4.4-H5 a writ that can only be discarded keeps a lone card a press too', async () => {
        const table = await seatedAtCards(['tax'], (state, { seat }) => {
            holdWrit(state, seat, Charter)
        })
        host = table.host
        expect(table.session.turn.card).toBeUndefined()
        expect(chipLabels(table.session)).toEqual(['Writs 1'])
    })

    it('Undo closes the list, and undoes no action', async () => {
        const table = await atWill((state, seat) => {
            holdFood(state, seat, 1)
            holdWrit(state, seat, Mandate5)
        })
        const { session } = table
        const count = table.host.actions.length
        await open(session, 'writs')
        await session.undo()
        expect(session.atWillPanel?.writs).toBeUndefined()
        expect(chipLabels(session)).toEqual(['Writs 1'])
        expect(table.host.actions).toHaveLength(count)
    })

    it('R-X.1 another seat has no row, and History View none', async () => {
        const table = await atWill((state, seat) => {
            holdFood(state, seat, 1)
            holdWrit(state, seat, Mandate5)
        })
        const other = await table.host.openSeat(table.other)
        await settled(other)
        expect(other.atWillPanel).toBeUndefined()
        const { session } = table
        await open(session, 'writs')
        await press(session, writChoices(session, Mandate5)[0])
        await settled(session)
        await session.history.goToPreviousAction()
        await settled(session)
        expect(session.atWillPanel).toBeUndefined()
        expect(session.boardOffer.dimsRest).toBe(false)
    })
})

describe('R-4.4.2 PlayMandate', () => {
    it('R-X.2 a mandate that draws goods stages with "can\'t be undone" and waits for the primary', async () => {
        const table = await atWill((state, seat) => {
            holdWrit(state, seat, 'writ.mandate.6')
            threePawns(state, seat)
            for (const pawn of state.getPlayerState(seat).pawns) {
                pawn.character = 'farmer'
            }
            state.recomputeRanks()
        })
        const { session, seat } = table
        const offers = playMandateOffers(session.gameState, seat)
        const revealing = offers.find((offer) => offer.revealsInfo && !offer.refused)
        assertExists(revealing, 'R-4.4-H4 Three goods from the supply show what they are')
        await open(session, 'writs')
        const count = table.host.actions.length
        await press(session, writChoices(session, revealing.writId)[revealing.alternative])
        expect(table.host.actions).toHaveLength(count)
        expect(session.atWillPanel?.primary?.label).toMatch(/can't be undone$/)
        await session.sendFollowUp()
        await settled(session)
        expect(lastAction(table)).toMatchObject({
            type: ActionType.PlayMandate,
            writId: revealing.writId,
            alternative: revealing.alternative,
            revealsInfo: true
        })
    })

    it('R-4.4-H4 mandate 6 asks which vessel the Alchemist reward takes, and sends the one pressed', async () => {
        const table = await atWill((state, seat) => {
            holdWrit(state, seat, 'writ.mandate.6')
            threePawns(state, seat)
            for (const pawn of state.getPlayerState(seat).pawns) {
                pawn.character = 'alchemist'
            }
            state.recomputeRanks()
            state.getPlayerState(seat).vessels['flying-machine'] +=
                state.supply.vessels['flying-machine']
            state.supply.vessels['flying-machine'] = 0
        })
        const { session } = table
        await open(session, 'writs')
        const choices = writChoices(session, 'writ.mandate.6')
        expect(choices.map(({ label, refusal }) => [label, refusal])).toEqual([
            ['Farmer → 3 goods', 'You need 3 status stars in that guild.'],
            ['Merchant → 3s', 'You need 3 status stars in that guild.'],
            ['Alchemist → ship', undefined],
            ['Alchemist → submersible', undefined],
            ['Alchemist → flying machine', 'The general supply has no flying machine.'],
            ['Discard', undefined]
        ])
        await press(session, choices[3])
        await settled(session)
        expect(lastAction(table)).toMatchObject({
            type: ActionType.PlayMandate,
            writId: 'writ.mandate.6',
            rewardGuild: 'alchemist',
            vessel: 'submersible'
        })
    })

    it('R-4.4-H1 short of the good: the press asks for a tile, and the tile press sends', async () => {
        const table = await atWill((state, seat) => {
            holdWrit(state, seat, Mandate5)
            giveTile(state, seat)
            giveTile(state, seat)
        })
        const { session } = table
        await open(session, 'writs')
        await press(session, writChoices(session, Mandate5)[0])
        expect(lastAction(table)?.type).not.toBe(ActionType.PlayMandate)
        const covers = session.atWillPanel?.covers
        expect(covers).toHaveLength(2)
        await press(session, covers?.[0])
        await settled(session)
        expect(lastAction(table)).toMatchObject({
            type: ActionType.PlayMandate,
            wildTiles: [{ good: 'food' }]
        })
    })

    it('R-4.4-H1 short with one tile: the tile is auto, so the primary sends', async () => {
        const table = await atWill((state, seat) => {
            holdWrit(state, seat, Mandate5)
            giveTile(state, seat)
        })
        const { session } = table
        await open(session, 'writs')
        await press(session, writChoices(session, Mandate5)[0])
        expect(session.atWill.entry('cover')?.source).toBe('auto')
        expect(lastAction(table)?.type).not.toBe(ActionType.PlayMandate)
        expect(session.atWillPanel?.primary?.enabled).toBe(true)
    })
})

describe('R-4.4.3 no seal during play, and R-4.4.4 DiscardWrit', () => {
    it('S51 R-4.4.3 a charter held with a seal offers only "Discard": it is sealed at game end', async () => {
        const { session } = await atWill((state, seat) => {
            holdWrit(state, seat, Charter)
            giveSeal(state, seat)
        })
        await open(session, 'writs')
        expect(writChoices(session, Charter).map(({ label }) => label)).toEqual(['Discard'])
    })

    it('R-4.4.4 "Discard" sends', async () => {
        const table = await atWill((state, seat) => {
            holdWrit(state, seat, Mandate5)
        })
        const { session } = table
        await open(session, 'writs')
        const discard = writChoices(session, Mandate5).find(({ label }) => label === 'Discard')
        await press(session, discard)
        await settled(session)
        expect(lastAction(table)).toMatchObject({
            type: ActionType.DiscardWrit,
            writId: Mandate5,
            outOfTurn: true,
            sequenced: true
        })
    })
})

describe('R-4.4-H5 a writ discarded at any time', () => {
    it('R-4.4-H5 a seat off its turn holding a writ has the row under the waiting line; "Discard" sends', async () => {
        const table = await seatedAtCards(['tax', 'move', 'guild'], (state, { other }) => {
            holdWrit(state, other, Mandate5)
        })
        host = table.host
        const other = await table.host.openSeat(table.other)
        await settled(other)
        expect(linesOf(other.actionPanel, 'waiting')).toHaveLength(1)
        expect(rowLabels(other.actionPanel, 'at-will')).toEqual(['Writs 1'])
        expect(chipLabels(other)).toEqual(['Writs 1'])
        await open(other, 'writs')
        const choices = writChoices(other, Mandate5)
        expect(choices.filter(({ press }) => press).map(({ label }) => label)).toEqual(['Discard'])
        await press(
            other,
            choices.find(({ label }) => label === 'Discard')
        )
        await settled(other)
        expect(lastAction(table)).toMatchObject({
            type: ActionType.DiscardWrit,
            playerId: table.other,
            writId: Mandate5,
            outOfTurn: true,
            sequenced: true
        })
        expect(other.gameState.getPlayerState(table.other).writs).toEqual([])
        expect(other.gameState.flow.turn?.playerId).toBe(table.seat)
    })

    it('R-3.1, R-4.4-H5 a seat that has finalised its hand keeps the row under the waiting line', async () => {
        const table = new FeudumHost(3)
        host = table
        await table.playStartingGoods()
        await table.playStartingPawns()
        const [first, second] = table.order
        table.edit((state) => holdWrit(state, first, Mandate5))
        await table.send(first, {
            type: ActionType.FinaliseHand,
            revealsInfo: true,
            cards: ['move', 'tax', 'guild', 'explore']
        })
        const session = await table.openSeat(first)
        await settled(session)
        expect(session.gameState.machineState).toBe(MachineState.SelectingHands)
        expect(linesOf(session.actionPanel, 'waiting')).toEqual([
            `Waiting for ${session.getPlayerName(second)} to finalise`
        ])
        expect(rowLabels(session.actionPanel, 'at-will')).toEqual(['Writs 1'])
        expect(chipLabels(session)).toEqual(['Writs 1'])
    })

    it('R-4.4-H5 a seat over the limit is asked alone: another seat holding a writ keeps its row', async () => {
        const table = await seatedAtCards(['tax', 'move'], (state, { seat, other }) => {
            holdFood(state, seat, 1)
            for (const writId of [
                'writ.mandate.2',
                'writ.mandate.4',
                'writ.mandate.7',
                'writ.mandate.8'
            ] as const) {
                holdWrit(state, seat, writId)
            }
            holdWrit(state, other, Mandate5)
        })
        host = table.host
        const { session } = table
        await pressCard(session.actionPanel, 'tax')
        await session.forfeitTurnCard()
        await settled(session)
        expect(session.gameState.machineState).toBe(MachineState.DiscardingWrits)
        const other = await table.host.openSeat(table.other)
        await settled(other)
        expect(other.writLimitPanel).toBeUndefined()
        expect(chipLabels(other)).toEqual(['Writs 1'])
        expect(session.writLimitPanel?.writs).toHaveLength(4)
    })

    it('R-4.4-H5 a hotseat gives each other seat holding a writ a chip; its "Discard" sends as that seat', async () => {
        const table = await seatedAtCards(['tax', 'move', 'guild'], (state, { other }) => {
            holdWrit(state, other, Mandate5)
        })
        host = table.host
        expect(rowLabels(table.session.actionPanel, 'off-turn-writs')).toEqual([])
        const screen = await table.host.openHotseat()
        expect(screen.myPlayerId).toBe(table.seat)
        expect(rowLabels(screen.actionPanel, 'off-turn-writs')).toEqual([
            `${screen.getPlayerName(table.other)}'s writs`
        ])
        expect(blocksOf(screen.actionPanel, 'writ-offers')).toEqual([])
        await rowNamed(screen.actionPanel, /'s writs$/).press()
        flushSync()
        const [offers] = blocksOf(screen.actionPanel, 'writ-offers')
        expect(offers?.offers.map(({ writId }) => writId)).toEqual([Mandate5])
        await offers?.offers[0].rows[0].press()
        await settled(screen)
        expect(screen.actions.findLast(({ source }) => source === ActionSource.User)).toMatchObject(
            {
                type: ActionType.DiscardWrit,
                playerId: table.other,
                writId: Mandate5,
                outOfTurn: true,
                sequenced: true
            }
        )
        expect(screen.gameState.getPlayerState(table.other).writs).toEqual([])
        expect(screen.gameState.flow.turn?.playerId).toBe(table.seat)
        expect(rowLabels(screen.actionPanel, 'off-turn-writs')).toEqual([])
    })
})

describe('R-4.3.3 SpendRegionTile', () => {
    const twoTiles: Arrange = (state, seat) => {
        giveTile(state, seat)
        giveTile(state, seat)
    }

    it('"Spend" opens the goods with the haversack\'s counts; a good press sends', async () => {
        const table = await atWill(twoTiles)
        const { session } = table
        expect(chipLabels(session)).toEqual(['Tiles 2'])
        await open(session, 'tiles')
        const tiles = session.atWillPanel?.tiles
        expect(tiles?.[0].label).toBe('Spend')
        await press(session, tiles?.[0])
        const goods = session.atWillPanel?.goods
        const haversack = session.gameState.supply.haversack
        expect(goods?.map(({ label }) => label)).toContain(`food ${haversack.food}`)
        expect(goods?.map(({ label }) => label)).toContain('Into the barrel')
        await press(
            session,
            goods?.find(({ label }) => label.startsWith('food'))
        )
        await settled(session)
        expect(lastAction(table)).toMatchObject({
            type: ActionType.SpendRegionTile,
            good: 'food'
        })
    })

    it('R-4.10.2 "Into the barrel" sends the sulfur there', async () => {
        const table = await atWill(twoTiles)
        const { session } = table
        await open(session, 'tiles')
        await press(session, session.atWillPanel?.tiles?.[1])
        await press(
            session,
            session.atWillPanel?.goods?.find(({ label }) => label === 'Into the barrel')
        )
        await settled(session)
        expect(lastAction(table)).toMatchObject({
            type: ActionType.SpendRegionTile,
            good: 'sulfur',
            sulfurToBarrel: true
        })
    })

    it('R-4.10-H1 a full barrel offers no "Into the barrel"', async () => {
        const { session } = await atWill((state, seat) => {
            twoTiles(state, seat)
            fillBarrel(state, seat, 3)
        })
        await open(session, 'tiles')
        await press(session, session.atWillPanel?.tiles?.[0])
        expect(session.atWillPanel?.goods?.map(({ label }) => label)).not.toContain(
            'Into the barrel'
        )
    })

    it('A lone tile is an auto stage: the goods show, and the primary sends', async () => {
        const table = await atWill((state, seat) => {
            giveTile(state, seat)
        })
        const { session } = table
        await open(session, 'tiles')
        expect(session.atWill.entry('tile')?.source).toBe('auto')
        const count = table.host.actions.length
        await press(
            session,
            session.atWillPanel?.goods?.find(({ label }) => label.startsWith('food'))
        )
        expect(table.host.actions).toHaveLength(count)
        await session.undo()
        expect(session.atWill.value('good')).toBeUndefined()
        expect(session.atWill.entry('tile')?.source).toBe('auto')
        await session.undo()
        expect(session.atWillPanel?.goods).toBeUndefined()
    })
})

describe('R-4.2.2 PlaceVessel', () => {
    const vessels: Arrange = (state, seat) => {
        const player = state.getPlayerState(seat)
        state.supply.vessels.ship -= 1
        state.supply.vessels['flying-machine'] -= 1
        player.vessels.ship = 1
        player.vessels['flying-machine'] = 1
    }

    it('A vessel press lights the pawns on no vessel; a pawn press sends', async () => {
        const table = await atWill(vessels)
        const { session, seat } = table
        expect(chipLabels(session)).toContain('Vessels 2')
        await open(session, 'vessels')
        await press(session, session.atWillPanel?.vessels?.[0])
        const pawn = session.gameState.getPlayerState(seat).pawns.find((row) => row.spaceId)
        assertExists(pawn, 'A pawn stands on the board')
        const target = pawnTarget(seat, pawn.n)
        expect(roleOf(session.boardOffer, target)).toBe('lit')
        await session.pressTurnTarget(target)
        await settled(session)
        expect(lastAction(table)).toMatchObject({ type: ActionType.PlaceVessel, pawn: pawn.n })
    })

    it("R-4.2.2 the row has no Vessels chip outside the seat's own turn", async () => {
        const table = await atNourishing((state, { seat }) => {
            vessels(state, seat)
            holdFood(state, seat, 0)
            giveTile(state, seat)
        })
        host = table.host
        expect(chipLabels(table.session).join()).not.toContain('Vessels')
    })
})

describe('R-3.14.2 ReclaimImmunitySeal', () => {
    it('S39 the Immunity chip lights the marker; a press sends', async () => {
        const table = await seatedAtCards(['tax', 'move'], (state, { seat, other }) => {
            const space = emptySpace(state, 'outpost')
            placeMarker(state, other, space)
            placeMarker(state, seat, space)
            sealMarker(state, space, 'serf')
            state.recomputeRanks()
        })
        host = table.host
        const { session, seat } = table
        expect(chipLabels(session).join()).toContain('Immunity 1')
        await open(session, 'immunity')
        expect(session.atWillPanel?.line).toBe(
            'Take back the seal: the marker can be starved again'
        )
        const target = session.atWill.pick?.targets[0]?.target
        assertExists(target, 'The marker lights')
        expect(target).toContain(seat)
        expect(roleOf(session.boardOffer, target)).toBe('lit')
        await session.pressTurnTarget(target)
        await settled(session)
        expect(lastAction(table)).toMatchObject({ type: ActionType.ReclaimImmunitySeal })
    })
})

describe('R-4.4-H1 The other windows', () => {
    it('R-3.1 the next finaliser has the row, and its hand draft outlives its own at-will Action', async () => {
        const turn = await atPlayingCards(['tax', 'move'])
        host = turn.host
        turn.host.edit((state) => {
            state.machineState = MachineState.SelectingHands
            state.flow.turn = undefined
            state.flow.selection = { playerId: turn.seat, finalised: [] }
            state.activePlayerIds = [...turn.host.order]
            for (const playerId of turn.host.order) {
                const player = state.getPlayerState(playerId)
                player.played = []
                player.pouch = undefined
            }
            holdWrit(state, turn.seat, Mandate5)
        })
        const session = await turn.host.openSeat(turn.seat)
        session.toggleHandCard('tax')
        flushSync()
        expect(session.handPanel?.drafting?.cards.find(({ kind }) => kind === 'tax')?.picked).toBe(
            true
        )
        await open(session, 'writs')
        expect(session.atWill.value('list')).toBe('writs')
        await session.undo()
        expect(session.atWill.value('list')).toBeUndefined()
        expect(session.handPanel?.drafting?.cards.find(({ kind }) => kind === 'tax')?.picked).toBe(
            true
        )
        await open(session, 'writs')
        await press(
            session,
            session.atWillPanel?.writs?.[0].choices.find(({ label }) => label === 'Discard')
        )
        await settled(session)
        expect(
            turn.host.actions.findLast(({ source }) => source === ActionSource.User)
        ).toMatchObject({ type: ActionType.DiscardWrit })
        expect(session.handPanel?.drafting?.cards.find(({ kind }) => kind === 'tax')?.picked).toBe(
            true
        )
    })

    it('R-4.10 a seat nourishing has the row; Undo closes the list before touching the feeding', async () => {
        const table = await atNourishing((state, { seat }) => {
            holdFood(state, seat, 0)
            giveTile(state, seat)
        })
        host = table.host
        const { session } = table
        await open(session, 'tiles')
        expect(session.nourishPanel).toBeDefined()
        await session.undo()
        expect(session.atWill.value('list')).toBeUndefined()
        expect(session.nourish.entry('feeding')?.source).toBe('auto')
    })
})

describe('The five minimum tests', () => {
    const tiles: Arrange = (state, seat) => {
        giveTile(state, seat)
        giveTile(state, seat)
        holdFood(state, seat, 1)
        holdWrit(state, seat, Mandate5)
    }

    it('1 a chip press clears everything under the list it replaces', async () => {
        const { session } = await atWill(tiles)
        await open(session, 'tiles')
        await press(session, session.atWillPanel?.tiles?.[0])
        expect(session.atWill.value('tile')).toBeDefined()
        await open(session, 'writs')
        expect(session.atWill.value('list')).toBe('writs')
        expect(session.atWill.value('tile')).toBeUndefined()
    })

    it('2 Undo pops the highest manual stage and undoes no action', async () => {
        const table = await atWill(tiles)
        const { session } = table
        const count = table.host.actions.length
        await open(session, 'tiles')
        await press(session, session.atWillPanel?.tiles?.[0])
        await session.undo()
        expect(session.atWill.value('tile')).toBeUndefined()
        expect(session.atWill.value('list')).toBe('tiles')
        expect(table.host.actions).toHaveLength(count)
    })

    it('3 with no manual stage, Undo goes on to the action', async () => {
        const table = await atWill(tiles)
        const { session } = table
        expect(session.atWill.hasManual).toBe(false)
        expect(session.atWill.localSelection.undo()).toBe(false)
        await open(session, 'tiles')
        await press(session, session.atWillPanel?.tiles?.[0])
        await press(
            session,
            session.atWillPanel?.goods?.find(({ label }) => label.startsWith('wood'))
        )
        await settled(session)
        expect(lastAction(table)?.type).toBe(ActionType.SpendRegionTile)
        expect(session.atWill.hasManual).toBe(false)
        await session.undo()
        await settled(session)
        expect(lastAction(table)?.type).not.toBe(ActionType.SpendRegionTile)
    })

    it('4 a stage out of the order throws', () => {
        const draft = new StagedDraft<AtWillValues>(
            AtWillStageOrder.filter((stage) => stage !== 'list')
        )
        expect(() => {
            draft.set('list', 'writs')
        }).toThrow(/does not exist in stage order/)
    })

    it('5 reselecting a tile keeps the list and clears the good; the open chip closes', async () => {
        const { session } = await atWill(tiles)
        await open(session, 'tiles')
        await press(session, session.atWillPanel?.tiles?.[0])
        await press(session, session.atWillPanel?.tiles?.[1])
        expect(session.atWill.value('list')).toBe('tiles')
        expect(session.atWillPanel?.tiles?.[1].picked).toBe(true)
        await open(session, 'tiles')
        expect(session.atWill.value('list')).toBeUndefined()
    })

    it("8 ended by the seat's own Action; kept for the hand alone", async () => {
        const { session } = await atWill(tiles)
        await open(session, 'writs')
        await press(session, writChoices(session, Mandate5)[0])
        await settled(session)
        expect(session.atWill.selection).toEqual({})
    })
})

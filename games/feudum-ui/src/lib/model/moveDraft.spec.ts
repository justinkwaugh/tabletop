import { flushSync } from 'svelte'
import { assertExists, type GameAction } from '@tabletop/common'
import {
    ActionType,
    Goods,
    placeMarker,
    returnGoodToHaversack,
    Routes,
    Spaces,
    type ActionCardKind,
    type Character,
    type Good,
    type HydratedFeudumGameState,
    type LandscapeKind,
    type MonsterId,
    type RouteStep,
    type SpaceId,
    type VesselType
} from '@tabletop/feudum'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FeudumHost, settled } from '$lib/testing/sessionHarness.js'
import { atPlayingCards, giveTile, ruleTown, type TurnTable } from '$lib/testing/turnTable.js'
import {
    chipOf,
    monsterTarget,
    pawnTarget,
    pilferTarget,
    roleOf,
    spaceTarget,
    stackTarget,
    type BoardTarget
} from './boardOffer.js'
import type { PanelChoice } from './cardFlows.js'
import { MoveStageOrder, wayChoices, type MoveDraftValues } from './moveDraft.svelte.js'
import type { FeudumGameSession } from './session.svelte.js'
import { StagedDraft } from './stagedDraft.svelte.js'

let host: FeudumHost | undefined

/** R-1.4 The goods setup dealt go back, so a spec's pilfers are only those it arranges. */
function clearGoods(state: HydratedFeudumGameState) {
    for (const { id } of Spaces) {
        const { goods } = state.spaces[id]
        for (const good of Goods) {
            returnGoodToHaversack(state, good, goods[good])
            goods[good] = 0
        }
    }
}

async function table(
    cards: readonly ActionCardKind[],
    arrange?: (state: HydratedFeudumGameState, turn: TurnTable) => void,
    options: Parameters<typeof atPlayingCards>[1] = {}
): Promise<TurnTable & { session: FeudumGameSession }> {
    const turn = await atPlayingCards(cards, options)
    host = turn.host
    turn.host.edit((state) => {
        clearGoods(state)
        arrange?.(state, turn)
        state.recomputeRanks()
    })
    return { ...turn, session: await turn.host.openSeat(turn.seat) }
}

/** R-3.7.1 Exactly these pawns of the seat stand on the board, in pawn order. */
function stand(
    state: HydratedFeudumGameState,
    playerId: string,
    ...pawns: readonly (SpaceId | readonly [SpaceId, Character])[]
): void {
    state.getPlayerState(playerId).pawns.forEach((pawn, index) => {
        const entry = pawns.at(index)
        if (index >= pawns.length || !entry) {
            delete pawn.spaceId
            delete pawn.character
            return
        }
        pawn.spaceId = typeof entry === 'string' ? entry : entry[0]
        pawn.character = typeof entry === 'string' ? 'farmer' : entry[1]
    })
}

function standMonster(
    state: HydratedFeudumGameState,
    monster: MonsterId,
    playerId: string,
    spaceId: SpaceId
) {
    state.monsters[monster] = { playerId, spaceId }
}

/** R-1.1 A vessel from the general supply into the seat's supply. */
function giveVessel(state: HydratedFeudumGameState, playerId: string, vessel: VesselType) {
    state.supply.vessels[vessel] -= 1
    state.getPlayerState(playerId).vessels[vessel] += 1
}

/** R-1.1 A vessel from the general supply, abandoned on a space. */
function abandonVessel(state: HydratedFeudumGameState, spaceId: SpaceId, vessel: VesselType) {
    state.supply.vessels[vessel] -= 1
    state.spaces[spaceId].vessels[vessel] += 1
}

/** R-4.2.3 The Alchemist's vessels go back to the supply, so the ferries run. */
function sellOut(state: HydratedFeudumGameState) {
    for (const vessel of state.guilds.alchemist.vesselsForSale) {
        state.supply.vessels[vessel] += 1
    }
    state.guilds.alchemist.vesselsForSale = []
}

/** R-1.4.4 A good from the haversack lies on an outpost. */
function goodOnOutpost(state: HydratedFeudumGameState, spaceId: SpaceId, good: Good = 'iron') {
    state.spaces[spaceId].location.kind = 'outpost'
    state.supply.haversack[good] -= 1
    state.spaces[spaceId].goods[good] += 1
}

/** R-4.3.4 A tile of this landscape leaves its stack, shown, on the space, holding one. */
function landscapeOn(state: HydratedFeudumGameState, spaceId: SpaceId, kind: LandscapeKind) {
    const { tileLandscapes } = state.requireVault()
    const stack = Object.values(state.regionStacks).find((tiles) =>
        tiles.some((tile) => tileLandscapes[tile] === kind)
    )
    const tileId = stack?.find((tile) => tileLandscapes[tile] === kind)
    assertExists(stack, `R-1.4 A stack holds a ${kind}`)
    assertExists(tileId, `R-1.4 A stack holds a ${kind}`)
    stack.splice(stack.indexOf(tileId), 1)
    delete tileLandscapes[tileId]
    state.tileLandscapes[tileId] = kind
    state.spaces[spaceId].landscape = { tileId, amount: 1 }
    if (kind === 'archery-butt') {
        state.supply.targets -= 1
    }
}

function serfOn(state: HydratedFeudumGameState, spaceId: SpaceId, ruler: string, serf: string) {
    placeMarker(state, ruler, spaceId)
    placeMarker(state, serf, spaceId)
}

function pickCard(session: FeudumGameSession, kind: ActionCardKind) {
    session.pressTurnCard(kind)
    flushSync()
}

async function press(session: FeudumGameSession, target: BoardTarget) {
    await session.pressTurnTarget(target)
    flushSync()
}

function row(rows: readonly PanelChoice[] | undefined, label: string): PanelChoice {
    const found = rows?.find((choice) => choice.label === label)
    if (!found) {
        throw new Error(`No row ${label} in ${rows?.map((choice) => choice.label).join(' | ')}`)
    }
    return found
}

async function pressRow(session: FeudumGameSession, label: string) {
    await session.pressTurnChoice(row(session.movePanel?.rows, label))
    flushSync()
}

async function pressWay(session: FeudumGameSession, label: string) {
    await session.pressTurnChoice(row(session.movePanel?.popup?.choices, label))
    flushSync()
}

async function undo(session: FeudumGameSession) {
    await session.undo()
    await settled(session)
}

function chip(session: FeudumGameSession, target: BoardTarget) {
    return chipOf(session.boardOffer, target)
}

function role(session: FeudumGameSession, target: BoardTarget) {
    return roleOf(session.boardOffer, target)
}

function sentBy(turn: TurnTable, index = 0): GameAction | undefined {
    return turn.host.sent.get(turn.seat)?.[index]
}

function stepCount(session: FeudumGameSession): number {
    return session.move.value('steps')?.length ?? 0
}

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
    host?.close()
    host = undefined
    vi.restoreAllMocks()
})

const Inland: SpaceId = 'space.desert.3'
const RoadEnd: SpaceId = 'space.desert.1'
const ShipOnly: SpaceId = 'space.badlands.3'
const Elsewhere: SpaceId = 'space.forest.1'
const BehemothOn: SpaceId = 'space.mountain.1'

describe('S25 R-3.7.1 steps and their trail', () => {
    async function twoPawnsAndAMonster() {
        const turn = await table(['move', 'tax'], (state, { seat }) => {
            stand(state, seat, Inland, Elsewhere)
            standMonster(state, 'behemoth', seat, BehemothOn)
            giveVessel(state, seat, 'ship')
        })
        pickCard(turn.session, 'move')
        return { ...turn, pawn: pawnTarget(turn.seat, 1), other: pawnTarget(turn.seat, 2) }
    }

    it('a press pushes (piece, to, way); the piece stays picked; Undo takes the steps back', async () => {
        const { session, seat, pawn, other, host: tableHost } = await twoPawnsAndAMonster()
        const piece = { kind: 'pawn', playerId: seat, n: 1 }

        expect(session.movePanel?.line).toBe('Moves left: 3 of 3')
        expect(session.movePanel?.stage).toBe('steps')
        expect(role(session, pawn)).toBe('lit')
        expect(role(session, other)).toBe('lit')
        expect(role(session, monsterTarget('behemoth'))).toBe('lit')
        expect(role(session, spaceTarget(RoadEnd))).toBe('dimmed')

        await press(session, pawn)
        expect(role(session, pawn)).toBe('picked')
        expect(role(session, spaceTarget(RoadEnd))).toBe('lit')
        expect(chip(session, spaceTarget(RoadEnd))).toMatchObject({ label: 'road', tone: 'amber' })
        expect(session.boardOffer.trail).toEqual([])

        await press(session, spaceTarget(RoadEnd))
        expect(session.move.value('steps')).toEqual([{ piece, to: RoadEnd, medium: 'road' }])
        expect(session.movePanel?.line).toBe('Moves left: 2 of 3')
        expect(role(session, pawn)).toBe('picked')
        expect(session.boardOffer.trail).toEqual([
            { n: 1, piece, from: Inland, to: RoadEnd, medium: 'road' }
        ])
        // The next step lights from where it now stands.
        expect(role(session, spaceTarget(ShipOnly))).toBe('lit')
        expect(chip(session, spaceTarget(ShipOnly))?.label).toBe('place your ship')

        await press(session, spaceTarget(ShipOnly))
        expect(session.move.value('steps')).toEqual([
            { piece, to: RoadEnd, medium: 'road' },
            { piece, to: ShipOnly, medium: 'ship', vessel: 'place' }
        ])
        expect(session.boardOffer.trail?.[1]).toEqual({
            n: 2,
            piece,
            from: RoadEnd,
            to: ShipOnly,
            medium: 'ship'
        })
        expect(session.movePanel?.line).toBe('Moves left: 1 of 3')

        await undo(session)
        expect(session.move.value('steps')).toEqual([{ piece, to: RoadEnd, medium: 'road' }])
        expect(session.movePanel?.line).toBe('Moves left: 2 of 3')
        expect(role(session, pawn)).toBe('picked')

        await undo(session)
        expect(stepCount(session)).toBe(0)
        expect(session.movePanel?.line).toBe('Moves left: 3 of 3')
        expect(session.turn.card).toBe('move')
        expect(tableHost.sent.size).toBe(0)
    })

    it('another lit piece is picked instead; its Undo goes back to the one that stepped', async () => {
        const { session, seat, pawn, other } = await twoPawnsAndAMonster()
        await press(session, pawn)
        await press(session, spaceTarget(RoadEnd))
        await press(session, other)
        expect(role(session, other)).toBe('picked')
        expect(role(session, pawn)).toBe('lit')
        expect(role(session, spaceTarget(ShipOnly))).toBe('dimmed')

        await undo(session)
        expect(role(session, pawn)).toBe('picked')
        expect(stepCount(session)).toBe(1)

        await press(session, other)
        await press(session, spaceTarget('space.sea.1'))
        expect(session.move.value('steps')?.[1]).toMatchObject({
            piece: { kind: 'pawn', playerId: seat, n: 2 }
        })
        expect(role(session, other)).toBe('picked')
        // Its trail starts from its own space, not the last step's.
        expect(session.boardOffer.trail?.[1].from).toBe(Elsewhere)
    })

    it('a pick pressed again unpicks it, whichever way it was picked', async () => {
        const { session, pawn, other } = await twoPawnsAndAMonster()
        await press(session, pawn)
        await press(session, pawn)
        expect(role(session, pawn)).toBe('lit')
        expect(session.move.value('piece')).toBeUndefined()

        await press(session, pawn)
        await press(session, spaceTarget(RoadEnd))
        await press(session, pawn)
        expect(role(session, pawn)).toBe('lit')
        expect(role(session, spaceTarget(ShipOnly))).toBe('dimmed')
        await undo(session)
        expect(role(session, pawn)).toBe('picked')
        expect(stepCount(session)).toBe(1)

        // Another piece unpicked falls back to the one that stepped.
        await press(session, other)
        await press(session, other)
        expect(role(session, pawn)).toBe('picked')
    })

    it('R-3.7.1, R-4.2.4 a monster steps by its own media, and may go out and come back', async () => {
        const { session } = await twoPawnsAndAMonster()
        const behemoth = monsterTarget('behemoth')
        const piece = { kind: 'monster', monsterId: 'behemoth' }
        await press(session, behemoth)
        expect(role(session, behemoth)).toBe('picked')
        // R-4.2.4 It has a road and a flying route to one space: a popup, and no vessel.
        await press(session, spaceTarget('space.mountain.2'))
        expect(session.movePanel?.popup?.choices.map(({ label }) => label)).toEqual([
            'Road',
            'Flying machine'
        ])
        await pressWay(session, 'Flying machine')
        expect(session.move.value('steps')).toEqual([
            { piece, to: 'space.mountain.2', medium: 'flying-machine' }
        ])
        await press(session, spaceTarget(BehemothOn))
        await pressWay(session, 'Road')
        expect(session.move.value('steps')?.[1]).toEqual({
            piece,
            to: BehemothOn,
            medium: 'road'
        })
        expect(session.boardOffer.trail?.[1].from).toBe('space.mountain.2')
    })
})

describe('S26 R-4.2.3 ways to one space', () => {
    it('several ways open a popup beside the space; a press outside does nothing', async () => {
        const {
            session,
            seat,
            host: tableHost
        } = await table(['move', 'tax'], (state, turn) => {
            stand(state, turn.seat, 'space.mountain.1', Elsewhere)
            giveVessel(state, turn.seat, 'flying-machine')
        })
        pickCard(session, 'move')
        const to = spaceTarget('space.mountain.2')
        await press(session, pawnTarget(seat, 1))
        expect(session.move.value('piece')).toBeDefined()
        expect(session.movePanel?.popup).toBeUndefined()

        await press(session, to)
        expect(stepCount(session)).toBe(0)
        expect(session.movePanel?.popup?.anchor).toBe(to)
        expect(session.movePanel?.popup?.choices.map(({ label }) => label)).toEqual([
            'Road',
            'Place your flying machine'
        ])
        // A press outside does nothing and closes nothing; the panel's rows wait for it too.
        await press(session, spaceTarget('space.badlands.2'))
        await press(session, pawnTarget(seat, 1))
        expect(stepCount(session)).toBe(0)
        expect(session.movePanel?.popup?.anchor).toBe(to)
        expect(session.movePanel?.rows).toEqual([])
        expect(role(session, to)).toBe('lit')

        // Undo removes it, and takes nothing else.
        await undo(session)
        expect(session.movePanel?.popup).toBeUndefined()
        expect(session.move.value('piece')).toBeDefined()

        await press(session, to)
        await pressWay(session, 'Road')
        expect(session.movePanel?.popup).toBeUndefined()
        expect(session.move.value('steps')).toEqual([
            {
                piece: { kind: 'pawn', playerId: seat, n: 1 },
                to: 'space.mountain.2',
                medium: 'road'
            }
        ])
        expect(tableHost.sent.size).toBe(0)
    })

    it('a road and a ferry: the rows name each way, and the ferry is rose', () => {
        // The printed board joins no two spaces by both, so this reads the popup's rows directly.
        const road = Routes.find(({ medium }) => medium === 'road')
        const ferry = Routes.find(({ medium }) => medium === 'ferry')
        assertExists(road, 'R-1.2 A road is printed')
        assertExists(ferry, 'R-1.2 A ferry is printed')
        const ways: RouteStep[] = [
            { route: road, to: 'space.desert.5' },
            { route: ferry, to: 'space.desert.5', ferry: true }
        ]
        const taken: RouteStep[] = []
        const choices = wayChoices(ways, (way) => taken.push(way))
        expect(choices.map(({ label }) => label)).toEqual(['Road', 'Ferry · 2s'])
        expect(choices[0].note).toBeUndefined()
        expect(choices[1].note?.kind).toBe('cost')
        choices[1].press?.({ pick: () => undefined, stack: () => undefined })
        expect(taken).toEqual([ways[1]])
    })

    it('a ferry lights, in rose, only while no vessel is for sale', async () => {
        const by = 'space.desert.4'
        const ferryEnd = spaceTarget('space.desert.5')
        const open = await table(['move', 'tax'], (state, { seat }) => {
            stand(state, seat, by, Elsewhere)
            sellOut(state)
        })
        pickCard(open.session, 'move')
        await press(open.session, pawnTarget(open.seat, 1))
        expect(role(open.session, ferryEnd)).toBe('lit')
        expect(chip(open.session, ferryEnd)).toMatchObject({ label: 'ferry · 2s', tone: 'rose' })
        await press(open.session, ferryEnd)
        expect(open.session.move.value('steps')).toEqual([
            {
                piece: { kind: 'pawn', playerId: open.seat, n: 1 },
                to: 'space.desert.5',
                medium: 'ferry',
                ferry: true
            }
        ])
        host?.close()

        const closed = await table(['move', 'tax'], (state, { seat }) => {
            stand(state, seat, by, Elsewhere)
        })
        expect(closed.host.state.guilds.alchemist.vesselsForSale.length).toBeGreaterThan(0)
        pickCard(closed.session, 'move')
        await press(closed.session, pawnTarget(closed.seat, 1))
        expect(role(closed.session, spaceTarget('space.desert.3'))).toBe('lit')
        expect(role(closed.session, ferryEnd)).toBe('dimmed')
    })
})

describe('S27 R-4.2.2 vessels', () => {
    const Port: SpaceId = 'space.desert.1'

    async function atPort(arrange?: (state: HydratedFeudumGameState, seat: string) => void) {
        const turn = await table(['move', 'tax'], (state, { seat }) => {
            stand(state, seat, Port, Elsewhere)
            arrange?.(state, seat)
        })
        pickCard(turn.session, 'move')
        await press(turn.session, pawnTarget(turn.seat, 1))
        return turn
    }

    it('a ship in supply lights "place your ship"; none, and its neighbour stays dark', async () => {
        const none = await atPort()
        expect(role(none.session, spaceTarget(ShipOnly))).toBe('dimmed')
        host?.close()

        const { session } = await atPort((state, seat) => {
            giveVessel(state, seat, 'ship')
        })
        expect(chip(session, spaceTarget(ShipOnly))?.label).toBe('place your ship')
        expect(role(session, spaceTarget(ShipOnly))).toBe('lit')
    })

    it('an abandoned submersible adds "board the submersible"', async () => {
        const { session } = await atPort((state, seat) => {
            giveVessel(state, seat, 'ship')
            abandonVessel(state, Port, 'submersible')
        })
        expect(chip(session, spaceTarget('space.sea.3'))?.label).toBe('board the submersible')
        await press(session, spaceTarget('space.desert.2'))
        expect(session.movePanel?.popup?.choices.map(({ label }) => label)).toEqual([
            'Place your ship',
            'Board the submersible'
        ])
    })

    it('each choice is a step, and the send places or boards it', async () => {
        const placing = await atPort((state, seat) => {
            giveVessel(state, seat, 'ship')
            abandonVessel(state, Port, 'submersible')
        })
        await press(placing.session, spaceTarget('space.desert.2'))
        await pressWay(placing.session, 'Place your ship')
        await pressRow(placing.session, 'Stop moving')
        await placing.session.sendTurnCard()
        await settled(placing.session)
        const placed = placing.session.gameState.getPlayerState(placing.seat)
        expect(placed.pawns[0]).toMatchObject({ spaceId: 'space.desert.2', vessel: 'ship' })
        expect(placed.vessels.ship).toBe(0)
        host?.close()

        const boarding = await atPort((state, seat) => {
            giveVessel(state, seat, 'ship')
            abandonVessel(state, Port, 'submersible')
        })
        await press(boarding.session, spaceTarget('space.desert.2'))
        await pressWay(boarding.session, 'Board the submersible')
        await pressRow(boarding.session, 'Stop moving')
        await boarding.session.sendTurnCard()
        await settled(boarding.session)
        const boarded = boarding.session.gameState.getPlayerState(boarding.seat)
        expect(boarded.pawns[0]).toMatchObject({
            spaceId: 'space.desert.2',
            vessel: 'submersible'
        })
        expect(boarded.vessels.ship).toBe(1)
        expect(boarding.session.gameState.spaces[Port].vessels.submersible).toBe(0)
    })

    it('aboard, the same vessel carries on; the road steps off', async () => {
        const { session } = await atPort((state, seat) => {
            const [pawn] = state.getPlayerState(seat).pawns
            pawn.vessel = 'ship'
            state.supply.vessels.ship -= 1
        })
        expect(chip(session, spaceTarget(ShipOnly))?.label).toBe('ship')
        expect(chip(session, spaceTarget('space.desert.3'))?.label).toBe('road')
    })
})

describe('S28 R-4.2.4 pinned', () => {
    it('an opponent’s monster: the pawn is unlit, "pinned" in rose; the other pieces light', async () => {
        const { session, seat } = await table(['move', 'tax'], (state, turn) => {
            stand(state, turn.seat, Inland, Elsewhere, 'space.forest.3')
            standMonster(state, 'behemoth', turn.other, Inland)
        })
        pickCard(session, 'move')
        const pinned = pawnTarget(seat, 1)
        expect(session.movePanel?.stage).toBe('steps')
        expect(role(session, pawnTarget(seat, 2))).toBe('lit')
        expect(role(session, pawnTarget(seat, 3))).toBe('lit')
        expect(role(session, pinned)).toBe('dimmed')
        expect(chip(session, pinned)).toMatchObject({ label: 'pinned', tone: 'rose' })

        await press(session, pinned)
        expect(session.move.value('piece')).toBeUndefined()
        expect(role(session, pinned)).toBe('dimmed')
    })

    it('a monster of its own pins nothing', async () => {
        const { session, seat } = await table(['move', 'tax'], (state, turn) => {
            stand(state, turn.seat, Inland, Elsewhere)
            standMonster(state, 'behemoth', turn.seat, Inland)
        })
        pickCard(session, 'move')
        expect(role(session, pawnTarget(seat, 1))).toBe('lit')
        expect(chip(session, pawnTarget(seat, 1))).toBeUndefined()
    })

    it('a pawn stepping onto one is pinned there: it is no longer picked, the others light', async () => {
        const { session, seat } = await table(['move', 'tax'], (state, turn) => {
            stand(state, turn.seat, Inland, Elsewhere, 'space.forest.3')
            standMonster(state, 'behemoth', turn.other, RoadEnd)
        })
        pickCard(session, 'move')
        await press(session, pawnTarget(seat, 1))
        await press(session, spaceTarget(RoadEnd))
        expect(role(session, pawnTarget(seat, 1))).toBe('dimmed')
        expect(chip(session, pawnTarget(seat, 1))?.label).toBe('pinned')
        expect(role(session, pawnTarget(seat, 2))).toBe('lit')
        expect(role(session, spaceTarget(ShipOnly))).toBe('dimmed')
        expect(session.movePanel?.stage).toBe('steps')
    })

    it('one other piece left to move is picked for the seat, as any lone choice is', async () => {
        const { session, seat } = await table(['move', 'tax'], (state, turn) => {
            stand(state, turn.seat, Inland, Elsewhere)
            standMonster(state, 'behemoth', turn.other, Inland)
        })
        pickCard(session, 'move')
        expect(chip(session, pawnTarget(seat, 1))?.label).toBe('pinned')
        expect(session.move.entry('piece')?.source).toBe('auto')
        expect(role(session, pawnTarget(seat, 2))).toBe('picked')
        // Stop moving keeps the auto pick behind it, and is what Undo takes back.
        await pressRow(session, 'Stop moving')
        expect(session.move.value('stopped')).toBe(true)
        expect(session.movePanel?.stage).toBe('send')
        await undo(session)
        expect(session.move.value('stopped')).toBeUndefined()
        expect(session.turn.card).toBe('move')
    })
})

describe('S29 R-3.7.3, R-3.7.4 Godspeed and pilfer', () => {
    const Ruled: SpaceId = 'space.forest.3'
    const Pilfered: SpaceId = 'space.desert.3'

    it('the whole Move: Stop moving, a Godspeed step, a pilfer, the send, and its Undo', async () => {
        const turn = await table(['move', 'tax'], (state, { seat, other }) => {
            stand(state, seat, [Pilfered, 'monk'], 'space.desert.4', Elsewhere)
            state.spaces[Ruled].location.kind = 'farm'
            placeMarker(state, seat, Ruled)
            state.supply.haversack.iron -= 1
            state.spaces[Ruled].goods.iron += 1
            goodOnOutpost(state, Pilfered)
            landscapeOn(state, Pilfered, 'archery-butt')
            serfOn(state, Pilfered, seat, other)
        })
        const { session, seat } = turn
        const monk = pawnTarget(seat, 1)
        const ironBefore = session.gameState.getPlayerState(seat).goods.iron
        pickCard(session, 'move')
        await press(session, monk)
        await press(session, spaceTarget(RoadEnd))
        await press(session, pawnTarget(seat, 2))
        await press(session, spaceTarget(Ruled))
        expect(session.movePanel?.stage).toBe('steps')

        await pressRow(session, 'Stop moving')
        expect(session.movePanel?.stage).toBe('godspeed')
        expect(role(session, monk)).toBe('lit')
        expect(role(session, pawnTarget(seat, 2))).toBe('dimmed')
        expect(role(session, spaceTarget(Pilfered))).toBe('dimmed')
        expect(row(session.movePanel?.rows, 'No Godspeed').picked).toBe(false)

        await press(session, monk)
        expect(role(session, monk)).toBe('picked')
        expect(role(session, spaceTarget(Pilfered))).toBe('lit')
        expect(chip(session, spaceTarget(Pilfered))?.label).toBe('road')
        await press(session, spaceTarget(Pilfered))
        expect(session.move.value('godspeed')).toEqual({
            pawn: 1,
            to: Pilfered,
            medium: 'road'
        })
        expect(session.boardOffer.trail?.[2]).toEqual({
            n: 3,
            piece: { kind: 'pawn', playerId: seat, n: 1 },
            from: RoadEnd,
            to: Pilfered,
            medium: 'road',
            godspeed: true
        })
        expect(session.movePanel?.line).toBe('Moves left: 1 of 3')

        // The pilfer chips: the farm the seat rules shows none; the landscape shows its target.
        expect(session.movePanel?.stage).toBe('pilfer')
        const iron = pilferTarget(Pilfered, 'space', 'iron')
        expect(role(session, iron)).toBe('lit')
        expect(chip(session, iron)?.label).toBe('iron')
        expect(chip(session, pilferTarget(Pilfered, 'landscape', 'targets'))?.label).toBe('target')
        expect(session.boardOffer.targets.has(pilferTarget(Ruled, 'farm', 'iron'))).toBe(false)
        expect(session.movePanel?.primary).toBeUndefined()

        await press(session, iron)
        expect(role(session, iron)).toBe('picked')
        expect(session.movePanel?.primary).toEqual({
            label: 'Move · 3 steps · pilfer 1 iron',
            enabled: true
        })
        expect(turn.host.sent.size).toBe(0)

        await session.sendTurnCard()
        await settled(session)
        expect(sentBy(turn)).toMatchObject({
            type: ActionType.Move,
            godspeed: { pawn: 1, to: Pilfered, medium: 'road' },
            pilfer: { piece: { kind: 'pawn', n: 1 }, from: 'space', resource: 'iron' }
        })
        const after = session.gameState.getPlayerState(seat)
        expect(after.goods.iron).toBe(ironBefore + 1)
        expect(after.pawns[0].spaceId).toBe(Pilfered)
        expect(session.move.selection).toEqual({})

        expect(session.undoableAction).toBeDefined()
        await undo(session)
        const reversed = session.gameState.getPlayerState(seat)
        expect(reversed.goods.iron).toBe(ironBefore)
        expect(reversed.pawns[1].spaceId).toBe('space.desert.4')
        expect(reversed.played).toEqual([])
        expect(reversed.hand).toContain('move')
        expect(session.gameState.spaces[Pilfered].goods.iron).toBe(1)
    })

    it('"No Godspeed" goes on; Undo goes back to its stage, and a step still counts', async () => {
        const { session, seat } = await table(['move', 'tax'], (state, turn) => {
            stand(state, turn.seat, [RoadEnd, 'monk'], 'space.desert.4', Elsewhere)
        })
        pickCard(session, 'move')
        await press(session, pawnTarget(seat, 2))
        await press(session, spaceTarget('space.forest.3'))
        await pressRow(session, 'Stop moving')
        await pressRow(session, 'No Godspeed')
        expect(session.movePanel?.stage).toBe('send')
        expect(session.movePanel?.primary?.label).toBe('Move · 1 step')
        await undo(session)
        expect(session.movePanel?.stage).toBe('godspeed')

        await press(session, pawnTarget(seat, 1))
        await press(session, spaceTarget(Inland))
        expect(session.movePanel?.stage).toBe('send')
        expect(session.movePanel?.primary?.label).toBe('Move · 2 steps')
    })

    it('Godspeed moves one monk whether or not it moved before, by the ways of a step', async () => {
        const { session, seat } = await table(['move', 'tax'], (state, turn) => {
            stand(state, turn.seat, Inland, ['space.mountain.1', 'monk'])
            giveVessel(state, turn.seat, 'flying-machine')
        })
        pickCard(session, 'move')
        await pressRow(session, 'Stop moving')
        const monk = pawnTarget(seat, 2)
        expect(role(session, pawnTarget(seat, 1))).toBe('dimmed')
        await press(session, monk)
        await press(session, spaceTarget('space.mountain.2'))
        expect(session.movePanel?.popup?.anchor).toBe(spaceTarget('space.mountain.2'))
        await pressWay(session, 'Place your flying machine')
        expect(session.move.value('godspeed')).toEqual({
            pawn: 2,
            to: 'space.mountain.2',
            medium: 'flying-machine',
            vessel: 'place'
        })
        // Undo goes back a press at a time: the popup, then the monk's spaces.
        await undo(session)
        expect(session.move.value('godspeed')).toBeUndefined()
        expect(session.movePanel?.popup?.anchor).toBe(spaceTarget('space.mountain.2'))
        await undo(session)
        expect(session.movePanel?.popup).toBeUndefined()
        expect(role(session, monk)).toBe('picked')
        await press(session, monk)
        expect(role(session, monk)).toBe('lit')
        expect(session.move.value('monk')).toBeUndefined()
    })

    it('no monk, or none that can step: no Godspeed stage', async () => {
        const none = await table(['move', 'tax'], (state, { seat }) => {
            stand(state, seat, Inland)
        })
        pickCard(none.session, 'move')
        await pressRow(none.session, 'Stop moving')
        expect(none.session.movePanel?.stage).toBe('send')
        host?.close()

        const pinned = await table(['move', 'tax'], (state, { seat, other }) => {
            stand(state, seat, [Inland, 'monk'], Elsewhere)
            standMonster(state, 'behemoth', other, Inland)
        })
        pickCard(pinned.session, 'move')
        await pressRow(pinned.session, 'Stop moving')
        expect(pinned.session.movePanel?.stage).toBe('send')
    })

    it('a pinned monk stays unlit in the Godspeed stage, carrying its chip', async () => {
        const { session, seat } = await table(['move', 'tax'], (state, turn) => {
            stand(state, turn.seat, [Inland, 'monk'], ['space.forest.2', 'monk'])
            standMonster(state, 'behemoth', turn.other, Inland)
        })
        pickCard(session, 'move')
        await pressRow(session, 'Stop moving')
        expect(session.movePanel?.stage).toBe('godspeed')
        expect(role(session, pawnTarget(seat, 1))).toBe('dimmed')
        expect(chip(session, pawnTarget(seat, 1))?.label).toBe('pinned')
        expect(role(session, pawnTarget(seat, 2))).toBe('lit')
    })

    describe('pilfer', () => {
        async function onto(arrange: (state: HydratedFeudumGameState, turn: TurnTable) => void) {
            const turn = await table(['move', 'tax'], (state, context) => {
                stand(state, context.seat, Inland)
                arrange(state, context)
            })
            pickCard(turn.session, 'move')
            await press(turn.session, spaceTarget(RoadEnd))
            return turn
        }

        it('R-3.7.4 a landscape the seat’s own serf tends shows nothing', async () => {
            const { session } = await onto((state, { seat, other }) => {
                landscapeOn(state, RoadEnd, 'archery-butt')
                serfOn(state, RoadEnd, other, seat)
            })
            expect(session.movePanel?.stage).toBe('send')
        })

        it('R-3.7.4 "No pilfer" sends without one; pressed again it asks once more', async () => {
            const turn = await onto((state) => {
                goodOnOutpost(state, RoadEnd)
            })
            const { session } = turn
            expect(session.movePanel?.stage).toBe('pilfer')
            await pressRow(session, 'No pilfer')
            expect(row(session.movePanel?.rows, 'No pilfer').picked).toBe(true)
            expect(session.movePanel?.primary?.label).toBe('Move · 1 step')
            await pressRow(session, 'No pilfer')
            expect(session.movePanel?.primary).toBeUndefined()
            await pressRow(session, 'No pilfer')
            await session.sendTurnCard()
            await settled(session)
            expect(sentBy(turn)).not.toHaveProperty('pilfer')
        })

        it('R-3.7.4 a chip pressed again unpicks; another replaces it', async () => {
            const { session } = await onto((state) => {
                goodOnOutpost(state, RoadEnd)
                goodOnOutpost(state, RoadEnd, 'wood')
            })
            const iron = pilferTarget(RoadEnd, 'space', 'iron')
            const wood = pilferTarget(RoadEnd, 'space', 'wood')
            await press(session, iron)
            await press(session, iron)
            expect(session.move.value('pilfer')).toBeUndefined()
            await press(session, iron)
            await press(session, wood)
            expect(role(session, wood)).toBe('picked')
            expect(role(session, iron)).toBe('lit')
            expect(session.movePanel?.primary?.label).toBe('Move · 1 step · pilfer 1 wood')
        })

        it('R-3.7.4 two pieces that moved to one space show its goods once', async () => {
            const Meeting: SpaceId = 'space.forest.2'
            const { session, seat } = await table(['move', 'tax'], (state, turn) => {
                stand(state, turn.seat, 'space.forest.1', 'space.forest.3')
                goodOnOutpost(state, Meeting)
            })
            pickCard(session, 'move')
            await press(session, pawnTarget(seat, 1))
            await press(session, spaceTarget(Meeting))
            await press(session, pawnTarget(seat, 2))
            await press(session, spaceTarget(Meeting))
            expect(session.movePanel?.stage).toBe('pilfer')
            const iron = pilferTarget(Meeting, 'space', 'iron')
            expect(role(session, iron)).toBe('lit')
            expect(session.move.pick?.targets.filter(({ target }) => target === iron)).toHaveLength(
                1
            )
        })

        it('R-3.7.4 a shilling and a target read in the singular', async () => {
            const { session } = await onto((state, { seat, other }) => {
                landscapeOn(state, RoadEnd, 'silver-mine')
                state.supply.shillings -= 1
                serfOn(state, RoadEnd, seat, other)
            })
            const shilling = pilferTarget(RoadEnd, 'landscape', 'shillings')
            expect(chip(session, shilling)?.label).toBe('shilling')
            await press(session, shilling)
            expect(session.movePanel?.primary?.label).toBe('Move · 1 step · pilfer 1 shilling')
        })

        describe('R-4.10-H2 a pilfered sulfur goes where the seat names', () => {
            const sulfur = pilferTarget(RoadEnd, 'space', 'sulfur')

            it('the popup asks, and the send carries the barrel', async () => {
                const turn = await onto((state) => {
                    goodOnOutpost(state, RoadEnd, 'sulfur')
                })
                const { session, seat } = turn
                const barrel = session.gameState.getPlayerState(seat).barrel
                await press(session, sulfur)
                expect(session.movePanel?.popup?.anchor).toBe(sulfur)
                expect(session.movePanel?.primary).toBeUndefined()
                await undo(session)
                expect(session.movePanel?.popup).toBeUndefined()
                expect(session.move.value('pilfer')).toBeUndefined()

                await press(session, sulfur)
                await pressWay(session, 'Into the barrel')
                expect(session.movePanel?.primary?.label).toBe('Move · 1 step · pilfer 1 sulfur')
                await session.sendTurnCard()
                await settled(session)
                expect(sentBy(turn)).toMatchObject({ pilfer: { sulfurToBarrel: true } })
                expect(session.gameState.getPlayerState(seat).barrel).toBe(barrel + 1)
            })

            it('"Keep it" stays in the goods', async () => {
                const turn = await onto((state) => {
                    goodOnOutpost(state, RoadEnd, 'sulfur')
                })
                await press(turn.session, sulfur)
                await pressWay(turn.session, 'Keep it')
                await turn.session.sendTurnCard()
                await settled(turn.session)
                expect(sentBy(turn)).not.toMatchObject({ pilfer: { sulfurToBarrel: true } })
            })

            it('a full barrel asks nothing; another good, nothing', async () => {
                const full = await onto((state, { seat }) => {
                    goodOnOutpost(state, RoadEnd, 'sulfur')
                    state.supply.haversack.sulfur -= 3
                    state.getPlayerState(seat).barrel = 3
                })
                await press(full.session, sulfur)
                expect(full.session.movePanel?.popup).toBeUndefined()
                expect(full.session.movePanel?.primary?.enabled).toBe(true)
                host?.close()

                const iron = await onto((state) => {
                    goodOnOutpost(state, RoadEnd)
                })
                await press(iron.session, pilferTarget(RoadEnd, 'space', 'iron'))
                expect(iron.session.movePanel?.popup).toBeUndefined()
            })
        })
    })
})

describe('S30 R-3.7.1 the allowance spent', () => {
    it('the last step opens Godspeed, with no "Stop moving" press', async () => {
        const { session, seat } = await table(['move', 'tax'], (state, turn) => {
            stand(state, turn.seat, [Inland, 'monk'])
        })
        pickCard(session, 'move')
        expect(session.movePanel?.stage).toBe('steps')
        expect(row(session.movePanel?.rows, 'Stop moving').picked).toBe(false)
        await press(session, spaceTarget(RoadEnd))
        expect(session.move.value('stopped')).toBeUndefined()
        expect(session.movePanel?.line).toBe('Moves left: 0 of 1')
        expect(session.movePanel?.stage).toBe('godspeed')
        expect(role(session, pawnTarget(seat, 1))).toBe('lit')
        expect(role(session, spaceTarget(ShipOnly))).toBe('dimmed')
    })

    it('the last step opens the pilfer when there is no monk', async () => {
        const { session } = await table(['move', 'tax'], (state, turn) => {
            stand(state, turn.seat, Inland)
            goodOnOutpost(state, RoadEnd)
        })
        pickCard(session, 'move')
        await press(session, spaceTarget(RoadEnd))
        expect(session.movePanel?.stage).toBe('pilfer')
        expect(session.movePanel?.rows.map(({ label }) => label)).toEqual(['No pilfer'])
    })

    it('with nothing more to choose, the primary waits: a send is always a press', async () => {
        const turn = await table(['move', 'tax'], (state, { seat }) => {
            stand(state, seat, Inland)
        })
        const { session } = turn
        pickCard(session, 'move')
        await press(session, spaceTarget(RoadEnd))
        expect(session.movePanel?.stage).toBe('send')
        expect(session.movePanel?.primary).toEqual({ label: 'Move · 1 step', enabled: true })
        expect(turn.host.sent.size).toBe(0)
        expect(session.turn.sendsNow).toBeUndefined()
        await session.sendTurnCard()
        await settled(session)
        expect(sentBy(turn)).toMatchObject({ type: ActionType.Move })
    })

    it('R-3.7-H3 "Stop moving" with no step is a legal play, and not a successful move', async () => {
        const turn = await table(['move', 'tax'], (state, { seat }) => {
            stand(state, seat, Inland)
        })
        const { session, seat } = turn
        pickCard(session, 'move')
        await pressRow(session, 'Stop moving')
        expect(session.movePanel?.primary?.label).toBe('Move · 0 steps')
        await session.sendTurnCard()
        await settled(session)
        expect(session.gameState.getPlayerState(seat).successfulMoves).toBe(0)
        expect(sentBy(turn)).toMatchObject({ steps: [] })
    })
})

describe('S62 Undo through stages, then an Action', () => {
    it('pilfer, step 2, step 1, the card, the Action before; then it stops and hides', async () => {
        const turn = await table(
            ['tax', 'move', 'guild'],
            (state, { seat }) => {
                ruleTown(state, seat)
                stand(state, seat, Inland, Elsewhere)
                goodOnOutpost(state, RoadEnd)
            },
            { pouchGood: 'sulfur' }
        )
        const { session, seat } = turn
        pickCard(session, 'tax')
        session.toggleTurnSecondCard()
        await session.sendTurnCard()
        await settled(session)
        expect(session.gameState.getPlayerState(seat).played).toHaveLength(1)
        expect(session.undoableAction).toBeDefined()

        pickCard(session, 'move')
        await press(session, pawnTarget(seat, 1))
        await press(session, spaceTarget(RoadEnd))
        await press(session, pawnTarget(seat, 2))
        await press(session, spaceTarget('space.forest.2'))
        const iron = pilferTarget(RoadEnd, 'space', 'iron')
        await press(session, iron)
        expect(session.move.value('pilfer')).toBeDefined()
        expect(stepCount(session)).toBe(2)
        const actions = turn.host.actions.length

        await undo(session)
        expect(session.move.value('pilfer')).toBeUndefined()
        expect(stepCount(session)).toBe(2)

        await undo(session)
        expect(stepCount(session)).toBe(1)

        await undo(session)
        expect(stepCount(session)).toBe(0)
        expect(session.turn.card).toBe('move')

        await undo(session)
        expect(session.turn.card).toBeUndefined()
        expect(session.gameState.getPlayerState(seat).played).toHaveLength(1)
        expect(turn.host.actions.length).toBe(actions)
        expect(session.hasLocalSelection).toBe(false)
        expect(session.undoableAction).toBeDefined()

        await undo(session)
        expect(session.gameState.getPlayerState(seat).played).toEqual([])
        expect(session.hasLocalSelection).toBe(false)
        expect(session.undoableAction).toBeUndefined()
    })
})

describe('MoveDraft minimum tests', () => {
    async function monkAndPawn() {
        const turn = await table(['move', 'tax'], (state, { seat }) => {
            stand(state, seat, [Inland, 'monk'], Elsewhere, 'space.forest.2')
            goodOnOutpost(state, RoadEnd)
        })
        pickCard(turn.session, 'move')
        return turn
    }

    it('setting a stage clears every later one', async () => {
        const { session, seat } = await monkAndPawn()
        await press(session, pawnTarget(seat, 1))
        await press(session, spaceTarget(RoadEnd))
        await pressRow(session, 'Stop moving')
        await press(session, pawnTarget(seat, 1))
        await press(session, spaceTarget('space.desert.3'))
        expect(session.move.value('godspeed')).toBeDefined()

        session.move.set('monk', 1)
        expect(session.move.value('godspeed')).toBeUndefined()
        expect(session.move.value('stopped')).toBe(true)
        session.move.set('piece', { kind: 'pawn', playerId: seat, n: 2 })
        expect(session.move.value('stopped')).toBeUndefined()
        expect(session.move.value('monk')).toBeUndefined()
        expect(stepCount(session)).toBe(1)
    })

    it('Undo with a manual stage pops the highest and takes no Action back', async () => {
        const turn = await monkAndPawn()
        const { session, seat } = turn
        await press(session, pawnTarget(seat, 1))
        await press(session, spaceTarget(RoadEnd))
        await pressRow(session, 'Stop moving')
        await pressRow(session, 'No Godspeed')
        await press(session, pilferTarget(RoadEnd, 'space', 'iron'))
        const actions = turn.host.actions.length

        const popped = [
            () => session.move.value('pilfer'),
            () => session.move.value('godspeed'),
            () => session.move.value('stopped'),
            () => session.move.value('steps')
        ]
        for (const read of popped) {
            expect(read()).toBeDefined()
            expect(session.hasLocalSelection).toBe(true)
            await session.undo()
            expect(read()).toBeUndefined()
        }
        expect(session.turn.card).toBe('move')
        await session.undo()
        expect(session.turn.card).toBeUndefined()
        expect(session.hasLocalSelection).toBe(false)
        expect(turn.host.actions.length).toBe(actions)
    })

    it('Undo with only auto stages falls through to the Action undo', async () => {
        const turn = await table(
            ['tax', 'move'],
            (state, { seat }) => {
                ruleTown(state, seat)
                stand(state, seat, Inland)
            },
            { pouchGood: 'sulfur' }
        )
        const { session, seat } = turn
        pickCard(session, 'tax')
        session.toggleTurnSecondCard()
        await session.sendTurnCard()
        await settled(session)
        expect(session.turn.entry('card')).toEqual({ value: 'move', source: 'auto' })
        expect(session.move.entry('piece')).toEqual({
            value: { kind: 'pawn', playerId: seat, n: 1 },
            source: 'auto'
        })
        expect(role(session, pawnTarget(seat, 1))).toBe('picked')
        expect(role(session, spaceTarget(RoadEnd))).toBe('lit')
        expect(session.hasLocalSelection).toBe(false)
        expect(session.move.localSelection.undo()).toBe(false)

        await undo(session)
        expect(session.gameState.getPlayerState(seat).played).toEqual([])
    })

    it('a stage the order lacks throws', () => {
        const draft = new StagedDraft<MoveDraftValues>(
            MoveStageOrder.filter((stage) => stage !== 'pilfer')
        )
        expect(() => {
            draft.set('pilfer', 'none')
        }).toThrow(/does not exist in stage order/)
    })

    it('reselecting: the card pressed again, or another, ends the Move and its steps', async () => {
        const { session, seat } = await monkAndPawn()
        await press(session, pawnTarget(seat, 1))
        await press(session, spaceTarget(RoadEnd))
        expect(stepCount(session)).toBe(1)

        pickCard(session, 'tax')
        expect(session.movePanel).toBeUndefined()
        expect(session.boardOffer.trail).toBeUndefined()
        expect(session.hasLocalSelection).toBe(true)
        pickCard(session, 'move')
        expect(stepCount(session)).toBe(0)
        expect(session.movePanel?.line).toBe('Moves left: 3 of 3')

        await press(session, pawnTarget(seat, 1))
        await press(session, spaceTarget(RoadEnd))
        pickCard(session, 'move')
        expect(session.turn.card).toBeUndefined()
        expect(session.move.selection).toEqual({})
        pickCard(session, 'move')
        expect(stepCount(session)).toBe(0)
    })

    it('the two-cards toggle keeps the steps, and the send declares it', async () => {
        const turn = await table(
            ['move', 'tax', 'guild'],
            (state, { seat }) => {
                stand(state, seat, Inland, Elsewhere)
            },
            { pouchGood: 'sulfur' }
        )
        const { session, seat } = turn
        pickCard(session, 'move')
        await press(session, pawnTarget(seat, 1))
        await press(session, spaceTarget(RoadEnd))
        session.toggleTurnSecondCard()
        flushSync()
        expect(stepCount(session)).toBe(1)
        await pressRow(session, 'Stop moving')
        await session.sendTurnCard()
        await settled(session)
        expect(sentBy(turn)).toMatchObject({ type: ActionType.Move, secondCard: true })
    })

    describe('the stacked steps', () => {
        it('Undo pops the latest press and keeps the earlier ones', async () => {
            const { session, seat } = await monkAndPawn()
            await press(session, pawnTarget(seat, 1))
            await press(session, spaceTarget(RoadEnd))
            await press(session, spaceTarget(Inland))
            await undo(session)
            expect(session.move.value('steps')).toHaveLength(1)
            expect(session.move.value('steps')?.[0].to).toBe(RoadEnd)
        })

        it('a push clears every later stage, and Undo pops an open later stage first', async () => {
            const { session, seat } = await monkAndPawn()
            await press(session, pawnTarget(seat, 1))
            await press(session, spaceTarget(RoadEnd))
            session.move.set('stopped', true)
            const [first] = session.move.value('steps') ?? []
            session.move.push('steps', [first, { ...first, to: Inland }])
            expect(session.move.value('steps')).toHaveLength(2)
            expect(session.move.value('stopped')).toBeUndefined()
            expect(session.move.value('piece')).toBeUndefined()

            await undo(session)
            expect(session.move.value('steps')).toHaveLength(1)
            session.move.set('stopped', true)
            await undo(session)
            expect(session.move.value('stopped')).toBeUndefined()
            expect(session.move.value('steps')).toHaveLength(1)
        })

        it('the keep rule: it ends with the displayed state, on every transition kind', async () => {
            // A lone card reads through as `auto`, so nothing but the transition ends the steps.
            const turn = await table(['move'], (state, { seat }) => {
                ruleTown(state, seat)
                giveTile(state, seat)
                giveTile(state, seat)
                stand(state, seat, Inland, Elsewhere)
            })
            const { session, seat, host: tableHost } = turn
            const spend = () => ({
                type: ActionType.SpendRegionTile,
                tileId: session.gameState.getPlayerState(seat).regionTiles[0],
                good: 'food'
            })
            const stage = async () => {
                expect(session.turn.entry('card')).toEqual({ value: 'move', source: 'auto' })
                await press(session, pawnTarget(seat, 1))
                await press(session, spaceTarget(RoadEnd))
                expect(stepCount(session)).toBe(1)
            }

            await stage()
            tableHost.sendUnheard(seat, spend())
            await tableHost.reconcile(seat)
            await settled(session)
            expect(session.move.selection).toEqual({})

            await stage()
            await tableHost.send(seat, spend())
            await settled(session)
            expect(session.move.selection).toEqual({})

            await stage()
            await session.forfeitTurnCard()
            await settled(session)
            expect(session.move.selection).toEqual({})
        })

        it('a lone card comes back with no steps: the draft ends with the state too', async () => {
            const { session, seat } = await table(['move'], (state, turn) => {
                stand(state, turn.seat, Inland, Elsewhere)
            })
            expect(session.turn.entry('card')?.source).toBe('auto')
            await press(session, pawnTarget(seat, 1))
            await press(session, spaceTarget(RoadEnd))
            expect(stepCount(session)).toBe(1)
            await session.history.goToPreviousAction()
            await settled(session)
            expect(session.isViewingHistory).toBe(true)
            session.history.goToEnd()
            await settled(session)
            expect(session.isViewingHistory).toBe(false)
            expect(session.turn.card).toBe('move')
            expect(stepCount(session)).toBe(0)
        })
    })
})

describe('MoveDraft: Repeat (R-3.15, R-3.7.5)', () => {
    it('Repeat replays Move: the steps are the same, and the send carries it', async () => {
        const turn = await table(['repeat', 'tax'], (state, { seat }) => {
            const player = state.getPlayerState(seat)
            player.played.push({ kind: 'move', use: 'regular' })
            player.successfulMoves = 1
            stand(state, seat, Inland)
        })
        const { session } = turn
        pickCard(session, 'repeat')
        expect(session.turn.entry('replay')).toEqual({ value: 'move', source: 'auto' })
        expect(session.turn.mode).toBe(ActionType.Move)
        expect(session.movePanel?.line).toBe('Moves left: 1 of 1')
        await press(session, spaceTarget(RoadEnd))
        await session.sendTurnCard()
        await settled(session)
        expect(sentBy(turn)).toMatchObject({ type: ActionType.Move, asRepeat: 'repeat' })
    })
})

describe('MoveDraft: who has it (R-X.1; contract: Coexistence and precedence)', () => {
    async function staged() {
        const turn = await table(['move', 'tax'], (state, { seat }) => {
            stand(state, seat, Inland, Elsewhere)
        })
        pickCard(turn.session, 'move')
        await press(turn.session, pawnTarget(turn.seat, 1))
        await press(turn.session, spaceTarget(RoadEnd))
        return turn
    }

    it('another seat has no panel, no pick and no trail of a private choice', async () => {
        const turn = await staged()
        const watching = await turn.host.openSeat(turn.other)
        expect(watching.movePanel).toBeUndefined()
        expect(watching.boardOffer.targets.size).toBe(0)
        expect(watching.boardOffer.trail).toBeUndefined()
        await watching.pressTurnTarget(pawnTarget(turn.seat, 1))
        expect(watching.move.selection).toEqual({})
    })

    it('History View shows no choices, a press does nothing, and the steps do not come back', async () => {
        const turn = await staged()
        const { session, seat } = turn
        await session.history.goToPreviousAction()
        await settled(session)
        expect(session.isViewingHistory).toBe(true)
        expect(session.movePanel).toBeUndefined()
        expect(session.move.selection).toEqual({})
        expect(session.boardOffer.dimsRest).toBe(false)
        await session.pressTurnTarget(pawnTarget(seat, 2))
        await session.sendTurnCard()
        expect(turn.host.sent.size).toBe(0)

        session.history.goToEnd()
        await settled(session)
        expect(stepCount(session)).toBe(0)
    })

    it('a dimmed map element does nothing; a target the stage does not name, nothing', async () => {
        const { session } = await staged()
        await session.pressTurnTarget(stackTarget('desert'))
        await session.pressTurnTarget(spaceTarget('space.island.1'))
        expect(stepCount(session)).toBe(1)
    })

    it('the primary sends nothing before its stage, and a press does not send', async () => {
        const turn = await staged()
        await turn.session.sendTurnCard()
        expect(turn.host.sent.size).toBe(0)
        expect(turn.session.movePanel?.primary).toBeUndefined()
    })
})

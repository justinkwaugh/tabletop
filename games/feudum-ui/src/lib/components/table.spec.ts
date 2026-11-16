import { flushSync } from 'svelte'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
    ActionType,
    HydratedFeudumGameState,
    RegionIds,
    StartingSpaceIds,
    type SpaceId
} from '@tabletop/feudum'
import { isBright, type BoardChrome } from '$lib/model/boardChrome.js'
import { NoBoardOffer, spaceTarget } from '$lib/model/boardOffer.js'
import type { BoardOffer, BoardTarget } from '$lib/model/boardOffer.js'
import { stackTilesByEpoch } from '$lib/model/boardView.js'
import type { FeudumGameSession } from '$lib/model/session.svelte.js'
import { TableLayers, type EnlargedFace } from '$lib/model/tableLayers.svelte.js'
import { FeudumHost, settled } from '$lib/testing/sessionHarness.js'
import { atPlayingCards, giveSeal, ruleTown } from '$lib/testing/turnTable.js'

const Back: EnlargedFace = { kind: 'tile', faceShown: false, epoch: 1 }
const Bead: EnlargedFace = { kind: 'bead', faceShown: true, beadValue: 4 }
const A = StartingSpaceIds[0]
const B = StartingSpaceIds[1]

function shown(session: FeudumGameSession): BoardTarget[] {
    return [...session.boardOffer.targets]
        .filter(([, { role }]) => role === 'lit' || role === 'picked')
        .map(([target]) => target)
        .toSorted()
}

describe('S59 Enlarge and the layers over the table (contract: Coexistence and precedence)', () => {
    it('R-X.1 Escape closes the enlarged piece, then a seat or a stack, then nothing; it chooses nothing', () => {
        const layers = new TableLayers()
        layers.openSeat('p1')
        layers.enlarge({}, () => Back)

        expect(layers.escape()).toBe(true)
        expect(layers.enlarged).toBeUndefined()
        expect(layers.openSeatId).toBe('p1')

        expect(layers.escape()).toBe(true)
        expect(layers.openSeatId).toBeUndefined()

        expect(layers.escape()).toBe(false)
    })

    it('R-4.4.4 It reads its owner, so a back stays a back, and ends with its owner', () => {
        const layers = new TableLayers()
        const owner = {}
        let face: EnlargedFace = Back
        layers.enlarge(owner, () => face)
        expect(layers.enlarged).toEqual(Back)

        face = Bead
        layers.enlarge(owner, () => face)
        expect(layers.enlarged).toEqual(Bead)

        layers.ownerGone({})
        expect(layers.enlarged).toEqual(Bead)
        layers.ownerGone(owner)
        expect(layers.enlarged).toBeUndefined()
    })

    it('R-5.1 A seat and a stack view replace each other; only one is open', () => {
        const layers = new TableLayers()
        layers.openSeat('p1')
        layers.openStack({ kind: 'region', region: RegionIds[0] })
        expect(layers.openSeatId).toBeUndefined()
        layers.openSeat('p2')
        expect(layers.stackView).toBeUndefined()
    })

    it('Contract, Supply: the writ reference replaces a seat or stack view; Escape closes it', () => {
        const layers = new TableLayers()
        layers.openSeat('p1')
        layers.openWrits()
        expect(layers.writsOpen).toBe(true)
        expect(layers.openSeatId).toBeUndefined()
        layers.openStack({ kind: 'region', region: RegionIds[0] })
        expect(layers.writsOpen).toBe(false)
        layers.openWrits()
        expect(layers.stackView).toBeUndefined()
        layers.enlarge({}, () => Bead)
        expect(layers.escape()).toBe(true)
        expect(layers.writsOpen).toBe(true)
        expect(layers.escape()).toBe(true)
        expect(layers.writsOpen).toBe(false)
        expect(layers.escape()).toBe(false)
    })

    it('R-4.3.1 A stack view names epochs and counts: nothing of a landscape reaches it', async () => {
        const host = new FeudumHost(3)
        const state = new HydratedFeudumGameState(structuredClone(host.state))
        const [region] = RegionIds
        const groups = stackTilesByEpoch(state, region)

        expect(groups.reduce((sum, { count }) => sum + count, 0)).toBe(
            state.regionStacks[region].length
        )
        for (const group of groups) {
            expect(Object.keys(group).toSorted()).toEqual(['count', 'epoch'])
        }
    })
})

describe('S60 Hover on a row (contract: Hover)', () => {
    let host: FeudumHost

    afterEach(() => host.close())

    async function seatAtImprove() {
        const table = await atPlayingCards(['improve', 'move'])
        host = table.host
        let space: SpaceId = A
        host.edit((state) => {
            space = ruleTown(state, table.seat)
            giveSeal(state, table.seat)
        })
        const session = await host.openSeat(table.seat)
        flushSync()
        return { session, space }
    }

    it('R-3.9 Pointing at Improve brightens the improvable spaces and picks nothing', async () => {
        const { session, space } = await seatAtImprove()

        const row = session.turnPanel?.cards.find(({ kind }) => kind === 'improve')
        const lights = row?.lights() ?? []
        expect(lights).toContain(spaceTarget(space))

        const owner = {}
        session.pointAtRow(owner, () => lights)
        flushSync()
        expect(isBright(session.boardChrome, spaceTarget(space))).toBe(true)
        expect(session.boardChrome.bright.size).toBe(lights.length)

        session.leaveRow({})
        expect(session.boardChrome.bright.size).toBe(lights.length)
        session.leaveRow(owner)
        flushSync()
        expect(session.boardChrome.bright.size).toBe(0)
    })

    it('R-3.2 What a card row brightens is what its press lights, and reading it stages nothing', async () => {
        const { session } = await seatAtImprove()

        for (const kind of ['improve', 'move'] as const) {
            const row = session.turnPanel?.cards.find((card) => card.kind === kind)
            const lights = [...(row?.lights() ?? [])].toSorted()
            expect(lights.length).toBeGreaterThan(0)
            expect(session.turnPanel?.cards.some(({ picked }) => picked)).toBe(false)

            session.pressTurnCard(kind)
            flushSync()
            expect(shown(session)).toEqual(lights)

            session.pressTurnCard(kind)
            flushSync()
        }
    })

    it('R-3.2 A touch tap on the preview path stands in for hover, and a second ends it', async () => {
        const table = await atPlayingCards(['move'])
        host = table.host
        const session = await host.openSeat(table.seat)
        flushSync()
        const owner = {}
        const lights = (): readonly BoardTarget[] => [spaceTarget(A)]

        session.toggleRowPreview(owner, lights)
        flushSync()
        expect(session.isRowPointedAt(owner)).toBe(true)
        expect(session.boardChrome.bright.has(spaceTarget(A))).toBe(true)

        session.toggleRowPreview(owner, lights)
        flushSync()
        expect(session.boardChrome.bright.size).toBe(0)
    })

    it('R-X.1 Hover chooses nothing: under an open pick a dimmed element stays dimmed', () => {
        const offer: BoardOffer = { ...NoBoardOffer, dimsRest: true }
        const chrome: BoardChrome = { offer, bright: new Set([spaceTarget(A)]) }
        expect(isBright(chrome, spaceTarget(A))).toBe(false)
        expect(isBright({ ...chrome, offer: NoBoardOffer }, spaceTarget(A))).toBe(true)
    })
})

describe('Popups (contract: Popups; R-1.4.9)', () => {
    let host: FeudumHost
    let session: FeudumGameSession

    beforeEach(async () => {
        host = new FeudumHost()
        await host.playStartingGoods()
        session = await host.openSeat(host.setupSeat)
        flushSync()
    })

    afterEach(() => host.close())

    it('R-1.4.9 A space pressed first asks its character beside it', async () => {
        expect(session.boardPopup).toBeUndefined()
        await session.pressBoardTarget(spaceTarget(A))
        flushSync()
        expect(session.boardPopup?.anchor).toBe(spaceTarget(A))
        expect(session.boardPopup?.choices.length).toBeGreaterThan(0)
    })

    it('R-1.4.9 A press outside does nothing and closes nothing', async () => {
        await session.pressBoardTarget(spaceTarget(A))
        flushSync()
        await session.pressBoardTarget(spaceTarget(B))
        flushSync()
        expect(session.boardPopup?.anchor).toBe(spaceTarget(A))
        expect(session.startingPawn.spaceId).toBe(A)
    })

    it('R-1.4.9 Undo removes it', async () => {
        await session.pressBoardTarget(spaceTarget(A))
        flushSync()
        await session.undo()
        flushSync()
        expect(session.boardPopup).toBeUndefined()
        expect(session.startingPawn.spaceId).toBeUndefined()
    })

    it('R-1.4.9 Its row answers it', async () => {
        await session.pressBoardTarget(spaceTarget(A))
        flushSync()
        host.sent.clear()
        const [first] = session.boardPopup?.choices ?? []
        expect(first).toBeDefined()
        if (first) {
            await session.pressPopupChoice(first)
        }
        flushSync()
        await settled(session)
        expect(session.boardPopup).toBeUndefined()
        expect(host.sent.size).toBe(1)
    })
})

describe('S61 History View (contract: History View)', () => {
    let host: FeudumHost

    afterEach(() => host.close())

    it('R-X.1 Stepping back offers no choice; the layers open as they do live', async () => {
        host = new FeudumHost()
        await host.playStartingGoods()
        await host.playStartingPawns(1)
        const seat = host.order.find((id) => id !== host.setupSeat) ?? host.setupSeat
        const session = await host.openSeat(seat)
        flushSync()
        await session.history.goToPreviousAction()
        await settled(session)

        expect(session.isViewingHistory).toBe(true)
        expect(shown(session)).toEqual([])
        expect(session.boardPopup).toBeUndefined()
        expect(session.boardChrome.press).toBeDefined()
        await session.pressBoardTarget(spaceTarget(A))
        flushSync()
        expect(session.boardPopup).toBeUndefined()

        session.layers.enlarge({}, () => Bead)
        session.layers.openSeat(seat)
        flushSync()
        expect(session.layers.enlarged).toEqual(Bead)
        expect(session.layers.openSeatId).toBe(seat)

        session.history.goToEnd()
        await settled(session)
        expect(session.isViewingHistory).toBe(false)
    })

    it('R-X.1 A popup left open and a row pointed at show nothing while stepping back', async () => {
        host = new FeudumHost()
        await host.playStartingGoods()
        const session = await host.openSeat(host.setupSeat)
        flushSync()
        await session.pressBoardTarget(spaceTarget(A))
        session.pointAtRow({}, () => [spaceTarget(B)])
        flushSync()
        expect(session.boardPopup).toBeDefined()
        expect(session.boardChrome.bright.size).toBe(1)

        await session.history.goToPreviousAction()
        await settled(session)

        expect(session.isViewingHistory).toBe(true)
        expect(session.boardPopup).toBeUndefined()
        expect(session.boardChrome.bright.size).toBe(0)
    })

    it('R-X.1 A seat stepped back to its own turn is offered no card', async () => {
        const turn = await atPlayingCards(['tax', 'harvest'])
        host = turn.host
        const session = await host.openSeat(turn.seat)
        flushSync()
        expect(session.turnPanel).toBeDefined()
        await host.send(turn.seat, { type: ActionType.ForfeitCard, kind: 'tax' })
        await settled(session)

        await session.history.goToPreviousAction()
        await settled(session)

        expect(session.isViewingHistory).toBe(true)
        expect(session.validActionTypes).toContain(ActionType.ForfeitCard)
        expect(session.turnPanel).toBeUndefined()
        expect(shown(session)).toEqual([])
    })
})

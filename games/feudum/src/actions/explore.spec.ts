import { showLocation } from '../testing/improving.js'
import { Visibility } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import type { SpaceId } from '../data/board.js'
import type { ActionCardKind } from '../data/cards.js'
import type { WritId } from '../data/writs.js'
import { ActionType } from '../definition/actions.js'
import { FeudumApiActions } from '../definition/apiActions.js'
import { MachineState } from '../definition/states.js'
import { FeudumGameState, type HydratedFeudumGameState } from '../model/gameState.js'
import { writDeckCount } from '../model/writDeck.js'
import { canonicalOf } from '../testing/state.js'
import { tableAtPlayingCards, type Table } from '../testing/table.js'
import { exploreDrawCount, exploreOffer, reasonExploreRefused } from './explore.js'
import { keepWritsOffer, reasonKeepWritsRefused } from './keepWrits.js'

const SPACES: readonly SpaceId[] = ['space.forest.1', 'space.forest.3', 'space.desert.1']
const HAND: ActionCardKind[] = ['explore', 'migrate', 'guild']

const NEEDS_IRON = 'Shovels & Swords needs an iron.'
const ONLY_AFTER_EXPLORE = 'Shovels & Swords follows only the keep from an Explore draw.'
const NOTHING_TO_DRAW = 'The deck has no writs left to draw.'

const actionProjector = Visibility.createActionProjector(FeudumApiActions)
const stateProjector = Visibility.createProjector(FeudumGameState)
const spectator = { kind: 'spectator' } as const

type Kind = 'outpost' | 'farm' | 'town' | 'feudum'

/** The seat rules a space of each kind named, its markers leaving its own supply. */
function rule(state: HydratedFeudumGameState, playerId: string, kinds: readonly Kind[]): void {
    kinds.forEach((kind, index) => {
        const space = state.spaces[SPACES[index]]
        showLocation(state, SPACES[index], kind)
        space.ruler = { playerId, subject: false }
        state.getPlayerState(playerId).influenceSupply -= 1
    })
}

function tableWith(
    kinds: readonly Kind[] = ['outpost'],
    edit?: (state: HydratedFeudumGameState, playerId: string) => void,
    hand: ActionCardKind[] = HAND
): { table: Table; playerId: string } {
    const table = tableAtPlayingCards(() => ({ cards: hand }))
    const playerId = table.asked
    table.moveTo((state) => {
        rule(state, playerId, kinds)
        edit?.(state, playerId)
        state.recomputeRanks()
        return MachineState.PlayingCards
    })
    return { table, playerId }
}

function shortenDeckTo(state: HydratedFeudumGameState, count: number) {
    const vault = state.requireVault()
    const removed = vault.writDeck.length - count
    vault.writDeck.splice(0, removed)
    state.writDeck.top += removed
}

function loseIron(state: HydratedFeudumGameState, playerId: string) {
    const { goods } = state.getPlayerState(playerId)
    state.supply.haversack.iron += goods.iron
    goods.iron = 0
}

function explore(table: Table, playerId: string) {
    return table.send(playerId, { type: ActionType.Explore, revealsInfo: true })
}

function drawnOf(table: Table): WritId[] {
    const drawn = table.hydrated().flow.writDraw?.drawn
    expect(drawn).toBeDefined()
    return drawn ?? []
}

/** Explores, keeps the first writ drawn and turns in the iron. */
function exploreThenShovels(table: Table, playerId: string) {
    explore(table, playerId)
    const first = drawnOf(table)
    const [action] = table.send(playerId, {
        type: ActionType.KeepWrits,
        keep: [first[0]],
        shovelsAndSwords: true
    })
    return { action, first }
}

describe('Explore', () => {
    it('R-3.10.1 is offered with the card', () => {
        const { table, playerId } = tableWith()
        expect(table.offered(playerId)).toContain(ActionType.Explore)
        expect(table.offered(table.order[1])).not.toContain(ActionType.Explore)
    })

    it('R-3.10.1 is refused with no ruled outpost', () => {
        for (const kinds of [[], ['farm'], ['town'], ['feudum']] satisfies Kind[][]) {
            const { table, playerId } = tableWith(kinds)
            expect(reasonExploreRefused(table.hydrated(), playerId, {})).toBe(
                'You rule no outpost.'
            )
            expect(() => explore(table, playerId)).toThrow('You rule no outpost.')
        }
    })

    it('R-3.2 is refused out of turn and without the card', () => {
        const { table } = tableWith()
        expect(reasonExploreRefused(table.hydrated(), table.order[1], {})).toBe(
            "It isn't your turn."
        )
        const other = tableWith(['outpost'], undefined, ['migrate', 'guild', 'tax'])
        expect(reasonExploreRefused(other.table.hydrated(), other.playerId, {})).toBe(
            "Explore isn't in your hand."
        )
    })

    it('R-3.10.1 plays the card, draws, and asks the drawer in KeepingWrits; a barrier (S18)', () => {
        const { table, playerId } = tableWith()
        const deck = writDeckCount(table.hydrated())

        const [action] = explore(table, playerId)

        const state = table.hydrated()
        expect(action.revealsInfo).toBe(true)
        expect(state.machineState).toBe(MachineState.KeepingWrits)
        expect(table.asked).toBe(playerId)
        expect(table.offered(playerId)).toEqual([ActionType.KeepWrits])
        expect(table.offered(table.order[1])).toEqual([])
        expect(writDeckCount(state)).toBe(deck - 2)
        const player = state.getPlayerState(playerId)
        expect(player.hand).toEqual(['migrate', 'guild'])
        expect(player.played).toEqual([{ kind: 'explore', use: 'regular' }])
        expect(player.writCount).toBe(0)
        expect(state.flow.writDraw).toMatchObject({
            playerId,
            drawnCount: 2,
            keep: 1,
            source: 'explore',
            shovelsOffered: true
        })
        expect(state.flow.turn?.followUps).toEqual([{ kind: 'keep-writs' }])
        expect(action).toMatchObject({
            metadata: { drawnCount: 2, keep: 1, drawnWritIds: drawnOf(table) }
        })
    })

    it.each<[readonly Kind[], number]>([
        [['outpost'], 2],
        [['outpost', 'outpost'], 3],
        [['outpost', 'feudum'], 3],
        [['outpost', 'outpost', 'outpost'], 4],
        [['outpost', 'outpost', 'feudum'], 4],
        [['outpost', 'farm'], 2],
        [['outpost', 'town'], 2],
        [['outpost', 'farm', 'town'], 2]
    ])('R-3.10.1, R-3.10-H1 ruling %j draws %i', (kinds, count) => {
        const { table, playerId } = tableWith(kinds)
        expect(exploreDrawCount(table.hydrated(), playerId)).toBe(count)
        expect(exploreOffer(table.hydrated(), playerId)).toMatchObject({
            drawCount: count,
            keep: 1,
            revealsInfo: true
        })
        const deck = writDeckCount(table.hydrated())

        const [action] = explore(table, playerId)

        expect(action).toMatchObject({ metadata: { drawnCount: count, keep: 1 } })
        expect(drawnOf(table)).toHaveLength(count)
        expect(writDeckCount(table.hydrated())).toBe(deck - count)
    })

    it('R-3.10.1 a serf or subject counts for nothing: only the ruled space does', () => {
        const { table, playerId } = tableWith(['outpost'], (state, id) => {
            const space = state.spaces[SPACES[1]]
            showLocation(state, SPACES[1], 'outpost')
            space.serf = { playerId: id }
        })
        expect(exploreDrawCount(table.hydrated(), playerId)).toBe(2)
    })

    it('R-3.10.1 the offer is empty while Explore would be refused', () => {
        const { table, playerId } = tableWith([])
        expect(exploreOffer(table.hydrated(), playerId)).toBeUndefined()
    })

    it('R-4.4-H2 a short deck draws what is there, and the offer says so', () => {
        const { table, playerId } = tableWith(['outpost', 'outpost', 'feudum'], (state) => {
            shortenDeckTo(state, 3)
        })
        expect(exploreOffer(table.hydrated(), playerId)).toMatchObject({ drawCount: 3 })
        const [action] = explore(table, playerId)
        expect(action).toMatchObject({ metadata: { drawnCount: 3, keep: 1 } })
        expect(writDeckCount(table.hydrated())).toBe(0)
    })

    it('R-4.4-H2 an empty deck draws nothing: no keep, and the turn passes; still a barrier', () => {
        const { table, playerId } = tableWith(['outpost'], (state) => {
            shortenDeckTo(state, 0)
        })
        const [action] = explore(table, playerId)
        expect(action.revealsInfo).toBe(true)
        expect(action).toMatchObject({ metadata: { drawnCount: 0, keep: 0, drawnWritIds: [] } })
        const state = table.hydrated()
        expect(state.flow.writDraw).toBeUndefined()
        expect(state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).not.toBe(playerId)
    })

    it('R-3.15.2 Déjà Vu replays it for a saltpeter, drawing again', () => {
        const { table, playerId } = tableWith(['outpost'], undefined, [
            'explore',
            'repeat',
            'migrate',
            'guild'
        ])
        explore(table, playerId)
        table.send(playerId, { type: ActionType.KeepWrits, keep: [drawnOf(table)[0]] })
        for (const seat of table.order.filter((id) => id !== playerId)) {
            table.send(seat, { type: ActionType.ForfeitCard, kind: 'guild' })
        }
        expect(table.asked).toBe(playerId)
        const { saltpeter } = table.seat(playerId).goods

        const [action] = table.send(playerId, {
            type: ActionType.Explore,
            revealsInfo: true,
            asRepeat: 'deja-vu'
        })

        expect(action).toMatchObject({ metadata: { drawnCount: 2 } })
        const player = table.seat(playerId)
        expect(player.goods.saltpeter).toBe(saltpeter - 1)
        expect(player.played.at(-1)).toEqual({
            kind: 'repeat',
            use: 'regular',
            replayedKind: 'explore',
            dejaVu: true
        })
        expect(table.hydrated().flow.writDraw?.shovelsOffered).toBe(true)
    })

    it('R-3.10.1, R-5.1 the writs drawn are the drawer’s; count and keep number are public (S18)', () => {
        const { table, playerId } = tableWith()
        const [action] = explore(table, playerId)
        const drawn = drawnOf(table)
        const canonical = canonicalOf(table.hydrated())
        const mine = { kind: 'player', playerId } as const
        const theirs = { kind: 'player', playerId: table.order[1] } as const

        expect(
            stateProjector.project(canonical, mine, { config: {} }).flow.writDraw?.drawn
        ).toEqual(drawn)
        expect(actionProjector.project(action, mine, { config: {} })).toMatchObject({
            metadata: { drawnWritIds: drawn }
        })
        for (const perspective of [theirs, spectator]) {
            const { writDraw } = stateProjector.project(canonical, perspective, {
                config: {}
            }).flow
            expect(writDraw).not.toHaveProperty('drawn')
            expect(writDraw).toMatchObject({ drawnCount: 2, keep: 1 })
            const projected = actionProjector.project(action, perspective, { config: {} })
            expect(projected).toMatchObject({ metadata: { drawnCount: 2, keep: 1 } })
            expect(JSON.stringify(projected)).not.toContain(drawn[0])
            expect(JSON.stringify(projected)).not.toContain(drawn[1])
        }
    })
})

describe('Shovels & Swords', () => {
    it('R-3.10.2, R-3.10-H2 is offered at the keep, not before the draw (S19)', () => {
        const { table, playerId } = tableWith()
        explore(table, playerId)
        expect(keepWritsOffer(table.hydrated(), playerId)).toMatchObject({
            keep: 1,
            drawn: drawnOf(table),
            source: 'explore',
            shovelsAndSwords: { draw: 2, keep: 1, revealsInfo: true }
        })
    })

    it('R-3.10.2 turns in an iron, keeps from the first draw, draws 2 and asks again; a barrier (S19)', () => {
        const { table, playerId } = tableWith()
        const haversackIron = table.hydrated().supply.haversack.iron
        const iron = table.seat(playerId).goods.iron
        const deck = writDeckCount(table.hydrated())

        const { action, first } = exploreThenShovels(table, playerId)

        const state = table.hydrated()
        const player = state.getPlayerState(playerId)
        expect(action.revealsInfo).toBe(true)
        expect(player.goods.iron).toBe(iron - 1)
        expect(state.supply.haversack.iron).toBe(haversackIron + 1)
        expect(player.writs).toEqual([first[0]])
        expect(player.writCount).toBe(1)
        expect(player.played).toEqual([{ kind: 'explore', use: 'special' }])
        // Two drawn, one under the deck, two more drawn.
        expect(writDeckCount(state)).toBe(deck - 2 + 1 - 2)
        expect(player.deckKnowledge).toEqual([
            { slot: state.writDeck.nextBottom - 1, writId: first[1] }
        ])
        expect(state.machineState).toBe(MachineState.KeepingWrits)
        expect(table.asked).toBe(playerId)
        expect(state.flow.writDraw).toMatchObject({
            playerId,
            drawnCount: 2,
            keep: 1,
            source: 'shovels',
            shovelsOffered: false
        })
        expect(action).toMatchObject({
            keep: [first[0]],
            shovelsAndSwords: true,
            metadata: {
                keptCount: 1,
                returnedCount: 1,
                returned: [{ slot: state.writDeck.nextBottom - 1, writId: first[1] }],
                drawnCount: 2,
                keepNext: 1,
                drawnWritIds: drawnOf(table)
            }
        })
    })

    it('R-3.10.2 only once: the second keep offers no more, is no barrier, and ends the card', () => {
        const { table, playerId } = tableWith()
        const { first } = exploreThenShovels(table, playerId)
        const second = drawnOf(table)

        expect(keepWritsOffer(table.hydrated(), playerId)?.shovelsAndSwords).toBeUndefined()
        expect(
            reasonKeepWritsRefused(table.hydrated(), playerId, {
                keep: [second[0]],
                shovelsAndSwords: true
            })
        ).toBe(ONLY_AFTER_EXPLORE)
        expect(() =>
            table.send(playerId, {
                type: ActionType.KeepWrits,
                keep: [second[0]],
                shovelsAndSwords: true
            })
        ).toThrow(ONLY_AFTER_EXPLORE)

        const [action] = table.send(playerId, { type: ActionType.KeepWrits, keep: [second[0]] })

        expect(action.revealsInfo).toBeFalsy()
        const state = table.hydrated()
        expect(state.getPlayerState(playerId).writs).toEqual([first[0], second[0]])
        expect(state.getPlayerState(playerId).writCount).toBe(2)
        expect(state.flow.writDraw).toBeUndefined()
        expect(state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).not.toBe(playerId)
    })

    it('R-3.10.2 needs an iron', () => {
        const { table, playerId } = tableWith(['outpost'], (state, id) => {
            loseIron(state, id)
        })
        explore(table, playerId)
        const keep = [drawnOf(table)[0]]

        expect(keepWritsOffer(table.hydrated(), playerId)?.shovelsAndSwords).toBeUndefined()
        expect(
            reasonKeepWritsRefused(table.hydrated(), playerId, { keep, shovelsAndSwords: true })
        ).toBe(NEEDS_IRON)
        expect(() =>
            table.send(playerId, { type: ActionType.KeepWrits, keep, shovelsAndSwords: true })
        ).toThrow(NEEDS_IRON)
    })

    it('R-3.10.2 declined, the keep is no barrier and spends no iron', () => {
        const { table, playerId } = tableWith()
        const { iron } = table.seat(playerId).goods
        explore(table, playerId)

        const [action] = table.send(playerId, {
            type: ActionType.KeepWrits,
            keep: [drawnOf(table)[1]]
        })

        expect(action.revealsInfo).toBeFalsy()
        expect(table.seat(playerId).goods.iron).toBe(iron)
        expect(table.seat(playerId).played).toEqual([{ kind: 'explore', use: 'regular' }])
        expect(table.asked).not.toBe(playerId)
    })

    it('R-3.10-H3 with nothing left to draw it is refused: the iron buys nothing', () => {
        const { table, playerId } = tableWith(['outpost'], (state) => {
            shortenDeckTo(state, 1)
        })
        explore(table, playerId)
        const keep = drawnOf(table)

        expect(keep).toHaveLength(1)
        expect(keepWritsOffer(table.hydrated(), playerId)?.shovelsAndSwords).toBeUndefined()
        expect(
            reasonKeepWritsRefused(table.hydrated(), playerId, { keep, shovelsAndSwords: true })
        ).toBe(NOTHING_TO_DRAW)
    })

    it('R-3.10-H2, R-4.4-H2 the unkept writ goes under first, so a short deck can return it', () => {
        const { table, playerId } = tableWith(['outpost'], (state) => {
            shortenDeckTo(state, 2)
        })
        const { action, first } = exploreThenShovels(table, playerId)

        expect(action).toMatchObject({ metadata: { drawnCount: 1, keepNext: 1 } })
        const state = table.hydrated()
        expect(state.flow.writDraw).toMatchObject({ drawnCount: 1, keep: 1 })
        expect(drawnOf(table)).toEqual([first[1]])
        // R-5.1 It left the deck, so nobody is told it is still there.
        expect(state.getPlayerState(playerId).deckKnowledge).toEqual([])
    })

    it('R-3.10.2, R-5.1 the second draw is the drawer’s; the counts are public (S19)', () => {
        const { table, playerId } = tableWith()
        const { action } = exploreThenShovels(table, playerId)
        const second = drawnOf(table)
        expect(
            actionProjector.project(action, { kind: 'player', playerId }, { config: {} })
        ).toMatchObject({ metadata: { drawnWritIds: second } })

        for (const perspective of [
            { kind: 'player', playerId: table.order[1] } as const,
            spectator
        ]) {
            const projected = actionProjector.project(action, perspective, { config: {} })
            expect(projected).toMatchObject({
                shovelsAndSwords: true,
                metadata: { keptCount: 1, returnedCount: 1, drawnCount: 2, keepNext: 1 }
            })
            expect(projected).not.toHaveProperty('keep')
            for (const writId of second) {
                expect(JSON.stringify(projected)).not.toContain(writId)
            }
        }
    })
})

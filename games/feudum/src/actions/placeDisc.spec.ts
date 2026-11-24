import { Visibility } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { ActionType } from '../definition/actions.js'
import { FeudumApiActions } from '../definition/apiActions.js'
import { FeudumHydrator } from '../definition/hydrator.js'
import { MachineState } from '../definition/states.js'
import { queueFollowUp } from '../model/followUps.js'
import type { FollowUp } from '../model/flow.js'
import { FeudumGameState, type HydratedFeudumGameState } from '../model/gameState.js'
import { writDeckCount } from '../model/writDeck.js'
import { stateAfterCardStep } from '../stateHandlers/cardTurns.js'
import { canonicalOf } from '../testing/state.js'
import { tableAtPlayingCards, type Table, drawnWrits } from '../testing/table.js'
import {
    HydratedPlaceDisc,
    PlaceDisc,
    placeDiscOffer,
    reasonPlaceDiscRefused
} from './placeDisc.js'

const projector = Visibility.createProjector(FeudumGameState)

/** A table whose turn player's current card has just left these follow-ups. */
function tableWith(
    followUps: readonly FollowUp[],
    edit?: (state: HydratedFeudumGameState, playerId: string) => void
): { table: Table; playerId: string } {
    const table = tableAtPlayingCards()
    const playerId = table.order[0]
    table.moveTo((state, context) => {
        edit?.(state, playerId)
        for (const followUp of followUps) {
            queueFollowUp(state, followUp)
        }
        return stateAfterCardStep(context)
    })
    return { table, playerId }
}

function voyageAt(space: number | undefined) {
    return tableWith([{ kind: 'voyage' }], (state, playerId) => {
        if (space !== undefined) {
            state.voyageTrack[playerId] = `track.voyage.${space}`
        }
    })
}

function reeve(guildId: 'farmer' | 'knight' | 'monk' = 'farmer') {
    return tableWith([{ kind: 'reeve', guildId }])
}

describe('PlaceDisc: the follow-up', () => {
    it('R-4.7 asks only the follow-up’s player, in PlacingDisc', () => {
        const { table, playerId } = reeve()
        expect(table.state.machineState).toBe(MachineState.PlacingDisc)
        expect(table.asked).toBe(playerId)
        expect(table.offered(playerId)).toEqual([ActionType.PlaceDisc])
        expect(table.offered(table.order[1])).toEqual([])
    })

    it('R-4.7 a seat not asked is refused by the rule, with the reason', () => {
        const { table } = reeve()
        expect(reasonPlaceDiscRefused(table.hydrated(), table.order[1], true)).toBe(
            'No disc is offered to you.'
        )
    })

    it('R-4.7 declining keeps the disc and moves on', () => {
        const { table, playerId } = reeve()
        const freeBefore = table.hydrated().freeDiscs(playerId)
        const [action] = table.send(playerId, { type: ActionType.PlaceDisc, place: false })
        expect(action).toMatchObject({
            place: false,
            metadata: { disc: 'reeve', guildId: 'farmer' }
        })
        expect(action.revealsInfo).toBeFalsy()
        expect(table.hydrated().freeDiscs(playerId)).toBe(freeBefore)
        expect(table.hydrated().guilds.tracks.farmer.master?.reeve).toBe(false)
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).toBe(table.order[1])
    })

    it('R-3.2, R-4.7 runs the follow-ups in order, and a disc spent on the first lapses the next', () => {
        const { table, playerId } = tableWith(
            [{ kind: 'military' }, { kind: 'reeve', guildId: 'farmer' }],
            (state, id) => {
                state.voyageTrack[id] = 'track.voyage.1'
                state.militaryService[id] = 'track.military.1'
            }
        )
        expect(table.hydrated().freeDiscs(playerId)).toBe(1)
        table.send(playerId, { type: ActionType.PlaceDisc, place: true })
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).toBe(table.order[1])
        expect(table.state.flow.turn?.followUps).toEqual([])
    })

    it('R-3.2, R-4.7 a follow-up left after a decline runs next, the same disc still free', () => {
        const { table, playerId } = tableWith([
            { kind: 'military' },
            { kind: 'reeve', guildId: 'farmer' }
        ])
        const [declined] = table.send(playerId, { type: ActionType.PlaceDisc, place: false })
        expect(declined).toMatchObject({ metadata: { disc: 'reeve', guildId: 'farmer' } })
        expect(table.state.machineState).toBe(MachineState.PlacingDisc)
        expect(placeDiscOffer(table.hydrated(), playerId)).toMatchObject({
            disc: 'military',
            space: 'track.military.1'
        })
    })

    it('R-X.2 is registered in the API schemas and the hydrator', () => {
        expect(FeudumApiActions[ActionType.PlaceDisc]).toBe(PlaceDisc)
        const { table, playerId } = reeve()
        const [action] = table.send(playerId, { type: ActionType.PlaceDisc, place: true })
        expect(new FeudumHydrator().hydrateAction(action)).toBeInstanceOf(HydratedPlaceDisc)
    })
})

describe('PlaceDisc: a reeve', () => {
    it('R-4.7 sits on the seat’s marker, takes a free disc and is no barrier', () => {
        const { table, playerId } = reeve()
        const [action] = table.send(playerId, { type: ActionType.PlaceDisc, place: true })

        const state = table.hydrated()
        expect(state.guilds.tracks.farmer.master).toEqual({ playerId, reeve: true })
        expect(state.freeDiscs(playerId)).toBe(2)
        expect(action).toMatchObject({ metadata: { disc: 'reeve', guildId: 'farmer' } })
        expect(action.revealsInfo).toBeFalsy()
        expect(table.asked).toBe(table.order[1])
    })

    it('R-4.7 is not offered where the seat already has one', () => {
        const { table } = tableWith([{ kind: 'reeve', guildId: 'farmer' }], (state, id) => {
            state.guilds.tracks.farmer.master = { playerId: id, reeve: true }
        })
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).toBe(table.order[1])
        expect(table.state.flow.turn?.followUps).toEqual([])
    })

    it('R-4.7 is refused where the seat has one, with the reason', () => {
        const { table, playerId } = reeve()
        const state = table.hydrated()
        state.guilds.tracks.farmer.master = { playerId, reeve: true }
        expect(reasonPlaceDiscRefused(state, playerId, true)).toBe(
            'You already have a reeve in that guild.'
        )
        // Keeping the disc is always legal.
        expect(reasonPlaceDiscRefused(state, playerId, false)).toBeUndefined()
    })

    it('R-4.7 at most 2, with the reason', () => {
        const { table, playerId } = reeve()
        const state = table.hydrated()
        state.guilds.tracks.knight.master = { playerId, reeve: true }
        state.guilds.tracks.monk.master = { playerId, reeve: true }
        expect(reasonPlaceDiscRefused(state, playerId, true)).toBe('You already have 2 reeves.')
    })

    it('R-4.7 needs the seat’s marker on master or journeyman, with the reason', () => {
        const { table } = reeve('knight')
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        const playerId = table.asked
        const state = table.hydrated()
        state.flow.turn?.followUps.push({ kind: 'reeve', guildId: 'knight' })
        expect(reasonPlaceDiscRefused(state, playerId, true)).toBe(
            'You hold no rank a reeve can follow there.'
        )
        // R-4.7 A reeve returns from apprentice, so one can't be placed there.
        state.guilds.tracks.knight.apprentice = { playerId, reeve: false }
        expect(reasonPlaceDiscRefused(state, playerId, true)).toBe(
            'You hold no rank a reeve can follow there.'
        )
    })

    it('R-1.1 is not offered with no free disc', () => {
        const { table } = tableWith([{ kind: 'reeve', guildId: 'farmer' }], (state, id) => {
            state.militaryService[id] = 'track.military.3'
        })
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).toBe(table.order[1])
    })
})

describe('PlaceDisc: the epic voyage', () => {
    it('R-3.7.5 onto space 1 takes a free disc and draws nothing', () => {
        const { table, playerId } = voyageAt(undefined)
        const deck = writDeckCount(table.hydrated())
        expect(placeDiscOffer(table.hydrated(), playerId)).toEqual({
            disc: 'voyage',
            space: 'track.voyage.1',
            advances: false,
            draw: 0,
            revealsInfo: false
        })

        const [action] = table.send(playerId, { type: ActionType.PlaceDisc, place: true })

        const state = table.hydrated()
        expect(state.voyageTrack[playerId]).toBe('track.voyage.1')
        expect(state.freeDiscs(playerId)).toBe(2)
        expect(writDeckCount(state)).toBe(deck)
        expect(state.flow.writDraw).toBeUndefined()
        expect(action).toMatchObject({ metadata: { disc: 'voyage', space: 'track.voyage.1' } })
        expect(action.revealsInfo).toBeFalsy()
        expect(table.asked).toBe(table.order[1])
    })

    it('R-3.7-H1 on one space advances the disc, needing no free disc', () => {
        const { table, playerId } = tableWith([{ kind: 'voyage' }], (state, id) => {
            state.voyageTrack[id] = 'track.voyage.2'
            state.militaryService[id] = 'track.military.2'
        })
        expect(table.hydrated().freeDiscs(playerId)).toBe(0)
        expect(table.state.machineState).toBe(MachineState.PlacingDisc)
        const [action] = table.send(playerId, { type: ActionType.PlaceDisc, place: true })
        expect(table.hydrated().voyageTrack[playerId]).toBe('track.voyage.3')
        expect(table.hydrated().freeDiscs(playerId)).toBe(0)
        expect(action).toMatchObject({ metadata: { disc: 'voyage', space: 'track.voyage.3' } })
    })

    it('R-3.7.5 is not offered to start with no free disc', () => {
        const { table } = tableWith([{ kind: 'voyage' }], (state, id) => {
            state.militaryService[id] = 'track.military.3'
        })
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).toBe(table.order[1])
    })

    it('R-3.7.5 is not offered past the monastery', () => {
        const { table, playerId } = voyageAt(7)
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.hydrated().voyageTrack[playerId]).toBe('track.voyage.7')
    })

    it.each([2, 4, 6])(
        'R-3.7.5, R-X.2 stepping onto %i draws 2 writs to keep 1, a barrier',
        (space) => {
            const { table, playerId } = voyageAt(space - 1)
            const deck = writDeckCount(table.hydrated())
            expect(placeDiscOffer(table.hydrated(), playerId)).toEqual({
                disc: 'voyage',
                space: `track.voyage.${space}`,
                advances: true,
                draw: 2,
                revealsInfo: true
            })

            const [action] = table.send(playerId, { type: ActionType.PlaceDisc, place: true })

            expect(action.revealsInfo).toBe(true)
            expect(action).toMatchObject({
                metadata: { disc: 'voyage', space: `track.voyage.${space}`, drawnCount: 2 }
            })
            const state = table.hydrated()
            expect(state.voyageTrack[playerId]).toBe(`track.voyage.${space}`)
            expect(writDeckCount(state)).toBe(deck - 2)
            expect(state.flow.writDraw).toEqual({
                drawnCount: 2,
                keep: 1,
                source: 'voyage',
                shovelsOffered: false
            })
            expect(drawnWrits(state)).toHaveLength(2)
            // R-3.7.5 The drawer's log names the writs; the state's record is the same two.
            expect(action).toMatchObject({
                metadata: { drawnWritIds: drawnWrits(state) }
            })
            // The keep comes next, asked of the drawer.
            expect(state.flow.turn?.followUps).toEqual([{ kind: 'keep-writs' }])
            expect(table.state.machineState).toBe(MachineState.KeepingWrits)
            expect(table.asked).toBe(playerId)
        }
    )

    it.each([1, 3, 5])('R-3.7.5, R-X.2 stepping onto %i is no barrier', (space) => {
        const { table, playerId } = voyageAt(space === 1 ? undefined : space - 1)
        const [action] = table.send(playerId, { type: ActionType.PlaceDisc, place: true })
        expect(action.revealsInfo).toBeFalsy()
        expect(table.hydrated().flow.writDraw).toBeUndefined()
    })

    it('R-X.2 declining a step that would draw is no barrier and draws nothing', () => {
        const { table, playerId } = voyageAt(1)
        const deck = writDeckCount(table.hydrated())
        const [action] = table.send(playerId, { type: ActionType.PlaceDisc, place: false })
        expect(action.revealsInfo).toBeFalsy()
        expect(table.hydrated().voyageTrack[playerId]).toBe('track.voyage.1')
        expect(writDeckCount(table.hydrated())).toBe(deck)
        expect(table.asked).toBe(table.order[1])
    })

    it('R-5.1 the drawn writs are the drawer’s, the count is public', () => {
        const { table, playerId } = voyageAt(1)
        table.send(playerId, { type: ActionType.PlaceDisc, place: true })
        const other = projector.project(
            canonicalOf(table.hydrated()),
            { kind: 'player', playerId: table.order[1] },
            { config: {} }
        )
        expect(other.flow.writDraw?.drawnCount).toBe(2)
        expect(drawnWrits(other)).toBeUndefined()
        const own = projector.project(
            canonicalOf(table.hydrated()),
            { kind: 'player', playerId },
            { config: {} }
        )
        expect(drawnWrits(own)).toHaveLength(2)
    })

    it('R-4.4-H2 a deck of one draws it and keeps it; the count says so', () => {
        const { table, playerId } = voyageAt(1)
        table.moveTo((state) => {
            shortenDeckTo(state, 1)
            return state.machineState
        })
        expect(placeDiscOffer(table.hydrated(), playerId)).toMatchObject({
            draw: 1,
            revealsInfo: true
        })
        const [action] = table.send(playerId, { type: ActionType.PlaceDisc, place: true })
        expect(action).toMatchObject({ metadata: { drawnCount: 1 } })
        expect(action.revealsInfo).toBe(true)
        expect(table.hydrated().flow.writDraw).toMatchObject({ drawnCount: 1, keep: 1 })
        expect(table.state.machineState).toBe(MachineState.KeepingWrits)
    })

    it('R-4.4-H2 an empty deck draws nothing: no keep, no barrier, the disc still steps', () => {
        const { table, playerId } = voyageAt(1)
        table.moveTo((state) => {
            shortenDeckTo(state, 0)
            return state.machineState
        })
        expect(placeDiscOffer(table.hydrated(), playerId)).toMatchObject({
            advances: true,
            draw: 0,
            revealsInfo: false
        })
        const [action] = table.send(playerId, { type: ActionType.PlaceDisc, place: true })
        expect(action).toMatchObject({
            metadata: { disc: 'voyage', space: 'track.voyage.2', drawnCount: 0 }
        })
        expect(action.revealsInfo).toBeFalsy()
        expect(table.hydrated().voyageTrack[playerId]).toBe('track.voyage.2')
        expect(table.hydrated().flow.writDraw).toBeUndefined()
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
    })

    it('R-3.7.5 the keep precedes the card’s other follow-ups', () => {
        const { table, playerId } = tableWith(
            [{ kind: 'voyage' }, { kind: 'military' }],
            (state, id) => {
                state.voyageTrack[id] = 'track.voyage.1'
            }
        )
        table.send(playerId, { type: ActionType.PlaceDisc, place: true })
        expect(table.state.machineState).toBe(MachineState.KeepingWrits)
        expect(table.hydrated().flow.turn?.followUps).toEqual(
            expect.arrayContaining([{ kind: 'keep-writs' }, { kind: 'military' }])
        )
        expect(drawnWrits(canonicalOf(table.hydrated()))).toHaveLength(2)
    })
})

/** R-5.1 Writs leave the deck as a draw would, for specs of a short deck. */
function shortenDeckTo(state: HydratedFeudumGameState, count: number) {
    const vault = state.requireVault()
    const removed = vault.writDeck.length - count
    vault.writDeck.splice(0, removed)
    state.writDeck.top += removed
}

import { describe, expect, it } from 'vitest'
import { LocationDiscs, type DiscFace } from '../data/discs.js'
import { KnightRowIds } from '../data/guilds.js'
import { MachineState } from '../definition/states.js'
import { stateAfterCardStep } from '../stateHandlers/cardTurns.js'
import { initialState } from '../testing/state.js'
import { tableAtPlayingCards } from '../testing/table.js'
import { queueFollowUp } from './followUps.js'
import { FeudumGameStateValidator } from './gameState.js'
import { replaceLocationDisc } from './locationDiscs.js'

describe('the epoch marker names its sunray by id', () => {
    it('R-2.1 the game starts on the first sunray', () => {
        expect(initialState().epoch).toBe('track.epoch.i')
    })

    it('R-4.11 the epoch and a triggered epoch are sunray ids, never printed numbers', () => {
        const state = initialState().dehydrate()
        expect(FeudumGameStateValidator.Check({ ...state, epoch: 'track.epoch.iii' })).toBe(true)
        expect(FeudumGameStateValidator.Check({ ...state, epoch: 3 })).toBe(false)
        expect(
            FeudumGameStateValidator.Check({ ...state, flow: { epochTriggered: 'track.epoch.ii' } })
        ).toBe(true)
        expect(FeudumGameStateValidator.Check({ ...state, flow: { epochTriggered: 2 } })).toBe(
            false
        )
    })
})

describe('a location holds its disc, and the face of a double-sided one', () => {
    it('R-1.4.3 a starting disc is held by its id alone', () => {
        for (const space of Object.values(initialState().spaces)) {
            expect(Object.keys(space.location)).toEqual(['discId'])
        }
    })

    it('R-3.9.1 a double-sided disc keeps the face it shows', () => {
        const state = initialState()
        const disc = LocationDiscs.find(
            (candidate) =>
                candidate.id.startsWith('disc.double.') && state.supply.discs.includes(candidate.id)
        )
        if (!disc || !('faces' in disc)) {
            throw Error('a double-sided disc in the supply')
        }
        const face: DiscFace = 'b'
        const [spaceId] = Object.keys(state.spaces) as (keyof typeof state.spaces)[]
        replaceLocationDisc(state, spaceId, disc.id, disc.faces[face])
        expect(state.spaces[spaceId].location).toEqual(
            disc.faces.a === disc.faces.b
                ? { discId: disc.id, face: 'a' }
                : { discId: disc.id, face }
        )
    })

    it('R-4.1 the state takes no kind beside the disc', () => {
        const state = initialState().dehydrate()
        const [spaceId] = Object.keys(state.spaces) as (keyof typeof state.spaces)[]
        const space = state.spaces[spaceId]
        const withKind = { ...space, location: { ...space.location, kind: 'farm' } }
        expect(
            FeudumGameStateValidator.Check({
                ...state,
                spaces: { ...state.spaces, [spaceId]: withKind }
            })
        ).toBe(false)
    })
})

describe('a dummy Knight row is known by its row id', () => {
    it('R-1.4-H1 the owner is a dummy, and its markers are counted under the row id', () => {
        const state = initialState(2)
        const dummyRows = KnightRowIds.slice(2, 4)
        expect(dummyRows.map((rowId) => state.guilds.knight.rows[rowId]?.owner)).toEqual([
            { dummy: true },
            { dummy: true }
        ])
        expect(Object.keys(state.supply.dummyInfluence).sort()).toEqual([...dummyRows].sort())
    })
})

describe('the seats still nourishing are kept in no order', () => {
    it('R-4.10-H4 the turn manager orders the seats asked', () => {
        const table = tableAtPlayingCards()
        const { order } = table
        table.moveTo((state) => {
            state.flow.turn = undefined
            state.flow.nourish = { pending: [...order].reverse() }
            return MachineState.Nourishing
        })
        expect(table.state.activePlayerIds).toEqual(order)
    })
})

describe('a follow-up names no seat', () => {
    it('R-3.2, R-4.9.1 the turn manager names who decides it', () => {
        const table = tableAtPlayingCards()
        const playerId = table.asked
        table.moveTo((state, context) => {
            queueFollowUp(state, { kind: 'military' })
            return stateAfterCardStep(context)
        })
        expect(table.state.machineState).toBe(MachineState.PlacingDisc)
        expect(table.state.activePlayerIds).toEqual([playerId])
        expect(table.state.flow.turn?.followUps).toEqual([{ kind: 'military' }])
    })

    it('R-3.2 the state takes no seat on a follow-up', () => {
        const table = tableAtPlayingCards()
        const { state } = table
        const turn = { secondCard: false, followUps: [{ kind: 'military', playerId: table.asked }] }
        expect(FeudumGameStateValidator.Check({ ...state, flow: { turn } })).toBe(false)
    })
})

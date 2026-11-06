import { Visibility } from '@tabletop/common'
import { beforeAll, describe, expect, it } from 'vitest'
import { ActionType } from '../definition/actions.js'
import { FeudumApiActions } from '../definition/apiActions.js'
import { MachineState } from '../definition/states.js'
import { setBeads, setJourneyman, tableAtGuild } from '../testing/guilds.js'
import { readDoc } from '../testing/docs.js'
import { guildActionPreview } from '../actions/guildAction.js'
import { beadValue, chickenBeadSum, hiddenBeadCandidates, hiddenBeadDraw } from './beads.js'

const FarmerPull = {
    type: ActionType.GuildAction,
    guildId: 'farmer',
    fn: 'pull',
    params: {}
} as const

describe('R-4.6-H2 the hidden-bead draw', () => {
    let deviations = ''
    beforeAll(async () => {
        deviations = await readDoc('known-deviations.md')
    })

    it('R-4.6-H2 is recorded as a known deviation', () => {
        expect(deviations).toContain('**R-4.6.3, R-4.6.4 The hidden-bead draw:**')
        expect(deviations).toContain('Governs: R-4.6-H2.')
    })

    it('R-4.6-H2 the candidates are the highest and the lowest bead', () => {
        const { table } = tableAtGuild((state) =>
            setBeads(state, { rosary: [3, 2, 5, 3], chickens: [] })
        )
        const state = table.hydrated()
        const candidates = hiddenBeadCandidates(state)
        expect(candidates && beadValue(candidates.high)).toBe(5)
        expect(candidates && beadValue(candidates.low)).toBe(2)
    })

    it('R-4.6-H2 equal beads are still two beads', () => {
        const { table } = tableAtGuild((state) => setBeads(state, { rosary: [2, 2], chickens: [] }))
        const candidates = hiddenBeadCandidates(table.hydrated())
        expect(candidates?.high).not.toBe(candidates?.low)
        expect(candidates && beadValue(candidates.high)).toBe(2)
    })

    it('R-4.6-H2 needs two beads on the rosary', () => {
        const { table } = tableAtGuild((state) => setBeads(state, { rosary: [4], chickens: [] }))
        expect(hiddenBeadCandidates(table.hydrated())).toBeUndefined()
    })

    it('R-4.6-H2 picks either at random, on the protected stream, moving nothing', () => {
        const { table } = tableAtGuild((state) =>
            setBeads(state, { rosary: [2, 3, 5], chickens: [] })
        )
        const state = table.hydrated()
        const rosary = [...state.guilds.monk.rosary]
        const before = state.protectedPrng?.invocations ?? 0
        const values = new Set(
            Array.from({ length: 40 }, () => beadValue(hiddenBeadDraw(state).bead))
        )
        expect(values).toEqual(new Set([2, 5]))
        expect(state.protectedPrng?.invocations).toBe(before + 40)
        expect(state.guilds.monk.rosary).toEqual(rosary)
    })
})

describe('GuildAction: R-4.6.4 the Farmer pull', () => {
    it('R-4.6.4, R-4.6-H2 one candidate goes onto the first empty chicken, a barrier', () => {
        const { table, playerId } = tableAtGuild((state, seat, rest) => {
            setJourneyman(state, seat, 'farmer', rest[0])
            setBeads(state, { rosary: [2, 2, 3], chickens: [] })
        })
        const rosary = [...table.hydrated().guilds.monk.rosary]
        const [action] = table.send(playerId, FarmerPull)
        expect(action.revealsInfo).toBe(true)
        const state = table.hydrated()
        const [bead] = state.guilds.farmer.chickens
        expect(bead).not.toBeNull()
        expect(state.guilds.monk.rosary.length).toBe(2)
        expect(rosary).toContain(bead)
        expect(action).toMatchObject({
            metadata: {
                completions: 0,
                points: 0,
                reevePoints: 0,
                reeveOffered: false,
                details: {
                    kind: 'farmer-pull',
                    high: rosary[2],
                    low: rosary[0],
                    bead,
                    chicken: 0,
                    chickenSum: chickenBeadSum(state)
                }
            }
        })
    })

    it('R-4.6.4 below the threshold it scores nothing and draws no writ', () => {
        const { table, playerId } = tableAtGuild((state, seat, rest) => {
            setJourneyman(state, seat, 'farmer', rest[0])
            setBeads(state, { rosary: [2, 2], chickens: [2] })
        })
        const score = table.seat(playerId).score
        const [action] = table.send(playerId, FarmerPull)
        expect(chickenBeadSum(table.hydrated())).toBe(4)
        expect(table.seat(playerId).score).toBe(score)
        expect(action).toMatchObject({ metadata: { completions: 0, points: 0 } })
        expect(table.hydrated().flow.writDraw).toBeUndefined()
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
    })

    it('R-4.6.4 reaching 5 scores 3 vp and draws 2 writs to keep 1, a barrier', () => {
        const { table, playerId } = tableAtGuild((state, seat, rest) => {
            setJourneyman(state, seat, 'farmer', rest[0])
            setBeads(state, { rosary: [2, 3], chickens: [3] })
        })
        const score = table.seat(playerId).score
        const [action] = table.send(playerId, FarmerPull)
        expect(action.revealsInfo).toBe(true)
        expect(chickenBeadSum(table.hydrated())).toBeGreaterThanOrEqual(5)
        expect(table.seat(playerId).score).toBe(score + 3)
        expect(action).toMatchObject({
            metadata: {
                completions: 1,
                points: 3,
                drawnCount: 2,
                keep: 1,
                drawnWritIds: table.hydrated().flow.writDraw?.drawn
            }
        })
        expect(table.hydrated().flow.writDraw).toMatchObject({
            playerId,
            drawnCount: 2,
            keep: 1,
            source: 'pull'
        })
        expect(table.state.machineState).toBe(MachineState.KeepingWrits)
    })

    it('R-4.4-H2, R-4.6.4 the writs drawn reach only the actor; the table sees the count', () => {
        const { table, playerId, others } = tableAtGuild((state, seat, rest) => {
            setJourneyman(state, seat, 'farmer', rest[0])
            setBeads(state, { rosary: [2, 3], chickens: [3] })
        })
        const [action] = table.send(playerId, FarmerPull)
        const drawn = table.hydrated().flow.writDraw?.drawn ?? []
        expect(drawn.length).toBe(2)
        const projector = Visibility.createActionProjector(FeudumApiActions)
        const mine = projector.project(action, { kind: 'player', playerId }, { config: {} })
        expect(mine).toMatchObject({ metadata: { drawnWritIds: drawn } })
        const theirs = projector.project(
            action,
            { kind: 'player', playerId: others[0] },
            { config: {} }
        )
        expect(theirs).toMatchObject({ metadata: { drawnCount: 2, keep: 1 } })
        for (const writ of drawn) {
            expect(JSON.stringify(theirs)).not.toContain(writ)
        }
    })

    it('R-4.6.4 refuses with too few beads on the rosary', () => {
        const { table, playerId } = tableAtGuild((state, seat, rest) => {
            setJourneyman(state, seat, 'farmer', rest[0])
            setBeads(state, { rosary: [4], chickens: [] })
        })
        expect(() => table.send(playerId, FarmerPull)).toThrow('The rosary needs at least 2 beads.')
    })

    it('R-4.6.4 refuses with no empty chicken', () => {
        const { table, playerId } = tableAtGuild((state, seat, rest) => {
            setJourneyman(state, seat, 'farmer', rest[0])
            setBeads(state, { rosary: [2, 3], chickens: [2, 2, 2, 2] })
        })
        expect(() => table.send(playerId, FarmerPull)).toThrow('No chicken is empty.')
    })

    it('R-4.6.4, R-4.6-H2 the preview gives both candidates and what each would score', () => {
        const { table, playerId } = tableAtGuild((state, seat, rest) => {
            setJourneyman(state, seat, 'farmer', rest[0])
            setBeads(state, { rosary: [2, 3], chickens: [2] })
        })
        const state = table.hydrated()
        const preview = guildActionPreview(state, playerId, {
            guildId: 'farmer',
            fn: 'pull',
            params: {}
        })
        const [low, high] = state.guilds.monk.rosary
        expect(preview).toMatchObject({
            revealsInfo: true,
            completions: 1,
            points: 3,
            drawnCount: 2,
            beadDraw: { high, low, ifLow: { completions: 0, points: 0, drawnCount: 0 } }
        })
    })
})

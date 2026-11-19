import { describe, expect, it } from 'vitest'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import {
    setBarn,
    setBeads,
    setJourneyman,
    setMarket,
    setMaster,
    setPawns,
    tableAtGuild
} from '../testing/guilds.js'
import { guildActionPreview } from './guildAction.js'

const FarmerPush = { type: ActionType.GuildAction, guildId: 'farmer', fn: 'push' } as const
const ScoringPush = { ...FarmerPush, params: { goods: ['wood'] } }

/** One wood completes the wood bin. */
function oneWoodScores(state: HydratedFeudumGameState): void {
    setMarket(state, { wood: 3 })
    setBarn(state, { wood: 1 })
}

describe('R-4.7, R-4.7-H1 reeves on every push and pull', () => {
    it('R-4.7 a scoring push offers a reeve, with nothing scored for it until placed', () => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setMaster(state, seat, 'farmer')
            oneWoodScores(state)
        })
        const score = table.seat(playerId).score
        const [action] = table.send(playerId, ScoringPush)
        expect(action).toMatchObject({
            metadata: { points: 4, reevePoints: 0, reeveOffered: true }
        })
        expect(table.seat(playerId).score).toBe(score + 4)
        expect(table.state.machineState).toBe(MachineState.PlacingDisc)
        expect(table.asked).toBe(playerId)
        expect(table.offered(playerId)).toContain(ActionType.PlaceDisc)
    })

    it('R-4.7 placing the reeve scores +1', () => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setMaster(state, seat, 'farmer')
            oneWoodScores(state)
        })
        table.send(playerId, ScoringPush)
        const score = table.seat(playerId).score
        const [action] = table.send(playerId, { type: ActionType.PlaceDisc, place: true })
        expect(action).toMatchObject({
            metadata: { disc: 'reeve', guildId: 'farmer', reevePoints: 1 }
        })
        expect(table.seat(playerId).score).toBe(score + 1)
        expect(table.hydrated().guilds.tracks.farmer.master?.reeve).toBe(true)
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
    })

    it('R-4.7 keeping the disc scores nothing', () => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setMaster(state, seat, 'farmer')
            oneWoodScores(state)
        })
        table.send(playerId, ScoringPush)
        const score = table.seat(playerId).score
        const [action] = table.send(playerId, { type: ActionType.PlaceDisc, place: false })
        expect(table.seat(playerId).score).toBe(score)
        expect(action).toMatchObject({ metadata: { disc: 'reeve' } })
        expect(table.hydrated().guilds.tracks.farmer.master?.reeve).toBe(false)
    })

    it('R-4.7 placing with the other reeve elsewhere scores +2', () => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setPawns(state, seat, ['farmer', 'farmer', 'monk'])
            state.recomputeRanks(seat)
            const { monk } = state.guilds.tracks
            if (monk.master) {
                monk.master.reeve = true
            }
            oneWoodScores(state)
        })
        expect(table.hydrated().guilds.tracks.monk.master?.playerId).toBe(playerId)
        expect(table.hydrated().guilds.tracks.farmer.master?.playerId).toBe(playerId)
        table.send(playerId, ScoringPush)
        const score = table.seat(playerId).score
        const [action] = table.send(playerId, { type: ActionType.PlaceDisc, place: true })
        expect(action).toMatchObject({ metadata: { reevePoints: 2 } })
        expect(table.seat(playerId).score).toBe(score + 2)
    })

    it('R-4.7 a reeve already there scores again with no question asked', () => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setMaster(state, seat, 'farmer')
            const { master } = state.guilds.tracks.farmer
            if (master) {
                master.reeve = true
            }
            oneWoodScores(state)
        })
        const score = table.seat(playerId).score
        const [action] = table.send(playerId, ScoringPush)
        expect(action).toMatchObject({
            metadata: { points: 4, reevePoints: 1, reeveOffered: false }
        })
        expect(table.seat(playerId).score).toBe(score + 5)
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
    })

    it('R-4.7 a reeve here and another elsewhere score +2 on every scoring function', () => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setPawns(state, seat, ['farmer', 'farmer', 'monk'])
            state.recomputeRanks(seat)
            const { farmer, monk } = state.guilds.tracks
            if (farmer.master && monk.master) {
                farmer.master.reeve = true
                monk.master.reeve = true
            }
            oneWoodScores(state)
        })
        const score = table.seat(playerId).score
        const [action] = table.send(playerId, ScoringPush)
        expect(action).toMatchObject({ metadata: { points: 4, reevePoints: 2 } })
        expect(table.seat(playerId).score).toBe(score + 6)
    })

    it('R-4.7-H1 a push below a threshold scores the reeve there, with no points and the split', () => {
        const { table, playerId, others } = tableAtGuild((state, seat, rest) => {
            setJourneyman(state, rest[0], 'farmer', seat)
            const { master } = state.guilds.tracks.farmer
            if (master) {
                master.reeve = true
            }
            setMarket(state, { wood: 1 })
            setBarn(state, { wood: 1 })
            state.supply.shillings -= 4
            state.guilds.farmer.purse = 4
        })
        const score = table.seat(playerId).score
        const master = table.seat(playerId).shillings
        const journeyman = table.seat(others[0]).shillings
        const [action] = table.send(playerId, ScoringPush)
        expect(action).toMatchObject({
            metadata: { completions: 0, points: 0, reevePoints: 1, reeveOffered: false }
        })
        expect(table.seat(playerId).score).toBe(score + 1)
        expect(table.seat(playerId).shillings).toBe(master + 2)
        expect(table.seat(others[0]).shillings).toBe(journeyman + 2)
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
    })

    it('R-4.7-H1 a push below a threshold with no reeve there offers one', () => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setMaster(state, seat, 'farmer')
            setMarket(state, { wood: 1 })
            setBarn(state, { wood: 1 })
        })
        const [action] = table.send(playerId, ScoringPush)
        expect(action).toMatchObject({
            metadata: { points: 0, reevePoints: 0, reeveOffered: true }
        })
        expect(table.state.machineState).toBe(MachineState.PlacingDisc)
        const score = table.seat(playerId).score
        const [placed] = table.send(playerId, { type: ActionType.PlaceDisc, place: true })
        expect(placed).toMatchObject({
            metadata: { disc: 'reeve', guildId: 'farmer', reevePoints: 1 }
        })
        expect(table.seat(playerId).score).toBe(score + 1)
    })

    it('R-4.7-H1 a pull below a threshold offers a reeve, and draws no writ', () => {
        const { table, playerId } = tableAtGuild((state, seat, rest) => {
            setJourneyman(state, seat, 'merchant', rest[0])
            setMarket(state, { iron: 1 })
            setBarn(state, { iron: 1 })
        })
        const [action] = table.send(playerId, {
            type: ActionType.GuildAction,
            guildId: 'merchant',
            fn: 'pull',
            params: { goods: ['iron'] }
        })
        expect(action).toMatchObject({
            metadata: { completions: 0, points: 0, reeveOffered: true, drawnWritIds: [] }
        })
        expect(table.hydrated().flow.turn?.followUps).toEqual([
            { kind: 'reeve', playerId, guildId: 'merchant' }
        ])
        expect(table.state.machineState).toBe(MachineState.PlacingDisc)
    })

    it('R-4.7 with no free disc no reeve is offered', () => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setMaster(state, seat, 'farmer')
            state.militaryService[seat] = 3
            oneWoodScores(state)
        })
        const [action] = table.send(playerId, ScoringPush)
        expect(action).toMatchObject({ metadata: { points: 4, reeveOffered: false } })
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
    })

    it('R-4.7, R-4.6.4 a scoring pull offers a reeve after the writ keep', () => {
        const { table, playerId } = tableAtGuild((state, seat, rest) => {
            setJourneyman(state, seat, 'farmer', rest[0])
            setBeads(state, { rosary: [2, 3], chickens: [3] })
        })
        const [action] = table.send(playerId, {
            type: ActionType.GuildAction,
            guildId: 'farmer',
            fn: 'pull',
            params: {}
        })
        expect(action).toMatchObject({ metadata: { points: 3, reeveOffered: true } })
        expect(table.hydrated().flow.turn?.followUps).toEqual([
            { kind: 'keep-writs', playerId },
            { kind: 'reeve', playerId, guildId: 'farmer' }
        ])
        expect(table.state.machineState).toBe(MachineState.KeepingWrits)
    })

    it('R-4.7 the preview gives the reeve points the seat would score', () => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setMaster(state, seat, 'farmer')
            oneWoodScores(state)
        })
        expect(
            guildActionPreview(table.hydrated(), playerId, {
                guildId: 'farmer',
                fn: 'push',
                params: { goods: ['wood'] }
            })
        ).toMatchObject({ points: 4, reevePoints: 1, reeveOffered: true })
    })

    it('R-4.7-H1 the preview gives the reeve points below a threshold too', () => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setMaster(state, seat, 'farmer')
            setMarket(state, { wood: 1 })
            setBarn(state, { wood: 1 })
        })
        expect(
            guildActionPreview(table.hydrated(), playerId, {
                guildId: 'farmer',
                fn: 'push',
                params: { goods: ['wood'] }
            })
        ).toMatchObject({ points: 0, reevePoints: 1, reeveOffered: true })
    })
})

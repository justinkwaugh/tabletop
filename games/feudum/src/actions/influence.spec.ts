import { describe, expect, it } from 'vitest'
import type { SpaceId } from '../data/board.js'
import { GuildById } from '../data/guilds.js'
import { ActionType } from '../definition/actions.js'
import { FeudumApiActions } from '../definition/apiActions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { tableAtPlayingCards, type Table } from '../testing/table.js'
import {
    influenceOffers,
    influencePreview,
    influenceSpaceIds,
    reasonInfluenceRefused
} from './influence.js'

/** Every seat's first pawn is a farmer on HOME from setup. */
const HOME: SpaceId = 'space.desert.3'
const SECOND: SpaceId = 'space.forest.1'
const THIRD: SpaceId = 'space.forest.3'

function tableWith(edit?: (state: HydratedFeudumGameState, playerId: string) => void): {
    table: Table
    playerId: string
} {
    const table = tableAtPlayingCards(() => ({ cards: ['influence', 'tax', 'guild'] }))
    const playerId = table.asked
    table.moveTo((state) => {
        edit?.(state, playerId)
        state.recomputeRanks()
        return MachineState.PlayingCards
    })
    return { table, playerId }
}

/** The seat's pawns 2 and 3 join the first. */
function standAt(
    state: HydratedFeudumGameState,
    playerId: string,
    ...spaceIds: readonly SpaceId[]
): void {
    const [, ...others] = state.getPlayerState(playerId).pawns
    spaceIds.forEach((spaceId, index) => {
        others[index].spaceId = spaceId
        others[index].character = 'farmer'
    })
}

/** The markers leave `playerId`'s own supply, so the totals hold. */
function rulerOf(
    state: HydratedFeudumGameState,
    playerId: string,
    spaceId: SpaceId,
    subject = false
): void {
    state.spaces[spaceId].ruler = { playerId, subject }
    state.getPlayerState(playerId).influenceSupply -= subject ? 2 : 1
}

function serfOf(state: HydratedFeudumGameState, playerId: string, spaceId: SpaceId): void {
    state.spaces[spaceId].serf = { playerId }
    state.getPlayerState(playerId).influenceSupply -= 1
}

/** Leaves the seat `count` markers, the rest back to the general supply. */
function markersLeft(state: HydratedFeudumGameState, playerId: string, count: number): void {
    const player = state.getPlayerState(playerId)
    state.supply.influence[player.color] += player.influenceSupply - count
    player.influenceSupply = count
}

function merchant(state: HydratedFeudumGameState, playerId: string): void {
    state.getPlayerState(playerId).pawns[0].character = 'merchant'
}

function opponentOf(table: Table, playerId: string): string {
    const opponent = table.order.find((id) => id !== playerId)
    if (!opponent) {
        throw Error('A table has an opponent')
    }
    return opponent
}

describe('Influence: R-3.8.1, R-4.1', () => {
    it('R-3.8.1 one marker per space holding the seat’s pawns, however many pawns', () => {
        const { table, playerId } = tableWith((state, id) => {
            standAt(state, id, HOME, SECOND)
        })
        const markers = table.seat(playerId).influenceSupply

        const [action] = table.send(playerId, { type: ActionType.Influence })

        expect(table.seat(playerId).influenceSupply).toBe(markers - 2)
        expect(table.state.spaces[HOME].ruler).toEqual({ playerId, subject: false })
        expect(table.state.spaces[SECOND].ruler).toEqual({ playerId, subject: false })
        expect(table.seat(playerId).played).toEqual([{ kind: 'influence', use: 'regular' }])
        expect(action).toMatchObject({
            metadata: {
                placements: expect.arrayContaining([
                    { spaceId: HOME, role: 'ruler' },
                    { spaceId: SECOND, role: 'ruler' }
                ])
            }
        })
        expect(action.revealsInfo).toBeFalsy()
    })

    it('R-3.8.1 a monster influences nothing', () => {
        const { table, playerId } = tableWith((state, id) => {
            state.monsters.behemoth = { playerId: id, spaceId: SECOND }
        })
        table.send(playerId, { type: ActionType.Influence })
        expect(table.state.spaces[SECOND].ruler).toBeUndefined()
    })

    it('R-4.1.2 a role by what stands there: serf, subject, and the serf’s takeover', () => {
        const { table, playerId } = tableWith((state, id) => {
            const rival = state.players.find((player) => player.playerId !== id)?.playerId ?? ''
            standAt(state, id, SECOND, THIRD)
            rulerOf(state, rival, HOME)
            rulerOf(state, id, SECOND)
            rulerOf(state, rival, THIRD)
            serfOf(state, id, THIRD)
        })
        const rival = opponentOf(table, playerId)

        const [action] = table.send(playerId, { type: ActionType.Influence })

        expect(table.state.spaces[HOME].serf).toEqual({ playerId })
        expect(table.state.spaces[SECOND].ruler).toEqual({ playerId, subject: true })
        expect(table.state.spaces[THIRD].ruler).toEqual({ playerId, subject: true })
        expect(table.state.spaces[THIRD].serf).toEqual({ playerId: rival })
        expect(action).toMatchObject({
            metadata: {
                placements: expect.arrayContaining([
                    { spaceId: HOME, role: 'serf' },
                    { spaceId: SECOND, role: 'subject' },
                    { spaceId: THIRD, role: 'ruler', displacedPlayerId: rival }
                ])
            }
        })
    })

    it('R-4.1.1 a space at its cap takes nothing and needs no choice', () => {
        const { table, playerId } = tableWith((state, id) => {
            standAt(state, id, SECOND)
            rulerOf(state, id, HOME, true)
        })
        expect(influenceSpaceIds(table.hydrated(), playerId)).toEqual([SECOND])
        const [action] = table.send(playerId, { type: ActionType.Influence })
        expect(action).toMatchObject({
            metadata: { placements: [{ spaceId: SECOND, role: 'ruler' }] }
        })
    })

    it('R-4.1.1 refuses when no space holding the seat’s pawns takes a marker', () => {
        const { table, playerId } = tableWith((state, id) => {
            rulerOf(state, id, HOME, true)
        })
        expect(reasonInfluenceRefused(table.hydrated(), playerId, {})).toBe(
            'None of your pawns stands where a marker can go.'
        )
        expect(() => table.send(playerId, { type: ActionType.Influence })).toThrow(
            'None of your pawns stands where a marker can go.'
        )
    })

    it('R-3.8.2, R-4.5.4 a ruled related location moves status at once, by the metadata', () => {
        const table = tableAtPlayingCards(() => ({ cards: ['influence', 'tax'] }))
        const [master, journeyman] = table.order
        table.moveTo((state) => {
            state.spaces[HOME].location.kind = GuildById.farmer.relatedLocation
            return MachineState.PlayingCards
        })
        table.send(master, { type: ActionType.ForfeitCard, kind: 'tax' })
        expect(table.state.guilds.tracks.farmer.journeyman?.playerId).toBe(journeyman)

        const [action] = table.send(journeyman, { type: ActionType.Influence })

        expect(table.state.guilds.tracks.farmer.master?.playerId).toBe(journeyman)
        expect(table.state.guilds.tracks.farmer.journeyman?.playerId).toBe(master)
        expect(action).toMatchObject({
            metadata: {
                placements: [{ spaceId: HOME, role: 'ruler' }],
                rankChanges: expect.arrayContaining([
                    { guildId: 'farmer', playerId: journeyman, from: 'journeyman', to: 'master' },
                    { guildId: 'farmer', playerId: master, from: 'master', to: 'journeyman' }
                ])
            }
        })
    })

    it('R-3.2 refuses a seat not on turn; is offered, and registered for the API', () => {
        const { table, playerId } = tableWith()
        expect(reasonInfluenceRefused(table.hydrated(), table.order[1], {})).toBe(
            "It isn't your turn."
        )
        expect(table.offered(playerId)).toContain(ActionType.Influence)
        expect(FeudumApiActions[ActionType.Influence]).toBeDefined()
    })
})

describe('Markers run short: R-1.1, R-3.8-H1', () => {
    const short = () =>
        tableWith((state, id) => {
            standAt(state, id, SECOND, THIRD)
            markersLeft(state, id, 2)
        })

    it('R-1.1 the seat names as many spaces as it has markers', () => {
        const { table, playerId } = short()
        const [action] = table.send(playerId, {
            type: ActionType.Influence,
            spaceIds: [HOME, THIRD]
        })
        expect(table.seat(playerId).influenceSupply).toBe(0)
        expect(table.state.spaces[SECOND].ruler).toBeUndefined()
        expect(action).toMatchObject({
            metadata: {
                placements: [
                    { spaceId: HOME, role: 'ruler' },
                    { spaceId: THIRD, role: 'ruler' }
                ]
            }
        })
    })

    it('R-X.1 the engine does not choose: without `spaceIds` it asks', () => {
        const { table, playerId } = short()
        expect(reasonInfluenceRefused(table.hydrated(), playerId, {})).toBe(
            'Your markers run short: choose 2 of 3 spaces.'
        )
    })

    it('R-3.8-H1 exactly that many, each once, each holding the seat’s pawn', () => {
        const { table, playerId } = short()
        const state = table.hydrated()
        const sentence = 'Your markers run short: choose exactly 2 of 3 spaces holding your pawns.'
        for (const spaceIds of [
            [HOME],
            [HOME, SECOND, THIRD],
            [HOME, HOME],
            [HOME, 'space.desert.1']
        ] satisfies SpaceId[][]) {
            expect(reasonInfluenceRefused(state, playerId, { spaceIds })).toBe(sentence)
        }
    })

    it('R-3.8 `spaceIds` only when markers run short', () => {
        const { table, playerId } = tableWith()
        expect(reasonInfluenceRefused(table.hydrated(), playerId, { spaceIds: [HOME] })).toBe(
            'You have a marker for every space: there is nothing to choose.'
        )
    })

    it('R-1.1 with no marker at all the card can only be forfeited', () => {
        const { table, playerId } = tableWith((state, id) => {
            markersLeft(state, id, 0)
        })
        expect(reasonInfluenceRefused(table.hydrated(), playerId, {})).toBe(
            'You have no influence markers in your supply.'
        )
        expect(influenceOffers(table.hydrated(), playerId)).toMatchObject({
            markers: 0,
            short: false
        })
    })

    it('R-3.8-H1 every marker goes down before status: a new rank then waits for a marker', () => {
        const { table, playerId } = tableWith((state, id) => {
            const { location } = state.spaces[HOME]
            location.kind = 'feudum'
            location.feudumGuild = 'noble'
            state.recomputeRanks()
            markersLeft(state, id, 1)
        })
        const [action] = table.send(playerId, { type: ActionType.Influence })
        expect(table.state.spaces[HOME].ruler?.playerId).toBe(playerId)
        expect(table.seat(playerId).influenceSupply).toBe(0)
        expect(table.state.guilds.tracks.noble.master).toBeUndefined()
        expect(action).toMatchObject({
            metadata: {
                placements: [{ spaceId: HOME, role: 'ruler' }],
                rankChanges: []
            }
        })
    })
})

describe('Money is Influence: R-3.8.3 (S10)', () => {
    /** An opponent's single marker rules HOME over the seat's Merchant. */
    const underLoneRuler = () =>
        tableWith((state, id) => {
            merchant(state, id)
            const rival = state.players.find((player) => player.playerId !== id)?.playerId ?? ''
            rulerOf(state, rival, HOME)
        })

    it('R-3.8.3 1 shilling to the general supply: their marker is serf, the seat’s rules', () => {
        const { table, playerId } = underLoneRuler()
        const rival = opponentOf(table, playerId)
        const { shillings, influenceSupply } = table.seat(playerId)
        const { shillings: inSupply } = table.state.supply

        const [action] = table.send(playerId, {
            type: ActionType.Influence,
            moneyIsInfluence: HOME
        })

        const seat = table.seat(playerId)
        expect(seat.shillings).toBe(shillings - 1)
        expect(table.state.supply.shillings).toBe(inSupply + 1)
        expect(seat.influenceSupply).toBe(influenceSupply - 1)
        expect(table.state.spaces[HOME].ruler).toEqual({ playerId, subject: false })
        expect(table.state.spaces[HOME].serf).toEqual({ playerId: rival })
        expect(seat.played).toEqual([{ kind: 'influence', use: 'special' }])
        expect(action).toMatchObject({
            moneyIsInfluence: HOME,
            metadata: { placements: [{ spaceId: HOME, role: 'ruler', displacedPlayerId: rival }] }
        })
        expect(action.revealsInfo).toBeFalsy()
    })

    it('R-3.8.2 without it the same marker is only the serf', () => {
        const { table, playerId } = underLoneRuler()
        const [action] = table.send(playerId, { type: ActionType.Influence })
        expect(table.state.spaces[HOME].serf).toEqual({ playerId })
        expect(action).toMatchObject({
            metadata: { placements: [{ spaceId: HOME, role: 'serf' }] }
        })
    })

    it('R-3.8.3 with the seat’s serf there, the serf becomes its subject', () => {
        const { table, playerId } = tableWith((state, id) => {
            merchant(state, id)
            const rival = state.players.find((player) => player.playerId !== id)?.playerId ?? ''
            rulerOf(state, rival, HOME)
            serfOf(state, id, HOME)
        })
        const rival = opponentOf(table, playerId)
        const { shillings } = table.seat(playerId)
        table.send(playerId, { type: ActionType.Influence, moneyIsInfluence: HOME })
        expect(table.state.spaces[HOME].ruler).toEqual({ playerId, subject: true })
        expect(table.state.spaces[HOME].serf).toEqual({ playerId: rival })
        expect(table.seat(playerId).shillings).toBe(shillings - 1)
    })

    it('R-4.5.4 the unseated ruler’s stars fall with the location', () => {
        const table = tableAtPlayingCards(() => ({ cards: ['influence', 'tax'] }))
        const [rival, seatId] = table.order
        table.moveTo((state) => {
            merchant(state, seatId)
            const { location } = state.spaces[HOME]
            location.kind = 'feudum'
            location.feudumGuild = 'noble'
            rulerOf(state, rival, HOME)
            state.recomputeRanks()
            return MachineState.PlayingCards
        })
        expect(table.state.guilds.tracks.noble.master?.playerId).toBe(rival)
        table.send(rival, { type: ActionType.ForfeitCard, kind: 'tax' })
        const [action] = table.send(seatId, {
            type: ActionType.Influence,
            moneyIsInfluence: HOME
        })
        expect(action).toMatchObject({
            metadata: {
                rankChanges: expect.arrayContaining([
                    { guildId: 'noble', playerId: seatId, to: 'master' },
                    { guildId: 'noble', playerId: rival, from: 'master' }
                ])
            }
        })
    })

    it('R-3.8.3 refuses without the Merchant at the location, with the reason', () => {
        const { table, playerId } = tableWith((state, id) => {
            const rival = state.players.find((player) => player.playerId !== id)?.playerId ?? ''
            rulerOf(state, rival, HOME)
        })
        expect(reasonInfluenceRefused(table.hydrated(), playerId, { moneyIsInfluence: HOME })).toBe(
            'Money is Influence needs a Merchant pawn at the location.'
        )
    })

    it('R-3.8.3 a Merchant elsewhere does not count', () => {
        const { table, playerId } = tableWith((state, id) => {
            const rival = state.players.find((player) => player.playerId !== id)?.playerId ?? ''
            const [, second] = state.getPlayerState(id).pawns
            second.spaceId = SECOND
            second.character = 'merchant'
            rulerOf(state, rival, HOME)
        })
        expect(reasonInfluenceRefused(table.hydrated(), playerId, { moneyIsInfluence: HOME })).toBe(
            'Money is Influence needs a Merchant pawn at the location.'
        )
    })

    it('R-3.8.3 refuses without a shilling, with the reason', () => {
        const { table, playerId } = tableWith((state, id) => {
            merchant(state, id)
            const rival = state.players.find((player) => player.playerId !== id)?.playerId ?? ''
            rulerOf(state, rival, HOME)
            state.supply.shillings += state.getPlayerState(id).shillings
            state.getPlayerState(id).shillings = 0
        })
        expect(reasonInfluenceRefused(table.hydrated(), playerId, { moneyIsInfluence: HOME })).toBe(
            'Money is Influence needs 1 shilling.'
        )
    })

    it('R-3.8.3 only under an opponent’s single marker', () => {
        const sentence = "Money is Influence needs a space ruled by an opponent's single marker."
        const bare = tableWith(merchant)
        expect(
            reasonInfluenceRefused(bare.table.hydrated(), bare.playerId, { moneyIsInfluence: HOME })
        ).toBe(sentence)

        const own = tableWith((state, id) => {
            merchant(state, id)
            rulerOf(state, id, HOME)
        })
        expect(
            reasonInfluenceRefused(own.table.hydrated(), own.playerId, { moneyIsInfluence: HOME })
        ).toBe(sentence)

        const doubled = tableWith((state, id) => {
            merchant(state, id)
            const rival = state.players.find((player) => player.playerId !== id)?.playerId ?? ''
            rulerOf(state, rival, HOME, true)
        })
        expect(
            reasonInfluenceRefused(doubled.table.hydrated(), doubled.playerId, {
                moneyIsInfluence: HOME
            })
        ).toBe(sentence)
    })

    it('R-4.1.1 not where two other players hold the space', () => {
        const { table, playerId } = tableWith((state, id) => {
            merchant(state, id)
            const [rival, third] = state.players
                .filter((player) => player.playerId !== id)
                .map((player) => player.playerId)
            rulerOf(state, rival, HOME)
            serfOf(state, third, HOME)
            standAt(state, id, SECOND)
        })
        expect(reasonInfluenceRefused(table.hydrated(), playerId, { moneyIsInfluence: HOME })).toBe(
            "That space already holds two players' markers."
        )
    })

    it('R-3.8.3, R-1.1 short of markers, the paid space must be one of those chosen', () => {
        const { table, playerId } = tableWith((state, id) => {
            merchant(state, id)
            const rival = state.players.find((player) => player.playerId !== id)?.playerId ?? ''
            rulerOf(state, rival, HOME)
            standAt(state, id, SECOND)
            state.recomputeRanks()
            markersLeft(state, id, 1)
        })
        expect(
            reasonInfluenceRefused(table.hydrated(), playerId, {
                spaceIds: [SECOND],
                moneyIsInfluence: HOME
            })
        ).toBe('Money is Influence needs a marker going there.')
        table.send(playerId, {
            type: ActionType.Influence,
            spaceIds: [HOME],
            moneyIsInfluence: HOME
        })
        expect(table.state.spaces[HOME].ruler?.playerId).toBe(playerId)
        expect(table.state.spaces[SECOND].ruler).toBeUndefined()
    })
})

describe('R-3.8 the offers and preview (S10)', () => {
    it('R-3.8.3 lights the Merchant’s space, not one a plain marker already takes', () => {
        const { table, playerId } = tableWith((state, id) => {
            merchant(state, id)
            const [rival, third] = state.players
                .filter((player) => player.playerId !== id)
                .map((player) => player.playerId)
            rulerOf(state, rival, HOME)
            const [, second] = state.getPlayerState(id).pawns
            second.spaceId = SECOND
            second.character = 'merchant'
            rulerOf(state, third, SECOND)
            serfOf(state, id, SECOND)
        })
        expect(influenceOffers(table.hydrated(), playerId)).toEqual({
            spaces: [SECOND, HOME],
            markers: 2,
            short: false,
            moneyIsInfluence: [HOME]
        })
    })

    it('R-3.8.1 no Money is Influence is lit without its need', () => {
        const { table, playerId } = tableWith()
        expect(influenceOffers(table.hydrated(), playerId)).toEqual({
            spaces: [HOME],
            markers: 1,
            short: false,
            moneyIsInfluence: []
        })
    })

    it('R-3.8.3 no Money is Influence is lit with no marker to put on top', () => {
        const { table, playerId } = tableWith((state, id) => {
            merchant(state, id)
            const rival = state.players.find((player) => player.playerId !== id)?.playerId ?? ''
            rulerOf(state, rival, HOME)
            markersLeft(state, id, 0)
        })
        expect(influenceOffers(table.hydrated(), playerId).moneyIsInfluence).toEqual([])
        expect(reasonInfluenceRefused(table.hydrated(), playerId, { moneyIsInfluence: HOME })).toBe(
            'You have no influence markers in your supply.'
        )
    })

    it('R-1.1 short: how many to pick, of which', () => {
        const { table, playerId } = tableWith((state, id) => {
            standAt(state, id, SECOND, THIRD)
            markersLeft(state, id, 2)
        })
        expect(influenceOffers(table.hydrated(), playerId)).toMatchObject({
            markers: 2,
            short: true
        })
    })

    it('R-3.8, R-4.5 the preview gives the press’s roles and ranks and changes nothing', () => {
        const { table, playerId } = tableWith(merchant)
        const before = JSON.stringify(table.state)
        expect(influencePreview(table.hydrated(), playerId)).toEqual({
            placements: [{ spaceId: HOME, role: 'ruler' }],
            rankChanges: []
        })
        expect(JSON.stringify(table.state)).toBe(before)
    })
})

describe('R-3.15.1 replayed by Repeat: the x2 on the real Action', () => {
    it('R-3.15.1 Repeat leaves the hand, Influence adds another marker: the subject', () => {
        const table = tableAtPlayingCards(() => ({ cards: ['influence', 'repeat', 'tax'] }), 2)
        const [first, second] = table.order
        table.send(first, { type: ActionType.Influence })
        expect(table.state.spaces[HOME].ruler).toEqual({ playerId: first, subject: false })
        table.send(second, { type: ActionType.ForfeitCard, kind: 'tax' })
        expect(table.seat(first).hand).toEqual(['repeat', 'tax'])
        expect(table.offered(first)).toContain(ActionType.Influence)
        const { influenceSupply } = table.seat(first)
        const { saltpeter } = table.seat(first).goods

        const [action] = table.send(first, { type: ActionType.Influence, asRepeat: 'repeat' })

        const seat = table.seat(first)
        expect(table.state.spaces[HOME].ruler).toEqual({ playerId: first, subject: true })
        expect(seat.influenceSupply).toBe(influenceSupply - 1)
        expect(seat.hand).toEqual(['tax'])
        expect(seat.handCount).toBe(1)
        expect(seat.repeatUsed).toBe(true)
        expect(seat.goods.saltpeter).toBe(saltpeter)
        expect(seat.played).toEqual([
            { kind: 'influence', use: 'regular' },
            { kind: 'repeat', use: 'regular', replayedKind: 'influence' }
        ])
        expect(action).toMatchObject({
            asRepeat: 'repeat',
            metadata: { placements: [{ spaceId: HOME, role: 'subject' }] }
        })
        expect(action.revealsInfo).toBeFalsy()
    })

    it('R-3.15.1 the replay can use the card’s special: its use is recorded', () => {
        const table = tableAtPlayingCards(() => ({ cards: ['influence', 'repeat', 'tax'] }), 2)
        const [first, second] = table.order
        table.moveTo((state) => {
            merchant(state, first)
            state.spaces[HOME].ruler = { playerId: second, subject: false }
            state.getPlayerState(second).influenceSupply -= 1
            return MachineState.PlayingCards
        })
        table.send(first, { type: ActionType.ForfeitCard, kind: 'influence' })
        table.send(second, { type: ActionType.ForfeitCard, kind: 'tax' })
        table.send(first, {
            type: ActionType.Influence,
            asRepeat: 'repeat',
            moneyIsInfluence: HOME
        })
        expect(table.seat(first).played.at(-1)).toEqual({
            kind: 'repeat',
            use: 'special',
            replayedKind: 'influence'
        })
    })

    it('R-3.15.1 a card not yet played refuses the replay, on the real Action', () => {
        const table = tableAtPlayingCards(() => ({ cards: ['influence', 'repeat', 'tax'] }), 2)
        expect(() =>
            table.send(table.asked, { type: ActionType.Influence, asRepeat: 'repeat' })
        ).toThrow("You haven't played Influence this round.")
    })

    it('R-3.15.1 a second repeat in a round refuses, on the real Action', () => {
        const table = tableAtPlayingCards(() => ({ cards: ['influence', 'repeat', 'tax'] }), 2)
        const [first, second] = table.order
        table.send(first, { type: ActionType.Influence })
        table.send(second, { type: ActionType.ForfeitCard, kind: 'tax' })
        table.send(first, { type: ActionType.Influence, asRepeat: 'repeat' })
        table.send(second, { type: ActionType.ForfeitCard, kind: 'repeat' })
        expect(() => table.send(first, { type: ActionType.Influence, asRepeat: 'repeat' })).toThrow(
            "Repeat isn't in your hand."
        )
    })
})

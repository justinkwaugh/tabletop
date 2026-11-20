import { Visibility } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import type { SpaceId } from '../data/board.js'
import type { ActionCardKind } from '../data/cards.js'
import { ActionType } from '../definition/actions.js'
import { FeudumApiActions } from '../definition/apiActions.js'
import { MachineState } from '../definition/states.js'
import { conservationBreaks } from '../model/canonicalValidator.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { isPinned } from '../model/media.js'
import { writDeckCount } from '../model/writDeck.js'
import { giveTile } from '../testing/atWill.js'
import { buildFeudum, giveMonster } from '../testing/combat.js'
import {
    setBeads,
    setCarts,
    setJourneyman,
    setMarket,
    setMaster,
    setPawns,
    setScrolls,
    setScrollSeal,
    StandingSpace,
    tableAtGuild
} from '../testing/guilds.js'
import { setUp } from '../testing/improving.js'
import { canonicalOf } from '../testing/state.js'
import { specialShortOfGood } from './cardPlay.js'
import { Feast, feastOffers, feastPreview, reasonFeastRefused, type FeastInput } from './feast.js'
import { cardTurnSeat } from '../model/turns.js'

const actionProjector = Visibility.createActionProjector(FeudumApiActions)
const R1C1 = 'guild.noble.scroll.r1c1'
const Elsewhere: SpaceId = 'space.forest.2'

const IronWood = ['iron', 'wood', 'iron', 'wood'] as const

type Edit = (state: HydratedFeudumGameState, seat: string, rest: readonly string[]) => void

/** The seat's knight stands on the shared space, with barrel sulfur. */
function feastTable(edit: Edit, cards?: ActionCardKind[], barrel = 1) {
    return tableAtGuild((state, seat, rest) => {
        setPawns(state, seat, ['knight'])
        state.supply.haversack.sulfur -= barrel
        state.getPlayerState(seat).barrel = barrel
        edit(state, seat, rest)
    }, cards)
}

/** The first opponent masters the Merchant Guild from the shared space, with a push ready. */
const merchantMaster: Edit = (state, _seat, rest) => {
    setMaster(state, rest[0], 'merchant')
    setMarket(state, { iron: 2, wood: 3 })
    setCarts(state, { iron: 1 })
}

function feastOn(opponentId: string) {
    return {
        type: ActionType.Feast,
        spaceId: StandingSpace,
        opponentId,
        guildId: 'merchant',
        params: { goods: [...IronWood] }
    } as const
}

function setCoffer(state: HydratedFeudumGameState, amount: number): void {
    state.supply.shillings -= amount - state.guilds.monk.coffer
    state.guilds.monk.coffer = amount
}

describe('Feast: R-3.16.3 an opponent’s own function, for barrel sulfur', () => {
    it('R-3.16.3 S47 sulfur in, the master’s push, its points +3 vp, no reeve, the guild used', () => {
        const { table, playerId, others } = feastTable(merchantMaster)
        const before = table.hydrated()
        const sulfur = before.supply.haversack.sulfur
        const score = before.getPlayerState(playerId).score
        const theirScore = before.getPlayerState(others[0]).score

        const [action] = table.send(playerId, feastOn(others[0]))

        const state = table.hydrated()
        const seat = state.getPlayerState(playerId)
        expect(seat.barrel).toBe(0)
        expect(state.supply.haversack.sulfur).toBe(sulfur + 1)
        expect(seat.score).toBe(score + 4 + 3)
        expect(state.getPlayerState(others[0]).score).toBe(theirScore)
        expect(seat.guildsUsed).toEqual(['merchant'])
        expect(seat.played).toEqual([{ kind: 'guild', use: 'special' }])
        expect(seat.requireHand()).not.toContain('guild')
        expect(state.guilds.alchemist.carts['guild.alchemist.cart.iron-3']).toBe(true)
        expect(cardTurnSeat(state)).not.toBe(playerId)
        expect(action).toMatchObject({
            metadata: {
                fn: 'push',
                feastPoints: 3,
                completions: 1,
                points: 4,
                reevePoints: 0,
                reeveOffered: false,
                drawnWritIds: [],
                rankChanges: [],
                details: { kind: 'merchant-push' }
            }
        })
        expect(action).not.toHaveProperty('revealsInfo', true)
        expect(conservationBreaks(canonicalOf(state))).toEqual([])
    })

    it('R-3.16 is in the API action schemas, and offered with the Guild card', () => {
        expect(FeudumApiActions[ActionType.Feast]).toBe(Feast)
        const { table, playerId } = feastTable(merchantMaster)
        expect(table.offered(playerId)).toContain(ActionType.Feast)
        const noCard = feastTable(merchantMaster, ['move', 'tax'])
        expect(noCard.table.offered(noCard.playerId)).not.toContain(ActionType.Feast)
    })

    it('R-3.16.3 a journeyman’s pull', () => {
        const { table, playerId, others } = feastTable((state, _seat, rest) => {
            setJourneyman(state, rest[0], 'monk', rest[1])
            setBeads(state, { rosary: [2, 2], chickens: [] })
            setScrolls(state, [R1C1])
            setScrollSeal(state, R1C1, 2)
        })
        const [action] = table.send(playerId, {
            type: ActionType.Feast,
            spaceId: StandingSpace,
            opponentId: others[0],
            guildId: 'monk',
            params: { scrollSpaces: [R1C1] }
        })
        expect(action).toMatchObject({
            metadata: { fn: 'pull', details: { kind: 'monk-pull' } }
        })
    })

    it('R-3.16.3 an opponent’s feudum relates its guild, with no pawn of theirs there', () => {
        const { table, playerId, others } = feastTable((state, _seat, rest) => {
            buildFeudum(state, rest[0], StandingSpace, 'disc.feudum.merchant-1', 'merchant')
            setPawns(state, rest[0], [])
            state.recomputeRanks(rest[0])
            setMarket(state, { iron: 2, wood: 3 })
            setCarts(state, { iron: 1 })
        })
        expect(table.hydrated().guilds.tracks.merchant.master?.playerId).toBe(others[0])
        const score = table.seat(playerId).score
        const [action] = table.send(playerId, feastOn(others[0]))
        expect(table.seat(playerId).score).toBe(score + 4 + 3)
        expect(action).toMatchObject({ metadata: { fn: 'push', feastPoints: 3 } })
    })

    it('R-4.6.5 takes the opponent’s share of the coffer; the other member keeps theirs', () => {
        const { table, playerId, others } = feastTable((state, _seat, rest) => {
            setJourneyman(state, rest[1], 'monk', rest[0])
            setBeads(state, { rosary: [2, 2], chickens: [] })
            setCoffer(state, 5)
        })
        const mine = table.seat(playerId).shillings
        const master = table.seat(others[0]).shillings
        const journeyman = table.seat(others[1]).shillings

        const [action] = table.send(playerId, {
            type: ActionType.Feast,
            spaceId: StandingSpace,
            opponentId: others[0],
            guildId: 'monk',
            params: {}
        })

        expect(table.seat(playerId).shillings).toBe(mine + 3)
        expect(table.seat(others[0]).shillings).toBe(master)
        expect(table.seat(others[1]).shillings).toBe(journeyman + 2)
        expect(table.hydrated().guilds.monk.coffer).toBe(0)
        expect(action).toMatchObject({
            revealsInfo: true,
            metadata: {
                fn: 'push',
                split: {
                    shares: [
                        { playerId, amount: 3 },
                        { playerId: others[1], amount: 2 }
                    ],
                    stays: 0
                }
            }
        })
        expect(conservationBreaks(canonicalOf(table.hydrated()))).toEqual([])
    })

    it('R-3.16.3, R-4.7 no reeve scores or is offered, neither theirs nor the seat’s', () => {
        const { table, playerId, others } = feastTable((state, seat, rest) => {
            merchantMaster(state, seat, rest)
            setJourneyman(state, seat, 'merchant', rest[0])
            const { master, journeyman } = state.guilds.tracks.merchant
            if (master && journeyman) {
                master.reeve = true
                journeyman.reeve = true
            }
        })
        expect(table.hydrated().guilds.tracks.merchant).toMatchObject({
            master: { playerId: others[0], reeve: true },
            journeyman: { playerId, reeve: true }
        })
        const score = table.seat(playerId).score
        const theirScore = table.seat(others[0]).score
        const [action] = table.send(playerId, feastOn(others[0]))
        expect(table.seat(playerId).score).toBe(score + 4 + 3)
        expect(table.seat(others[0]).score).toBe(theirScore)
        expect(table.hydrated().machineState).toBe(MachineState.PlayingCards)
        expect(action).toMatchObject({ metadata: { reevePoints: 0, reeveOffered: false } })
    })

    it('R-3.15 Repeat replays a Guild card as a feast', () => {
        const { table, playerId, others } = feastTable(
            (state, seat, rest) => {
                merchantMaster(state, seat, rest)
                state.getPlayerState(seat).played = [{ kind: 'guild', use: 'regular' }]
            },
            ['repeat', 'move', 'tax']
        )
        table.send(playerId, { ...feastOn(others[0]), asRepeat: 'repeat' })
        expect(table.seat(playerId).played).toContainEqual({
            kind: 'repeat',
            use: 'special',
            replayedKind: 'guild'
        })
    })
})

describe('Feast: R-3.16-H1, R-3.16-H2 what a threshold changes', () => {
    function pullTable(rosary: readonly (2 | 3 | 4 | 5)[], sealValue: 2 | 3 | 4 | 5) {
        return feastTable((state, _seat, rest) => {
            setJourneyman(state, rest[0], 'monk', rest[1])
            setBeads(state, { rosary, chickens: [] })
            setScrolls(state, [R1C1])
            setScrollSeal(state, R1C1, sealValue)
        })
    }

    function monkPull(opponentId: string) {
        return {
            type: ActionType.Feast,
            spaceId: StandingSpace,
            opponentId,
            guildId: 'monk',
            params: { scrollSpaces: [R1C1] }
        } as const
    }

    it('R-3.16-H1 a pull at its threshold scores 3+3, and the feaster draws 2 and keeps 1', () => {
        const { table, playerId, others } = pullTable([4, 4], 3)
        const score = table.seat(playerId).score
        const deck = writDeckCount(table.hydrated())

        const [action] = table.send(playerId, monkPull(others[0]))

        const state = table.hydrated()
        const drawn = state.flow.writDraw?.drawn
        expect(state.getPlayerState(playerId).score).toBe(score + 3 + 3)
        expect(writDeckCount(state)).toBe(deck - 2)
        expect(state.machineState).toBe(MachineState.KeepingWrits)
        expect(state.flow.writDraw).toMatchObject({ playerId, keep: 1 })
        expect(drawn).toHaveLength(2)
        expect(action).toMatchObject({
            revealsInfo: true,
            metadata: {
                fn: 'pull',
                points: 3,
                feastPoints: 3,
                drawnCount: 2,
                keep: 1,
                drawnWritIds: drawn,
                reevePoints: 0,
                reeveOffered: false
            }
        })
    })

    it('R-3.16-H1 after the keep the turn passes, with no reeve asked', () => {
        const { table, playerId, others } = pullTable([4, 4], 3)
        table.send(playerId, monkPull(others[0]))
        const drawn = table.hydrated().flow.writDraw?.drawn ?? []
        table.send(playerId, { type: ActionType.KeepWrits, keep: [drawn[0]] })
        const state = table.hydrated()
        expect(state.machineState).toBe(MachineState.PlayingCards)
        expect(cardTurnSeat(state)).not.toBe(playerId)
    })

    it('R-3.16-H2 a pull below its threshold scores the 3 alone, with no writ', () => {
        const { table, playerId, others } = pullTable([4, 4], 2)
        const score = table.seat(playerId).score
        const deck = writDeckCount(table.hydrated())
        const [action] = table.send(playerId, monkPull(others[0]))
        const state = table.hydrated()
        expect(state.getPlayerState(playerId).score).toBe(score + 3)
        expect(writDeckCount(state)).toBe(deck)
        expect(state.flow.writDraw).toBeUndefined()
        expect(action).toMatchObject({
            metadata: { points: 0, feastPoints: 3, completions: 0, drawnWritIds: [] }
        })
    })

    it('R-3.16-H2 a push reaching nothing scores the 3, and is no barrier when it reveals nothing', () => {
        const { table, playerId, others } = feastTable((state, _seat, rest) => {
            setMaster(state, rest[0], 'merchant')
            setMarket(state, { wood: 1 })
            setCarts(state, {})
        })
        const score = table.seat(playerId).score
        const [action] = table.send(playerId, {
            ...feastOn(others[0]),
            params: { goods: ['wood'] }
        })
        expect(table.seat(playerId).score).toBe(score + 3)
        expect(action).toMatchObject({ metadata: { points: 0, feastPoints: 3, completions: 0 } })
        expect(action).not.toHaveProperty('revealsInfo', true)
    })
})

describe('Feast: R-3.16.3 what it refuses', () => {
    it('R-3.4 needs a sulfur in the barrel', () => {
        const { table, playerId, others } = feastTable(merchantMaster, undefined, 0)
        expect(() => table.send(playerId, feastOn(others[0]))).toThrow(
            'Feast needs a sulfur in your barrel.'
        )
    })

    it('R-3.2 needs the Guild card in the hand', () => {
        const { table, playerId, others } = feastTable(merchantMaster, ['move', 'tax'])
        expect(() => table.send(playerId, feastOn(others[0]))).toThrow("Guild isn't in your hand.")
    })

    it('R-3.16.3 never for the seat’s own pieces', () => {
        const { table, playerId } = feastTable((state, seat) => {
            setMaster(state, seat, 'merchant')
            setMarket(state, { iron: 2, wood: 3 })
        })
        expect(() => table.send(playerId, feastOn(playerId))).toThrow(
            "You can't feast on your own pieces."
        )
    })

    it('R-3.16.3 needs the seat’s pawn on the space', () => {
        const { table, playerId, others } = feastTable((state, seat, rest) => {
            merchantMaster(state, seat, rest)
            state.getPlayerState(seat).pawns[0].spaceId = Elsewhere
        })
        expect(() => table.send(playerId, feastOn(others[0]))).toThrow('You have no pawn there.')
    })

    it('R-4.2.4 a monster can’t feast', () => {
        const { table, playerId, others } = feastTable((state, seat, rest) => {
            merchantMaster(state, seat, rest)
            state.getPlayerState(seat).pawns[0].spaceId = Elsewhere
            giveMonster(state, seat, 'behemoth', StandingSpace)
        })
        expect(() => table.send(playerId, feastOn(others[0]))).toThrow('You have no pawn there.')
    })

    it('R-4.2-H1 a pawn pinned by a monster may still feast, and is offered it', () => {
        const { table, playerId, others } = feastTable((state, seat, rest) => {
            merchantMaster(state, seat, rest)
            giveMonster(state, rest[1], 'behemoth', StandingSpace)
        })
        const before = table.hydrated()
        const knight = before.getPlayerState(playerId).pawns[0]
        expect(knight.spaceId).toBe(StandingSpace)
        expect(isPinned(before, playerId, knight.n)).toBe(true)
        expect(
            feastOffers(before, playerId).find(
                (offer) =>
                    offer.spaceId === StandingSpace &&
                    offer.opponentId === others[0] &&
                    offer.guildId === 'merchant'
            )
        ).toMatchObject({ fn: 'push' })

        const [action] = table.send(playerId, feastOn(others[0]))

        expect(action).toMatchObject({ metadata: { fn: 'push', feastPoints: 3 } })
        expect(conservationBreaks(canonicalOf(table.hydrated()))).toEqual([])
    })

    it('R-3.16.3 needs their piece of that guild on the space, not just their rank', () => {
        const { table, playerId, others } = feastTable((state, seat, rest) => {
            merchantMaster(state, seat, rest)
            for (const pawn of state.getPlayerState(rest[0]).pawns) {
                pawn.spaceId = Elsewhere
            }
        })
        expect(() => table.send(playerId, feastOn(others[0]))).toThrow(
            'That seat has no Merchant pawn or feudum there.'
        )
    })

    it('R-3.16.3 a piece of another guild doesn’t relate this one', () => {
        const { table, playerId, others } = feastTable((state, seat, rest) => {
            merchantMaster(state, seat, rest)
            setPawns(state, rest[0], ['merchant', 'merchant', 'merchant'])
        })
        expect(() => table.send(playerId, { ...feastOn(others[0]), guildId: 'noble' })).toThrow(
            'That seat has no Noble pawn or feudum there.'
        )
    })

    it('R-3.16.3 an apprentice has no function to feast on', () => {
        const { table, playerId, others } = feastTable((state, _seat, rest) => {
            setPawns(state, rest[0], ['merchant'])
            setPawns(state, rest[2], ['merchant', 'merchant'])
            setMaster(state, rest[1], 'merchant')
        })
        expect(table.hydrated().guilds.tracks.merchant.apprentice?.playerId).toBe(others[0])
        expect(() => table.send(playerId, feastOn(others[0]))).toThrow(
            'That seat is neither master nor journeyman of the Merchant Guild.'
        )
    })

    it('R-3.16.2 a guild the seat used this round is refused', () => {
        const { table, playerId, others } = feastTable((state, seat, rest) => {
            merchantMaster(state, seat, rest)
            state.getPlayerState(seat).guildsUsed = ['merchant']
        })
        expect(() => table.send(playerId, feastOn(others[0]))).toThrow(
            'You have already used the Merchant Guild this round.'
        )
    })

    it('R-4.6.1 the function’s own refusals hold, closed and by input', () => {
        const closed = feastTable((state, seat, rest) => {
            merchantMaster(state, seat, rest)
            setMarket(state, {})
        })
        expect(() => closed.table.send(closed.playerId, feastOn(closed.others[0]))).toThrow(
            'No market good fits in the carts and piles.'
        )
        const { table, playerId, others } = feastTable(merchantMaster)
        const state = table.hydrated()
        expect(
            reasonFeastRefused(state, playerId, {
                spaceId: StandingSpace,
                opponentId: others[0],
                guildId: 'merchant',
                params: { goods: ['wood'] }
            })
        ).toBeDefined()
    })

    it('R-3.16.3 an unknown seat is refused, not thrown on', () => {
        const { table, playerId } = feastTable(merchantMaster)
        expect(() => table.send(playerId, feastOn('nobody'))).toThrow(
            'That seat has no Merchant pawn or feudum there.'
        )
    })
})

describe('Feast: R-3.16.3 offers and previews', () => {
    it('R-3.16.3 S47 lists the opponent’s function once, however many pieces stand there', () => {
        const { table, playerId, others } = feastTable(merchantMaster)
        const offers = feastOffers(table.hydrated(), playerId).filter(
            (offer) => offer.opponentId === others[0] && offer.guildId === 'merchant'
        )
        expect(offers).toEqual([
            {
                spaceId: StandingSpace,
                opponentId: others[0],
                guildId: 'merchant',
                fn: 'push',
                bestVp: 4 + 3
            }
        ])
    })

    it('R-3.4 offers nothing without a barrel sulfur or the card', () => {
        const dry = feastTable(merchantMaster, undefined, 0)
        expect(feastOffers(dry.table.hydrated(), dry.playerId)).toEqual([])
        const noCard = feastTable(merchantMaster, ['move', 'tax'])
        expect(feastOffers(noCard.table.hydrated(), noCard.playerId)).toEqual([])
    })

    it('R-3.16.2, R-3.16.3 leaves out used guilds and the seat’s own; dims a closed function', () => {
        const { table, playerId, others } = feastTable((state, seat, rest) => {
            merchantMaster(state, seat, rest)
            setMarket(state, {})
        })
        const state = table.hydrated()
        const offers = feastOffers(state, playerId)
        expect(offers.every((offer) => offer.opponentId !== playerId)).toBe(true)
        expect(offers).toContainEqual(
            expect.objectContaining({
                opponentId: others[0],
                guildId: 'merchant',
                reason: 'No market good fits in the carts and piles.'
            })
        )
        state.getPlayerState(playerId).guildsUsed = ['merchant']
        expect(feastOffers(state, playerId).map((offer) => offer.guildId)).not.toContain('merchant')
    })

    it('R-3.16.3, R-5-H1 S47 previews its points, +3, no reeve, reading no vault', () => {
        const { table, playerId, others } = feastTable(merchantMaster)
        const state = table.hydrated()
        state.vault = undefined
        const before = state.dehydrate()
        const input: FeastInput = {
            spaceId: StandingSpace,
            opponentId: others[0],
            guildId: 'merchant',
            params: { goods: [...IronWood] }
        }
        const preview = feastPreview(state, playerId, input)
        expect(preview).toMatchObject({
            fn: 'push',
            feastPoints: 3,
            completions: 1,
            points: 4,
            reevePoints: 0,
            reeveOffered: false,
            revealsInfo: false
        })
        expect(preview).not.toHaveProperty('refused')
        expect(state.dehydrate()).toEqual(before)
    })

    it('R-3.16-H1, R-4.6.5 previews the writs and the seat’s share', () => {
        const pull = feastTable((state, _seat, rest) => {
            setJourneyman(state, rest[0], 'monk', rest[1])
            setBeads(state, { rosary: [5, 4], chickens: [] })
            setScrolls(state, [R1C1])
        })
        expect(
            feastPreview(pull.table.hydrated(), pull.playerId, {
                spaceId: StandingSpace,
                opponentId: pull.others[0],
                guildId: 'monk',
                params: { scrollSpaces: [R1C1] }
            })
        ).toMatchObject({
            fn: 'pull',
            points: 3,
            feastPoints: 3,
            drawnCount: 2,
            keep: 1,
            revealsInfo: true
        })

        const push = feastTable((state, _seat, rest) => {
            setMaster(state, rest[0], 'monk')
            setBeads(state, { rosary: [2, 2], chickens: [] })
            setCoffer(state, 4)
        })
        expect(
            feastPreview(push.table.hydrated(), push.playerId, {
                spaceId: StandingSpace,
                opponentId: push.others[0],
                guildId: 'monk',
                params: {}
            })
        ).toMatchObject({
            fn: 'push',
            split: { shares: [{ playerId: push.playerId, amount: 2 }] }
        })
    })

    it('R-3.16.3 a staged input says what still refuses it; no rank gives no preview', () => {
        const { table, playerId, others } = feastTable(merchantMaster)
        const state = table.hydrated()
        const staged = feastPreview(state, playerId, {
            spaceId: StandingSpace,
            opponentId: others[0],
            guildId: 'merchant',
            params: { goods: ['iron'] }
        })
        expect(staged?.refused).toBeDefined()
        expect(
            feastPreview(state, playerId, {
                spaceId: StandingSpace,
                opponentId: others[0],
                guildId: 'noble',
                params: {}
            })
        ).toBeUndefined()
    })
})

describe('Feast: R-4.3-H3 a sulfur a tile could bring', () => {
    it('R-4.3-H3, R-4.10.2 short of barrel sulfur only while a tile can bring one to the barrel', () => {
        const { table, playerId } = feastTable(merchantMaster, undefined, 0)
        expect(specialShortOfGood(table.hydrated(), playerId, 'guild')).toBe(false)
        setUp(table, (state) => {
            giveTile(state, playerId)
        })
        expect(specialShortOfGood(table.hydrated(), playerId, 'guild')).toBe(true)
        setUp(table, (state) => {
            state.getPlayerState(playerId).barrel = 1
        })
        expect(specialShortOfGood(table.hydrated(), playerId, 'guild')).toBe(false)
    })

    it('R-4.3-H3 no sulfur left in the haversack leaves no tile able to bring one', () => {
        const { table, playerId } = feastTable(merchantMaster, undefined, 0)
        setUp(table, (state) => {
            giveTile(state, playerId)
            state.supply.haversack.sulfur = 0
        })
        expect(specialShortOfGood(table.hydrated(), playerId, 'guild')).toBe(false)
    })
})

describe('Feast: R-X.2 what the table sees', () => {
    it('R-3.16-H1 only the feaster sees the writs drawn', () => {
        const { table, playerId, others } = feastTable((state, _seat, rest) => {
            setJourneyman(state, rest[0], 'monk', rest[1])
            setBeads(state, { rosary: [4, 4], chickens: [] })
            setScrolls(state, [R1C1])
            setScrollSeal(state, R1C1, 3)
        })
        const [action] = table.send(playerId, {
            type: ActionType.Feast,
            spaceId: StandingSpace,
            opponentId: others[0],
            guildId: 'monk',
            params: { scrollSpaces: [R1C1] }
        })
        const drawn = table.hydrated().flow.writDraw?.drawn
        expect(
            actionProjector.project(action, { kind: 'player', playerId }, { config: {} })
        ).toMatchObject({ metadata: { drawnWritIds: drawn } })
        const theirs = actionProjector.project(
            action,
            { kind: 'player', playerId: others[0] },
            { config: {} }
        )
        expect(theirs).toMatchObject({ metadata: { drawnCount: 2, keep: 1 } })
        expect(theirs).not.toHaveProperty('metadata.drawnWritIds')
    })
})

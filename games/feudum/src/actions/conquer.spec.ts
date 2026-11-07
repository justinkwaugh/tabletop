import { describe, expect, it } from 'vitest'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import {
    addPawn,
    answer,
    Battlefield,
    buildFeudum,
    commit,
    conquer,
    emptyGoods,
    giveMonster,
    holdWrit,
    PawnOf,
    tableAtCombat
} from '../testing/combat.js'
import { setUp, spaceOfKind } from '../testing/improving.js'
import { conquerOffers, reasonConquerRefused } from './conquer.js'

describe('R-3.13.1 what Conquer may target', () => {
    it('R-3.13.1 records the character a pawn target shows, for the sentence', () => {
        const combat = tableAtCombat()
        const { table, defenderId } = combat
        setUp(table, (state) => {
            state.getPlayerState(defenderId).pawns[0].character = 'merchant'
        })

        const [action] = conquer(combat, PawnOf(defenderId))

        expect(action).toMatchObject({ metadata: { character: 'merchant' } })
    })

    it('R-3.13.1 is accepted against an opponent’s pawn on a space with the seat’s pawn', () => {
        const combat = tableAtCombat()
        const { table, attackerId, defenderId } = combat
        expect(table.offered(attackerId)).toContain(ActionType.Conquer)

        const [action] = conquer(combat, PawnOf(defenderId))

        const seat = table.seat(attackerId)
        expect(seat.played).toEqual([{ kind: 'conquer', use: 'regular' }])
        expect(seat.handCount).toBe(2)
        expect(action).toMatchObject({ metadata: { defenderId, asked: true } })
        expect(table.state.flow.combat).toEqual({
            attackerId,
            defenderId,
            spaceId: Battlefield,
            target: PawnOf(defenderId),
            defendFlipped: false
        })
    })

    it('R-3.13.1 is accepted with a monster alone on the space', () => {
        const { table, attackerId, defenderId } = tableAtCombat()
        const elsewhere = 'space.forest.1'
        setUp(table, (state) => {
            giveMonster(state, attackerId, 'behemoth', elsewhere)
            state.getPlayerState(defenderId).pawns[0].spaceId = elsewhere
            state.getPlayerState(attackerId).pawns[0].spaceId = 'space.desert.1'
        })
        expect(
            reasonConquerRefused(table.hydrated(), attackerId, {
                spaceId: elsewhere,
                target: PawnOf(defenderId)
            })
        ).toBeUndefined()
    })

    it('R-3.13.1 is accepted against a monster and against a feudum', () => {
        const { table, attackerId, defenderId } = tableAtCombat()
        setUp(table, (state) => {
            giveMonster(state, defenderId, 'behemoth')
            buildFeudum(state, defenderId)
        })
        const state = table.hydrated()
        for (const target of [
            { kind: 'monster', monsterId: 'behemoth' },
            { kind: 'feudum' }
        ] as const) {
            expect(
                reasonConquerRefused(state, attackerId, { spaceId: Battlefield, target })
            ).toBeUndefined()
        }
    })

    it('R-3.13.1 needs the seat’s own pawn or monster on the space', () => {
        const { table, attackerId, defenderId } = tableAtCombat()
        setUp(table, (state) => {
            state.getPlayerState(attackerId).pawns[0].spaceId = 'space.desert.1'
        })
        expect(() =>
            conquer({ table, attackerId, defenderId, thirdId: defenderId }, PawnOf(defenderId))
        ).toThrow('You have no pawn or monster on that space.')
    })

    it('R-3.13.1 refuses a pawn that is not there, and the seat’s own pieces', () => {
        const { table, attackerId, defenderId } = tableAtCombat()
        const state = table.hydrated()
        const at = (target: Parameters<typeof reasonConquerRefused>[2]['target']) =>
            reasonConquerRefused(state, attackerId, { spaceId: Battlefield, target })
        expect(at(PawnOf(defenderId, 2))).toBe("That pawn isn't on that space.")
        expect(at(PawnOf(attackerId))).toBe('That piece is yours.')
        expect(at({ kind: 'monster', monsterId: 'behemoth' })).toBe(
            "That monster isn't on that space."
        )
    })

    it('R-3.13.1 refuses the seat’s own monster and own feudum', () => {
        const { table, attackerId } = tableAtCombat()
        setUp(table, (state) => {
            giveMonster(state, attackerId, 'behemoth')
            buildFeudum(state, attackerId)
        })
        const state = table.hydrated()
        expect(
            reasonConquerRefused(state, attackerId, {
                spaceId: Battlefield,
                target: { kind: 'monster', monsterId: 'behemoth' }
            })
        ).toBe('That piece is yours.')
        expect(
            reasonConquerRefused(state, attackerId, {
                spaceId: Battlefield,
                target: { kind: 'feudum' }
            })
        ).toBe('That feudum is yours.')
    })

    it('R-3.13.1 never targets an outpost, farm or town', () => {
        const { table, attackerId, defenderId } = tableAtCombat()
        for (const kind of ['outpost', 'farm', 'town'] as const) {
            const spaceId = spaceOfKind(table.hydrated(), kind)
            setUp(table, (state) => {
                state.getPlayerState(attackerId).pawns[0].spaceId = spaceId
                state.spaces[spaceId].ruler = { playerId: defenderId, subject: false }
                state.getPlayerState(defenderId).influenceSupply -= 1
            })
            expect(
                reasonConquerRefused(table.hydrated(), attackerId, {
                    spaceId,
                    target: { kind: 'feudum' }
                })
            ).toBe("That location isn't a feudum: outposts, farms and towns are never targets.")
        }
    })

    it('R-3.2 is refused off turn and without the card', () => {
        const combat = tableAtCombat(['tax', 'guild'], ['move', 'tax', 'guild'])
        const { table, attackerId, defenderId } = combat
        expect(() => conquer(combat, PawnOf(defenderId))).toThrow("Conquer isn't in your hand.")
        expect(
            reasonConquerRefused(table.hydrated(), defenderId, {
                spaceId: Battlefield,
                target: PawnOf(attackerId)
            })
        ).toBe("It isn't your turn.")
    })

    it('R-3.13-H1 may not be the last card: forfeiting is the way to play it', () => {
        const combat = tableAtCombat(['tax'], ['conquer'])
        const { table, attackerId, defenderId } = combat
        expect(() => conquer(combat, PawnOf(defenderId))).toThrow(
            "Conquer can't be your last card: forfeit it."
        )
        expect(conquerOffers(table.hydrated(), attackerId)).toEqual([])

        table.send(attackerId, { type: ActionType.ForfeitCard, kind: 'conquer' })
        expect(table.seat(attackerId).played).toEqual([{ kind: 'conquer', use: 'forfeited' }])
    })

    it('R-3.13-H1 a card played later keeps it from being last', () => {
        const combat = tableAtCombat(['tax'], ['conquer', 'tax'])
        conquer(combat, PawnOf(combat.defenderId))
        expect(combat.table.state.machineState).toBe(MachineState.AwaitingDefence)
    })

    it('R-3.15.2 can never be replayed', () => {
        const combat = tableAtCombat()
        const { table, attackerId, defenderId } = combat
        setUp(table, (state) => {
            const seat = state.getPlayerState(attackerId)
            seat.played = [{ kind: 'conquer', use: 'regular' }]
            seat.hand = ['repeat', 'tax']
        })
        expect(() => conquer(combat, PawnOf(defenderId), { asRepeat: 'repeat' })).toThrow(
            "Conquer can't be replayed."
        )
    })

    it('R-3.3-H1 a declared second card follows the whole combat', () => {
        const combat = tableAtCombat(['tax'], ['conquer', 'tax', 'guild'])
        const { table, attackerId, defenderId } = combat
        setUp(table, (state) => {
            state.getPlayerState(attackerId).pouch = 'sulfur'
            state.getPlayerState(attackerId).goods.sulfur -= 1
        })

        conquer(combat, PawnOf(defenderId), { secondCard: true })
        answer(combat)
        commit(combat)

        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).toBe(attackerId)
        expect(table.state.flow.turn?.playerId).toBe(attackerId)
    })
})

describe('R-3.14-H1, R-X.2 whom Conquer asks', () => {
    it('R-3.14-H1 asks a defender with an unplayed card and no Defend played, alone (S32)', () => {
        const combat = tableAtCombat()
        const { table, attackerId, defenderId, thirdId } = combat

        const [action] = conquer(combat, PawnOf(defenderId))

        expect(table.state.machineState).toBe(MachineState.AwaitingDefence)
        expect(table.state.activePlayerIds).toEqual([defenderId])
        expect(table.offered(defenderId)).toEqual([ActionType.AnswerAttack])
        expect(table.offered(attackerId)).toEqual([])
        expect(table.offered(thirdId)).toEqual([])
        expect(table.state.flow.turn?.playerId).toBe(attackerId)
        expect(action.revealsInfo).toBe(true)
    })

    it('R-3.14-H1 does not ask once Defend is played: no barrier, on to the commitment (S35)', () => {
        const combat = tableAtCombat()
        const { table, attackerId, defenderId } = combat
        setUp(table, (state) => {
            state.getPlayerState(defenderId).played = [{ kind: 'defend', use: 'regular' }]
        })

        const [action] = conquer(combat, PawnOf(defenderId))

        expect(table.state.machineState).toBe(MachineState.CommittingAttack)
        expect(table.state.activePlayerIds).toEqual([attackerId])
        expect(table.offered(attackerId)).toEqual([ActionType.CommitAttack])
        expect(action.revealsInfo).toBeFalsy()
        expect(action).toMatchObject({ metadata: { defenderId, asked: false } })
    })

    it('R-3.14-H1 a forfeited Defend is played too', () => {
        const combat = tableAtCombat()
        const { table, defenderId } = combat
        setUp(table, (state) => {
            state.getPlayerState(defenderId).played = [{ kind: 'defend', use: 'forfeited' }]
        })
        expect(conquer(combat, PawnOf(defenderId))[0].revealsInfo).toBeFalsy()
    })

    it('R-3.14-H1 does not ask a defender with no unplayed card', () => {
        const combat = tableAtCombat([])
        const { table, defenderId } = combat
        const [action] = conquer(combat, PawnOf(defenderId))
        expect(table.state.machineState).toBe(MachineState.CommittingAttack)
        expect(action.revealsInfo).toBeFalsy()
    })

    it('R-4.8-H5 with nobody asked and nothing to add, it resolves at once', () => {
        const combat = tableAtCombat([])
        const { table, attackerId, defenderId } = combat
        setUp(table, (state) => {
            emptyGoods(state, attackerId)
        })

        const [action] = conquer(combat, PawnOf(defenderId))

        expect(table.state.flow.combat).toBeUndefined()
        expect(action.revealsInfo).toBeFalsy()
        expect(action).toMatchObject({
            metadata: {
                defenderId,
                asked: false,
                combat: {
                    attack: { pawns: 1, total: 1 },
                    defence: { pawns: 2, total: 2 },
                    attackerWins: false,
                    vp: 0
                }
            }
        })
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).not.toBe(attackerId)
    })

    it('R-4.8-H5 an unsealed writ goes to the commitment, weapon or not: nothing is revealed', () => {
        const combat = tableAtCombat([])
        const { table, attackerId, defenderId } = combat
        setUp(table, (state) => {
            emptyGoods(state, attackerId)
            holdWrit(state, attackerId, 'writ.mandate.2')
        })
        conquer(combat, PawnOf(defenderId))
        expect(table.state.machineState).toBe(MachineState.CommittingAttack)
    })
})

describe('R-3.13.1, R-4.8.2 what the session reads before a Conquer', () => {
    it('R-3.13.1 offers each target with its strengths and whether it asks (S32)', () => {
        const { table, attackerId, defenderId, thirdId } = tableAtCombat()
        setUp(table, (state) => {
            addPawn(state, attackerId)
            addPawn(state, attackerId)
            giveMonster(state, defenderId, 'behemoth')
            state.getPlayerState(thirdId).played = [{ kind: 'defend', use: 'regular' }]
        })

        const offers = conquerOffers(table.hydrated(), attackerId)

        expect(offers).toContainEqual(
            expect.objectContaining({
                spaceId: Battlefield,
                target: PawnOf(defenderId),
                defenderId,
                revealsInfo: true,
                vp: 2,
                strength: expect.objectContaining({
                    attack: expect.objectContaining({ total: 3 }),
                    defence: expect.objectContaining({ total: 3 }),
                    attackerWins: false
                })
            })
        )
        expect(offers).toContainEqual(
            expect.objectContaining({
                target: { kind: 'monster', monsterId: 'behemoth' },
                defenderId,
                vp: 2
            })
        )
        expect(offers).toContainEqual(
            expect.objectContaining({
                target: PawnOf(thirdId),
                defenderId: thirdId,
                revealsInfo: false
            })
        )
        expect(offers.some((offer) => offer.target.kind === 'feudum')).toBe(false)
    })

    it('R-3.13.1 a feudum scores 4 and shows its defence', () => {
        const { table, attackerId, defenderId } = tableAtCombat()
        setUp(table, (state) => {
            buildFeudum(state, defenderId)
        })
        expect(conquerOffers(table.hydrated(), attackerId)).toContainEqual(
            expect.objectContaining({
                target: { kind: 'feudum' },
                defenderId,
                vp: 4,
                strength: expect.objectContaining({
                    defence: expect.objectContaining({ pawns: 2, feudum: 2, total: 4 })
                })
            })
        )
    })
})

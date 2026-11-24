import { describe, expect, it } from 'vitest'
import type { ActionCardKind } from '../data/cards.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { conservationBreaks } from '../model/conservation.js'
import { placeMarker } from '../model/locationControl.js'
import { collectTopTile } from '../model/regionStacks.js'
import { immunityKey, type ImmunityRole } from '../model/seals.js'
import {
    answer,
    Battlefield,
    commit,
    conquer,
    PawnOf,
    tableAtCombat,
    type CombatTable
} from '../testing/combat.js'
import { setUp } from '../testing/improving.js'
import { canonicalOf } from '../testing/state.js'
import {
    answerStarve,
    giveFood,
    reclaim,
    sealUnder,
    starve,
    tableAtStarve,
    type StarveTable
} from '../testing/starve.js'
import { answerAttackOffer } from './answerAttack.js'
import { answerStarveOffer, reasonAnswerStarveRefused } from './answerStarve.js'
import {
    reasonReclaimImmunitySealRefused,
    reclaimImmunitySealOffers
} from './reclaimImmunitySeal.js'
import { endCardTurn, giveCardTurn } from '../testing/table.js'

const WITH_DEFEND = ['defend', 'tax'] as const
const WITHOUT_DEFEND = ['tax', 'guild'] as const

function attacked(hand: readonly ('defend' | 'tax' | 'guild')[]): CombatTable {
    const combat = tableAtCombat([...hand])
    conquer(combat, PawnOf(combat.defenderId))
    return combat
}

describe('R-3.14.1, R-3.14-H1 AnswerAttack', () => {
    it('R-3.14.1 a flip plays Defend out of turn: +1 defence, +1 vp, a barrier (S33)', () => {
        const combat = attacked(WITH_DEFEND)
        const { table, attackerId, defenderId } = combat

        const [action] = answer(combat, true)

        const seat = table.seat(defenderId)
        expect(seat.hand).toEqual(['tax'])
        expect(seat.handCount).toBe(1)
        expect(seat.played).toEqual([{ kind: 'defend', use: 'defend-flip' }])
        expect(seat.score).toBe(1)
        expect(table.state.flow.combat?.defendFlipped).toBe(true)
        expect(action.revealsInfo).toBe(true)
        expect(action).toMatchObject({ metadata: { vp: 1 } })
        expect(table.state.machineState).toBe(MachineState.CommittingAttack)
        expect(table.state.activePlayerIds).toEqual([attackerId])
    })

    it('R-3.14.1 the flip counts in the combat: +1 defence for this combat', () => {
        const combat = attacked(WITH_DEFEND)
        answer(combat, true)
        const [action] = commit(combat)
        expect(action).toMatchObject({
            metadata: {
                defendFlipped: true,
                defence: { pawns: 2, defend: 1, total: 3 }
            }
        })
    })

    it('R-3.14-H1 "no" is legal while holding Defend, keeps the card and scores nothing', () => {
        const combat = attacked(WITH_DEFEND)
        const { table, defenderId } = combat

        const [action] = answer(combat, false)

        const seat = table.seat(defenderId)
        expect(seat.hand).toEqual([...WITH_DEFEND])
        expect(seat.played).toEqual([])
        expect(seat.score).toBe(0)
        expect(table.state.flow.combat?.defendFlipped).toBe(false)
        expect(action.revealsInfo).toBe(true)
        expect(action).toMatchObject({ metadata: { vp: 0 } })
        expect(table.state.machineState).toBe(MachineState.CommittingAttack)
    })

    it('R-3.14.1 a flip needs Defend in hand; "no" is always legal (S34)', () => {
        const combat = attacked(WITHOUT_DEFEND)
        const { table, defenderId } = combat
        expect(
            table.refusal(defenderId, {
                type: ActionType.AnswerAttack,
                revealsInfo: true,
                flipDefend: true
            })
        ).toBe("Defend isn't in your hand.")
        expect(() => answer(combat, true)).toThrow("Defend isn't in your hand.")
        expect(
            table.refusal(defenderId, {
                type: ActionType.AnswerAttack,
                revealsInfo: true,
                flipDefend: false
            })
        ).toBeUndefined()

        answer(combat, false)
        expect(table.state.machineState).toBe(MachineState.CommittingAttack)
    })

    it('R-3.14-H1 only the seat attacked answers', () => {
        const { table, attackerId, thirdId } = attacked(WITH_DEFEND)
        for (const playerId of [attackerId, thirdId]) {
            expect(
                table.refusal(playerId, {
                    type: ActionType.AnswerAttack,
                    revealsInfo: true,
                    flipDefend: false
                })
            ).toBe('No attack on you is waiting.')
        }
    })

    it('R-3.14-H1, R-5 what the table sees does not depend on holding Defend (S34)', () => {
        const holding = attacked(WITH_DEFEND)
        const without = attacked(WITHOUT_DEFEND)
        for (const combat of [holding, without]) {
            const { table, attackerId, defenderId, thirdId } = combat
            expect(table.state.machineState).toBe(MachineState.AwaitingDefence)
            expect(table.state.activePlayerIds).toEqual([defenderId])
            expect(table.offered(defenderId)).toEqual([ActionType.AnswerAttack])
            expect(table.offered(attackerId)).toEqual([])
            expect(table.offered(thirdId)).toEqual([])
            expect(table.state.flow.combat?.spaceId).toBe(Battlefield)
            expect(table.seat(defenderId).handCount).toBe(2)
        }
        const [held] = answer(holding, false)
        const [none] = answer(without, false)
        expect(held).toHaveProperty('metadata', { vp: 0 })
        expect(none).toHaveProperty('metadata', { vp: 0 })
        expect(held.revealsInfo).toBe(none.revealsInfo)
    })

    it('R-3.14.1 the offer reads the seat’s own hand; another seat gets none (S33, S34)', () => {
        const holding = attacked(WITH_DEFEND)
        expect(answerAttackOffer(holding.table.hydrated(), holding.defenderId)).toEqual({
            holdsDefend: true,
            attack: 1,
            defence: 2,
            defenceIfFlipped: 3,
            flipVp: 1,
            revealsInfo: true
        })
        expect(answerAttackOffer(holding.table.hydrated(), holding.attackerId)).toBeUndefined()

        const without = attacked(WITHOUT_DEFEND)
        expect(answerAttackOffer(without.table.hydrated(), without.defenderId)).toMatchObject({
            holdsDefend: false
        })
    })

    it('R-3.14.1 Defend helps against one combat only', () => {
        const first = attacked(WITH_DEFEND)
        answer(first, true)
        commit(first)
        expect(first.table.state.flow.combat).toBeUndefined()
        expect(first.table.seat(first.defenderId).played.at(-1)).toEqual({
            kind: 'defend',
            use: 'defend-flip'
        })
    })
})

describe('R-3.14.2, R-3.14-H1 AnswerStarve', () => {
    function asked(hand: ActionCardKind[] = ['defend', 'tax'], role: ImmunityRole = 'serf') {
        const combat = tableAtStarve(role, hand)
        setUp(combat.table, (state) => giveFood(state, combat.defenderId))
        starve(combat)
        return combat
    }

    it('R-3.14.2 Royal Immunity turns in a food, cancels, and hides a pile seal (S38)', () => {
        const combat = asked()
        const { table, attackerId, defenderId } = combat
        const bead = table.state.guilds.farmer.chickens['guild.farmer.chicken.1']
        const haversack = table.state.supply.haversack.food
        const pile = table.hydrated().requireVault().sealPile
        const [top] = pile

        const [action] = answerStarve(combat, true)

        const seat = table.seat(defenderId)
        expect(seat.goods.food).toBe(0)
        expect(table.state.supply.haversack.food).toBe(haversack + 1)
        expect(seat.hand).toEqual(['tax'])
        expect(seat.handCount).toBe(1)
        expect(seat.played).toEqual([{ kind: 'defend', use: 'special' }])
        expect(table.state.spaces[Battlefield].serf).toEqual({
            playerId: defenderId,
            immune: true
        })
        const vault = table.hydrated().requireVault()
        expect(vault.immunitySeals).toEqual({ [immunityKey(Battlefield, 'serf')]: top })
        expect(vault.sealPile).toEqual(pile.slice(1))
        expect(table.state.supply.sealPileCount).toBe(pile.length - 1)
        expect(table.state.guilds.farmer.chickens['guild.farmer.chicken.1']).toBe(bead)
        expect(table.state.flow.starve).toBeUndefined()
        expect(table.state.flow.turn?.followUps).toEqual([])
        expect(action.revealsInfo).toBe(true)
        expect(action).toEqual(
            expect.objectContaining({
                metadata: {
                    actorId: attackerId,
                    spaceId: Battlefield,
                    role: 'serf',
                    cancelled: true
                }
            })
        )
    })

    it('R-3.14-H5 Royal Immunity scores no vp', () => {
        const combat = asked()
        answerStarve(combat, true)
        expect(combat.table.seat(combat.defenderId).score).toBe(0)
    })

    it('R-3.14.2 a seal goes under a subject just the same', () => {
        const combat = asked(['defend', 'tax'], 'subject')
        answerStarve(combat, true)
        expect(combat.table.state.spaces[Battlefield].ruler).toEqual({
            playerId: combat.defenderId,
            subject: true,
            subjectImmune: true
        })
    })

    it('R-3.2 a cancelled Starve spends the card: the turn passes', () => {
        const combat = asked()
        const { table, attackerId } = combat
        answerStarve(combat, true)
        expect(table.seat(attackerId).played).toEqual([{ kind: 'conquer', use: 'special' }])
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).not.toBe(attackerId)
    })

    it('R-3.14-H1 "no" is legal without Defend: the Starve resolves whole', () => {
        const combat = asked(['tax', 'guild'])
        const { table, attackerId, defenderId } = combat
        const bead = table.state.guilds.farmer.chickens['guild.farmer.chicken.1']

        const [action] = answerStarve(combat)

        expect(table.state.spaces[Battlefield].serf).toBeUndefined()
        expect(table.state.guilds.farmer.chickens['guild.farmer.chicken.1']).toBeNull()
        expect(table.seat(defenderId).goods.food).toBe(1)
        expect(table.seat(defenderId).hand).toEqual(['tax', 'guild'])
        expect(table.state.flow.starve).toBeUndefined()
        expect(action.revealsInfo).toBe(true)
        expect(action).toMatchObject({
            metadata: {
                actorId: attackerId,
                spaceId: Battlefield,
                role: 'serf',
                cancelled: false,
                starved: { beads: [bead] }
            }
        })
        expect(table.state.machineState).toBe(MachineState.PlacingDisc)
        expect(table.state.activePlayerIds).toEqual([attackerId])
    })

    it('R-3.14-H1 "no" with Defend in hand keeps the card', () => {
        const combat = asked()
        answerStarve(combat)
        expect(combat.table.seat(combat.defenderId).hand).toEqual(['defend', 'tax'])
    })

    it('R-3.14.2 refuses Royal Immunity without Defend in hand', () => {
        const combat = asked(['tax', 'guild'])
        expect(() => answerStarve(combat, true)).toThrow("Defend isn't in your hand.")
    })

    it('R-3.14.2 refuses when nothing is waiting, and another seat', () => {
        const combat = asked()
        const { table, attackerId, defenderId } = combat
        const hydrated = table.hydrated()
        expect(reasonAnswerStarveRefused(hydrated, attackerId, false)).toBe(
            'No Starve the People on you is waiting.'
        )
        answerStarve(combat, true)
        expect(reasonAnswerStarveRefused(table.hydrated(), defenderId, false)).toBe(
            'No Starve the People on you is waiting.'
        )
    })

    it('R-3.14.2 refuses Royal Immunity short of the food', () => {
        const combat = asked()
        const { table, defenderId } = combat
        const state = table.hydrated()
        const { goods } = state.getPlayerState(defenderId)
        state.supply.haversack.food += goods.food
        goods.food = 0
        expect(reasonAnswerStarveRefused(state, defenderId, true)).toBe(
            'Royal Immunity needs a food.'
        )
        expect(reasonAnswerStarveRefused(state, defenderId, false)).toBeUndefined()
    })

    it('R-3.14-H4 refuses Royal Immunity with no seal in the pile', () => {
        const combat = asked()
        const { table, defenderId } = combat
        const state = table.hydrated()
        state.supply.sealPileCount = 0
        expect(reasonAnswerStarveRefused(state, defenderId, true)).toBe(
            'No seal is left in the pile.'
        )
        expect(reasonAnswerStarveRefused(state, defenderId, false)).toBeUndefined()
    })

    it('R-3.14-H3, R-4.4-H1 a wild tile covers the food, so its holder is asked', () => {
        const combat = tableAtStarve()
        const { table, defenderId } = combat
        let tileId = ''
        setUp(table, (state) => {
            tileId = collectTopTile(state, defenderId, 'sea').tile.id
        })
        const [asks] = starve(combat)
        expect(asks.revealsInfo).toBe(true)
        expect(answerStarveOffer(table.hydrated(), defenderId)).toMatchObject({
            holdsDefend: true,
            wildTileNeeded: true,
            revealsInfo: true
        })

        answerStarve(combat, true, { wildTiles: [{ tileId, good: 'food' }] })

        expect(table.seat(defenderId).regionTiles).toEqual([])
        expect(table.seat(defenderId).goods.food).toBe(0)
        expect(table.state.spaces[Battlefield].serf?.immune).toBe(true)
    })

    it('R-4.4-H1, R-3.14-H3 a defender holding the food spends no tile through AnswerStarve', () => {
        const combat = tableAtStarve()
        const { table, defenderId } = combat
        let tileId = ''
        setUp(table, (state) => {
            giveFood(state, defenderId)
            tileId = collectTopTile(state, defenderId, 'sea').tile.id
        })
        expect(conservationBreaks(canonicalOf(table.hydrated()))).toEqual([])
        starve(combat)
        const iron = table.seat(defenderId).goods.iron

        expect(() => answerStarve(combat, true, { wildTiles: [{ tileId, good: 'iron' }] })).toThrow(
            'A wild tile may cover only the food Royal Immunity is short of.'
        )
        expect(() => answerStarve(combat, true, { wildTiles: [{ tileId, good: 'food' }] })).toThrow(
            'A wild tile may cover only the food Royal Immunity is short of.'
        )
        expect(table.seat(defenderId).goods.iron).toBe(iron)
        expect(table.seat(defenderId).regionTiles).toEqual([tileId])
        expect(table.state.machineState).toBe(MachineState.AwaitingImmunity)
    })

    it('R-4.4-H1, R-3.14-H3 a defender short one food spends one tile, on food, and no second', () => {
        const combat = tableAtStarve()
        const { table, defenderId } = combat
        const tiles: string[] = []
        setUp(table, (state) => {
            tiles.push(collectTopTile(state, defenderId, 'sea').tile.id)
            tiles.push(collectTopTile(state, defenderId, 'mountain').tile.id)
        })
        starve(combat)
        const saltpeter = table.seat(defenderId).goods.saltpeter

        expect(() =>
            answerStarve(combat, true, {
                wildTiles: [
                    { tileId: tiles[0], good: 'food' },
                    { tileId: tiles[1], good: 'saltpeter' }
                ]
            })
        ).toThrow('A wild tile may cover only the food Royal Immunity is short of.')
        expect(table.seat(defenderId).goods.saltpeter).toBe(saltpeter)
        expect(table.seat(defenderId).regionTiles).toEqual(tiles)
    })

    it('R-4.4-H1 a defender who lets the Starve stand spends no tile', () => {
        const combat = tableAtStarve()
        const { table, defenderId } = combat
        let tileId = ''
        setUp(table, (state) => {
            tileId = collectTopTile(state, defenderId, 'sea').tile.id
        })
        starve(combat)

        expect(() =>
            answerStarve(combat, false, { wildTiles: [{ tileId, good: 'food' }] })
        ).toThrow('Letting it stand spends no wild tile.')
        expect(table.seat(defenderId).regionTiles).toEqual([tileId])
    })

    it('R-3.14-H1, R-5 the offer goes to the owner alone', () => {
        const combat = asked()
        const { table, attackerId, defenderId, thirdId } = combat
        const state = table.hydrated()
        expect(answerStarveOffer(state, defenderId)).toEqual({
            actorId: attackerId,
            spaceId: Battlefield,
            role: 'serf',
            holdsDefend: true,
            wildTileNeeded: false,
            revealsInfo: true
        })
        expect(answerStarveOffer(state, attackerId)).toBeUndefined()
        expect(answerStarveOffer(state, thirdId)).toBeUndefined()
    })
})

describe('R-3.14.2, R-3.14-H2 ReclaimImmunitySeal', () => {
    function immune(hand: ActionCardKind[] = ['tax', 'guild']) {
        const combat = tableAtStarve('serf', hand)
        sealUnder(combat)
        return combat
    }

    /** The owner's own turn, the card still to play. */
    function onOwnersTurn({ table, defenderId }: StarveTable) {
        table.moveTo((state) => {
            giveCardTurn(state, defenderId)
            return MachineState.PlayingCards
        })
    }

    it('R-3.14.2 returns the seal to the seat, unseen; not a barrier (S39)', () => {
        const combat = immune()
        const { table, defenderId } = combat
        onOwnersTurn(combat)
        const [sealId] = Object.values(table.hydrated().requireVault().immunitySeals)
        const seals = table.seat(defenderId).sealCount

        const [action] = reclaim(combat)

        expect(table.seat(defenderId).sealCount).toBe(seals + 1)
        expect(table.hydrated().requireVault().heldSeals[defenderId]).toContain(sealId)
        expect(table.hydrated().requireVault().immunitySeals).toEqual({})
        expect(table.state.spaces[Battlefield].serf).toEqual({ playerId: defenderId })
        expect(action.revealsInfo).toBeFalsy()
        expect(action).not.toHaveProperty('metadata')
    })

    it('R-3.14-H2 plays no card and leaves the turn where it was', () => {
        const combat = immune()
        const { table, defenderId } = combat
        onOwnersTurn(combat)
        reclaim(combat)
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).toBe(defenderId)
        expect(table.seat(defenderId).hand).toEqual(['tax', 'guild'])
        expect(table.seat(defenderId).played).toEqual([])
    })

    it('R-3.14.2 ends the protection: the marker can be starved again', () => {
        const combat = immune()
        const { table, attackerId } = combat
        onOwnersTurn(combat)
        reclaim(combat)
        table.moveTo((state) => {
            giveCardTurn(state, attackerId)
            return MachineState.PlayingCards
        })
        starve(combat)
        expect(table.state.spaces[Battlefield].serf).toBeUndefined()
    })

    it('R-3.14-H2 is offered on the seat’s own turn, and no one else’s', () => {
        const combat = immune()
        const { table, attackerId, defenderId } = combat
        expect(table.offered(attackerId)).not.toContain(ActionType.ReclaimImmunitySeal)
        expect(table.offered(defenderId)).not.toContain(ActionType.ReclaimImmunitySeal)
        expect(() => reclaim(combat)).toThrow()
        onOwnersTurn(combat)
        expect(table.offered(defenderId)).toContain(ActionType.ReclaimImmunitySeal)
        expect(reclaimImmunitySealOffers(table.hydrated(), defenderId)).toEqual([
            { spaceId: Battlefield, role: 'serf' }
        ])
    })

    it('R-3.14-H2 is not offered with no seal down', () => {
        const combat = tableAtStarve()
        const { table, defenderId } = combat
        onOwnersTurn(combat)
        expect(table.offered(defenderId)).not.toContain(ActionType.ReclaimImmunitySeal)
        expect(reclaimImmunitySealOffers(table.hydrated(), defenderId)).toEqual([])
    })

    it('R-3.14-H2 is not an answer: the asked seat cannot take it in AwaitingImmunity', () => {
        const combat = immune(['defend', 'tax'])
        const { table, defenderId } = combat
        setUp(table, (state) => {
            giveFood(state, defenderId)
            state.spaces[Battlefield].ruler = {
                playerId: combat.attackerId,
                subject: false
            }
        })
        table.moveTo((state) => {
            state.flow.starve = {
                targetPlayerId: defenderId,
                spaceId: Battlefield,
                role: 'serf'
            }
            return MachineState.AwaitingImmunity
        })
        expect(table.offered(defenderId)).toEqual([ActionType.AnswerStarve])
        expect(() => reclaim(combat)).toThrow()
    })

    it('R-3.14-H2 a seat yet to finalise may reclaim during hand selection', () => {
        const combat = immune()
        const { table, defenderId } = combat
        table.moveTo((state) => {
            endCardTurn(state)
            state.flow.selection = { finalised: [] }
            state.turnManager.turnOrder = [
                defenderId,
                ...state.turnManager.turnOrder.filter((playerId) => playerId !== defenderId)
            ]
            return MachineState.SelectingHands
        })
        expect(table.asked).toBe(defenderId)
        expect(table.offered(defenderId)).toContain(ActionType.ReclaimImmunitySeal)

        reclaim(combat)

        expect(table.state.machineState).toBe(MachineState.SelectingHands)
        expect(table.asked).toBe(defenderId)
        expect(table.state.spaces[Battlefield].serf?.immune).toBeUndefined()
    })

    it('R-3.14.2 refuses a marker with no seal, and another seat’s', () => {
        const combat = immune()
        const { table, attackerId, defenderId } = combat
        onOwnersTurn(combat)
        const state = table.hydrated()
        expect(reasonReclaimImmunitySealRefused(state, defenderId, Battlefield, 'subject')).toBe(
            'No seal lies under a marker of yours there.'
        )
        expect(reasonReclaimImmunitySealRefused(state, attackerId, Battlefield, 'serf')).toBe(
            "It isn't your turn."
        )
    })

    it('R-4.1-H1 a seal that followed its marker to the subject is reclaimed from there', () => {
        const combat = immune()
        const { table, attackerId, defenderId } = combat
        setUp(table, (state) => placeMarker(state, defenderId, Battlefield))
        onOwnersTurn(combat)
        expect(table.state.spaces[Battlefield].ruler).toEqual({
            playerId: defenderId,
            subject: true,
            subjectImmune: true
        })
        expect(table.state.spaces[Battlefield].serf).toEqual({ playerId: attackerId })
        const seals = table.seat(defenderId).sealCount

        reclaim({ ...combat, role: 'subject' })

        expect(table.seat(defenderId).sealCount).toBe(seals + 1)
        expect(table.state.spaces[Battlefield].ruler?.subjectImmune).toBeUndefined()
    })
})

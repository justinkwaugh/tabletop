import { describe, expect, it } from 'vitest'
import type { WritId } from '../data/writs.js'
import { MachineState } from '../definition/states.js'
import { discChoices, feudumGuildOf, replaceLocationDisc } from '../model/locationDiscs.js'
import { boardableVessels } from '../model/media.js'
import { moveConcealedSeal } from '../model/seals.js'
import { collectTopTile } from '../model/regionStacks.js'
import { placeMarker } from '../model/locationControl.js'
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
    tableAtCombat,
    type CombatTable
} from '../testing/combat.js'
import { giveGood, setUp } from '../testing/improving.js'
import {
    commitAttackOffer,
    commitAttackPreview,
    reasonCommitAttackRefused
} from './commitAttack.js'
import { ActionType } from '../definition/actions.js'
import { cardTurnSeat } from '../model/turns.js'

const Bow: WritId = 'writ.mandate.1'
const Sword: WritId = 'writ.mandate.3'

/** A Conquer of the defender's first pawn, answered "no". */
function atCommit(combat: CombatTable = tableAtCombat()): CombatTable {
    conquer(combat, PawnOf(combat.defenderId))
    answer(combat)
    return combat
}

/** The attacker's three pawns on the space outfight one defending pawn. */
function winning(): CombatTable {
    const combat = tableAtCombat()
    const { table, attackerId } = combat
    setUp(table, (state) => {
        addPawn(state, attackerId)
        addPawn(state, attackerId)
    })
    return combat
}

/** 3 attack against a feudum with a lone ruler and no pawn: 3 vs 2. */
function winningFeudum(edit?: Parameters<typeof setUp>[1]): CombatTable {
    const combat = winning()
    const { table, defenderId } = combat
    setUp(table, (state) => {
        state.getPlayerState(defenderId).pawns[0].spaceId = 'space.forest.1'
        buildFeudum(state, defenderId)
        state.recomputeRanks()
        edit?.(state)
    })
    return combat
}

function conquerFeudum(combat: CombatTable, input = {}) {
    conquer(combat, { kind: 'feudum' })
    answer(combat)
    return commit(combat, input)
}

describe('R-4.8.2, R-4.4-H1 CommitAttack', () => {
    it('R-4.8.2 one saltpeter is +1, goes to the haversack, and is no barrier', () => {
        const combat = atCommit()
        const { table, attackerId } = combat
        const before = table.seat(attackerId).goods.saltpeter
        const pile = table.state.supply.haversack.saltpeter

        const [action] = commit(combat, { saltpeter: 1 })

        expect(table.seat(attackerId).goods.saltpeter).toBe(before - 1)
        expect(table.state.supply.haversack.saltpeter).toBe(pile + 1)
        expect(action.revealsInfo).toBeFalsy()
        expect(action).toMatchObject({
            metadata: {
                attack: { pawns: 1, saltpeter: 1, total: 2 },
                defence: { pawns: 2, total: 2 },
                attackerWins: false
            }
        })
    })

    it('R-4.8.2 more than one saltpeter needs an attacking knight', () => {
        const combat = tableAtCombat()
        const { table, attackerId } = combat
        setUp(table, (state) => {
            giveGood(state, attackerId, 'saltpeter')
        })
        atCommit(combat)
        expect(() => commit(combat, { saltpeter: 2 })).toThrow(
            'Only an attacking knight may add more than one saltpeter.'
        )
    })

    it('R-4.8.2 any number with an attacking knight, drunk or not', () => {
        const combat = tableAtCombat()
        const { table, attackerId } = combat
        setUp(table, (state) => {
            const [pawn] = state.getPlayerState(attackerId).pawns
            pawn.character = 'knight'
            pawn.wine = 'drunk'
            state.supply.haversack.sulfur -= 1
            giveGood(state, attackerId, 'saltpeter', 2)
            state.recomputeRanks()
        })
        atCommit(combat)
        const [action] = commit(combat, { saltpeter: 3 })
        expect(action).toMatchObject({
            metadata: { attack: { pawns: 0, saltpeter: 3, total: 3 }, attackerWins: true }
        })
    })

    it('R-4.8.2 refuses saltpeter the seat cannot pay', () => {
        const combat = tableAtCombat()
        const { table, attackerId } = combat
        setUp(table, (state) => {
            emptyGoods(state, attackerId)
            holdWrit(state, attackerId, Sword)
        })
        atCommit(combat)
        expect(() => commit(combat, { saltpeter: 1 })).toThrow("You can't pay for that.")
    })

    it('R-4.4-H1, R-4.8-H6 a wild tile covers a saltpeter the seat lacks', () => {
        const combat = tableAtCombat()
        const { table, attackerId } = combat
        let tileId = ''
        setUp(table, (state) => {
            emptyGoods(state, attackerId)
            tileId = collectTopTile(state, attackerId, 'sea').tile.id
        })
        atCommit(combat)
        commit(combat, { saltpeter: 1, wildTiles: [{ tileId, good: 'saltpeter' }] })
        expect(table.seat(attackerId).regionTiles).toEqual([])
        expect(table.seat(attackerId).goods.saltpeter).toBe(0)
    })

    it('R-4.4-H1 a weapon reads its strength and price through the registry (S36)', () => {
        const combat = tableAtCombat()
        const { table, attackerId } = combat
        setUp(table, (state) => {
            holdWrit(state, attackerId, Sword)
        })
        atCommit(combat)
        const slot = table.state.writDeck.nextBottom

        const [action] = commit(combat, {
            saltpeter: 1,
            weapons: [{ writId: Sword, alternative: 0 }]
        })

        const seat = table.seat(attackerId)
        expect(seat.requireWrits()).toEqual([])
        expect(seat.writCount).toBe(0)
        expect(table.state.publicDeckWrits).toContainEqual({ slot, writId: Sword })
        expect(action).toMatchObject({
            metadata: {
                attack: { pawns: 1, saltpeter: 1, weapons: 1, total: 3 },
                weaponStrengths: [{ writId: Sword, attack: 1, slot }],
                attackerWins: true,
                vp: 2
            }
        })
    })

    it('R-4.4-H1 a weapon’s turn-in is paid, and its tile may cover it', () => {
        const combat = tableAtCombat()
        const { table, attackerId } = combat
        setUp(table, (state) => {
            holdWrit(state, attackerId, Sword)
        })
        atCommit(combat)
        const iron = table.seat(attackerId).goods.iron
        const [action] = commit(combat, { weapons: [{ writId: Sword, alternative: 1 }] })
        expect(table.seat(attackerId).goods.iron).toBe(iron - 1)
        expect(action).toMatchObject({
            metadata: { attack: { weapons: 2, total: 3 }, attackerWins: true }
        })
    })

    it('R-4.4-H1 refuses a writ not held, a writ twice, and what the registry refuses', () => {
        const combat = tableAtCombat()
        const { table, attackerId } = combat
        setUp(table, (state) => {
            holdWrit(state, attackerId, Sword)
            holdWrit(state, attackerId, 'writ.mandate.2')
        })
        atCommit(combat)
        const state = table.hydrated()
        const refusal = (writId: WritId, alternative = 0, copies = 1) =>
            reasonCommitAttackRefused(state, attackerId, {
                saltpeter: 0,
                weapons: Array.from({ length: copies }, () => ({ writId, alternative })),
                wildTiles: []
            })
        expect(refusal(Bow)).toBe("You don't hold that writ.")
        expect(refusal(Sword, 0, 2)).toBe('Each writ plays once.')
        expect(refusal(Sword, 2)).toBe(`${Sword} has no such alternative: 2`)
        expect(refusal('writ.mandate.2')).toBe('writ.mandate.2 has no effect in an attack')
    })

    it('R-4.4.2 a weapon goes under in view: mandates are one use', () => {
        const combat = tableAtCombat()
        const { table, attackerId } = combat
        setUp(table, (state) => {
            holdWrit(state, attackerId, Bow)
        })
        atCommit(combat)
        commit(combat, { weapons: [{ writId: Bow, alternative: 0 }] })
        expect(table.state.publicDeckWrits.map((known) => known.writId)).toContain(Bow)
    })

    it('R-4.8.2 only the attacker commits', () => {
        const { table, defenderId, attackerId } = atCommit()
        expect(table.offered(defenderId)).toEqual([])
        expect(table.offered(attackerId)).toEqual([ActionType.CommitAttack])
        expect(
            reasonCommitAttackRefused(table.hydrated(), defenderId, {
                saltpeter: 0,
                weapons: [],
                wildTiles: []
            })
        ).toBe('No attack of yours is waiting.')
    })

    it('R-4.8.2 the offer and preview read the real rule (S36)', () => {
        const combat = tableAtCombat()
        const { table, attackerId } = combat
        setUp(table, (state) => {
            holdWrit(state, attackerId, Sword)
        })
        atCommit(combat)
        const state = table.hydrated()

        expect(commitAttackOffer(state, attackerId)).toMatchObject({
            saltpeterMost: 1,
            weapons: [
                { writId: Sword, alternative: 0, attack: 1, turnedIn: [] },
                { writId: Sword, alternative: 1, attack: 2, turnedIn: ['iron'] }
            ]
        })
        expect(
            commitAttackPreview(state, attackerId, {
                saltpeter: 1,
                weapons: [{ writId: Sword, alternative: 0 }]
            })
        ).toMatchObject({
            strength: { attack: { total: 3 }, defence: { total: 2 }, attackerWins: true },
            vp: 2
        })
        expect(commitAttackPreview(state, attackerId, { saltpeter: 2 })).toMatchObject({
            refused: 'Only an attacking knight may add more than one saltpeter.'
        })
        expect(commitAttackPreview(state, combat.defenderId, {})).toBeUndefined()
    })
})

describe('R-4.8.2, R-4.8-H1, R-4.10.2 who joins', () => {
    it('R-4.8-H1 every piece of both sides on the space joins; a third seat’s do not', () => {
        const combat = tableAtCombat()
        const { table, attackerId, defenderId } = combat
        setUp(table, (state) => {
            addPawn(state, attackerId)
            giveMonster(state, attackerId, 'behemoth')
            addPawn(state, defenderId)
            giveMonster(state, defenderId, 'sea-serpent')
        })
        const [action] = commit(atCommit(combat))
        expect(action).toMatchObject({
            metadata: {
                attack: { pawns: 2, monsters: 1, total: 3 },
                defence: { pawns: 4, monsters: 1, total: 5 },
                attackerWins: false
            }
        })
    })

    it('R-4.10.2 a drunk pawn counts 0, on either side', () => {
        const combat = tableAtCombat()
        const { table, attackerId, defenderId } = combat
        setUp(table, (state) => {
            addPawn(state, attackerId)
            state.getPlayerState(attackerId).pawns[0].wine = 'drunk'
            state.getPlayerState(defenderId).pawns[0].wine = 'drunk'
            state.supply.haversack.sulfur -= 2
        })
        const [action] = commit(atCommit(combat))
        expect(action).toMatchObject({
            metadata: {
                attack: { pawns: 1, total: 1 },
                defence: { pawns: 0, total: 0 },
                attackerWins: true
            }
        })
    })

    it('R-4.8.2 attack must exceed defence: a tie loses', () => {
        const combat = tableAtCombat()
        const { table, attackerId } = combat
        setUp(table, (state) => {
            addPawn(state, attackerId)
        })
        const [action] = commit(atCommit(combat))
        expect(action).toMatchObject({
            metadata: { attack: { total: 2 }, defence: { total: 2 }, attackerWins: false }
        })
    })
})

describe('R-4.8.3 a win', () => {
    it('R-4.8.3 a pawn goes home with 2 vp; status recomputes; the military follow-up comes (S36)', () => {
        const combat = winning()
        const { table, attackerId, defenderId } = combat
        conquer(combat, PawnOf(defenderId))
        answer(combat)

        const [action] = commit(combat)

        const pawn = table.seat(defenderId).pawns[0]
        expect(pawn.spaceId).toBeUndefined()
        expect(pawn.character).toBeUndefined()
        expect(table.seat(attackerId).score).toBe(2)
        expect(table.state.flow.combat).toBeUndefined()
        expect(table.state.machineState).toBe(MachineState.PlacingDisc)
        expect(table.asked).toBe(attackerId)
        expect(table.state.flow.turn?.followUps).toEqual([
            { kind: 'military', playerId: attackerId }
        ])
        expect(action).toMatchObject({
            metadata: {
                defendFlipped: false,
                attack: { pawns: 3, total: 3 },
                defence: { pawns: 2, total: 2 },
                attackerWins: true,
                vp: 2,
                conquered: { kind: 'pawn', n: 1, character: 'farmer' }
            }
        })
        expect(action).toHaveProperty('metadata.rankChanges')
    })

    it('R-4.5.4 the rank the pawn held is recomputed and named', () => {
        const combat = winning()
        const { table, defenderId } = combat
        setUp(table, (state) => {
            state.getPlayerState(defenderId).pawns[0].character = 'monk'
            state.recomputeRanks()
        })
        expect(table.state.guilds.tracks.monk.master?.playerId).toBe(defenderId)
        conquer(combat, PawnOf(defenderId))
        answer(combat)
        const [action] = commit(combat)
        expect(table.state.guilds.tracks.monk.master).toBeUndefined()
        expect(action).toMatchObject({
            metadata: {
                rankChanges: expect.arrayContaining([
                    { guildId: 'monk', playerId: defenderId, from: 'master' }
                ])
            }
        })
    })

    it('R-4.2.2, R-4.8-H4 a conquered pawn’s vessel stays; its wine’s sulfur goes to the haversack', () => {
        const combat = winning()
        const { table, defenderId } = combat
        setUp(table, (state) => {
            const [pawn] = state.getPlayerState(defenderId).pawns
            state.supply.vessels.ship -= 1
            pawn.vessel = 'ship'
            pawn.wine = 'fed'
            state.supply.haversack.sulfur -= 1
        })
        const before = table.state.spaces[Battlefield].vessels.ship
        const pile = table.state.supply.haversack.sulfur
        conquer(combat, PawnOf(defenderId))
        answer(combat)
        const [action] = commit(combat)
        expect(table.state.spaces[Battlefield].vessels.ship).toBe(before + 1)
        expect(table.state.supply.haversack.sulfur).toBe(pile + 1)
        expect(action).toMatchObject({
            metadata: { conquered: { kind: 'pawn', vessel: 'ship', wine: true } }
        })
    })

    it('R-4.2-H2 a conquered pawn’s vessel is left this turn: no pawn boards it until the turn ends', () => {
        const combat = winning()
        const { table, attackerId, defenderId } = combat
        setUp(table, (state) => {
            const [pawn] = state.getPlayerState(defenderId).pawns
            state.supply.vessels.ship -= 1
            pawn.vessel = 'ship'
        })
        const boardable = boardableVessels(table.hydrated(), Battlefield, 'ship')
        conquer(combat, PawnOf(defenderId))
        answer(combat)
        commit(combat)
        const after = table.hydrated()
        expect(cardTurnSeat(after)).toBe(attackerId)
        expect(after.spaces[Battlefield].vessels.ship).toBe(boardable + 1)
        expect(boardableVessels(after, Battlefield, 'ship')).toBe(boardable)
    })

    it('R-4.8.3, R-6.2 a monster goes to the Knight Guild, its marker home; defeatedMonster is set', () => {
        const combat = tableAtCombat()
        const { table, attackerId, defenderId } = combat
        setUp(table, (state) => {
            addPawn(state, attackerId)
            addPawn(state, attackerId)
            giveMonster(state, defenderId, 'behemoth')
            state.getPlayerState(defenderId).pawns[0].spaceId = 'space.forest.1'
        })
        const markers = table.seat(defenderId).influenceSupply
        conquer(combat, { kind: 'monster', monsterId: 'behemoth' })
        answer(combat)

        const [action] = commit(combat)

        expect(table.state.monsters.behemoth).toEqual({})
        expect(table.seat(defenderId).influenceSupply).toBe(markers + 1)
        expect(table.seat(attackerId).defeatedMonster).toBe(true)
        expect(table.seat(attackerId).score).toBe(2)
        expect(action).toMatchObject({
            metadata: {
                attack: { pawns: 3, total: 3 },
                defence: { monsters: 1, total: 1 },
                conquered: { kind: 'monster', monsterId: 'behemoth' }
            }
        })
    })

    it('R-4.8.3 other defending pieces are unharmed', () => {
        const combat = winning()
        const { table, attackerId, defenderId } = combat
        setUp(table, (state) => {
            giveMonster(state, attackerId, 'behemoth')
            giveMonster(state, defenderId, 'sea-serpent')
        })
        conquer(combat, PawnOf(defenderId))
        answer(combat)
        commit(combat, { saltpeter: 1 })
        expect(table.state.monsters['sea-serpent'].playerId).toBe(defenderId)
        expect(table.seat(attackerId).defeatedMonster).toBe(false)
    })

    it('R-4.8.3 a feudum becomes an outpost, markers home; goods and landscape stay; 4 vp', () => {
        let landscape = ''
        const combat = winningFeudum((state) => {
            state.spaces[Battlefield].goods.iron += 1
            state.supply.haversack.iron -= 1
            const rulerId = state.spaces[Battlefield].ruler?.playerId ?? ''
            const { tile } = collectTopTile(state, rulerId, 'desert')
            state.getPlayerState(rulerId).regionTiles.pop()
            state.spaces[Battlefield].landscape = { tileId: tile.id, amount: 0 }
            landscape = tile.id
        })
        const { table, attackerId, defenderId, thirdId } = combat
        setUp(table, (state) => {
            placeMarker(state, defenderId, Battlefield)
            placeMarker(state, thirdId, Battlefield)
        })
        const seat = table.seat(defenderId).influenceSupply
        const third = table.seat(thirdId).influenceSupply

        conquer(combat, { kind: 'feudum' })
        answer(combat)
        const [action] = commit(combat, { saltpeter: 1 })

        const space = table.state.spaces[Battlefield]
        expect(space.location.kind).toBe('outpost')
        expect(feudumGuildOf(space.location)).toBeUndefined()
        expect(table.state.supply.discs).toContain('disc.feudum.knight-1')
        expect(space.ruler).toBeUndefined()
        expect(space.serf).toBeUndefined()
        // Two from the feudum, and the one on the Knight track the lost stars gave up (R-4.5.4).
        expect(table.seat(defenderId).influenceSupply).toBe(seat + 3)
        expect(table.seat(thirdId).influenceSupply).toBe(third + 1)
        expect(space.goods.iron).toBe(1)
        expect(space.landscape?.tileId).toBe(landscape)
        expect(table.seat(attackerId).score).toBe(4)
        expect(action).toMatchObject({
            metadata: {
                vp: 4,
                attack: { pawns: 3, saltpeter: 1, serf: 0, total: 4 },
                defence: { pawns: 0, feudum: 2, subject: 1, total: 3 },
                conquered: {
                    kind: 'feudum',
                    discId: space.location.discId,
                    markersHome: expect.arrayContaining([
                        { playerId: defenderId, count: 2 },
                        { playerId: thirdId, count: 1 }
                    ])
                }
            }
        })
    })

    it('R-4.8.3 the attacker’s serf becomes the outpost’s ruler (S37)', () => {
        const combat = winningFeudum()
        const { table, attackerId, defenderId } = combat
        setUp(table, (state) => {
            placeMarker(state, attackerId, Battlefield)
        })
        const markers = table.seat(attackerId).influenceSupply

        const [action] = conquerFeudum(combat)

        const space = table.state.spaces[Battlefield]
        expect(space.ruler).toEqual({ playerId: attackerId, subject: false })
        expect(space.serf).toBeUndefined()
        expect(table.seat(attackerId).influenceSupply).toBe(markers)
        expect(action).toMatchObject({
            metadata: {
                attack: { pawns: 3, serf: 1, total: 4 },
                conquered: {
                    kind: 'feudum',
                    newRulerId: attackerId,
                    markersHome: [{ playerId: defenderId, count: 1 }]
                }
            }
        })
    })

    it('R-4.5.4 the feudum’s stars leave; rank changes are named (S37)', () => {
        const combat = winningFeudum()
        const { table, defenderId } = combat
        expect(table.state.guilds.tracks.knight.master?.playerId).toBe(defenderId)
        const [action] = conquerFeudum(combat)
        expect(table.state.guilds.tracks.knight.master).toBeUndefined()
        expect(action).toMatchObject({
            metadata: {
                rankChanges: expect.arrayContaining([
                    { guildId: 'knight', playerId: defenderId, from: 'master' }
                ])
            }
        })
    })

    it('R-4.8-H2 takes the lowest outpost disc in the supply, unasked', () => {
        const combat = winningFeudum()
        const { table } = combat
        const [lowest] = discChoices(table.hydrated(), 'outpost')
        conquerFeudum(combat)
        expect(table.state.spaces[Battlefield].location).toMatchObject({
            kind: 'outpost',
            discId: lowest.discId
        })
    })

    it('R-4.8-H2 with no outpost disc in the supply, the feudum’s own disc shows the outpost', () => {
        const combat = winningFeudum((state) => {
            for (const spaceId of Object.keys(state.spaces) as (keyof typeof state.spaces)[]) {
                const [choice] = discChoices(state, 'outpost')
                if (
                    choice &&
                    spaceId !== Battlefield &&
                    state.spaces[spaceId].location.kind !== 'outpost'
                ) {
                    replaceLocationDisc(state, spaceId, choice.discId, 'outpost')
                }
            }
        })
        const { table } = combat
        expect(discChoices(table.hydrated(), 'outpost')).toEqual([])

        const [action] = conquerFeudum(combat)

        expect(table.state.spaces[Battlefield].location).toMatchObject({
            kind: 'outpost',
            discId: 'disc.feudum.knight-1'
        })
        expect(feudumGuildOf(table.state.spaces[Battlefield].location)).toBeUndefined()
        expect(action).toMatchObject({
            metadata: { conquered: { kind: 'feudum', discId: 'disc.feudum.knight-1' } }
        })
    })

    it('R-4.8-H3 a seal under a marker going home, or under the rebel, goes to its owner', () => {
        const combat = winningFeudum()
        const { table, attackerId, defenderId } = combat
        setUp(table, (state) => {
            placeMarker(state, defenderId, Battlefield)
            placeMarker(state, attackerId, Battlefield)
            moveConcealedSeal(
                state,
                { kind: 'pile' },
                { kind: 'immunity', spaceId: Battlefield, role: 'subject' }
            )
            moveConcealedSeal(
                state,
                { kind: 'pile' },
                { kind: 'immunity', spaceId: Battlefield, role: 'serf' }
            )
        })
        const seals = table.seat(defenderId).sealCount
        const rebels = table.seat(attackerId).sealCount
        conquer(combat, { kind: 'feudum' })
        answer(combat)
        commit(combat, { saltpeter: 1 })

        expect(table.seat(defenderId).sealCount).toBe(seals + 1)
        expect(table.seat(attackerId).sealCount).toBe(rebels + 1)
        expect(table.state.spaces[Battlefield].ruler).toEqual({
            playerId: attackerId,
            subject: false
        })
    })

    it('R-4.9-H1 the offer lapses when every space is covered', () => {
        const combat = winning()
        const { table, attackerId, defenderId } = combat
        setUp(table, (state) => {
            state.militaryService[attackerId] = 3
        })
        conquer(combat, PawnOf(defenderId))
        answer(combat)
        commit(combat)
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).not.toBe(attackerId)
    })

    it('R-4.9-H1 placing the disc ends the card', () => {
        const combat = winning()
        const { table, attackerId, defenderId } = combat
        conquer(combat, PawnOf(defenderId))
        answer(combat)
        commit(combat)
        table.send(attackerId, { type: ActionType.PlaceDisc, place: true })
        expect(table.state.militaryService[attackerId]).toBe(1)
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).not.toBe(attackerId)
    })
})

describe('R-4.8.3 a loss', () => {
    it('R-4.8.3 nothing happens but what the attacker spent; no follow-up', () => {
        const combat = tableAtCombat()
        const { table, attackerId, defenderId } = combat
        conquer(combat, PawnOf(defenderId))
        answer(combat)

        const [action] = commit(combat, { saltpeter: 1 })

        expect(table.seat(defenderId).pawns[0].spaceId).toBe(Battlefield)
        expect(table.seat(attackerId).score).toBe(0)
        expect(table.seat(attackerId).defeatedMonster).toBe(false)
        expect(table.state.flow.combat).toBeUndefined()
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).not.toBe(attackerId)
        expect(action).toMatchObject({
            metadata: { attackerWins: false, vp: 0, rankChanges: [] }
        })
        expect(action).not.toHaveProperty('metadata.conquered')
    })
})

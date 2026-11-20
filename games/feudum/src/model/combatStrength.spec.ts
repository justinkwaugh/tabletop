import { describe, expect, it } from 'vitest'
import type { SpaceId } from '../data/board.js'
import { initialState } from '../testing/state.js'
import { combatStrength, saltpeterAllowed, type CombatInput } from './combatStrength.js'
import { showLocation } from '../testing/improving.js'

const Space: SpaceId = 'space.forest.1'

function battle() {
    const state = initialState()
    const attacker = state.getPlayerState('p1')
    const defender = state.getPlayerState('p2')
    showLocation(state, Space, 'outpost')
    return { state, attacker, defender }
}

const Input: CombatInput = {
    attackerId: 'p1',
    defenderId: 'p2',
    spaceId: Space,
    target: 'pawn',
    saltpeter: 0,
    weapons: 0,
    defendFlipped: false
}

describe('R-4.8.2 combat strength', () => {
    it.each([
        { name: 'one pawn each', pawns: [1, 1], attack: 1, defence: 2, win: false },
        { name: 'two pawns against one', pawns: [2, 1], attack: 2, defence: 2, win: false },
        { name: 'three pawns against one', pawns: [3, 1], attack: 3, defence: 2, win: true },
        { name: 'three pawns against two', pawns: [3, 2], attack: 3, defence: 4, win: false }
    ])('$name: $attack against $defence', ({ pawns: [mine, theirs], attack, defence, win }) => {
        const { state, attacker, defender } = battle()
        attacker.pawns.slice(0, mine).forEach((pawn) => (pawn.spaceId = Space))
        defender.pawns.slice(0, theirs).forEach((pawn) => (pawn.spaceId = Space))

        const result = combatStrength(state, Input)

        expect(result.attack.total).toBe(attack)
        expect(result.defence.total).toBe(defence)
        expect(result.attackerWins).toBe(win)
    })

    it('attack must exceed defence: a tie loses', () => {
        const { state, attacker, defender } = battle()
        attacker.pawns[0].spaceId = Space
        defender.pawns[0].spaceId = Space
        const tied = combatStrength(state, { ...Input, weapons: 1 })
        expect([tied.attack.total, tied.defence.total, tied.attackerWins]).toEqual([2, 2, false])
        const ahead = combatStrength(state, { ...Input, weapons: 2 })
        expect([ahead.attack.total, ahead.attackerWins]).toEqual([3, true])
    })

    it('saltpeter and weapons add to the attack, Defend to the defence', () => {
        const { state, attacker, defender } = battle()
        attacker.pawns[0].spaceId = Space
        defender.pawns[0].spaceId = Space

        const result = combatStrength(state, {
            ...Input,
            saltpeter: 1,
            weapons: 3,
            defendFlipped: true
        })

        expect(result.attack).toEqual({
            pawns: 1,
            monsters: 0,
            saltpeter: 1,
            weapons: 3,
            serf: 0,
            total: 5
        })
        expect(result.defence).toEqual({
            pawns: 2,
            monsters: 0,
            feudum: 0,
            subject: 0,
            defend: 1,
            total: 3
        })
    })

    it('a monster is +1 on either side', () => {
        const { state, attacker, defender } = battle()
        attacker.pawns[0].spaceId = Space
        state.monsters.behemoth = { playerId: 'p1', spaceId: Space }
        defender.pawns[0].spaceId = Space
        state.monsters['sea-serpent'] = { playerId: 'p2', spaceId: Space }

        const result = combatStrength(state, Input)

        expect(result.attack.monsters).toBe(1)
        expect(result.attack.total).toBe(2)
        expect(result.defence.monsters).toBe(1)
        expect(result.defence.total).toBe(3)
    })

    it('only the attacker and the defender count', () => {
        const { state, attacker, defender } = battle()
        attacker.pawns[0].spaceId = Space
        defender.pawns[0].spaceId = Space
        state.getPlayerState('p3').pawns[0].spaceId = Space
        state.monsters.behemoth = { playerId: 'p3', spaceId: Space }

        const result = combatStrength(state, Input)

        expect([result.attack.total, result.defence.total]).toEqual([1, 2])
    })

    it('R-4.8-H1 every piece on the space joins, and none elsewhere', () => {
        const { state, attacker, defender } = battle()
        attacker.pawns[0].spaceId = Space
        attacker.pawns[1].spaceId = 'space.forest.2'
        defender.pawns[0].spaceId = Space
        defender.pawns[1].spaceId = 'space.forest.2'
        state.monsters.behemoth = { playerId: 'p1', spaceId: 'space.forest.2' }

        const result = combatStrength(state, Input)

        expect([result.attack.total, result.defence.total]).toEqual([1, 2])
    })

    it("a feudum adds +2, its subject +1, and the attacker's serf +1 to the attack", () => {
        const { state, attacker, defender } = battle()
        attacker.pawns[0].spaceId = Space
        showLocation(state, Space, 'feudum')
        state.spaces[Space].ruler = { playerId: 'p2', subject: true }
        state.spaces[Space].serf = { playerId: 'p1' }

        const result = combatStrength(state, { ...Input, target: 'feudum' })

        expect(result.attack).toMatchObject({ pawns: 1, serf: 1, total: 2 })
        expect(result.defence).toMatchObject({ feudum: 2, subject: 1, total: 3 })

        defender.pawns[0].spaceId = Space
        expect(combatStrength(state, { ...Input, target: 'feudum' }).defence.total).toBe(5)
    })

    it('a feudum without a subject, or a serf of someone else, adds nothing further', () => {
        const { state, attacker } = battle()
        attacker.pawns[0].spaceId = Space
        showLocation(state, Space, 'feudum')
        state.spaces[Space].ruler = { playerId: 'p2', subject: false }
        state.spaces[Space].serf = { playerId: 'p3' }

        const result = combatStrength(state, { ...Input, target: 'feudum' })

        expect(result.attack.serf).toBe(0)
        expect(result.defence).toMatchObject({ feudum: 2, subject: 0, total: 2 })
    })

    it('a target other than the feudum takes none of its bonuses', () => {
        const { state, attacker, defender } = battle()
        attacker.pawns[0].spaceId = Space
        defender.pawns[0].spaceId = Space
        showLocation(state, Space, 'feudum')
        state.spaces[Space].ruler = { playerId: 'p2', subject: true }
        state.spaces[Space].serf = { playerId: 'p1' }

        const result = combatStrength(state, Input)

        expect(result.attack.serf).toBe(0)
        expect(result.defence).toMatchObject({ feudum: 0, subject: 0, total: 2 })
    })

    it('R-4.10.2 a drunk pawn counts 0 on either side', () => {
        const { state, attacker, defender } = battle()
        attacker.pawns[0].spaceId = Space
        attacker.pawns[1].spaceId = Space
        attacker.pawns[1].wine = 'drunk'
        defender.pawns[0].spaceId = Space
        defender.pawns[1].spaceId = Space
        defender.pawns[1].wine = 'drunk'

        const result = combatStrength(state, { ...Input, saltpeter: 1, weapons: 2 })

        expect([result.attack.pawns, result.defence.pawns]).toEqual([1, 2])
        expect(result.attack.total).toBe(4)
    })

    it('R-4.10.2 a pawn fed with wine this round counts in full', () => {
        const { state, attacker } = battle()
        attacker.pawns[0].spaceId = Space
        attacker.pawns[0].wine = 'fed'
        expect(combatStrength(state, Input).attack.pawns).toBe(1)
    })
})

describe('R-4.8.2 saltpeter', () => {
    it.each([
        { character: 'farmer', amount: 1, allowed: true },
        { character: 'farmer', amount: 2, allowed: false },
        { character: 'knight', amount: 2, allowed: true },
        { character: 'knight', amount: 9, allowed: true }
    ] as const)('$amount with a $character: $allowed', ({ character, amount, allowed }) => {
        const { state, attacker } = battle()
        attacker.pawns[0].spaceId = Space
        attacker.pawns[0].character = character
        expect(saltpeterAllowed(state, 'p1', Space, amount)).toBe(allowed)
    })

    it('a knight elsewhere does not lift the limit; a drunk one on the space does', () => {
        const { state, attacker } = battle()
        attacker.pawns[0].spaceId = 'space.forest.2'
        attacker.pawns[0].character = 'knight'
        expect(saltpeterAllowed(state, 'p1', Space, 2)).toBe(false)

        attacker.pawns[0].spaceId = Space
        attacker.pawns[0].wine = 'drunk'
        expect(saltpeterAllowed(state, 'p1', Space, 2)).toBe(true)
    })
})

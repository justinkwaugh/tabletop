import { describe, expect, it } from 'vitest'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { Battlefield } from '../testing/combat.js'
import { setUp } from '../testing/improving.js'
import { giveFood, sealUnder, starve, tableAtStarve } from '../testing/starve.js'
import { reasonStarveThePeopleRefused, starveOffers } from './starveThePeople.js'

describe('R-3.13.2 StarveThePeople that does not ask', () => {
    it('R-3.13.2 removes a serf to its owner, scores nothing, and queues the disc', () => {
        const combat = tableAtStarve()
        const { table, attackerId, defenderId } = combat
        const markers = table.seat(defenderId).influenceSupply
        const score = table.seat(attackerId).score

        const [action] = starve(combat)

        expect(table.state.spaces[Battlefield].serf).toBeUndefined()
        expect(table.seat(defenderId).influenceSupply).toBeGreaterThan(markers)
        expect(table.seat(attackerId).score).toBe(score)
        expect(table.seat(attackerId).played).toEqual([{ kind: 'conquer', use: 'special' }])
        expect(table.seat(attackerId).hand).toEqual(['move', 'tax'])
        expect(action.revealsInfo).toBeFalsy()
        expect(table.state.machineState).toBe(MachineState.PlacingDisc)
        expect(table.state.activePlayerIds).toEqual([attackerId])
    })

    it('R-3.13.2 removes a subject, and its ruler stays', () => {
        const combat = tableAtStarve('subject')
        const { table, defenderId } = combat
        const markers = table.seat(defenderId).influenceSupply

        starve(combat)

        expect(table.state.spaces[Battlefield].ruler).toEqual({
            playerId: defenderId,
            subject: false
        })
        expect(table.seat(defenderId).influenceSupply).toBeGreaterThan(markers)
    })

    it('R-3.13.2, R-5-H1 every chicken bead goes to the pile, which is reshuffled', () => {
        const combat = tableAtStarve()
        const { table } = combat
        const bead = table.state.guilds.farmer.chickens['guild.farmer.chicken.1']
        const before = table.hydrated().requireVault().sealPile
        const count = table.state.supply.sealPileCount
        expect(bead).toBeTruthy()

        const [action] = starve(combat)

        const after = table.hydrated().requireVault().sealPile
        expect(
            Object.values(table.state.guilds.farmer.chickens).every((bead) => bead === null)
        ).toBe(true)
        expect(table.state.supply.sealPileCount).toBe(count + 1)
        expect([...after].sort()).toEqual([...before, bead].sort())
        expect(after).not.toEqual([...before, bead])
        expect(action).toMatchObject({
            metadata: { asked: false, starved: { beads: [bead], rankChanges: [] } }
        })
    })

    it('R-3.14-H1 no unplayed card: nobody is asked', () => {
        const combat = tableAtStarve('serf', [])
        const [action] = starve(combat)
        expect(action.revealsInfo).toBeFalsy()
        expect(action).toMatchObject({ metadata: { asked: false } })
    })

    it('R-3.14-H1 Defend already played this round: nobody is asked', () => {
        const combat = tableAtStarve()
        const { table, defenderId } = combat
        setUp(table, (state) => {
            giveFood(state, defenderId)
            state.getPlayerState(defenderId).played.push({ kind: 'defend', use: 'regular' })
        })
        const [action] = starve(combat)
        expect(action.revealsInfo).toBeFalsy()
        expect(action).toMatchObject({ metadata: { asked: false } })
    })

    it('R-3.14-H1 no food: nobody is asked', () => {
        const combat = tableAtStarve()
        const [action] = starve(combat)
        expect(action.revealsInfo).toBeFalsy()
        expect(action).toMatchObject({ metadata: { asked: false } })
    })

    it('R-3.14-H4 no seal in the pile: nobody is asked', () => {
        const combat = tableAtStarve()
        const { table, defenderId } = combat
        setUp(table, (state) => {
            giveFood(state, defenderId)
            const vault = state.requireVault()
            vault.heldSeals[defenderId].push(...vault.sealPile.splice(0))
            state.getPlayerState(defenderId).sealCount += state.supply.sealPileCount
            state.supply.sealPileCount = 0
        })
        const [action] = starve(combat)
        expect(action.revealsInfo).toBeFalsy()
        expect(action).toMatchObject({ metadata: { asked: false } })
    })

    it('R-3.3-H1 a declared second card follows once the disc is decided', () => {
        const combat = tableAtStarve('serf', ['tax'], ['conquer', 'move', 'tax'])
        const { table, attackerId } = combat
        setUp(table, (state) => {
            const seat = state.getPlayerState(attackerId)
            seat.goods.sulfur -= 1
            seat.pouch = 'sulfur'
        })
        starve(combat, { secondCard: true })
        table.send(attackerId, { type: ActionType.PlaceDisc, place: false })
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).toBe(attackerId)
    })
})

describe('R-3.13.2, R-3.14-H1 StarveThePeople that asks', () => {
    it('R-3.14-H1 puts the owner alone on the clock, a barrier, with nothing moved', () => {
        const combat = tableAtStarve()
        const { table, attackerId, defenderId } = combat
        setUp(table, (state) => giveFood(state, defenderId))
        const bead = table.state.guilds.farmer.chickens['guild.farmer.chicken.1']

        const [action] = starve(combat)

        expect(action.revealsInfo).toBe(true)
        expect(action).toEqual(expect.objectContaining({ metadata: { asked: true } }))
        expect(table.state.machineState).toBe(MachineState.AwaitingImmunity)
        expect(table.state.activePlayerIds).toEqual([defenderId])
        expect(table.offered(defenderId)).toEqual([ActionType.AnswerStarve])
        expect(table.offered(attackerId)).toEqual([])
        expect(table.state.flow.starve).toEqual({
            actorId: attackerId,
            targetPlayerId: defenderId,
            spaceId: Battlefield,
            role: 'serf'
        })
        expect(table.state.spaces[Battlefield].serf?.playerId).toBe(defenderId)
        expect(table.state.guilds.farmer.chickens['guild.farmer.chicken.1']).toBe(bead)
    })

    it('R-3.14-H1 asks a seat without Defend all the same: public state cannot rule it out', () => {
        const combat = tableAtStarve('serf', ['tax', 'guild'])
        const { table, defenderId } = combat
        setUp(table, (state) => giveFood(state, defenderId))
        const [action] = starve(combat)
        expect(action.revealsInfo).toBe(true)
        expect(table.state.machineState).toBe(MachineState.AwaitingImmunity)
    })
})

describe('R-3.13.2, R-3.13-H1, R-3.14.2 refusing a Starve', () => {
    it('R-3.2 refuses another seat', () => {
        const { table, defenderId, thirdId } = tableAtStarve()
        expect(
            reasonStarveThePeopleRefused(table.hydrated(), thirdId, {
                spaceId: Battlefield,
                targetPlayerId: defenderId,
                role: 'serf'
            })
        ).toBe("It isn't your turn.")
    })

    it('R-3.2 refuses without Conquer in hand', () => {
        const combat = tableAtStarve('serf', ['tax'], ['move', 'tax'])
        expect(() => starve(combat)).toThrow("Conquer isn't in your hand.")
    })

    it('R-3.13-H1 refuses Conquer as the last card', () => {
        const combat = tableAtStarve('serf', ['tax'], ['conquer'])
        expect(() => starve(combat)).toThrow("Conquer can't be your last card: forfeit it.")
    })

    it('R-3.13.2 refuses without a Noble on the space', () => {
        const combat = tableAtStarve()
        const { table, attackerId } = combat
        setUp(table, (state) => {
            const noble = state
                .getPlayerState(attackerId)
                .pawns.find((pawn) => pawn.character === 'noble')
            if (noble) {
                noble.character = 'farmer'
            }
            state.recomputeRanks()
        })
        expect(() => starve(combat)).toThrow(
            'Starve the People needs a Noble pawn at the location.'
        )
    })

    it('R-3.13.2 refuses a seat’s own marker', () => {
        const combat = tableAtStarve()
        const { table, attackerId } = combat
        setUp(table, (state) => {
            state.spaces[Battlefield].ruler = { playerId: attackerId, subject: true }
            state.getPlayerState(attackerId).influenceSupply -= 1
            state.recomputeRanks()
        })
        expect(() => starve(combat, { targetPlayerId: attackerId, role: 'subject' })).toThrow(
            'That marker is yours.'
        )
    })

    it('R-3.13.2 refuses a marker that is not there', () => {
        const combat = tableAtStarve()
        const { thirdId } = combat
        expect(() => starve(combat, { role: 'subject' })).toThrow('That seat has no subject there.')
        expect(() => starve(combat, { targetPlayerId: thirdId })).toThrow(
            'That seat has no serf there.'
        )
    })

    it('R-3.14.2 an immune marker cannot be starved', () => {
        const combat = tableAtStarve()
        sealUnder(combat)
        expect(() => starve(combat)).toThrow('A seal lies under that marker.')
    })

    it('R-3.15.2 Conquer never replays, so neither does its special', () => {
        const combat = tableAtStarve('serf', ['tax'], ['repeat', 'move', 'tax'])
        expect(() => starve(combat, { asRepeat: 'repeat' })).toThrow("Conquer can't be replayed.")
    })
})

describe('R-3.13.2 the offers', () => {
    it('R-3.5 Conquer in hand offers the Starve alongside the Conquer', () => {
        const { table, attackerId } = tableAtStarve()
        expect(table.offered(attackerId)).toEqual(
            expect.arrayContaining([ActionType.Conquer, ActionType.StarveThePeople])
        )
    })

    it('R-3.14-H1 lists each marker and whether it would ask, as the session reads it', () => {
        const { table, attackerId, defenderId } = tableAtStarve()
        expect(starveOffers(table.hydrated(), attackerId)).toEqual([
            {
                spaceId: Battlefield,
                targetPlayerId: defenderId,
                role: 'serf',
                revealsInfo: false,
                beads: 1
            }
        ])
        setUp(table, (state) => giveFood(state, defenderId))
        expect(starveOffers(table.hydrated(), attackerId)[0].revealsInfo).toBe(true)
    })

    it('R-3.14.2 an immune marker is not offered', () => {
        const combat = tableAtStarve()
        const { table, attackerId } = combat
        sealUnder(combat)
        expect(starveOffers(table.hydrated(), attackerId)).toEqual([])
    })
})

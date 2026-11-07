import { ActionSource } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { isStartRound } from '../actions/startRound.js'
import { ActionType } from '../definition/actions.js'
import { PhaseName } from '../definition/phases.js'
import { FeudumStateHandlers } from '../definition/stateHandlers.js'
import { MachineState } from '../definition/states.js'
import { queueFollowUp } from '../model/followUps.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { goodCounts } from '../model/stateSchemas.js'
import {
    FarmerMandate,
    giveTile,
    KnightMandate,
    ShillingMandate,
    tableInWindow,
    VesselMandate
} from '../testing/atWill.js'
import {
    addPawn,
    answer,
    commit,
    conquer,
    emptyGoods,
    holdWrit,
    PawnOf,
    tableAtCombat
} from '../testing/combat.js'
import { setMaster } from '../testing/guilds.js'
import { setUp } from '../testing/improving.js'
import { giveFood, starve, tableAtStarve } from '../testing/starve.js'
import { Table, tableAtPlayingCards } from '../testing/table.js'
import { stateAfterCardStep } from './cardTurns.js'

const Goods = ['saltpeter', 'sulfur', 'iron']
const Pawn = { character: 'farmer', spaceId: 'space.desert.3' }
const Seats = [2, 3, 4, 5]

function tableAtPawns(numPlayers: number): Table {
    const table = new Table(numPlayers)
    for (const playerId of table.order) {
        table.send(playerId, { type: ActionType.ChooseStartingGoods, goods: Goods })
    }
    return table
}

describe('Setup states', () => {
    it.each(Seats)('R-1.4.8 goods are asked of each of %i seats in turn order', (numPlayers) => {
        const table = new Table(numPlayers)
        for (const playerId of table.order) {
            expect(table.state.machineState).toBe(MachineState.ChoosingStartingGoods)
            expect(table.state.flow.setupOrder).toEqual({ playerId })
            expect(table.state.activePlayerIds).toEqual([playerId])
            for (const other of table.order) {
                expect(table.offered(other)).toEqual(
                    other === playerId ? [ActionType.ChooseStartingGoods] : []
                )
            }
            table.send(playerId, { type: ActionType.ChooseStartingGoods, goods: Goods })
        }
        expect(table.state.machineState).toBe(MachineState.PlacingStartingPawn)
        expect(table.state.flow.setupOrder).toEqual({ playerId: table.order[0] })
    })

    it.each(Seats)('R-1.4.9 pawns are asked of each of %i seats in turn order', (numPlayers) => {
        const table = tableAtPawns(numPlayers)
        for (const playerId of table.order) {
            expect(table.state.machineState).toBe(MachineState.PlacingStartingPawn)
            expect(table.state.flow.setupOrder).toEqual({ playerId })
            expect(table.state.activePlayerIds).toEqual([playerId])
            for (const other of table.order) {
                expect(table.offered(other)).toEqual(
                    other === playerId ? [ActionType.PlaceStartingPawn] : []
                )
            }
            table.send(playerId, { type: ActionType.PlaceStartingPawn, ...Pawn })
        }
    })

    it('R-1.4.8 a seat out of order is refused', () => {
        const table = new Table()
        const [, second] = table.order
        expect(() =>
            table.send(second, { type: ActionType.ChooseStartingGoods, goods: Goods })
        ).toThrow()
    })

    it('R-1.4.9, R-2.2 only the last pawn runs StartRound, as a System Action', () => {
        const table = tableAtPawns(3)
        const [first, second, third] = table.order
        expect(table.send(first, { type: ActionType.PlaceStartingPawn, ...Pawn })).toHaveLength(1)
        expect(table.send(second, { type: ActionType.PlaceStartingPawn, ...Pawn })).toHaveLength(1)

        const processed = table.send(third, { type: ActionType.PlaceStartingPawn, ...Pawn })

        expect(processed.map((action) => action.type)).toEqual([
            ActionType.PlaceStartingPawn,
            ActionType.StartRound
        ])
        expect(isStartRound(processed[1])).toBe(true)
        expect(processed[1].source).toBe(ActionSource.System)
    })

    it('R-1.4.9, R-2.2 setup closes into round 1 with the first seat selecting', () => {
        const table = tableAtPawns(3)
        for (const playerId of table.order) {
            table.send(playerId, { type: ActionType.PlaceStartingPawn, ...Pawn })
        }
        expect(table.state.flow.setupOrder).toBeUndefined()
        expect(table.state.machineState).toBe(MachineState.SelectingHands)
        expect(table.hydrated().roundManager.currentRound?.number).toBe(1)
        expect(table.hydrated().phaseManager.currentPhase?.name).toBe(PhaseName.HandSelection)
        expect(table.state.phaseManager.series.map((phase) => phase.name)).toEqual([
            PhaseName.Setup,
            PhaseName.HandSelection
        ])
        expect(table.state.flow.selection).toEqual({ playerId: table.order[0], finalised: [] })
        expect(table.asked).toBe(table.order[0])
    })
})

/** Everything but `asked` is silent, and `asked` is offered exactly this. */
function expectAsked(table: Table, asked: string, offers: string[]) {
    expect(table.state.activePlayerIds).toEqual([asked])
    expect(table.offered(asked)).toEqual(offers)
    for (const playerId of table.order.filter((seat) => seat !== asked)) {
        expect(table.offered(playerId)).toEqual([])
    }
}

/** R-3.2 The turn is still the attacker's while another seat is asked. */
function expectHeldTurn(table: Table, playerId: string) {
    expect(table.state.flow.turn?.playerId).toBe(playerId)
    expect(table.hydrated().turnManager.currentTurn()?.playerId).toBe(playerId)
}

const Disc = { type: ActionType.PlaceDisc, place: true }

describe('Machine states', () => {
    it('every state is mapped to a handler', () => {
        for (const state of Object.values(MachineState)) {
            expect(FeudumStateHandlers[state]).toBeDefined()
        }
    })
})

describe('R-3.14-H1, D1 the asked states hold the turn and resume it', () => {
    it('R-3.14-H1 AwaitingDefence asks the defender alone, then CommittingAttack the attacker', () => {
        const combat = tableAtCombat()
        const { table, attackerId, defenderId } = combat

        conquer(combat, PawnOf(defenderId))
        expect(table.state.machineState).toBe(MachineState.AwaitingDefence)
        expectAsked(table, defenderId, [ActionType.AnswerAttack])
        expectHeldTurn(table, attackerId)

        answer(combat)
        expect(table.state.machineState).toBe(MachineState.CommittingAttack)
        expectAsked(table, attackerId, [ActionType.CommitAttack])
        expectHeldTurn(table, attackerId)

        commit(combat)
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).not.toBe(attackerId)
    })

    it('R-3.3-H1 the turn resumes with a declared second card, its own seat active', () => {
        const combat = tableAtCombat(['tax'], ['conquer', 'tax', 'guild'])
        const { table, attackerId, defenderId } = combat
        setUp(table, (state) => {
            state.getPlayerState(attackerId).goods.sulfur -= 1
            state.getPlayerState(attackerId).pouch = 'sulfur'
        })

        conquer(combat, PawnOf(defenderId), { secondCard: true })
        answer(combat)
        commit(combat)

        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).toBe(attackerId)
        expectHeldTurn(table, attackerId)
        expect(table.offered(attackerId)).toContain(ActionType.ForfeitCard)
    })

    it('R-3.14-H1 AwaitingImmunity asks the owner alone, then the actor’s turn goes on', () => {
        const combat = tableAtStarve()
        const { table, attackerId, defenderId } = combat
        setUp(table, (state) => giveFood(state, defenderId))

        starve(combat)
        expect(table.state.machineState).toBe(MachineState.AwaitingImmunity)
        expectAsked(table, defenderId, [ActionType.AnswerStarve])
        expectHeldTurn(table, attackerId)

        table.send(defenderId, {
            type: ActionType.AnswerStarve,
            revealsInfo: true,
            royalImmunity: false
        })

        expect(table.state.flow.starve).toBeUndefined()
        expect(table.state.machineState).toBe(MachineState.PlacingDisc)
        expectAsked(table, attackerId, [ActionType.PlaceDisc])
        expectHeldTurn(table, attackerId)
    })
})

describe('R-4.8-H5 CommittingAttack is skipped when the attacker has nothing to add', () => {
    it('R-4.8-H5 with nobody asked, the Conquer resolves it', () => {
        const combat = tableAtCombat([])
        const { table, attackerId, defenderId } = combat
        setUp(table, (state) => {
            emptyGoods(state, attackerId)
        })
        conquer(combat, PawnOf(defenderId))
        expect(table.state.flow.combat).toBeUndefined()
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).not.toBe(attackerId)
    })

    it('R-4.8-H5 with the defender asked, its answer resolves it, in the same Action', () => {
        const combat = tableAtCombat()
        const { table, attackerId, defenderId } = combat
        setUp(table, (state) => {
            emptyGoods(state, attackerId)
        })
        conquer(combat, PawnOf(defenderId))

        const [action] = answer(combat)

        expect(action).toMatchObject({
            metadata: {
                vp: 0,
                combat: {
                    defenderId,
                    attackerWins: false,
                    attack: { total: 1 },
                    defence: { total: 2 }
                }
            }
        })
        expect(table.state.flow.combat).toBeUndefined()
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).not.toBe(attackerId)
    })

    it('R-4.8-H5, R-4.9-H1 an answered win resolves on to the attacker’s military disc', () => {
        const combat = tableAtCombat()
        const { table, attackerId, defenderId } = combat
        setUp(table, (state) => {
            emptyGoods(state, attackerId)
            addPawn(state, attackerId)
            addPawn(state, attackerId)
        })
        conquer(combat, PawnOf(defenderId))

        answer(combat)

        expect(table.state.machineState).toBe(MachineState.PlacingDisc)
        expectAsked(table, attackerId, [ActionType.PlaceDisc])
        expectHeldTurn(table, attackerId)
    })

    it.each([
        {
            what: 'a saltpeter',
            edit: () => {}
        },
        {
            what: 'a tile for one',
            edit: (state: HydratedFeudumGameState, attackerId: string) => {
                emptyGoods(state, attackerId)
                giveTile(state, attackerId)
            }
        },
        {
            what: 'an unsealed writ, weapon or not',
            edit: (state: HydratedFeudumGameState, attackerId: string) => {
                emptyGoods(state, attackerId)
                holdWrit(state, attackerId, VesselMandate)
            }
        }
    ])('R-4.8-H5 with $what the attacker is asked after the answer', ({ edit }) => {
        const combat = tableAtCombat()
        const { table, attackerId, defenderId } = combat
        setUp(table, (state) => edit(state, attackerId))
        conquer(combat, PawnOf(defenderId))

        answer(combat)

        expect(table.state.machineState).toBe(MachineState.CommittingAttack)
    })
})

describe('R-3.2, D13 follow-ups run in order', () => {
    /** The turn player's card leaves a reeve, a voyage step onto a draw, and a military offer. */
    function afterCard(): { table: Table; playerId: string } {
        const table = tableAtPlayingCards()
        const playerId = table.asked
        table.moveTo((state, context) => {
            setMaster(state, playerId, 'farmer')
            state.voyageTrack[playerId] = 1
            queueFollowUp(state, { kind: 'reeve', playerId, guildId: 'farmer' })
            queueFollowUp(state, { kind: 'voyage', playerId })
            queueFollowUp(state, { kind: 'military', playerId })
            return stateAfterCardStep(context)
        })
        return { table, playerId }
    }

    it('R-4.7, R-3.7.5, R-4.9.1 each is asked in turn, then AdvanceTurn', () => {
        const { table, playerId } = afterCard()

        expect(table.state.machineState).toBe(MachineState.PlacingDisc)
        expectAsked(table, playerId, [ActionType.PlaceDisc])
        const [reeve] = table.send(playerId, Disc)
        expect(reeve).toMatchObject({ metadata: { disc: 'reeve' } })
        expect(table.state.machineState).toBe(MachineState.PlacingDisc)

        const [voyage] = table.send(playerId, Disc)
        expect(voyage).toMatchObject({ metadata: { disc: 'voyage', space: 2 } })

        // D13 The voyage draw's keep comes ahead of the rest.
        expect(table.state.machineState).toBe(MachineState.KeepingWrits)
        expectAsked(table, playerId, [ActionType.KeepWrits])
        expect(table.state.flow.turn?.followUps).toEqual([
            { kind: 'keep-writs', playerId },
            { kind: 'military', playerId }
        ])
        const [kept] = table.hydrated().flow.writDraw?.drawn ?? []
        const keep = table.send(playerId, { type: ActionType.KeepWrits, keep: [kept] })
        expect(keep.map((action) => action.type)).toEqual([ActionType.KeepWrits])

        expect(table.state.machineState).toBe(MachineState.PlacingDisc)
        const military = table.send(playerId, Disc)
        expect(military[0]).toMatchObject({ metadata: { disc: 'military' } })

        expect(military.map((action) => action.type)).toEqual([
            ActionType.PlaceDisc,
            ActionType.AdvanceTurn
        ])
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).toBe(table.order[1])
    })

    it('R-4.7 a follow-up whose place has gone is dropped unasked', () => {
        const table = tableAtPlayingCards()
        const playerId = table.asked
        table.moveTo((state, context) => {
            state.voyageTrack[playerId] = 7
            queueFollowUp(state, { kind: 'voyage', playerId })
            return stateAfterCardStep(context)
        })
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).toBe(table.order[1])
    })

    it('R-3.11.3 InspectingHarvest asks the harvester alone, then the turn passes', () => {
        const table = tableAtPlayingCards()
        const playerId = table.asked
        table.moveTo((state, context) => {
            state.flow.harvest = {
                playerId,
                spaceId: 'space.desert.3',
                drawn: goodCounts(),
                favours: 0
            }
            queueFollowUp(state, { kind: 'inspect-harvest', playerId })
            return stateAfterCardStep(context)
        })
        expect(table.state.machineState).toBe(MachineState.InspectingHarvest)
        expectAsked(table, playerId, [ActionType.ChooseFavours])

        const processed = table.send(playerId, { type: ActionType.ChooseFavours, favours: null })

        expect(processed.map((action) => action.type)).toEqual([
            ActionType.ChooseFavours,
            ActionType.AdvanceTurn
        ])
        expect(table.asked).toBe(table.order[1])
    })
})

describe('R-4.4.4 DiscardingWrits', () => {
    it('R-4.4.4, R-4.4-H1 offers the turn player its at-will actions, and nobody else anything', () => {
        const { table, playerId } = tableInWindow('writ limit', (state, seat) => {
            for (const writId of [ShillingMandate, VesselMandate, FarmerMandate, KnightMandate]) {
                holdWrit(state, seat, writId)
            }
        })
        expect(table.state.machineState).toBe(MachineState.DiscardingWrits)
        expect(table.state.activePlayerIds).toEqual([playerId])
        expect(table.offered(playerId)).toContain(ActionType.DiscardWrit)
        expect(table.offered(playerId)).not.toContain(ActionType.ForfeitCard)
        for (const seat of table.order.filter((id) => id !== playerId)) {
            expect(table.offered(seat)).toEqual([])
        }
    })
})

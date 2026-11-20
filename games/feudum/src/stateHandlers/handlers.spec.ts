import { ActionSource } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import type { PouchGood } from '../actions/finaliseHand.js'
import { isStartRound } from '../actions/startRound.js'
import { ActionType } from '../definition/actions.js'
import { PhaseName } from '../definition/phases.js'
import { FeudumStateHandlers } from '../definition/stateHandlers.js'
import { MachineState } from '../definition/states.js'
import { queueFollowUp } from '../model/followUps.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { goodCounts } from '../model/stateSchemas.js'
import {
    Charter,
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
import { setMaster, setPawns } from '../testing/guilds.js'
import { setUp } from '../testing/improving.js'
import { playOutCards, typesOf } from '../testing/roundEnd.js'
import { giveFood, starve, tableAtStarve } from '../testing/starve.js'
import { Table, tableAtPlayingCards } from '../testing/table.js'
import { stateAfterCardStep } from './cardTurns.js'
import { cardTurnSeat } from '../model/turns.js'

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
            expect(table.hydrated().turnManager.currentTurn()?.playerId).toBe(playerId)
            expect(table.state.activePlayerIds).toEqual([playerId])
            for (const other of table.order) {
                expect(table.offered(other)).toEqual(
                    other === playerId ? [ActionType.ChooseStartingGoods] : []
                )
            }
            table.send(playerId, { type: ActionType.ChooseStartingGoods, goods: Goods })
        }
        expect(table.state.machineState).toBe(MachineState.PlacingStartingPawn)
        expect(table.hydrated().turnManager.currentTurn()?.playerId).toBe(table.order[0])
    })

    it.each(Seats)('R-1.4.9 pawns are asked of each of %i seats in turn order', (numPlayers) => {
        const table = tableAtPawns(numPlayers)
        for (const playerId of table.order) {
            expect(table.state.machineState).toBe(MachineState.PlacingStartingPawn)
            expect(table.hydrated().turnManager.currentTurn()?.playerId).toBe(playerId)
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
        expect(table.hydrated().turnManager.currentTurn()?.playerId).toBeUndefined()
        expect(table.state.machineState).toBe(MachineState.SelectingHands)
        expect(table.hydrated().roundManager.currentRound?.number).toBe(1)
        expect(table.hydrated().phaseManager.currentPhase?.name).toBe(PhaseName.HandSelection)
        expect(table.state.phaseManager.series.map((phase) => phase.name)).toEqual([
            PhaseName.Setup,
            PhaseName.HandSelection
        ])
        expect(table.state.flow.selection).toEqual({ finalised: [] })
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
    expect(cardTurnSeat(table.hydrated())).toBe(playerId)
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

describe('R-3.14-H1 the asked states hold the turn and resume it', () => {
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

describe('R-3.2 follow-ups run in order', () => {
    /** The turn player's card leaves a reeve, a voyage step onto a draw, and a military offer. */
    function afterCard(): { table: Table; playerId: string } {
        const table = tableAtPlayingCards()
        const playerId = table.asked
        table.moveTo((state, context) => {
            setMaster(state, playerId, 'farmer')
            state.voyageTrack[playerId] = 'track.voyage.1'
            queueFollowUp(state, { kind: 'reeve', guildId: 'farmer' })
            queueFollowUp(state, { kind: 'voyage' })
            queueFollowUp(state, { kind: 'military' })
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
        expect(voyage).toMatchObject({ metadata: { disc: 'voyage', space: 'track.voyage.2' } })

        // R-3.2 The voyage draw's keep comes ahead of the rest.
        expect(table.state.machineState).toBe(MachineState.KeepingWrits)
        expectAsked(table, playerId, [ActionType.KeepWrits])
        expect(table.state.flow.turn?.followUps).toEqual([
            { kind: 'keep-writs' },
            { kind: 'military' }
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
            state.voyageTrack[playerId] = 'track.voyage.7'
            queueFollowUp(state, { kind: 'voyage' })
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
            queueFollowUp(state, { kind: 'inspect-harvest' })
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

/** A round of one card each. `edit` sets the larders before the cards run out. */
function tableAtRoundEnd(
    numPlayers: number,
    edit: (state: HydratedFeudumGameState, order: string[]) => void = () => {},
    pouchOf: (playerId: string) => PouchGood | undefined = () => undefined
) {
    const table = tableAtPlayingCards((playerId) => {
        const pouchGood = pouchOf(playerId)
        return { cards: ['move'], ...(pouchGood ? { pouchGood } : {}) }
    }, numPlayers)
    table.moveTo((state) => {
        edit(state, state.turnManager.turnOrder)
        state.recomputeRanks()
        return MachineState.PlayingCards
    })
    return table
}

/** R-1.4.4 Moves the seat's food to or from the haversack, keeping totals. */
function setFood(state: HydratedFeudumGameState, playerId: string, food: number) {
    const seat = state.getPlayerState(playerId)
    state.supply.haversack.food += seat.goods.food - food
    seat.goods.food = food
}

function giveBarrel(state: HydratedFeudumGameState, playerId: string) {
    state.supply.haversack.sulfur -= 1
    state.getPlayerState(playerId).barrel += 1
}

const RoundCascade = [
    ActionType.ForfeitCard,
    ActionType.AdvanceTurn,
    ActionType.NourishPawns,
    ActionType.RollProgressDie,
    ActionType.EndRound,
    ActionType.StartRound
]

describe('R-4.10, R-4.10-H4 NourishPawns', () => {
    /** Food for all; food or wine; nothing at all; which pawn goes unfed. */
    function fourLarders() {
        return tableAtRoundEnd(4, (state, [fed, wineOrFood, starved, oneShort]) => {
            setFood(state, fed, 1)
            setFood(state, wineOrFood, 1)
            giveBarrel(state, wineOrFood)
            setFood(state, starved, 0)
            setPawns(state, oneShort, ['farmer', 'monk'])
            setFood(state, oneShort, 1)
        })
    }

    it('R-4.10-H4 feeds every seat without a choice, and asks the others at once', () => {
        const table = fourLarders()
        const [fed, wineOrFood, starved, oneShort] = table.order

        const processed = playOutCards(table)

        expect(typesOf(processed)).toEqual(RoundCascade.slice(0, 3))
        expect(table.state.machineState).toBe(MachineState.Nourishing)
        expect(table.state.flow.nourish).toEqual({ pending: [wineOrFood, oneShort] })
        expect(table.state.activePlayerIds).toEqual([wineOrFood, oneShort])
        expect(processed[2]).toMatchObject({
            metadata: {
                fed: [
                    { playerId: fed, foodFed: [1], wineFed: [], returned: [] },
                    { playerId: starved, foodFed: [], wineFed: [], returned: [{ n: 1 }] }
                ]
            }
        })
        expect(table.seat(fed).goods.food).toBe(0)
        expect(table.seat(starved).pawns[0].spaceId).toBeUndefined()
        expect(table.offered(fed)).toEqual([])
        expect(table.offered(oneShort)).toContain(ActionType.Nourish)
        expect(table.offered(wineOrFood)).toContain(ActionType.Nourish)
    })

    it('R-4.10-H4, R-4.11.1 the last seat asked sets off the rest of the round', () => {
        const table = fourLarders()
        const [, wineOrFood, , oneShort] = table.order
        playOutCards(table)

        table.send(wineOrFood, { type: ActionType.Nourish, wineFed: [], unfed: [] })
        expect(table.state.activePlayerIds).toEqual([oneShort])
        const processed = table.send(oneShort, {
            type: ActionType.Nourish,
            wineFed: [],
            unfed: [2]
        })

        expect(typesOf(processed)).toEqual([ActionType.Nourish, ...RoundCascade.slice(3)])
        expect(table.state.machineState).toBe(MachineState.SelectingHands)
        expect(table.state.flow.nourish).toBeUndefined()
    })

    it('R-4.10-H4 with no choice and only wine, the game feeds wine', () => {
        const table = tableAtRoundEnd(2, (state, [first]) => {
            setFood(state, first, 0)
            giveBarrel(state, first)
        })
        const [first] = table.order

        const processed = playOutCards(table)

        expect(processed[2]).toMatchObject({
            metadata: { fed: [{ playerId: first, wineFed: [1], foodFed: [], returned: [] }, {}] }
        })
        expect(table.seat(first).barrel).toBe(0)
    })

    it('R-4.10.2 a seat whose every pawn holds sulfur, or with none on the board, is not named', () => {
        const table = tableAtRoundEnd(2, (state, [first, second]) => {
            const seat = state.getPlayerState(first)
            seat.goods.sulfur -= 1
            seat.pawns[0].wine = 'fed'
            setPawns(state, second, [])
        })

        const processed = playOutCards(table)

        expect(processed[2]).toMatchObject({ metadata: { fed: [] } })
    })

    it('R-4.4-H1, R-4.4.2 a seat with nothing to decide but an at-will play waits in nourishing', () => {
        const table = tableAtRoundEnd(4, (state, [mandate, tile, fed, starved]) => {
            // Food for every pawn, so no feeding choice; a mandate that turns food in for 3s.
            setFood(state, mandate, 1)
            holdWrit(state, mandate, ShillingMandate)
            // Food for every pawn, and a region tile to spend at will.
            setFood(state, tile, 1)
            giveTile(state, tile)
            // Neither a choice nor an at-will play: fed, or starved, by the game.
            setFood(state, fed, 1)
            setFood(state, starved, 0)
        })
        const [mandate, tile, fed, starved] = table.order

        const processed = playOutCards(table)

        expect(typesOf(processed)).toEqual(RoundCascade.slice(0, 3))
        expect(table.state.flow.nourish).toEqual({ pending: [mandate, tile] })
        expect(processed[2]).toMatchObject({
            metadata: {
                fed: [
                    { playerId: fed, foodFed: [1], returned: [] },
                    { playerId: starved, foodFed: [], returned: [{ n: 1 }] }
                ]
            }
        })
        expect(table.offered(mandate)).toEqual(
            expect.arrayContaining([ActionType.Nourish, ActionType.PlayMandate])
        )
        table.send(mandate, { type: ActionType.Nourish, wineFed: [], unfed: [] })
        expect(table.offered(tile)).toEqual(
            expect.arrayContaining([ActionType.Nourish, ActionType.SpendRegionTile])
        )
    })

    it('R-5.1 who waits reads only public counts: a seat holding a charter waits as one holding a mandate', () => {
        const table = tableAtRoundEnd(2, (state, [charter, mandate]) => {
            setFood(state, charter, 1)
            holdWrit(state, charter, Charter)
            setFood(state, mandate, 1)
            holdWrit(state, mandate, ShillingMandate)
        })
        const [charter, mandate] = table.order

        playOutCards(table)

        expect(table.state.flow.nourish).toEqual({ pending: [charter, mandate] })
        expect(table.offered(charter)).toContain(ActionType.Nourish)
        expect(table.offered(charter)).not.toContain(ActionType.PlayMandate)
    })

    it('R-4.5.2, R-4.5-H1 status recomputes as an unfed pawn goes home, once nourishing ends', () => {
        const table = tableAtRoundEnd(2, (state, [first]) => {
            setFood(state, first, 0)
            setMaster(state, first, 'monk')
        })
        const [first] = table.order

        const processed = playOutCards(table)

        expect(processed[2]).toMatchObject({
            metadata: {
                fed: [{ playerId: first }, {}],
                rankChanges: [{ guildId: 'monk', playerId: first }]
            }
        })
        expect(table.hydrated().guilds.tracks.monk.master?.playerId).not.toBe(first)
    })

    it('R-2.2 with nobody asked the round runs through; only the die is a barrier', () => {
        const table = tableAtRoundEnd(2)

        const processed = playOutCards(table)

        expect(typesOf(processed)).toEqual(RoundCascade)
        expect(
            processed.filter((action) => action.revealsInfo).map((action) => action.type)
        ).toEqual([ActionType.RollProgressDie])
        expect(table.state.phaseManager.series.map((phase) => phase.name).slice(-3)).toEqual([
            PhaseName.Nourish,
            PhaseName.Progress,
            PhaseName.HandSelection
        ])
    })

    it.each([MachineState.ProgressRoll, MachineState.EndOfRound])(
        'R-2.2 %s asks nobody and offers nothing',
        (machineState) => {
            const table = tableAtRoundEnd(2)
            table.moveTo(() => machineState)

            expect(table.state.activePlayerIds).toEqual([])
            for (const playerId of table.order) {
                expect(table.offered(playerId)).toEqual([])
            }
        }
    )
})

describe('R-2.2.5 EndRound', () => {
    it.each(Seats)('R-2.2.5 passes the starting player clockwise, %i seats', (numPlayers) => {
        const table = tableAtRoundEnd(numPlayers)
        const [first, second, ...rest] = table.order
        const seating = table.state.players.map((player) => player.playerId)

        const processed = playOutCards(table)

        expect(table.order).toEqual([second, ...rest, first])
        expect(table.hydrated().startingPlayerId).toBe(second)
        expect(table.asked).toBe(second)
        expect(table.state.players.map((player) => player.playerId)).toEqual(seating)
        expect(processed.find((action) => action.type === ActionType.EndRound)).toMatchObject({
            metadata: { startingPlayerId: second }
        })
    })

    it('R-3.3 pays each pouch good to the haversack, used or not', () => {
        const pouches: Record<string, PouchGood> = { p1: 'saltpeter', p2: 'sulfur', p3: 'sulfur' }
        const table = tableAtRoundEnd(
            3,
            () => {},
            (playerId) => pouches[playerId]
        )
        const { saltpeter, sulfur } = table.hydrated().supply.haversack

        const processed = playOutCards(table)

        const { supply } = table.hydrated()
        expect(supply.haversack.saltpeter).toBe(saltpeter + 1)
        expect(supply.haversack.sulfur).toBe(sulfur + 2)
        for (const playerId of table.order) {
            expect(table.seat(playerId).pouch).toBeUndefined()
        }
        const endRound = processed.find((action) => action.type === ActionType.EndRound)
        expect(endRound).toMatchObject({
            metadata: {
                pouchesPaid: expect.arrayContaining([
                    { playerId: 'p1', good: 'saltpeter' },
                    { playerId: 'p2', good: 'sulfur' },
                    { playerId: 'p3', good: 'sulfur' }
                ])
            }
        })
    })

    it('R-4.10.2 wine feeds two rounds: fed, drunk, then the sulfur goes back', () => {
        const table = tableAtRoundEnd(2, (state, [first]) => {
            setFood(state, first, 0)
            giveBarrel(state, first)
        })
        const [first, second] = table.order
        const nextRound = () => {
            for (const playerId of [...table.order]) {
                table.send(playerId, {
                    type: ActionType.FinaliseHand,
                    revealsInfo: true,
                    cards: ['move', 'tax', 'guild', 'explore']
                })
            }
            return playOutCards(table)
        }

        const roundOne = playOutCards(table)
        const end = (processed: typeof roundOne) =>
            processed.find((action) => action.type === ActionType.EndRound)
        expect(end(roundOne)).toMatchObject({ metadata: { sobered: [] } })
        expect(table.seat(first).pawns[0].wine).toBe('drunk')
        const { sulfur } = table.hydrated().supply.haversack

        const roundTwo = nextRound()

        expect(table.seat(first).pawns[0].wine).toBeUndefined()
        expect(table.seat(first).pawns[0].spaceId).toBeDefined()
        expect(end(roundTwo)).toMatchObject({
            metadata: { sobered: [{ playerId: first, n: 1 }] }
        })
        expect(table.hydrated().supply.haversack.sulfur).toBe(sulfur + 1)
        expect(table.seat(second).pawns[0].wine).toBeUndefined()

        // R-4.10.1 Sober and with nothing to eat, it goes home in the third round.
        nextRound()
        expect(table.seat(first).pawns[0].spaceId).toBeUndefined()
    })

    it('R-2.2 the round manager closes the round; the next is numbered on', () => {
        const table = tableAtRoundEnd(2)
        playOutCards(table)
        expect(table.state.roundManager.series.map((round) => round.number)).toEqual([1, 2])
    })
})

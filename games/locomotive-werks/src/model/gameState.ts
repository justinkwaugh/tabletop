import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedPhaseManager,
    HydratedRoundManager,
    HydratedTurnManager,
    PhaseManager,
    PrngState,
    RoundManager,
    assert,
    assertExists,
    Visibility,
    type Prng,
    type RandomState
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import {
    DICE,
    LOCOMOTIVES,
    LocomotiveId,
    WINNING_CASH,
    generationsOf,
    isNewer,
    locomotiveData,
    nextInChain,
    type Locomotive
} from './locomotives.js'
import { LocomotiveSpace, diceOnSpace, planSale, type DicePool, type SalePlan } from './market.js'
import { HydratedLwPlayerState, LwPlayerState, type Plant } from './playerState.js'

// A production phase's selling round: who has still to take a selling turn in it, and whether
// anyone has shipped in it. A round nobody ships in ends the phase.
export type SellingRound = Type.Static<typeof SellingRound>
export const SellingRound = Type.Object({
    number: Type.Number(),
    waiting: Type.Array(Type.String()),
    shipped: Type.Boolean()
})

export type LwGameState = Type.Static<typeof LwGameState>
export const LwGameState = Type.Object({
    ...Type.Omit(GameState, ['players', 'machineState']).properties,
    players: Type.Array(LwPlayerState),
    machineState: Type.Enum(MachineState),
    roundManager: RoundManager,
    phaseManager: PhaseManager,
    spaces: Type.Array(LocomotiveSpace),
    sellingRound: Type.Optional(SellingRound)
})

export const LwGameStateValidator = Compile(LwGameState)

// What a client receives: the canonical State with the master seed and the protected dice stream
// withheld.
export const LwProjectedState = Visibility.createProjectionSchema(LwGameState)
export type LwProjectedState = Type.Static<typeof LwProjectedState>
const LwProjectedStateValidator = Compile(LwProjectedState)

export type Shipment = { locomotiveId: LocomotiveId; plan: SalePlan; income: number }

export type DevelopOption = { locomotive: Locomotive; affordable: boolean }

export class HydratedLwGameState
    extends HydratableGameState<typeof LwProjectedState, HydratedLwPlayerState>
    implements LwProjectedState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare protectedPrng?: RandomState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedLwPlayerState[]
    declare turnManager: HydratedTurnManager
    declare roundManager: HydratedRoundManager
    declare phaseManager: HydratedPhaseManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare spaces: LocomotiveSpace[]
    declare sellingRound?: SellingRound

    constructor(data: LwProjectedState) {
        super(data, LwProjectedStateValidator)
        this.players = data.players.map((player) => new HydratedLwPlayerState(player))
        this.roundManager = new HydratedRoundManager(data.roundManager)
        this.phaseManager = new HydratedPhaseManager(data.phaseManager)
    }

    space(locomotiveId: LocomotiveId): LocomotiveSpace {
        const space = this.spaces.find((candidate) => candidate.locomotiveId === locomotiveId)
        assertExists(space, `Unknown locomotive ${locomotiveId}`)
        return space
    }

    round(): number {
        return this.roundManager.series.length
    }

    turnPlayerId(): string {
        const playerId = this.turnManager.currentTurn()?.playerId
        assertExists(playerId, 'No turn in progress')
        return playerId
    }

    // Dice are rolled from the protected stream, so nobody can work out a roll before it is made.
    // The stream is read only for a roll, so a client can play a development that rolls nothing.
    dicePool(): DicePool {
        let prng: Prng | undefined
        return {
            available: () => DICE - this.spaces.reduce((sum, space) => sum + diceOnSpace(space), 0),
            roll: () => {
                prng ??= this.getProtectedPrng()
                return prng.dieRoll(6)
            }
        }
    }

    // Development needs a die in Initial Orders or Existing Orders, a card left in the supply, and
    // a locomotive this player has never developed.
    developOptions(playerId: string): DevelopOption[] {
        const player = this.getPlayerState(playerId)
        return LOCOMOTIVES.filter((locomotive) => {
            const space = this.space(locomotive.id)
            return (
                (space.initialOrder !== undefined || space.existingOrders.length > 0) &&
                space.cards > 0 &&
                !player.developed.includes(locomotive.id)
            )
        }).map((locomotive) => ({
            locomotive,
            affordable: locomotive.developmentCost <= player.cash
        }))
    }

    developable(playerId: string): LocomotiveId[] {
        return this.developOptions(playerId)
            .filter((option) => option.affordable)
            .map((option) => option.locomotive.id)
    }

    canBuyCapacity(playerId: string, locomotiveId: LocomotiveId, units: number): boolean {
        const player = this.getPlayerState(playerId)
        return (
            Number.isInteger(units) &&
            units > 0 &&
            player.plant(locomotiveId) !== undefined &&
            units * locomotiveData(locomotiveId).productionCost <= player.cash
        )
    }

    shiftCost(from: LocomotiveId, to: LocomotiveId): number {
        return locomotiveData(to).productionCost - locomotiveData(from).productionCost
    }

    canShift(playerId: string, from: LocomotiveId, to: LocomotiveId, units: number): boolean {
        const player = this.getPlayerState(playerId)
        const source = player.plant(from)
        return (
            Number.isInteger(units) &&
            units > 0 &&
            source !== undefined &&
            source.units >= units &&
            player.plant(to) !== undefined &&
            isNewer(to, from) &&
            units * this.shiftCost(from, to) <= player.cash
        )
    }

    // Whether the player can spend anything at all in the capacity phase.
    canExpand(playerId: string): boolean {
        const player = this.getPlayerState(playerId)
        return player.plants.some(
            (plant) =>
                this.canBuyCapacity(playerId, plant.locomotiveId, 1) ||
                player.plants.some((target) =>
                    this.canShift(playerId, plant.locomotiveId, target.locomotiveId, 1)
                )
        )
    }

    shipment(plant: Plant): Shipment | undefined {
        const plan = planSale(
            this.space(plant.locomotiveId).existingOrders,
            plant.units - plant.shipped
        )
        return plan
            ? {
                  locomotiveId: plant.locomotiveId,
                  plan,
                  income: plan.units * locomotiveData(plant.locomotiveId).income
              }
            : undefined
    }

    shipments(playerId: string): Shipment[] {
        return this.getPlayerState(playerId)
            .plants.map((plant) => this.shipment(plant))
            .filter((shipment) => shipment !== undefined)
    }

    canShip(playerId: string): boolean {
        return this.shipments(playerId).length > 0
    }

    // The supply cards that stop being available because this development brings a third or later
    // generation into play: the same kind two generations older.
    retiredBy(locomotiveId: LocomotiveId): LocomotiveId | undefined {
        const developed = locomotiveData(locomotiveId)
        if (developed.generation < 3 || this.space(locomotiveId).initialOrder === undefined) {
            return undefined
        }
        return generationsOf(developed.kind).find(
            (older) => older.generation === developed.generation - 2
        )?.id
    }

    // Slides the Initial Orders die into Existing Orders and rolls one for the next locomotive.
    releaseInitialOrder(locomotiveId: LocomotiveId): { next?: LocomotiveId; roll?: number } {
        const space = this.space(locomotiveId)
        assertExists(space.initialOrder, `${locomotiveId} has no Initial Orders die`)
        space.existingOrders.push(space.initialOrder)
        space.initialOrder = undefined
        const next = nextInChain(locomotiveId)
        const pool = this.dicePool()
        if (!next || pool.available() === 0) {
            return {}
        }
        const roll = pool.roll()
        this.space(next.id).initialOrder = roll
        return { next: next.id, roll }
    }

    richest(): number {
        return Math.max(...this.players.map((player) => player.cash))
    }

    hasWinner(): boolean {
        return this.richest() >= WINNING_CASH
    }

    // The next Player Order: least cash first, ties keeping their order.
    orderByCash(): string[] {
        return this.turnManager.turnOrder.toSorted(
            (a, b) => this.getPlayerState(a).cash - this.getPlayerState(b).cash
        )
    }

    startSellingRound(number: number) {
        this.sellingRound = { number, waiting: [...this.turnManager.turnOrder], shipped: false }
    }

    requireSellingRound(): SellingRound {
        assertExists(this.sellingRound, 'No selling round in progress')
        return this.sellingRound
    }

    leaveSellingRound(playerId: string) {
        const round = this.requireSellingRound()
        assert(round.waiting[0] === playerId, `${playerId} is not next to sell`)
        round.waiting.shift()
    }
}

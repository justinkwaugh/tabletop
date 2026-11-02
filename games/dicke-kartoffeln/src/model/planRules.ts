import {
    BANK_WORM_PRICE,
    COMPOST_SPREADING_COST_PER_FIELD,
    COMPOST_TAKING_COST_PER_FIELD,
    FERTILIZER_COST_PER_SACK,
    FURROW_COST,
    HARVEST_COST_PER_FIELD,
    POISON_COST
} from '../components/costs.js'
import { MAX_WORMS } from '../components/potatoes.js'
import { MachineState } from '../definition/states.js'
import { messagesInYear, type DickeKartoffelnSetup } from '../definition/setup.js'
import type { HydratedDickeKartoffelnGameState } from './gameState.js'
import {
    isOrganic,
    setWorms,
    type FieldState,
    type HydratedDickeKartoffelnPlayerState
} from './playerState.js'
import { PlanKind, type Plan, type PlanOutcome, type PlanningState } from './plans.js'

export function planners(
    state: HydratedDickeKartoffelnGameState,
    step: PlanningState,
    setup: DickeKartoffelnSetup
): string[] {
    return state.players
        .filter((player) => isPlanner(state, player, step, setup))
        .map((player) => player.playerId)
}

function isPlanner(
    state: HydratedDickeKartoffelnGameState,
    player: HydratedDickeKartoffelnPlayerState,
    step: PlanningState,
    setup: DickeKartoffelnSetup
): boolean {
    switch (step) {
        case MachineState.TakingCompost:
            return player.fieldWorms() > 0
        case MachineState.Cultivating:
            return true
        case MachineState.Sowing:
            return player.fields.some((field) => field.furrow)
        case MachineState.Fertilizing:
            return player.fields.some(isSown)
        case MachineState.Spraying:
            return messagesInYear(setup, state.year()) && player.fields.some(isSown)
        case MachineState.RegisteringSales:
            return player.fields.some((field) => (field.harvest ?? 0) > 0)
        case MachineState.SpreadingCompost:
            return player.ripeCompost > 0
    }
}

export function isSown(field: FieldState): boolean {
    return field.seed !== undefined
}

// Fertilizing a field that carries a skull takes two sacks.
export function fertilizerSacks(field: FieldState): number {
    return field.skull ? 2 : 1
}

export function planProblem(
    player: HydratedDickeKartoffelnPlayerState,
    plan: Plan
): string | undefined {
    const fieldIds = planFieldIds(plan)
    if (new Set(fieldIds).size !== fieldIds.length) {
        return 'A field may appear only once in a plan'
    }
    if (!fieldIds.every((fieldId) => player.fields.some((field) => field.id === fieldId))) {
        return 'Unknown field'
    }
    switch (plan.kind) {
        case PlanKind.TakeCompost:
            return firstProblem(
                plan.takes.map(({ fieldId, worms }) =>
                    isCount(worms) && worms >= 1 && worms <= player.field(fieldId).worms
                        ? undefined
                        : 'Take between one worm and all the worms on a field'
                )
            )
        case PlanKind.Cultivate:
            return firstProblem(
                plan.fieldIds.map((fieldId) =>
                    player.field(fieldId).furrow ? 'That field is already ploughed' : undefined
                )
            )
        case PlanKind.Sow:
            return firstProblem(
                plan.seeds.map(({ fieldId }) => {
                    const field = player.field(fieldId)
                    if (!field.furrow) return 'Only a ploughed field can be sown'
                    return isSown(field) ? 'That field is already sown' : undefined
                })
            )
        case PlanKind.Fertilize:
            return firstProblem(
                plan.fieldIds.map((fieldId) => {
                    const field = player.field(fieldId)
                    if (!isSown(field)) return 'Only a sown field is worth fertilizing'
                    return field.fertilizer > 0 ? 'That field is already fertilized' : undefined
                })
            )
        case PlanKind.Spray:
            return firstProblem(
                plan.fieldIds.map((fieldId) => {
                    const field = player.field(fieldId)
                    if (!isSown(field)) return 'Only a sown field is worth spraying'
                    return field.poison ? 'A field takes at most one poison cloud' : undefined
                })
            )
        case PlanKind.RegisterSales:
            return firstProblem(
                plan.sales.map(({ fieldId, norm, bio }) => {
                    const field = player.field(fieldId)
                    if (!isCount(norm) || !isCount(bio) || norm + bio === 0) {
                        return 'Offer a whole number of sacks'
                    }
                    if (norm + bio > (field.harvest ?? 0)) {
                        return 'A field cannot sell more sacks than it yielded'
                    }
                    return bio > 0 && !isOrganic(field)
                        ? 'Only a field with three sunflowers sells Bio potatoes'
                        : undefined
                })
            )
        case PlanKind.SpreadCompost: {
            const spread = plan.placements.reduce((sum, placement) => sum + placement.worms, 0)
            if (spread > player.ripeCompost) {
                return 'Not that many worms on compost pile 2'
            }
            return firstProblem(
                plan.placements.map(({ fieldId, worms }) =>
                    isCount(worms) && worms >= 1 && player.field(fieldId).worms + worms <= MAX_WORMS
                        ? undefined
                        : 'A field never holds more than five worms'
                )
            )
        }
    }
}

export function planCost(
    state: HydratedDickeKartoffelnGameState,
    player: HydratedDickeKartoffelnPlayerState,
    plan: Plan
): number {
    switch (plan.kind) {
        case PlanKind.TakeCompost:
            return plan.takes.length * COMPOST_TAKING_COST_PER_FIELD
        case PlanKind.Cultivate:
            return plan.fieldIds.length * FURROW_COST
        case PlanKind.Sow:
            return plan.seeds.reduce((sum, seed) => sum + state.seedPrice(seed.variety), 0)
        case PlanKind.Fertilize:
            return plan.fieldIds.reduce(
                (sum, fieldId) =>
                    sum + fertilizerSacks(player.field(fieldId)) * FERTILIZER_COST_PER_SACK,
                0
            )
        case PlanKind.Spray:
            return plan.fieldIds.length * POISON_COST
        case PlanKind.RegisterSales:
            return plan.sales.length * HARVEST_COST_PER_FIELD
        case PlanKind.SpreadCompost:
            return plan.placements.length * COMPOST_SPREADING_COST_PER_FIELD
    }
}

export function planIncome(player: HydratedDickeKartoffelnPlayerState, plan: Plan): number {
    if (plan.kind !== PlanKind.SpreadCompost) {
        return 0
    }
    const spread = plan.placements.reduce((sum, placement) => sum + placement.worms, 0)
    return (player.ripeCompost - spread) * BANK_WORM_PRICE
}

export function executePlan(
    state: HydratedDickeKartoffelnGameState,
    player: HydratedDickeKartoffelnPlayerState,
    plan: Plan
): PlanOutcome {
    const cost = planCost(state, player, plan)
    const income = planIncome(player, plan)
    applyPlan(player, plan)
    player.cash += income
    const { loansTaken } = player.pay(cost)
    return { playerId: player.playerId, plan, cost, income, loansTaken }
}

function applyPlan(player: HydratedDickeKartoffelnPlayerState, plan: Plan) {
    switch (plan.kind) {
        case PlanKind.TakeCompost:
            for (const { fieldId, worms } of plan.takes) {
                const field = player.field(fieldId)
                setWorms(field, field.worms - worms)
                player.freshCompost += worms
            }
            return
        case PlanKind.Cultivate:
            for (const fieldId of plan.fieldIds) {
                player.field(fieldId).furrow = true
            }
            return
        case PlanKind.Sow:
            for (const { fieldId, variety } of plan.seeds) {
                player.field(fieldId).seed = variety
            }
            return
        case PlanKind.Fertilize:
            for (const fieldId of plan.fieldIds) {
                const field = player.field(fieldId)
                field.fertilizer = fertilizerSacks(field)
            }
            return
        case PlanKind.Spray:
            for (const fieldId of plan.fieldIds) {
                player.field(fieldId).poison = true
            }
            return
        case PlanKind.RegisterSales:
            for (const { fieldId, norm, bio } of plan.sales) {
                player.field(fieldId).sale = { norm, bio }
            }
            return
        case PlanKind.SpreadCompost:
            for (const { fieldId, worms } of plan.placements) {
                const field = player.field(fieldId)
                setWorms(field, field.worms + worms)
            }
            player.ripeCompost = 0
            return
    }
}

export function planFieldIds(plan: Plan): number[] {
    switch (plan.kind) {
        case PlanKind.TakeCompost:
            return plan.takes.map((take) => take.fieldId)
        case PlanKind.Cultivate:
        case PlanKind.Fertilize:
        case PlanKind.Spray:
            return plan.fieldIds
        case PlanKind.Sow:
            return plan.seeds.map((seed) => seed.fieldId)
        case PlanKind.RegisterSales:
            return plan.sales.map((sale) => sale.fieldId)
        case PlanKind.SpreadCompost:
            return plan.placements.map((placement) => placement.fieldId)
    }
}

function isCount(value: number): boolean {
    return Number.isSafeInteger(value) && value >= 0
}

function firstProblem(problems: (string | undefined)[]): string | undefined {
    return problems.find((problem) => problem !== undefined)
}

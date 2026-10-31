import {
    ActionSource,
    PlayerStatus,
    defaultGameConfig,
    normalizeGameConfig,
    type Game,
    type GameConfig
} from '@tabletop/common'
import { MAX_WORMS, VARIETIES } from '../components/potatoes.js'
import { ActionType } from '../definition/actions.js'
import { Definition } from '../definition/definition.js'
import { DickeKartoffelnInfo } from '../definition/info.js'
import { DickeKartoffelnRuntime } from '../definition/runtime.js'
import type { HydratedDickeKartoffelnGameState } from '../model/gameState.js'
import { isSown } from '../model/planRules.js'
import { PlanKind, isPlanningState, planKindFor, type Plan } from '../model/plans.js'
import { isOrganic, type HydratedDickeKartoffelnPlayerState } from '../model/playerState.js'
import type { SubmitPlan } from '../actions/submitPlan.js'

export function createGame(count: number, config: GameConfig = {}): Game {
    return DickeKartoffelnRuntime.initializer.initializeGame(
        {
            id: 'dicke-kartoffeln-test',
            typeId: DickeKartoffelnInfo.id,
            ownerId: 'owner',
            config: normalizeGameConfig({
                ...defaultGameConfig(DickeKartoffelnInfo.configurator?.options ?? []),
                ...config
            }),
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

// A plausible farmer: varied enough to reach every rule over a game, deterministic by step.
export function botPlan(
    state: HydratedDickeKartoffelnGameState,
    playerId: string,
    step: number
): Plan {
    const machineState = state.machineState
    if (!isPlanningState(machineState)) {
        throw Error(`Nothing to plan in ${machineState}`)
    }
    const player = state.getPlayerState(playerId)
    const kind = planKindFor(machineState)
    switch (kind) {
        case PlanKind.TakeCompost:
            return {
                kind,
                takes: player.fields
                    .filter((field) => field.worms >= 4 && step % 3 === 0)
                    .slice(0, 1)
                    .map((field) => ({ fieldId: field.id, worms: 1 }))
            }
        case PlanKind.Cultivate:
            return {
                kind,
                fieldIds: player.fields
                    .filter((field) => field.worms >= 2)
                    .slice(0, 2 + (step % 3))
                    .map((field) => field.id)
            }
        case PlanKind.Sow:
            return {
                kind,
                seeds: player.fields
                    .filter((field) => field.furrow && (field.id + step) % 5 !== 0)
                    .map((field, index) => ({
                        fieldId: field.id,
                        variety: VARIETIES[(index + step) % VARIETIES.length]
                    }))
            }
        case PlanKind.Fertilize:
            return {
                kind,
                fieldIds: player.fields
                    .filter(
                        (field) => isSown(field) && field.worms >= 3 && (field.id + step) % 2 === 0
                    )
                    .map((field) => field.id)
            }
        case PlanKind.Spray:
            return {
                kind,
                fieldIds: player.fields
                    .filter((field) => isSown(field) && (field.id + step) % 4 === 0)
                    .map((field) => field.id)
            }
        case PlanKind.RegisterSales:
            return { kind, sales: sellEverything(player, step) }
        case PlanKind.SpreadCompost:
            return { kind, placements: spreadCompost(player) }
    }
}

function sellEverything(player: HydratedDickeKartoffelnPlayerState, step: number) {
    return player.fields.flatMap((field) => {
        const sacks = field.harvest ?? 0
        if (sacks === 0 || (field.id + step) % 7 === 0) return []
        const bio = isOrganic(field) ? Math.ceil(sacks / 2) : 0
        return [{ fieldId: field.id, norm: sacks - bio, bio }]
    })
}

function spreadCompost(player: HydratedDickeKartoffelnPlayerState) {
    let remaining = player.ripeCompost
    const placements = []
    for (const field of player.fields.toSorted((a, b) => a.worms - b.worms)) {
        const worms = Math.min(remaining, MAX_WORMS - field.worms)
        if (worms > 0 && placements.length < 2) {
            placements.push({ fieldId: field.id, worms })
            remaining -= worms
        }
    }
    return placements
}

export function botAction(
    state: HydratedDickeKartoffelnGameState,
    playerId: string,
    step: number
): SubmitPlan {
    return {
        id: `a${step}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.SubmitPlan,
        playerId,
        plan: botPlan(state, playerId, step),
        simultaneousGroupId: `${state.year()}-${state.machineState}`
    }
}

import {
    normalizeMasterSeed,
    type GameRuntime,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'
import type { AuthorizationService } from '$lib/services/authorizationService.js'

export type GameCreationAccess = Pick<AuthorizationService, 'canUseDeveloperTools' | 'actAsAdmin'>

export class GameCreationPrivileges {
    private readonly access: GameCreationAccess
    seedEntry: string = $state('')
    ownerIncluded: boolean = $state(true)

    constructor(access: GameCreationAccess) {
        this.access = access
    }

    canExcludeOwner: boolean = $derived.by(() => this.access.canUseDeveloperTools)
    ownerExclusionLapsed: boolean = $derived(!this.ownerIncluded && !this.canExcludeOwner)
    canEnterSeed: boolean = $derived.by(() => this.access.actAsAdmin)
    seed: string = $derived(this.canEnterSeed ? this.seedEntry.trim() : '')
}

export type ReproductionSeed = { masterSeed: string } | { seed: number }

export function parseReproductionSeed(
    seed: string,
    runtime: Pick<GameRuntime<GameState, HydratedGameState>, 'randomnessVersion'>
): ReproductionSeed {
    if (runtime.randomnessVersion === 1) {
        return { masterSeed: normalizeMasterSeed(seed) }
    }
    const numericSeed = Number(seed)
    if (!Number.isInteger(numericSeed)) {
        throw Error('Invalid numeric seed')
    }
    return { seed: numericSeed }
}

import {
    normalizeMasterSeed,
    type GameRuntime,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'
import type { AuthorizationService } from '$lib/services/authorizationService.js'

export type GameCreationAccess = Pick<AuthorizationService, 'canUseDeveloperTools' | 'actAsAdmin'>

// The server grants an unlisted game, an unseated owner and a reproduction seed only to a
// Principal that holds the access at the moment of creation, so a choice made earlier stops
// applying while the access has lapsed and applies again once it is held.
export class GameCreationPrivileges {
    private readonly access: GameCreationAccess
    seedEntry: string = $state('')
    unlistedChoice: boolean = $state(false)
    ownerIncluded: boolean = $state(true)

    constructor(access: GameCreationAccess) {
        this.access = access
    }

    canChooseUnlisted: boolean = $derived.by(() => this.access.canUseDeveloperTools)
    unlisted: boolean = $derived(this.canChooseUnlisted && this.unlistedChoice)
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

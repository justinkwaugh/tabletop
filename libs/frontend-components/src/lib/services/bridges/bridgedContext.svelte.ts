import type { AuthorizationService } from '$lib/services/authorizationService.js'
import { AuthorizationBridge } from './authorizationBridge.svelte.js'

export type BridgedContextOptions = {
    authorizationService: AuthorizationService
}

export class BridgedContext {
    readonly authorization: AuthorizationBridge
    private stopEffects?: () => void

    constructor({ authorizationService }: BridgedContextOptions) {
        this.authorization = new AuthorizationBridge(authorizationService)
        this.stopEffects = $effect.root(() => {
            this.authorization.connect()
        })
    }

    dispose() {
        this.stopEffects?.()
        this.stopEffects = undefined
    }
}

import type { User } from '@tabletop/common'
import type { AuthorizationService } from '$lib/services/authorizationService.js'
import { writable, type Writable } from 'svelte/store'

export class AuthorizationBridge {
    readonly showDebug: Writable<boolean>
    readonly actAsAdmin: Writable<boolean>
    readonly user: Writable<User | undefined>

    constructor(private authorizationService: AuthorizationService) {
        this.showDebug = writable(this.authorizationService.showDebug)
        this.actAsAdmin = writable(this.authorizationService.actAsAdmin)
        this.user = writable(this.authorizationService.getSessionUser())
    }

    connect() {
        $effect(() => {
            this.showDebug.set(this.authorizationService.showDebug)
            this.actAsAdmin.set(this.authorizationService.actAsAdmin)
            this.user.set(this.authorizationService.getSessionUser())
        })
    }
}

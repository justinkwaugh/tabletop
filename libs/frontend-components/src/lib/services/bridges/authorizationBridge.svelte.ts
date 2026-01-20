import type { User } from '@tabletop/common'
import type { AuthorizationService } from '$lib/services/authorizationService.js'
import { RuneBackedStore } from '$lib/utils/runeBackedStore.svelte.js'

export class AuthorizationBridge {
    readonly showDebug: RuneBackedStore<boolean>
    readonly actAsAdmin: RuneBackedStore<boolean>
    readonly user: RuneBackedStore<User | undefined>

    constructor(private authorizationService: AuthorizationService) {
        this.showDebug = new RuneBackedStore(() => this.authorizationService.showDebug)
        this.actAsAdmin = new RuneBackedStore(() => this.authorizationService.actAsAdmin)
        this.user = new RuneBackedStore(() => this.authorizationService.getSessionUser())
    }

    connect() {
        this.showDebug.connect()
        this.actAsAdmin.connect()
        this.user.connect()
    }
}

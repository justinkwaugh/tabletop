import { APIError } from '@tabletop/frontend-components'

export function requiresRecentAuthentication(error: unknown): boolean {
    return error instanceof APIError && error.name === 'RecentAuthenticationRequiredError'
}

export type PendingSensitiveAction = {
    description: string
    retry: () => Promise<void>
    requiresUserGesture?: boolean
    prepare?: () => Promise<PreparedSensitiveAction>
}

type PreparedSensitiveAction = {
    run: () => Promise<void>
    requiresUserGesture: boolean
    expiresAt: number
}

class ReauthenticationRequests {
    pending: PendingSensitiveAction | undefined = $state.raw(undefined)
    confirmed: boolean = $state(false)
    private revision = 0
    private prepared: PreparedSensitiveAction | undefined

    request(action: PendingSensitiveAction): void {
        this.cancel()
        this.pending = { ...action }
    }

    async complete(action: PendingSensitiveAction): Promise<void> {
        if (this.pending !== action) return
        if (action.requiresUserGesture) {
            this.confirmed = true
            return
        }
        await this.run(action)
    }

    async resume(action: PendingSensitiveAction): Promise<void> {
        if (this.pending !== action || !this.confirmed) return
        const prepared = this.prepared
        if (prepared && prepared.expiresAt > Date.now()) {
            await this.perform(action, prepared.run)
        } else {
            await this.run(action)
        }
    }

    cancel(action?: PendingSensitiveAction): void {
        if (action && this.pending !== action) return
        this.revision += 1
        this.pending = undefined
        this.confirmed = false
        this.prepared = undefined
    }

    async run(action: PendingSensitiveAction): Promise<void> {
        await this.perform(action, async (revision) => {
            if (!action.prepare) {
                await action.retry()
                return
            }
            const prepared = await action.prepare()
            if (revision !== this.revision) return
            if (prepared.requiresUserGesture) {
                this.request(action)
                this.prepared = prepared
                this.confirmed = true
            } else {
                await prepared.run()
            }
        })
    }

    private async perform(
        action: PendingSensitiveAction,
        operation: (revision: number) => Promise<void>
    ): Promise<void> {
        this.cancel()
        const revision = this.revision
        try {
            await operation(revision)
        } catch (error) {
            if (revision !== this.revision) return
            if (!requiresRecentAuthentication(error)) {
                throw error
            }
            this.request(action)
        }
    }
}

export const reauthentication = new ReauthenticationRequests()

import { APIError } from '@tabletop/frontend-components'

export function requiresRecentAuthentication(error: unknown): boolean {
    return error instanceof APIError && error.name === 'RecentAuthenticationRequiredError'
}

export type PendingSensitiveAction = {
    description: string
    retry: () => Promise<void>
    requiresUserGesture?: boolean
}

class ReauthenticationRequests {
    pending: PendingSensitiveAction | undefined = $state.raw(undefined)
    confirmed: boolean = $state(false)
    private revision = 0

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
        await this.retry(action)
    }

    async resume(action: PendingSensitiveAction): Promise<void> {
        if (this.pending !== action || !this.confirmed) return
        await this.retry(action)
    }

    cancel(action?: PendingSensitiveAction): void {
        if (action && this.pending !== action) return
        this.revision += 1
        this.pending = undefined
        this.confirmed = false
    }

    async run(action: PendingSensitiveAction): Promise<void> {
        this.cancel()
        const revision = this.revision
        try {
            await action.retry()
        } catch (error) {
            if (revision !== this.revision) return
            if (!requiresRecentAuthentication(error)) {
                throw error
            }
            this.request(action)
        }
    }

    private async retry(action: PendingSensitiveAction): Promise<void> {
        this.cancel(action)
        await action.retry()
    }
}

export const reauthentication = new ReauthenticationRequests()

import { APIError } from '@tabletop/frontend-components'

export function requiresRecentAuthentication(error: unknown): boolean {
    return error instanceof APIError && error.name === 'RecentAuthenticationRequiredError'
}

export type PendingSensitiveAction = {
    description: string
    retry: () => Promise<void>
}

// One prompt, mounted by the app layout, serves every sensitive action: a component that is
// refused for want of Recent Authentication hands over what to retry once the person has proved
// their identity again.
class ReauthenticationRequests {
    pending: PendingSensitiveAction | undefined = $state(undefined)

    request(action: PendingSensitiveAction): void {
        this.pending = action
    }

    async complete(): Promise<void> {
        const action = this.pending
        this.pending = undefined
        await action?.retry()
    }

    cancel(): void {
        this.pending = undefined
    }

    async run(action: PendingSensitiveAction): Promise<void> {
        try {
            await action.retry()
        } catch (error) {
            if (!requiresRecentAuthentication(error)) {
                throw error
            }
            this.request(action)
        }
    }
}

export const reauthentication = new ReauthenticationRequests()

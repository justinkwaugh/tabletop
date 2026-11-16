import { ACTIVITY_UNAVAILABLE } from '@tabletop/common'

export function activityLoadFailure(error: unknown): 'unavailable' | 'error' {
    return error instanceof Error && error.name === ACTIVITY_UNAVAILABLE ? 'unavailable' : 'error'
}

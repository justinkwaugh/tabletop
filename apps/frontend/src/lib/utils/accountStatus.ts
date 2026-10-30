import { UserStatus } from '@tabletop/common'

export const accountStatusLabels: Record<UserStatus, string> = {
    [UserStatus.Active]: 'Active',
    [UserStatus.Incomplete]: 'Incomplete',
    [UserStatus.Inactive]: 'Inactive',
    [UserStatus.Deleted]: 'Deleted'
}

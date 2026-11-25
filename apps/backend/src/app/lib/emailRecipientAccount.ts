import type { User } from '@tabletop/common'
import type { UserService } from '@tabletop/backend-services'

// Tasks queued before they named their recipient find the account by its address.
export async function emailRecipientAccount(
    users: Pick<UserService, 'getUser' | 'getUserByEmail'>,
    { userId, email }: { userId: string | undefined; email: string }
): Promise<User | undefined> {
    return userId ? users.getUser(userId) : users.getUserByEmail(email)
}

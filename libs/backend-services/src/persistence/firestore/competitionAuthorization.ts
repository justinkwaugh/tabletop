import type { Firestore, Transaction } from '@google-cloud/firestore'
import { Role, UserStatus, type User } from '@tabletop/common'
import { CompetitionError } from '../../competitions/tournamentError.js'

export async function authorizeCompetitionAccount(
    firestore: Firestore,
    transaction: Transaction,
    user: User,
    administrative: boolean
): Promise<void> {
    const account = (await transaction.get(firestore.collection('users').doc(user.id))).data()
    if (account?.status !== UserStatus.Active)
        throw new CompetitionError('An active account is required', 403)
    if (administrative && (!Array.isArray(account.roles) || !account.roles.includes(Role.Admin)))
        throw new CompetitionError('Administrator access is required', 403)
}

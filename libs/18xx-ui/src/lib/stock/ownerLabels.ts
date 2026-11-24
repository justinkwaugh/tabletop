import type { Owner } from '@tabletop/18xx'
import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'

export function ownerShortLabel(
    session: Pick<EighteenXXSessionView, 'companyInitials'>,
    owner: Owner
): string {
    return owner.kind === 'company' ? session.companyInitials(owner.companyId) : 'Me'
}

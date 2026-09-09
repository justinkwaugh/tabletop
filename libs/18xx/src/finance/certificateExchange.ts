import { assert } from '@tabletop/common'
import type { FinancialState, Owner } from './finance.js'

export function exchangeCertificate(
    state: FinancialState,
    surrenderedId: string,
    receivedId: string
): Owner {
    const surrendered = state.certificates.find((certificate) => certificate.id === surrenderedId)
    const received = state.certificates.find((certificate) => certificate.id === receivedId)
    assert(surrendered && !surrendered.retired, 'Exchange requires an outstanding certificate')
    assert(
        received && !received.retired && received.id !== surrendered.id,
        'Exchange requires a replacement certificate'
    )
    const { owner, poolId: _poolId, ...interest } = surrendered
    state.certificates = state.certificates.map((certificate) =>
        certificate.id === surrenderedId ? { ...interest, retired: true } : certificate
    )
    received.owner = owner
    delete received.poolId
    return owner
}

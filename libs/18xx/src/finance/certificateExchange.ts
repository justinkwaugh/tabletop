import { assert } from '@tabletop/common'
import * as Type from 'typebox'
import { Owner, type FinancialState } from './finance.js'

export const CertificateExchange = Type.Object(
    { surrenderedId: Type.String(), receivedId: Type.String(), owner: Owner },
    { additionalProperties: false }
)
export type CertificateExchange = Type.Static<typeof CertificateExchange>

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

import { assert } from '@tabletop/common'
import * as Type from 'typebox'
import { Owner, removeCertificates, type FinancialState } from './finance.js'

export const CertificateExchange = Type.Object(
    {
        surrenderedId: Type.String(),
        surrenderedCompanyId: Type.String(),
        surrenderedNumber: Type.Optional(Type.Integer({ minimum: 1 })),
        receivedId: Type.String(),
        receivedCompanyId: Type.String(),
        receivedShares: Type.Integer({ minimum: 1 }),
        owner: Owner
    },
    { additionalProperties: false }
)
export type CertificateExchange = Type.Static<typeof CertificateExchange>

export function exchangeCertificate(
    state: FinancialState,
    surrenderedId: string,
    receivedId: string
): CertificateExchange {
    const surrendered = state.certificates.find((certificate) => certificate.id === surrenderedId)
    const received = state.certificates.find((certificate) => certificate.id === receivedId)
    assert(surrendered, 'Exchange requires an outstanding certificate')
    assert(
        received?.kind === 'share' && received.id !== surrendered.id,
        'Exchange requires a replacement share'
    )
    const owner = surrendered.owner
    removeCertificates(state, [surrenderedId])
    received.owner = owner
    delete received.poolId
    return {
        surrenderedId,
        surrenderedCompanyId: surrendered.companyId,
        ...(surrendered.kind === 'share' && surrendered.number
            ? { surrenderedNumber: surrendered.number }
            : {}),
        receivedId,
        receivedCompanyId: received.companyId,
        receivedShares: received.shares,
        owner
    }
}

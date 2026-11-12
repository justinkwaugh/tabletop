import { readFileSync } from 'node:fs'
import { GaribaldiId, TokenFees1849, lastCertificateId } from '@tabletop/1849'
import { isFloatCompany } from '@tabletop/18xx'
import { ActionSource, assert } from '@tabletop/common'
import { expect, it } from 'vitest'
import { describe1849Action, earthquakeCallout, floatTokenFee } from './history.js'
import { Presentation1849 } from './presentation.js'

const stations = [
    { id: 'IFT-2', companyId: 'IFT', status: 'removed' as const },
    { id: 'RCS-3', companyId: 'RCS', status: 'removed' as const }
]
const name = (companyId: string) => companyId
const names = { companyName: name, place: (locationId: string) => locationId }

it('calls out the tile and stations Messina lost and its lock (§12)', () => {
    expect(
        earthquakeCallout(
            {
                removedTile: { pieceId: 'piece', definitionId: '1849:14' },
                lostStationIds: ['IFT-2', 'RCS-3']
            },
            stations,
            name
        )
    ).toEqual({
        title: 'Earthquake at Messina',
        text: 'It is downgraded to yellow. IFT and RCS lose their stations there for good. It cannot be upgraded again until after the next stock round.'
    })
})

it('names a Garibaldi closed for want of another station (§12)', () => {
    expect(
        earthquakeCallout(
            {
                lostStationIds: ['IFT-2'],
                closedCorporation: {
                    companyId: 'AFG',
                    payments: [],
                    retiredCertificateIds: [],
                    closedPrivateIds: [],
                    removedReservations: [],
                    removedStationIds: [],
                    removedTrainIds: [],
                    restoredReservations: []
                }
            },
            stations,
            name
        ).text
    ).toBe(
        'IFT loses its station there for good. AFG has no other station and closes. It cannot be upgraded until after the next stock round.'
    )
})

it('says when nothing had been built at Messina (§12)', () => {
    expect(earthquakeCallout({ lostStationIds: [] }, stations, name).text).toBe(
        'It had no upgrade or station to lose. It cannot be upgraded until after the next stock round.'
    )
})

const recordedFloat = () => {
    const { actions } = JSON.parse(
        readFileSync(new URL('../scenarios/first-stock-round.json', import.meta.url), 'utf8')
    )
    const recorded = actions.find((action: { type: string }) => action.type === 'FloatCompany')
    // Stored actions carry their time as text; the client revives it as it loads them.
    const float = { ...recorded, createdAt: new Date(recorded.createdAt) }
    assert(isFloatCompany(float), 'The scenario records a flotation')
    return float
}

it('charges a corporation’s station tokens as it floats (§9.4)', () => {
    const float = recordedFloat()
    expect(floatTokenFee(float)).toBe(TokenFees1849[float.companyId])
    const description = describe1849Action(() => [])(float, names, () => ({
        text: 'RCS floated',
        detail: 'L. 200 capital'
    }))
    const fee = TokenFees1849[float.companyId]
    assert(fee !== undefined, 'Every corporation has a token fee')
    expect(description?.detail).toBe(
        `L. 200 capital · ${Presentation1849.money(fee)} for its 3 station tokens`
    )
})

it('charges the Garibaldi as it floats only when the bank funds it (§8.1, §9.4.1)', () => {
    const float = recordedFloat()
    assert(float.metadata, 'A recorded flotation has its payments')
    const funded = { ...float, companyId: GaribaldiId }
    expect(floatTokenFee(funded)).toBe(TokenFees1849[GaribaldiId])
    const unfunded = { ...funded, metadata: { ...float.metadata, payments: [] } }
    expect(floatTokenFee(unfunded)).toBeUndefined()
})

it('names what the outgoing president took for the president’s certificate (§9.5)', () => {
    const choice = (certificateIds: string[]) => ({
        id: 'choice',
        gameId: 'game',
        source: ActionSource.User,
        type: 'ChoosePresidencyExchange',
        playerId: 'p1',
        companyId: 'CTL',
        certificateIds
    })
    const describe = describe1849Action(() => [])
    const shared = () => ({ text: 'Took 1 certificate (2 shares)' })
    expect(describe(choice([lastCertificateId('CTL')]), names, shared)?.text).toBe(
        'Took the last certificate for CTL’s president’s certificate'
    )
    expect(describe(choice(['CTL:share:2', 'CTL:share:6']), names, shared)?.text).toBe(
        'Took two single certificates for CTL’s president’s certificate'
    )
})

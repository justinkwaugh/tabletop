import { expect, it } from 'vitest'
import { earthquakeCallout } from './history.js'

const stations = [
    { id: 'IFT-2', companyId: 'IFT', status: 'removed' as const },
    { id: 'RCS-3', companyId: 'RCS', status: 'removed' as const }
]
const name = (companyId: string) => companyId

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

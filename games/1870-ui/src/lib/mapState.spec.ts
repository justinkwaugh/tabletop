import { describe, expect, it } from 'vitest'
import { PortLocationIds, type RevenueToken } from '@tabletop/1870'
import { portLocationIds } from './mapState.js'

const portsShown = (revenueTokens: RevenueToken[], closed = false) =>
    portLocationIds({ revenueTokens, companies: [{ id: 'GSC', kind: 'private', closed }] })
const token = (kind: RevenueToken['kind'], locationId: string): RevenueToken => ({
    kind,
    companyId: 'IC',
    locationId,
    placedInRound: [1, 1]
})

describe('the port anchors', () => {
    it('show every port city until a port is placed', () => {
        expect(portsShown([])).toEqual(PortLocationIds)
        expect(portsShown([token('cattle', 'B9')])).toEqual(PortLocationIds)
    })
    it('show only the placed port’s city', () => {
        expect(portsShown([token('open-port', 'N17')])).toEqual(['N17'])
        expect(portsShown([token('closed-port', 'M14')], true)).toEqual(['M14'])
    })
    it('go once the Gulf Shipping Company has closed with no port placed', () => {
        expect(portsShown([], true)).toEqual([])
    })
})

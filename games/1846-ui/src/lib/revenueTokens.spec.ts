import { expect, it } from 'vitest'
import { assert } from '@tabletop/common'
import { revenueTokenArt } from './revenueTokens.js'

const marker = (privateCompanyId: 'MPC' | 'BT', locationId: string) => ({
    privateCompanyId,
    companyId: 'IC',
    locationId,
    setNumber: 1,
    roundNumber: 1
})

it('puts each placed marker’s token where it stands, covering the icon it replaces', () => {
    const art = revenueTokenArt({
        revenueMarkers: [marker('MPC', 'D6'), marker('BT', 'H12')],
        steamboat: { companyId: 'NYC', locationId: 'G19' }
    })
    expect(Object.keys(art).sort()).toEqual(['D6', 'G19', 'H12', 'I1'])
    expect(art.G19['NYC:SC']).toMatchObject({ token: { place: { covers: 'port' } } })
    expect(art.D6['IC:MPC']).toMatchObject({ token: { place: { covers: 'horns' } } })
    expect(art.H12['IC:BT']).toMatchObject({ token: { place: 'corner' } })
})

it('shows the bonus where the token stands: the Steamboat’s counts the port’s symbols', () => {
    const bonus = (locationId: string) => {
        const art = revenueTokenArt({
            revenueMarkers: [],
            steamboat: { companyId: 'IC', locationId }
        })[locationId]['IC:SC']
        assert('token' in art, 'The Steamboat is drawn as a token')
        return decodeURIComponent(art.token.imageUrl).match(/>\+(\d+)</)?.[1]
    }
    expect(bonus('G19')).toBe('40')
    expect(bonus('D14')).toBe('20')
})

it('hides the horns on the other meat-packing hex once its marker is down, and nowhere before', () => {
    expect(revenueTokenArt({ revenueMarkers: [] })).toEqual({})
    const art = revenueTokenArt({ revenueMarkers: [marker('MPC', 'I1')] })
    expect(art.D6).toEqual({ 'meat-packing': { hidden: true } })
    expect(art.I1['meat-packing']).toBeUndefined()
})

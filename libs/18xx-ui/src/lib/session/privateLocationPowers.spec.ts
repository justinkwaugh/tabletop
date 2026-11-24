import { describe, expect, it } from 'vitest'
import { privateLocationPowers } from './privateLocationPowers.js'
import type { PrivateMarkerOption, PrivateTokenOption } from './companyDecisionsModule.svelte.js'

const naming = {
    company: (id: string) => ({ P6: 'Import Hub', P8: 'Express', P20: 'Law Firm' })[id] ?? id,
    marker: (kind: string) => ({ hub: 'Hub token', express: 'Express station' })[kind] ?? kind
}

function powers(markers: PrivateMarkerOption[], tokens: PrivateTokenOption[] = []) {
    const placed: unknown[] = []
    const result = privateLocationPowers(markers, tokens, naming, {
        marker: async (option) => void placed.push(option),
        token: async (option) => void placed.push(option)
    })
    return { result, placed }
}

const marker = (privateCompanyId: string, kind: string, locationId: string, nodeId?: string) => ({
    privateCompanyId,
    playerId: 'alex',
    kind,
    locationId,
    ...(nodeId ? { nodeId } : {})
})
const token = (locationId: string, nodeId: string, slot = 0) => ({
    privateCompanyId: 'P20',
    playerId: 'alex',
    companyId: 'NYC',
    position: { locationId, nodeId, slot }
})

describe('private markers and stations chosen on the map', () => {
    it('offers one map power for each private, over every place it may mark', () => {
        const { result } = powers([
            marker('P6', 'hub', 'J20'),
            marker('P6', 'hub', 'J24'),
            marker('P8', 'express', 'J20')
        ])
        expect(
            result.map((power) => ({
                privateCompanyId: power.privateCompanyId,
                label: power.label,
                prompt: power.prompt,
                locationIds: power.kind === 'location' ? power.locationIds : []
            }))
        ).toEqual([
            {
                privateCompanyId: 'P6',
                label: 'Import Hub',
                prompt: 'Choose a highlighted place on the map for the hub token',
                locationIds: ['J20', 'J24']
            },
            {
                privateCompanyId: 'P8',
                label: 'Express',
                prompt: 'Choose a highlighted place on the map for the express station',
                locationIds: ['J20']
            }
        ])
    })

    it('marks the tapped place, and the tapped stop where a place offers several', async () => {
        const { result, placed } = powers([
            marker('P6', 'hub', 'J20'),
            marker('P6', 'hub', 'B2', 'east'),
            marker('P6', 'hub', 'B2', 'west')
        ])
        const [power] = result
        if (power.kind !== 'location') throw new Error('A marker is chosen on the map')
        await power.choose('J20')
        await power.choose('B2')
        await power.choose('B2', 'west')
        expect(placed).toEqual([marker('P6', 'hub', 'J20'), marker('P6', 'hub', 'B2', 'west')])
    })

    it('places a private station in the tapped city, offered in the station step too', async () => {
        const { result, placed } = powers(
            [],
            [token('H14', 'city', 1), token('D28', 'north'), token('D28', 'south')]
        )
        const [power] = result
        if (power.kind !== 'location') throw new Error('A station is chosen on the map')
        expect(power.label).toBe('Law Firm')
        expect(power.stationStepLabel).toBe('Law Firm')
        expect(power.locationIds).toEqual(['H14', 'D28'])
        await power.choose('H14')
        await power.choose('D28')
        await power.choose('D28', 'south')
        expect(placed).toEqual([token('H14', 'city', 1), token('D28', 'south')])
    })
})

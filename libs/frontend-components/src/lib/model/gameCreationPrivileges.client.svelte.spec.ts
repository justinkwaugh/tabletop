import { describe, expect, test } from 'vitest'
import { GameCreationPrivileges, parseReproductionSeed } from './gameCreationPrivileges.svelte.js'

class Access {
    canUseDeveloperTools: boolean = $state(false)
    actAsAdmin: boolean = $state(false)
}

function adminInMode() {
    const access = new Access()
    access.canUseDeveloperTools = true
    access.actAsAdmin = true
    return access
}

function adminModeEnds(access: Access) {
    access.canUseDeveloperTools = false
    access.actAsAdmin = false
}

describe('GameCreationPrivileges', () => {
    test('a reproduction seed typed in Admin Mode applies only while the mode is held', () => {
        const access = adminInMode()
        const privileges = new GameCreationPrivileges(access)
        privileges.seedEntry = ' 0123456789ABCDEF0123456789abcdef '
        expect(privileges.canEnterSeed).toBe(true)
        expect(privileges.seed).toBe('0123456789ABCDEF0123456789abcdef')

        adminModeEnds(access)
        expect(privileges.canEnterSeed).toBe(false)
        expect(privileges.seed).toBe('')

        access.actAsAdmin = true
        expect(privileges.seed).toBe('0123456789ABCDEF0123456789abcdef')
    })

    test('an unlisted choice applies only while developer access is held', () => {
        const access = adminInMode()
        const privileges = new GameCreationPrivileges(access)
        privileges.unlistedChoice = true
        expect(privileges.unlisted).toBe(true)

        adminModeEnds(access)
        expect(privileges.canChooseUnlisted).toBe(false)
        expect(privileges.unlisted).toBe(false)

        access.canUseDeveloperTools = true
        expect(privileges.unlisted).toBe(true)
    })

    test('an unseated owner is flagged once the access lapses and clears when seated again', () => {
        const access = adminInMode()
        const privileges = new GameCreationPrivileges(access)
        privileges.ownerIncluded = false
        expect(privileges.ownerExclusionLapsed).toBe(false)

        adminModeEnds(access)
        expect(privileges.canExcludeOwner).toBe(false)
        expect(privileges.ownerExclusionLapsed).toBe(true)

        privileges.ownerIncluded = true
        expect(privileges.ownerExclusionLapsed).toBe(false)
    })

    test('a Developer outside Admin Mode keeps the unlisted and owner choices but not the seed', () => {
        const access = new Access()
        access.canUseDeveloperTools = true
        const privileges = new GameCreationPrivileges(access)
        privileges.unlistedChoice = true
        privileges.ownerIncluded = false
        privileges.seedEntry = '42'
        expect(privileges.unlisted).toBe(true)
        expect(privileges.ownerExclusionLapsed).toBe(false)
        expect(privileges.canEnterSeed).toBe(false)
        expect(privileges.seed).toBe('')
    })
})

describe('parseReproductionSeed', () => {
    test('normalizes a master seed for a runtime with reproducible randomness', () => {
        expect(
            parseReproductionSeed('0123456789ABCDEF0123456789abcdef', { randomnessVersion: 1 })
        ).toEqual({ masterSeed: '0123456789abcdef0123456789abcdef' })
        expect(() => parseReproductionSeed('42', { randomnessVersion: 1 })).toThrow()
    })

    test('reads a legacy numeric seed for other runtimes', () => {
        expect(parseReproductionSeed('42', {})).toEqual({ seed: 42 })
        expect(() => parseReproductionSeed('4.2', {})).toThrow('Invalid numeric seed')
        expect(() => parseReproductionSeed('abc', {})).toThrow('Invalid numeric seed')
    })
})

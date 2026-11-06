import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RoyalWrits, type WritId } from '../data/writs.js'
import { initialState } from '../testing/state.js'
import {
    WritRegistry,
    writRegistry,
    type CharterRegistration,
    type MandateAlternativeEffect,
    type MandateRegistration,
    type WeaponRegistration
} from './writRegistry.js'

const shipForWood: MandateAlternativeEffect = {
    turnedIn: ['wood'],
    reward: { kind: 'vessel', vessel: 'ship' },
    reveals: 'nothing'
}

const vesselMandate: MandateRegistration = {
    writId: 'writ.mandate.2',
    timing: 'at-will',
    printedText: 'Turn in wood: ship*',
    alternatives: [shipForWood]
}

const threeGoods: MandateAlternativeEffect = {
    turnedIn: [],
    reward: { kind: 'goods', amount: 3 },
    rewardGuild: 'farmer',
    reveals: 'draw'
}

const guildMandate: MandateRegistration = {
    writId: 'writ.mandate.6',
    timing: 'at-will',
    printedText: 'Reach 3 stars in 1 guild',
    alternatives: [threeGoods]
}

const bow: WeaponRegistration = {
    writId: 'writ.mandate.1',
    timing: 'attack',
    printedText: 'Use bow for free: +1 attack',
    bonuses: [{ turnedIn: [], attack: 1 }]
}

const monsterDefeat: CharterRegistration = {
    writId: 'writ.charter.monster-defeat',
    timing: 'end-scoring',
    printedText: 'If you defeat either monster during game: 7 vp',
    score: () => 7
}

const allWritIds: readonly WritId[] = RoyalWrits.map((writ) => writ.id)

describe('writRegistry', () => {
    let registry: WritRegistry

    beforeEach(() => {
        registry = new WritRegistry()
    })

    describe('with no registration (R-4.4)', () => {
        it('every query returns nothing usable, for every writ', () => {
            const state = initialState()
            const playerId = state.players[0].playerId
            for (const writId of allWritIds) {
                expect(registry.mandateAlternatives(writId)).toEqual([])
                expect(registry.mandateAlternative(writId, 0)).toBeUndefined()
                expect(registry.weaponBonus(writId, 0)).toBeUndefined()
                expect(registry.charterScore(writId, state, playerId)).toBeUndefined()
            }
            expect(registry.registrations()).toEqual([])
        })

        it('every refusal names the writ, for an action to refuse with', () => {
            for (const writId of allWritIds) {
                expect(registry.reasonMandateRefused(writId, 0)).toContain(writId)
                expect(registry.reasonWeaponRefused(writId, 0)).toContain(writId)
                expect(registry.reasonCharterRefused(writId)).toContain(writId)
            }
        })

        /** This file loads no registrations, as a module reading the registry before them would. */
        it('the shared registry starts empty', () => {
            expect(writRegistry.registrations()).toEqual([])
        })
    })

    describe('a registration (R-4.4)', () => {
        it('names a writ id that exists', () => {
            expect(() =>
                registry.register({ ...vesselMandate, writId: 'writ.mandate.99' })
            ).toThrow(/writ\.mandate\.99/)
        })

        it('names printed text', () => {
            expect(() => registry.register({ ...vesselMandate, printedText: ' ' })).toThrow(
                /printed text/
            )
        })

        it('is refused when a writ is registered twice under its timing', () => {
            registry.register(vesselMandate)
            expect(() => registry.register(vesselMandate)).toThrow(/already registered/)
            expect(registry.registrations()).toEqual([vesselMandate])
        })

        /** R-4.4-H1 Weapons only through the attack; every other mandate at will. */
        it('is refused under a timing its writ does not have', () => {
            expect(() =>
                registry.register({
                    writId: 'writ.mandate.1',
                    timing: 'at-will',
                    printedText: bow.printedText,
                    alternatives: [shipForWood]
                })
            ).toThrow(/attack/)
            expect(() =>
                registry.register({
                    writId: 'writ.mandate.2',
                    timing: 'attack',
                    printedText: vesselMandate.printedText,
                    bonuses: bow.bonuses
                })
            ).toThrow(/at-will/)
        })

        it('is refused with nothing to offer (R-4.4.2)', () => {
            expect(() => registry.register({ ...vesselMandate, alternatives: [] })).toThrow(
                /alternative/
            )
            expect(() => registry.register({ ...bow, bonuses: [] })).toThrow(/alternative/)
        })
    })

    describe('the queries', () => {
        it('mandate alternative: cost, reward and what it reveals (R-4.4.2, R-X.2)', () => {
            registry.register(vesselMandate)
            expect(registry.mandateAlternatives('writ.mandate.2')).toEqual([shipForWood])
            expect(registry.mandateAlternative('writ.mandate.2', 0)).toEqual(shipForWood)
            expect(registry.reasonMandateRefused('writ.mandate.2', 0)).toBeUndefined()
        })

        it('refuses an alternative the mandate does not have (R-4.4.2)', () => {
            registry.register(vesselMandate)
            expect(registry.mandateAlternative('writ.mandate.2', 1)).toBeUndefined()
            expect(registry.reasonMandateRefused('writ.mandate.2', 1)).toContain('writ.mandate.2')
        })

        it('a guild-status reward is chosen by its guild alone (R-4.4.2)', () => {
            registry.register(guildMandate)
            expect(registry.mandateAlternative('writ.mandate.6', 0, 'farmer')).toEqual(threeGoods)
            expect(registry.mandateAlternative('writ.mandate.6', 0)).toBeUndefined()
            expect(registry.mandateAlternative('writ.mandate.6', 0, 'merchant')).toBeUndefined()
            expect(registry.reasonMandateRefused('writ.mandate.6', 0, 'merchant')).toContain(
                'merchant'
            )
        })

        it('weapon bonus, only for the attack (R-4.4-H1, R-4.8.2)', () => {
            registry.register(bow)
            expect(registry.weaponBonus('writ.mandate.1', 0)).toEqual({ turnedIn: [], attack: 1 })
            expect(registry.reasonWeaponRefused('writ.mandate.1', 0)).toBeUndefined()
            expect(registry.weaponBonus('writ.mandate.1', 1)).toBeUndefined()
            expect(registry.reasonWeaponRefused('writ.mandate.1', 1)).toContain('writ.mandate.1')
            expect(registry.mandateAlternatives('writ.mandate.1')).toEqual([])
            expect(registry.reasonMandateRefused('writ.mandate.1', 0)).toContain('writ.mandate.1')
        })

        it('charter score, only for a charter (R-4.4.3, R-6.2)', () => {
            registry.register(monsterDefeat)
            const state = initialState()
            const playerId = state.players[0].playerId
            expect(registry.charterScore('writ.charter.monster-defeat', state, playerId)).toBe(7)
            expect(registry.reasonCharterRefused('writ.charter.monster-defeat')).toBeUndefined()
            expect(registry.charterScore('writ.mandate.1', state, playerId)).toBeUndefined()
        })

        it('lists every registration with its printed text, for the reach sweeps', () => {
            registry.register(vesselMandate)
            registry.register(bow)
            registry.register(monsterDefeat)
            expect(registry.registrations()).toEqual([vesselMandate, bow, monsterDefeat])
        })
    })
})

interface SourceFiles {
    readdirSync(path: URL, options: { recursive: true; encoding: 'utf8' }): string[]
    readFileSync(path: URL, encoding: 'utf8'): string
}

/** R-4.4 Only the data and the registrations name a writ; every other reader goes through the queries. */
describe('reading writ effects', () => {
    const writIdInSource = /writ\.(?:mandate|charter)\./

    async function sourcesNamingAWrit(): Promise<string[]> {
        const fs = await vi.importActual<SourceFiles>('node:fs')
        const root = new URL('../', import.meta.url)
        return fs
            .readdirSync(root, { recursive: true, encoding: 'utf8' })
            .filter((file) => file.endsWith('.ts'))
            .filter((file) => writIdInSource.test(fs.readFileSync(new URL(file, root), 'utf8')))
    }

    it('no action, state handler, helper or scorer tests a writ id inline', async () => {
        const offenders = (await sourcesNamingAWrit()).filter(
            (file) =>
                !file.endsWith('.spec.ts') &&
                !file.startsWith('data/') &&
                !file.startsWith('writs/') &&
                !file.startsWith('testing/')
        )
        expect(offenders).toEqual([])
    })

    it('the sweep can see a writ id where there is one', async () => {
        expect(await sourcesNamingAWrit()).toContain('data/writs.ts')
    })
})

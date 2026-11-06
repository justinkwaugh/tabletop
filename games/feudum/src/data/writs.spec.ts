import { beforeAll, describe, expect, it } from 'vitest'
import { docTableRows, readDoc } from '../testing/docs.js'
import { WineBarrelCapacity } from './components.js'
import { ProvisionalCards } from './provisional.cards.js'
import {
    Charters,
    Mandates,
    MandateStatusStars,
    RoyalWrits,
    type Charter,
    type KingdomCharter,
    type Mandate,
    type MandateReward,
    type TurnInMandate
} from './writs.js'

let mandateRows: Record<string, string>[] = []
let charterRows: Record<string, string>[] = []
let totals: Record<string, string>[] = []
let boardSpaces: string[] = []

function rewardText(reward: MandateReward): string {
    switch (reward.kind) {
        case 'attack':
            return `+${reward.amount} attack`
        case 'vessel':
            return reward.vessel.replace('-', ' ')
        case 'shillings':
            return `${reward.amount}s`
        case 'goods':
            return `${reward.amount} goods`
        case 'influence':
            return `${reward.amount} influence`
        case 'seal':
            return `${reward.amount} seal`
        case 'bead':
            return `${reward.amount} bead`
    }
}

function turnedInCell(cell: string): string[] {
    return cell.startsWith('none') ? [] : cell.split(' + ')
}

function turnedInOfText(text: string): string[] {
    const named = /^Turn in (.*):/.exec(text)?.[1]
    return named === undefined ? [] : named.split(/, | & /)
}

function isTurnIn(mandate: Mandate): mandate is TurnInMandate {
    return mandate.kind === 'turn-in'
}

function mandate(number: number): Mandate {
    const found = Mandates.find((row) => row.number === number)
    if (found === undefined) {
        throw new Error(`No mandate ${number}`)
    }
    return found
}

function charter(id: string): Charter {
    const found = Charters.find((row) => row.id === id)
    if (found === undefined) {
        throw new Error(`No charter ${id}`)
    }
    return found
}

function isKingdom(row: Charter): row is KingdomCharter {
    return row.kind === 'kingdom'
}

function kingdom(id: string): KingdomCharter {
    const found = charter(id)
    if (!isKingdom(found)) {
        throw new Error(`${id} is no kingdom charter`)
    }
    return found
}

/** Spaces as `components.md` writes them, `badlands-1..5, mountain-1`, as ids. */
function spacesOfCell(cell: string): string[] {
    return cell
        .replace(/ \(.*\)$/, '')
        .split(', ')
        .flatMap((group) => {
            const [, region = '', from = '', to] = /^(\w+)-(\d+)(?:\.\.(\d+))?$/.exec(group) ?? []
            const last = Number(to ?? from)
            return Array.from(
                { length: last - Number(from) + 1 },
                (_, index) => `space.${region}.${Number(from) + index}`
            )
        })
}

beforeAll(async () => {
    const components = await readDoc('components.md')
    mandateRows = docTableRows(components, '### Mandates (8, play once at any time)')
    charterRows = docTableRows(
        components,
        "### Charters (8, score at game end only with a king's seal on them)"
    )
    totals = docTableRows(components, '## Totals')
    boardSpaces = docTableRows(components, '## Board spaces (22)').map((row) => row['Id'] ?? '')
})

describe('R-4.4 the Royal Writs', () => {
    it('8 mandates and 8 charters: 16, each id once', () => {
        expect(Mandates).toHaveLength(8)
        expect(Charters).toHaveLength(8)
        expect(RoyalWrits).toHaveLength(16)
        expect(new Set(RoyalWrits.map((writ) => writ.id)).size).toBe(16)
        const total = (component: string): string | undefined =>
            totals.find((row) => row['Kind'] === component)?.['Rows above']
        expect(total('Royal Writ mandates')).toBe('8')
        expect(total('Royal Writ charters')).toBe('8')
        expect(total('Royal Writs (mandates + charters)')).toBe('16')
    })
})

describe('R-4.4.2, R-7 the mandates of components.md', () => {
    it('numbers 1 to 8 with permanent ids', () => {
        expect(Mandates.map((row) => row.id)).toEqual(mandateRows.map((row) => row['Id']))
        expect(Mandates.map((row) => row.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
        for (const row of Mandates) {
            expect(row.id).toBe(`writ.mandate.${row.number}`)
        }
    })

    it('the printed text and the picture of each', () => {
        for (const [index, row] of Mandates.entries()) {
            const printed = mandateRows[index] ?? {}
            expect(row.picture, row.id).toBe(printed['Recipe / boxed picture'])
            if (isTurnIn(row)) {
                expect(row.alternatives[0].text, row.id).toBe(printed['Alternative A (printed)'])
                expect(row.alternatives[1].text, row.id).toBe(printed['Alternative B (printed)'])
            } else {
                expect(row.text, row.id).toBe(printed['Alternative A (printed)'])
            }
        }
    })

    it('R-7 each alternative: the goods turned in, its reward and its drawn-from-supply mark', () => {
        for (const row of Mandates.filter(isTurnIn)) {
            const printed = mandateRows[row.number - 1] ?? {}
            const [first, second] = row.alternatives
            expect(first.turnedIn, row.id).toEqual(turnedInCell(printed['Turned in for A'] ?? ''))
            expect(second.turnedIn, row.id).toEqual(turnedInCell(printed['Turned in for B'] ?? ''))
            for (const alternative of row.alternatives) {
                expect(alternative.turnedIn, alternative.text).toEqual(
                    turnedInOfText(alternative.text)
                )
                expect(alternative.drawnFromSupply, alternative.text).toBe(
                    alternative.text.endsWith('*')
                )
                expect(
                    alternative.text
                        .replace(/\*$/, '')
                        .endsWith(`: ${rewardText(alternative.reward)}`),
                    alternative.text
                ).toBe(true)
            }
        }
    })

    it('mandates 1 and 3 are weapons, and no other (R-4.4-H1)', () => {
        expect(Mandates.filter((row) => row.weapon).map((row) => row.number)).toEqual([1, 3])
    })

    it('a weapon has a free alternative of +1 attack and one turned in for +2', () => {
        for (const row of Mandates.filter((candidate) => candidate.weapon).filter(isTurnIn)) {
            expect(
                row.alternatives.map(({ reward }) => reward),
                row.id
            ).toEqual([
                { kind: 'attack', amount: 1 },
                { kind: 'attack', amount: 2 }
            ])
            expect(row.alternatives[0].turnedIn, row.id).toEqual([])
            expect(row.alternatives[1].turnedIn, row.id).toHaveLength(1)
        }
    })

    it('the ship option appears on mandates 2 and 4', () => {
        const ships = Mandates.filter(isTurnIn)
            .filter((row) =>
                row.alternatives.some(
                    ({ reward }) => reward.kind === 'vessel' && reward.vessel === 'ship'
                )
            )
            .map((row) => row.number)
        expect(ships).toEqual([2, 4])
    })

    it.each([
        [6, 'Farmer: 3 goods*; Merchant: 3s*; Alchemist: a ship* (R-4.4-H4). One reward per card'],
        [8, 'Knight: 3 influence*; Noble: 1 seal*; Monk: 1 bead*. One reward per card']
    ])('mandate %i has three guild rewards at 3 status stars', (number, cell) => {
        expect(mandateRows[number - 1]?.['3-star rewards']).toBe(cell)
        const row = mandate(number)
        expect(row.kind).toBe('guild-status')
        if (row.kind === 'guild-status') {
            expect(row.guildRewards).toHaveLength(3)
            for (const { guild, reward, drawnFromSupply } of row.guildRewards) {
                const name = `${guild.charAt(0).toUpperCase()}${guild.slice(1)}`
                const article = reward.kind === 'vessel' ? 'a ' : ''
                expect(cell).toContain(`${name}: ${article}${rewardText(reward)}*`)
                expect(drawnFromSupply).toBe(true)
            }
        }
    })

    it('R-7 a guild reward takes 3 status stars', () => {
        expect(MandateStatusStars).toBe(3)
    })

    it('R-4.4-H4 mandate 6 gives the Alchemist a ship, not any vessel', () => {
        const row = mandate(6)
        const alchemist =
            row.kind === 'guild-status'
                ? row.guildRewards.find(({ guild }) => guild === 'alchemist')
                : undefined
        expect(alchemist?.reward).toEqual({ kind: 'vessel', vessel: 'ship' })
    })
})

describe('R-4.4.3, R-6.2 the charters of components.md', () => {
    it('8 ids in the order of components.md, with the printed text', () => {
        expect(Charters.map((row) => row.id)).toEqual(charterRows.map((row) => row['Id']))
        expect(Charters.map((row) => row.text)).toEqual(
            charterRows.map((row) => row['Printed text (verbatim)'])
        )
    })

    it('a kingdom charter prints 3/5/7/9 vp, the Isolated Kingdom 5/11/17', () => {
        const kingdoms = Charters.filter(isKingdom)
        expect(kingdoms).toHaveLength(6)
        for (const row of kingdoms) {
            const printed = charterRows.find(({ Id }) => Id === row.id)
            expect(row.vpByLocationsRuled.join('/'), row.id).toBe(
                printed?.['Values']?.split(' ')[0]
            )
            expect(row.vpByLocationsRuled, row.id).toEqual(
                row.kingdom === 'isolated' ? [5, 11, 17] : [3, 5, 7, 9]
            )
        }
    })

    it('a kingdom charter marks the spaces and number of dots of components.md', () => {
        for (const row of Charters.filter(isKingdom)) {
            const printed = charterRows.find(({ Id }) => Id === row.id)
            expect(row.spaces.length, row.id).toBe(Number(printed?.['Dots']))
            expect([...row.spaces], row.id).toEqual(
                spacesOfCell(printed?.['Qualifying spaces'] ?? '')
            )
            for (const space of row.spaces) {
                expect(boardSpaces, row.id).toContain(space)
            }
        }
    })

    it('Western, Central and Eastern together cover the 22 spaces once each', () => {
        const covered = [
            ...kingdom('writ.charter.western-kingdom').spaces,
            ...kingdom('writ.charter.central-kingdom').spaces,
            ...kingdom('writ.charter.eastern-kingdom').spaces
        ]
        expect(covered.toSorted()).toEqual(boardSpaces.toSorted())
    })

    it('the Isolated Kingdom marks sea-3, badlands-3 and badlands-5', () => {
        expect(kingdom('writ.charter.isolated-kingdom').spaces).toEqual([
            'space.sea.3',
            'space.badlands.3',
            'space.badlands.5'
        ])
    })

    it('the sulfur barrel: 2 sulfur 5 vp, 3 sulfur 7 vp, at most a full barrel (R-4.10.2)', () => {
        const row = charter('writ.charter.sulfur-barrel')
        expect(row.kind).toBe('sulfur-barrel')
        if (row.kind === 'sulfur-barrel') {
            expect(row.vpBySulfur).toEqual([
                { sulfur: 2, vp: 5 },
                { sulfur: 3, vp: 7 }
            ])
            expect(Math.max(...row.vpBySulfur.map(({ sulfur }) => sulfur))).toBe(WineBarrelCapacity)
        }
    })

    it('the monster defeat: 7 vp', () => {
        const row = charter('writ.charter.monster-defeat')
        expect(row.kind).toBe('monster-defeat')
        if (row.kind === 'monster-defeat') {
            expect(row.vp).toBe(7)
        }
    })
})

describe('R-4.4.3 the Northern Kingdom, data blocked', () => {
    it('reads its two unsure dots from the provisional registry', () => {
        const entry = ProvisionalCards.northernKingdomSpaces
        expect(entry.dataBlockedIn).toContain('writs.spec.ts')
        expect(kingdom(entry.componentId).spaces.slice(-2)).toEqual(entry.placeholder)
    })
})

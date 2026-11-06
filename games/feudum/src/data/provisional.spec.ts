import { beforeAll, describe, expect, it } from 'vitest'
import { docSection, docTableRows, readDoc } from '../testing/docs.js'
import { ProvisionalRegistry } from './provisional.js'
import { ProvisionalBoard } from './provisional.board.js'
import { ProvisionalCards } from './provisional.cards.js'
import { ProvisionalGuilds } from './provisional.guilds.js'

let components = ''
let rulings = ''
let deviationLines = new Map<string, string>()

beforeAll(async () => {
    components = await readDoc('components.md')
    rulings = await readDoc('rulings.md')
    // Each provisional value has one line: - **`<component id>` <what it is>:** ...
    deviationLines = new Map(
        docSection(await readDoc('known-deviations.md'), '## Not covered by specs')
            .filter((line) => line.startsWith('- '))
            .map((line) => {
                const id = /^- \*\*`([^`]+)`/.exec(line)
                return [id ? id[1] : line, line]
            })
    )
})

describe('the provisional registry', () => {
    it('lists each component id once, with its placeholder, what settles it and the spec it blocks', () => {
        const ids = ProvisionalRegistry.map((entry) => entry.componentId)
        expect(new Set(ids).size).toBe(ids.length)
        for (const entry of ProvisionalRegistry) {
            expect(entry.value, entry.componentId).not.toBe('')
            expect(entry.placeholder, entry.componentId).toBeDefined()
            expect(entry.settledBy, entry.componentId).not.toBe('')
            expect(entry.dataBlockedIn.length, entry.componentId).toBeGreaterThan(0)
        }
    })

    it('every entry has a line in known-deviations.md and every line an entry', () => {
        const registered = ProvisionalRegistry.map((entry) => entry.componentId)
        expect([...deviationLines.keys()].toSorted()).toEqual(registered.toSorted())
    })

    it('a line names the ruling that governs its entry, which rulings.md marks provisional', () => {
        for (const { componentId, ruling } of ProvisionalRegistry) {
            if (ruling !== undefined) {
                expect(deviationLines.get(componentId), componentId).toContain(
                    `Governs: ${ruling}.`
                )
                expect(rulings).toMatch(
                    new RegExp(`\\*\\*${ruling}\\*\\* \\([^)]*\\), _provisional_`)
                )
            }
        }
    })

    it('R-1.4-H2, R-1.4.3, R-4.4-H4: tile landscapes, disc copies and mandate 6 are settled, so they have no entry', () => {
        const ids = ProvisionalRegistry.map((entry) => entry.componentId)
        expect(
            ids.filter(
                (id) =>
                    id.startsWith('tile.') ||
                    id.startsWith('disc.double.') ||
                    id.startsWith('disc.feudum.') ||
                    id.startsWith('writ.mandate.')
            )
        ).toEqual([])
    })
})

describe('R-1.4-H3 the guild spaces printed nowhere', () => {
    it('the rosary is unlimited', () => {
        expect(ProvisionalGuilds.rosaryCapacity.ruling).toBe('R-1.4-H3')
        expect(ProvisionalGuilds.rosaryCapacity.placeholder).toBe('unlimited')
    })

    it('the Farmer has 4 chicken spaces, the setup bead on the first', () => {
        const chickens = ProvisionalGuilds.chickenSpaces
        expect(chickens.ruling).toBe('R-1.4-H3')
        expect(chickens.placeholder).toEqual({
            spaces: 4,
            setupBeadSpace: 'guild.farmer.chicken.1'
        })
    })
})

describe('R-4.6-H3 the charity split', () => {
    it("Farmer, Merchant and Alchemist pay the coffer; Knight, Noble and Monk the farmer's purse", () => {
        expect(ProvisionalGuilds.charity.ruling).toBe('R-4.6-H3')
        expect(ProvisionalGuilds.charity.placeholder).toEqual({
            farmer: 'guild.monk.coffer',
            merchant: 'guild.monk.coffer',
            alchemist: 'guild.monk.coffer',
            knight: 'guild.farmer.purse',
            noble: 'guild.farmer.purse',
            monk: 'guild.farmer.purse'
        })
    })
})

describe('R-1.2-H1 the routes of the community map aid', () => {
    it.each([
        ['road', ProvisionalBoard.roadRoutes, 13],
        ['ship', ProvisionalBoard.shipRoutes, 8],
        ['submersible', ProvisionalBoard.submersibleRoutes, 10],
        ['flying-machine', ProvisionalBoard.flyingMachineRoutes, 8]
    ])('%s routes match the Connections table', (medium, entry, count) => {
        expect(entry.ruling).toBe('R-1.2-H1')
        expect(entry.componentId).toBe(`route.${medium}.*`)
        expect(entry.placeholder).toHaveLength(count)
        expect(entry.placeholder).toEqual(
            docTableRows(components, '## Connections')
                .filter((row) => row['Medium'] === medium)
                .map((row) => row['Id'])
        )
    })

    it('the ferries are read from the board, so they have no entry (R-1.2.2)', () => {
        const ids = ProvisionalRegistry.map((entry) => entry.componentId)
        expect(ids).not.toContain('route.ferry.*')
    })
})

describe('the unread marks on cards', () => {
    it('R-3.5 the Repeat card carries no either/or mark', () => {
        expect(ProvisionalCards.repeatEitherOr.componentId).toBe('card.action.repeat')
        expect(ProvisionalCards.repeatEitherOr.placeholder).toBe(false)
    })

    it('R-4.4.3 the Northern Kingdom marks badlands-2 and mountain-1', () => {
        expect(ProvisionalCards.northernKingdomSpaces.componentId).toBe(
            'writ.charter.northern-kingdom'
        )
        expect(ProvisionalCards.northernKingdomSpaces.placeholder).toEqual([
            'space.badlands.2',
            'space.mountain.1'
        ])
    })
})

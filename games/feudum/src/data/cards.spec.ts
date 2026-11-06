import { beforeAll, describe, expect, it } from 'vitest'
import { docSection, docTableRows, readDoc } from '../testing/docs.js'
import { FeudumColors } from '../definition/colors.js'
import {
    ActionCardKinds,
    ActionCards,
    ActionCardsPerKind,
    ActionCardTotal,
    HarvestCardChart,
    type ActionCard,
    type SpecialNeed
} from './cards.js'
import { StartingSupply } from './components.js'
import { ProvisionalCards } from './provisional.cards.js'

let rows: Record<string, string>[] = []
let digestRows: Record<string, string>[] = []
let totals: Record<string, string>[] = []
let digest = ''
let components = ''

function capitalised(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1)
}

function needText(need: SpecialNeed): string {
    switch (need.kind) {
        case 'pawn-on-board':
            return `${capitalised(need.character)} pawn on the board`
        case 'pawn-at-location':
            return `${capitalised(need.character)} pawn at the location`
        case 'good':
            return need.good
        case 'barrel-sulfur':
            return 'sulfur from the wine barrel'
        case 'shillings':
            return `${need.shillings} shilling`
    }
}

function vpSymbol(card: ActionCard): string[] {
    if (card.vp === null) {
        return []
    }
    return [card.vp === 'variable' ? 'vp "?"' : `${card.vp.join('/')} vp`]
}

function replaySymbol(card: ActionCard): string[] {
    if (card.symbols.replay === null) {
        return []
    }
    return [card.symbols.replay === 'crossed-x2' ? 'crossed x2' : 'x2']
}

/** The symbols as `components.md` lists them, top to bottom. */
function symbolList(card: ActionCard): string[] {
    return [
        ...vpSymbol(card),
        ...replaySymbol(card),
        ...(card.symbols.icon === null ? [] : [`${card.symbols.icon} icon`]),
        ...(card.symbols.notLast ? ['not-last'] : []),
        ...(card.symbols.eitherOr ? ['either/or'] : [])
    ]
}

function kindsWhere(test: (card: ActionCard) => boolean): string[] {
    return ActionCards.filter(test).map((card) => card.kind)
}

function rowOf(card: ActionCard): Record<string, string> {
    const row = rows.find(({ Id }) => Id === card.id)
    if (row === undefined) {
        throw new Error(`No row for ${card.id}`)
    }
    return row
}

beforeAll(async () => {
    components = await readDoc('components.md')
    digest = await readDoc('rules-digest.md')
    rows = docTableRows(components, '## Action cards (11 kinds, 5 of each)')
    digestRows = docTableRows(digest, '### R-3.5 The eleven cards')
    totals = docTableRows(components, '## Totals')
})

describe('R-3.5 the rows of components.md', () => {
    it('11 kinds, in the digest order, with permanent ids', () => {
        expect(ActionCards.map((card) => card.id)).toEqual(rows.map((row) => row['Id']))
        expect(ActionCards.map((card) => card.kind)).toEqual(ActionCardKinds)
        expect(ActionCards.map((card) => card.printedName)).toEqual(
            digestRows.map((row) => row['Card'])
        )
        expect(new Set(ActionCards.map((card) => card.id)).size).toBe(11)
    })

    it('R-1.1 five of each kind, one per colour: 55, and 11 in each supply (R-1.4.1)', () => {
        expect(ActionCardsPerKind).toBe(FeudumColors.length)
        expect(ActionCardTotal).toBe(55)
        for (const card of ActionCards) {
            expect(card.count, card.id).toBe(5)
            expect(rowOf(card)['Count'], card.id).toBe('5')
        }
        expect(ActionCards).toHaveLength(StartingSupply.actionCards)
        expect(totals.find((row) => row['Kind'] === 'Action cards')?.['Rows above']).toBe('55')
    })

    it('the printed name, regular action, special ability and its effect', () => {
        for (const card of ActionCards) {
            const row = rowOf(card)
            expect(card.printedName, card.id).toBe(row['Printed name'])
            expect(card.regularAction, card.id).toBe(row['Regular action'])
            expect(card.special.name, card.id).toBe(row['Special ability'])
            expect(card.special.effect, card.id).toBe(row['Special effect'])
        }
    })

    it('R-3.4 the symbols', () => {
        for (const card of ActionCards) {
            const printed = rowOf(card)['Top-right symbols'] ?? ''
            const symbols =
                printed === 'none' ? [] : printed.replaceAll(/ \([^)]*\)/g, '').split(', ')
            expect(symbolList(card), card.id).toEqual(symbols)
        }
    })

    it('R-3.4 the need for each special ability', () => {
        for (const card of ActionCards) {
            expect(card.special.needs.map(needText).join('; '), card.id).toBe(
                rowOf(card)['Special needs']
            )
        }
    })

    it('R-3.4 the printed vp of the regular action and the special ability', () => {
        for (const card of ActionCards) {
            const [regular = '', special] = (rowOf(card)['Printed vp'] ?? '').split('; ')
            const base = regular.replace(/ \(.*\)$/, '')
            if (card.vp === null) {
                expect(base, card.id).toBe('none')
            } else {
                expect(base, card.id).toBe(card.vp === 'variable' ? '"?"' : card.vp.join('/'))
            }
            expect(card.special.vp, card.id).toBe(
                special === undefined ? null : Number(/\d+/.exec(special)?.[0])
            )
        }
    })

    it('R-3.4 the abilities the row marks in addition or instead', () => {
        for (const card of ActionCards) {
            const effect = rowOf(card)['Special effect'] ?? ''
            if (effect.startsWith('in addition')) {
                expect(card.special.mode, card.id).toBe('in-addition')
            } else if (effect.startsWith('instead')) {
                expect(card.special.mode, card.id).toBe('instead')
            } else {
                expect(card.kind).toBe('repeat')
            }
        }
    })
})

describe('R-3.4, R-3.5 the printed values the digest states', () => {
    it('the symbols of each card in the digest table', () => {
        for (const [index, card] of ActionCards.entries()) {
            const printed = digestRows[index]?.['Symbols'] ?? ''
            const symbols = symbolList(card)
                .filter((symbol) => !symbol.endsWith(' icon'))
                .map((symbol) => (symbol === 'vp "?"' ? 'vp' : symbol))
            expect(symbols, card.id).toEqual(printed === '—' ? [] : printed.split(', '))
        }
    })

    it('the name and each need of each ability in the digest table', () => {
        for (const [index, card] of ActionCards.entries()) {
            const printed = digestRows[index]?.['Special (needs)'] ?? ''
            expect(printed.startsWith(`${card.special.name} (`), card.id).toBe(true)
            const needs = /\((.*?)\)/.exec(printed)?.[1] ?? ''
            expect(card.special.needs.map(needText).join('; '), card.id).toBe(needs)
        }
    })

    it('the digest lists the four either/or cards the data marks', () => {
        expect(docSection(digest, '### R-3.4 Basic and advanced game').join(' ')).toContain(
            '(Improve, Conquer, Defend, Guild)'
        )
        expect(kindsWhere((card) => card.symbols.eitherOr)).toEqual([
            'improve',
            'conquer',
            'defend',
            'guild'
        ])
    })

    it('x2: Move, Influence, Guild; crossed x2: Conquer, Defend', () => {
        expect(kindsWhere((card) => card.symbols.replay === 'x2')).toEqual([
            'move',
            'influence',
            'guild'
        ])
        expect(kindsWhere((card) => card.symbols.replay === 'crossed-x2')).toEqual([
            'conquer',
            'defend'
        ])
    })

    it('R-3.13.1 only Conquer may not be the last card of the round', () => {
        expect(kindsWhere((card) => card.symbols.notLast)).toEqual(['conquer'])
    })

    it('R-3.14 only Defend is played out of turn', () => {
        expect(kindsWhere((card) => card.outOfTurn)).toEqual(['defend'])
    })

    it('R-3.4 either/or replaces the regular action; every other ability adds to it', () => {
        for (const card of ActionCards) {
            expect(card.special.mode, card.id).toBe(
                card.symbols.eitherOr ? 'instead' : 'in-addition'
            )
        }
    })
})

describe('R-3.11.2 the Harvest card chart', () => {
    it('total 5/6/7/8/9/10, partial 4/5/5/5/6/6, favors 1/1/2/3/3/4', () => {
        expect(HarvestCardChart.map(({ total }) => total).join('/')).toBe('5/6/7/8/9/10')
        expect(HarvestCardChart.map(({ partial }) => partial).join('/')).toBe('4/5/5/5/6/6')
        expect(HarvestCardChart.map(({ favors }) => favors).join('/')).toBe('1/1/2/3/3/4')
        expect(docSection(components, '## Action cards (11 kinds, 5 of each)').join(' ')).toContain(
            'total 5/6/7/8/9/10, partial 4/5/5/5/6/6, favors 1/1/2/3/3/4'
        )
    })
})

describe('R-3.15 Repeat, data blocked', () => {
    it('reads the either/or mark from the provisional registry', () => {
        const repeat = ActionCards.find((card) => card.kind === 'repeat')
        expect(repeat?.symbols.eitherOr).toBe(ProvisionalCards.repeatEitherOr.placeholder)
        expect(ProvisionalCards.repeatEitherOr.dataBlockedIn).toContain('cards.spec.ts')
        expect(rows.find(({ Id }) => Id === repeat?.id)?.['Either/or']).toMatch(/^unread/)
    })
})

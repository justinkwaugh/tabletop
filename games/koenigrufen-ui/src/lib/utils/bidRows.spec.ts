import { Bonus, Contract, type BidChoice } from '@tabletop/koenigrufen'
import { describe, expect, it } from 'vitest'
import { bidRows } from './bidRows.js'

const Opening: BidChoice[] = [
    { contract: Contract.Piccolo },
    { contract: Contract.Solorufer },
    { contract: Contract.Besserrufer, bird: Bonus.Pagat },
    { contract: Contract.Farbendreier },
    { contract: Contract.Besserrufer, bird: Bonus.Uhu },
    { contract: Contract.Farbensolo },
    { contract: Contract.Besserrufer, bird: Bonus.Kakadu },
    { contract: Contract.Besserrufer, bird: Bonus.Quapil },
    { contract: Contract.Solodreier }
]

// What the next bidder may offer over a Besserrufer Uhu.
const OverUhu: BidChoice[] = [
    { contract: Contract.Solodreier },
    { contract: Contract.Besserrufer, bird: Bonus.Quapil },
    { contract: Contract.BettelOuvert },
    { contract: Contract.Besserrufer, bird: Bonus.Kakadu },
    { contract: Contract.PiccoloOuvert }
]

describe('bid rows', () => {
    it('folds Besserrufer into one row at its cheapest bird, cheapest bids first', () => {
        const rows = bidRows(Opening)
        expect(rows.map((row) => [row.name, row.value])).toEqual([
            ['Piccolo', '2'],
            ['Solorufer', '2'],
            ['Besserrufer', '3–9'],
            ['Farbendreier', '3'],
            ['Farbensolo', '5'],
            ['Solodreier', '8']
        ])
        const besserrufer = rows[2]
        expect(besserrufer.choice).toEqual({ contract: Contract.Besserrufer, bird: Bonus.Pagat })
        expect(besserrufer.birds.map((bird) => [bird.name, bird.value, bird.open])).toEqual([
            ['Pagat', 3, true],
            ['Uhu', 5, true],
            ['Kakadu', 7, true],
            ['Quapil', 9, true]
        ])
        expect(besserrufer.birds[0].goal).toBe('Win the last trick with the Pagat (trump I).')
    })

    it('ranges over the open birds and keeps the others, closed', () => {
        const rows = bidRows(OverUhu)
        expect(rows.map((row) => [row.name, row.value])).toEqual([
            ['Piccolo Ouvert', '6'],
            ['Besserrufer', '7–9'],
            ['Bettel Ouvert', '7'],
            ['Solodreier', '8']
        ])
        expect(rows[1].birds.map((bird) => bird.open)).toEqual([false, false, true, true])
    })

    it('shows a single value when one bird is open', () => {
        const rows = bidRows([{ contract: Contract.Besserrufer, bird: Bonus.Quapil }])
        expect(rows.map((row) => row.value)).toEqual(['9'])
    })

    it('names the teams, goal and talon in words', () => {
        const rows = bidRows([
            { contract: Contract.Rufer },
            { contract: Contract.Trischaken },
            { contract: Contract.Zwiccolo },
            { contract: Contract.Sechserdreier }
        ])
        expect(
            rows.map((row) => [row.name, row.teams, row.goal, row.goalShort, row.talon])
        ).toEqual([
            ['Rufer', '2 v 2', '36+ card points', '36+ points', 'Take 3'],
            ['Trischaken', 'Each alone', 'Fewest card points', 'Fewest points', 'Last trick'],
            ['Zwiccolo', '1 v 3', 'Exactly 2 tricks', '2 tricks', 'Unused'],
            ['Sechserdreier', '1 v 3', '36+ card points', '36+ points', 'Take 6']
        ])
        expect(rows[3].value).toBe('4/−8')
    })

    it('tags the rule changes', () => {
        const tags = (contract: Contract) => bidRows([{ contract }])[0].tags.map((tag) => tag.text)
        expect(tags(Contract.Farbensolo)).toEqual(['Valat only', 'No trumps'])
        expect(tags(Contract.BettelOuvert)).toEqual(['No bonuses', 'Open hands'])
        expect(tags(Contract.Solodreier)).toEqual(['Bonuses ×2'])
        expect(tags(Contract.Sechserdreier)).toEqual(['Opening only'])
        expect(tags(Contract.Dreier)).toEqual([])
    })
})

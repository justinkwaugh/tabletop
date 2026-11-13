import { Bonus, Contract, Contracts } from '@tabletop/koenigrufen'
import { describe, expect, it } from 'vitest'
import {
    bidHeading,
    contractRequirement,
    contractSummary,
    contractValue,
    kingInTalonPrompt,
    meinSpielSummary
} from './contractText.js'

describe('contract text', () => {
    it('shows one value when win and loss match, and both when they differ', () => {
        expect(contractValue(Contracts[Contract.Rufer])).toBe('1')
        expect(contractValue(Contracts[Contract.Sechserdreier])).toBe('4/−8')
        expect(bidHeading({ contract: Contract.Sechserdreier })).toBe('Sechserdreier (4/−8)')
        expect(bidHeading({ contract: Contract.Besserrufer, bird: Bonus.Uhu })).toBe(
            'Besserrufer Uhu (5)'
        )
    })

    it('states what each kind of contract requires', () => {
        expect(contractRequirement(Contracts[Contract.Dreier])).toBe('36 of 70 card points')
        expect(contractRequirement(Contracts[Contract.Bettel])).toBe('no tricks')
        expect(contractRequirement(Contracts[Contract.Piccolo])).toBe('exactly 1 trick')
        expect(contractRequirement(Contracts[Contract.Zwiccolo])).toBe('exactly 2 tricks')
    })

    it('leads with teams and goal, then the talon', () => {
        expect(contractSummary({ contract: Contract.Rufer })).toBe(
            '2v2 - Goal: 36+ - Call for King partner - Forehand only. Take 3 talon cards; Kontra gets the other 3. If the called King is in the talon, declarer gives up (paying each player) or plays alone (no Kontra).'
        )
        expect(contractSummary({ contract: Contract.Sechserdreier })).toBe(
            '1v3 - Goal: 36+ - Forehand’s opening call only. Take all 6 talon cards unseen.'
        )
        expect(contractSummary({ contract: Contract.Solorufer })).toBe(
            '2v2 - Goal: 36+ - Bonuses doubled - Call for King partner. All 6 talon cards go to Kontra unseen. (If the called King is in the talon, declarer gets that half.)'
        )
        expect(contractSummary({ contract: Contract.Bettel })).toBe(
            '1v3 - Goal: no tricks. Declarer leads; the talon is unused. Beat the highest card if you can; Pagat only as your last trump. Play stops once declarer fails.'
        )
        expect(contractSummary({ contract: Contract.Trischaken })).toBe(
            'Each alone - Goal: fewest card points - Forehand only. Forehand leads. Beat the highest card if you can; Pagat only as your last trump. The last trick’s winner takes the talon. The 2 highest pay 1 each to the 2 lowest; 36+ pays 2 to each player; anyone without a trick is paid 2 by each.'
        )
        expect(contractSummary({ contract: Contract.Farbensolo })).toBe(
            '1v3 - Goal: 36+. All 6 talon cards go to Kontra unseen. Trumps don’t win, and are led or played only when you have no suit cards left. No bonuses except Valat and Four Kings. Declarer leads.'
        )
        expect(contractSummary({ contract: Contract.Farbendreier })).toBe(
            '1v3 - Goal: 36+. Take 3 talon cards; Kontra gets the other 3. Trumps don’t win, and are led or played only when you have no suit cards left. Lay away trumps first, except the Trull, face down; suit cards laid away are shown. No bonuses except Valat and Four Kings.'
        )
    })

    it('says which bird a Besserrufer bid announces and what it adds', () => {
        expect(contractSummary({ contract: Contract.Besserrufer, bird: Bonus.Kakadu })).toBe(
            '2v2 - Goal: 36+ - Call for King partner. Take 3 talon cards; Kontra gets the other 3. The Kakadu is announced with the bid (game 1 + bird 6): Win the third-last trick with trump III. If the called King is in the talon, declarer gives up (paying each player the game and the bird) or plays alone (no Kontra).'
        )
    })

    it('prices giving up with the called King in the talon, a Besserrufer bird included', () => {
        expect(kingInTalonPrompt({ contract: Contract.Rufer })).toBe(
            'The called King is in the talon. Give up and pay 1 to each player, or take a half and play alone against all three for 1 from each. Kontra is not allowed.'
        )
        expect(kingInTalonPrompt({ contract: Contract.Besserrufer, bird: Bonus.Uhu })).toBe(
            'The called King is in the talon. Give up and pay 5 to each player (game and Uhu), or take a half and play alone against all three for 1 from each, the Uhu still announced. Kontra is not allowed.'
        )
    })

    it('condenses Mein Spiel, naming the forehand-only contracts it can lead to', () => {
        expect(meinSpielSummary()).toBe(
            'Hold your bid for now. If all pass, name any contract, including Rufer or Trischaken.'
        )
    })
})

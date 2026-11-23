import {
    bidValue,
    BonusScope,
    Contract,
    contractDefinition,
    LayAwayRule,
    Goal,
    PackPoints,
    Partnership,
    PlayableContracts,
    PointsToWin,
    type BidChoice,
    type ContractDefinition
} from '@tabletop/koenigrufen'
import { bonusGoal, bonusName } from './announcementText.js'

// Rule citations are from Pagat, except the Solorufer talon, the called King in the talon,
// holding trumps back in colour games (Wikipedia) and the Trischaken talon (house rules, see the logic package's docs/rules-interpretations.md).
const KingInTalonNote =
    'If the called King is in the talon, declarer gives up (paying each player) or plays alone (no Kontra).'

const TrumpsFirstNote =
    'Lay away trumps first, except the Trull, face down; suit cards laid away are shown.'

// The rule for choosing cards to lay away.
export const LayAwayRuleText: Record<LayAwayRule, string> = {
    [LayAwayRule.SuitCardsFirst]:
        'Kings and the Trull may not be laid away; trumps only when you have no other choice.',
    [LayAwayRule.TrumpsFirstSuitCardsShown]:
        'Trumps go first, except the Trull; never Kings. Suit cards are shown.'
}

// House rules the game was created with that change what the table says about a contract.
export type TableRules = {
    // Trischaken: the first six tricks' winners each take a talon card instead of the last trick's
    // winner taking the whole talon.
    readonly talonByTrick: boolean
}

export const StandardRules: TableRules = { talonByTrick: false }

// Where the Trischaken talon goes, in the words of the contract note and of the bid table.
export function trischakenTalonNote(rules: TableRules): string {
    return rules.talonByTrick
        ? 'Winners of the first 6 tricks each reveal and take 1 talon card.'
        : 'The last trick’s winner takes the talon.'
}

export function trischakenTalonDetail(rules: TableRules): string {
    return rules.talonByTrick
        ? 'First 6 trick winners each reveal and take 1 talon card.'
        : 'Last trick takes the talon.'
}

const ContractNotes: Partial<Record<Contract, string>> = {
    [Contract.Rufer]: KingInTalonNote,
    [Contract.Solorufer]: '(If the called King is in the talon, declarer gets that half.)',
    [Contract.Besserrufer]:
        'If the called King is in the talon, declarer gives up (paying each player the game and the bird) or plays alone (no Kontra).',
    [Contract.Farbensolo]: 'Declarer leads.',
    [Contract.Trischaken]:
        'Forehand leads. Beat the highest card if you can; Pagat only as your last trump. {talon} The 2 highest pay 1 each to the 2 lowest; 36+ pays 2 to each player; anyone without a trick is paid 2 by each.'
}

const Teams: Record<Partnership, string> = {
    [Partnership.CallKing]: '2v2',
    [Partnership.Alone]: '1v3',
    [Partnership.Individual]: 'Each alone'
}

export function contractValue(definition: ContractDefinition): string {
    return definition.loss === definition.win
        ? String(definition.win)
        : `${definition.win}/−${definition.loss}`
}

function trickGoal(tricks: number): string {
    if (tricks === 0) {
        return 'no tricks'
    }
    return `exactly ${tricks} ${tricks === 1 ? 'trick' : 'tricks'}`
}

export function contractRequirement(definition: ContractDefinition): string {
    switch (definition.goal) {
        case Goal.TakePoints:
            return `${PointsToWin} of ${PackPoints} card points`
        case Goal.AvoidPoints:
            return 'fewest card points'
        case Goal.TakeTricks:
            return trickGoal(definition.tricksToTake ?? 0)
    }
}

function goal(definition: ContractDefinition): string {
    return definition.goal === Goal.TakePoints
        ? `Goal: ${PointsToWin}+`
        : `Goal: ${contractRequirement(definition)}`
}

function talonNote(definition: ContractDefinition): string | undefined {
    if (definition.talonCards === 3) {
        return 'Take 3 talon cards; the defenders get the other 3.'
    }
    if (definition.talonCards === 6) {
        return 'Take all 6 talon cards unseen.'
    }
    return definition.goal === Goal.TakePoints
        ? 'All 6 talon cards go to the defenders unseen.'
        : undefined
}

function present(parts: readonly (string | false | undefined)[]): string[] {
    return parts.filter((part) => typeof part === 'string')
}

// A bid's own name: Besserrufer carries the bird it named.
export function bidName(choice: BidChoice): string {
    const name = contractDefinition(choice.contract).name
    return choice.bird === undefined ? name : `${name} ${bonusName(choice.bird)}`
}

export function bidValueText(choice: BidChoice): string {
    return choice.bird === undefined
        ? contractValue(contractDefinition(choice.contract))
        : String(bidValue(choice))
}

export function bidKey(choice: BidChoice): string {
    return `${choice.contract}:${choice.bird ?? ''}`
}

export function bidHeading(choice: BidChoice): string {
    return `${bidName(choice)} (${bidValueText(choice)})`
}

function birdNote(choice: BidChoice): string | undefined {
    if (choice.bird === undefined) {
        return undefined
    }
    const game = contractDefinition(choice.contract).win
    return `The ${bonusName(choice.bird)} is announced with the bid (game ${game} + bird ${bidValue(choice) - game}): ${bonusGoal(choice.bird)}`
}

// A contract's terms: its defining traits, joined by dashes, then a sentence or two per detail.
export type ContractTerms = { readonly traits: string; readonly notes: readonly string[] }

export function contractTerms(choice: BidChoice, rules: TableRules = StandardRules): ContractTerms {
    const { contract } = choice
    const definition = contractDefinition(contract)
    const traits = present([
        Teams[definition.partnership],
        goal(definition),
        definition.bonusesDoubled && 'Bonuses doubled',
        definition.partnership === Partnership.CallKing && 'Call for King partner',
        definition.forehandOpening
            ? 'Forehand’s opening call only'
            : definition.forehandOnly && 'Forehand only'
    ])
    const notes = present([
        talonNote(definition),
        definition.goal === Goal.TakeTricks &&
            'Declarer leads; the talon is unused. Beat the highest card if you can; Pagat only as your last trump. Play stops once declarer fails.',
        !definition.trumpsWin &&
            'Trumps don’t win, and are led or played only when you have no suit cards left.',
        definition.ouvert && 'All hands laid open from the second trick.',
        definition.layAway === LayAwayRule.TrumpsFirstSuitCardsShown && TrumpsFirstNote,
        definition.bonuses === BonusScope.ValatAndFourKings &&
            'No bonuses except Valat and Four Kings.',
        birdNote(choice),
        ContractNotes[contract]?.replace('{talon}', trischakenTalonNote(rules))
    ])
    return { traits: `${traits.join(' - ')}.`, notes }
}

// The terms in one line, for the action panel.
export function contractSummary(choice: BidChoice, rules: TableRules = StandardRules): string {
    const { traits, notes } = contractTerms(choice, rules)
    return [traits, ...notes].join(' ')
}

// Declarer's choice when the called King lies in the talon. Giving up a Besserrufer also pays the
// bird named with the bid (house rule); played alone, that bird stays announced.
export function kingInTalonPrompt(choice: BidChoice): string {
    const game = contractDefinition(choice.contract).win
    if (choice.bird === undefined) {
        return `The called King is in the talon. Give up and pay ${game} to each player, or take a half and play alone against all three for ${game} from each. Kontra is not allowed.`
    }
    const bird = bonusName(choice.bird)
    return `The called King is in the talon. Give up and pay ${bidValue(choice)} to each player (game and ${bird}), or take a half and play alone against all three for ${game} from each, the ${bird} still announced. Kontra is not allowed.`
}

export function meinSpielSummary(): string {
    const forehandOnly = PlayableContracts.map(contractDefinition)
        .filter((definition) => definition.forehandOnly && !definition.forehandOpening)
        .map((definition) => definition.name)
    return `Hold your bid for now. If all pass, name any contract, including ${forehandOnly.join(' or ')}.`
}

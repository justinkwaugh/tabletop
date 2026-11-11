import {
    bidValue,
    Contract,
    contractDefinition,
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
// holding trumps back in colour games (Wikipedia) and the Trischaken talon (the user's rules).
const KingInTalonNote =
    'If the called King is in the talon, declarer gives up (paying each player) or plays alone (no Kontra).'

const ContractNotes: Partial<Record<Contract, string>> = {
    [Contract.Rufer]: KingInTalonNote,
    [Contract.Solorufer]: '(If the called King is in the talon, declarer gets that half.)',
    [Contract.Besserrufer]:
        'If the called King is in the talon, declarer gives up (paying each player the game and the bird) or plays alone (no Kontra).',
    [Contract.Farbensolo]: 'No bonuses except Valat.',
    [Contract.Trischaken]:
        'Forehand leads. Beat the highest card if you can; Pagat only as your last trump. The last trick’s winner takes the talon. The 2 highest pay 1 each to the 2 lowest; 36+ pays 2 to each player; anyone without a trick is paid 2 by each.'
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
        return 'Take 3 talon cards; Kontra gets the other 3.'
    }
    if (definition.talonCards === 6) {
        return 'Take all 6 talon cards unseen.'
    }
    return definition.goal === Goal.TakePoints
        ? 'All 6 talon cards go to Kontra unseen.'
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

// Defining traits first, joined by dashes, then the details.
export function contractSummary(choice: BidChoice): string {
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
        birdNote(choice),
        ContractNotes[contract]
    ])
    return [`${traits.join(' - ')}.`, ...notes].join(' ')
}

// Declarer's choice when the called King lies in the talon. Giving up a Besserrufer also pays the
// bird named with the bid (the user's ruling); played alone, that bird stays announced.
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

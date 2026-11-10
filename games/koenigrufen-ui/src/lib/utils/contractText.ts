import {
    Contract,
    contractDefinition,
    Goal,
    PackPoints,
    Partnership,
    PlayableContracts,
    PointsToWin,
    type ContractDefinition
} from '@tabletop/koenigrufen'

// Rule citations are from Pagat, except the Solorufer talon, the called King in the talon,
// holding trumps back in colour games (Wikipedia) and the Trischaken talon (the user's rules).
const KingInTalonNote =
    'If the called King is in the talon, declarer gives up (paying each player) or plays alone (no Kontra).'

const ContractNotes: Partial<Record<Contract, string>> = {
    [Contract.Rufer]: KingInTalonNote,
    [Contract.Solorufer]: '(If the called King is in the talon, declarer gets that half.)',
    [Contract.Besserrufer]: `Must announce Pagat, Uhu, Kakadu or Quapil. ${KingInTalonNote}`,
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

// Defining traits first, joined by dashes, then the details.
export function contractSummary(contract: Contract): string {
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
        ContractNotes[contract]
    ])
    return [`${traits.join(' - ')}.`, ...notes].join(' ')
}

export function contractHeading(contract: Contract): string {
    const definition = contractDefinition(contract)
    return `${definition.name} (${contractValue(definition)})`
}

export function meinSpielSummary(): string {
    const forehandOnly = PlayableContracts.map(contractDefinition)
        .filter((definition) => definition.forehandOnly && !definition.forehandOpening)
        .map((definition) => definition.name)
    return `Hold your bid for now. If all pass, name any contract, including ${forehandOnly.join(' or ')}.`
}

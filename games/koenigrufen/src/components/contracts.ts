import { assertExists } from '@tabletop/common'
import * as Type from 'typebox'

// Lowest to highest. Wikipedia's auction order (Austrian Final / Hausruckviertel rules), with
// Pagat's Zwiccolo and Farbendreier fitted in by value. Sechserdreier can only be overbid by a
// contract of higher value, so it ranks above the Dreier of equal value. Besserrufer ranks by the
// bird its bid names (see bidRank), not by its place here.
export enum Contract {
    Rufer = 'rufer',
    Trischaken = 'trischaken',
    Piccolo = 'piccolo',
    Zwiccolo = 'zwiccolo',
    Bettel = 'bettel',
    Solorufer = 'solo',
    Besserrufer = 'besserrufer',
    Farbendreier = 'farbendreier',
    Dreier = 'dreier',
    Sechserdreier = 'sechserdreier',
    Farbensolo = 'farbensolo',
    PiccoloOuvert = 'piccoloOuvert',
    BettelOuvert = 'bettelOuvert',
    Solodreier = 'solodreier'
}

export const ContractSchema = Type.Enum(Contract)

export const ContractOrder: readonly Contract[] = Object.values(Contract)

export enum Partnership {
    CallKing = 'callKing',
    Alone = 'alone',
    Individual = 'individual'
}

export enum Goal {
    TakePoints = 'takePoints',
    AvoidPoints = 'avoidPoints',
    TakeTricks = 'takeTricks'
}

// Which bonuses the contract scores, silent or announced: none in negative games (Pagat), and only
// Valat and Four Kings in the colour games (house rule, after Austrian variants).
export enum BonusScope {
    All = 'all',
    ValatAndFourKings = 'valatAndFourKings',
    None = 'none'
}

// How declarer lays away talon cards. Ordinarily suit cards go first and only trumps are shown; in
// Farbendreier (house rule) trumps other than the Trull go first and only suit cards are shown.
export enum LayAwayRule {
    SuitCardsFirst = 'suitCardsFirst',
    TrumpsFirstSuitCardsShown = 'trumpsFirstSuitCardsShown'
}

export type ContractDefinition = {
    readonly contract: Contract
    readonly name: string
    readonly partnership: Partnership
    readonly goal: Goal
    readonly talonCards: number
    readonly layAway: LayAwayRule
    readonly win: number
    readonly loss: number
    readonly trumpsWin: boolean
    readonly declarerLeads: boolean
    readonly forehandOnly: boolean
    // Forehand may announce it only as the opening call, instead of "Mein Spiel"; others may
    // overbid it.
    readonly forehandOpening: boolean
    readonly bonusesDoubled: boolean
    readonly bonuses: BonusScope
    // Besserrufer: the bid names a bird, announced for declarer's side.
    readonly namesBird: boolean
    readonly tricksToTake?: number
    readonly ouvert?: boolean
}

function contract(
    definition: Omit<
        ContractDefinition,
        | 'loss'
        | 'trumpsWin'
        | 'declarerLeads'
        | 'forehandOnly'
        | 'forehandOpening'
        | 'bonusesDoubled'
        | 'bonuses'
        | 'namesBird'
        | 'layAway'
    > &
        Partial<ContractDefinition>
): ContractDefinition {
    return {
        loss: definition.win,
        bonuses: definition.goal === Goal.TakePoints ? BonusScope.All : BonusScope.None,
        namesBird: false,
        layAway: LayAwayRule.SuitCardsFirst,
        trumpsWin: true,
        declarerLeads: false,
        forehandOnly: false,
        forehandOpening: false,
        bonusesDoubled: false,
        ...definition
    }
}

function negative(
    definition: Pick<ContractDefinition, 'contract' | 'name' | 'win'> & Partial<ContractDefinition>
): ContractDefinition {
    return contract({
        partnership: Partnership.Alone,
        goal: Goal.TakeTricks,
        talonCards: 0,
        declarerLeads: true,
        tricksToTake: 0,
        ...definition
    })
}

export const Contracts: Readonly<Record<Contract, ContractDefinition>> = {
    [Contract.Rufer]: contract({
        contract: Contract.Rufer,
        name: 'Rufer',
        partnership: Partnership.CallKing,
        goal: Goal.TakePoints,
        talonCards: 3,
        win: 1,
        forehandOnly: true
    }),
    [Contract.Trischaken]: contract({
        contract: Contract.Trischaken,
        name: 'Trischaken',
        partnership: Partnership.Individual,
        goal: Goal.AvoidPoints,
        talonCards: 0,
        win: 1,
        forehandOnly: true,
        // Forehand leads, as in the other negative games.
        declarerLeads: true
    }),
    [Contract.Sechserdreier]: contract({
        contract: Contract.Sechserdreier,
        name: 'Sechserdreier',
        partnership: Partnership.Alone,
        goal: Goal.TakePoints,
        talonCards: 6,
        win: 4,
        loss: 8,
        forehandOnly: true,
        forehandOpening: true
    }),
    [Contract.Piccolo]: negative({
        contract: Contract.Piccolo,
        name: 'Piccolo',
        win: 2,
        tricksToTake: 1
    }),
    [Contract.Zwiccolo]: negative({
        contract: Contract.Zwiccolo,
        name: 'Zwiccolo',
        win: 2,
        tricksToTake: 2
    }),
    [Contract.Solorufer]: contract({
        contract: Contract.Solorufer,
        name: 'Solorufer',
        partnership: Partnership.CallKing,
        goal: Goal.TakePoints,
        talonCards: 0,
        win: 2,
        // Pagat: "All bonuses score double ... if the contract is Solo or Solodreier."
        bonusesDoubled: true
    }),
    [Contract.Bettel]: negative({ contract: Contract.Bettel, name: 'Bettel', win: 2 }),
    [Contract.Besserrufer]: contract({
        contract: Contract.Besserrufer,
        name: 'Besserrufer',
        partnership: Partnership.CallKing,
        goal: Goal.TakePoints,
        talonCards: 3,
        win: 1,
        namesBird: true
    }),
    [Contract.Farbendreier]: contract({
        contract: Contract.Farbendreier,
        name: 'Farbendreier',
        partnership: Partnership.Alone,
        goal: Goal.TakePoints,
        talonCards: 3,
        layAway: LayAwayRule.TrumpsFirstSuitCardsShown,
        win: 3,
        trumpsWin: false,
        bonuses: BonusScope.ValatAndFourKings
    }),
    [Contract.Dreier]: contract({
        contract: Contract.Dreier,
        name: 'Dreier',
        partnership: Partnership.Alone,
        goal: Goal.TakePoints,
        talonCards: 3,
        win: 4
    }),
    [Contract.PiccoloOuvert]: negative({
        contract: Contract.PiccoloOuvert,
        name: 'Piccolo Ouvert',
        win: 6,
        tricksToTake: 1,
        ouvert: true
    }),
    [Contract.BettelOuvert]: negative({
        contract: Contract.BettelOuvert,
        name: 'Bettel Ouvert',
        win: 7,
        ouvert: true
    }),
    [Contract.Farbensolo]: contract({
        contract: Contract.Farbensolo,
        name: 'Farbensolo',
        partnership: Partnership.Alone,
        goal: Goal.TakePoints,
        talonCards: 0,
        win: 5,
        trumpsWin: false,
        declarerLeads: true,
        bonuses: BonusScope.ValatAndFourKings
    }),
    [Contract.Solodreier]: contract({
        contract: Contract.Solodreier,
        name: 'Solodreier',
        partnership: Partnership.Alone,
        goal: Goal.TakePoints,
        talonCards: 0,
        win: 8,
        bonusesDoubled: true
    })
}

// The contracts the auction offers.
export const PlayableContracts: readonly Contract[] = [
    Contract.Rufer,
    Contract.Trischaken,
    Contract.Piccolo,
    Contract.Zwiccolo,
    Contract.Bettel,
    Contract.Solorufer,
    Contract.Besserrufer,
    Contract.Farbendreier,
    Contract.Dreier,
    Contract.Sechserdreier,
    Contract.Farbensolo,
    Contract.PiccoloOuvert,
    Contract.BettelOuvert,
    Contract.Solodreier
]

export function contractDefinition(contract: Contract): ContractDefinition {
    const definition = Contracts[contract]
    assertExists(definition, `No contract ${contract}`)
    return definition
}

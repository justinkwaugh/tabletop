import {
    BonusOrder,
    BonusScope,
    bidRank,
    bidValue,
    Contract,
    contractDefinition,
    Goal,
    isBird,
    Partnership,
    PlayableContracts,
    PointsToWin,
    type BidChoice
} from '@tabletop/koenigrufen'
import { bonusGoal, bonusName } from './announcementText.js'
import { bidKey, bidValueText } from './contractText.js'

// The bid menu's table: one row per contract open to the player, cheapest first. Besserrufer is a
// single row whose birds are the actual bids.

export type Tone = 'gold' | 'muted' | 'warn'
export type Tag = { text: string; tone: Tone }

export type BirdOption = {
    key: string
    choice: BidChoice
    name: string
    value: number
    goal: string
    open: boolean
}

export type BidRow = {
    key: string
    // The bid a click makes; for Besserrufer, its cheapest open bird.
    choice: BidChoice
    name: string
    value: string
    teams: string
    goal: string
    goalShort: string
    talon: string
    tags: Tag[]
    details: string
    // Besserrufer only: every bird, those not open to the player marked closed.
    birds: BirdOption[]
}

const Details: Record<Contract, string> = {
    [Contract.Rufer]:
        'Call a King; its holder is your secret partner. If the King lies in the talon, give up or play alone.',
    [Contract.Trischaken]:
        'Forehand leads; must beat, Pagat only as last trump. Last trick takes the talon. The two highest pay 1 to the two lowest; 36+ pays 2 to each; no trick is paid 2 by each.',
    [Contract.Piccolo]:
        'You lead; must beat, Pagat only as last trump. Ends as soon as you take a second trick.',
    [Contract.Zwiccolo]:
        'You lead; must beat, Pagat only as last trump. Ends as soon as you take a third trick.',
    [Contract.Bettel]:
        'You lead; must beat, Pagat only as last trump. Ends as soon as you take a trick.',
    [Contract.Solorufer]:
        'Call a King without the talon; it goes to the defenders unseen. If the King lies there, you take that half.',
    [Contract.Besserrufer]:
        'Call a King and name a bird with the bid. The bird is announced for your side and its value adds to the game.',
    [Contract.Farbendreier]:
        'Trumps don’t win: play one only when out of suit cards, and never lead one by choice.',
    [Contract.Dreier]: 'Take 3 talon cards and play alone.',
    [Contract.Sechserdreier]:
        'Forehand’s opening call, instead of Mein Spiel. Take the whole talon unseen; lose double.',
    [Contract.Farbensolo]:
        'Trumps don’t win, as in Farbendreier. The talon goes to the defenders unseen.',
    [Contract.PiccoloOuvert]: 'Piccolo with every hand laid open from the second trick.',
    [Contract.BettelOuvert]: 'Bettel with every hand laid open from the second trick.',
    [Contract.Solodreier]: 'The talon goes to the defenders unseen. Bonuses count double.'
}

const Teams: Record<Partnership, string> = {
    [Partnership.CallKing]: '2 v 2',
    [Partnership.Alone]: '1 v 3',
    [Partnership.Individual]: 'Each alone'
}

function goal(contract: Contract): [long: string, short: string] {
    const definition = contractDefinition(contract)
    switch (definition.goal) {
        case Goal.TakePoints:
            return [`${PointsToWin}+ card points`, `${PointsToWin}+ points`]
        case Goal.AvoidPoints:
            return ['Fewest card points', 'Fewest points']
        case Goal.TakeTricks: {
            const tricks = definition.tricksToTake ?? 0
            if (tricks === 0) {
                return ['No tricks', 'No tricks']
            }
            const count = `${tricks} ${tricks === 1 ? 'trick' : 'tricks'}`
            return [`Exactly ${count}`, count]
        }
    }
}

function talon(contract: Contract): string {
    const definition = contractDefinition(contract)
    if (definition.talonCards > 0) {
        return `Take ${definition.talonCards}`
    }
    switch (definition.goal) {
        case Goal.TakePoints:
            return 'To defenders'
        case Goal.AvoidPoints:
            return 'Last trick'
        case Goal.TakeTricks:
            return 'Unused'
    }
}

function tags(contract: Contract): Tag[] {
    const definition = contractDefinition(contract)
    const result: Tag[] = []
    if (definition.namesBird) {
        result.push({ text: 'Names a bird', tone: 'gold' })
    }
    if (definition.forehandOpening) {
        result.push({ text: 'Opening only', tone: 'muted' })
    } else if (definition.forehandOnly) {
        result.push({ text: 'Forehand only', tone: 'muted' })
    }
    if (definition.bonusesDoubled) {
        result.push({ text: 'Bonuses ×2', tone: 'gold' })
    }
    if (definition.bonuses === BonusScope.None) {
        result.push({ text: 'No bonuses', tone: 'warn' })
    }
    if (definition.bonuses === BonusScope.ValatOnly) {
        result.push({ text: 'Valat only', tone: 'warn' })
    }
    if (!definition.trumpsWin) {
        result.push({ text: 'No trumps', tone: 'warn' })
    }
    if (definition.ouvert) {
        result.push({ text: 'Open hands', tone: 'muted' })
    }
    return result
}

// Every bid there is, in rank order; Besserrufer once per bird.
const AllChoices: BidChoice[] = PlayableContracts.flatMap((contract) =>
    contractDefinition(contract).namesBird
        ? BonusOrder.filter(isBird).map((bird) => ({ contract, bird }))
        : [{ contract }]
).toSorted((a, b) => bidRank(a) - bidRank(b))

function row(choice: BidChoice, value: string, birds: BirdOption[]): BidRow {
    const { contract } = choice
    const [goalLong, goalShort] = goal(contract)
    return {
        key: contractDefinition(contract).namesBird ? contract : bidKey(choice),
        choice,
        name: contractDefinition(contract).name,
        value,
        teams: Teams[contractDefinition(contract).partnership],
        goal: goalLong,
        goalShort,
        talon: talon(contract),
        tags: tags(contract),
        details: Details[contract],
        birds
    }
}

function birdOptions(contract: Contract, keys: readonly string[]): BirdOption[] {
    return AllChoices.flatMap((choice) => {
        if (choice.contract !== contract || choice.bird === undefined) {
            return []
        }
        const key = bidKey(choice)
        return [
            {
                key,
                choice,
                name: bonusName(choice.bird),
                value: bidValue(choice),
                goal: bonusGoal(choice.bird),
                open: keys.includes(key)
            }
        ]
    })
}

function valueRange(birds: BirdOption[]): string {
    const low = birds[0].value
    const high = birds[birds.length - 1].value
    return low === high ? String(low) : `${low}–${high}`
}

// The rows for the bids open to the player. A contract that names a bird sits where its cheapest
// open bird ranks, its value the range of its open birds.
export function bidRows(choices: readonly BidChoice[]): BidRow[] {
    const keys = choices.map(bidKey)
    const placed = new Set<Contract>()
    return AllChoices.flatMap((choice): BidRow[] => {
        if (!keys.includes(bidKey(choice))) {
            return []
        }
        if (choice.bird === undefined) {
            return [row(choice, bidValueText(choice), [])]
        }
        if (placed.has(choice.contract)) {
            return []
        }
        placed.add(choice.contract)
        const birds = birdOptions(choice.contract, keys)
        return [row(choice, valueRange(birds.filter((bird) => bird.open)), birds)]
    })
}

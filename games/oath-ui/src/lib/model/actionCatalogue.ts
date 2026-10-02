import { ActionType } from '@tabletop/oath'

/** R-5, R-6 — the actions the Act Phase grid offers. */
export type GridAction =
    | ActionType.Search
    | ActionType.Muster
    | ActionType.Trade
    | ActionType.Recover
    | ActionType.Campaign
    | ActionType.Travel
    | ActionType.PlayFacedownAdviser
    | ActionType.UseActionPower
    | ActionType.Peek
    | ActionType.LetPeek
    | ActionType.MoveWarbands
    | ActionType.OfferCitizenship
    | ActionType.ExileCitizen
    | ActionType.SelfExile

// R-5.1.1 prices Search off the Visions Drawn track, so it shows a range.
export interface ActionEntry {
    type: GridAction
    label: string
    cost: string
    rule: string
    summary: string
}

// R-5 — the six major actions, in player-board order.
export const MAJOR_ACTIONS: readonly ActionEntry[] = [
    {
        type: ActionType.Search,
        label: 'Search',
        cost: '2–4 Supply',
        rule: 'R-5.1',
        summary: 'Draw 3 cards from the world deck or your discard, play 1, discard the rest.'
    },
    {
        type: ActionType.Muster,
        label: 'Muster',
        cost: '1 Supply',
        rule: 'R-5.2',
        summary: 'Place a favor on an empty card at your site and gain 2 warbands.'
    },
    {
        type: ActionType.Trade,
        label: 'Trade',
        cost: '1 Supply',
        rule: 'R-5.3',
        summary: 'Place a secret or favor on an empty card at your site and gain favor or secrets.'
    },
    {
        type: ActionType.Recover,
        label: 'Recover',
        cost: '1 Supply',
        rule: 'R-5.4',
        summary: 'Take a relic at your site, the People’s Favor, or the Darkest Secret.'
    },
    {
        type: ActionType.Campaign,
        label: 'Campaign',
        cost: '2 Supply',
        rule: 'R-5.5',
        summary: 'Attack an enemy at your site for their sites, banners and relics.'
    },
    {
        type: ActionType.Travel,
        label: 'Travel',
        cost: '1–4 Supply',
        rule: 'R-5.6',
        summary: 'Move your pawn to any site, flipping it faceup if it is facedown.'
    }
]

// R-6 — the minor actions, which cost no Supply.
export const MINOR_ACTIONS: readonly ActionEntry[] = [
    {
        type: ActionType.PlayFacedownAdviser,
        label: 'Play or discard an adviser',
        cost: 'free',
        rule: 'R-6.1',
        summary: 'Play a facedown adviser faceup — to your site or your advisers — or discard it.'
    },
    {
        type: ActionType.UseActionPower,
        label: 'Use an Action power',
        cost: 'free',
        rule: 'R-6.2',
        summary: 'Use the "Action:" power of a card you have access to, paying its cost.'
    },
    {
        type: ActionType.Peek,
        label: 'Peek at a relic',
        cost: 'free',
        rule: 'R-6.3',
        summary: 'Look at a facedown relic at your site.'
    },
    {
        type: ActionType.LetPeek,
        label: 'Let another peek',
        cost: 'free',
        rule: 'R-6.1, R-6.6.1, R-9.4',
        summary:
            'Show a facedown adviser to another player, or, holding the Grand Scepter, a Reliquary relic to an Exile.'
    },
    {
        type: ActionType.MoveWarbands,
        label: 'Move warbands',
        cost: 'free',
        rule: 'R-6.5',
        summary: 'Move warbands between your board and your site, if you rule it.'
    },
    {
        type: ActionType.OfferCitizenship,
        label: 'Offer Citizenship',
        cost: 'free',
        rule: 'R-6.6.1',
        summary:
            'Offer an Exile Citizenship, promising exactly one relic from the Reliquary. They answer; you cannot decide for them.'
    },
    {
        type: ActionType.ExileCitizen,
        label: 'Exile a Citizen',
        cost: 'free',
        rule: 'R-6.7',
        summary: 'Return a Citizen to their Exile board.'
    },
    {
        type: ActionType.SelfExile,
        label: 'Exile yourself',
        cost: 'free',
        rule: 'R-6.8',
        summary: 'Leave the Empire, paying secrets on cards, and end your Act Phase.'
    }
]

export const ALL_ACTIONS: readonly ActionEntry[] = [...MAJOR_ACTIONS, ...MINOR_ACTIONS]

/** Sent on the tap: nothing to pick first. */
export const UNTARGETED_ACTIONS: ReadonlySet<ActionType> = new Set([
    ActionType.EndActPhase,
    ActionType.SelfExile
])

/** R-7.4 — the major actions a modifier can be declared on. */
export const MODIFIABLE_ACTIONS: ReadonlySet<ActionType> = new Set([
    ActionType.Recover,
    ActionType.Travel,
    ActionType.Muster,
    ActionType.Trade,
    ActionType.Search
])

/** R-6.1, R-6.3, R-6.5, R-6.6.1, R-6.7 — one choice from a list the engine computes. */
export const MINOR_TARGETED_ACTIONS: ReadonlySet<ActionType> = new Set([
    ActionType.PlayFacedownAdviser,
    ActionType.Peek,
    ActionType.LetPeek,
    ActionType.MoveWarbands,
    ActionType.ExileCitizen
])

export type PromptState = { cardChosen: boolean; adviserChosen: boolean }

export function actionPrompt(action: ActionType, state: PromptState): string {
    switch (action) {
        case ActionType.Travel:
            return 'Choose a destination.'
        case ActionType.Muster:
            return 'Choose a card at your site to place favor on.'
        case ActionType.Trade:
            return 'Choose a trade.'
        case ActionType.Recover:
            return 'Choose a relic or a banner.'
        case ActionType.Search:
            return 'Choose where to draw from.'
        case ActionType.PlayFacedownAdviser:
            return state.adviserChosen
                ? 'Choose where it goes.'
                : 'Choose one of your facedown advisers.'
        case ActionType.Peek:
            return 'Choose a relic to look at.'
        case ActionType.LetPeek:
            return 'Choose what to show, and to whom.'
        case ActionType.UseActionPower:
            return 'Choose a power to use.'
        case ActionType.MoveWarbands:
            return 'Choose a move and how many.'
        case ActionType.ExileCitizen:
            return 'Choose a Citizen to exile.'
        default:
            return 'Choose a target.'
    }
}

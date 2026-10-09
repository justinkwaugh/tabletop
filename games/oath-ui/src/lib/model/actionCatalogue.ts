import { assertExists } from '@tabletop/common'
import { ActionType } from '@tabletop/oath'

/** R-5 — the major actions. */
export type MajorAction =
    | ActionType.Search
    | ActionType.Muster
    | ActionType.Trade
    | ActionType.Recover
    | ActionType.Campaign
    | ActionType.Travel

/** R-5, R-6 — the actions the Act Phase grid offers. */
export type GridAction =
    | MajorAction
    | ActionType.PlayFacedownAdviser
    | ActionType.UseActionPower
    | ActionType.Peek
    | ActionType.LetPeek
    | ActionType.MoveWarbands
    | ActionType.OfferCitizenship
    | ActionType.ExileCitizen
    | ActionType.SelfExile

export interface ActionEntry {
    type: GridAction
    label: string
    rule: string
    summary: string
}

// R-5.1.1 prices Search off the Visions Drawn track, so it shows a range.
export interface MajorEntry extends ActionEntry {
    type: MajorAction
    cost: string
}

// R-5 — the six major actions, in player-board order.
export const MAJOR_ACTIONS: readonly MajorEntry[] = [
    {
        type: ActionType.Search,
        label: 'Search',
        cost: '2–4 Supply',
        rule: 'R-5.1',
        summary: 'Draw 3, play 1.'
    },
    {
        type: ActionType.Muster,
        label: 'Muster',
        cost: '1 Supply',
        rule: 'R-5.2',
        summary: 'Put favor on a card here; get 2 warbands.'
    },
    {
        type: ActionType.Trade,
        label: 'Trade',
        cost: '1 Supply',
        rule: 'R-5.3',
        summary: 'Secret for favor, or favor for secret.'
    },
    {
        type: ActionType.Recover,
        label: 'Recover',
        cost: '1 Supply',
        rule: 'R-5.4',
        summary: 'Take a relic here, or a banner.'
    },
    {
        type: ActionType.Campaign,
        label: 'Campaign',
        cost: '2 Supply',
        rule: 'R-5.5',
        summary: 'Attack someone here.'
    },
    {
        type: ActionType.Travel,
        label: 'Travel',
        cost: '1–4 Supply',
        rule: 'R-5.6',
        summary: 'Move your pawn.'
    }
]

// R-6 — the minor actions, which cost no Supply.
export const MINOR_ACTIONS: readonly ActionEntry[] = [
    {
        type: ActionType.PlayFacedownAdviser,
        label: 'Adviser',
        rule: 'R-6.1',
        summary: 'Play or discard a facedown adviser.'
    },
    {
        type: ActionType.UseActionPower,
        label: 'Use a power',
        rule: 'R-6.2, R-7.4',
        summary: 'Use a card’s Action power.'
    },
    {
        type: ActionType.Peek,
        label: 'Peek',
        rule: 'R-6.3',
        summary: 'Look at a facedown relic here.'
    },
    {
        type: ActionType.LetPeek,
        label: 'Show',
        rule: 'R-6.1, R-6.6.1, R-9.4',
        summary: 'Show a facedown card to someone.'
    },
    {
        type: ActionType.MoveWarbands,
        label: 'Move warbands',
        rule: 'R-6.5',
        summary: 'Between your board and a site you rule.'
    },
    {
        type: ActionType.OfferCitizenship,
        label: 'Offer Citizenship',
        rule: 'R-6.6.1',
        summary: 'Offer an Exile Citizenship.'
    },
    {
        type: ActionType.ExileCitizen,
        label: 'Exile Citizen',
        rule: 'R-6.7',
        summary: 'Return a Citizen to their Exile board.'
    },
    {
        type: ActionType.SelfExile,
        label: 'Exile yourself',
        rule: 'R-6.8',
        summary: 'Leave the Empire; ends your Act Phase.'
    }
]

export const ALL_ACTIONS: readonly ActionEntry[] = [...MAJOR_ACTIONS, ...MINOR_ACTIONS]

/** Sent on the tap: nothing to pick first. R-6.8's self-exile is staged, so its price shows first. */
export const UNTARGETED_ACTIONS: ReadonlySet<ActionType> = new Set([ActionType.EndActPhase])

/** R-7.4 — the major actions a modifier can be declared on. */
export const MODIFIABLE_ACTIONS: ReadonlySet<ActionType> = new Set([
    ActionType.Recover,
    ActionType.Travel,
    ActionType.Muster,
    ActionType.Trade,
    ActionType.Search
])

/** R-6.1, R-6.3, R-6.5, R-6.7, R-6.8 — one choice from a list the engine computes. */
export const MINOR_TARGETED_ACTIONS: ReadonlySet<ActionType> = new Set([
    ActionType.PlayFacedownAdviser,
    ActionType.Peek,
    ActionType.LetPeek,
    ActionType.MoveWarbands,
    ActionType.ExileCitizen,
    ActionType.SelfExile
])

/** Travel on a phone, where the lit map is the menu. */
export const TRAVEL_ON_THE_MAP_PROMPT = 'Tap a lit site.'

/** The staged action's bar reads the action's name, the word on its tile. */
export function actionName(action: ActionType): string {
    const entry = ALL_ACTIONS.find((candidate) => candidate.type === action)
    assertExists(entry, `${action} is not an Act Phase grid action`)
    return entry.label
}

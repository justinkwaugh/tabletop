import type { LocalSelection } from '@tabletop/frontend-components'

/** The 1860 table's one-step choices, each made before the Action it leads to. */
export interface StagedChoices1860 {
    bidAmount?: number
    chosenLot?: string
}

function stagedChoice(isMade: () => boolean, clear: () => void): LocalSelection {
    return {
        hasManual: isMade,
        undo() {
            if (!isMade()) return false
            clear()
            return true
        },
        clear
    }
}

/** The choices as staged selections, in the order Undo backs them out. */
export function stagedChoices(choices: StagedChoices1860): LocalSelection[] {
    return [
        stagedChoice(
            () => choices.chosenLot !== undefined,
            () => (choices.chosenLot = undefined)
        ),
        stagedChoice(
            () => choices.bidAmount !== undefined,
            () => (choices.bidAmount = undefined)
        )
    ]
}

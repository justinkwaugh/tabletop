import type { LocalSelection } from '@tabletop/frontend-components'

/** The 1862 table's one-step choices, each made before the Action it leads to. */
export interface StagedChoices1862 {
    selectedCharterCompany?: string
    charterBid: number
    raiseAmount?: number
    charterPar?: number
    mergerPartner?: string
    smallStationLocation?: string
    smallStationLine?: string
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

/**
 * The choices as staged selections, in the order Undo backs them out: a small station's line
 * before the hex it stands in, and a charter's bid with the company it is for.
 */
export function stagedChoices(choices: StagedChoices1862): LocalSelection[] {
    return [
        stagedChoice(
            () => choices.selectedCharterCompany !== undefined,
            () => {
                choices.selectedCharterCompany = undefined
                choices.charterBid = 0
            }
        ),
        stagedChoice(
            () => choices.raiseAmount !== undefined,
            () => (choices.raiseAmount = undefined)
        ),
        stagedChoice(
            () => choices.charterPar !== undefined,
            () => (choices.charterPar = undefined)
        ),
        stagedChoice(
            () => choices.mergerPartner !== undefined,
            () => (choices.mergerPartner = undefined)
        ),
        stagedChoice(
            () => choices.smallStationLine !== undefined,
            () => (choices.smallStationLine = undefined)
        ),
        stagedChoice(
            () => choices.smallStationLocation !== undefined,
            () => {
                choices.smallStationLocation = undefined
                choices.smallStationLine = undefined
            }
        )
    ]
}

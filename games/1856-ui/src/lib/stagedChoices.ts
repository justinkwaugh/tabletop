import { NationalTrainLimit, isPermanentTrain } from '@tabletop/1856'

/** The ids chosen so far with one added, or taken out if it was already chosen. */
export function toggled(chosen: readonly string[], id: string): string[] {
    return chosen.includes(id) ? chosen.filter((entry) => entry !== id) : [...chosen, id]
}

/**
 * The trains the CGR keeps before its president changes anything: its permanent trains, up to
 * three, which the rules make it keep (CGR Trains).
 */
export function defaultKeptTrains(
    trains: readonly { id: string; definitionId: string }[]
): string[] {
    return trains
        .filter((train) => isPermanentTrain(train.definitionId))
        .slice(0, NationalTrainLimit)
        .map((train) => train.id)
}

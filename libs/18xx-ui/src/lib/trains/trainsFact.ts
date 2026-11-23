import { isObsoleteTrain, type Train } from '@tabletop/18xx'
import type { TitleFact } from '../session/titlePresentation.js'

/** A company's trains, drawn as badges, or a dash where it has none. */
export function trainsFact(trains: readonly Train[]): TitleFact {
    return {
        label: 'Trains',
        value: trains.map((train) => train.definitionId).join(', ') || '—',
        trains: trains.map((train) => ({
            definitionId: train.definitionId,
            obsolete: isObsoleteTrain(train)
        }))
    }
}

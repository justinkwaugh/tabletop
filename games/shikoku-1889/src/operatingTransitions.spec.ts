import { operatingTransitionTests } from '../../../libs/18xx/test/operatingTransitions.js'
import { Definition } from './definition.js'
import { Shikoku1889TrackRules } from './trackRules.js'
import { Shikoku1889TransferRules } from './transferRules.js'
import { Shikoku1889TrainRules } from './trains.js'

operatingTransitionTests(
    Definition,
    Shikoku1889TrackRules,
    Shikoku1889TransferRules,
    Shikoku1889TrainRules
)

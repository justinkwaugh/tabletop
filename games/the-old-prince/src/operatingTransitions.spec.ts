import { operatingTransitionTests } from '../../../libs/18xx/test/operatingTransitions.js'
import { Definition } from './definition.js'
import { TheOldPrinceTrackRules } from './trackRules.js'
import { TheOldPrinceTransferRules } from './transferRules.js'
import { TheOldPrinceTrainRules } from './trains.js'

operatingTransitionTests(
    Definition,
    TheOldPrinceTrackRules,
    TheOldPrinceTransferRules,
    TheOldPrinceTrainRules
)

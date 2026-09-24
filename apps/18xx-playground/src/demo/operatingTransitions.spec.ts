import { describe } from 'vitest'
import {
    TheOldPrinceTrackRules,
    TheOldPrinceTransferRules,
    TheOldPrinceTrainRules
} from '@tabletop/the-old-prince'
import {
    Shikoku1889TrackRules,
    Shikoku1889TransferRules,
    Shikoku1889TrainRules
} from '@tabletop/shikoku-1889'
import { ShikokuScenarios, TopScenarios } from '../scenarios/definitions.js'
import { operatingTransitionTests } from './operatingTransitions.js'

describe('The Old Prince', () =>
    operatingTransitionTests(
        TopScenarios,
        TheOldPrinceTrackRules,
        TheOldPrinceTransferRules,
        TheOldPrinceTrainRules
    ))
describe('Shikoku 1889', () =>
    operatingTransitionTests(
        ShikokuScenarios,
        Shikoku1889TrackRules,
        Shikoku1889TransferRules,
        Shikoku1889TrainRules
    ))

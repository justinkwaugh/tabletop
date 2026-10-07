import { startingPositionTests } from '../../../libs/18xx/test/startingPositions.js'
import { Definition } from './definition/gameDefinition.js'
import { EighteenThirtyTwoScenarios } from './scenarios/index.js'

startingPositionTests(Definition, EighteenThirtyTwoScenarios, [2, 3, 4, 5, 6, 7])

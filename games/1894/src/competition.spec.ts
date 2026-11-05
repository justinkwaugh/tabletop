import { startingPositionTests } from '../../../libs/18xx/test/startingPositions.js'
import { Definition } from './definition/gameDefinition.js'
import { EighteenNinetyFourScenarios } from './scenarios/index.js'

startingPositionTests(Definition, EighteenNinetyFourScenarios, [3, 4])

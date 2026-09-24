import { startingPositionTests } from '../../../libs/18xx/test/startingPositions.js'
import { Definition } from './definition/gameDefinition.js'
import { TheOldPrinceScenarios } from './scenarios/index.js'

startingPositionTests(Definition, TheOldPrinceScenarios, [3, 4])

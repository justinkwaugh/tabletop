import { startingPositionTests } from '../../../libs/18xx/test/startingPositions.js'
import { Definition } from './definition/gameDefinition.js'
import { Shikoku1889Scenarios } from './scenarios/index.js'

startingPositionTests(Definition, Shikoku1889Scenarios, [2, 3, 4, 5, 6])

import { seatingTests } from '../../../libs/18xx/test/startingPositions.js'
import { Definition } from './definition/gameDefinition.js'

seatingTests(Definition, [3, 4, 5], { setupConfigs: [{}, { beginnerPrivates: true }] })

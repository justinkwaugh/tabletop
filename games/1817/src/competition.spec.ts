import { startingPositionTests } from '../../../libs/18xx/test/startingPositions.js'
import { Definition } from './definition/gameDefinition.js'
import { EighteenSeventeenScenarios } from './scenarios/index.js'
import { passUntil } from '../test/passTurns.js'

startingPositionTests(Definition, EighteenSeventeenScenarios, [3, 4, 5, 6], {
    finishEnding: (play) => passUntil(play, (state) => state.machineState === 'GameOver')
})

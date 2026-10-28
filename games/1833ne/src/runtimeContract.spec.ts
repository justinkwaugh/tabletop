import { runtimeContractTests } from '../../../libs/18xx/test/runtimeContract.js'
import { Definition } from './definition/gameDefinition.js'

runtimeContractTests(Definition, '../test/fixtures/runtime-contract.json')

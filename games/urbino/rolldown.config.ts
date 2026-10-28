import { createGameLogicRolldownConfig } from '@tabletop/rolldown-config'

export default createGameLogicRolldownConfig({
    packageRootUrl: new URL('.', import.meta.url)
})

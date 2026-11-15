import { createGameUiRolldownConfig } from '@tabletop/rolldown-config'

export default createGameUiRolldownConfig({
    packageRootUrl: new URL('.', import.meta.url)
})

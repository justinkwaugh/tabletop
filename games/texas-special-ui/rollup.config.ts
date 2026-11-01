import { createGameUiRollupConfig } from '@tabletop/rollup-config'

export default createGameUiRollupConfig({
    packageRootUrl: new URL('.', import.meta.url)
})

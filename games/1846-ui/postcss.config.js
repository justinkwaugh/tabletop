import { createGameUiPostcssConfig } from '@tabletop/rolldown-config/postcss'

export default createGameUiPostcssConfig({
    packageRootUrl: new URL('.', import.meta.url),
    family18xx: true,
    additionalStylesheets: ['/src/lib/panels.css']
})

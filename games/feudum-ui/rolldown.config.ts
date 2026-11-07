import { viteImportGlobPlugin } from 'rolldown/experimental'
import { createGameUiRolldownConfig } from '@tabletop/rolldown-config'

const config = createGameUiRolldownConfig({
    packageRootUrl: new URL('.', import.meta.url)
})

// The shared config leaves import.meta.glob as written, which throws when the bundle loads. The
// asset map finds its files that way, under Vite and here alike.
export default {
    ...config,
    plugins: [
        ...config.plugins.slice(0, 4),
        viteImportGlobPlugin({ root: new URL('.', import.meta.url).pathname }),
        ...config.plugins.slice(4)
    ]
}

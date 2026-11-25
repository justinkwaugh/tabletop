import { defineConfig } from '@inlang/paraglide-js'

export default defineConfig({
    outdir: './src/lib/paraglide',
    strategy: ['custom-account', 'custom-device', 'preferredLanguage', 'baseLocale'],
    outputStructure: 'message-modules',
    emitTsDeclarations: true
})

import { defineConfig } from '@inlang/paraglide-js'

export default defineConfig({
    outdir: './esm/paraglide',
    strategy: ['baseLocale'],
    outputStructure: 'message-modules',
    emitTsDeclarations: true,
    // A .gitignore in the output would leave these files out of the packed and deployed package.
    emitGitIgnore: false,
})

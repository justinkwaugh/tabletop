import tailwindcss from '@tailwindcss/postcss'

const scopePrefix = '[data-game-ui="shikoku-1889"]'

const scopeGameCssPlugin = {
    postcssPlugin: 'scope-game-css-plugin',
    Rule(rule) {
        const sourceFile = (rule.source?.input?.file ?? '').replace(/\\/g, '/')
        // The 18xx family library's plain stylesheets are injected by every title that ships
        // the library, so each title scopes them to itself as it does its own styles.
        if (
            !sourceFile.endsWith('/src/lib/styles.css') &&
            !(
                /\/18xx-ui\/(?:dist|src\/lib)\/.+\.css$/.test(sourceFile) &&
                !sourceFile.includes('.svelte')
            )
        ) {
            return
        }

        if (
            rule.parent?.type === 'atrule' &&
            ['keyframes', '-webkit-keyframes', '-moz-keyframes'].includes(rule.parent.name)
        ) {
            return
        }

        if (!rule.selectors) {
            return
        }

        rule.selectors = rule.selectors.map((selector) => {
            if (!selector) {
                return selector
            }

            const trimmed = selector.trim()
            if (!trimmed) {
                return trimmed
            }

            if (trimmed.startsWith(scopePrefix)) {
                return trimmed
            }

            if (trimmed === ':root' || trimmed.startsWith('html') || trimmed.startsWith('body')) {
                return scopePrefix
            }

            return `${scopePrefix} ${trimmed}`
        })
    }
}

export default {
    plugins: [tailwindcss(), scopeGameCssPlugin]
}

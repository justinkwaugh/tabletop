import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

const URL_REFERENCE = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^'")]+))\s*\)/g
const RESOLVES_WITHOUT_THE_STYLESHEET = /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i

const publishedFileName = (file, contents) => {
    const { name, ext } = path.parse(file)
    const hash = createHash('sha1').update(contents).digest('hex').slice(0, 16)
    return `${name}-${hash}${ext}`
}

// Imported CSS is injected into the page as a style element, where a relative url() would
// resolve against the page address instead of the stylesheet it was written in.
export const publishCssAssets = ({ destDir, publicPath }) => ({
    postcssPlugin: 'publish-css-assets',
    Declaration(declaration) {
        const rewritten = declaration.value.replace(
            URL_REFERENCE,
            (match, doubleQuoted, singleQuoted, bare) => {
                const reference = doubleQuoted ?? singleQuoted ?? bare
                if (RESOLVES_WITHOUT_THE_STYLESHEET.test(reference)) return match

                const stylesheet = declaration.source?.input.file
                if (!stylesheet) {
                    throw new Error(`Cannot publish ${match}: its stylesheet is not a file`)
                }
                const [relativePath, suffix = ''] = reference.split(/(?=[?#])/, 2)
                const file = path.resolve(path.dirname(stylesheet), relativePath)
                const contents = fs.readFileSync(file)
                const fileName = publishedFileName(file, contents)
                fs.mkdirSync(destDir, { recursive: true })
                fs.writeFileSync(path.join(destDir, fileName), contents)
                return `url(${publicPath}${fileName}${suffix})`
            }
        )
        if (rewritten !== declaration.value) declaration.value = rewritten
    }
})

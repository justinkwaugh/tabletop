#!/usr/bin/env node

// Formats the files staged for commit with prettier. Run by .githooks/pre-commit.
//
// A fully staged file is formatted in the working tree and re-staged. A file with unstaged
// changes has only its staged copy formatted, so the unstaged hunks stay out of the commit.
// Never blocks a commit: a missing install or a file prettier can't parse is a warning.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDirectory, '../..')
const ignorePath = path.join(repoRoot, '.prettierignore')

function git(args, input) {
    return execFileSync('git', args, { cwd: repoRoot, input, encoding: 'utf8' })
}

function warn(message) {
    console.warn(`format-staged: ${message}`)
}

function nulSeparated(output) {
    return output.split('\0').filter(Boolean)
}

async function loadPrettier() {
    try {
        return await import('prettier')
    } catch {
        warn('prettier is not installed (run pnpm install); committing unformatted')
        return undefined
    }
}

async function formatStaged(prettier) {
    const staged = nulSeparated(
        git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'])
    )
    const unstaged = new Set(nulSeparated(git(['diff', '--name-only', '-z'])))

    for (const file of staged) {
        const [mode] = git(['ls-files', '-s', '-z', '--', file]).split(' ')
        if (mode === '120000') continue

        const filepath = path.join(repoRoot, file)
        const info = await prettier.getFileInfo(filepath, { ignorePath, resolveConfig: true })
        if (info.ignored || !info.inferredParser) continue

        const partial = unstaged.has(file)
        const source = partial ? git(['show', `:${file}`]) : fs.readFileSync(filepath, 'utf8')
        const options = await prettier.resolveConfig(filepath)

        let formatted
        try {
            formatted = await prettier.format(source, { ...options, filepath })
        } catch (error) {
            warn(`could not format ${file}: ${error.message.split('\n')[0]}`)
            continue
        }
        if (formatted === source) continue

        if (partial) {
            const blob = git(['hash-object', '-w', '--stdin', '--path', file], formatted).trim()
            git(['update-index', '--cacheinfo', `${mode},${blob},${file}`])
            warn(`formatted the staged copy of ${file}; its unstaged changes are unformatted`)
        } else {
            fs.writeFileSync(filepath, formatted)
            git(['add', '--', file])
        }
    }
}

const prettier = await loadPrettier()
if (prettier) {
    try {
        await formatStaged(prettier)
    } catch (error) {
        warn(`skipped formatting: ${error.message}`)
    }
}

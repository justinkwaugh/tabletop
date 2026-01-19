import fs from 'node:fs/promises'
import path from 'node:path'

const findRepoRoot = async (startPath) => {
    let current = startPath
    while (true) {
        try {
            await fs.access(path.join(current, 'turbo.json'))
            return current
        } catch {
            const parent = path.dirname(current)
            if (parent === current) return startPath
            current = parent
        }
    }
}

const packageRoot = process.cwd()
const packageJsonPath = path.join(packageRoot, 'package.json')
const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'))
const packageName = packageJson.name ?? ''
const packageVersion = packageJson.version ?? '0.0.0'
const packageBase = packageName.replace(/^@[^/]+\//, '')
const packageId = packageBase.endsWith('-ui') ? packageBase.slice(0, -3) : packageBase

if (!packageName) {
    throw new Error('Missing package.json name')
}

const repoRoot = await findRepoRoot(packageRoot)
const staticRoot = process.env.STATIC_ROOT ?? path.join(repoRoot, '.local-static')
const sourceDir = path.join(packageRoot, 'bundle')
const targetDir = path.join(staticRoot, 'games', packageId, 'ui', packageVersion)

try {
    await fs.access(sourceDir)
} catch {
    throw new Error(`Bundle output not found at ${sourceDir}. Run bundle first.`)
}

await fs.rm(targetDir, { recursive: true, force: true })
await fs.mkdir(targetDir, { recursive: true })
await fs.cp(sourceDir, targetDir, { recursive: true })

console.log(`Staged ${packageName}@${packageVersion} -> ${targetDir}`)

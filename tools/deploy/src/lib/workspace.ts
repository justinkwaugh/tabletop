import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

type WorkspacePackage = { name: string; path: string }

type PackageManifest = { dependencies?: Record<string, string> }

const isWorkspacePackage = (value: unknown): value is WorkspacePackage =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { name?: unknown }).name === 'string' &&
    typeof (value as { path?: unknown }).path === 'string'

const listWorkspacePackages = async (repoRoot: string): Promise<Map<string, string>> => {
    const { stdout } = await execFileAsync('pnpm', ['list', '-r', '--depth', '-1', '--json'], {
        cwd: repoRoot,
        maxBuffer: 16 * 1024 * 1024
    })
    const parsed: unknown = JSON.parse(stdout)
    if (!Array.isArray(parsed)) {
        throw new Error('pnpm list did not return a package array')
    }
    const packages = new Map<string, string>()
    for (const entry of parsed) {
        if (isWorkspacePackage(entry)) {
            packages.set(entry.name, entry.path)
        }
    }
    return packages
}

const readDependencies = async (packageDir: string): Promise<string[]> => {
    const raw = await fs.readFile(path.join(packageDir, 'package.json'), 'utf8')
    const manifest: PackageManifest = JSON.parse(raw)
    return Object.entries(manifest.dependencies ?? {})
        .filter(([, spec]) => spec.startsWith('workspace:'))
        .map(([name]) => name)
}

export const workspaceSourceDirs = async (
    repoRoot: string,
    packageName: string,
    options: { exclude: readonly string[] }
): Promise<string[]> => {
    const packages = await listWorkspacePackages(repoRoot)
    const rootDir = packages.get(packageName)
    if (!rootDir) {
        throw new Error(`Workspace package ${packageName} not found`)
    }
    const visited = new Set<string>()
    const queue = [packageName]
    while (queue.length > 0) {
        const name = queue.shift() as string
        if (visited.has(name) || options.exclude.includes(name)) continue
        visited.add(name)
        const dir = packages.get(name)
        if (!dir) {
            throw new Error(`Workspace dependency ${name} of ${packageName} not found`)
        }
        queue.push(...(await readDependencies(dir)))
    }
    return [...visited].map((name) => path.relative(repoRoot, packages.get(name) as string)).sort()
}

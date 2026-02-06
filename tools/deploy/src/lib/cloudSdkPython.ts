import { spawnSync } from 'node:child_process'

type PythonVersion = {
    major: number
    minor: number
}

const minimumPythonVersion: PythonVersion = { major: 3, minor: 10 }
const candidatePythonCommands = ['python3.12', 'python3.11', 'python3.10', 'python3']
const pythonVersionPattern = /Python\s+(\d+)\.(\d+)/

let cachedCloudSdkPython: string | null | undefined

const parsePythonVersion = (raw: string): PythonVersion | null => {
    const match = pythonVersionPattern.exec(raw)
    if (!match) return null
    return {
        major: Number(match[1]),
        minor: Number(match[2])
    }
}

const isSupportedVersion = (version: PythonVersion): boolean => {
    if (version.major > minimumPythonVersion.major) return true
    if (version.major < minimumPythonVersion.major) return false
    return version.minor >= minimumPythonVersion.minor
}

const resolveCommandPath = (command: string): string | null => {
    const result = spawnSync('which', [command], { encoding: 'utf8' })
    if (result.status !== 0) return null
    const resolved = result.stdout.trim()
    return resolved.length > 0 ? resolved : null
}

const getPythonVersion = (pythonPath: string): PythonVersion | null => {
    const result = spawnSync(pythonPath, ['--version'], { encoding: 'utf8' })
    if (result.status !== 0) return null
    return parsePythonVersion(`${result.stdout}\n${result.stderr}`)
}

const resolveCloudSdkPython = (): string | null => {
    if (cachedCloudSdkPython !== undefined) return cachedCloudSdkPython

    const configured = process.env.CLOUDSDK_PYTHON?.trim()
    if (configured) {
        cachedCloudSdkPython = configured
        return configured
    }

    for (const command of candidatePythonCommands) {
        const resolved = resolveCommandPath(command)
        if (!resolved) continue
        const version = getPythonVersion(resolved)
        if (version && isSupportedVersion(version)) {
            cachedCloudSdkPython = resolved
            return resolved
        }
    }

    cachedCloudSdkPython = null
    return null
}

export const ensureCloudSdkPython = (): string | undefined => {
    const configured = process.env.CLOUDSDK_PYTHON?.trim()
    if (configured) return configured

    const resolved = resolveCloudSdkPython()
    if (!resolved) return undefined

    process.env.CLOUDSDK_PYTHON = resolved
    return resolved
}

export const withCloudSdkPythonEnv = (baseEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
    const configured = baseEnv.CLOUDSDK_PYTHON?.trim()
    const resolved = configured && configured.length > 0 ? configured : ensureCloudSdkPython()
    if (!resolved) return baseEnv
    return { ...baseEnv, CLOUDSDK_PYTHON: resolved }
}

export const isCloudSdkCommand = (command: string): boolean => {
    const name = command.split(/[\\/]/).pop() ?? command
    return name === 'gcloud' || name === 'gsutil'
}

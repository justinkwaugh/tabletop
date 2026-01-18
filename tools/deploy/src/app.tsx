import React, { useEffect, useMemo, useState } from 'react'
import { Box, Text, useApp, useInput, useStdout } from 'ink'
import { readManifest, writeManifest } from './lib/manifest.js'
import { fetchBackendManifest } from './lib/backend.js'
import { checkFrontendDeployed, checkGameDeployed, GcsStatus } from './lib/gcs.js'
import { mergeEnvConfig, readDeployConfig } from './lib/config.js'
import {
    buildBackendCommand,
    buildBackendImageCommand,
    buildFrontendCommand,
    buildGameUiCommand,
    buildGameUiPackageCommand,
    pushBackendImageCommand,
    deployBackendCommand,
    deployFrontendCommand,
    deployGameUiCommand,
    tagBackendImageCommand,
    rollbackBackendCommand,
    runCommand
} from './lib/commands.js'
import type { CommandSpec } from './lib/commands.js'
import { getDeployConfigPath, getGcsRoot, getManifestPath, getRepoRoot } from './lib/paths.js'
import { BackendManifest, DeployConfig, SiteManifest } from './lib/types.js'
import {
    bumpVersion,
    getFrontendPackagePath,
    getGamePackagePaths,
    type BumpType,
    readPackageVersion,
    syncManifestFromPackages,
    writePackageVersion
} from './lib/versions.js'

type Mode =
    | 'view'
    | 'bump-frontend'
    | 'bump-logic'
    | 'bump-ui'
    | 'rollback'
    | 'confirm-overwrite'
    | 'confirm-deploy'

type SelectionType = 'frontend' | 'backend' | 'game'

type Selection = {
    key: string
    type: SelectionType
    label: string
    gameId?: string
}

type PendingDeploy = {
    spec: CommandSpec
    specWithTraffic?: CommandSpec
    targetLabel: string
    taskIndex?: number
    version?: string
    remoteVersion?: string
    upload?: string
    type: SelectionType
    gameId?: string
}

type PendingOverwrite = {
    targetLabel: string
    version: string
    remoteVersion: string
    onConfirm: () => void
}

type TaskStatus = 'pending' | 'running' | 'success' | 'failed'

type TaskState = {
    title: string
    tasks: { label: string; status: TaskStatus }[]
}

type StatusTone = 'info' | 'error'

const repoRoot = getRepoRoot()
const manifestPath = getManifestPath(repoRoot)
const deployConfigPath = getDeployConfigPath(repoRoot)
const gcsRoot = getGcsRoot()

const formatStatus = (message: string, tone: StatusTone = 'info') => ({ message, tone })
const formatIndicator = (value: boolean | null | undefined, isChecking: boolean) => {
    if (isChecking) return '…'
    if (value == null) return '?'
    return value ? '✓' : '✗'
}

export default function App() {
    const { exit } = useApp()
    const [manifest, setManifest] = useState<SiteManifest | null>(null)
    const [backendManifest, setBackendManifest] = useState<BackendManifest | null>(null)
    const [backendError, setBackendError] = useState<string | null>(null)
    const [deployConfig, setDeployConfig] = useState<DeployConfig>({})
    const [gcsStatus, setGcsStatus] = useState<GcsStatus>({
        frontendExists: null,
        games: {}
    })
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [mode, setMode] = useState<Mode>('view')
    const [inputValue, setInputValue] = useState('')
    const [isBusy, setIsBusy] = useState(false)
    const [status, setStatus] = useState(() => formatStatus('Loading manifest...'))
    const [outputBuffer, setOutputBuffer] = useState('')
    const [outputScroll, setOutputScroll] = useState(0)
    const [outputHold, setOutputHold] = useState(false)
    const [runningLabel, setRunningLabel] = useState<string | null>(null)
    const [runningLogPath, setRunningLogPath] = useState<string | null>(null)
    const [pendingDeploy, setPendingDeploy] = useState<PendingDeploy | null>(null)
    const [pendingOverwrite, setPendingOverwrite] = useState<PendingOverwrite | null>(null)
    const [checkingBackend, setCheckingBackend] = useState(false)
    const [checkingGcsTarget, setCheckingGcsTarget] = useState<string | null>(null)
    const [taskState, setTaskState] = useState<TaskState | null>(null)
    const { stdout } = useStdout()

    const games = useMemo(() => {
        if (!manifest) return []
        return Object.entries(manifest.games).map(([id, entry]) => ({ id, ...entry }))
    }, [manifest])

    const gameById = useMemo(() => new Map(games.map((game) => [game.id, game])), [games])
    const selections = useMemo<Selection[]>(
        () => [
            { key: 'frontend', type: 'frontend', label: 'Frontend' },
            { key: 'backend', type: 'backend', label: 'Backend' },
            ...games.map((game) => ({
                key: `game:${game.id}`,
                type: 'game' as const,
                label: game.id,
                gameId: game.id
            }))
        ],
        [games]
    )

    useEffect(() => {
        if (selectedIndex >= selections.length) {
            setSelectedIndex(Math.max(0, selections.length - 1))
        }
    }, [selectedIndex, selections.length])

    const selected = selections[selectedIndex]
    const selectedGame =
        selected?.type === 'game' && selected.gameId ? gameById.get(selected.gameId) : undefined
    const selectedServing = selectedGame ? backendManifest?.games?.[selectedGame.id] : undefined
    const selectedServingMismatch =
        selectedGame && selectedServing
            ? selectedServing.logicVersion !== selectedGame.logicVersion ||
              selectedServing.uiVersion !== selectedGame.uiVersion
            : false
    const selectedDeployed = selectedGame ? gcsStatus.games[selectedGame.id] : null
    const selectedDeployedChecking = selectedGame
        ? checkingGcsTarget === `game:${selectedGame.id}`
        : false
    const selectedDeployedColor =
        !selectedDeployedChecking && selectedDeployed === false ? 'red' : 'gray'
    const frontendDeployedChecking = checkingGcsTarget === 'frontend'
    const frontendDeployedColor =
        !frontendDeployedChecking && gcsStatus.frontendExists === false ? 'red' : 'gray'
    const frontendServing = backendManifest?.frontend?.version
    const frontendServingMismatch =
        frontendServing != null && manifest?.frontend.version !== frontendServing
    const outputActive = isBusy || outputHold
    const confirmDeployActive = mode === 'confirm-deploy' && pendingDeploy
    const taskActive = taskState !== null && !confirmDeployActive
    const modalActive = outputActive || confirmDeployActive || taskState !== null
    const commandHint = useMemo(() => {
        if (mode === 'confirm-overwrite' && pendingOverwrite) {
            return 'y/Enter overwrite  n/Esc cancel'
        }
        if (mode === 'confirm-deploy' && pendingDeploy) {
            const commands =
                pendingDeploy.type === 'backend'
                    ? ['y traffic', 'n/Enter no-traffic', 'Esc cancel']
                    : ['y/Enter deploy', 'n/Esc cancel']
            return commands.join('  ')
        }
        if (outputActive || taskActive) {
            const commands = ['↑/↓ scroll', 'PgUp/PgDn page', 'Home/End top/bottom']
            if (outputHold) {
                commands.push('Enter close')
            }
            commands.push('q quit')
            return commands.join('  ')
        }
        if (mode === 'bump-frontend' || mode === 'bump-logic' || mode === 'bump-ui') {
            return '1/major  2/minor  3/patch  Esc cancel'
        }
        if (mode === 'rollback') {
            return 'Enter confirm  Esc cancel'
        }
        const commands = ['↑/↓ select', 'r reload', 'd deploy']
        if (selected?.type === 'frontend') {
            commands.push('f bump-frontend')
        }
        if (selected?.type === 'backend') {
            commands.push('k rollback')
        }
        if (selected?.type === 'game') {
            commands.push('l bump-logic', 'u bump-ui')
        }
        commands.push('s use-serving')
        commands.push('q quit')
        return commands.join('  ')
    }, [mode, outputActive, outputHold, pendingDeploy, pendingOverwrite, selected?.type, taskActive])

    const terminalCols = stdout?.columns ?? 80
    const terminalRows = stdout?.rows ?? 24
    const modalPaddingX = 1
    const modalPaddingY = 1
    const modalWidth = Math.min(100, Math.max(20, terminalCols - 4), terminalCols)
    const modalHeight = Math.min(
        Math.max(6, Math.floor(terminalRows * 0.7)),
        Math.max(4, terminalRows - 2)
    )
    const tasksPaneWidth = taskState
        ? Math.min(30, Math.max(18, Math.floor(modalWidth * 0.3)))
        : 0
    const modalInnerLines = Math.max(1, modalHeight - 2 - modalPaddingY * 2)
    const outputHeaderLines = 1 + (runningLogPath ? 1 : 0) + (outputHold ? 1 : 0)
    const outputContentLines = Math.max(1, modalInnerLines - outputHeaderLines)
    const confirmHeaderLines = 1
    const confirmContentLines = Math.max(1, modalInnerLines - confirmHeaderLines)
    const trimmedOutput = outputBuffer.replace(/\n+$/g, '')
    const outputHasContent = trimmedOutput.length > 0
    const outputLines = useMemo(
        () => (outputHasContent ? trimmedOutput.split('\n') : ['Waiting for output...']),
        [trimmedOutput, outputHasContent]
    )
    const maxOutputScroll = Math.max(0, outputLines.length - outputContentLines)
    const clampedOutputScroll = Math.min(outputScroll, maxOutputScroll)
    const outputModeLabel = outputHold
        ? 'failed'
        : clampedOutputScroll === 0
          ? 'follow'
          : 'scroll'
    const formatRunningLabel = (label?: string | null) => {
        if (!label) return 'task'
        const afterColon = label.includes(':') ? label.split(':').slice(1).join(':') : label
        return afterColon.replace(/^(build|bundle|deploy|tag|push)-/, '')
    }
    const displayRunningLabel = formatRunningLabel(runningLabel)
    const outputStart = Math.max(0, outputLines.length - outputContentLines - clampedOutputScroll)
    const visibleOutputLines = outputLines.slice(outputStart, outputStart + outputContentLines)
    const paddedOutputLines = visibleOutputLines.concat(
        Array(Math.max(0, outputContentLines - visibleOutputLines.length)).fill('')
    )
    const visibleOutput = paddedOutputLines.join('\n')

    const startTasks = (title: string, labels: string[]) => {
        setTaskState({
            title,
            tasks: labels.map((label) => ({ label, status: 'pending' as TaskStatus }))
        })
    }

    const updateTaskStatus = (index: number, status: TaskStatus) => {
        setTaskState((current) => {
            if (!current) return current
            return {
                ...current,
                tasks: current.tasks.map((task, taskIndex) =>
                    taskIndex === index ? { ...task, status } : task
                )
            }
        })
    }

    const appendOutput = (chunk: string) => {
        const normalized = chunk.replace(/\r/g, '\n')
        const newLines = normalized.split('\n').length - 1
        const maxChars = 8000
        setOutputBuffer((current) => {
            const next = current + normalized
            return next.length > maxChars ? next.slice(next.length - maxChars) : next
        })
        if (newLines > 0) {
            setOutputScroll((current) => (current === 0 ? 0 : current + newLines))
        }
    }

    const commandString = (spec: CommandSpec) => [spec.command, ...spec.args].join(' ')
    const describeUpload = (spec: CommandSpec) => {
        if (spec.command !== 'gcloud') return undefined
        if (spec.args[0] !== 'storage' || spec.args[1] !== 'rsync') return undefined
        if (spec.args.length < 2) return undefined
        const source = spec.args[spec.args.length - 2]
        const destination = spec.args[spec.args.length - 1]
        return `${source} -> ${destination}`
    }
    const resolveBackendImage = () => {
        const configured = deployConfig.backend?.image
        if (configured) return configured
        const deployCommand = deployConfig.backend?.deployCommand
        if (!deployCommand) return undefined
        const imageArg = deployCommand.find((arg) => arg.startsWith('--image='))
        if (imageArg) {
            return imageArg.slice('--image='.length)
        }
        const imageIndex = deployCommand.indexOf('--image')
        if (imageIndex >= 0) {
            return deployCommand[imageIndex + 1]
        }
        return undefined
    }

    const refreshFrontendDeployed = async () => {
        if (!manifest) return
        setCheckingGcsTarget('frontend')
        setGcsStatus((current) => ({ ...current, frontendExists: null }))
        try {
            const exists = await checkFrontendDeployed(manifest, deployConfig, gcsRoot)
            setGcsStatus((current) => ({ ...current, frontendExists: exists }))
        } finally {
            setCheckingGcsTarget((current) => (current === 'frontend' ? null : current))
        }
    }

    const refreshGameDeployed = async (gameId: string) => {
        if (!manifest) return
        const targetKey = `game:${gameId}`
        setCheckingGcsTarget(targetKey)
        setGcsStatus((current) => ({
            ...current,
            games: { ...current.games, [gameId]: null }
        }))
        try {
            const exists = await checkGameDeployed(manifest, gameId, deployConfig, gcsRoot)
            setGcsStatus((current) => ({
                ...current,
                games: { ...current.games, [gameId]: exists }
            }))
        } finally {
            setCheckingGcsTarget((current) => (current === targetKey ? null : current))
        }
    }

    const queueFrontendDeploy = (currentManifest: SiteManifest) => {
        void (async () => {
            startTasks('Frontend deploy', ['Build frontend', 'Deploy frontend'])
            const buildSpec = buildFrontendCommand(repoRoot)
            if (!(await runTask(0, buildSpec))) return
            const spec = deployFrontendCommand(repoRoot, currentManifest, deployConfig)
            setPendingDeploy({
                spec,
                taskIndex: 1,
                targetLabel: 'Frontend',
                version: currentManifest.frontend.version,
                remoteVersion: backendManifest?.frontend?.version ?? 'unknown',
                upload: describeUpload(spec),
                type: 'frontend'
            })
            setMode('confirm-deploy')
            setStatus(formatStatus('Confirm frontend deploy'))
        })()
    }

    const queueGameDeploy = (gameId: string, currentManifest: SiteManifest) => {
        void (async () => {
            startTasks(`Game deploy (${gameId})`, ['Build UI', 'Bundle UI', 'Deploy UI'])
            const buildSpec = buildGameUiPackageCommand(repoRoot, gameId)
            if (!(await runTask(0, buildSpec))) return
            const bundleSpec = buildGameUiCommand(repoRoot, gameId)
            if (!(await runTask(1, bundleSpec))) return
            const spec = deployGameUiCommand(repoRoot, currentManifest, gameId, deployConfig)
            setPendingDeploy({
                spec,
                taskIndex: 2,
                targetLabel: `Game UI (${gameId})`,
                version: currentManifest.games[gameId].uiVersion,
                remoteVersion: backendManifest?.games?.[gameId]?.uiVersion ?? 'unknown',
                upload: describeUpload(spec),
                type: 'game',
                gameId
            })
            setMode('confirm-deploy')
            setStatus(formatStatus(`Confirm ${gameId} deploy`))
        })()
    }

    const refresh = async (silent = false) => {
        try {
            if (!silent) {
                setStatus(formatStatus('Loading manifest...'))
            }
            setCheckingBackend(true)
            const loadedManifest = await readManifest(manifestPath)
            const config = mergeEnvConfig(await readDeployConfig(deployConfigPath))
            setDeployConfig(config)
            const { manifest: syncedManifest, changed } = await syncManifestFromPackages(
                repoRoot,
                loadedManifest
            )
            if (changed) {
                await writeManifest(manifestPath, syncedManifest)
            }
            setManifest(syncedManifest)
            setGcsStatus((current) => {
                const nextGames: Record<string, boolean | null> = {}
                for (const [gameId, entry] of Object.entries(syncedManifest.games)) {
                    const versionChanged =
                        manifest?.games[gameId]?.uiVersion !== entry.uiVersion
                    nextGames[gameId] = versionChanged
                        ? null
                        : current.games[gameId] ?? null
                }
                const frontendChanged =
                    manifest?.frontend.version !== syncedManifest.frontend.version
                return {
                    frontendExists: frontendChanged ? null : current.frontendExists,
                    games: nextGames
                }
            })
            const backendResult = await fetchBackendManifest(config.backendManifestUrl)
            setBackendManifest(backendResult.manifest ?? null)
            setBackendError(backendResult.error ?? null)
            setCheckingBackend(false)
            if (!silent) {
                setStatus(formatStatus(changed ? 'Manifest synced from package versions' : 'Ready'))
            }
        } catch (error) {
            setCheckingBackend(false)
            setStatus(
                formatStatus(
                    error instanceof Error ? error.message : 'Failed to load manifest',
                    'error'
                )
            )
        }
    }

    useEffect(() => {
        void refresh()
    }, [])

    useEffect(() => {
        if (!manifest || !selected) return
        if (selected.type === 'frontend') {
            if (checkingGcsTarget === 'frontend') return
            if (gcsStatus.frontendExists !== null) return
            const targetKey = 'frontend'
            setCheckingGcsTarget(targetKey)
            void (async () => {
                try {
                    const exists = await checkFrontendDeployed(manifest, deployConfig, gcsRoot)
                    setGcsStatus((current) => ({ ...current, frontendExists: exists }))
                } finally {
                    setCheckingGcsTarget((current) => (current === targetKey ? null : current))
                }
            })()
            return
        }

        if (selected.type === 'game' && selected.gameId) {
            const gameId = selected.gameId
            if (checkingGcsTarget === `game:${gameId}`) return
            const currentStatus = gcsStatus.games[gameId]
            if (currentStatus !== null && currentStatus !== undefined) return
            const targetKey = `game:${gameId}`
            setCheckingGcsTarget(targetKey)
            void (async () => {
                try {
                    const exists = await checkGameDeployed(manifest, gameId, deployConfig, gcsRoot)
                    setGcsStatus((current) => ({
                        ...current,
                        games: { ...current.games, [gameId]: exists }
                    }))
                } finally {
                    setCheckingGcsTarget((current) => (current === targetKey ? null : current))
                }
            })()
        }
    }, [
        checkingGcsTarget,
        deployConfig,
        gcsRoot,
        gcsStatus.frontendExists,
        gcsStatus.games,
        manifest,
        selected
    ])

    const resolveBumpType = (value: string): BumpType | null => {
        const normalized = value.trim().toLowerCase()
        if (normalized === '1' || normalized === 'm' || normalized === 'major') return 'major'
        if (normalized === '2' || normalized === 'n' || normalized === 'minor') return 'minor'
        if (normalized === '3' || normalized === 'p' || normalized === 'patch') return 'patch'
        return null
    }

    const requireManifest = (action: string) => {
        if (manifest) return manifest
        setStatus(formatStatus(`${action} requires manifest loaded`, 'error'))
        return null
    }

    const handleBump = async (target: 'frontend' | 'logic' | 'ui', bump: BumpType) => {
        if (!manifest) {
            setStatus(formatStatus('Manifest not loaded', 'error'))
            setMode('view')
            return
        }
        if ((target === 'logic' || target === 'ui') && !selectedGame) {
            setStatus(formatStatus('Select a game to bump versions', 'error'))
            setMode('view')
            return
        }

        try {
            let statusMessage = ''
            if (target === 'frontend') {
                const path = getFrontendPackagePath(repoRoot)
                const current = await readPackageVersion(path)
                const next = bumpVersion(current, bump)
                await writePackageVersion(path, next)
                statusMessage = `Frontend bumped to ${next} (${bump})`
            }

            if (target === 'logic' && selectedGame) {
                const paths = getGamePackagePaths(repoRoot, selectedGame.id)
                const currentLogic = await readPackageVersion(paths.logic)
                const nextLogic = bumpVersion(currentLogic, bump)
                const currentUi = await readPackageVersion(paths.ui)
                await writePackageVersion(paths.logic, nextLogic)
                if (currentUi === selectedGame.uiVersion) {
                    await writePackageVersion(paths.ui, nextLogic)
                    statusMessage = `Logic bumped to ${nextLogic} (${bump}); uiVersion -> ${nextLogic}`
                } else {
                    statusMessage = `Logic bumped to ${nextLogic} (${bump})`
                }
            }

            if (target === 'ui' && selectedGame) {
                const paths = getGamePackagePaths(repoRoot, selectedGame.id)
                const currentUi = await readPackageVersion(paths.ui)
                const nextUi = bumpVersion(currentUi, bump)
                await writePackageVersion(paths.ui, nextUi)
                statusMessage = `UI bumped to ${nextUi} (${bump})`
            }

            const { manifest: syncedManifest, changed } = await syncManifestFromPackages(
                repoRoot,
                manifest
            )
            if (changed) {
                await writeManifest(manifestPath, syncedManifest)
            }
            setStatus(formatStatus(statusMessage || 'Version bumped'))
        } catch (error) {
            setStatus(
                formatStatus(
                    error instanceof Error ? error.message : 'Failed to bump versions',
                    'error'
                )
            )
        }

        setMode('view')
        await refresh(true)
    }

    const handleRevertToServing = async () => {
        if (!manifest) {
            setStatus(formatStatus('Manifest not loaded', 'error'))
            return
        }
        if (!backendManifest) {
            setStatus(formatStatus('Serving info not loaded', 'error'))
            return
        }
        if (!selected) {
            setStatus(formatStatus('Select a target to revert', 'error'))
            return
        }

        try {
            if (selected.type === 'frontend') {
                const servingVersion = backendManifest.frontend?.version
                if (!servingVersion) {
                    setStatus(formatStatus('Serving frontend version is unknown', 'error'))
                    return
                }
                await writePackageVersion(getFrontendPackagePath(repoRoot), servingVersion)
                setStatus(formatStatus(`Frontend reverted to ${servingVersion}`))
            } else if (selected.type === 'game' && selected.gameId) {
                const servedGame = backendManifest.games?.[selected.gameId]
                if (!servedGame?.logicVersion || !servedGame?.uiVersion) {
                    setStatus(
                        formatStatus(
                            `Serving versions for ${selected.gameId} are unknown`,
                            'error'
                        )
                    )
                    return
                }
                const paths = getGamePackagePaths(repoRoot, selected.gameId)
                await writePackageVersion(paths.logic, servedGame.logicVersion)
                await writePackageVersion(paths.ui, servedGame.uiVersion)
                setStatus(
                    formatStatus(
                        `${selected.gameId} reverted to logic ${servedGame.logicVersion} / ui ${servedGame.uiVersion}`
                    )
                )
            } else {
                setStatus(formatStatus('Select a game or frontend to revert', 'error'))
                return
            }

            const { manifest: syncedManifest, changed } = await syncManifestFromPackages(
                repoRoot,
                manifest
            )
            if (changed) {
                await writeManifest(manifestPath, syncedManifest)
            }
        } catch (error) {
            setStatus(
                formatStatus(
                    error instanceof Error ? error.message : 'Failed to revert versions',
                    'error'
                )
            )
        }

        await refresh(true)
    }

    const runWithStatus = async (
        action: () => Promise<void>,
        label: string,
        logPath?: string
    ): Promise<boolean> => {
        setIsBusy(true)
        setOutputHold(false)
        setOutputScroll(0)
        setRunningLabel(label)
        setRunningLogPath(logPath ?? null)
        setOutputBuffer('')
        setStatus(formatStatus(`Running ${label}... ${logPath ? `(${logPath})` : ''}`))
        let failed = false
        try {
            await action()
            setStatus(formatStatus(`Finished ${label}. ${logPath ? `Log: ${logPath}` : ''}`))
        } catch (error) {
            failed = true
            setOutputHold(true)
            setStatus(
                formatStatus(
                    error instanceof Error ? error.message : `${label} failed`,
                    'error'
                )
            )
        } finally {
            setIsBusy(false)
            if (!failed) {
                setRunningLabel(null)
                setRunningLogPath(null)
            }
            await refresh(true)
        }
        return !failed
    }

    const runSpec = (spec: CommandSpec) =>
        runWithStatus(() => runCommand(spec, { onOutput: appendOutput }), spec.label, spec.logPath)

    const runTask = async (index: number, spec: CommandSpec) => {
        updateTaskStatus(index, 'running')
        const ok = await runSpec(spec)
        updateTaskStatus(index, ok ? 'success' : 'failed')
        return ok
    }

    const runDeploySpec = async (spec: CommandSpec, taskIndex?: number) => {
        const ok = taskIndex == null ? await runSpec(spec) : await runTask(taskIndex, spec)
        if (ok) {
            setTaskState(null)
        }
        return ok
    }

    useInput((input, key) => {
        if (mode === 'confirm-overwrite' && pendingOverwrite) {
            if (key.escape) {
                setMode('view')
                setPendingOverwrite(null)
                setStatus(formatStatus('Deploy cancelled'))
                return
            }

            if (input === 'y' || input === 'Y' || key.return) {
                const action = pendingOverwrite.onConfirm
                setMode('view')
                setPendingOverwrite(null)
                action()
                return
            }

            if (input === 'n' || input === 'N') {
                setMode('view')
                setPendingOverwrite(null)
                setStatus(formatStatus('Deploy cancelled'))
                return
            }

            return
        }

        if (mode === 'confirm-deploy' && pendingDeploy) {
            if (key.escape) {
                setMode('view')
                setPendingDeploy(null)
                setTaskState(null)
                setStatus(formatStatus('Deploy cancelled'))
                return
            }

            if (pendingDeploy.type === 'backend') {
                if (input === 'y' || input === 'Y') {
                    setMode('view')
                    const target = pendingDeploy
                    setPendingDeploy(null)
                    void runDeploySpec(
                        target.specWithTraffic ?? target.spec,
                        target.taskIndex
                    )
                    return
                }

                if (input === 'n' || input === 'N' || key.return) {
                    setMode('view')
                    const target = pendingDeploy
                    setPendingDeploy(null)
                    void runDeploySpec(target.spec, target.taskIndex)
                    return
                }

                return
            }

            if (input === 'y' || input === 'Y' || key.return) {
                setMode('view')
                const target = pendingDeploy
                setPendingDeploy(null)
                void (async () => {
                    const ok = await runDeploySpec(target.spec, target.taskIndex)
                    if (!ok) return
                    if (target.type === 'frontend') {
                        await refreshFrontendDeployed()
                    } else if (target.type === 'game' && target.gameId) {
                        await refreshGameDeployed(target.gameId)
                    }
                })()
                return
            }

            if (input === 'n' || input === 'N') {
                setMode('view')
                setPendingDeploy(null)
                setTaskState(null)
                setStatus(formatStatus('Deploy cancelled'))
                return
            }

            return
        }

        if (mode === 'bump-frontend' || mode === 'bump-logic' || mode === 'bump-ui') {
            if (key.escape) {
                setMode('view')
                return
            }
            const bumpType = resolveBumpType(input)
            if (!bumpType) return
            const target =
                mode === 'bump-frontend' ? 'frontend' : mode === 'bump-logic' ? 'logic' : 'ui'
            void handleBump(target, bumpType)
            return
        }

        if (mode !== 'view') {
            if (key.escape) {
                setMode('view')
                return
            }

            if (key.return) {
                void handleSubmit()
                return
            }

            if (key.backspace || key.delete) {
                setInputValue((current) => current.slice(0, -1))
                return
            }

            if (input) {
                setInputValue((current) => current + input)
            }
            return
        }

        if (input === 'q' || key.escape) {
            exit()
            return
        }

        if (outputActive || taskActive) {
            const lineScrollStep = Math.max(2, Math.floor(outputContentLines / 4))
            const scrollBy = (delta: number) => {
                setOutputScroll((current) =>
                    Math.min(maxOutputScroll, Math.max(0, current + delta))
                )
            }
            if (key.pageUp) {
                scrollBy(outputContentLines)
                return
            }
            if (key.pageDown) {
                scrollBy(-outputContentLines)
                return
            }
            if (key.home) {
                setOutputScroll(maxOutputScroll)
                return
            }
            if (key.end) {
                setOutputScroll(0)
                return
            }
            if (key.upArrow) {
                scrollBy(lineScrollStep)
                return
            }
            if (key.downArrow) {
                scrollBy(-lineScrollStep)
                return
            }
            if (outputHold && key.return) {
                setOutputHold(false)
                setRunningLabel(null)
                setRunningLogPath(null)
                setOutputScroll(0)
                setTaskState(null)
            }
            return
        }

        if (key.upArrow) {
            setSelectedIndex((index) => Math.max(0, index - 1))
            return
        }

        if (key.downArrow) {
            setSelectedIndex((index) => Math.min(selections.length - 1, index + 1))
            return
        }

        if (input === 'r') {
            void refresh()
            return
        }

        if (!selected) return

        if (input === 'f') {
            const currentManifest = requireManifest('Bump frontend version')
            if (!currentManifest) return
            setMode('bump-frontend')
            return
        }

        if (input === 'l') {
            if (selected.type !== 'game' || !selectedGame) {
                setStatus(formatStatus('Select a game to bump logic', 'error'))
                return
            }
            setMode('bump-logic')
            return
        }

        if (input === 'u') {
            if (selected.type !== 'game' || !selectedGame) {
                setStatus(formatStatus('Select a game to bump UI version', 'error'))
                return
            }
            setMode('bump-ui')
            return
        }

        if (input === 'k') {
            if (selected.type !== 'backend') {
                setStatus(formatStatus('Select backend to rollback', 'error'))
                return
            }
            setInputValue('')
            setMode('rollback')
            return
        }

        if (input === 's') {
            void handleRevertToServing()
            return
        }

        if (input === 'd') {
            if (selected.type === 'backend') {
                const image = resolveBackendImage()
                if (!image) {
                    setStatus(
                        formatStatus(
                            'Backend deploy requires backend.image (or --image in deployCommand)',
                            'error'
                        )
                    )
                    return
                }
                void (async () => {
                    startTasks('Backend deploy', [
                        'Build backend (force)',
                        'Build image',
                        'Tag image',
                        'Push image',
                        'Deploy backend'
                    ])
                    const backendBuildSpec = buildBackendCommand(repoRoot, { force: true })
                    if (!(await runTask(0, backendBuildSpec))) return
                    const buildSpec = buildBackendImageCommand(repoRoot)
                    if (!(await runTask(1, buildSpec))) return
                    const tagSpec = tagBackendImageCommand(repoRoot, image)
                    if (!(await runTask(2, tagSpec))) return
                    const pushSpec = pushBackendImageCommand(repoRoot, image)
                    if (!(await runTask(3, pushSpec))) return
                    const spec = deployBackendCommand(repoRoot, deployConfig, {
                        allowTraffic: false
                    })
                    const specWithTraffic = deployBackendCommand(repoRoot, deployConfig, {
                        allowTraffic: true
                    })
                    setPendingDeploy({
                        spec,
                        specWithTraffic,
                        targetLabel: 'Backend',
                        taskIndex: 4,
                        version: image,
                        remoteVersion: backendManifest?.backend?.revision ?? 'unknown',
                        upload: `image: ${image}`,
                        type: 'backend'
                    })
                    setMode('confirm-deploy')
                    setStatus(formatStatus('Confirm backend deploy'))
                })()
                return
            }

            const currentManifest = requireManifest('Deploy')
            if (!currentManifest) return

            if (selected.type === 'frontend') {
                const localVersion = currentManifest.frontend.version
                const remoteVersion = backendManifest?.frontend?.version
                if (remoteVersion && remoteVersion === localVersion) {
                    setPendingOverwrite({
                        targetLabel: 'Frontend',
                        version: localVersion,
                        remoteVersion,
                        onConfirm: () => queueFrontendDeploy(currentManifest)
                    })
                    setMode('confirm-overwrite')
                    setStatus(formatStatus('Confirm overwrite'))
                    return
                }
                queueFrontendDeploy(currentManifest)
                return
            }
            if (selected.type === 'game') {
                const gameId = selected.gameId
                if (!gameId) return
                const localVersion = currentManifest.games[gameId].uiVersion
                const remoteVersion = backendManifest?.games?.[gameId]?.uiVersion
                if (remoteVersion && remoteVersion === localVersion) {
                    setPendingOverwrite({
                        targetLabel: `Game UI (${gameId})`,
                        version: localVersion,
                        remoteVersion,
                        onConfirm: () => queueGameDeploy(gameId, currentManifest)
                    })
                    setMode('confirm-overwrite')
                    setStatus(formatStatus('Confirm overwrite'))
                    return
                }
                queueGameDeploy(gameId, currentManifest)
            }
            return
        }

    })

    const handleSubmit = async () => {
        if (mode !== 'rollback') {
            setMode('view')
            return
        }
        if (!inputValue.trim()) {
            setStatus(formatStatus('Rollback requires a revision name', 'error'))
            setMode('view')
            return
        }
        const spec = rollbackBackendCommand(repoRoot, inputValue.trim(), deployConfig)
        void runSpec(spec)
        setMode('view')
    }

    return (
        <Box
            flexDirection="column"
            gap={1}
            position="relative"
            width={terminalCols}
            height={terminalRows}
            overflow="hidden"
        >
            <Text color="cyan">Tabletop Deploy</Text>
            <Box borderStyle="round" paddingX={1} paddingY={1} flexDirection="row" gap={3}>
                <Box flexDirection="column" width={30}>
                    <Text color="magenta">Targets</Text>
                    {selections.slice(0, 2).map((item, index) => (
                        <Text
                            key={`target-${item.key}`}
                            color={index === selectedIndex ? 'cyan' : undefined}
                        >
                            {index === selectedIndex ? '› ' : '  '}
                            {item.label}
                            {item.type === 'frontend'
                                ? ` ${formatIndicator(
                                      gcsStatus.frontendExists,
                                      checkingGcsTarget === 'frontend'
                                  )}`
                                : ''}
                        </Text>
                    ))}
                    <Text color="magenta">Games</Text>
                    {selections.slice(2).map((item, index) => {
                        const selectionIndex = index + 2
                        const gameId = item.gameId ?? ''
                        const servedGame = backendManifest?.games?.[gameId]
                        const serveMismatch = servedGame
                            ? servedGame.logicVersion !== manifest?.games[gameId]?.logicVersion ||
                              servedGame.uiVersion !== manifest?.games[gameId]?.uiVersion
                            : false
                        const deployedKnown =
                            gcsStatus.games[gameId] !== null &&
                            gcsStatus.games[gameId] !== undefined
                        const deployedMissing = deployedKnown && gcsStatus.games[gameId] === false
                        const warn = serveMismatch || deployedMissing
                        const itemColor =
                            warn ? 'red' : selectionIndex === selectedIndex ? 'cyan' : undefined
                        const indicator = warn
                            ? '✗'
                            : formatIndicator(
                                  gcsStatus.games[gameId],
                                  checkingGcsTarget === `game:${gameId}`
                              )
                        return (
                            <Text
                                key={`game-${item.key}`}
                                color={itemColor}
                            >
                                {selectionIndex === selectedIndex ? '› ' : '  '}
                                {item.label} {indicator}
                            </Text>
                        )
                    })}
                </Box>
                <Box flexDirection="column" flexGrow={1}>
                    {mode === 'confirm-overwrite' && pendingOverwrite ? (
                        <Box flexDirection="column" borderStyle="round" paddingX={1} paddingY={1}>
                            <Text color="magenta">Confirm overwrite</Text>
                            <Text color="gray">target: {pendingOverwrite.targetLabel}</Text>
                            <Text color="gray">
                                local: {pendingOverwrite.version} / remote:{' '}
                                {pendingOverwrite.remoteVersion}
                            </Text>
                            <Text color="yellow">Overwrite existing version?</Text>
                        </Box>
                    ) : (
                        <>
                            <Text color="magenta">Details</Text>
                            {selected?.type === 'frontend' ? (
                                <>
                                    <Text>
                                        local: {manifest?.frontend.version ?? 'unknown'}
                                    </Text>
                                    <Text color={frontendServingMismatch ? 'red' : 'gray'}>
                                        {checkingBackend ? (
                                            'serving: checking...'
                                        ) : frontendServing ? (
                                            `serving: ${frontendServing}${
                                                frontendServingMismatch ? ' <-- mismatch' : ''
                                            }`
                                        ) : (
                                            'serving: unknown'
                                        )}
                                    </Text>
                                    <Text color={frontendDeployedColor}>
                                        deployed:{' '}
                                        {frontendDeployedChecking
                                            ? 'checking...'
                                            : gcsStatus.frontendExists == null
                                              ? 'unknown'
                                              : gcsStatus.frontendExists
                                                ? 'true'
                                                : 'false'}
                                    </Text>
                                </>
                            ) : selected?.type === 'backend' ? (
                                <>
                                    <Text>
                                        revision: {backendManifest?.backend?.revision ?? 'unknown'}
                                    </Text>
                                    {backendManifest?.backend?.buildSha ? (
                                        <Text color="gray">
                                            sha: {backendManifest.backend.buildSha}
                                        </Text>
                                    ) : null}
                                    {backendError ? (
                                        <Text color="gray">error: {backendError}</Text>
                                    ) : null}
                                </>
                            ) : selectedGame ? (
                                <>
                                    <Text>
                                        local: logic {selectedGame.logicVersion} / ui{' '}
                                        {selectedGame.uiVersion}
                                    </Text>
                                    <Text color={selectedServingMismatch ? 'red' : 'gray'}>
                                        {checkingBackend ? (
                                            'serving: checking...'
                                        ) : selectedServing ? (
                                            `serving: logic ${selectedServing.logicVersion} / ui ${selectedServing.uiVersion}${selectedServingMismatch ? ' <-- mismatch' : ''}`
                                        ) : (
                                            'serving: unknown'
                                        )}
                                    </Text>
                                    <Text color={selectedDeployedColor}>
                                        deployed:{' '}
                                        {selectedDeployedChecking
                                            ? 'checking...'
                                            : selectedDeployed == null
                                              ? 'unknown'
                                              : selectedDeployed
                                                ? 'true'
                                                : 'false'}
                                    </Text>
                                </>
                            ) : (
                                <Text color="gray">No selection</Text>
                            )}
                        </>
                    )}
                </Box>
            </Box>
            <Box flexDirection="column">
                {mode === 'view' ? (
                    <Text color={status.tone === 'error' ? 'red' : 'green'}>
                        {status.message}
                    </Text>
                ) : mode === 'confirm-overwrite' ? (
                    <Text color="yellow">Confirm overwrite in the right panel</Text>
                ) : mode === 'confirm-deploy' ? (
                    <Text color="yellow">Confirm deploy details in the modal</Text>
                ) : (
                    <Box gap={1}>
                        <Text color="yellow">
                            {mode === 'bump-frontend'
                                ? 'Bump frontend version: 1=major 2=minor 3=patch'
                                : mode === 'bump-logic'
                                  ? `Bump logic version (${selectedGame?.id ?? ''}): 1=major 2=minor 3=patch`
                                  : mode === 'bump-ui'
                                    ? `Bump UI version (${selectedGame?.id ?? ''}): 1=major 2=minor 3=patch`
                                    : 'Rollback to revision:'}
                        </Text>
                        {mode === 'rollback' ? <Text>{inputValue}</Text> : null}
                    </Box>
                )}
                <Text color="gray">{commandHint}</Text>
            </Box>
            {modalActive ? (
                <Box
                    position="absolute"
                    width="100%"
                    height="100%"
                    alignItems="center"
                    justifyContent="center"
                    backgroundColor="black"
                >
                    <Box
                        width={modalWidth}
                        height={modalHeight}
                        borderStyle="round"
                        borderColor="yellow"
                        paddingX={modalPaddingX}
                        paddingY={modalPaddingY}
                        flexDirection="column"
                        overflow="hidden"
                    >
                        {confirmDeployActive && pendingDeploy ? (
                            <>
                                <Text color="magenta" wrap="truncate">
                                    Confirm deploy
                                </Text>
                                <Box
                                    flexDirection="row"
                                    height={confirmContentLines}
                                    overflow="hidden"
                                >
                                    {taskState ? (
                                        <Box
                                            flexDirection="column"
                                            width={tasksPaneWidth}
                                            marginRight={1}
                                        >
                                            {taskState.tasks.map((task, index) => {
                                                const indicator =
                                                    task.status === 'running'
                                                        ? '…'
                                                        : task.status === 'success'
                                                          ? '✓'
                                                          : task.status === 'failed'
                                                            ? '✗'
                                                            : '·'
                                                const color =
                                                    task.status === 'running'
                                                        ? 'yellow'
                                                        : task.status === 'success'
                                                          ? 'green'
                                                          : task.status === 'failed'
                                                            ? 'red'
                                                            : 'gray'
                                                return (
                                                    <Text
                                                        key={`task-${index}`}
                                                        color={color}
                                                        wrap="truncate"
                                                    >
                                                        {index + 1}. {task.label} {indicator}
                                                    </Text>
                                                )
                                            })}
                                        </Box>
                                    ) : null}
                                    <Box flexDirection="column" flexGrow={1} overflow="hidden">
                                        <Text color="gray">
                                            target: {pendingDeploy.targetLabel}
                                        </Text>
                                        {pendingDeploy.version ? (
                                            <Text color="gray">
                                                version: {pendingDeploy.version}
                                            </Text>
                                        ) : null}
                                        {pendingDeploy.remoteVersion ? (
                                            <Text color="gray">
                                                remote: {pendingDeploy.remoteVersion}
                                            </Text>
                                        ) : null}
                                        {pendingDeploy.upload ? (
                                            <Text color="gray" wrap="wrap">
                                                upload: {pendingDeploy.upload}
                                            </Text>
                                        ) : null}
                                        <Text color="gray" wrap="wrap">
                                            command: {commandString(pendingDeploy.spec)}
                                        </Text>
                                        {pendingDeploy.type === 'backend' ? (
                                            <Text color="gray" wrap="wrap">
                                                command (with traffic):{' '}
                                                {commandString(
                                                    pendingDeploy.specWithTraffic ??
                                                        pendingDeploy.spec
                                                )}
                                            </Text>
                                        ) : null}
                                        <Text color="yellow">
                                            {pendingDeploy.type === 'backend'
                                                ? 'y = deploy with traffic, n/Enter = no traffic, Esc cancel'
                                                : 'y/Enter = deploy, n/Esc cancel'}
                                        </Text>
                                    </Box>
                                </Box>
                            </>
                        ) : (
                            <>
                                <Text color="magenta" wrap="truncate">
                                    Deploying: {displayRunningLabel} [{outputModeLabel}]
                                </Text>
                                {runningLogPath ? (
                                    <Text color="gray" wrap="truncate">
                                        log: {runningLogPath}
                                    </Text>
                                ) : null}
                                {outputHold ? (
                                    <Text color="yellow" wrap="truncate">
                                        Press Enter to return
                                    </Text>
                                ) : null}
                                {taskState ? (
                                    <Box
                                        flexDirection="row"
                                        height={outputContentLines}
                                        overflow="hidden"
                                    >
                                        <Box
                                            flexDirection="column"
                                            width={tasksPaneWidth}
                                            marginRight={1}
                                        >
                                            {taskState.tasks.map((task, index) => {
                                                const indicator =
                                                    task.status === 'running'
                                                        ? '…'
                                                        : task.status === 'success'
                                                          ? '✓'
                                                          : task.status === 'failed'
                                                            ? '✗'
                                                            : '·'
                                                const color =
                                                    task.status === 'running'
                                                        ? 'yellow'
                                                        : task.status === 'success'
                                                          ? 'green'
                                                          : task.status === 'failed'
                                                            ? 'red'
                                                            : 'gray'
                                                return (
                                                    <Text
                                                        key={`task-${index}`}
                                                        color={color}
                                                        wrap="truncate"
                                                    >
                                                        {index + 1}. {task.label} {indicator}
                                                    </Text>
                                                )
                                            })}
                                        </Box>
                                        <Box flexDirection="column" flexGrow={1} overflow="hidden">
                                            {paddedOutputLines.map((line, index) => (
                                                <Text key={`output-line-${index}`} wrap="truncate">
                                                    {line.length === 0 ? ' ' : line}
                                                </Text>
                                            ))}
                                        </Box>
                                    </Box>
                                ) : (
                                    <Box
                                        flexDirection="column"
                                        height={outputContentLines}
                                        overflow="hidden"
                                    >
                                        {paddedOutputLines.map((line, index) => (
                                            <Text key={`output-line-${index}`} wrap="truncate">
                                                {line.length === 0 ? ' ' : line}
                                            </Text>
                                        ))}
                                    </Box>
                                )}
                            </>
                        )}
                    </Box>
                </Box>
            ) : null}
        </Box>
    )
}

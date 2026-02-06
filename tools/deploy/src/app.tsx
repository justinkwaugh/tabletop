import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Text, useApp, useInput, useStdout } from 'ink'
import type { ChildProcess } from 'node:child_process'
import fs from 'node:fs/promises'
import { readManifest, writeManifest } from './lib/manifest.js'
import { fetchBackendManifest, invalidateBackendManifestCache } from './lib/backend.js'
import { checkFrontendDeployed, checkGameDeployed, GcsStatus } from './lib/gcs.js'
import { mergeEnvConfig, readDeployConfig } from './lib/config.js'
import {
    buildBackendCommand,
    buildBackendImageCommand,
    buildFrontendCommand,
    buildGameLogicCommand,
    buildGameLogicPackageCommand,
    buildGameUiCommand,
    buildGameUiPackageCommand,
    pushBackendImageCommand,
    deployBackendCommand,
    deployFrontendCommand,
    deployGameLogicCommand,
    deployManifestCommand,
    deployGameUiCommand,
    gcsDirectoryPlaceholderCommands,
    gcsRsyncDirectoryPlaceholderCommands,
    tagBackendImageCommand,
    rollbackBackendCommand,
    runCommand
} from './lib/commands.js'
import type { CommandSpec } from './lib/commands.js'
import {
    getDeployConfigPath,
    getManifestPath,
    getRepoRoot,
    getStaticRoot
} from './lib/paths.js'
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
    | 'bump-game-target'
    | 'bump-logic'
    | 'bump-ui'
    | 'rollback'
    | 'select-backend-service'
    | 'confirm-reset-mismatch'
    | 'confirm-deploy-all'
    | 'confirm-overwrite'
    | 'confirm-post-bump'
    | 'confirm-deploy'

type SelectionType = 'frontend' | 'backend' | 'game' | 'games'

type BackendDeployTarget = 'backend' | 'tasks' | 'all'

type Selection = {
    key: string
    type: SelectionType
    label: string
    gameId?: string
    packageId?: string
}

type DeployStep = {
    spec?: CommandSpec
    specs?: CommandSpec[]
    action?: (signal: AbortSignal) => Promise<void>
    label?: string
    logPath?: string
    taskIndex?: number
}

type PendingDeploy = {
    spec?: CommandSpec
    specWithTraffic?: CommandSpec
    steps?: DeployStep[]
    stepsWithTraffic?: DeployStep[]
    targetLabel: string
    taskIndex?: number
    version?: string
    remoteVersion?: string
    uploads?: string[]
    type: SelectionType
    packageId?: string
    gameId?: string
}

type PendingOverwrite = {
    targetLabel: string
    version: string
    remoteVersion: string
    onConfirm: () => void
}

type PendingPostBump = {
    targetLabel: string
    onConfirm: () => void
}

type PendingMismatchReset = {
    details: string[]
    onConfirm: () => void
}

type PendingDeployAll = {
    gameCount: number
    onConfirm: () => void
}

type PendingBackendDeploy = {
    onConfirm: (target: BackendDeployTarget) => void
}

type MismatchFrontend = {
    local: string
    remote: string
}

type MismatchGame = {
    gameId: string
    packageId: string
    localLogic: string
    localUi: string
    remoteLogic: string
    remoteUi: string
}

type ActiveDeployContext = {
    type: SelectionType
    label: string
    version?: string
    gameId?: string
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
const staticRoot = getStaticRoot()

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
    const [pendingPostBump, setPendingPostBump] = useState<PendingPostBump | null>(null)
    const [pendingMismatchReset, setPendingMismatchReset] =
        useState<PendingMismatchReset | null>(null)
    const [pendingDeployAll, setPendingDeployAll] = useState<PendingDeployAll | null>(null)
    const [pendingBackendDeploy, setPendingBackendDeploy] =
        useState<PendingBackendDeploy | null>(null)
    const [backendDeployTarget, setBackendDeployTarget] =
        useState<BackendDeployTarget>('backend')
    const [activeDeployContext, setActiveDeployContext] = useState<ActiveDeployContext | null>(null)
    const [checkingBackend, setCheckingBackend] = useState(false)
    const [checkingGcsTarget, setCheckingGcsTarget] = useState<string | null>(null)
    const [taskState, setTaskState] = useState<TaskState | null>(null)
    const runningChildRef = useRef<ChildProcess | null>(null)
    const runningAbortRef = useRef<AbortController | null>(null)
    const cancelRequestedRef = useRef(false)
    const commandRunningRef = useRef(false)
    const { stdout } = useStdout()

    const games = useMemo(() => manifest?.games ?? [], [manifest])

    const gameByPackageId = useMemo(
        () => new Map(games.map((game) => [game.packageId, game])),
        [games]
    )
    const selections = useMemo<Selection[]>(
        () => [
            { key: 'frontend', type: 'frontend', label: 'Frontend' },
            { key: 'backend', type: 'backend', label: 'Backend' },
            { key: 'games:all', type: 'games', label: 'All games' },
            ...games.map((game) => ({
                key: `game:${game.packageId}`,
                type: 'game' as const,
                label: game.gameId,
                gameId: game.gameId,
                packageId: game.packageId
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
        selected?.type === 'game' && selected.packageId
            ? gameByPackageId.get(selected.packageId)
            : undefined
    const selectedAllGames = selected?.type === 'games'
    const mismatchState = useMemo(() => {
        if (!manifest || !backendManifest) {
            return { frontend: null, games: [] as MismatchGame[] }
        }
        const frontendRemote = backendManifest.frontend?.version
        const frontendMismatch =
            frontendRemote && manifest.frontend.version !== frontendRemote
                ? { local: manifest.frontend.version, remote: frontendRemote }
                : null
        const backendGames = new Map(
            (backendManifest.games ?? []).map((game) => [game.packageId, game])
        )
        const games = (manifest.games ?? [])
            .map((entry) => {
                const remote = backendGames.get(entry.packageId)
                if (!remote) return null
                const mismatch =
                    remote.logicVersion !== entry.logicVersion ||
                    remote.uiVersion !== entry.uiVersion
                if (!mismatch) return null
                return {
                    gameId: entry.gameId,
                    packageId: entry.packageId,
                    localLogic: entry.logicVersion,
                    localUi: entry.uiVersion,
                    remoteLogic: remote.logicVersion,
                    remoteUi: remote.uiVersion
                }
            })
            .filter(Boolean) as MismatchGame[]
        return { frontend: frontendMismatch, games }
    }, [backendManifest, manifest])
    const mismatchedGamePackages = useMemo(
        () => new Set(mismatchState.games.map((game) => game.packageId)),
        [mismatchState.games]
    )
    const selectedServing = selectedGame
        ? backendManifest?.games?.find((game) => game.packageId === selectedGame.packageId)
        : undefined
    const selectedServingMismatch =
        selectedGame && selectedServing
            ? selectedServing.logicVersion !== selectedGame.logicVersion ||
              selectedServing.uiVersion !== selectedGame.uiVersion
            : false
    const selectedDeployed = selectedGame ? gcsStatus.games[selectedGame.packageId] : null
    const selectedDeployedChecking = selectedGame
        ? checkingGcsTarget === `game:${selectedGame.packageId}`
        : false
    const selectedDeployedColor =
        !selectedDeployedChecking && selectedDeployed === false ? 'red' : 'gray'
    const frontendDeployedChecking = checkingGcsTarget === 'frontend'
    const frontendDeployedColor =
        !frontendDeployedChecking && gcsStatus.frontendExists === false ? 'red' : 'gray'
    const frontendServing = backendManifest?.frontend?.version
    const frontendServingMismatch =
        frontendServing != null && manifest?.frontend.version !== frontendServing
    const canBumpFrontend = selected?.type === 'frontend' && !!manifest
    const canRollback = selected?.type === 'backend'
    const canBumpGame = selected?.type === 'game' && !!selectedGame
    const canUseServing =
        !!backendManifest &&
        (selected?.type === 'frontend' || (selected?.type === 'game' && !!selectedGame))
    const canDeploy =
        selected?.type === 'backend' ||
        (selected?.type === 'frontend' && !!manifest) ||
        (selected?.type === 'game' && !!manifest && !!selectedGame) ||
        (selected?.type === 'games' && !!manifest && games.length > 0)
    const canInvalidateManifest = Boolean(
        deployConfig.backendAdmin?.url ?? deployConfig.backendManifestUrl
    )
    const canBumpSelection = canBumpFrontend || canBumpGame
    const outputActive = isBusy || outputHold
    const confirmDeployActive = mode === 'confirm-deploy' && pendingDeploy
    const confirmDeployAllActive = mode === 'confirm-deploy-all' && pendingDeployAll
    const taskActive = taskState !== null && !confirmDeployActive
    const modalActive =
        outputActive || confirmDeployActive || confirmDeployAllActive || taskState !== null
    const commandHint = useMemo(() => {
        if (mode === 'confirm-overwrite' && pendingOverwrite) {
            return 'y/Enter overwrite  n/Esc cancel'
        }
        if (mode === 'confirm-post-bump' && pendingPostBump) {
            return 'y/Enter deploy  n/Esc cancel'
        }
        if (mode === 'confirm-reset-mismatch' && pendingMismatchReset) {
            return 'y/Enter reset  n/Esc cancel'
        }
        if (mode === 'confirm-deploy-all' && pendingDeployAll) {
            return 'y/Enter deploy all  n/Esc cancel'
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
        if (mode === 'bump-game-target') {
            return 'l logic  u ui  Esc cancel'
        }
        if (mode === 'bump-frontend' || mode === 'bump-logic' || mode === 'bump-ui') {
            return '1/major  2/minor  3/patch  Esc cancel'
        }
        if (mode === 'rollback') {
            return 'Enter confirm  Esc cancel'
        }
        const commands = ['↑/↓ select', 'r reload', 'd deploy']
        if (!canDeploy) {
            commands.pop()
        }
        if (canInvalidateManifest) {
            commands.push('i invalidate')
        }
        if (canBumpSelection) {
            commands.push('v bump-version')
        }
        if (canRollback) {
            commands.push('k rollback')
        }
        if (canUseServing) {
            commands.push('s use-serving')
        }
        commands.push('q quit')
        return commands.join('  ')
    }, [
        canBumpFrontend,
        canBumpGame,
        canDeploy,
        canInvalidateManifest,
        canBumpSelection,
        canRollback,
        canUseServing,
        mode,
        outputActive,
        outputHold,
        pendingDeployAll,
        pendingDeploy,
        pendingMismatchReset,
        pendingOverwrite,
        taskActive
    ])

    const terminalCols = stdout?.columns ?? 80
    const terminalRows = stdout?.rows ?? 24
    const modalPaddingX = 1
    const modalPaddingY = 1
    const modalWidth = Math.min(110, Math.max(20, terminalCols - 2), terminalCols)
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
    const activeDeployLabel =
        activeDeployContext?.type === 'game'
            ? activeDeployContext.gameId ?? activeDeployContext.label
            : activeDeployContext?.type === 'games'
              ? activeDeployContext.label
              : displayRunningLabel
    const activeDeployVersion =
        activeDeployContext?.type === 'game' || activeDeployContext?.type === 'games'
            ? activeDeployContext.version
            : undefined
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

    const appendOutputWithLog = async (logPath: string, chunk: string) => {
        appendOutput(chunk)
        try {
            await fs.appendFile(logPath, chunk, 'utf8')
        } catch {
            // Ignore log write errors; output buffer still updates.
        }
    }

    const ensureNoRunningCommand = (action: string) => {
        if (commandRunningRef.current) {
            setStatus(formatStatus(`${action} blocked: command already running`, 'error'))
            return false
        }
        return true
    }

    const cancelRunningCommand = () => {
        cancelRequestedRef.current = true
        const controller = runningAbortRef.current
        if (controller) {
            controller.abort()
        }
        const child = runningChildRef.current
        if (child && child.exitCode == null) {
            child.kill('SIGTERM')
            setTimeout(() => {
                if (child.exitCode == null) {
                    child.kill('SIGKILL')
                }
            }, 2000)
        }
        runningChildRef.current = null
        runningAbortRef.current = null
        commandRunningRef.current = false
        setIsBusy(false)
        setOutputHold(false)
        setOutputScroll(0)
        setRunningLabel(null)
        setRunningLogPath(null)
        setTaskState(null)
        setActiveDeployContext(null)
        setStatus(formatStatus('Command cancelled'))
    }

    const commandString = (spec: CommandSpec) => [spec.command, ...spec.args].join(' ')
    const resolveDeploySteps = (
        target: PendingDeploy,
        options?: { withTraffic?: boolean }
    ): DeployStep[] => {
        const steps = options?.withTraffic
            ? target.stepsWithTraffic ?? target.steps
            : target.steps
        if (steps && steps.length > 0) {
            return steps
        }
        const spec = options?.withTraffic
            ? target.specWithTraffic ?? target.spec
            : target.spec
        return spec ? [{ spec, taskIndex: target.taskIndex }] : []
    }
    const confirmDeploySteps =
        confirmDeployActive && pendingDeploy ? resolveDeploySteps(pendingDeploy) : []
    const confirmDeployStepsWithTraffic =
        confirmDeployActive && pendingDeploy
            ? resolveDeploySteps(pendingDeploy, { withTraffic: true })
            : []
    const confirmDeployCommands = confirmDeploySteps.flatMap((step) =>
        step.specs && step.specs.length > 0 ? step.specs : step.spec ? [step.spec] : []
    )
    const confirmDeployCommandsWithTraffic = confirmDeployStepsWithTraffic.flatMap((step) =>
        step.specs && step.specs.length > 0 ? step.specs : step.spec ? [step.spec] : []
    )
    const describeUpload = (spec: CommandSpec) => {
        if (spec.command !== 'gcloud') return undefined
        if (spec.args[0] !== 'storage') return undefined
        if (spec.args.length < 2) return undefined
        if (spec.args[1] !== 'rsync' && spec.args[1] !== 'cp') return undefined
        const source = spec.args[spec.args.length - 2]
        const destination = spec.args[spec.args.length - 1]
        return `${source} -> ${destination}`
    }
    const directoryPlaceholderSpecs = (spec: CommandSpec): CommandSpec[] => {
        if (spec.command !== 'gcloud') return []
        if (spec.args[0] !== 'storage') return []
        if (spec.args.length < 2) return []
        const operation = spec.args[1]
        if (operation !== 'rsync' && operation !== 'cp') return []
        const source = spec.args[spec.args.length - 2]
        const destination = spec.args[spec.args.length - 1]
        if (!destination.startsWith('gs://')) return []
        if (operation === 'rsync' && !source.startsWith('gs://')) {
            return gcsRsyncDirectoryPlaceholderCommands(repoRoot, source, destination, {
                labelPrefix: spec.label,
                logPrefix: spec.logPath
            })
        }
        return gcsDirectoryPlaceholderCommands(repoRoot, destination, {
            treatDestinationAsObject: operation === 'cp',
            labelPrefix: spec.label,
            logPrefix: spec.logPath
        })
    }
    const dedupeCommandSpecs = (specs: CommandSpec[]): CommandSpec[] => {
        const seen = new Set<string>()
        return specs.filter((spec) => {
            const key = `${spec.command}\u0000${spec.args.join('\u0000')}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
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
    const resolveBackendServiceName = (target: 'backend' | 'tasks') => {
        const backend = deployConfig.backend
        if (!backend?.service) {
            throw new Error('Missing backend service in deploy config')
        }
        if (target === 'backend') return backend.service
        return backend.tasksService ?? 'tasks'
    }

    const refreshFrontendDeployed = async () => {
        if (!manifest) return
        setCheckingGcsTarget('frontend')
        setGcsStatus((current) => ({ ...current, frontendExists: null }))
        try {
            const exists = await checkFrontendDeployed(manifest, deployConfig, staticRoot)
            setGcsStatus((current) => ({ ...current, frontendExists: exists }))
        } finally {
            setCheckingGcsTarget((current) => (current === 'frontend' ? null : current))
        }
    }

    const refreshGameDeployed = async (packageId: string) => {
        if (!manifest) return
        const targetKey = `game:${packageId}`
        setCheckingGcsTarget(targetKey)
        setGcsStatus((current) => ({
            ...current,
            games: { ...current.games, [packageId]: null }
        }))
        try {
            const exists = await checkGameDeployed(manifest, packageId, deployConfig, staticRoot)
            setGcsStatus((current) => ({
                ...current,
                games: { ...current.games, [packageId]: exists }
            }))
        } finally {
            setCheckingGcsTarget((current) => (current === targetKey ? null : current))
        }
    }

    const manifestInvalidateLogPath = '/tmp/manifest-invalidate.log'
    const invalidateManifestCache = async (signal: AbortSignal) => {
        await fs.writeFile(manifestInvalidateLogPath, '', 'utf8')
        await appendOutputWithLog(
            manifestInvalidateLogPath,
            'Invalidating backend manifest cache...\n'
        )
        await invalidateBackendManifestCache(deployConfig, { signal })
        await appendOutputWithLog(
            manifestInvalidateLogPath,
            'Backend manifest cache invalidated.\n'
        )
    }

    const queueBackendDeploy = (target: BackendDeployTarget, image: string) => {
        void (async () => {
            if (!ensureNoRunningCommand('Deploy')) {
                return
            }
            let backendService: string
            let tasksService: string
            try {
                backendService = resolveBackendServiceName('backend')
                tasksService = resolveBackendServiceName('tasks')
            } catch (error) {
                setStatus(
                    formatStatus(
                        error instanceof Error ? error.message : 'Missing backend service config',
                        'error'
                    )
                )
                return
            }

            const services =
                target === 'all'
                    ? [backendService, tasksService]
                    : [target === 'backend' ? backendService : tasksService]
            const deployLabel =
                target === 'backend'
                    ? 'Deploy backend'
                    : target === 'tasks'
                      ? 'Deploy tasks'
                      : 'Deploy backend + tasks'
            startTasks('Backend deploy', [
                'Build backend (force)',
                'Build image',
                'Tag image',
                'Push image',
                deployLabel
            ])
            const backendBuildSpec = buildBackendCommand(repoRoot, { force: true })
            if (!(await runTask(0, backendBuildSpec))) return
            const buildSpec = buildBackendImageCommand(repoRoot)
            if (!(await runTask(1, buildSpec))) return
            const tagSpec = tagBackendImageCommand(repoRoot, image)
            if (!(await runTask(2, tagSpec))) return
            const pushSpec = pushBackendImageCommand(repoRoot, image)
            if (!(await runTask(3, pushSpec))) return

            const noTrafficSpecs = services.map((service) =>
                deployBackendCommand(repoRoot, deployConfig, {
                    allowTraffic: false,
                    service
                })
            )
            const withTrafficSpecs = services.map((service) =>
                deployBackendCommand(repoRoot, deployConfig, {
                    allowTraffic: true,
                    service
                })
            )

            if (services.length > 1) {
                setPendingDeploy({
                    steps: [{ specs: noTrafficSpecs, taskIndex: 4 }],
                    stepsWithTraffic: [{ specs: withTrafficSpecs, taskIndex: 4 }],
                    targetLabel: 'Backend + Tasks',
                    taskIndex: 4,
                    version: image,
                    remoteVersion: backendManifest?.backend?.revision ?? 'unknown',
                    uploads: [`image: ${image}`],
                    type: 'backend'
                })
            } else {
                setPendingDeploy({
                    spec: noTrafficSpecs[0],
                    specWithTraffic: withTrafficSpecs[0],
                    targetLabel: target === 'tasks' ? 'Tasks' : 'Backend',
                    taskIndex: 4,
                    version: image,
                    remoteVersion: backendManifest?.backend?.revision ?? 'unknown',
                    uploads: [`image: ${image}`],
                    type: 'backend'
                })
            }
            setMode('confirm-deploy')
            setStatus(formatStatus('Confirm backend deploy'))
        })()
    }

    const queueFrontendDeploy = (currentManifest: SiteManifest) => {
        void (async () => {
            if (!ensureNoRunningCommand('Deploy')) {
                return
            }
            setActiveDeployContext({
                type: 'frontend',
                label: 'Frontend',
                version: currentManifest.frontend.version
            })
            startTasks('Frontend deploy', [
                'Build frontend',
                'Deploy frontend',
                'Deploy manifest',
                'Invalidate manifest cache'
            ])
            const buildSpec = buildFrontendCommand(repoRoot)
            if (!(await runTask(0, buildSpec))) return
            const spec = deployFrontendCommand(repoRoot, currentManifest, deployConfig)
            const deployPlaceholderSpecs = directoryPlaceholderSpecs(spec)
            const upload = describeUpload(spec)
            const manifestSpec = deployManifestCommand(manifestPath, deployConfig)
            const manifestPlaceholderSpecs = directoryPlaceholderSpecs(manifestSpec)
            const manifestUpload = describeUpload(manifestSpec)
            const invalidateStep: DeployStep = {
                action: invalidateManifestCache,
                label: 'invalidate-manifest',
                logPath: manifestInvalidateLogPath,
                taskIndex: 3
            }
            const uploads = [
                upload ? upload : undefined,
                manifestUpload ? `manifest: ${manifestUpload}` : undefined
            ].filter(Boolean) as string[]
            setPendingDeploy({
                spec,
                steps: [
                    { specs: [...deployPlaceholderSpecs, spec], taskIndex: 1 },
                    { specs: [...manifestPlaceholderSpecs, manifestSpec], taskIndex: 2 },
                    invalidateStep
                ],
                targetLabel: 'Frontend',
                version: currentManifest.frontend.version,
                remoteVersion: backendManifest?.frontend?.version ?? 'unknown',
                uploads: uploads.length > 0 ? uploads : undefined,
                type: 'frontend'
            })
            setMode('confirm-deploy')
            setStatus(formatStatus('Confirm frontend deploy'))
        })()
    }

    const queueGameDeploy = (packageId: string, currentManifest: SiteManifest) => {
        void (async () => {
            if (!ensureNoRunningCommand('Deploy')) {
                return
            }
            const localEntry = currentManifest.games.find(
                (game) => game.packageId === packageId
            )
            if (!localEntry) {
                setStatus(formatStatus(`Missing manifest entry for ${packageId}`, 'error'))
                return
            }
            const remoteEntry = backendManifest?.games?.find(
                (game) => game.packageId === packageId
            )
            const logicMatches =
                remoteEntry?.logicVersion != null &&
                remoteEntry.logicVersion === localEntry.logicVersion
            const uiMatches =
                remoteEntry?.uiVersion != null && remoteEntry.uiVersion === localEntry.uiVersion
            const deployUiOnly = logicMatches && !uiMatches
            const deployVersionLabel = deployUiOnly
                ? `ui ${localEntry.uiVersion}`
                : `logic ${localEntry.logicVersion} / ui ${localEntry.uiVersion}`
            setActiveDeployContext({
                type: 'game',
                label: `Game (${localEntry.gameId})`,
                gameId: localEntry.gameId,
                version: deployVersionLabel
            })
            const deployManifestSpec = deployManifestCommand(manifestPath, deployConfig)
            const manifestUpload = describeUpload(deployManifestSpec)

            if (!deployUiOnly) {
                startTasks(`Game deploy (${localEntry.gameId})`, [
                    'Build logic',
                    'Bundle logic',
                    'Build UI',
                    'Bundle UI',
                    'Deploy logic + UI',
                    'Deploy manifest',
                    'Invalidate manifest cache'
                ])
                const buildLogicSpec = buildGameLogicPackageCommand(repoRoot, packageId)
                if (!(await runTask(0, buildLogicSpec))) return
                const bundleLogicSpec = buildGameLogicCommand(repoRoot, packageId)
                if (!(await runTask(1, bundleLogicSpec))) return
                const buildUiSpec = buildGameUiPackageCommand(repoRoot, packageId)
                if (!(await runTask(2, buildUiSpec))) return
                const bundleUiSpec = buildGameUiCommand(repoRoot, packageId)
                if (!(await runTask(3, bundleUiSpec))) return
                const deployLogicSpec = deployGameLogicCommand(
                    repoRoot,
                    currentManifest,
                    packageId,
                    deployConfig
                )
                const deployUiSpec = deployGameUiCommand(
                    repoRoot,
                    currentManifest,
                    packageId,
                    deployConfig
                )
                const logicPlaceholderSpecs = directoryPlaceholderSpecs(deployLogicSpec)
                const uiPlaceholderSpecs = directoryPlaceholderSpecs(deployUiSpec)
                const manifestPlaceholderSpecs = directoryPlaceholderSpecs(deployManifestSpec)
                const invalidateStep: DeployStep = {
                    action: invalidateManifestCache,
                    label: 'invalidate-manifest',
                    logPath: manifestInvalidateLogPath,
                    taskIndex: 6
                }
                const logicUpload = describeUpload(deployLogicSpec)
                const uiUpload = describeUpload(deployUiSpec)
                const uploads = [
                    logicUpload ? `logic: ${logicUpload}` : undefined,
                    uiUpload ? `ui: ${uiUpload}` : undefined,
                    manifestUpload ? `manifest: ${manifestUpload}` : undefined
                ].filter(Boolean) as string[]
                setPendingDeploy({
                    spec: deployLogicSpec,
                    steps: [
                        {
                            specs: dedupeCommandSpecs([
                                ...logicPlaceholderSpecs,
                                ...uiPlaceholderSpecs,
                                deployLogicSpec,
                                deployUiSpec
                            ]),
                            taskIndex: 4
                        },
                        { specs: [...manifestPlaceholderSpecs, deployManifestSpec], taskIndex: 5 },
                        invalidateStep
                    ],
                    targetLabel: `Game (${localEntry.gameId})`,
                    version: deployVersionLabel,
                    remoteVersion: remoteEntry
                        ? `logic ${remoteEntry.logicVersion} / ui ${remoteEntry.uiVersion}`
                        : 'unknown',
                    uploads: uploads.length > 0 ? uploads : undefined,
                    type: 'game',
                    packageId,
                    gameId: localEntry.gameId
                })
            } else {
                startTasks(`Game deploy (${localEntry.gameId})`, [
                    'Build UI',
                    'Bundle UI',
                    'Deploy UI',
                    'Deploy manifest',
                    'Invalidate manifest cache'
                ])
                const buildUiSpec = buildGameUiPackageCommand(repoRoot, packageId)
                if (!(await runTask(0, buildUiSpec))) return
                const bundleUiSpec = buildGameUiCommand(repoRoot, packageId)
                if (!(await runTask(1, bundleUiSpec))) return
                const deployUiSpec = deployGameUiCommand(
                    repoRoot,
                    currentManifest,
                    packageId,
                    deployConfig
                )
                const uiPlaceholderSpecs = directoryPlaceholderSpecs(deployUiSpec)
                const manifestPlaceholderSpecs = directoryPlaceholderSpecs(deployManifestSpec)
                const invalidateStep: DeployStep = {
                    action: invalidateManifestCache,
                    label: 'invalidate-manifest',
                    logPath: manifestInvalidateLogPath,
                    taskIndex: 4
                }
                const uiUpload = describeUpload(deployUiSpec)
                const uploads = [
                    uiUpload ? `ui: ${uiUpload}` : undefined,
                    manifestUpload ? `manifest: ${manifestUpload}` : undefined
                ].filter(Boolean) as string[]
                setPendingDeploy({
                    spec: deployUiSpec,
                    steps: [
                        { specs: [...uiPlaceholderSpecs, deployUiSpec], taskIndex: 2 },
                        { specs: [...manifestPlaceholderSpecs, deployManifestSpec], taskIndex: 3 },
                        invalidateStep
                    ],
                    targetLabel: `Game (${localEntry.gameId})`,
                    version: deployVersionLabel,
                    remoteVersion: remoteEntry
                        ? `logic ${remoteEntry.logicVersion} / ui ${remoteEntry.uiVersion}`
                        : 'unknown',
                    uploads: uploads.length > 0 ? uploads : undefined,
                    type: 'game',
                    packageId,
                    gameId: localEntry.gameId
                })
            }

            setMode('confirm-deploy')
            setStatus(formatStatus(`Confirm ${localEntry.gameId} deploy`))
        })()
    }

    const queueAllGamesDeploy = (currentManifest: SiteManifest) => {
        void (async () => {
            if (!ensureNoRunningCommand('Deploy')) {
                return
            }
            const loadedManifest = await readManifest(manifestPath)
            const { manifest: syncedManifest, changed } = await syncManifestFromPackages(
                repoRoot,
                loadedManifest
            )
            if (changed) {
                await writeManifest(manifestPath, syncedManifest)
            }
            setManifest(syncedManifest)
            const gamePackages = syncedManifest.games.map((game) => game.packageId)
            if (gamePackages.length === 0) {
                setStatus(formatStatus('No games available to deploy', 'error'))
                return
            }
            setActiveDeployContext({
                type: 'games',
                label: 'All games',
                version: `logic + ui (${gamePackages.length} games)`
            })
            startTasks('All games deploy', [
                'Build logic (all)',
                'Bundle logic (all)',
                'Build UI (all)',
                'Bundle UI (all)',
                'Deploy logic + UI (all)',
                'Deploy manifest',
                'Invalidate manifest cache'
            ])
            const buildLogicSpecs = gamePackages.map((packageId) =>
                buildGameLogicPackageCommand(repoRoot, packageId)
            )
            if (!(await runTaskGroup(0, buildLogicSpecs))) return
            const bundleLogicSpecs = gamePackages.map((packageId) =>
                buildGameLogicCommand(repoRoot, packageId)
            )
            if (!(await runTaskGroup(1, bundleLogicSpecs))) return
            const buildUiSpecs = gamePackages.map((packageId) =>
                buildGameUiPackageCommand(repoRoot, packageId)
            )
            if (!(await runTaskGroup(2, buildUiSpecs))) return
            const bundleUiSpecs = gamePackages.map((packageId) =>
                buildGameUiCommand(repoRoot, packageId)
            )
            if (!(await runTaskGroup(3, bundleUiSpecs))) return

            const deployLogicSpecs = gamePackages.map((packageId) =>
                deployGameLogicCommand(repoRoot, syncedManifest, packageId, deployConfig)
            )
            const deployUiSpecs = gamePackages.map((packageId) =>
                deployGameUiCommand(repoRoot, syncedManifest, packageId, deployConfig)
            )
            const deploySpecs = [...deployLogicSpecs, ...deployUiSpecs]
            const deployPlaceholderSpecs = dedupeCommandSpecs(
                deploySpecs.flatMap((spec) => directoryPlaceholderSpecs(spec))
            )
            const deployManifestSpec = deployManifestCommand(manifestPath, deployConfig)
            const manifestPlaceholderSpecs = directoryPlaceholderSpecs(deployManifestSpec)
            const manifestUpload = describeUpload(deployManifestSpec)
            const invalidateStep: DeployStep = {
                action: invalidateManifestCache,
                label: 'invalidate-manifest',
                logPath: manifestInvalidateLogPath,
                taskIndex: 6
            }
            const uploads = [
                `games: ${gamePackages.length}`,
                manifestUpload ? `manifest: ${manifestUpload}` : undefined
            ].filter(Boolean) as string[]
            setPendingDeploy({
                spec: deploySpecs[0],
                steps: [
                    { specs: [...deployPlaceholderSpecs, ...deploySpecs], taskIndex: 4 },
                    { specs: [...manifestPlaceholderSpecs, deployManifestSpec], taskIndex: 5 },
                    invalidateStep
                ],
                targetLabel: 'All games',
                version: `logic + ui (${gamePackages.length} games)`,
                remoteVersion: backendManifest ? 'varies' : 'unknown',
                uploads: uploads.length > 0 ? uploads : undefined,
                type: 'games'
            })
            setMode('confirm-deploy')
            setStatus(formatStatus('Confirm all games deploy'))
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
                for (const entry of syncedManifest.games) {
                    const previousEntry = manifest?.games.find(
                        (game) => game.packageId === entry.packageId
                    )
                    const versionChanged = previousEntry?.uiVersion !== entry.uiVersion
                    nextGames[entry.packageId] = versionChanged
                        ? null
                        : current.games[entry.packageId] ?? null
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
                    const exists = await checkFrontendDeployed(manifest, deployConfig, staticRoot)
                    setGcsStatus((current) => ({ ...current, frontendExists: exists }))
                } finally {
                    setCheckingGcsTarget((current) => (current === targetKey ? null : current))
                }
            })()
            return
        }

        if (selected.type === 'game' && selected.packageId) {
            const packageId = selected.packageId
            if (checkingGcsTarget === `game:${packageId}`) return
            const currentStatus = gcsStatus.games[packageId]
            if (currentStatus !== null && currentStatus !== undefined) return
            const targetKey = `game:${packageId}`
            setCheckingGcsTarget(targetKey)
            void (async () => {
                try {
                    const exists = await checkGameDeployed(
                        manifest,
                        packageId,
                        deployConfig,
                        staticRoot
                    )
                    setGcsStatus((current) => ({
                        ...current,
                        games: { ...current.games, [packageId]: exists }
                    }))
                } finally {
                    setCheckingGcsTarget((current) => (current === targetKey ? null : current))
                }
            })()
        }
    }, [
        checkingGcsTarget,
        deployConfig,
        staticRoot,
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
            let postBump: PendingPostBump | null = null
            if (target === 'frontend') {
                const path = getFrontendPackagePath(repoRoot)
                const current = await readPackageVersion(path)
                const next = bumpVersion(current, bump)
                await writePackageVersion(path, next)
                statusMessage = `Frontend bumped to ${next} (${bump})`
                postBump = {
                    targetLabel: 'Frontend',
                    onConfirm: () => queueFrontendDeploy(manifest)
                }
            }

            if (target === 'logic' && selectedGame) {
                const paths = getGamePackagePaths(repoRoot, selectedGame.packageId)
                const currentLogic = await readPackageVersion(paths.logic)
                const nextLogic = bumpVersion(currentLogic, bump)
                const currentUi = await readPackageVersion(paths.ui)
                const nextUi = bumpVersion(currentUi, bump)
                await writePackageVersion(paths.logic, nextLogic)
                await writePackageVersion(paths.ui, nextUi)
                statusMessage = `Logic bumped to ${nextLogic} (${bump}); UI bumped to ${nextUi} (${bump})`
                postBump = {
                    targetLabel: `Game (${selectedGame.gameId})`,
                    onConfirm: () => queueGameDeploy(selectedGame.packageId, manifest)
                }
            }

            if (target === 'ui' && selectedGame) {
                const paths = getGamePackagePaths(repoRoot, selectedGame.packageId)
                const currentUi = await readPackageVersion(paths.ui)
                const nextUi = bumpVersion(currentUi, bump)
                await writePackageVersion(paths.ui, nextUi)
                statusMessage = `UI bumped to ${nextUi} (${bump})`
                postBump = {
                    targetLabel: `Game (${selectedGame.gameId})`,
                    onConfirm: () => queueGameDeploy(selectedGame.packageId, manifest)
                }
            }

            const { manifest: syncedManifest, changed } = await syncManifestFromPackages(
                repoRoot,
                manifest
            )
            if (changed) {
                await writeManifest(manifestPath, syncedManifest)
            }
            setStatus(formatStatus(statusMessage || 'Version bumped'))
            if (postBump) {
                postBump.onConfirm = () => {
                    if (target === 'frontend') {
                        queueFrontendDeploy(syncedManifest)
                        return
                    }
                    if (selectedGame) {
                        queueGameDeploy(selectedGame.packageId, syncedManifest)
                    }
                }
                setPendingPostBump(postBump)
                setMode('confirm-post-bump')
            } else {
                setMode('view')
            }
        } catch (error) {
            setStatus(
                formatStatus(
                    error instanceof Error ? error.message : 'Failed to bump versions',
                    'error'
                )
            )
            setMode('view')
        }
        await refresh(true)
    }

    const resetMismatchedVersions = async (): Promise<boolean> => {
        if (!backendManifest) {
            setStatus(formatStatus('Serving info not loaded', 'error'))
            return false
        }
        if (!manifest) {
            setStatus(formatStatus('Manifest not loaded', 'error'))
            return false
        }
        try {
            if (mismatchState.frontend) {
                await writePackageVersion(
                    getFrontendPackagePath(repoRoot),
                    mismatchState.frontend.remote
                )
            }
            for (const game of mismatchState.games) {
                const paths = getGamePackagePaths(repoRoot, game.packageId)
                await writePackageVersion(paths.logic, game.remoteLogic)
                await writePackageVersion(paths.ui, game.remoteUi)
            }
            const { manifest: syncedManifest, changed } = await syncManifestFromPackages(
                repoRoot,
                manifest
            )
            if (changed) {
                await writeManifest(manifestPath, syncedManifest)
            }
            setManifest(syncedManifest)
            await refresh(true)
            return true
        } catch (error) {
            setStatus(
                formatStatus(
                    error instanceof Error ? error.message : 'Failed to reset mismatches',
                    'error'
                )
            )
            return false
        }
    }

    const handleDeploy = async () => {
        if (!selected) return

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
            setBackendDeployTarget('backend')
            setPendingBackendDeploy({
                onConfirm: (target) => queueBackendDeploy(target, image)
            })
            setMode('select-backend-service')
            setStatus(formatStatus('Select backend service'))
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
            const packageId = selected.packageId
            if (!packageId) return
            const localEntry = currentManifest.games.find(
                (game) => game.packageId === packageId
            )
            if (!localEntry) {
                setStatus(formatStatus(`Missing manifest entry for ${packageId}`, 'error'))
                return
            }
            const localVersion = localEntry.uiVersion
            const remoteVersion = backendManifest?.games?.find(
                (game) => game.packageId === packageId
            )?.uiVersion
            if (remoteVersion && remoteVersion === localVersion) {
                setPendingOverwrite({
                    targetLabel: `Game UI (${localEntry.gameId})`,
                    version: localVersion,
                    remoteVersion,
                    onConfirm: () => queueGameDeploy(packageId, currentManifest)
                })
                setMode('confirm-overwrite')
                setStatus(formatStatus('Confirm overwrite'))
                return
            }
            queueGameDeploy(packageId, currentManifest)
            return
        }

        if (selected.type === 'games') {
            setPendingDeployAll({
                gameCount: currentManifest.games.length,
                onConfirm: () => queueAllGamesDeploy(currentManifest)
            })
            setMode('confirm-deploy-all')
            setStatus(formatStatus('Confirm deploy all games'))
        }
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
            } else if (selected.type === 'game' && selected.packageId) {
                const servedGame = backendManifest.games?.find(
                    (game) => game.packageId === selected.packageId
                )
                if (!servedGame?.logicVersion || !servedGame?.uiVersion) {
                    setStatus(
                        formatStatus(
                            `Serving versions for ${selected.gameId ?? selected.packageId} are unknown`,
                            'error'
                        )
                    )
                    return
                }
                const paths = getGamePackagePaths(repoRoot, selected.packageId)
                await writePackageVersion(paths.logic, servedGame.logicVersion)
                await writePackageVersion(paths.ui, servedGame.uiVersion)
                setStatus(
                    formatStatus(
                        `${selected.gameId ?? selected.packageId} reverted to logic ${servedGame.logicVersion} / ui ${servedGame.uiVersion}`
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
        if (commandRunningRef.current) {
            setStatus(formatStatus('Command already running', 'error'))
            return false
        }
        commandRunningRef.current = true
        cancelRequestedRef.current = false
        setIsBusy(true)
        setOutputHold(false)
        setOutputScroll(0)
        setRunningLabel(label)
        setRunningLogPath(logPath ?? null)
        setOutputBuffer('')
        setStatus(formatStatus(`Running ${label}... ${logPath ? `(${logPath})` : ''}`))
        let failed = false
        let cancelled = false
        try {
            await action()
            if (!cancelRequestedRef.current) {
                setStatus(formatStatus(`Finished ${label}. ${logPath ? `Log: ${logPath}` : ''}`))
            } else {
                cancelled = true
            }
        } catch (error) {
            cancelled = cancelRequestedRef.current
            if (cancelled) {
                setStatus(formatStatus('Command cancelled'))
            } else {
                failed = true
                setOutputHold(true)
                setStatus(
                    formatStatus(
                        error instanceof Error ? error.message : `${label} failed`,
                        'error'
                    )
                )
            }
        } finally {
            setIsBusy(false)
            commandRunningRef.current = false
            if (!failed || cancelled) {
                setRunningLabel(null)
                setRunningLogPath(null)
            }
            runningChildRef.current = null
            cancelRequestedRef.current = false
            await refresh(true)
        }
        return !failed && !cancelled
    }

    const runSpec = (spec: CommandSpec) =>
        runWithStatus(
            () =>
                runCommand(spec, {
                    onOutput: appendOutput,
                    onSpawn: (child) => {
                        runningChildRef.current = child
                    }
                }),
            spec.label,
            spec.logPath
        )

    const runAction = (action: (signal: AbortSignal) => Promise<void>, label: string, logPath?: string) => {
        const controller = new AbortController()
        runningAbortRef.current = controller
        return runWithStatus(() => action(controller.signal), label, logPath).finally(() => {
            runningAbortRef.current = null
        })
    }

    const runTask = async (index: number, spec: CommandSpec) => {
        updateTaskStatus(index, 'running')
        const ok = await runSpec(spec)
        updateTaskStatus(index, ok ? 'success' : 'failed')
        return ok
    }

    const runActionTask = async (
        index: number,
        action: (signal: AbortSignal) => Promise<void>,
        label: string,
        logPath?: string
    ) => {
        updateTaskStatus(index, 'running')
        const ok = await runAction(action, label, logPath)
        updateTaskStatus(index, ok ? 'success' : 'failed')
        return ok
    }

    const runTaskGroup = async (index: number, specs: CommandSpec[]) => {
        updateTaskStatus(index, 'running')
        for (const spec of specs) {
            const ok = await runSpec(spec)
            if (!ok) {
                updateTaskStatus(index, 'failed')
                return false
            }
        }
        updateTaskStatus(index, 'success')
        return true
    }

    const runDeploySpec = async (
        spec: CommandSpec,
        taskIndex?: number,
        options?: { clearTasks?: boolean }
    ) => {
        const ok = taskIndex == null ? await runSpec(spec) : await runTask(taskIndex, spec)
        if (ok && options?.clearTasks !== false) {
            setTaskState(null)
        }
        return ok
    }

    const runSpecs = async (specs: CommandSpec[]) => {
        for (const spec of specs) {
            const ok = await runSpec(spec)
            if (!ok) return false
        }
        return true
    }

    const runDeployGroup = async (
        specs: CommandSpec[],
        taskIndex?: number,
        options?: { clearTasks?: boolean }
    ) => {
        const ok =
            taskIndex == null ? await runSpecs(specs) : await runTaskGroup(taskIndex, specs)
        if (ok && options?.clearTasks !== false) {
            setTaskState(null)
        }
        return ok
    }

    const runDeploySteps = async (steps: DeployStep[]) => {
        for (let index = 0; index < steps.length; index += 1) {
            const step = steps[index]
            const clearTasks = index === steps.length - 1
            const ok = step.action
                ? step.taskIndex == null
                    ? await runAction(step.action, step.label ?? 'action', step.logPath)
                    : await runActionTask(
                          step.taskIndex,
                          step.action,
                          step.label ?? 'action',
                          step.logPath
                      )
                : step.specs && step.specs.length > 0
                  ? await runDeployGroup(step.specs, step.taskIndex, { clearTasks })
                  : step.spec
                    ? await runDeploySpec(step.spec, step.taskIndex, { clearTasks })
                    : true
            if (!ok) {
                return false
            }
            if (ok && clearTasks && step.action) {
                setTaskState(null)
            }
        }
        return true
    }

    useInput((input, key) => {
        if (mode === 'select-backend-service' && pendingBackendDeploy) {
            if (key.escape) {
                setMode('view')
                setPendingBackendDeploy(null)
                setStatus(formatStatus('Deploy cancelled'))
                return
            }

            if (key.upArrow || key.leftArrow) {
                setBackendDeployTarget((current) =>
                    current === 'tasks' ? 'backend' : current === 'all' ? 'tasks' : 'backend'
                )
                return
            }

            if (key.downArrow || key.rightArrow) {
                setBackendDeployTarget((current) =>
                    current === 'backend' ? 'tasks' : current === 'tasks' ? 'all' : 'all'
                )
                return
            }

            if (input === 'b' || input === 'B') {
                setMode('view')
                setPendingBackendDeploy(null)
                setBackendDeployTarget('backend')
                pendingBackendDeploy.onConfirm('backend')
                return
            }

            if (input === 't' || input === 'T') {
                setMode('view')
                setPendingBackendDeploy(null)
                setBackendDeployTarget('tasks')
                pendingBackendDeploy.onConfirm('tasks')
                return
            }

            if (input === 'a' || input === 'A') {
                setMode('view')
                setPendingBackendDeploy(null)
                setBackendDeployTarget('all')
                pendingBackendDeploy.onConfirm('all')
                return
            }

            if (key.return) {
                const target = backendDeployTarget
                setMode('view')
                setPendingBackendDeploy(null)
                pendingBackendDeploy.onConfirm(target)
                return
            }

            return
        }

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

        if (mode === 'confirm-post-bump' && pendingPostBump) {
            if (key.escape) {
                setMode('view')
                setPendingPostBump(null)
                setStatus(formatStatus('Deploy skipped'))
                return
            }

            if (input === 'y' || input === 'Y' || key.return) {
                const action = pendingPostBump.onConfirm
                setMode('view')
                setPendingPostBump(null)
                action()
                return
            }

            if (input === 'n' || input === 'N') {
                setMode('view')
                setPendingPostBump(null)
                setStatus(formatStatus('Deploy skipped'))
                return
            }

            return
        }

        if (mode === 'confirm-reset-mismatch' && pendingMismatchReset) {
            if (key.escape) {
                setMode('view')
                setPendingMismatchReset(null)
                setStatus(formatStatus('Deploy cancelled'))
                return
            }

            if (input === 'y' || input === 'Y' || key.return) {
                const action = pendingMismatchReset.onConfirm
                setMode('view')
                setPendingMismatchReset(null)
                action()
                return
            }

            if (input === 'n' || input === 'N') {
                setMode('view')
                setPendingMismatchReset(null)
                setStatus(formatStatus('Deploy cancelled'))
                return
            }

            return
        }

        if (mode === 'confirm-deploy-all' && pendingDeployAll) {
            if (key.escape) {
                setMode('view')
                setPendingDeployAll(null)
                setStatus(formatStatus('Deploy cancelled'))
                return
            }

            if (input === 'y' || input === 'Y' || key.return) {
                const action = pendingDeployAll.onConfirm
                setMode('view')
                setPendingDeployAll(null)
                action()
                return
            }

            if (input === 'n' || input === 'N') {
                setMode('view')
                setPendingDeployAll(null)
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
                setActiveDeployContext(null)
                setStatus(formatStatus('Deploy cancelled'))
                return
            }

            if (pendingDeploy.type === 'backend') {
                const runBackendDeploy = (withTraffic: boolean) => {
                    setMode('view')
                    const target = pendingDeploy
                    setPendingDeploy(null)
                    const steps = resolveDeploySteps(target, { withTraffic })
                    if (steps.length === 0) {
                        setStatus(formatStatus('Missing backend deploy command', 'error'))
                        return
                    }
                    void (async () => {
                        await runDeploySteps(steps)
                    })()
                }

                if (input === 'y' || input === 'Y') {
                    runBackendDeploy(true)
                    return
                }

                if (input === 'n' || input === 'N' || key.return) {
                    runBackendDeploy(false)
                    return
                }

                return
            }

            if (input === 'y' || input === 'Y' || key.return) {
                setMode('view')
                const target = pendingDeploy
                setPendingDeploy(null)
                void (async () => {
                    setActiveDeployContext({
                        type: target.type,
                        label: target.targetLabel,
                        version: target.version,
                        gameId: target.gameId
                    })
                    const steps = resolveDeploySteps(target)
                    const ok = await runDeploySteps(steps)
                    setActiveDeployContext(null)
                    if (!ok) return
                    if (target.type === 'frontend') {
                        await refreshFrontendDeployed()
                    } else if (target.type === 'game' && target.packageId) {
                        await refreshGameDeployed(target.packageId)
                    } else if (target.type === 'games') {
                        for (const entry of manifest?.games ?? []) {
                            await refreshGameDeployed(entry.packageId)
                        }
                    }
                })()
                return
            }

            if (input === 'n' || input === 'N') {
                setMode('view')
                setPendingDeploy(null)
                setTaskState(null)
                setActiveDeployContext(null)
                setStatus(formatStatus('Deploy cancelled'))
                return
            }

            return
        }

        if (mode === 'bump-game-target') {
            if (key.escape) {
                setMode('view')
                return
            }
            if (input === 'l' || input === 'L') {
                setMode('bump-logic')
                return
            }
            if (input === 'u' || input === 'U') {
                setMode('bump-ui')
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

        if (outputActive || taskActive) {
            if (key.escape) {
                cancelRunningCommand()
                return
            }
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
                setActiveDeployContext(null)
            }
            return
        }

        if (input === 'q' || key.escape) {
            exit()
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

        if (input === 'i') {
            if (!canInvalidateManifest) return
            if (!ensureNoRunningCommand('Invalidate manifest cache')) return
            void runAction(
                invalidateManifestCache,
                'Invalidate manifest cache',
                manifestInvalidateLogPath
            )
            return
        }

        if (!selected) return

        if (input === 'v') {
            if (selected?.type === 'frontend') {
                if (!canBumpFrontend) return
                const currentManifest = requireManifest('Bump frontend version')
                if (!currentManifest) return
                setMode('bump-frontend')
                return
            }
            if (selected?.type === 'game') {
                if (!canBumpGame) return
                setMode('bump-game-target')
            }
            return
        }

        if (input === 'k') {
            if (!canRollback) return
            setInputValue('')
            setMode('rollback')
            return
        }

        if (input === 's') {
            if (!canUseServing) return
            void handleRevertToServing()
            return
        }

        if (input === 'd') {
            if (!canDeploy) return
            if (!ensureNoRunningCommand('Deploy')) return
            const mismatchesExist =
                !!mismatchState.frontend || mismatchState.games.length > 0
            const selectedIsMismatchedGame =
                selected.type === 'game' &&
                selected.packageId &&
                mismatchedGamePackages.has(selected.packageId)
            const allowAllGames =
                selected.type === 'games' &&
                !mismatchState.frontend &&
                mismatchState.games.length > 1
            const mismatchBlocks =
                (mismatchState.frontend && selected.type !== 'frontend') ||
                (!mismatchState.frontend &&
                    mismatchState.games.length > 0 &&
                    !selectedIsMismatchedGame &&
                    !allowAllGames)
            if (mismatchesExist && mismatchBlocks) {
                const details: string[] = []
                if (mismatchState.frontend) {
                    details.push(
                        `frontend: local ${mismatchState.frontend.local} / serving ${mismatchState.frontend.remote}`
                    )
                }
                for (const game of mismatchState.games) {
                    details.push(
                        `${game.gameId}: local ${game.localLogic}/${game.localUi} / serving ${game.remoteLogic}/${game.remoteUi}`
                    )
                }
                setPendingMismatchReset({
                    details,
                    onConfirm: () => {
                        void (async () => {
                            const ok = await resetMismatchedVersions()
                            if (!ok) return
                            if (!ensureNoRunningCommand('Deploy')) return
                            void handleDeploy()
                        })()
                    }
                })
                setMode('confirm-reset-mismatch')
                setStatus(formatStatus('Resolve mismatched versions'))
                return
            }
            void handleDeploy()
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
                        const packageId = item.packageId ?? ''
                        const isAllGames = item.type === 'games'
                        const localGame = isAllGames
                            ? null
                            : manifest?.games.find((game) => game.packageId === packageId)
                        const servedGame = isAllGames
                            ? null
                            : backendManifest?.games?.find((game) => game.packageId === packageId)
                        const serveMismatch =
                            servedGame && localGame
                                ? servedGame.logicVersion !== localGame.logicVersion ||
                                  servedGame.uiVersion !== localGame.uiVersion
                                : false
                        const deployedKnown =
                            !isAllGames &&
                            gcsStatus.games[packageId] !== null &&
                            gcsStatus.games[packageId] !== undefined
                        const deployedMissing = deployedKnown && gcsStatus.games[packageId] === false
                        const warn = !isAllGames && (serveMismatch || deployedMissing)
                        const itemColor =
                            selectionIndex === selectedIndex ? 'cyan' : warn ? 'red' : undefined
                        const indicator = isAllGames
                            ? ''
                            : warn
                              ? '✗'
                              : formatIndicator(
                                    gcsStatus.games[packageId],
                                    checkingGcsTarget === `game:${packageId}`
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
                    ) : mode === 'confirm-reset-mismatch' && pendingMismatchReset ? (
                        <Box flexDirection="column" borderStyle="round" paddingX={1} paddingY={1}>
                            <Text color="magenta">Resolve mismatches</Text>
                            {pendingMismatchReset.details.map((detail, index) => (
                                <Text key={`mismatch-${index}`} color="gray">
                                    {detail}
                                </Text>
                            ))}
                            <Text color="yellow">Reset to serving versions?</Text>
                        </Box>
                    ) : mode === 'confirm-post-bump' && pendingPostBump ? (
                        <Box flexDirection="column" borderStyle="round" paddingX={1} paddingY={1}>
                            <Text color="magenta">Deploy now?</Text>
                            <Text color="gray">target: {pendingPostBump.targetLabel}</Text>
                            <Text color="yellow">Start deploy workflow for this target?</Text>
                        </Box>
                    ) : mode === 'confirm-deploy-all' && pendingDeployAll ? (
                        <Box flexDirection="column" borderStyle="round" paddingX={1} paddingY={1}>
                            <Text color="magenta">Deploy all games?</Text>
                            <Text color="gray">
                                target: all games ({pendingDeployAll.gameCount})
                            </Text>
                            <Text color="yellow">
                                Build/bundle and deploy every game package?
                            </Text>
                        </Box>
                    ) : mode === 'select-backend-service' && pendingBackendDeploy ? (
                        <Box flexDirection="column" borderStyle="round" paddingX={1} paddingY={1}>
                            <Text color="magenta">Deploy which service?</Text>
                            <Text color={backendDeployTarget === 'backend' ? 'cyan' : 'gray'}>
                                • backend (default)
                            </Text>
                            <Text color={backendDeployTarget === 'tasks' ? 'cyan' : 'gray'}>
                                • tasks
                            </Text>
                            <Text color={backendDeployTarget === 'all' ? 'cyan' : 'gray'}>
                                • all
                            </Text>
                            <Text color="yellow">
                                b = backend, t = tasks, a = all, Enter = deploy selected, Esc cancel
                            </Text>
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
                            ) : selectedAllGames ? (
                                <>
                                    <Text>local: {games.length} games</Text>
                                    <Text color="gray">
                                        {checkingBackend
                                            ? 'serving: checking...'
                                            : backendManifest
                                              ? `serving: ${backendManifest.games?.length ?? 0} games`
                                              : 'serving: unknown'}
                                    </Text>
                                    <Text color="gray">deployed: n/a</Text>
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
                ) : mode === 'confirm-reset-mismatch' ? (
                    <Text color="yellow">Resolve mismatches in the right panel</Text>
                ) : mode === 'confirm-post-bump' ? (
                    <Text color="yellow">Confirm deploy in the right panel</Text>
                ) : mode === 'confirm-deploy-all' ? (
                    <Text color="yellow">Confirm all-game deploy in the modal</Text>
                ) : mode === 'confirm-deploy' ? (
                    <Text color="yellow">Confirm deploy details in the modal</Text>
                ) : (
                    <Box gap={1}>
                        <Text color="yellow">
                            {mode === 'bump-frontend'
                                ? 'Bump frontend version: 1=major 2=minor 3=patch'
                                : mode === 'bump-game-target'
                                  ? `Select game version to bump (${selectedGame?.gameId ?? selectedGame?.packageId ?? ''}): l=logic u=ui`
                                : mode === 'bump-logic'
                                  ? `Bump logic version (${selectedGame?.gameId ?? selectedGame?.packageId ?? ''}): 1=major 2=minor 3=patch`
                                  : mode === 'bump-ui'
                                    ? `Bump UI version (${selectedGame?.gameId ?? selectedGame?.packageId ?? ''}): 1=major 2=minor 3=patch`
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
                        {confirmDeployAllActive && pendingDeployAll ? (
                            <>
                                <Text color="magenta" wrap="truncate">
                                    Confirm deploy all games
                                </Text>
                                <Box
                                    flexDirection="column"
                                    height={confirmContentLines}
                                    overflow="hidden"
                                >
                                    <Text color="gray">
                                        target: all games ({pendingDeployAll.gameCount})
                                    </Text>
                                    <Text color="gray">
                                        build/bundle: logic + ui for every game
                                    </Text>
                                    <Text color="yellow">y/Enter = deploy, n/Esc cancel</Text>
                                </Box>
                            </>
                        ) : confirmDeployActive && pendingDeploy ? (
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
                                        {pendingDeploy.uploads && pendingDeploy.uploads.length > 0
                                            ? pendingDeploy.uploads.map((upload, index) => (
                                                  <Text
                                                      key={`upload-${index}`}
                                                      color="gray"
                                                      wrap="wrap"
                                                  >
                                                      upload {index + 1}: {upload}
                                                  </Text>
                                              ))
                                            : null}
                                        {pendingDeploy.type === 'backend' ? (
                                            <>
                                                {confirmDeployCommands.length > 1
                                                    ? confirmDeployCommands.map((spec, index) => (
                                                          <Text
                                                              key={`backend-command-${index}`}
                                                              color="gray"
                                                              wrap="wrap"
                                                          >
                                                              command {index + 1}:{' '}
                                                              {commandString(spec)}
                                                          </Text>
                                                      ))
                                                    : (
                                                          <Text color="gray" wrap="wrap">
                                                              command:{' '}
                                                              {confirmDeployCommands[0]
                                                                  ? commandString(
                                                                        confirmDeployCommands[0]
                                                                    )
                                                                  : 'unknown'}
                                                          </Text>
                                                      )}
                                                {confirmDeployCommandsWithTraffic.length > 1
                                                    ? confirmDeployCommandsWithTraffic.map(
                                                          (spec, index) => (
                                                              <Text
                                                                  key={`backend-command-traffic-${index}`}
                                                                  color="gray"
                                                                  wrap="wrap"
                                                              >
                                                                  command (with traffic) {index + 1}:{' '}
                                                                  {commandString(spec)}
                                                              </Text>
                                                          )
                                                      )
                                                    : (
                                                          <Text color="gray" wrap="wrap">
                                                              command (with traffic):{' '}
                                                              {confirmDeployCommandsWithTraffic[0]
                                                                  ? commandString(
                                                                        confirmDeployCommandsWithTraffic[0]
                                                                    )
                                                                  : 'unknown'}
                                                          </Text>
                                                      )}
                                            </>
                                        ) : confirmDeployCommands.length > 1 ? (
                                            confirmDeployCommands.map((spec, index) => (
                                                <Text
                                                    key={`command-${index}`}
                                                    color="gray"
                                                    wrap="wrap"
                                                >
                                                    command {index + 1}: {commandString(spec)}
                                                </Text>
                                            ))
                                        ) : (
                                            <Text color="gray" wrap="wrap">
                                                command:{' '}
                                                {confirmDeployCommands[0]
                                                    ? commandString(confirmDeployCommands[0])
                                                    : 'unknown'}
                                            </Text>
                                        )}
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
                                    Deploying: {activeDeployLabel}
                                    {activeDeployVersion ? ` (${activeDeployVersion})` : ''} [
                                    {outputModeLabel}]
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

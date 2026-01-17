import React, { useEffect, useMemo, useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import { readManifest, writeManifest } from './lib/manifest.js'
import { fetchBackendManifest } from './lib/backend.js'
import { checkGcsStatus, GcsStatus } from './lib/gcs.js'
import { mergeEnvConfig, readDeployConfig } from './lib/config.js'
import {
    buildBackendCommand,
    buildFrontendCommand,
    buildGameUiCommand,
    deployBackendCommand,
    deployFrontendCommand,
    deployGameUiCommand,
    rollbackBackendCommand,
    runCommand
} from './lib/commands.js'
import { getDeployConfigPath, getGcsRoot, getManifestPath, getRepoRoot } from './lib/paths.js'
import { BackendManifest, DeployConfig, SiteManifest } from './lib/types.js'

type Mode =
    | 'view'
    | 'edit-frontend'
    | 'edit-logic'
    | 'edit-ui'
    | 'rollback'
    | 'confirm-backend-traffic'

type SelectionType = 'frontend' | 'backend' | 'game'

type Selection = {
    key: string
    type: SelectionType
    label: string
    gameId?: string
}

type StatusTone = 'info' | 'error'

const repoRoot = getRepoRoot()
const manifestPath = getManifestPath(repoRoot)
const deployConfigPath = getDeployConfigPath(repoRoot)
const gcsRoot = getGcsRoot()

const formatStatus = (message: string, tone: StatusTone = 'info') => ({ message, tone })

export default function App() {
    const { exit } = useApp()
    const [manifest, setManifest] = useState<SiteManifest | null>(null)
    const [backendManifest, setBackendManifest] = useState<BackendManifest | null>(null)
    const [backendError, setBackendError] = useState<string | null>(null)
    const [deployConfig, setDeployConfig] = useState<DeployConfig>({})
    const [gcsStatus, setGcsStatus] = useState<GcsStatus | null>(null)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [mode, setMode] = useState<Mode>('view')
    const [inputValue, setInputValue] = useState('')
    const [isBusy, setIsBusy] = useState(false)
    const [status, setStatus] = useState(() => formatStatus('Loading manifest...'))

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
    const commandHint = useMemo(() => {
        const commands = ['↑/↓ select', 'r reload', 'b build', 'd deploy']
        if (selected?.type === 'frontend') {
            commands.push('f edit-frontend')
        }
        if (selected?.type === 'backend') {
            commands.push('k rollback')
        }
        if (selected?.type === 'game') {
            commands.push('l edit-logic', 'u edit-ui')
        }
        commands.push('q quit')
        return commands.join('  ')
    }, [selected?.type])

    const refresh = async (silent = false) => {
        try {
            if (!silent) {
                setStatus(formatStatus('Loading manifest...'))
            }
            const loadedManifest = await readManifest(manifestPath)
            setManifest(loadedManifest)
            const config = mergeEnvConfig(await readDeployConfig(deployConfigPath))
            setDeployConfig(config)
            setGcsStatus(checkGcsStatus(loadedManifest, gcsRoot))
            const backendResult = await fetchBackendManifest(config.backendManifestUrl)
            setBackendManifest(backendResult.manifest ?? null)
            setBackendError(backendResult.error ?? null)
            if (!silent) {
                setStatus(formatStatus('Ready'))
            }
        } catch (error) {
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

    const setEditMode = (nextMode: Mode, value: string) => {
        setInputValue(value)
        setMode(nextMode)
    }

    const startBackendDeploy = (allowTraffic: boolean) => {
        const spec = deployBackendCommand(repoRoot, deployConfig, { allowTraffic })
        void runWithStatus(() => runCommand(spec), spec.label, spec.logPath)
    }

    const requireManifest = (action: string) => {
        if (manifest) return manifest
        setStatus(formatStatus(`${action} requires manifest loaded`, 'error'))
        return null
    }

    const runWithStatus = async (action: () => Promise<void>, label: string, logPath?: string) => {
        setIsBusy(true)
        setStatus(formatStatus(`Running ${label}... ${logPath ? `(${logPath})` : ''}`))
        try {
            await action()
            setStatus(formatStatus(`Finished ${label}. ${logPath ? `Log: ${logPath}` : ''}`))
        } catch (error) {
            setStatus(
                formatStatus(
                    error instanceof Error ? error.message : `${label} failed`,
                    'error'
                )
            )
        } finally {
            setIsBusy(false)
            await refresh(true)
        }
    }

    useInput((input, key) => {
        if (mode === 'confirm-backend-traffic') {
            if (key.escape) {
                setMode('view')
                setStatus(formatStatus('Deploy cancelled'))
                return
            }

            if (input === 'y' || input === 'Y') {
                setMode('view')
                startBackendDeploy(true)
                return
            }

            if (input === 'n' || input === 'N' || key.return) {
                setMode('view')
                startBackendDeploy(false)
                return
            }

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

        if (key.upArrow) {
            setSelectedIndex((index) => Math.max(0, index - 1))
            return
        }

        if (key.downArrow) {
            setSelectedIndex((index) => Math.min(selections.length - 1, index + 1))
            return
        }

        if (input === 'q' || key.escape) {
            exit()
            return
        }

        if (input === 'r') {
            void refresh()
            return
        }

        if (!selected || isBusy) return

        if (input === 'f') {
            const currentManifest = requireManifest('Edit frontend version')
            if (!currentManifest) return
            setEditMode('edit-frontend', currentManifest.frontend.version)
            return
        }

        if (input === 'l') {
            if (selected.type !== 'game' || !selectedGame) {
                setStatus(formatStatus('Select a game to edit logic', 'error'))
                return
            }
            setEditMode('edit-logic', selectedGame.logicVersion)
            return
        }

        if (input === 'u') {
            if (selected.type !== 'game' || !selectedGame) {
                setStatus(formatStatus('Select a game to edit UI version', 'error'))
                return
            }
            setEditMode('edit-ui', selectedGame.uiVersion)
            return
        }

        if (input === 'k') {
            if (selected.type !== 'backend') {
                setStatus(formatStatus('Select backend to rollback', 'error'))
                return
            }
            setEditMode('rollback', '')
            return
        }

        if (input === 'b') {
            if (selected.type === 'frontend') {
                const spec = buildFrontendCommand(repoRoot)
                void runWithStatus(() => runCommand(spec), spec.label, spec.logPath)
                return
            }
            if (selected.type === 'backend') {
                const spec = buildBackendCommand(repoRoot)
                void runWithStatus(() => runCommand(spec), spec.label, spec.logPath)
                return
            }
            if (selected.type === 'game' && selected.gameId) {
                const spec = buildGameUiCommand(repoRoot, selected.gameId)
                void runWithStatus(() => runCommand(spec), spec.label, spec.logPath)
            }
            return
        }

        if (input === 'd') {
            if (selected.type === 'backend') {
                setMode('confirm-backend-traffic')
                setStatus(formatStatus('Deploy backend with traffic? (y/N, Esc cancels)'))
                return
            }

            const currentManifest = requireManifest('Deploy')
            if (!currentManifest) return

            if (selected.type === 'frontend') {
                const spec = deployFrontendCommand(repoRoot, currentManifest, deployConfig)
                void runWithStatus(() => runCommand(spec), spec.label, spec.logPath)
                return
            }
            if (selected.type === 'game' && selected.gameId) {
                const spec = deployGameUiCommand(
                    repoRoot,
                    currentManifest,
                    selected.gameId,
                    deployConfig
                )
                void runWithStatus(() => runCommand(spec), spec.label, spec.logPath)
            }
            return
        }

    })

    const handleSubmit = async () => {
        if (mode === 'rollback') {
            if (!inputValue.trim()) {
                setStatus(formatStatus('Rollback requires a revision name', 'error'))
                setMode('view')
                return
            }
            const spec = rollbackBackendCommand(repoRoot, inputValue.trim(), deployConfig)
            void runWithStatus(() => runCommand(spec), spec.label, spec.logPath)
            setMode('view')
            return
        }

        if (!manifest) {
            setStatus(formatStatus('Manifest not loaded', 'error'))
            setMode('view')
            return
        }

        if ((mode === 'edit-logic' || mode === 'edit-ui') && !selectedGame) {
            setStatus(formatStatus('Select a game to edit versions', 'error'))
            setMode('view')
            return
        }

        const nextManifest = structuredClone(manifest)

        if (mode === 'edit-frontend') {
            nextManifest.frontend.version = inputValue.trim()
        }

        if (mode === 'edit-logic' && selectedGame) {
            const currentUi = nextManifest.games[selectedGame.id].uiVersion
            nextManifest.games[selectedGame.id].logicVersion = inputValue.trim()
            if (
                inputValue.trim() !== selectedGame.logicVersion &&
                currentUi === selectedGame.uiVersion
            ) {
                nextManifest.games[selectedGame.id].uiVersion = inputValue.trim()
                setStatus(
                    formatStatus(
                        `Logic bump detected; uiVersion bumped to ${inputValue.trim()}`
                    )
                )
            }
        }

        if (mode === 'edit-ui' && selectedGame) {
            nextManifest.games[selectedGame.id].uiVersion = inputValue.trim()
        }

        try {
            await writeManifest(manifestPath, nextManifest)
            setStatus(formatStatus('Manifest updated'))
        } catch (error) {
            setStatus(
                formatStatus(
                    error instanceof Error ? error.message : 'Failed to update manifest',
                    'error'
                )
            )
        }

        setMode('view')
        await refresh(true)
    }

    return (
        <Box flexDirection="column" gap={1}>
            <Box justifyContent="space-between">
                <Text color="cyan">Tabletop Deploy</Text>
                <Text>
                    Frontend: {manifest?.frontend.version ?? '...'}{' '}
                    {gcsStatus?.frontendExists ? '✓' : '✗'}
                </Text>
            </Box>
            <Box justifyContent="space-between">
                <Text color={backendError ? 'red' : 'gray'}>
                    Backend: {backendError ?? backendManifest?.backend?.revision ?? 'unknown'}
                </Text>
                <Text color="gray">GCS: {gcsRoot}</Text>
            </Box>
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
                                ? ` ${gcsStatus?.frontendExists ? '✓' : '✗'}`
                                : ''}
                        </Text>
                    ))}
                    <Text color="magenta">Games</Text>
                    {selections.slice(2).map((item, index) => {
                        const selectionIndex = index + 2
                        const gameId = item.gameId ?? ''
                        return (
                            <Text
                                key={`game-${item.key}`}
                                color={selectionIndex === selectedIndex ? 'cyan' : undefined}
                            >
                                {selectionIndex === selectedIndex ? '› ' : '  '}
                                {item.label} {gcsStatus?.games[gameId] ? '✓' : '✗'}
                            </Text>
                        )
                    })}
                </Box>
                <Box flexDirection="column" flexGrow={1}>
                    <Text color="magenta">Details</Text>
                    {selected?.type === 'frontend' ? (
                        <>
                            <Text>version: {manifest?.frontend.version ?? 'unknown'}</Text>
                            <Text color="gray">
                                gcs: {gcsStatus?.frontendExists ? 'present' : 'missing'}
                            </Text>
                            {backendManifest?.frontend?.version ? (
                                <Text color="gray">
                                    backend: {backendManifest.frontend.version}
                                </Text>
                            ) : null}
                        </>
                    ) : selected?.type === 'backend' ? (
                        <>
                            <Text>revision: {backendManifest?.backend?.revision ?? 'unknown'}</Text>
                            {backendManifest?.backend?.buildSha ? (
                                <Text color="gray">sha: {backendManifest.backend.buildSha}</Text>
                            ) : null}
                            {backendError ? (
                                <Text color="gray">error: {backendError}</Text>
                            ) : null}
                        </>
                    ) : selectedGame ? (
                        <>
                            <Text>logicVersion: {selectedGame.logicVersion}</Text>
                            <Text>uiVersion: {selectedGame.uiVersion}</Text>
                            {backendManifest?.games?.[selectedGame.id] ? (
                                <Text color="gray">
                                    backend: logic {backendManifest.games[selectedGame.id].logicVersion} / ui{' '}
                                    {backendManifest.games[selectedGame.id].uiVersion}
                                </Text>
                            ) : null}
                            <Text color="gray">
                                ui mount: {gcsStatus?.games[selectedGame.id] ? 'present' : 'missing'}
                            </Text>
                        </>
                    ) : (
                        <Text color="gray">No selection</Text>
                    )}
                </Box>
            </Box>
            <Box flexDirection="column">
                {mode === 'view' ? (
                    <Text color={status.tone === 'error' ? 'red' : 'green'}>
                        {status.message}
                    </Text>
                ) : mode === 'confirm-backend-traffic' ? (
                    <Text color="yellow">Deploy backend with traffic? (y/N, Esc cancels)</Text>
                ) : (
                    <Box gap={1}>
                        <Text color="yellow">
                            {mode === 'edit-frontend'
                                ? 'New frontend version:'
                                : mode === 'edit-logic'
                                  ? `New logic version (${selectedGame?.id ?? ''}):`
                                  : mode === 'edit-ui'
                                    ? `New UI version (${selectedGame?.id ?? ''}):`
                                    : 'Rollback to revision:'}
                        </Text>
                        <Text>{inputValue}</Text>
                    </Box>
                )}
                <Text color="gray">{commandHint}</Text>
            </Box>
        </Box>
    )
}

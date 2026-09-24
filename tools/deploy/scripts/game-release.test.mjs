import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { releaseGame } from '../esm/lib/gamePublish.js'
import { releaseFrontend } from '../esm/lib/frontendPublish.js'
import { releaseBackend } from '../esm/lib/backendPublish.js'
import {
    runBackendPreflight,
    runFrontendPreflight,
    runGamePreflight
} from '../esm/lib/releasePreflight.js'
import { assertCleanWorkingTree, tagsAtHead } from '../esm/lib/git.js'
import { logicReleaseTag, planGameVersionBump, uiReleaseTag } from '../esm/lib/versions.js'

const git = (cwd, ...args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

const writeJson = (filePath, data) =>
    writeFile(filePath, JSON.stringify(data, null, 4) + '\n', 'utf8')

const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'))

const createRepo = async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'tabletop-release-'))
    const repoRoot = path.join(root, 'repo')
    const originRoot = path.join(root, 'origin.git')
    await mkdir(repoRoot, { recursive: true })
    git(root, 'init', '--bare', originRoot)
    git(repoRoot, 'init', '-b', 'main')
    git(repoRoot, 'config', 'user.email', 'test@example.com')
    git(repoRoot, 'config', 'user.name', 'Test')
    git(repoRoot, 'remote', 'add', 'origin', originRoot)

    await mkdir(path.join(repoRoot, 'apps', 'frontend'), { recursive: true })
    await mkdir(path.join(repoRoot, 'games', 'sample'), { recursive: true })
    await mkdir(path.join(repoRoot, 'games', 'sample-ui'), { recursive: true })
    await mkdir(path.join(repoRoot, 'config', 'config-games', 'src'), { recursive: true })
    await mkdir(path.join(repoRoot, 'apps', 'backend'), { recursive: true })
    await mkdir(path.join(repoRoot, 'libs', 'shared'), { recursive: true })
    await mkdir(path.join(repoRoot, 'libs', 'common'), { recursive: true })
    await writeFile(path.join(repoRoot, 'package.json'), '{ "name": "root", "private": true }\n')
    await writeFile(
        path.join(repoRoot, 'pnpm-workspace.yaml'),
        'packages:\n  - "apps/*"\n  - "games/*"\n  - "libs/*"\n'
    )
    await writeJson(path.join(repoRoot, 'apps', 'frontend', 'package.json'), {
        name: '@tabletop/frontend',
        version: '1.0.0',
        dependencies: { '@tabletop/common': 'workspace:*' }
    })
    await mkdir(path.join(repoRoot, 'apps', 'frontend', 'src', 'lib'), { recursive: true })
    await writeFile(
        path.join(repoRoot, 'apps', 'frontend', 'src', 'lib', 'version.ts'),
        "export const FRONTEND_VERSION = '1.0.0'\n"
    )
    await mkdir(path.join(repoRoot, 'tools', 'scripts'), { recursive: true })
    await writeFile(
        path.join(repoRoot, 'tools', 'scripts', 'write-frontend-version.cjs'),
        [
            "const fs = require('node:fs')",
            "const { version } = JSON.parse(fs.readFileSync('package.json', 'utf8'))",
            "fs.writeFileSync('src/lib/version.ts', `export const FRONTEND_VERSION = '${version}'\\n`)",
            ''
        ].join('\n')
    )
    await writeJson(path.join(repoRoot, 'apps', 'backend', 'package.json'), {
        name: '@tabletop/backend',
        version: '0.0.1',
        dependencies: { '@tabletop/common': 'workspace:*' }
    })
    await writeJson(path.join(repoRoot, 'libs', 'common', 'package.json'), {
        name: '@tabletop/common',
        version: '0.0.1'
    })
    await writeJson(path.join(repoRoot, 'libs', 'shared', 'package.json'), {
        name: '@tabletop/shared',
        version: '0.0.1',
        dependencies: { '@tabletop/common': 'workspace:*' }
    })
    await writeFile(
        path.join(repoRoot, 'tools', 'scripts', 'write-game-version.cjs'),
        [
            "const fs = require('node:fs')",
            "const { version } = JSON.parse(fs.readFileSync('package.json', 'utf8'))",
            "fs.mkdirSync('src/definition', { recursive: true })",
            "fs.writeFileSync('src/definition/version.ts', `export const GAME_VERSION = '${version}'\\n`)",
            ''
        ].join('\n')
    )
    await mkdir(path.join(repoRoot, 'games', 'sample', 'src', 'definition'), { recursive: true })
    await writeFile(
        path.join(repoRoot, 'games', 'sample', 'src', 'definition', 'version.ts'),
        "export const GAME_VERSION = '2.3.4'\n"
    )
    await writeJson(path.join(repoRoot, 'games', 'sample', 'package.json'), {
        name: '@tabletop/sample',
        version: '2.3.4',
        dependencies: { '@tabletop/shared': 'workspace:*', '@tabletop/common': 'workspace:*' }
    })
    await writeJson(path.join(repoRoot, 'games', 'sample-ui', 'package.json'), {
        name: '@tabletop/sample-ui',
        version: '5.6.7',
        dependencies: { '@tabletop/sample': 'workspace:*' }
    })
    const catalogue = [{ gameId: 'sample-game', packageId: 'sample' }]
    await writeJson(path.join(repoRoot, 'config', 'config-games', 'src', 'games.json'), catalogue)
    git(repoRoot, 'add', '.')
    git(repoRoot, 'commit', '-q', '-m', 'Initial')
    git(repoRoot, 'push', '-q', 'origin', 'main')

    const logs = []
    const context = {
        repoRoot,
        catalogue,
        deployConfig: {},
        log: (message) => logs.push(message)
    }
    return { root, repoRoot, originRoot, context, logs }
}

test('planGameVersionBump computes next versions without writing', async () => {
    const repo = await createRepo()
    try {
        const planned = await planGameVersionBump(repo.repoRoot, 'sample', 'minor', {
            includeLogic: true
        })
        assert.deepEqual(planned, {
            logic: { previous: '2.3.4', next: '2.4.0' },
            ui: { previous: '5.6.7', next: '5.7.0' }
        })
        await assertCleanWorkingTree(repo.repoRoot)
        assert.equal(logicReleaseTag('sample', '2.4.0'), 'sample-v2.4.0')
        assert.equal(uiReleaseTag('sample', '5.7.0'), 'sample-ui-v5.7.0')
    } finally {
        await rm(repo.root, { recursive: true, force: true })
    }
})

test('releaseGame bumps, syncs, commits, tags, and pushes a UI-only release', async () => {
    const repo = await createRepo()
    try {
        await releaseGame(repo.context, {
            game: 'sample-game',
            includeLogic: false,
            bump: 'patch',
            deploy: false
        })

        const uiPackage = await readJson(
            path.join(repo.repoRoot, 'games', 'sample-ui', 'package.json')
        )
        const logicPackage = await readJson(
            path.join(repo.repoRoot, 'games', 'sample', 'package.json')
        )
        assert.equal(uiPackage.version, '5.6.8')
        assert.equal(logicPackage.version, '2.3.4')

        await assertCleanWorkingTree(repo.repoRoot)
        assert.deepEqual(
            git(repo.repoRoot, 'show', '--name-only', '--format=', 'HEAD').split('\n'),
            ['games/sample-ui/package.json']
        )
        assert.equal(git(repo.repoRoot, 'log', '-1', '--format=%s'), 'Release sample-game ui 5.6.8')
        assert.deepEqual(await tagsAtHead(repo.repoRoot), ['sample-ui-v5.6.8'])
        assert.equal(
            git(repo.originRoot, 'rev-parse', 'main'),
            git(repo.repoRoot, 'rev-parse', 'HEAD')
        )
        assert.equal(git(repo.originRoot, 'tag', '--list', 'sample-ui-v5.6.8'), 'sample-ui-v5.6.8')
    } finally {
        await rm(repo.root, { recursive: true, force: true })
    }
})

test('releaseGame with logic tags both artifacts', async () => {
    const repo = await createRepo()
    try {
        await releaseGame(repo.context, {
            game: 'sample',
            includeLogic: true,
            bump: 'major',
            deploy: false
        })
        assert.deepEqual((await tagsAtHead(repo.repoRoot)).sort(), [
            'sample-ui-v6.0.0',
            'sample-v3.0.0'
        ])
        assert.equal(
            git(repo.repoRoot, 'log', '-1', '--format=%s'),
            'Release sample-game logic 3.0.0 and ui 6.0.0'
        )
        assert.deepEqual(
            git(repo.repoRoot, 'show', '--name-only', '--format=', 'HEAD').split('\n').sort(),
            [
                'games/sample-ui/package.json',
                'games/sample/package.json',
                'games/sample/src/definition/version.ts'
            ]
        )
        assert.equal(
            await readFile(
                path.join(repo.repoRoot, 'games/sample/src/definition/version.ts'),
                'utf8'
            ),
            "export const GAME_VERSION = '3.0.0'\n"
        )
        await assertCleanWorkingTree(repo.repoRoot)
    } finally {
        await rm(repo.root, { recursive: true, force: true })
    }
})

test('releaseGame refuses a dirty working tree without touching versions', async () => {
    const repo = await createRepo()
    try {
        await writeFile(path.join(repo.repoRoot, 'scratch.txt'), 'wip\n', 'utf8')
        await assert.rejects(
            releaseGame(repo.context, {
                game: 'sample',
                includeLogic: true,
                bump: 'patch',
                deploy: false
            }),
            /Working tree is not clean/
        )
        const uiPackage = await readJson(
            path.join(repo.repoRoot, 'games', 'sample-ui', 'package.json')
        )
        assert.equal(uiPackage.version, '5.6.7')
        assert.deepEqual(await tagsAtHead(repo.repoRoot), [])
    } finally {
        await rm(repo.root, { recursive: true, force: true })
    }
})

test('releaseGame refuses when the release tag already exists', async () => {
    const repo = await createRepo()
    try {
        git(repo.repoRoot, 'tag', 'sample-ui-v5.6.8')
        await assert.rejects(
            releaseGame(repo.context, {
                game: 'sample',
                includeLogic: false,
                bump: 'patch',
                deploy: false
            }),
            /Tag sample-ui-v5.6.8 already exists/
        )
        await assertCleanWorkingTree(repo.repoRoot)
    } finally {
        await rm(repo.root, { recursive: true, force: true })
    }
})

const commitFile = async (repoRoot, relativePath, content, message) => {
    await mkdir(path.dirname(path.join(repoRoot, relativePath)), { recursive: true })
    await writeFile(path.join(repoRoot, relativePath), content, 'utf8')
    git(repoRoot, 'add', relativePath)
    git(repoRoot, 'commit', '-q', '-m', message)
}

const preflight = (repo) => runGamePreflight(repo.context, 'sample-game')

test('preflight reports no release needed when nothing changed since the version commit', async () => {
    const repo = await createRepo()
    try {
        await commitFile(repo.repoRoot, 'docs/notes.md', 'unrelated\n', 'Docs only')
        const report = await preflight(repo)
        assert.equal(report.releaseNeeded, 'none')
        assert.equal(report.workingTreeClean, true)
        assert.equal(report.serving, null)
        assert.equal(report.logic.baseline.kind, 'version-commit')
        assert.deepEqual(report.logic.sourceDirs, ['games/sample', 'libs/shared'])
        assert.deepEqual(report.ui.sourceDirs, ['games/sample', 'games/sample-ui', 'libs/shared'])
    } finally {
        await rm(repo.root, { recursive: true, force: true })
    }
})

test('preflight detects a UI-only change', async () => {
    const repo = await createRepo()
    try {
        await commitFile(repo.repoRoot, 'games/sample-ui/src/index.ts', 'export {}\n', 'UI tweak')
        const report = await preflight(repo)
        assert.equal(report.releaseNeeded, 'ui')
        assert.equal(report.logic.changed, false)
        assert.deepEqual(report.ui.changedFiles, ['games/sample-ui/src/index.ts'])
        assert.deepEqual(
            report.ui.commits.map((commit) => commit.subject),
            ['UI tweak']
        )
    } finally {
        await rm(repo.root, { recursive: true, force: true })
    }
})

test('preflight ignores platform package changes', async () => {
    const repo = await createRepo()
    try {
        await commitFile(repo.repoRoot, 'libs/common/src/index.ts', 'export {}\n', 'Common fix')
        const report = await preflight(repo)
        assert.equal(report.releaseNeeded, 'none')
        assert.deepEqual(report.logic.sourceDirs, ['games/sample', 'libs/shared'])
        assert.deepEqual(report.logic.platformDirs, ['libs/common'])
        assert.deepEqual(report.logic.platformChangedFiles, ['libs/common/src/index.ts'])
    } finally {
        await rm(repo.root, { recursive: true, force: true })
    }
})

test('preflight treats a family dependency change as a logic change and uses tags as baselines', async () => {
    const repo = await createRepo()
    try {
        await releaseGame(repo.context, {
            game: 'sample',
            includeLogic: true,
            bump: 'patch',
            deploy: false
        })
        await commitFile(repo.repoRoot, 'libs/shared/src/index.ts', 'export {}\n', 'Shared fix')
        const report = await preflight(repo)
        assert.equal(report.logic.baseline.kind, 'tag')
        assert.equal(report.logic.baseline.ref, 'sample-v2.3.5')
        assert.equal(report.ui.baseline.ref, 'sample-ui-v5.6.8')
        assert.equal(report.releaseNeeded, 'logic and ui')
        assert.deepEqual(report.logic.changedFiles, ['libs/shared/src/index.ts'])
    } finally {
        await rm(repo.root, { recursive: true, force: true })
    }
})

test('releaseFrontend bumps, commits, tags frontend-v<version>, and pushes', async () => {
    const repo = await createRepo()
    try {
        await releaseFrontend(repo.context, { bump: 'minor', deploy: false })
        const frontendPackage = await readJson(
            path.join(repo.repoRoot, 'apps', 'frontend', 'package.json')
        )
        assert.equal(frontendPackage.version, '1.1.0')
        await assertCleanWorkingTree(repo.repoRoot)
        assert.deepEqual(
            git(repo.repoRoot, 'show', '--name-only', '--format=', 'HEAD').split('\n').sort(),
            ['apps/frontend/package.json', 'apps/frontend/src/lib/version.ts']
        )
        assert.equal(
            await readFile(path.join(repo.repoRoot, 'apps/frontend/src/lib/version.ts'), 'utf8'),
            "export const FRONTEND_VERSION = '1.1.0'\n"
        )
        assert.equal(git(repo.repoRoot, 'log', '-1', '--format=%s'), 'Release frontend 1.1.0')
        assert.deepEqual(await tagsAtHead(repo.repoRoot), ['frontend-v1.1.0'])
        assert.equal(git(repo.originRoot, 'tag', '--list', 'frontend-v1.1.0'), 'frontend-v1.1.0')
    } finally {
        await rm(repo.root, { recursive: true, force: true })
    }
})

test('frontend preflight counts the frontend package and all of its dependencies', async () => {
    const repo = await createRepo()
    try {
        await releaseFrontend(repo.context, { bump: 'patch', deploy: false })
        await commitFile(repo.repoRoot, 'libs/common/src/index.ts', 'export {}\n', 'Common fix')
        const report = await runFrontendPreflight(repo.context)
        assert.equal(report.frontend.baseline.ref, 'frontend-v1.0.1')
        assert.deepEqual(report.frontend.sourceDirs, ['apps/frontend', 'libs/common'])
        assert.deepEqual(report.frontend.platformDirs, [])
        assert.equal(report.releaseNeeded, 'frontend')
    } finally {
        await rm(repo.root, { recursive: true, force: true })
    }
})

test('releaseBackend bumps only the backend package, tags backend-v<version>, and pushes', async () => {
    const repo = await createRepo()
    try {
        await releaseBackend(repo.context, {
            bump: 'patch',
            deploy: false,
            services: ['backend', 'tasks'],
            serveTraffic: true
        })
        const backendPackage = await readJson(
            path.join(repo.repoRoot, 'apps', 'backend', 'package.json')
        )
        assert.equal(backendPackage.version, '0.0.2')
        await assertCleanWorkingTree(repo.repoRoot)
        assert.equal(git(repo.repoRoot, 'log', '-1', '--format=%s'), 'Release backend 0.0.2')
        assert.deepEqual(await tagsAtHead(repo.repoRoot), ['backend-v0.0.2'])
        assert.equal(git(repo.originRoot, 'tag', '--list', 'backend-v0.0.2'), 'backend-v0.0.2')
        assert.deepEqual(
            git(repo.repoRoot, 'show', '--stat', '--format=', 'HEAD')
                .split('\n')[0]
                .trim()
                .split(' ')[0],
            'apps/backend/package.json'
        )
    } finally {
        await rm(repo.root, { recursive: true, force: true })
    }
})

test('backend preflight counts the backend package and its dependencies', async () => {
    const repo = await createRepo()
    try {
        await commitFile(repo.repoRoot, 'libs/common/src/index.ts', 'export {}\n', 'Common fix')
        const report = await runBackendPreflight(repo.context)
        assert.equal(report.backend.baseline.kind, 'version-commit')
        assert.deepEqual(report.backend.sourceDirs, ['apps/backend', 'libs/common'])
        assert.equal(report.releaseNeeded, 'backend')
    } finally {
        await rm(repo.root, { recursive: true, force: true })
    }
})

test('revision suffixes are valid Cloud Run names', async () => {
    const { revisionSuffixForVersion } = await import('../esm/lib/commands.js')
    assert.equal(revisionSuffixForVersion('1.0.0'), 'v1-0-0')
    assert.equal(revisionSuffixForVersion('2.10.3-rc.1'), 'v2-10-3-rc-1')
})

test('backend services roll out tasks first, then backend', async () => {
    const { orderServices } = await import('../esm/lib/backendPublish.js')
    assert.deepEqual(orderServices(['backend', 'tasks']), ['tasks', 'backend'])
    assert.deepEqual(orderServices(['backend']), ['backend'])
    assert.deepEqual(orderServices(['tasks']), ['tasks'])
})

test('manifest updates record versions and prior versions without touching other games', async () => {
    const { withFrontendVersion, withGameVersions, manifestBackupUrl } =
        await import('../esm/lib/remoteManifest.js')
    const manifest = {
        frontend: { version: '1.0.0', priorVersions: ['0.9.0'] },
        games: [
            {
                gameId: 'a',
                packageId: 'a',
                logicVersion: '1.0.0',
                uiVersion: '2.0.0',
                priorLogicVersions: [],
                priorUiVersions: ['1.9.0']
            },
            { gameId: 'b', packageId: 'b', logicVersion: '3.0.0', uiVersion: '4.0.0' }
        ]
    }
    const when = {
        deployedAt: '2026-09-23T04:05:06.789Z',
        commitSha: 'abc',
        tags: ['a-ui-v2.1.0']
    }
    const uiOnly = withGameVersions(
        manifest,
        { gameId: 'a', packageId: 'a' },
        { uiVersion: '2.1.0' },
        when
    )
    assert.deepEqual(uiOnly.games[0], {
        gameId: 'a',
        packageId: 'a',
        logicVersion: '1.0.0',
        uiVersion: '2.1.0',
        priorLogicVersions: [],
        priorUiVersions: ['2.0.0', '1.9.0'],
        history: [
            { logicVersion: '1.0.0', uiVersion: '2.1.0', ...when },
            { logicVersion: '1.0.0', uiVersion: '2.0.0' }
        ]
    })
    assert.deepEqual(uiOnly.games[1], manifest.games[1])

    const added = withGameVersions(
        manifest,
        { gameId: 'c', packageId: 'c-package' },
        { logicVersion: '0.1.0', uiVersion: '0.1.0' },
        when
    )
    assert.equal(added.games.length, 3)
    assert.deepEqual(added.games[2], {
        gameId: 'c',
        packageId: 'c-package',
        logicVersion: '0.1.0',
        uiVersion: '0.1.0',
        priorLogicVersions: [],
        priorUiVersions: [],
        history: [{ logicVersion: '0.1.0', uiVersion: '0.1.0', ...when }]
    })

    const frontend = withFrontendVersion(manifest, '1.1.0', when)
    assert.deepEqual(frontend.frontend, {
        version: '1.1.0',
        priorVersions: ['1.0.0', '0.9.0'],
        history: [
            { version: '1.1.0', deployedAt: when.deployedAt, commitSha: 'abc', tag: 'a-ui-v2.1.0' },
            { version: '1.0.0' }
        ]
    })
    assert.deepEqual(frontend.games, manifest.games)

    assert.equal(
        manifestBackupUrl({ gcsBucket: 'b' }, 'a ui/2.1.0', new Date('2026-09-23T04:05:06.789Z')),
        'gs://b/config/manifest-backups/site-manifest.20260923-040506789Z.a-ui-2.1.0.json'
    )
})

test('rollback selects the publication before the current one and re-selecting moves it to the front', async () => {
    const {
        previousGamePublication,
        previousFrontendVersion,
        withGameVersions,
        withFrontendVersion
    } = await import('../esm/lib/remoteManifest.js')
    const entry = {
        gameId: 'a',
        packageId: 'a',
        logicVersion: '1.0.0',
        uiVersion: '2.1.0',
        history: [
            { logicVersion: '1.0.0', uiVersion: '2.1.0', deployedAt: 't2' },
            { logicVersion: '1.0.0', uiVersion: '2.0.0', deployedAt: 't1' },
            { logicVersion: '0.9.0', uiVersion: '1.9.0', deployedAt: 't0' }
        ]
    }
    assert.deepEqual(previousGamePublication(entry), {
        logicVersion: '1.0.0',
        uiVersion: '2.0.0',
        deployedAt: 't1'
    })
    const rolledBack = withGameVersions(
        { frontend: { version: '1.0.0' }, games: [entry] },
        { gameId: 'a', packageId: 'a' },
        { logicVersion: '1.0.0', uiVersion: '2.0.0' },
        { deployedAt: 't3' }
    ).games[0]
    assert.deepEqual(
        rolledBack.history.map((record) => [record.uiVersion, record.deployedAt]),
        [
            ['2.0.0', 't3'],
            ['2.1.0', 't2'],
            ['1.9.0', 't0']
        ]
    )
    assert.deepEqual(previousGamePublication(rolledBack), entry.history[0])

    const seeded = { gameId: 'b', packageId: 'b', logicVersion: '1.0.0', uiVersion: '1.0.0' }
    assert.equal(previousGamePublication(seeded), null)

    const frontend = {
        frontend: {
            version: '2.0.0',
            history: [{ version: '2.0.0' }, { version: '1.0.0' }]
        },
        games: []
    }
    assert.deepEqual(previousFrontendVersion(frontend), { version: '1.0.0' })
    const back = withFrontendVersion(frontend, '1.0.0', { deployedAt: 't9' })
    assert.deepEqual(back.frontend.history, [
        { version: '1.0.0', deployedAt: 't9', commitSha: undefined, tag: undefined },
        { version: '2.0.0' }
    ])
})

test('history keeps only the most recent five publications', async () => {
    const { HISTORY_LENGTH, withFrontendVersion, withGameVersions } =
        await import('../esm/lib/remoteManifest.js')
    assert.equal(HISTORY_LENGTH, 5)
    let manifest = { frontend: { version: '0.0.0' }, games: [] }
    for (let i = 1; i <= 7; i += 1) {
        manifest = withGameVersions(
            manifest,
            { gameId: 'a', packageId: 'a' },
            { logicVersion: '1.0.0', uiVersion: `${i}.0.0` },
            { deployedAt: `t${i}` }
        )
        manifest = withFrontendVersion(manifest, `${i}.0.0`, { deployedAt: `t${i}` })
    }
    assert.deepEqual(
        manifest.games[0].history.map((record) => record.uiVersion),
        ['7.0.0', '6.0.0', '5.0.0', '4.0.0', '3.0.0']
    )
    assert.deepEqual(
        manifest.frontend.history.map((record) => record.version),
        ['7.0.0', '6.0.0', '5.0.0', '4.0.0', '3.0.0']
    )
})

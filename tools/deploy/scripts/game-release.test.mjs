import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { releaseGame } from '../esm/lib/gamePublish.js'
import { runReleasePreflight } from '../esm/lib/releasePreflight.js'
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
    await mkdir(path.join(repoRoot, 'libs', 'shared'), { recursive: true })
    await mkdir(path.join(repoRoot, 'libs', 'common'), { recursive: true })
    await writeFile(path.join(repoRoot, 'package.json'), '{ "name": "root", "private": true }\n')
    await writeFile(
        path.join(repoRoot, 'pnpm-workspace.yaml'),
        'packages:\n  - "apps/*"\n  - "games/*"\n  - "libs/*"\n'
    )
    await writeJson(path.join(repoRoot, 'apps', 'frontend', 'package.json'), {
        name: '@tabletop/frontend',
        version: '1.0.0'
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
    const manifestPath = path.join(repoRoot, 'config', 'config-games', 'src', 'site-manifest.json')
    await writeJson(manifestPath, {
        frontend: { version: '1.0.0', priorVersions: [] },
        games: [
            {
                gameId: 'sample-game',
                packageId: 'sample',
                logicVersion: '2.3.4',
                uiVersion: '5.6.7',
                priorLogicVersions: [],
                priorUiVersions: []
            }
        ]
    })
    git(repoRoot, 'add', '.')
    git(repoRoot, 'commit', '-q', '-m', 'Initial')
    git(repoRoot, 'push', '-q', 'origin', 'main')

    const logs = []
    const context = {
        repoRoot,
        manifestPath,
        deployConfig: {},
        log: (message) => logs.push(message)
    }
    return { root, repoRoot, originRoot, manifestPath, context, logs }
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

        const manifest = await readJson(repo.manifestPath)
        assert.equal(manifest.games[0].uiVersion, '5.6.8')
        assert.deepEqual(manifest.games[0].priorUiVersions, ['5.6.7'])

        await assertCleanWorkingTree(repo.repoRoot)
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
        const manifest = await readJson(repo.manifestPath)
        assert.equal(manifest.games[0].logicVersion, '3.0.0')
        assert.equal(manifest.games[0].uiVersion, '6.0.0')
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

const preflight = (repo) => runReleasePreflight(repo.repoRoot, repo.manifestPath, {}, 'sample-game')

test('preflight reports no release needed when nothing changed since the version commit', async () => {
    const repo = await createRepo()
    try {
        await commitFile(repo.repoRoot, 'docs/notes.md', 'unrelated\n', 'Docs only')
        const report = await preflight(repo)
        assert.equal(report.releaseNeeded, 'none')
        assert.equal(report.workingTreeClean, true)
        assert.equal(report.manifestInSync, true)
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

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { releaseGame } from '../esm/lib/gamePublish.js'
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
    await writeJson(path.join(repoRoot, 'apps', 'frontend', 'package.json'), { version: '1.0.0' })
    await writeJson(path.join(repoRoot, 'games', 'sample', 'package.json'), { version: '2.3.4' })
    await writeJson(path.join(repoRoot, 'games', 'sample-ui', 'package.json'), {
        version: '5.6.7'
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

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const git = async (repoRoot: string, args: string[]): Promise<string> => {
    try {
        const { stdout } = await execFileAsync('git', args, { cwd: repoRoot })
        return stdout.trim()
    } catch (error) {
        const stderr =
            typeof error === 'object' && error !== null && 'stderr' in error
                ? String(error.stderr).trim()
                : ''
        throw new Error(`git ${args.join(' ')} failed${stderr ? `: ${stderr}` : ''}`)
    }
}

export const assertCleanWorkingTree = async (repoRoot: string): Promise<void> => {
    const status = await git(repoRoot, ['status', '--porcelain'])
    if (status) {
        throw new Error(`Working tree is not clean; commit or stash changes first:\n${status}`)
    }
}

export const currentBranch = async (repoRoot: string): Promise<string> => {
    const branch = await git(repoRoot, ['branch', '--show-current'])
    if (!branch) {
        throw new Error('HEAD is detached; check out a branch before releasing')
    }
    return branch
}

export const headCommitSha = (repoRoot: string): Promise<string> =>
    git(repoRoot, ['rev-parse', 'HEAD'])

export const tagsAtHead = async (repoRoot: string): Promise<string[]> => {
    const output = await git(repoRoot, ['tag', '--points-at', 'HEAD'])
    return output.split('\n').filter((tag) => tag.length > 0)
}

export const tagExists = async (repoRoot: string, tag: string): Promise<boolean> => {
    const output = await git(repoRoot, ['tag', '--list', tag])
    return output === tag
}

export const commitFiles = async (
    repoRoot: string,
    files: string[],
    message: string
): Promise<void> => {
    await git(repoRoot, ['add', '--', ...files])
    await git(repoRoot, ['commit', '--quiet', '-m', message, '--', ...files])
}

export const createAnnotatedTag = (repoRoot: string, tag: string, message: string) =>
    git(repoRoot, ['tag', '-a', tag, '-m', message])

export const pushBranchAndTags = async (
    repoRoot: string,
    branch: string,
    tags: string[]
): Promise<void> => {
    await git(repoRoot, ['push', 'origin', branch])
    await git(repoRoot, ['push', 'origin', ...tags.map((tag) => `refs/tags/${tag}`)])
}

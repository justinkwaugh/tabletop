import { execFileSync } from 'node:child_process'
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const target = resolve(root, process.env.CARGO_TARGET_DIR ?? 'rust/target')
execFileSync(
    process.env.CARGO_BIN ?? 'cargo',
    ['build', '--locked', '--release', '--lib', '--target', 'wasm32-unknown-unknown'],
    {
        cwd: resolve(root, 'rust'),
        stdio: 'inherit',
        env: { ...process.env, CARGO_TARGET_DIR: target }
    }
)
await mkdir(resolve(root, 'esm'), { recursive: true })
await copyFile(
    resolve(target, 'wasm32-unknown-unknown/release/rail_route_solver.wasm'),
    resolve(root, 'esm/solver.wasm')
)

const inputs = []
for (const path of [
    'build.mjs',
    'rust/Cargo.toml',
    'rust/Cargo.lock',
    'rust/rust-toolchain.toml',
    'rust/src/lib.rs',
    'rust/src/main.rs',
    'rust/src/wasm.rs'
]) {
    inputs.push({
        path,
        sha256: createHash('sha256')
            .update(await readFile(resolve(root, path)))
            .digest('hex')
    })
}
await writeFile(
    resolve(root, 'esm/solver-build.json'),
    JSON.stringify(
        {
            inputs,
            wasmSha256: createHash('sha256')
                .update(await readFile(resolve(root, 'esm/solver.wasm')))
                .digest('hex')
        },
        null,
        2
    ) + '\n'
)

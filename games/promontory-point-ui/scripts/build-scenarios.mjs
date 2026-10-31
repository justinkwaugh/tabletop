// Writes the tables the dev harness offers under Scenarios, one file each in ../src/scenarios.
// The tables are built by `TABLE_FIXTURES` in the logic package's testing helpers, which hands
// each state over dehydrated. Build the logic package first: node scripts/build-scenarios.mjs
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startingPositionFile } from '@tabletop/common/testing'
import { TABLE_SLUGS, tablePosition } from '@tabletop/promontory-point/testing'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')

mkdirSync(OUT, { recursive: true })
for (const name of readdirSync(OUT).filter((file) => file.endsWith('.json'))) {
    rmSync(join(OUT, name))
}
for (const slug of TABLE_SLUGS) {
    const { fileName, contents } = startingPositionFile(tablePosition(slug))
    writeFileSync(join(OUT, fileName), contents)
}

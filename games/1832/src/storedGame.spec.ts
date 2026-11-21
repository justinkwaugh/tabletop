import { storedGameTests } from '../../../libs/18xx/test/storedGame.js'
import { Definition } from './definition/gameDefinition.js'

// The harness scenario "system-train-help" as the logic stored it before presidents were derived from
// their certificates (2026-11-20).
storedGameTests(Definition, new URL('../test/fixtures/stored-game.json', import.meta.url))

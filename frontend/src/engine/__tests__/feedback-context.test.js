/**
 * describeLocation - the report's provenance stamp.
 *
 * The backend stores what this returns, so the contract worth pinning is: a page
 * path always comes back, the puzzle coordinates come back only for a real stage
 * URL, and every other route stays context-free (a wrong level id would file a bug
 * against the wrong puzzle).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { APP_VERSION, describeLocation } from '../../services/feedbackContext.js'

test('a stage URL yields the level and stage the report came from', () => {
  const out = describeLocation('/level/2/stage/3')
  assert.equal(out.page, '/level/2/stage/3')
  assert.deepEqual(out.context, { levelId: 2, stageIdx: 3 })
})

test('level ids are numbers, not the URL text', () => {
  assert.equal(typeof describeLocation('/level/1/stage/0').context.levelId, 'number')
  assert.equal(describeLocation('/level/1/stage/0').context.stageIdx, 0)
})

test('routes without a stage carry no puzzle coordinates', () => {
  for (const path of ['/', '/levels', '/level/2/stages', '/sandbox', '/sandbox/play', '/profile', '/login', '/contact']) {
    const out = describeLocation(path)
    assert.equal(out.page, path)
    assert.equal(out.context, null, path)
  }
})

test('a non-numeric stage URL is not treated as a puzzle', () => {
  assert.equal(describeLocation('/level/abc/stage/1').context, null)
  assert.equal(describeLocation('/level/1/stage/x').context, null)
})

test('a missing or non-absolute pathname is reported as the root page', () => {
  assert.equal(describeLocation(undefined).page, '/')
  assert.equal(describeLocation('').page, '/')
  assert.equal(describeLocation('levels').page, '/')
})

test('the build label is always a usable string', () => {
  assert.equal(typeof APP_VERSION, 'string')
  assert.ok(APP_VERSION.length > 0)
})
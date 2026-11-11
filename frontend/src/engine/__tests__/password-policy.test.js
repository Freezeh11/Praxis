import test from 'node:test'
import assert from 'node:assert/strict'
import { passwordError, PASSWORD_REQUIREMENTS } from '../../services/passwordPolicy.js'

test('new passwords require length, a digit, and a special character together', () => {
  for (const password of ['', 'Short1!', 'abcdefgh', 'abcdefg1', 'abcdefg!', 'abcdef1 ', 'abcdef1中']) {
    assert.equal(passwordError(password), PASSWORD_REQUIREMENTS, password)
  }
  for (const password of ['abcdef1!', '1234567!', 'Long password 1!', 'abcdef1。']) {
    assert.equal(passwordError(password), null, password)
  }
})

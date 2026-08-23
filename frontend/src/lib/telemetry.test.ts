import { describe, expect, it } from 'vitest'
import { sanitizeTelemetry } from './telemetry'

describe('telemetry privacy bounds', () => {
  it('redacts sensitive keys and values while preserving diagnostics', () => {
    const result = sanitizeTelemetry({
      phase: 'loading',
      privateKey: 'do-not-send',
      contact: 'person@example.com',
      nested: { token: 'abc', line: 42 },
    })
    expect(result).toEqual({
      phase: 'loading',
      privateKey: '[redacted]',
      contact: '[redacted]',
      nested: { token: '[redacted]', line: 42 },
    })
  })
})

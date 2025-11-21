import { describe, expect, it } from 'vitest'
import { buildValueFromEvents } from '../src/decode/event-builder'
import { decode, decodeFromLines, decodeStreamSync } from '../src/index'

describe('streaming decode', () => {
  describe('decodeStreamSync', () => {
    it('should decode simple object', () => {
      const input = 'name: Alice\nage: 30'
      const lines = input.split('\n')
      const events = Array.from(decodeStreamSync(lines))

      expect(events).toEqual([
        { type: 'startObject' },
        { type: 'key', key: 'name' },
        { type: 'primitive', value: 'Alice' },
        { type: 'key', key: 'age' },
        { type: 'primitive', value: 30 },
        { type: 'endObject' },
      ])
    })

    it('should decode nested object', () => {
      const input = 'user:\n  name: Alice\n  age: 30'
      const lines = input.split('\n')
      const events = Array.from(decodeStreamSync(lines))

      expect(events).toEqual([
        { type: 'startObject' },
        { type: 'key', key: 'user' },
        { type: 'startObject' },
        { type: 'key', key: 'name' },
        { type: 'primitive', value: 'Alice' },
        { type: 'key', key: 'age' },
        { type: 'primitive', value: 30 },
        { type: 'endObject' },
        { type: 'endObject' },
      ])
    })

    it('should decode inline primitive array', () => {
      const input = 'scores[3]: 95, 87, 92'
      const lines = input.split('\n')
      const events = Array.from(decodeStreamSync(lines))

      expect(events).toEqual([
        { type: 'startObject' },
        { type: 'key', key: 'scores' },
        { type: 'startArray', length: 3 },
        { type: 'primitive', value: 95 },
        { type: 'primitive', value: 87 },
        { type: 'primitive', value: 92 },
        { type: 'endArray' },
        { type: 'endObject' },
      ])
    })

    it('should decode list array', () => {
      const input = 'items[2]:\n  - Apple\n  - Banana'
      const lines = input.split('\n')
      const events = Array.from(decodeStreamSync(lines))

      expect(events).toEqual([
        { type: 'startObject' },
        { type: 'key', key: 'items' },
        { type: 'startArray', length: 2 },
        { type: 'primitive', value: 'Apple' },
        { type: 'primitive', value: 'Banana' },
        { type: 'endArray' },
        { type: 'endObject' },
      ])
    })

    it('should decode tabular array', () => {
      const input = 'users[2]{name,age}:\n  Alice, 30\n  Bob, 25'
      const lines = input.split('\n')
      const events = Array.from(decodeStreamSync(lines))

      expect(events).toEqual([
        { type: 'startObject' },
        { type: 'key', key: 'users' },
        { type: 'startArray', length: 2 },
        { type: 'startObject' },
        { type: 'key', key: 'name' },
        { type: 'primitive', value: 'Alice' },
        { type: 'key', key: 'age' },
        { type: 'primitive', value: 30 },
        { type: 'endObject' },
        { type: 'startObject' },
        { type: 'key', key: 'name' },
        { type: 'primitive', value: 'Bob' },
        { type: 'key', key: 'age' },
        { type: 'primitive', value: 25 },
        { type: 'endObject' },
        { type: 'endArray' },
        { type: 'endObject' },
      ])
    })

    it('should decode root primitive', () => {
      const input = 'Hello World'
      const lines = input.split('\n')
      const events = Array.from(decodeStreamSync(lines))

      expect(events).toEqual([
        { type: 'primitive', value: 'Hello World' },
      ])
    })

    it('should decode root array', () => {
      const input = '[2]:\n  - Apple\n  - Banana'
      const lines = input.split('\n')
      const events = Array.from(decodeStreamSync(lines))

      expect(events).toEqual([
        { type: 'startArray', length: 2 },
        { type: 'primitive', value: 'Apple' },
        { type: 'primitive', value: 'Banana' },
        { type: 'endArray' },
      ])
    })

    it('should decode empty input as empty object', () => {
      const lines: string[] = []
      const events = Array.from(decodeStreamSync(lines))

      expect(events).toEqual([
        { type: 'startObject' },
        { type: 'endObject' },
      ])
    })

    it('should throw on expandPaths option', () => {
      const input = 'name: Alice'
      const lines = input.split('\n')

      expect(() => Array.from(decodeStreamSync(lines, { expandPaths: 'safe' } as any)))
        .toThrow('expandPaths is not supported in streaming decode')
    })

    it('should enforce strict mode validation', () => {
      const input = 'items[2]:\n  - Apple'
      const lines = input.split('\n')

      expect(() => Array.from(decodeStreamSync(lines, { strict: true })))
        .toThrow()
    })

    it('should allow count mismatch in non-strict mode', () => {
      const input = 'items[2]:\n  - Apple'
      const lines = input.split('\n')

      // Should not throw in non-strict mode
      const events = Array.from(decodeStreamSync(lines, { strict: false }))

      expect(events).toBeDefined()
      expect(events[0]).toEqual({ type: 'startObject' })
    })
  })

  describe('buildValueFromEvents', () => {
    it('should build object from events', () => {
      const events = [
        { type: 'startObject' as const },
        { type: 'key' as const, key: 'name' },
        { type: 'primitive' as const, value: 'Alice' },
        { type: 'key' as const, key: 'age' },
        { type: 'primitive' as const, value: 30 },
        { type: 'endObject' as const },
      ]

      const result = buildValueFromEvents(events)

      expect(result).toEqual({ name: 'Alice', age: 30 })
    })

    it('should build nested object from events', () => {
      const events = [
        { type: 'startObject' as const },
        { type: 'key' as const, key: 'user' },
        { type: 'startObject' as const },
        { type: 'key' as const, key: 'name' },
        { type: 'primitive' as const, value: 'Alice' },
        { type: 'endObject' as const },
        { type: 'endObject' as const },
      ]

      const result = buildValueFromEvents(events)

      expect(result).toEqual({ user: { name: 'Alice' } })
    })

    it('should build array from events', () => {
      const events = [
        { type: 'startArray' as const, length: 3 },
        { type: 'primitive' as const, value: 1 },
        { type: 'primitive' as const, value: 2 },
        { type: 'primitive' as const, value: 3 },
        { type: 'endArray' as const },
      ]

      const result = buildValueFromEvents(events)

      expect(result).toEqual([1, 2, 3])
    })

    it('should build primitive from events', () => {
      const events = [
        { type: 'primitive' as const, value: 'Hello' },
      ]

      const result = buildValueFromEvents(events)

      expect(result).toEqual('Hello')
    })

    it('should throw on incomplete event stream', () => {
      const events = [
        { type: 'startObject' as const },
        { type: 'key' as const, key: 'name' },
        // Missing primitive and endObject
      ]

      expect(() => buildValueFromEvents(events))
        .toThrow('Incomplete event stream')
    })
  })

  describe('decodeFromLines', () => {
    it('should produce same result as decode', () => {
      const input = 'name: Alice\nage: 30\nscores[3]: 95, 87, 92'
      const lines = input.split('\n')

      const fromLines = decodeFromLines(lines)
      const fromString = decode(input)

      expect(fromLines).toEqual(fromString)
    })

    it('should support expandPaths option', () => {
      const input = 'user.name: Alice\nuser.age: 30'
      const lines = input.split('\n')

      const result = decodeFromLines(lines, { expandPaths: 'safe' })

      expect(result).toEqual({
        user: {
          name: 'Alice',
          age: 30,
        },
      })
    })

    it('should handle complex nested structures', () => {
      const input = [
        'users[2]:',
        '  - name: Alice',
        '    scores[3]: 95, 87, 92',
        '  - name: Bob',
        '    scores[3]: 88, 91, 85',
      ].join('\n')

      const fromLines = decodeFromLines(input.split('\n'))
      const fromString = decode(input)

      expect(fromLines).toEqual(fromString)
      expect(fromLines).toEqual({
        users: [
          { name: 'Alice', scores: [95, 87, 92] },
          { name: 'Bob', scores: [88, 91, 85] },
        ],
      })
    })

    it('should handle tabular arrays', () => {
      const input = [
        'users[3]{name,age,city}:',
        '  Alice, 30, NYC',
        '  Bob, 25, LA',
        '  Charlie, 35, SF',
      ].join('\n')

      const fromLines = decodeFromLines(input.split('\n'))
      const fromString = decode(input)

      expect(fromLines).toEqual(fromString)
      expect(fromLines).toEqual({
        users: [
          { name: 'Alice', age: 30, city: 'NYC' },
          { name: 'Bob', age: 25, city: 'LA' },
          { name: 'Charlie', age: 35, city: 'SF' },
        ],
      })
    })
  })

  describe('streaming equivalence', () => {
    // Test that streaming produces same results as non-streaming for various inputs
    const testCases = [
      {
        name: 'simple object',
        input: 'name: Alice\nage: 30',
      },
      {
        name: 'nested objects',
        input: 'user:\n  profile:\n    name: Alice\n    age: 30',
      },
      {
        name: 'mixed structures',
        input: 'name: Alice\nscores[3]: 95, 87, 92\naddress:\n  city: NYC\n  zip: 10001',
      },
      {
        name: 'list array with objects',
        input: 'users[2]:\n  - name: Alice\n    age: 30\n  - name: Bob\n    age: 25',
      },
      {
        name: 'root primitive number',
        input: '42',
      },
      {
        name: 'root primitive string',
        input: 'Hello World',
      },
      {
        name: 'root primitive boolean',
        input: 'true',
      },
      {
        name: 'root primitive null',
        input: 'null',
      },
    ]

    for (const testCase of testCases) {
      it(`should match decode() for: ${testCase.name}`, () => {
        const lines = testCase.input.split('\n')
        const streamResult = decodeFromLines(lines)
        const regularResult = decode(testCase.input)

        expect(streamResult).toEqual(regularResult)
      })
    }
  })
})

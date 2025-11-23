# API Reference

TypeScript/JavaScript API documentation for the `@toon-format/toon` package. For format rules, see the [Format Overview](/guide/format-overview) or the [Specification](/reference/spec). For other languages, see [Implementations](/ecosystem/implementations).

## Installation

::: code-group

```bash [npm]
npm install @toon-format/toon
```

```bash [pnpm]
pnpm add @toon-format/toon
```

```bash [yarn]
yarn add @toon-format/toon
```

:::

## `encode(input, options?)`

Converts any JSON-serializable value to TOON format.

```ts
import { encode } from '@toon-format/toon'

const toon = encode(data, {
  indent: 2,
  delimiter: ',',
  keyFolding: 'off',
  flattenDepth: Infinity
})
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `input` | `unknown` | Any JSON-serializable value (object, array, primitive, or nested structure) |
| `options` | `EncodeOptions?` | Optional encoding options (see below) |

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `indent` | `number` | `2` | Number of spaces per indentation level |
| `delimiter` | `','` \| `'\t'` \| `'\|'` | `','` | Delimiter for array values and tabular rows |
| `keyFolding` | `'off'` \| `'safe'` | `'off'` | Enable key folding to collapse single-key wrapper chains into dotted paths |
| `flattenDepth` | `number` | `Infinity` | Maximum number of segments to fold when `keyFolding` is enabled (values 0-1 have no practical effect) |

### Return Value

Returns a TOON-formatted string with no trailing newline or spaces.

### Type Normalization

Non-JSON-serializable values are normalized before encoding:

| Input | Output |
|-------|--------|
| Finite number | Canonical decimal (no exponent, no leading/trailing zeros: `1e6` → `1000000`, `-0` → `0`) |
| `NaN`, `Infinity`, `-Infinity` | `null` |
| `BigInt` (within safe range) | Number |
| `BigInt` (out of range) | Quoted decimal string (e.g., `"9007199254740993"`) |
| `Date` | ISO string in quotes (e.g., `"2025-01-01T00:00:00.000Z"`) |
| `undefined`, `function`, `symbol` | `null` |

### Example

```ts
import { encode } from '@toon-format/toon'

const items = [
  { sku: 'A1', qty: 2, price: 9.99 },
  { sku: 'B2', qty: 1, price: 14.5 }
]

console.log(encode({ items }))
```

**Output:**

```yaml
items[2]{sku,qty,price}:
  A1,2,9.99
  B2,1,14.5
```

### Delimiter Options

::: code-group

```ts [Comma (default)]
encode(data, { delimiter: ',' })
```

```ts [Tab]
encode(data, { delimiter: '\t' })
```

```ts [Pipe]
encode(data, { delimiter: '|' })
```

:::

::: details Why Use Tab Delimiters?
Tab delimiters (`\t`) often tokenize more efficiently than commas:
- Tabs are single characters
- Tabs rarely appear in natural text, reducing quote-escaping
- The delimiter is explicitly encoded in the array header

Example:

```yaml
items[2	]{sku	name	qty	price}:
  A1	Widget	2	9.99
  B2	Gadget	1	14.5
```

For maximum token savings on large tabular data, combine tab delimiters with key folding:
```ts
encode(data, { delimiter: '\t', keyFolding: 'safe' })
```
:::

## `encodeLines(input, options?)`

**Preferred method for streaming TOON output.** Converts any JSON-serializable value to TOON format as a sequence of lines, without building the full string in memory. Suitable for streaming large outputs to files, HTTP responses, or process stdout.

```ts
import { encodeLines } from '@toon-format/toon'

// Stream to stdout (Node.js)
for (const line of encodeLines(data)) {
  process.stdout.write(`${line}\n`)
}

// Write to file line-by-line
const lines = encodeLines(data, { indent: 2, delimiter: '\t' })
for (const line of lines) {
  await writeToStream(`${line}\n`)
}

// Collect to array
const lineArray = Array.from(encodeLines(data))
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `input` | `unknown` | Any JSON-serializable value (object, array, primitive, or nested structure) |
| `options` | `EncodeOptions?` | Optional encoding options (same as `encode()`) |

### Return Value

Returns an `Iterable<string>` that yields TOON lines one at a time. **Each yielded string is a single line without a trailing newline character** — you must add `\n` when writing to streams or stdout.

::: info Relationship to `encode()`
`encode(value, options)` is equivalent to:
```ts
Array.from(encodeLines(value, options)).join('\n')
```
:::

### Example

```ts
import { createWriteStream } from 'node:fs'
import { encodeLines } from '@toon-format/toon'

const data = {
  items: Array.from({ length: 100000 }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
    value: Math.random()
  }))
}

// Stream large dataset to file
const stream = createWriteStream('output.toon')
for (const line of encodeLines(data, { delimiter: '\t' })) {
  stream.write(`${line}\n`)
}
stream.end()
```

## Choosing a Decode Function

| Function | Input | Output | Async | Path Expansion | Use When |
|----------|-------|--------|-------|----------------|----------|
| `decode()` | String | Value | No | Yes | You have a complete TOON string |
| `decodeFromLines()` | Lines | Value | No | Yes | You have lines and want the full value |
| `decodeStreamSync()` | Lines | Events | No | No | You need event-by-event processing (sync) |
| `decodeStream()` | Lines | Events | Yes | No | You need event-by-event processing (async) |

::: info Key Differences
- **Value vs. Events**: Functions ending in `Stream` yield events without building the full value in memory.
- **Path expansion**: Only `decode()` and `decodeFromLines()` support `expandPaths: 'safe'`.
- **Async support**: Only `decodeStream()` accepts async iterables (useful for file/network streams).
:::

## `decode(input, options?)`

Converts a TOON-formatted string back to JavaScript values.

```ts
import { decode } from '@toon-format/toon'

const data = decode(toon, {
  indent: 2,
  strict: true,
  expandPaths: 'off'
})
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `input` | `string` | A TOON-formatted string to parse |
| `options` | `DecodeOptions?` | Optional decoding options |

### Options

See [Decode Options Reference](#decode-options-reference) below.

### Return Value

Returns a JavaScript value (object, array, or primitive) representing the parsed TOON data.

### Strict Mode

By default (`strict: true`), the decoder validates input strictly:

- **Invalid escape sequences**: Throws on `\x`, unterminated strings
- **Syntax errors**: Throws on missing colons, malformed headers
- **Array length mismatches**: Throws when declared length doesn't match actual count
- **Delimiter mismatches**: Throws when row delimiters don't match header
- **Indentation errors**: Throws when leading spaces aren't exact multiples of `indentSize`

Set `strict: false` to skip validation for lenient parsing.

### Example

```ts
import { decode } from '@toon-format/toon'

const toon = `
items[2]{sku,qty,price}:
  A1,2,9.99
  B2,1,14.5
`

const data = decode(toon)
console.log(data)
```

**Output:**

```json
{
  "items": [
    { "sku": "A1", "qty": 2, "price": 9.99 },
    { "sku": "B2", "qty": 1, "price": 14.5 }
  ]
}
```

### Path Expansion

When `expandPaths: 'safe'` is enabled, dotted keys are split into nested objects:

```ts
import { decode } from '@toon-format/toon'

const toon = 'data.metadata.items[2]: a,b'

const data = decode(toon, { expandPaths: 'safe' })
console.log(data)
// { data: { metadata: { items: ['a', 'b'] } } }
```

This pairs with `keyFolding: 'safe'` for lossless round-trips.

::: details Expansion Conflict Resolution
When multiple expanded keys construct overlapping paths, the decoder merges them recursively:
- **Object + Object**: Deep merge recursively
- **Object + Non-object** (array or primitive): Conflict
  - With `strict: true` (default): Error
  - With `strict: false`: Last-write-wins (LWW)

Example conflict (strict mode):

```ts
const toon = 'a.b: 1\na: 2'
decode(toon, { expandPaths: 'safe', strict: true })
// Error: "Expansion conflict at path 'a' (object vs primitive)"
```

Example conflict (lenient mode):

```ts
const toon = 'a.b: 1\na: 2'
decode(toon, { expandPaths: 'safe', strict: false })
// { a: 2 } (last write wins)
```
:::

## `decodeFromLines(lines, options?)`

Decodes TOON format from pre-split lines into a JavaScript value. This is a streaming-friendly wrapper around the event-based decoder that builds the full value in memory.

Useful when you already have lines as an array or iterable (e.g., from file streams, readline interfaces, or network responses) and want the standard decode behavior with path expansion support.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `lines` | `Iterable<string>` | Iterable of TOON lines (without trailing newlines) |
| `options` | `DecodeOptions?` | Optional decoding configuration |

### Options

See [Decode Options Reference](#decode-options-reference) below.

### Return Value

Returns a `JsonValue` (the parsed JavaScript value: object, array, or primitive).

### Example

**Basic usage with arrays:**

```ts
import { decodeFromLines } from '@toon-format/toon'

const lines = ['name: Alice', 'age: 30']
const value = decodeFromLines(lines)
// { name: 'Alice', age: 30 }
```

**Streaming from Node.js readline:**

```ts
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { decodeFromLines } from '@toon-format/toon'

const rl = createInterface({
  input: createReadStream('data.toon'),
  crlfDelay: Infinity,
})

const value = decodeFromLines(rl)
console.log(value)
```

**With path expansion:**

```ts
const lines = ['user.name: Alice', 'user.age: 30']
const value = decodeFromLines(lines, { expandPaths: 'safe' })
// { user: { name: 'Alice', age: 30 } }
```

## `decodeStreamSync(lines, options?)`

Synchronously decodes TOON lines into a stream of JSON events. This function yields structured events that represent the JSON data model without building the full value tree.

Useful for streaming processing, custom transformations, or memory-efficient parsing of large datasets where you don't need the full value in memory.

::: info Event Streaming
This is a low-level API that returns individual parse events. For most use cases, [`decodeFromLines()`](#decodeFromLines-lines-options) or [`decode()`](#decode-input-options) are more convenient.

Path expansion (`expandPaths: 'safe'`) is **not supported** in streaming mode since it requires the full value tree.
:::

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `lines` | `Iterable<string>` | Iterable of TOON lines (without trailing newlines) |
| `options` | `DecodeStreamOptions?` | Optional streaming decoding configuration (see below) |

### Options

See [Decode Options Reference](#decode-options-reference) below.

::: warning Path Expansion Not Supported
Path expansion requires building the full value tree, which is incompatible with event streaming. Use [`decodeFromLines()`](#decodeFromLines-lines-options) if you need path expansion.
:::

### Return Value

Returns an `Iterable<JsonStreamEvent>` that yields structured events.

### Event Types

Events represent the structure of the JSON data model:

```ts
type JsonStreamEvent
  = | { type: 'startObject' }
    | { type: 'endObject' }
    | { type: 'startArray', length: number }
    | { type: 'endArray' }
    | { type: 'key', key: string, wasQuoted?: boolean }
    | { type: 'primitive', value: JsonPrimitive }

type JsonPrimitive = string | number | boolean | null
```

### Example

**Basic event streaming:**

```ts
import { decodeStreamSync } from '@toon-format/toon'

const lines = ['name: Alice', 'age: 30']

for (const event of decodeStreamSync(lines)) {
  console.log(event)
}

// Output:
// { type: 'startObject' }
// { type: 'key', key: 'name' }
// { type: 'primitive', value: 'Alice' }
// { type: 'key', key: 'age' }
// { type: 'primitive', value: 30 }
// { type: 'endObject' }
```

**Custom processing:**

```ts
import { decodeStreamSync } from '@toon-format/toon'

const lines = ['users[2]{id,name}:', '  1,Alice', '  2,Bob']
let userCount = 0

for (const event of decodeStreamSync(lines)) {
  if (event.type === 'endObject' && userCount < 2) {
    userCount++
    console.log(`Processed user ${userCount}`)
  }
}
```

## `decodeStream(source, options?)`

Asynchronously decodes TOON lines into a stream of JSON events. This is the async version of [`decodeStreamSync()`](#decodeStreamSync-lines-options), supporting both synchronous and asynchronous iterables.

Useful for processing file streams, network responses, or other async sources where you want to handle data incrementally as it arrives.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `source` | `AsyncIterable<string>` \| `Iterable<string>` | Async or sync iterable of TOON lines (without trailing newlines) |
| `options` | `DecodeStreamOptions?` | Optional streaming decoding configuration (see below) |

### Options

See [Decode Options Reference](#decode-options-reference) below.

::: warning Path Expansion Not Supported
Path expansion requires building the full value tree, which is incompatible with event streaming. Use [`decodeFromLines()`](#decodeFromLines-lines-options) if you need path expansion.
:::

### Return Value

Returns an `AsyncIterable<JsonStreamEvent>` that yields structured events asynchronously.

### Example

**Streaming from file:**

```ts
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { decodeStream } from '@toon-format/toon'

const fileStream = createReadStream('data.toon', 'utf-8')
const rl = createInterface({ input: fileStream, crlfDelay: Infinity })

for await (const event of decodeStream(rl)) {
  console.log(event)
  // Process events as they arrive
}
```

**Processing events with state tracking:**

```ts
import { decodeStream } from '@toon-format/toon'

const lines = getAsyncLineSource() // AsyncIterable<string>

// Track state between events
let nextIsId = false
for await (const event of decodeStream(lines, { strict: true })) {
  if (event.type === 'key' && event.key === 'id') {
    nextIsId = true
  }
  else if (nextIsId && event.type === 'primitive') {
    console.log('Found ID:', event.value)
    nextIsId = false
  }
}
```

**Auto-detection of sync/async sources:**

```ts
// Works with sync iterables
const syncLines = ['name: Alice', 'age: 30']
for await (const event of decodeStream(syncLines)) {
  console.log(event)
}

// Works with async iterables
const asyncLines = readLinesFromNetwork()
for await (const event of decodeStream(asyncLines)) {
  console.log(event)
}
```

## Round-Trip Compatibility

TOON provides lossless round-trips after normalization:

```ts
import { decode, encode } from '@toon-format/toon'

const original = {
  users: [
    { id: 1, name: 'Alice', role: 'admin' },
    { id: 2, name: 'Bob', role: 'user' }
  ]
}

const toon = encode(original)
const restored = decode(toon)

console.log(JSON.stringify(original) === JSON.stringify(restored))
// true
```

### With Key Folding

```ts
import { decode, encode } from '@toon-format/toon'

const original = { data: { metadata: { items: ['a', 'b'] } } }

// Encode with folding
const toon = encode(original, { keyFolding: 'safe' })
// → "data.metadata.items[2]: a,b"

// Decode with expansion
const restored = decode(toon, { expandPaths: 'safe' })
// → { data: { metadata: { items: ['a', 'b'] } } }

console.log(JSON.stringify(original) === JSON.stringify(restored))
// true
```

## Types

```ts
interface EncodeOptions {
  indent?: number
  delimiter?: ',' | '\t' | '|'
  keyFolding?: 'off' | 'safe'
  flattenDepth?: number
}

interface DecodeOptions {
  indent?: number
  strict?: boolean
  expandPaths?: 'off' | 'safe'
}
```

## Decode Options Reference

### `DecodeOptions`

Used by `decode()` and `decodeFromLines()`:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `indent` | `number` | `2` | Expected number of spaces per indentation level |
| `strict` | `boolean` | `true` | Enable strict validation (array counts, indentation, delimiter consistency) |
| `expandPaths` | `'off'` \| `'safe'` | `'off'` | Enable path expansion to reconstruct dotted keys into nested objects (pairs with `keyFolding: 'safe'`) |

### `DecodeStreamOptions`

Used by `decodeStreamSync()` and `decodeStream()`:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `indent` | `number` | `2` | Expected number of spaces per indentation level |
| `strict` | `boolean` | `true` | Enable strict validation (array counts, indentation, delimiter consistency) |

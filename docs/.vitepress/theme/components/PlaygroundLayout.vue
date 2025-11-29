<script setup lang="ts">
import type { Delimiter } from '../../../../packages/toon/src'
import { useClipboard, useDebounceFn } from '@vueuse/core'
import { unzlibSync, zlibSync } from 'fflate'
import { base64ToUint8Array, stringToUint8Array, uint8ArrayToBase64, uint8ArrayToString } from 'uint8array-extras'
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { DEFAULT_DELIMITER, encode } from '../../../../packages/toon/src'
import VPInput from './VPInput.vue'

interface PlaygroundState {
  json: string
  delimiter: Delimiter
  indent: number
}

const PRESETS = {
  users: [
    { id: 1, name: 'Alice', role: 'admin' },
    { id: 2, name: 'Bob', role: 'user' },
  ],
  config: {
    app: { name: 'MyApp', version: '1.0.0' },
    features: { darkMode: true, notifications: false },
  },
  products: [
    { sku: 'A1', name: 'Widget', price: 9.99, qty: 100 },
    { sku: 'B2', name: 'Gadget', price: 14.5, qty: 50 },
  ],
} as const
const DELIMITER_OPTIONS: { value: Delimiter, label: string }[] = [
  { value: ',', label: 'Comma (,)' },
  { value: '\t', label: 'Tab (\\t)' },
  { value: '|', label: 'Pipe (|)' },
]
const DEFAULT_JSON = JSON.stringify(PRESETS.users, undefined, 2)

const jsonInput = ref(DEFAULT_JSON)
const delimiter = ref<Delimiter>(DEFAULT_DELIMITER)
const indent = ref(2)
const hasCopiedUrl = ref(false)

const tokenizer = shallowRef<typeof import('gpt-tokenizer') | undefined>()

const encodingResult = computed(() => {
  try {
    const parsedInput = JSON.parse(jsonInput.value)
    return {
      output: encode(parsedInput, {
        indent: indent.value,
        delimiter: delimiter.value,
      }),
      error: undefined,
    }
  }
  catch (e) {
    return {
      output: '',
      error: e instanceof Error ? e.message : 'Invalid JSON',
    }
  }
})

const toonOutput = computed(() => encodingResult.value.output)
const error = computed(() => encodingResult.value.error)

const jsonTokens = computed(() =>
  tokenizer.value?.encode(jsonInput.value).length,
)
const toonTokens = computed(() =>
  tokenizer.value && toonOutput.value ? tokenizer.value.encode(toonOutput.value).length : undefined,
)
const tokenSavings = computed(() => {
  if (!jsonTokens.value || !toonTokens.value)
    return

  const saved = jsonTokens.value - toonTokens.value
  const percent = ((saved / jsonTokens.value) * 100).toFixed(1)
  return { saved, percent }
})

const { copy, copied } = useClipboard({ source: toonOutput })

async function copyShareUrl() {
  await navigator.clipboard.writeText(window.location.href)
  hasCopiedUrl.value = true
  setTimeout(() => (hasCopiedUrl.value = false), 2000)
}

const updateUrl = useDebounceFn(() => {
  if (typeof window === 'undefined')
    return

  const hash = encodeState()
  window.history.replaceState(null, '', `#${hash}`)
}, 300)

watch([jsonInput, delimiter, indent], () => {
  updateUrl()
})

onMounted(() => {
  loadTokenizer()

  const hash = window.location.hash.slice(1)
  if (!hash)
    return

  const state = decodeState(hash)
  if (state) {
    jsonInput.value = state.json
    delimiter.value = state.delimiter
    indent.value = state.indent
  }
})

function encodeState() {
  const state: PlaygroundState = {
    json: jsonInput.value,
    delimiter: delimiter.value,
    indent: indent.value,
  }

  const compressedData = zlibSync(stringToUint8Array(JSON.stringify(state)))
  return uint8ArrayToBase64(compressedData, { urlSafe: true })
}

function decodeState(hash: string) {
  try {
    const bytes = base64ToUint8Array(hash)
    const decompressedData = unzlibSync(bytes)
    const decodedData = uint8ArrayToString(decompressedData)
    if (decodedData)
      return JSON.parse(decodedData) as PlaygroundState
  }
  catch {}
}

function loadPreset(name: keyof typeof PRESETS) {
  jsonInput.value = JSON.stringify(PRESETS[name], undefined, 2)
}

async function loadTokenizer() {
  tokenizer.value ??= await import('gpt-tokenizer')
}
</script>

<template>
  <div class="playground">
    <div class="playground-container">
      <!-- Header -->
      <header class="playground-header">
        <h1>Playground</h1>
        <p>Experiment with JSON to TOON encoding in real-time.</p>
      </header>

      <!-- Options Bar -->
      <div class="options-bar">
        <VPInput id="delimiter" label="Delimiter">
          <select id="delimiter" v-model="delimiter">
            <option v-for="opt in DELIMITER_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </VPInput>

        <VPInput id="indent" label="Indent">
          <input
            id="indent"
            v-model.number="indent"
            type="number"
            min="0"
            max="8"
          >
        </VPInput>

        <VPInput id="preset" label="Preset">
          <select id="preset" @change="(e) => loadPreset((e.target as HTMLSelectElement).value as keyof typeof PRESETS)">
            <option value="" disabled selected>
              Load example...
            </option>
            <option value="users">
              Users
            </option>
            <option value="config">
              Config
            </option>
            <option value="products">
              Products
            </option>
          </select>
        </VPInput>

        <button
          class="share-button"
          :class="{ copied: hasCopiedUrl }"
          :aria-label="hasCopiedUrl ? 'Link copied!' : 'Copy shareable URL'"
          @click="copyShareUrl"
        >
          <span class="vpi-link" :class="{ check: hasCopiedUrl }" aria-hidden="true" />
          {{ hasCopiedUrl ? 'Copied!' : 'Share' }}
        </button>
      </div>

      <!-- Editor Container -->
      <div class="editor-container">
        <!-- JSON Input -->
        <div class="editor-pane">
          <div class="pane-header">
            <span class="pane-title">JSON Input</span>
            <span class="pane-stats">
              <span>{{ jsonTokens ?? '...' }} tokens</span>
              <span>{{ jsonInput.length }} chars</span>
            </span>
          </div>
          <textarea
            id="json-input"
            v-model="jsonInput"
            class="editor-textarea"
            spellcheck="false"
            aria-label="JSON input"
            :aria-describedby="error ? 'json-error' : undefined"
            :aria-invalid="!!error"
            placeholder="Enter JSON here..."
          />
        </div>

        <!-- TOON Output -->
        <div class="editor-pane">
          <div class="pane-header">
            <span class="pane-title">
              TOON Output
              <span v-if="tokenSavings && Number(tokenSavings.percent) > 0" class="savings-badge">
                −{{ tokenSavings.percent }}%
              </span>
            </span>
            <span class="pane-stats">
              <span>{{ toonTokens ?? '...' }} tokens</span>
              <span>{{ toonOutput.length }} chars</span>
            </span>
            <button
              class="copy-button"
              :disabled="!!error"
              :aria-label="copied ? 'Copied to clipboard' : 'Copy to clipboard'"
              :aria-pressed="copied"
              @click="copy()"
            />
          </div>
          <div class="editor-output">
            <pre v-if="!error"><code>{{ toonOutput }}</code></pre>
            <div v-else id="json-error" role="alert" class="error-message">
              {{ error }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.playground {
  padding: 32px 24px 96px;
  min-height: 100vh;
  background: var(--vp-c-bg);
}

@media (min-width: 768px) {
  .playground {
    padding: 48px 32px 128px;
  }
}

@media (min-width: 960px) {
  .playground {
    padding: 48px 32px 0;
  }
}

.playground-container {
  max-width: 1400px;
  margin: 0 auto;
}

.playground-header {
  margin-bottom: 24px;
}

.playground-header h1 {
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 40px;
  color: var(--vp-c-text-1);
  margin: 0 0 8px;
}

@media (min-width: 768px) {
  .playground-header h1 {
    font-size: 32px;
  }
}

.playground-header p {
  font-size: 16px;
  line-height: 28px;
  color: var(--vp-c-text-2);
}

.options-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: var(--vp-c-bg-soft);
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
}

.vpi-link {
  --icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'/%3E%3Cpath d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'/%3E%3C/svg%3E");
  display: inline-block;
  width: 1em;
  height: 1em;
  -webkit-mask: var(--icon) no-repeat;
  mask: var(--icon) no-repeat;
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  background-color: currentColor;
}

.vpi-link.check {
  --icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E");
}

.share-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  height: 32px;
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  transition: border-color 0.25s, color 0.25s;
  margin-left: auto;
}

.share-button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.share-button:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.share-button.copied {
  border-color: var(--vp-c-green-1);
  color: var(--vp-c-green-1);
}

.editor-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  min-height: 500px;
}

@media (max-width: 768px) {
  .editor-container {
    grid-template-columns: 1fr;
  }
}

.editor-pane {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
  transition: border-color 0.25s;
}

.editor-pane:focus-within {
  border-color: var(--vp-c-brand-1);
}

.pane-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--vp-c-bg-alt);
  border-bottom: 1px solid var(--vp-c-divider);
}

.pane-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--vp-c-text-2);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.pane-stats {
  display: flex;
  gap: 12px;
  margin-left: auto;
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--vp-c-text-2);
  text-transform: none;
  letter-spacing: normal;
}

.savings-badge {
  display: inline-flex;
  padding: 2px 6px;
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--vp-c-green-1);
  background: var(--vp-c-green-soft);
  border-radius: 4px;
  text-transform: none;
  letter-spacing: normal;
}

.copy-button {
  width: 20px;
  height: 20px;
  background: var(--vp-icon-copy) center / 16px no-repeat;
  border-radius: 4px;
  opacity: 0.6;
  transition: opacity 0.25s, background-color 0.25s;
}

.copy-button:hover:not(:disabled) {
  opacity: 1;
  background-color: var(--vp-c-default-soft);
}

.copy-button:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.copy-button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.copy-button[aria-pressed="true"] {
  background-image: var(--vp-icon-copied);
  opacity: 1;
}

.editor-textarea,
.editor-output {
  flex: 1;
  padding: 16px;
  font-family: var(--vp-font-family-mono);
  font-size: 0.875rem;
  line-height: 1.7;
}

.editor-textarea {
  resize: none;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
}

.editor-output {
  overflow: auto;
  background: var(--vp-code-block-bg);
}

.editor-output pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.error-message {
  color: var(--vp-c-danger-1);
  padding: 8px 12px;
  background: var(--vp-c-danger-soft);
  border-radius: 4px;
  font-size: 0.875rem;
  font-family: var(--vp-font-family-base);
}
</style>

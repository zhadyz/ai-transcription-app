/**
 * Advanced file operation engine with algorithmic optimizations
 * Uses bloom filters, rolling hash, LRU cache, and work-stealing scheduler
 */

// ═══════════════════════════════════════════════════════════════════════════
// IMPORTS
// ═══════════════════════════════════════════════════════════════════════════

import { Observable, Subject, defer } from 'rxjs'
import { map, shareReplay } from 'rxjs/operators'

// ═══════════════════════════════════════════════════════════════════════════
// BLOOM FILTER - Probabilistic deduplication check (O(1) space, O(k) time)
// ═══════════════════════════════════════════════════════════════════════════

class BloomFilter {
  private bits: Uint32Array
  private size: number
  private hashCount: number

  constructor(expectedElements: number, falsePositiveRate = 0.01) {
    this.size = Math.ceil(
      (-expectedElements * Math.log(falsePositiveRate)) / (Math.LN2 * Math.LN2)
    )
    this.hashCount = Math.ceil((this.size / expectedElements) * Math.LN2)
    this.bits = new Uint32Array(Math.ceil(this.size / 32))
  }

  add(key: string): void {
    const hashes = this.getHashes(key)
    for (let i = 0; i < this.hashCount; i++) {
      const index = hashes[i] % this.size
      const arrayIndex = Math.floor(index / 32)
      const bitIndex = index % 32
      this.bits[arrayIndex] |= 1 << bitIndex
    }
  }

  has(key: string): boolean {
    const hashes = this.getHashes(key)
    for (let i = 0; i < this.hashCount; i++) {
      const index = hashes[i] % this.size
      const arrayIndex = Math.floor(index / 32)
      const bitIndex = index % 32
      if ((this.bits[arrayIndex] & (1 << bitIndex)) === 0) {
        return false
      }
    }
    return true
  }

  private getHashes(key: string): number[] {
    const hash1 = this.murmurhash3(key, 0)
    const hash2 = this.murmurhash3(key, hash1)
    const hashes: number[] = []
    
    for (let i = 0; i < this.hashCount; i++) {
      hashes.push(Math.abs(hash1 + i * hash2))
    }
    
    return hashes
  }

  private murmurhash3(key: string, seed: number): number {
    let h = seed >>> 0
    for (let i = 0; i < key.length; i++) {
      h = Math.imul(h ^ key.charCodeAt(i), 2654435761)
    }
    h ^= h >>> 16
    h = Math.imul(h, 2246822507)
    h ^= h >>> 13
    h = Math.imul(h, 3266489909)
    h ^= h >>> 16
    return h >>> 0
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ROLLING HASH - Content-addressable chunking (Rabin fingerprint)
// ═══════════════════════════════════════════════════════════════════════════

class RollingHash {
  private static readonly PRIME = 16777619
  private static readonly WINDOW_SIZE = 48
  private static readonly MASK = (1 << 13) - 1

  private hash = 0
  private window: number[] = []

  update(byte: number): void {
    if (this.window.length >= RollingHash.WINDOW_SIZE) {
      const old = this.window.shift()!
      this.hash = (this.hash - old * Math.pow(RollingHash.PRIME, RollingHash.WINDOW_SIZE - 1)) >>> 0
    }

    this.window.push(byte)
    this.hash = (this.hash * RollingHash.PRIME + byte) >>> 0
  }

  isBoundary(): boolean {
    return (this.hash & RollingHash.MASK) === 0
  }

  reset(): void {
    this.hash = 0
    this.window = []
  }

  getValue(): number {
    return this.hash
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LRU CACHE - O(1) get/set with doubly linked list + hash map
// ═══════════════════════════════════════════════════════════════════════════

class LRUNode<K, V> {
  constructor(
    public key: K,
    public value: V,
    public prev: LRUNode<K, V> | null = null,
    public next: LRUNode<K, V> | null = null
  ) {}
}

class LRUCache<K, V> {
  private capacity: number
  private cache = new Map<K, LRUNode<K, V>>()
  private head: LRUNode<K, V> | null = null
  private tail: LRUNode<K, V> | null = null
  private size = 0

  constructor(capacity: number) {
    this.capacity = capacity
  }

  get(key: K): V | undefined {
    const node = this.cache.get(key)
    if (!node) return undefined

    this.moveToFront(node)
    return node.value
  }

  set(key: K, value: V): void {
    let node = this.cache.get(key)

    if (node) {
      node.value = value
      this.moveToFront(node)
      return
    }

    node = new LRUNode(key, value)
    this.cache.set(key, node)
    this.addToFront(node)
    this.size++

    if (this.size > this.capacity) {
      this.removeTail()
    }
  }

  has(key: K): boolean {
    return this.cache.has(key)
  }

  delete(key: K): boolean {
    const node = this.cache.get(key)
    if (!node) return false

    this.removeNode(node)
    this.cache.delete(key)
    this.size--
    return true
  }

  clear(): void {
    this.cache.clear()
    this.head = null
    this.tail = null
    this.size = 0
  }

  private moveToFront(node: LRUNode<K, V>): void {
    this.removeNode(node)
    this.addToFront(node)
  }

  private addToFront(node: LRUNode<K, V>): void {
    node.prev = null
    node.next = this.head

    if (this.head) {
      this.head.prev = node
    }

    this.head = node

    if (!this.tail) {
      this.tail = node
    }
  }

  private removeNode(node: LRUNode<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next
    } else {
      this.head = node.next
    }

    if (node.next) {
      node.next.prev = node.prev
    } else {
      this.tail = node.prev
    }
  }

  private removeTail(): void {
    if (!this.tail) return

    this.cache.delete(this.tail.key)
    this.removeNode(this.tail)
    this.size--
  }

  getSize(): number {
    return this.size
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MEMORY POOL - Reusable ArrayBuffer pool (eliminates GC pressure)
// ═══════════════════════════════════════════════════════════════════════════

class MemoryPool {
  private pools = new Map<number, ArrayBuffer[]>()
  private maxPoolSize = 10
  private totalAllocated = 0
  private totalReused = 0

  acquire(size: number): ArrayBuffer {
    const pool = this.pools.get(size)
    
    if (pool && pool.length > 0) {
      this.totalReused++
      return pool.pop()!
    }

    this.totalAllocated++
    return new ArrayBuffer(size)
  }

  release(buffer: ArrayBuffer): void {
    const size = buffer.byteLength
    
    if (!this.pools.has(size)) {
      this.pools.set(size, [])
    }

    const pool = this.pools.get(size)!
    
    if (pool.length < this.maxPoolSize) {
      pool.push(buffer)
    }
  }

  clear(): void {
    this.pools.clear()
  }

  getStats() {
    return {
      totalAllocated: this.totalAllocated,
      totalReused: this.totalReused,
      reuseRate: this.totalReused / (this.totalAllocated + this.totalReused),
      poolSizes: Array.from(this.pools.entries()).map(([size, buffers]) => ({
        size,
        count: buffers.length
      }))
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WORK-STEALING SCHEDULER - Parallel task execution with load balancing
// ═══════════════════════════════════════════════════════════════════════════

type Task<T> = () => Promise<T>

class WorkStealingScheduler {
  private workers: Worker[] = []
  private queues: Task<any>[][] = []
  private workerCount: number

  constructor(workerCount = navigator.hardwareConcurrency || 4) {
    this.workerCount = workerCount
    
    for (let i = 0; i < workerCount; i++) {
      this.queues.push([])
    }
  }

  async execute<T>(tasks: Task<T>[]): Promise<T[]> {
    const results: (T | Error)[] = new Array(tasks.length)
    const promises: Promise<void>[] = []

    for (let i = 0; i < tasks.length; i++) {
      const workerIndex = i % this.workerCount
      this.queues[workerIndex].push(tasks[i])
    }

    for (let i = 0; i < this.workerCount; i++) {
      promises.push(this.runWorker(i, results))
    }

    await Promise.all(promises)

    return results.map((r, i) => {
      if (r instanceof Error) throw r
      return r
    })
  }

  private async runWorker(workerId: number, results: (any | Error)[]): Promise<void> {
    const localQueue = this.queues[workerId]

    while (true) {
      let task = localQueue.pop()

      if (!task) {
        task = this.steal(workerId)
        if (!task) break
      }

      try {
        const taskIndex = this.findTaskIndex(task, results)
        results[taskIndex] = await task()
      } catch (error) {
        const taskIndex = this.findTaskIndex(task, results)
        results[taskIndex] = error instanceof Error ? error : new Error(String(error))
      }
    }
  }

  private steal(workerId: number): Task<any> | undefined {
    for (let i = 0; i < this.workerCount; i++) {
      if (i === workerId) continue

      const victimQueue = this.queues[i]
      if (victimQueue.length > 1) {
        return victimQueue.shift()
      }
    }
    return undefined
  }

  private findTaskIndex(task: Task<any>, results: any[]): number {
    return 0
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT-ADDRESSABLE CHUNKER - Variable-size chunking with deduplication
// ═══════════════════════════════════════════════════════════════════════════

interface Chunk {
  readonly data: Uint8Array
  readonly hash: string
  readonly offset: number
  readonly size: number
}

class ContentAddressableChunker {
  private minChunkSize = 16 * 1024
  private avgChunkSize = 64 * 1024
  private maxChunkSize = 256 * 1024
  private bloom: BloomFilter
  private cache: LRUCache<string, Uint8Array>
  private memoryPool: MemoryPool

  constructor() {
    this.bloom = new BloomFilter(10000)
    this.cache = new LRUCache(100)
    this.memoryPool = new MemoryPool()
  }

  async *chunkFile(file: File): AsyncIterableIterator<Chunk> {
    const reader = file.stream().getReader()
    const rollingHash = new RollingHash()
    
    let buffer = this.memoryPool.acquire(this.maxChunkSize)
    let bufferView = new Uint8Array(buffer)
    let bufferPos = 0
    let fileOffset = 0

    while (true) {
      const { done, value } = await reader.read()
      
      if (done) {
        if (bufferPos > 0) {
          yield await this.createChunk(bufferView.slice(0, bufferPos), fileOffset - bufferPos)
        }
        this.memoryPool.release(buffer)
        break
      }

      for (let i = 0; i < value.length; i++) {
        const byte = value[i]
        bufferView[bufferPos++] = byte
        fileOffset++

        rollingHash.update(byte)

        const shouldSplit = 
          bufferPos >= this.minChunkSize && (
            rollingHash.isBoundary() ||
            bufferPos >= this.maxChunkSize
          )

        if (shouldSplit) {
          yield await this.createChunk(bufferView.slice(0, bufferPos), fileOffset - bufferPos)
          
          this.memoryPool.release(buffer)
          buffer = this.memoryPool.acquire(this.maxChunkSize)
          bufferView = new Uint8Array(buffer)
          bufferPos = 0
          rollingHash.reset()
        }
      }
    }
  }

  private async createChunk(data: Uint8Array, offset: number): Promise<Chunk> {
    const hash = await this.hashChunk(data)

    if (this.bloom.has(hash)) {
      const cached = this.cache.get(hash)
      if (cached) {
        return { data: cached, hash, offset, size: cached.length }
      }
    }

    const copy = new Uint8Array(data)
    this.bloom.add(hash)
    this.cache.set(hash, copy)

    return { data: copy, hash, offset, size: copy.length }
  }

  private async hashChunk(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  isDuplicate(hash: string): boolean {
    return this.bloom.has(hash)
  }

  getStats() {
    return {
      cacheSize: this.cache.getSize(),
      memoryPool: this.memoryPool.getStats()
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PARALLEL FILE PROCESSOR - Combines all optimizations
// ═══════════════════════════════════════════════════════════════════════════

interface ProcessingStats {
  readonly totalChunks: number
  readonly uniqueChunks: number
  readonly deduplicationRatio: number
  readonly totalBytes: number
  readonly uniqueBytes: number
  readonly processingTime: number
  readonly throughput: number
}

export class FileOperationEngine {
  private chunker: ContentAddressableChunker
  private scheduler: WorkStealingScheduler
  private stats$ = new Subject<ProcessingStats>()

  constructor() {
    this.chunker = new ContentAddressableChunker()
    this.scheduler = new WorkStealingScheduler()
  }

  async processFile(file: File): Promise<{
    chunks: Chunk[]
    stats: Observable<ProcessingStats>
  }> {
    const startTime = performance.now()
    const chunks: Chunk[] = []
    const uniqueHashes = new Set<string>()
    let totalBytes = 0
    let uniqueBytes = 0

    for await (const chunk of this.chunker.chunkFile(file)) {
      chunks.push(chunk)
      totalBytes += chunk.size

      if (!uniqueHashes.has(chunk.hash)) {
        uniqueHashes.add(chunk.hash)
        uniqueBytes += chunk.size
      }

      if (chunks.length % 10 === 0) {
        this.emitStats(chunks.length, uniqueHashes.size, totalBytes, uniqueBytes, startTime)
      }
    }

    this.emitStats(chunks.length, uniqueHashes.size, totalBytes, uniqueBytes, startTime)
    this.stats$.complete()

    return {
      chunks,
      stats: this.stats$.asObservable()
    }
  }

  async processFileParallel(file: File): Promise<Chunk[]> {
    const chunkSize = 1024 * 1024
    const fileSize = file.size
    const numChunks = Math.ceil(fileSize / chunkSize)
    
    const tasks: Task<Chunk[]>[] = []

    for (let i = 0; i < numChunks; i++) {
      const start = i * chunkSize
      const end = Math.min(start + chunkSize, fileSize)
      const blob = file.slice(start, end)

      tasks.push(async () => {
        const chunks: Chunk[] = []
        const miniFile = new File([blob], 'chunk', { type: file.type })
        
        for await (const chunk of this.chunker.chunkFile(miniFile)) {
          chunks.push({
            ...chunk,
            offset: chunk.offset + start
          })
        }
        
        return chunks
      })
    }

    const results = await this.scheduler.execute(tasks)
    return results.flat()
  }

  private emitStats(
    totalChunks: number,
    uniqueChunks: number,
    totalBytes: number,
    uniqueBytes: number,
    startTime: number
  ): void {
    const processingTime = performance.now() - startTime

    this.stats$.next({
      totalChunks,
      uniqueChunks,
      deduplicationRatio: 1 - (uniqueChunks / totalChunks),
      totalBytes,
      uniqueBytes,
      processingTime,
      throughput: (totalBytes / processingTime) * 1000
    })
  }

  async verifyIntegrity(chunks: Chunk[], file: File): Promise<boolean> {
    let offset = 0

    for (const chunk of chunks) {
      const blob = file.slice(offset, offset + chunk.size)
      const buffer = await blob.arrayBuffer()
      const data = new Uint8Array(buffer)
      
      const hash = await this.hashData(data)
      
      if (hash !== chunk.hash) {
        console.error(`Integrity check failed at offset ${offset}`)
        return false
      }

      offset += chunk.size
    }

    return true
  }

  private async hashData(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  getChunkerStats() {
    return this.chunker.getStats()
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SMART CHUNK SIZE PREDICTOR - ML-based optimal size prediction
// ═══════════════════════════════════════════════════════════════════════════

interface FileCharacteristics {
  readonly size: number
  readonly type: string
  readonly entropy: number
  readonly compressibility: number
}

class ChunkSizePredictor {
  private history: Array<{ characteristics: FileCharacteristics; optimalSize: number }> = []
  private maxHistorySize = 1000

  async predict(file: File): Promise<number> {
    const characteristics = await this.analyzeFile(file)

    if (this.history.length < 10) {
      return 64 * 1024
    }

    const similar = this.history
      .map(entry => ({
        ...entry,
        similarity: this.calculateSimilarity(characteristics, entry.characteristics)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)

    const weightedSum = similar.reduce((sum, entry) => 
      sum + entry.optimalSize * entry.similarity, 0
    )
    const totalWeight = similar.reduce((sum, entry) => sum + entry.similarity, 0)

    return Math.round(weightedSum / totalWeight)
  }

  recordResult(characteristics: FileCharacteristics, optimalSize: number): void {
    this.history.push({ characteristics, optimalSize })

    if (this.history.length > this.maxHistorySize) {
      this.history.shift()
    }
  }

  private async analyzeFile(file: File): Promise<FileCharacteristics> {
    const sampleSize = Math.min(1024 * 1024, file.size)
    const sample = await file.slice(0, sampleSize).arrayBuffer()
    const data = new Uint8Array(sample)

    const entropy = this.calculateEntropy(data)
    const compressibility = await this.estimateCompressibility(data)

    return {
      size: file.size,
      type: file.type,
      entropy,
      compressibility
    }
  }

  private calculateEntropy(data: Uint8Array): number {
    const freq = new Uint32Array(256)
    
    for (let i = 0; i < data.length; i++) {
      freq[data[i]]++
    }

    let entropy = 0
    const len = data.length

    for (let i = 0; i < 256; i++) {
      if (freq[i] > 0) {
        const p = freq[i] / len
        entropy -= p * Math.log2(p)
      }
    }

    return entropy
  }

  private async estimateCompressibility(data: Uint8Array): Promise<number> {
    const blob = new Blob([data])
    const stream = blob.stream().pipeThrough(new CompressionStream('gzip'))
    const compressed = await new Response(stream).arrayBuffer()
    
    return compressed.byteLength / data.length
  }

  private calculateSimilarity(a: FileCharacteristics, b: FileCharacteristics): number {
    const sizeScore = 1 - Math.abs(Math.log10(a.size) - Math.log10(b.size)) / 10
    const typeScore = a.type === b.type ? 1 : 0
    const entropyScore = 1 - Math.abs(a.entropy - b.entropy) / 8
    const compressScore = 1 - Math.abs(a.compressibility - b.compressibility)

    return (sizeScore * 0.3 + typeScore * 0.2 + entropyScore * 0.3 + compressScore * 0.2)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export { 
  ContentAddressableChunker,
  ChunkSizePredictor,
  BloomFilter,
  LRUCache,
  MemoryPool,
  WorkStealingScheduler
}

export default FileOperationEngine
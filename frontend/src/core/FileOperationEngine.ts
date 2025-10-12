/**
 * File Operation Utilities
 *
 * Provides optimized data structures for file processing:
 * - BloomFilter: Probabilistic set membership testing
 * - LRUCache: Least Recently Used cache with O(1) operations
 * - MemoryPool: ArrayBuffer recycling to reduce GC pressure
 */

/**
 * Bloom Filter - Space-efficient probabilistic data structure
 *
 * Characteristics:
 * - Space: O(1) per element (configurable false positive rate)
 * - Time: O(k) where k = number of hash functions
 * - False positives possible, false negatives impossible
 */
export class BloomFilter {
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

/**
 * LRU Cache - O(1) get/set operations
 *
 * Implementation:
 * - Doubly-linked list for ordering
 * - HashMap for O(1) lookups
 * - Evicts least recently used items when capacity reached
 */
class LRUNode<K, V> {
  constructor(
    public key: K,
    public value: V,
    public prev: LRUNode<K, V> | null = null,
    public next: LRUNode<K, V> | null = null
  ) {}
}

export class LRUCache<K, V> {
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

  getSize(): number {
    return this.size
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
}

/**
 * Memory Pool - Reusable ArrayBuffer pool
 *
 * Reduces garbage collection pressure by recycling buffers.
 * Maintains separate pools for each buffer size.
 */
export class MemoryPool {
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

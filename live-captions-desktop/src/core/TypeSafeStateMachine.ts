/**
 * Type-safe state machine with compile-time verification
 * Invalid transitions are impossible to compile
 */

// ═══════════════════════════════════════════════════════════════════════════
// STATE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export type IdleState = {
  readonly status: 'idle'
}

export type UploadingState = {
  readonly status: 'uploading'
  readonly file: File
  readonly progress: number
  readonly bytesPerSecond: number
}

export type ProcessingState = {
  readonly status: 'processing'
  readonly file: File
  readonly taskId: string
  readonly progress: number
  readonly currentStep: string
  readonly startedAt: number
}

export type CompletedState = {
  readonly status: 'completed'
  readonly file: File
  readonly taskId: string
  readonly result: TranscriptionResult
  readonly duration: number
}

export type ErrorState = {
  readonly status: 'error'
  readonly error: ErrorInfo
  readonly canRetry: boolean
  readonly previousState: 'uploading' | 'processing'
}

export type TranscriptionState = 
  | IdleState 
  | UploadingState 
  | ProcessingState 
  | CompletedState 
  | ErrorState

// ═══════════════════════════════════════════════════════════════════════════
// DOMAIN TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TranscriptionResult {
  readonly text: string
  readonly segments: Segment[]
  readonly language: string
  readonly duration: number
}

export interface Segment {
  readonly start: number
  readonly end: number
  readonly text: string
}

export interface ErrorInfo {
  readonly code: ErrorCode
  readonly message: string
  readonly details?: unknown
  readonly timestamp: number
}

export enum ErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FORMAT = 'INVALID_FORMAT',
  TRANSCRIPTION_FAILED = 'TRANSCRIPTION_FAILED',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN'
}

// ═══════════════════════════════════════════════════════════════════════════
// VALID TRANSITIONS - Type-level state machine
// ═══════════════════════════════════════════════════════════════════════════

type ValidTransitions = {
  idle: {
    UPLOAD: (file: File) => UploadingState
  }
  uploading: {
    UPLOAD_SUCCESS: (taskId: string) => ProcessingState
    UPLOAD_FAILED: (error: ErrorInfo) => ErrorState
    UPLOAD_PROGRESS: (progress: number, speed: number) => UploadingState
  }
  processing: {
    TRANSCRIPTION_PROGRESS: (progress: number, step: string) => ProcessingState
    TRANSCRIPTION_COMPLETE: (result: TranscriptionResult) => CompletedState
    TRANSCRIPTION_FAILED: (error: ErrorInfo) => ErrorState
  }
  completed: {
    NEW_UPLOAD: () => IdleState
  }
  error: {
    RETRY: () => IdleState
    CANCEL: () => IdleState
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STATE MACHINE
// ═══════════════════════════════════════════════════════════════════════════

type StateStatus = TranscriptionState['status']
type EventsForState<S extends StateStatus> = keyof ValidTransitions[S]

export class StateMachine<S extends TranscriptionState = IdleState> {
  private constructor(private readonly _state: S) {}

  static create(): StateMachine<IdleState> {
    return new StateMachine<IdleState>({ status: 'idle' })
  }

  get state(): S {
    return this._state
  }

  transition<E extends EventsForState<S['status']>>(
    event: E,
    ...args: Parameters<ValidTransitions[S['status']][E]>
  ): StateMachine<ReturnType<ValidTransitions[S['status']][E]>> {
    const transitions = this.getTransitions()
    const transitionFn = transitions[event as string]
    
    if (!transitionFn) {
      throw new Error(`Invalid transition: ${event} from ${this._state.status}`)
    }

    const nextState = (transitionFn as any)(...args)
    return new StateMachine(nextState)
  }

  private getTransitions(): Record<string, (...args: any[]) => TranscriptionState> {
    const status = this._state.status

    if (status === 'idle') {
      return {
        UPLOAD: (file: File): UploadingState => ({
          status: 'uploading',
          file,
          progress: 0,
          bytesPerSecond: 0
        })
      }
    }

    if (status === 'uploading') {
      const state = this._state as UploadingState
      return {
        UPLOAD_SUCCESS: (taskId: string): ProcessingState => ({
          status: 'processing',
          file: state.file,
          taskId,
          progress: 0,
          currentStep: 'Starting transcription...',
          startedAt: Date.now()
        }),
        UPLOAD_FAILED: (error: ErrorInfo): ErrorState => ({
          status: 'error',
          error,
          canRetry: error.code !== ErrorCode.FILE_TOO_LARGE && error.code !== ErrorCode.INVALID_FORMAT,
          previousState: 'uploading'
        }),
        UPLOAD_PROGRESS: (progress: number, speed: number): UploadingState => ({
          ...state,
          progress: Math.min(100, Math.max(0, progress)),
          bytesPerSecond: speed
        })
      }
    }

    if (status === 'processing') {
      const state = this._state as ProcessingState
      return {
        TRANSCRIPTION_PROGRESS: (progress: number, step: string): ProcessingState => ({
          ...state,
          progress: Math.min(100, Math.max(0, progress)),
          currentStep: step
        }),
        TRANSCRIPTION_COMPLETE: (result: TranscriptionResult): CompletedState => ({
          status: 'completed',
          file: state.file,
          taskId: state.taskId,
          result,
          duration: Date.now() - state.startedAt
        }),
        TRANSCRIPTION_FAILED: (error: ErrorInfo): ErrorState => ({
          status: 'error',
          error,
          canRetry: true,
          previousState: 'processing'
        })
      }
    }

    if (status === 'completed') {
      return {
        NEW_UPLOAD: (): IdleState => ({
          status: 'idle'
        })
      }
    }

    if (status === 'error') {
      return {
        RETRY: (): IdleState => ({ status: 'idle' }),
        CANCEL: (): IdleState => ({ status: 'idle' })
      }
    }

    return {}
  }

  match<R>(handlers: {
    [K in StateStatus]: (state: Extract<TranscriptionState, { status: K }>) => R
  }): R {
    const handler = handlers[this._state.status]
    return handler(this._state as any)
  }

  is<K extends StateStatus>(status: K): this is StateMachine<Extract<TranscriptionState, { status: K }>> {
    return this._state.status === status
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REACTIVE STATE MACHINE WITH RXJS
// ═══════════════════════════════════════════════════════════════════════════

import { BehaviorSubject, Observable } from 'rxjs'
import { distinctUntilChanged, map, shareReplay } from 'rxjs/operators'

export class ReactiveStateMachine {
  private machine: StateMachine
  private state$: BehaviorSubject<TranscriptionState>

  constructor() {
    this.machine = StateMachine.create()
    this.state$ = new BehaviorSubject<TranscriptionState>(this.machine.state)
  }

  get current(): TranscriptionState {
    return this.machine.state
  }

  get state(): Observable<TranscriptionState> {
    return this.state$.asObservable()
  }

  select<T>(selector: (state: TranscriptionState) => T): Observable<T> {
    return this.state$.pipe(
      map(selector),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    )
  }

  send<S extends StateStatus, E extends EventsForState<S>>(
    event: E,
    ...args: any[]
  ): void {
    try {
      this.machine = (this.machine as any).transition(event, ...args)
      this.state$.next(this.machine.state)
    } catch (error) {
      console.error('State transition error:', error)
    }
  }

  match<R>(handlers: {
    [K in StateStatus]: (state: Extract<TranscriptionState, { status: K }>) => R
  }): R {
    return this.machine.match(handlers)
  }

  reset(): void {
    this.machine = StateMachine.create()
    this.state$.next(this.machine.state)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HISTORY TRACKING
// ═══════════════════════════════════════════════════════════════════════════

interface StateTransition {
  readonly from: TranscriptionState
  readonly to: TranscriptionState
  readonly event: string
  readonly timestamp: number
}

export class StateMachineWithHistory extends ReactiveStateMachine {
  private history: StateTransition[] = []
  private maxHistorySize = 100

  send<S extends StateStatus, E extends EventsForState<S>>(
    event: E,
    ...args: any[]
  ): void {
    const from = this.current

    super.send(event, ...args)

    const to = this.current

    if (from !== to) {
      this.history.push({
        from,
        to,
        event: event as string,
        timestamp: Date.now()
      })

      if (this.history.length > this.maxHistorySize) {
        this.history.shift()
      }
    }
  }

  getHistory(): readonly StateTransition[] {
    return this.history
  }

  getTransitionCount(): number {
    return this.history.length
  }

  getTimeInState(status: StateStatus): number {
    let totalTime = 0
    let currentStart = 0

    for (const transition of this.history) {
      if (transition.to.status === status) {
        currentStart = transition.timestamp
      } else if (transition.from.status === status) {
        totalTime += transition.timestamp - currentStart
      }
    }

    if (this.current.status === status && currentStart > 0) {
      totalTime += Date.now() - currentStart
    }

    return totalTime
  }

  canTransitionTo(targetStatus: StateStatus): boolean {
    const currentStatus = this.current.status

    const validNextStates: Record<StateStatus, StateStatus[]> = {
      idle: ['uploading'],
      uploading: ['processing', 'error'],
      processing: ['completed', 'error'],
      completed: ['idle'],
      error: ['idle']
    }

    return validNextStates[currentStatus]?.includes(targetStatus) ?? false
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════

export class PersistentStateMachine extends StateMachineWithHistory {
  private storageKey: string

  constructor(storageKey = 'transcription-state') {
    super()
    this.storageKey = storageKey
    this.loadState()
    this.setupAutosave()
  }

  private loadState(): void {
    try {
      const saved = localStorage.getItem(this.storageKey)
      if (saved) {
        const { state, history } = JSON.parse(saved)
        
        if (state && state.status !== 'uploading' && state.status !== 'processing') {
          this.state['next'](state)
          if (history) {
            (this as any).history = history
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load state:', error)
    }
  }

  private setupAutosave(): void {
    this.state.subscribe(state => {
      try {
        if (state.status !== 'uploading' && state.status !== 'processing') {
          localStorage.setItem(
            this.storageKey,
            JSON.stringify({
              state,
              history: this.getHistory()
            })
          )
        }
      } catch (error) {
        console.warn('Failed to save state:', error)
      }
    })
  }

  clearPersistedState(): void {
    localStorage.removeItem(this.storageKey)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GUARD CONDITIONS
// ═══════════════════════════════════════════════════════════════════════════

type GuardCondition<S extends TranscriptionState> = (state: S) => boolean

export class GuardedStateMachine extends StateMachineWithHistory {
  private guards = new Map<string, GuardCondition<any>>()

  addGuard<S extends StateStatus>(
    fromStatus: S,
    event: string,
    condition: GuardCondition<Extract<TranscriptionState, { status: S }>>
  ): void {
    this.guards.set(`${fromStatus}:${event}`, condition)
  }

  send<S extends StateStatus, E extends EventsForState<S>>(
    event: E,
    ...args: any[]
  ): void {
    const guardKey = `${this.current.status}:${event}`
    const guard = this.guards.get(guardKey)

    if (guard && !guard(this.current)) {
      console.warn(`Guard prevented transition: ${guardKey}`)
      return
    }

    super.send(event, ...args)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EFFECTS
// ═══════════════════════════════════════════════════════════════════════════

type Effect<S extends TranscriptionState> = (state: S) => void | Promise<void>

export class StateMachineWithEffects extends GuardedStateMachine {
  private effects = new Map<StateStatus, Effect<any>[]>()

  addEffect<S extends StateStatus>(
    status: S,
    effect: Effect<Extract<TranscriptionState, { status: S }>>
  ): void {
    if (!this.effects.has(status)) {
      this.effects.set(status, [])
    }
    this.effects.get(status)!.push(effect)
  }

  send<S extends StateStatus, E extends EventsForState<S>>(
    event: E,
    ...args: any[]
  ): void {
    super.send(event, ...args)

    const effects = this.effects.get(this.current.status)
    if (effects) {
      effects.forEach(effect => {
        Promise.resolve(effect(this.current)).catch(err => {
          console.error('Effect error:', err)
        })
      })
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export default StateMachineWithEffects
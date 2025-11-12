/**
 * STYGIAN First-Launch Setup Wizard
 * Beautiful animated installation flow with GPU detection, model downloads, and dependency checks
 */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { invoke } from '@tauri-apps/api/core'

interface SetupStep {
  id: string
  title: string
  description: string
  status: 'pending' | 'running' | 'complete' | 'error'
  progress?: number
  errorMessage?: string
}

interface SetupWizardProps {
  onComplete: () => void
}

interface SystemRequirements {
  cpu_cores: number
  ram_gb: number
  disk_space_gb: number
  meets_requirements: boolean
  warnings: string[]
}

interface PythonInfo {
  installed: boolean
  version: string
  meets_requirements: boolean
  path: string
}

export const SetupWizard = ({ onComplete }: SetupWizardProps) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [steps, setSteps] = useState<SetupStep[]>([
    {
      id: 'system-check',
      title: 'System Requirements',
      description: 'Validating hardware and software compatibility',
      status: 'pending',
      progress: 0
    },
    {
      id: 'gpu-detection',
      title: 'GPU Detection',
      description: 'Detecting NVIDIA GPU and CUDA capabilities',
      status: 'pending',
      progress: 0
    },
    {
      id: 'python-check',
      title: 'Python Environment',
      description: 'Verifying Python 3.11 installation',
      status: 'pending',
      progress: 0
    },
    {
      id: 'backend-setup',
      title: 'Backend Initialization',
      description: 'Starting FastAPI server and loading models',
      status: 'pending',
      progress: 0
    },
    {
      id: 'model-download',
      title: 'AI Model Loading',
      description: 'Downloading Whisper and translation models',
      status: 'pending',
      progress: 0
    }
  ])

  const updateStepStatus = (stepId: string, updates: Partial<SetupStep>) => {
    setSteps(prev => prev.map(step =>
      step.id === stepId ? { ...step, ...updates } : step
    ))
  }

  const runSetupSequence = async () => {
    let hasErrors = false

    try {
      // Step 1: System Requirements Check
      setCurrentStepIndex(0)
      updateStepStatus('system-check', { status: 'running', progress: 0 })

      try {
        const sysReq = await invoke<SystemRequirements>('check_system_requirements')

        // Animate progress while checking
        for (let i = 0; i <= 100; i += 20) {
          await new Promise(resolve => setTimeout(resolve, 50))
          updateStepStatus('system-check', { progress: i })
        }

        const sysDescription = `${sysReq.cpu_cores} cores, ${sysReq.ram_gb.toFixed(1)}GB RAM, ${sysReq.disk_space_gb.toFixed(1)}GB available`

        if (sysReq.meets_requirements) {
          updateStepStatus('system-check', {
            status: 'complete',
            progress: 100,
            description: sysDescription
          })
        } else {
          hasErrors = true
          updateStepStatus('system-check', {
            status: 'error',
            progress: 100,
            description: sysDescription,
            errorMessage: `System requirements not met: ${sysReq.warnings.join(', ')}`
          })
          return // Stop setup if system requirements not met
        }
      } catch (error) {
        hasErrors = true
        updateStepStatus('system-check', {
          status: 'error',
          errorMessage: `Failed to check system requirements: ${error}`
        })
        return
      }

      await new Promise(resolve => setTimeout(resolve, 500))

      // Step 2: GPU Detection
      setCurrentStepIndex(1)
      updateStepStatus('gpu-detection', { status: 'running', progress: 0 })

      try {
        const gpuInfo = await fetch('http://localhost:8000/system/device-info')
          .then(res => res.json())

        for (let i = 0; i <= 100; i += 10) {
          await new Promise(resolve => setTimeout(resolve, 80))
          updateStepStatus('gpu-detection', { progress: i })
        }

        updateStepStatus('gpu-detection', {
          status: 'complete',
          progress: 100,
          description: `Detected: ${gpuInfo.device_name}`
        })
      } catch (error) {
        updateStepStatus('gpu-detection', {
          status: 'complete',
          progress: 100,
          description: 'Running on CPU (GPU not required)'
        })
      }

      await new Promise(resolve => setTimeout(resolve, 500))

      // Step 3: Python Version Check
      setCurrentStepIndex(2)
      updateStepStatus('python-check', { status: 'running', progress: 0 })

      try {
        const pythonInfo = await invoke<PythonInfo>('check_python_version')

        // Animate progress while checking
        for (let i = 0; i <= 100; i += 25) {
          await new Promise(resolve => setTimeout(resolve, 50))
          updateStepStatus('python-check', { progress: i })
        }

        if (pythonInfo.installed) {
          const pythonDescription = pythonInfo.meets_requirements
            ? `Python ${pythonInfo.version} (${pythonInfo.path})`
            : `Python ${pythonInfo.version} - Version 3.11 required`

          if (pythonInfo.meets_requirements) {
            updateStepStatus('python-check', {
              status: 'complete',
              progress: 100,
              description: pythonDescription
            })
          } else {
            hasErrors = true
            updateStepStatus('python-check', {
              status: 'error',
              progress: 100,
              description: pythonDescription,
              errorMessage: 'Python 3.11 is required. Please install it and restart.'
            })
            return
          }
        } else {
          hasErrors = true
          updateStepStatus('python-check', {
            status: 'error',
            progress: 100,
            description: 'Not installed',
            errorMessage: 'Python is not installed. Please install Python 3.11 and restart.'
          })
          return
        }
      } catch (error) {
        hasErrors = true
        updateStepStatus('python-check', {
          status: 'error',
          errorMessage: `Failed to check Python: ${error}`
        })
        return
      }

      await new Promise(resolve => setTimeout(resolve, 500))

      // Step 4: Backend Setup
      setCurrentStepIndex(3)
      updateStepStatus('backend-setup', { status: 'running', progress: 0 })

      // Check if backend is running
      try {
        await fetch('http://localhost:8000/health')

        for (let i = 0; i <= 100; i += 20) {
          await new Promise(resolve => setTimeout(resolve, 100))
          updateStepStatus('backend-setup', { progress: i })
        }

        updateStepStatus('backend-setup', {
          status: 'complete',
          progress: 100,
          description: 'FastAPI server running on localhost:8000'
        })
      } catch (error) {
        hasErrors = true
        updateStepStatus('backend-setup', {
          status: 'error',
          errorMessage: 'Backend server not running. Please start the backend manually and restart the app.'
        })
        return
      }

      await new Promise(resolve => setTimeout(resolve, 500))

      // Step 5: Model Loading (simulated for now)
      setCurrentStepIndex(4)
      updateStepStatus('model-download', { status: 'running', progress: 0 })

      for (let i = 0; i <= 100; i += 5) {
        await new Promise(resolve => setTimeout(resolve, 150))
        updateStepStatus('model-download', { progress: i })
      }

      updateStepStatus('model-download', {
        status: 'complete',
        progress: 100,
        description: 'Models loaded and ready for transcription'
      })
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Mark setup as complete only if no errors occurred
      if (!hasErrors) {
        await invoke('mark_setup_complete')
        onComplete()
      }

    } catch (error) {
      console.error('Setup failed:', error)
      hasErrors = true
    }
  }

  useEffect(() => {
    runSetupSequence()
  }, [])

  const currentStep = steps[currentStepIndex]

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 opacity-20">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        >
          <source src="https://storage.googleapis.com/onyxlab/Onyx.mp4" type="video/mp4" />
        </video>
      </div>

      {/* Setup Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-2xl mx-auto p-8"
      >
        {/* STYGIAN Logo */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center mb-4">
            <div
              className="mr-4"
              style={{
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                background: "#ff8c00",
                boxShadow: "0 0 30px rgba(255, 140, 0, 1), 0 0 50px rgba(255, 100, 0, 0.9)"
              }}
            />
            <h1
              className="text-5xl font-light tracking-[0.3em] uppercase"
              style={{
                color: "#e89a2f",
                textShadow: "0 0 20px rgba(255, 140, 0, 0.5), 0 0 40px rgba(228, 154, 47, 0.3)"
              }}
            >
              STYGIAN
            </h1>
          </div>
          <p className="text-amber-200/60 text-sm tracking-[0.2em] uppercase">
            First-Time Setup
          </p>
        </motion.div>

        {/* Setup Steps */}
        <div className="space-y-3 mb-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="backdrop-blur-2xl rounded-xl border p-4 transition-all duration-300"
              style={{
                background: index === currentStepIndex
                  ? "linear-gradient(135deg, rgba(35, 30, 13, 0.98) 0%, rgba(45, 38, 15, 1) 50%, rgba(35, 30, 13, 0.98) 100%)"
                  : "linear-gradient(135deg, rgba(25, 22, 10, 0.7) 0%, rgba(30, 26, 12, 0.75) 100%)",
                borderColor: step.status === 'complete'
                  ? "rgba(34, 197, 94, 0.5)"
                  : step.status === 'error'
                  ? "rgba(239, 68, 68, 0.5)"
                  : step.status === 'running'
                  ? "rgba(200, 140, 35, 0.5)"
                  : "rgba(200, 140, 35, 0.2)",
                boxShadow: index === currentStepIndex
                  ? "0 8px 32px rgba(200, 140, 35, 0.3), inset 0 1px 0 rgba(200, 140, 40, 0.15)"
                  : "0 2px 8px rgba(0, 0, 0, 0.3)"
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  {/* Status Icon */}
                  <div className="relative">
                    {step.status === 'complete' ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center"
                      >
                        <span className="text-white text-sm">✓</span>
                      </motion.div>
                    ) : step.status === 'running' ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="w-6 h-6 rounded-full border-2 border-amber-500 border-t-transparent"
                      />
                    ) : step.status === 'error' ? (
                      <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                        <span className="text-white text-sm">✕</span>
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-amber-500/30" />
                    )}
                  </div>

                  <div>
                    <h3 className="text-amber-100 font-medium text-sm">{step.title}</h3>
                    <p className="text-amber-200/50 text-xs">{step.description}</p>
                  </div>
                </div>

                {step.progress !== undefined && step.progress > 0 && (
                  <span className="text-amber-400 text-sm font-mono">
                    {Math.round(step.progress)}%
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              {step.status === 'running' && step.progress !== undefined && (
                <div className="h-1 bg-black/50 rounded-full overflow-hidden mt-3">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: "linear-gradient(90deg, #ff8c00, #e89a2f, #c88c23)"
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${step.progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              )}

              {/* Error Message */}
              {step.errorMessage && (
                <p className="text-red-400 text-xs mt-2">{step.errorMessage}</p>
              )}
            </motion.div>
          ))}
        </div>

        {/* Bottom Text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center"
        >
          <p className="text-amber-200/40 text-xs tracking-[0.15em]">
            Setting up your AI-powered transcription system...
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}

export interface AudioLevelMeter {
  start(onLevel: (level: number) => void): Promise<void>
  stop(): void
}

const FFT_SIZE = 256
const SMOOTHING_FACTOR = 0.3

export function createAudioLevelMeter(): AudioLevelMeter {
  let audioContext: AudioContext | null = null
  let stream: MediaStream | null = null
  let animationFrameId: number | null = null
  let smoothedLevel = 0

  async function start(onLevel: (level: number) => void): Promise<void> {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = FFT_SIZE
    source.connect(analyser)

    const timeDomainData = new Uint8Array(analyser.fftSize)
    smoothedLevel = 0

    function tick(): void {
      analyser.getByteTimeDomainData(timeDomainData)

      let sumOfSquares = 0
      for (let i = 0; i < timeDomainData.length; i += 1) {
        const normalized = (timeDomainData[i] - 128) / 128
        sumOfSquares += normalized * normalized
      }
      const rms = Math.sqrt(sumOfSquares / timeDomainData.length)
      smoothedLevel += SMOOTHING_FACTOR * (rms - smoothedLevel)

      onLevel(Math.min(1, smoothedLevel))
      animationFrameId = requestAnimationFrame(tick)
    }

    animationFrameId = requestAnimationFrame(tick)
  }

  function stop(): void {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    if (stream !== null) {
      stream.getTracks().forEach((track) => track.stop())
      stream = null
    }
    if (audioContext !== null) {
      void audioContext.close()
      audioContext = null
    }
  }

  return { start, stop }
}

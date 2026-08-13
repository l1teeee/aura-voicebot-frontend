import type { ChatImagePayload } from '@/domain/ports/chat-gateway'

const MAX_DIMENSION = 1024
const JPEG_QUALITY = 0.72

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen'))
    }
    img.src = url
  })
}

function fitDimensions(width: number, height: number, maxSide: number): { width: number; height: number } {
  if (width <= maxSide && height <= maxSide) {
    return { width, height }
  }
  const scale = maxSide / Math.max(width, height)
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

// Redibuja la foto en un canvas fuera de pantalla para achicarla antes de
// mandarla: las fotos de celular pueden pesar varios MB y el backend solo
// necesita un jpeg liviano para el modelo multimodal.
export async function compressImageFile(file: File): Promise<ChatImagePayload> {
  const image = await loadImage(file)
  const { width, height } = fitDimensions(image.naturalWidth, image.naturalHeight, MAX_DIMENSION)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('No se pudo procesar la imagen')
  }
  context.drawImage(image, 0, 0, width, height)

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  if (!base64) {
    throw new Error('No se pudo procesar la imagen')
  }

  return { mimeType: 'image/jpeg', data: base64 }
}

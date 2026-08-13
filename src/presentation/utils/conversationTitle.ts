interface TitleMessage {
  role: string
  text: string
}

export function conversationTitle(messages: TitleMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === 'user' && message.text.trim())
  const text = firstUserMessage?.text.trim()

  if (!text) return 'Conversación nueva'
  if (text.length <= 58) return text

  // Recorta en el ultimo limite de palabra antes del limite de caracteres,
  // para no cortar una palabra a la mitad.
  const truncated = text.slice(0, 57)
  const lastSpace = truncated.lastIndexOf(' ')
  const cut = lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated
  return `${cut.trimEnd().replace(/[.,;:!?¿¡-]+$/, '')}...`
}

import { describe, it, expect, vi } from 'vitest'
import { runAgent } from '../../lib/whatsapp/agent'

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{
            type: 'text',
            text: JSON.stringify({
              respuesta: 'Hola Juan, tu paquete Nike está en bodega USA.',
              accion: 'ninguna',
              datos_accion: {},
            }),
          }],
        }),
      },
    }
  }),
}))

describe('runAgent', () => {
  it('retorna respuesta y acción válidas', async () => {
    const result = await runAgent(
      '¿Dónde está mi paquete?',
      'CLIENTE:\n  Nombre: Juan\nPAQUETES: Nike Air Max - recibido_usa'
    )
    expect(result.respuesta).toContain('Juan')
    expect(['ninguna', 'registrar_cliente', 'confirmar_envio', 'escalar'])
      .toContain(result.accion)
  })

  it('retorna acción de escalada cuando Claude lo decide', async () => {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    vi.mocked(Anthropic).mockImplementationOnce(function () {
      return {
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [{
              type: 'text',
              text: JSON.stringify({
                respuesta: 'Te conecto con el equipo 🙏',
                accion: 'escalar',
                datos_accion: { motivo: 'queja por daño', kommo_contact_id: 123 },
              }),
            }],
          }),
        },
      }
    } as any)

    const result = await runAgent('Mi paquete llegó dañado, quiero hablar con alguien', 'CLIENTE: Juan')
    expect(result.accion).toBe('escalar')
  })

  it('retorna fallback si Claude no devuelve JSON válido', async () => {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    vi.mocked(Anthropic).mockImplementationOnce(function () {
      return {
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'texto sin json' }],
          }),
        },
      }
    } as any)

    const result = await runAgent('hola', 'CLIENTE: Juan')
    expect(result.accion).toBe('ninguna')
    expect(result.respuesta).toBeTruthy()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeAction } from '../../lib/whatsapp/action-executor'
import type { AgentResponse } from '../../types'

const { mockInsert, mockEq, mockUpdate, mockFrom } = vi.hoisted(() => {
  const mockInsert = vi.fn().mockResolvedValue({ error: null })
  const mockEq = vi.fn().mockResolvedValue({ error: null })
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
  const mockFrom = vi.fn().mockReturnValue({
    insert: mockInsert,
    update: mockUpdate,
  })
  return { mockInsert, mockEq, mockUpdate, mockFrom }
})

vi.mock('../../lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: mockFrom,
  }),
}))

vi.mock('../../lib/kommo/client', () => ({
  escalateToHuman: vi.fn().mockResolvedValue(undefined),
}))

describe('executeAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({ insert: mockInsert, update: mockUpdate })
  })

  it('no hace nada para accion ninguna', async () => {
    const response: AgentResponse = {
      respuesta: 'Tu paquete está en USA.',
      accion: 'ninguna',
      datos_accion: {},
    }
    await expect(
      executeAction(response, '+573001234567', 'chat-123', 123)
    ).resolves.toBeUndefined()
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('inserta perfil en Supabase para accion registrar_cliente', async () => {
    const response: AgentResponse = {
      respuesta: 'Te registramos.',
      accion: 'registrar_cliente',
      datos_accion: { nombre: 'Ana García', ciudad: 'medellin', telefono: '+573001234567' },
    }
    await executeAction(response, '+573001234567', 'chat-123', 123)
    expect(mockFrom).toHaveBeenCalledWith('perfiles')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre_completo: 'Ana García',
        ciudad: 'medellin',
        whatsapp: '+573001234567',
      })
    )
  })

  it('actualiza estado del paquete para accion confirmar_envio', async () => {
    const response: AgentResponse = {
      respuesta: 'Confirmado.',
      accion: 'confirmar_envio',
      datos_accion: { paquete_id: 'pkg-uuid-123' },
    }
    await executeAction(response, '+573001234567', 'chat-123', 123)
    expect(mockFrom).toHaveBeenCalledWith('paquetes')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'listo_envio' })
    )
    expect(mockEq).toHaveBeenCalledWith('id', 'pkg-uuid-123')
  })

  it('llama escalateToHuman para accion escalar', async () => {
    const { escalateToHuman } = await import('../../lib/kommo/client')
    const response: AgentResponse = {
      respuesta: 'Te conecto con el equipo.',
      accion: 'escalar',
      datos_accion: { motivo: 'paquete dañado', kommo_contact_id: 456 },
    }
    await executeAction(response, '+573001234567', 'chat-123', 456)
    expect(escalateToHuman).toHaveBeenCalledWith(456, 'chat-123', 'paquete dañado')
  })
})

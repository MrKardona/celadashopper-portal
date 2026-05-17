import { describe, it, expect } from 'vitest'
import { buildContext } from '../../lib/whatsapp/context-builder'
import type { ClienteConPaquetes, ConversacionWhatsapp } from '../../types'

const mockCliente: ClienteConPaquetes = {
  perfil: {
    id: 'uuid-123',
    nombre_completo: 'Juan Pérez',
    email: 'juan@test.com',
    whatsapp: '+573001234567',
    ciudad: 'medellin',
    rol: 'cliente',
    activo: true,
    numero_casilla: 'CS-0042',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  } as any,
  paquetes: [
    {
      id: 'pkg-1',
      cliente_id: 'uuid-123',
      descripcion: 'Nike Air Max',
      tienda: 'Amazon',
      categoria: 'ropa_accesorios',
      estado: 'recibido_usa',
      bodega_destino: 'medellin',
      peso_libras: 1.8,
      peso_facturable: 1.8,
      costo_servicio: 22000,
      factura_pagada: false,
      tracking_casilla: 'CLD-20260401-ABC123',
      created_at: '2026-04-01T00:00:00Z',
      updated_at: '2026-04-25T00:00:00Z',
      fotos_paquetes: [{ id: 'f1', paquete_id: 'pkg-1', url: 'https://storage.supabase.co/foto.jpg', storage_path: 'fotos/foto.jpg', created_at: '2026-04-01T00:00:00Z' }],
    } as any,
  ],
  tarifas: [],
}

const mockHistorial: ConversacionWhatsapp[] = []

describe('buildContext', () => {
  it('incluye el nombre del cliente en el contexto', () => {
    const ctx = buildContext(mockCliente, mockHistorial)
    expect(ctx).toContain('Juan Pérez')
  })

  it('incluye el estado del paquete', () => {
    const ctx = buildContext(mockCliente, mockHistorial)
    expect(ctx).toContain('recibido_usa')
  })

  it('incluye URL de foto cuando existe', () => {
    const ctx = buildContext(mockCliente, mockHistorial)
    expect(ctx).toContain('https://storage.supabase.co/foto.jpg')
  })

  it('indica cliente nuevo cuando no hay perfil', () => {
    const ctx = buildContext(null, mockHistorial)
    expect(ctx).toContain('CLIENTE NUEVO')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { normalizePhone, resolveClient } from '../../lib/whatsapp/client-resolver'

// Mock de Supabase
vi.mock('../../lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

describe('normalizePhone', () => {
  it('normaliza número colombiano sin código de país (10 dígitos)', () => {
    expect(normalizePhone('3001234567')).toBe('+573001234567')
  })

  it('normaliza número con 57 pero sin +', () => {
    expect(normalizePhone('573001234567')).toBe('+573001234567')
  })

  it('deja pasar número ya normalizado', () => {
    expect(normalizePhone('+573001234567')).toBe('+573001234567')
  })
})

describe('resolveClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('busca con teléfono normalizado en Supabase', async () => {
    const { createClient } = await import('../../lib/supabase/server')
    const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null })
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: mockLimit,
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

    await resolveClient('3001234567')

    expect(mockSupabase.from).toHaveBeenCalledWith('perfiles')
  })

  it('retorna null si el cliente no existe', async () => {
    const { createClient } = await import('../../lib/supabase/server')
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

    const result = await resolveClient('+573001234567')
    expect(result).toBeNull()
  })

  it('retorna ClienteConPaquetes si el cliente existe', async () => {
    const { createClient } = await import('../../lib/supabase/server')
    const mockPerfil = {
      id: 'uuid-123',
      nombre_completo: 'Juan Pérez',
      whatsapp: '+573001234567',
      activo: true,
      paquetes: [{ id: 'pkg-1', estado: 'recibido_usa', descripcion: 'Nike Shoes', fotos_paquetes: [] }],
    }
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [mockPerfil], error: null }),
    }
    // Second call is for tarifas
    vi.mocked(createClient).mockResolvedValue({
      ...mockSupabase,
      from: vi.fn((table: string) => {
        if (table === 'categorias_tarifas') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) }
        }
        return mockSupabase
      }),
    } as any)

    const result = await resolveClient('+573001234567')
    expect(result).not.toBeNull()
    expect(result?.perfil.nombre_completo).toBe('Juan Pérez')
    expect(result?.paquetes).toHaveLength(1)
  })
})

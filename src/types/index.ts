export type EstadoPaquete =
  | 'reportado'
  | 'recibido_usa'
  | 'en_consolidacion'
  | 'listo_envio'
  | 'en_transito'
  | 'en_colombia'
  | 'en_bodega_local'
  | 'en_camino_cliente'
  | 'entregado'
  | 'retenido'
  | 'devuelto'

export type CategoriaProducto =
  | 'celular'
  | 'computador'
  | 'ipad_tablet'
  | 'calzado'
  | 'ropa_accesorios'
  | 'electrodomestico'
  | 'juguetes'
  | 'cosmeticos'
  | 'perfumeria'
  | 'suplementos'
  | 'libros'
  | 'tarifa_especial'
  | 'otro'

export type BodegaDestino = 'medellin' | 'bogota' | 'barranquilla'
export type RolUsuario = 'cliente' | 'agente_usa' | 'admin'

export interface Perfil {
  id: string
  nombre_completo: string
  email: string
  telefono?: string
  whatsapp?: string
  numero_casilla?: string
  ciudad?: string
  rol: RolUsuario
  activo: boolean
  created_at: string
  updated_at: string
}

export interface Paquete {
  id: string
  cliente_id: string
  tracking_origen?: string
  tienda: string
  descripcion: string
  categoria: CategoriaProducto
  valor_declarado?: number
  fecha_compra?: string
  fecha_estimada_llegada?: string
  notas_cliente?: string
  tracking_casilla?: string
  tracking_usaco?: string
  peso_libras?: number
  peso_facturable?: number
  estado: EstadoPaquete
  bodega_destino: BodegaDestino
  consolidacion_id?: string
  costo_servicio?: number
  factura_pagada: boolean
  fecha_recepcion_usa?: string
  fecha_entrega?: string
  created_at: string
  updated_at: string
  perfiles?: Perfil
  fotos_paquetes?: FotoPaquete[]
  eventos_paquete?: EventoPaquete[]
}

export interface FotoPaquete {
  id: string
  paquete_id: string
  url: string
  storage_path: string
  descripcion?: string
  created_at: string
}

export interface EventoPaquete {
  id: string
  paquete_id: string
  estado_anterior?: EstadoPaquete
  estado_nuevo: EstadoPaquete
  descripcion?: string
  ubicacion?: string
  created_at: string
}

export interface TarifaCategoria {
  id: string
  categoria: CategoriaProducto
  nombre_display: string
  tarifa_por_libra: number
  precio_fijo?: number
  tarifa_tipo: 'por_libra' | 'fijo_por_unidad' | 'especial'
  seguro_porcentaje: number
  descripcion?: string
  activo: boolean
}

export interface Notificacion {
  id: string
  cliente_id: string
  paquete_id?: string
  tipo: string
  titulo: string
  mensaje: string
  leida: boolean
  created_at: string
}

export const ESTADO_LABELS: Record<EstadoPaquete, string> = {
  reportado: 'Reportado',
  recibido_usa: 'Recibido en USA',
  en_consolidacion: 'En Consolidación',
  listo_envio: 'Listo para Envío',
  en_transito: 'En Tránsito',
  en_colombia: 'En Colombia',
  en_bodega_local: 'En Bodega Local',
  en_camino_cliente: 'En Camino',
  entregado: 'Entregado',
  retenido: 'Retenido',
  devuelto: 'Devuelto',
}

export const ESTADO_COLORES: Record<EstadoPaquete, string> = {
  reportado: 'bg-gray-100 text-gray-700',
  recibido_usa: 'bg-blue-100 text-blue-700',
  en_consolidacion: 'bg-yellow-100 text-yellow-700',
  listo_envio: 'bg-purple-100 text-purple-700',
  en_transito: 'bg-orange-100 text-orange-700',
  en_colombia: 'bg-cyan-100 text-cyan-700',
  en_bodega_local: 'bg-indigo-100 text-indigo-700',
  en_camino_cliente: 'bg-lime-100 text-lime-700',
  entregado: 'bg-green-100 text-green-700',
  retenido: 'bg-red-100 text-red-700',
  devuelto: 'bg-rose-100 text-rose-700',
}

export const CATEGORIA_LABELS: Record<CategoriaProducto, string> = {
  celular: 'Celular',
  computador: 'Computador',
  ipad_tablet: 'iPad / Tablet',
  calzado: 'Calzado / Zapatos',
  ropa_accesorios: 'Ropa y Accesorios',
  electrodomestico: 'Electrodoméstico',
  juguetes: 'Juguetes',
  cosmeticos: 'Cosméticos',
  perfumeria: 'Perfumería',
  suplementos: 'Suplementos',
  libros: 'Libros',
  tarifa_especial: 'Tarifa especial (se calcula cuando se haga consolidación completa)',
  otro: 'Otro',
}

// ============================================================
// TIPOS: Agente WhatsApp
// ============================================================

export interface ConversacionWhatsapp {
  id: string
  cliente_id: string | null
  telefono: string
  rol: 'cliente' | 'agente' | 'sistema'
  mensaje: string
  accion_ejecutada: AccionAgente | null
  escalada: boolean
  created_at: string
}

export interface PlantillaNotificacion {
  id: string
  evento: EventoNotificacion
  texto_plantilla: string
  activa: boolean
  created_at: string
}

export type EventoNotificacion =
  | 'paquete_recibido_usa'
  | 'paquete_en_transito'
  | 'paquete_listo_recoger'

export type AccionAgente =
  | 'ninguna'
  | 'registrar_cliente'
  | 'confirmar_envio'
  | 'escalar'

export interface AgentResponse {
  respuesta: string
  accion: AccionAgente
  datos_accion: RegistrarClienteData | ConfirmarEnvioData | EscalarData | Record<string, never>
}

export interface RegistrarClienteData {
  nombre: string
  ciudad: BodegaDestino
  telefono: string
  email?: string
}

export interface ConfirmarEnvioData {
  paquete_id: string
}

export interface EscalarData {
  motivo: string
  kommo_contact_id: number
}

export interface ClienteConPaquetes {
  perfil: Perfil
  paquetes: Paquete[]
  tarifas: TarifaCategoria[]
}

export interface KommoWebhookPayload {
  account: { id: number; subdomain: string }
  message: {
    add?: KommoIncomingMessage[]
  }
}

export interface KommoIncomingMessage {
  id: string
  chat_id: string
  contact_id: number
  author_id: number
  author_type: 'contact' | 'user' | 'bot'
  type: 'text' | 'image' | 'audio' | 'video' | 'file' | 'sticker'
  text?: string
  media?: { url: string }
  created_at: number
}

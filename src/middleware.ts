import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Cliente admin creado dentro de la función para compatibilidad con Edge Runtime
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Rutas publicas (incluye subrutas: /recuperar/codigo, /recuperar/cualquier-cosa)
  const publicPaths = ['/login', '/register', '/recuperar', '/nueva-contrasena', '/']
  const isPublic = publicPaths.some(p =>
    pathname === p ||
    (p !== '/' && pathname.startsWith(p + '/')),
  ) || pathname.startsWith('/api/auth')
    || pathname.startsWith('/api/whatsapp')
    || pathname.startsWith('/api/shopify')
    || pathname.startsWith('/api/kommo')

  if (!user && !isPublic) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Rutas que requieren verificar el rol
  const necesitaRol =
    (user && (pathname === '/login' || pathname === '/register')) ||
    (user && pathname === '/dashboard') ||
    (user && (pathname.startsWith('/admin') || pathname.startsWith('/agente')))

  if (necesitaRol) {
    const { data: perfil } = await supabaseAdmin
      .from('perfiles')
      .select('rol')
      .eq('id', user!.id)
      .single()

    const rol = perfil?.rol ?? 'cliente'

    // Login/register → redirigir según rol
    if (pathname === '/login' || pathname === '/register') {
      if (rol === 'admin') return NextResponse.redirect(new URL('/admin/paquetes', request.url))
      if (rol === 'agente_usa') return NextResponse.redirect(new URL('/agente', request.url))
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Admin en /dashboard → mandarlo a su área
    if (pathname === '/dashboard' && rol === 'admin') {
      return NextResponse.redirect(new URL('/admin/paquetes', request.url))
    }
    if (pathname === '/dashboard' && rol === 'agente_usa') {
      return NextResponse.redirect(new URL('/agente', request.url))
    }

    // Proteger rutas /admin y /agente
    if (pathname.startsWith('/admin') && rol !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    if (pathname.startsWith('/agente') && !['admin', 'agente_usa'].includes(rol)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}

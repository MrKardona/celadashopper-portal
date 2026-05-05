-- 20260505_handle_new_user_full_metadata.sql
-- Trigger handle_new_user ahora lee TODOS los campos del raw_user_meta_data
-- al crear un usuario nuevo. Antes solo leía nombre_completo y los demás
-- campos quedaban en NULL, lo que dejaba al cliente con avisos persistentes
-- de "configurar WhatsApp" y "agregar dirección" aunque los hubiera
-- llenado en el formulario de registro.
--
-- El bug raíz: cuando email confirmation está activa, supabase.auth.signUp
-- NO crea sesión inmediata, y el UPDATE post-signUp del cliente fallaba
-- por RLS sin reportar error. La solución es persistir todo desde el
-- trigger SECURITY DEFINER que sí tiene permisos.

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.perfiles (
    id,
    email,
    numero_casilla,
    nombre_completo,
    telefono,
    whatsapp,
    ciudad,
    direccion,
    barrio,
    referencia
  )
  VALUES (
    NEW.id,
    NEW.email,
    'CS-' || LPAD(CAST(nextval('public.casilla_seq') AS TEXT), 4, '0'),
    COALESCE(NEW.raw_user_meta_data->>'nombre_completo', 'Usuario'),
    NULLIF(NEW.raw_user_meta_data->>'telefono', ''),
    NULLIF(NEW.raw_user_meta_data->>'whatsapp', ''),
    NULLIF(NEW.raw_user_meta_data->>'ciudad', ''),
    NULLIF(NEW.raw_user_meta_data->>'direccion', ''),
    NULLIF(NEW.raw_user_meta_data->>'barrio', ''),
    NULLIF(NEW.raw_user_meta_data->>'referencia', '')
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Error en handle_new_user: %', SQLERRM;
  RETURN NEW;
END;
$function$;

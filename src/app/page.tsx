import { redirect } from 'next/navigation';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import { createClient } from '@/lib/supabase/server';
import type { Profile, Project } from '@/lib/types';

/** Pantalla de una sola frase, para los estados en los que no hay nada que hacer. */
function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold mb-2">{titulo}</h1>
        <p className="text-sm text-slate-500 mb-4">{texto}</p>
        <form action="/logout" method="post">
          <button className="text-sm text-blue-600 hover:underline cursor-pointer" type="submit">
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // El perfil y los proyectos van en paralelo: la política RLS de projects ya
  // limita al cliente a los suyos, así que la consulta no necesita esperar a
  // conocer el client_id del perfil.
  const [{ data: profile, error: profileError }, { data: projects }] = await Promise.all([
    // maybeSingle y no single: con single, "no hay filas" también llega como
    // error (PGRST116), y entonces no se puede distinguir un perfil que falta
    // de una consulta que falló. Con maybeSingle, un error es un error.
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle<Profile>(),
    supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: true })
      .returns<Project[]>(),
  ]);

  // No redirigir a /login en ninguno de los dos casos de abajo: el usuario ya
  // está autenticado, así que el proxy lo rebotaría de vuelta a "/" y quedaría
  // en bucle.

  // Caso 1: la consulta falló. Antes esto se presentaba como "no se encontró
  // tu perfil", que es un diagnóstico inventado: la app no había comprobado
  // que el perfil faltara, solo que no lo tenía. Mandó a buscar el problema
  // en el sitio equivocado.
  if (profileError) {
    console.error('Home: no se pudo leer el perfil:', profileError);
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold mb-2">No pudimos cargar tu cuenta</h1>
          <p className="text-sm text-slate-500 mb-4">
            Hubo un problema al leer tus datos. Vuelve a intentarlo en un momento; si
            sigue pasando, avísanos con este detalle:
          </p>
          <p className="text-xs text-slate-400 font-mono mb-4 break-words">
            {profileError.message}
          </p>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            Reintentar
          </Link>
        </div>
      </div>
    );
  }

  // Caso 2: la consulta funcionó y de verdad no hay perfil. Pasa si el trigger
  // que lo crea no corrió para esta cuenta.
  if (!profile) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold mb-2">No se encontró tu perfil</h1>
          <p className="text-sm text-slate-500 mb-4">
            Tu cuenta existe pero no tiene un perfil asociado en la base de datos.
            Contacta al administrador para que lo revise.
          </p>
          <form action="/logout" method="post">
            <button className="text-sm text-blue-600 hover:underline cursor-pointer" type="submit">
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (profile.role === 'admin') {
    redirect('/admin');
  }

  // Sin organización todavía: hay que completar el registro.
  if (!profile.client_id) {
    redirect('/registro');
  }

  // Pidió unirse a una organización y su responsable aún no lo aprueba.
  if (profile.member_status === 'pendiente') {
    return (
      <Aviso
        titulo="Solicitud enviada"
        texto="Le pedimos a quien administra la cuenta de tu organización que apruebe tu ingreso. Te avisamos apenas lo haga."
      />
    );
  }

  if (profile.member_status === 'rechazado') {
    return (
      <Aviso
        titulo="Solicitud no aprobada"
        texto="Quien administra la cuenta de tu organización no aprobó tu ingreso. Si crees que es un error, háblalo directamente con esa persona."
      />
    );
  }

  const { data: cliente } = await supabase
    .from('clients')
    .select('status, rejection_reason, name')
    .eq('id', profile.client_id)
    .maybeSingle();

  if (cliente?.status === 'pendiente') {
    return (
      <Aviso
        titulo="Registro en revisión"
        texto={`Estamos verificando los documentos de ${cliente.name}. Es un paso rápido: apenas quede listo te habilitamos y podrás empezar.`}
      />
    );
  }

  if (cliente?.status === 'rechazado') {
    // Quien registró la organización puede corregir y reenviar. El resto del
    // equipo no: no tiene por qué manejar los documentos de la empresa.
    if (profile.is_owner) redirect('/registro/corregir');

    return (
      <Aviso
        titulo="No pudimos verificar el registro"
        texto={`${
          cliente.rejection_reason || 'Hubo un problema con los documentos aportados.'
        } Habla con quien registró la cuenta de tu organización para que lo corrija.`}
      />
    );
  }

  if (projects && projects.length === 1) {
    redirect(`/board/${projects[0].id}`);
  }

  return (
    <>
      <AppHeader isAdmin={false} isOwner={profile.is_owner} />
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <h1 className="text-lg font-semibold mb-4">Tus proyectos</h1>
        {(!projects || projects.length === 0) && (
          <p className="text-sm text-slate-500">Todavía no tienes proyectos asignados.</p>
        )}
        <ul className="space-y-2">
          {projects?.map((p) => (
            <li key={p.id}>
              <Link
                href={`/board/${p.id}`}
                className="block bg-white border border-slate-200 rounded-lg px-4 py-3 hover:border-blue-400"
              >
                {p.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

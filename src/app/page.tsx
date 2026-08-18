import { redirect } from 'next/navigation';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import Aviso from '@/components/Aviso';
import Logo from '@/components/Logo';
import { createClient } from '@/lib/supabase/server';
import type { Profile, Project } from '@/lib/types';

/**
 * Pantalla de una sola frase, para los estados en los que no hay nada que
 * hacer más que esperar. Lleva la marca porque en varios de esos estados es
 * lo único que la persona ve de Jercol Hub durante días.
 */
function PantallaEstado({
  titulo,
  texto,
  tono = 'info',
}: {
  titulo: string;
  texto: string;
  tono?: 'info' | 'aviso' | 'error';
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="bg-tarjeta border border-borde rounded-xl shadow-sm p-8 text-center">
          <div className="flex justify-center mb-5">
            <Logo tamano="lg" />
          </div>
          <h1 className="text-lg font-semibold mb-2">{titulo}</h1>
          <Aviso tipo={tono} className="text-left">
            {texto}
          </Aviso>
          <form action="/logout" method="post" className="mt-5">
            <button className="text-sm text-tinta-suave hover:text-tinta" type="submit">
              Cerrar sesión
            </button>
          </form>
        </div>
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
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-tarjeta border border-borde rounded-xl shadow-sm p-8 text-center">
          <div className="flex justify-center mb-5">
            <Logo tamano="lg" />
          </div>
          <h1 className="text-lg font-semibold mb-2">No pudimos cargar tu cuenta</h1>
          <Aviso className="text-left">
            Hubo un problema al leer tus datos. Vuelve a intentarlo en un momento; si sigue
            pasando, avísanos con este detalle:
            <span className="block font-mono text-xs mt-2 break-words opacity-80">
              {profileError.message}
            </span>
          </Aviso>
          <Link
            href="/"
            className="inline-block mt-5 text-sm text-azul hover:underline underline-offset-2"
          >
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
      <PantallaEstado
        titulo="No se encontró tu perfil"
        texto="Tu cuenta existe pero no tiene un perfil asociado en la base de datos. Contacta al administrador para que lo revise."
        tono="error"
      />
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
      <PantallaEstado
        titulo="Solicitud enviada"
        texto="Le pedimos a quien administra la cuenta de tu organización que apruebe tu ingreso. Te avisamos apenas lo haga."
      />
    );
  }

  if (profile.member_status === 'rechazado') {
    return (
      <PantallaEstado
        titulo="Solicitud no aprobada"
        texto="Quien administra la cuenta de tu organización no aprobó tu ingreso. Si crees que es un error, háblalo directamente con esa persona."
        tono="aviso"
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
      <PantallaEstado
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
      <PantallaEstado
        titulo="No pudimos verificar el registro"
        texto={`${
          cliente.rejection_reason || 'Hubo un problema con los documentos aportados.'
        } Habla con quien registró la cuenta de tu organización para que lo corrija.`}
        tono="aviso"
      />
    );
  }

  if (projects && projects.length === 1) {
    redirect(`/board/${projects[0].id}`);
  }

  return (
    <>
      <AppHeader isAdmin={false} isOwner={profile.is_owner} />
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <h1 className="text-xl font-semibold mb-1">Tus proyectos</h1>
        <p className="text-sm text-tinta-suave mb-6">{cliente?.name}</p>

        {(!projects || projects.length === 0) && (
          <Aviso tipo="info">
            Todavía no tienes proyectos asignados. Cuando arranque el primero lo verás aquí.
          </Aviso>
        )}

        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects?.map((p) => (
            <li key={p.id}>
              <Link
                href={`/board/${p.id}`}
                className="group block h-full bg-tarjeta border border-borde rounded-xl p-5 shadow-sm hover:border-azul hover:shadow transition-all"
              >
                <span className="block font-medium group-hover:text-azul transition-colors">
                  {p.name}
                </span>
                <span className="block text-xs text-tinta-suave mt-1">
                  {p.status === 'terminado' ? 'Terminado' : 'En curso'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

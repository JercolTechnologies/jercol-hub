import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ elegir?: string }>;
}) {
  const { elegir } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<Profile>();

  // Si la lectura falla no se bloquea el paso: se muestran las dos opciones y
  // se sigue. Es seguro porque las Server Actions de registro comprueban por
  // su cuenta que quien las llama no tenga ya organización — una página no es
  // un control.
  if (error) console.error('RegistroPage: no se pudo leer el perfil:', error);

  // Quien ya tiene organización no vuelve por aquí.
  if (profile?.client_id) redirect('/');
  if (profile?.role === 'admin') redirect('/admin');

  // El camino se eligió al crear la cuenta, así que normalmente no hay nada
  // que preguntar: se enruta directo. Esta pantalla queda como salida para
  // quien quiera cambiar de camino (?elegir=1) y como respaldo para las
  // cuentas creadas antes de que la elección existiera.
  if (!elegir) {
    const camino = user.user_metadata?.camino;
    if (camino === 'empresa') redirect('/registro/empresa');
    if (camino === 'unirme') redirect('/registro/unirme');
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <h1 className="text-xl font-semibold mb-2">Falta un paso</h1>
        <p className="text-sm text-tinta-suave mb-6">
          Para poder trabajar contigo necesitamos saber a nombre de quién va el proyecto.
        </p>

        <div className="space-y-3">
          <Link
            href="/registro/empresa"
            className="block bg-tarjeta border border-borde rounded-lg p-5 hover:border-azul"
          >
            <div className="font-medium text-sm mb-1">Registrar mi organización</div>
            <p className="text-sm text-tinta-suave">
              Eres el primero de tu empresa (o trabajas como persona natural). Vas a necesitar el
              RUT y la cédula a la mano.
            </p>
          </Link>

          <Link
            href="/registro/unirme"
            className="block bg-tarjeta border border-borde rounded-lg p-5 hover:border-azul"
          >
            <div className="font-medium text-sm mb-1">Unirme a una organización ya registrada</div>
            <p className="text-sm text-tinta-suave">
              Alguien de tu empresa ya la registró. Solo necesitas su NIT; quien la registró
              aprobará tu ingreso.
            </p>
          </Link>
        </div>

        <form action="/logout" method="post" className="mt-6 text-center">
          <button className="text-sm text-tinta-suave hover:underline cursor-pointer" type="submit">
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}

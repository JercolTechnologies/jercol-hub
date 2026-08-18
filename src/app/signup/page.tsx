import Link from 'next/link';
import AuthShell from '@/components/AuthShell';
import Aviso from '@/components/Aviso';
import { Boton, Campo, claseInput } from '@/components/Campo';
import { signup } from './actions';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthShell
      titulo="Crear cuenta"
      descripcion="Un paso y estás dentro."
      conIntro
    >
      {error && <Aviso className="mb-4">{error}</Aviso>}

      <form action={signup} className="space-y-4">
        <fieldset>
          <legend className="text-xs font-semibold text-tinta-suave mb-2">
            ¿Cuál es tu caso?
          </legend>
          <div className="space-y-2">
            <label className="flex gap-3 items-start border border-borde rounded-lg p-3 cursor-pointer transition-colors hover:border-azul/60 has-[:checked]:border-azul has-[:checked]:bg-azul/5">
              <input
                type="radio"
                name="camino"
                value="empresa"
                defaultChecked
                className="mt-0.5 accent-azul cursor-pointer"
              />
              <span className="text-sm">
                <span className="font-medium block">Registro mi organización</span>
                <span className="text-tinta-suave text-xs">
                  Eres el primero de tu empresa, o trabajas como persona natural. Ten a mano
                  el RUT y la cédula.
                </span>
              </span>
            </label>

            <label className="flex gap-3 items-start border border-borde rounded-lg p-3 cursor-pointer transition-colors hover:border-azul/60 has-[:checked]:border-azul has-[:checked]:bg-azul/5">
              <input
                type="radio"
                name="camino"
                value="unirme"
                className="mt-0.5 accent-azul cursor-pointer"
              />
              <span className="text-sm">
                <span className="font-medium block">Me uno a una ya registrada</span>
                <span className="text-tinta-suave text-xs">
                  Alguien de tu empresa la registró antes. Solo necesitas su NIT.
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        <Campo etiqueta="Nombre">
          <input type="text" name="full_name" required className={claseInput} placeholder="Tu nombre" />
        </Campo>

        <Campo etiqueta="Correo">
          <input type="email" name="email" required className={claseInput} placeholder="tu@correo.com" />
        </Campo>

        <Campo etiqueta="Contraseña">
          <input
            type="password"
            name="password"
            required
            minLength={6}
            className={claseInput}
            placeholder="Mínimo 6 caracteres"
          />
        </Campo>

        <Boton type="submit" ancho>
          Crear cuenta
        </Boton>
      </form>

      <p className="mt-5 text-sm text-tinta-suave text-center">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-azul hover:underline underline-offset-2">
          Inicia sesión
        </Link>
      </p>
    </AuthShell>
  );
}

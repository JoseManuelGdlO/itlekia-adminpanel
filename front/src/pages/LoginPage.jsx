import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch {
      setError('Email o contraseña incorrectos');
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      <div className="flex w-full flex-col justify-center bg-rail px-8 py-12 text-primary-foreground lg:w-[44%] lg:px-14">
        <div className="flex items-center gap-8">
          <div>
            <span className="mb-6 flex size-16 items-center justify-center rounded-lg bg-background">
              <img
                src="/intelekia-isotipo.png"
                alt="Intelekia"
                className="size-11 object-contain"
              />
            </span>
            <p className="font-heading text-4xl font-semibold">Intelekia</p>
            <p className="mt-3 text-sm leading-relaxed text-primary-foreground/70">
              Portal administrativo
            </p>
          </div>
          <svg aria-hidden="true" viewBox="0 0 48 180" className="hidden h-44 w-12 shrink-0 lg:block">
            <path d="M8 0 V52 H36 V108 H8 V180" fill="none" stroke="#c9923a" strokeWidth="1.5" />
            <circle cx="8" cy="52" r="3.5" fill="#1f9a7c" />
            <circle cx="36" cy="108" r="3.5" fill="#c9923a" />
          </svg>
        </div>
      </div>
      <div className="flex w-full flex-1 items-center justify-center px-6 py-12">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
          <h1 className="font-heading text-2xl font-semibold">Ingresar</h1>
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="h-10 w-full">
            Ingresar
          </Button>
        </form>
      </div>
    </div>
  );
}

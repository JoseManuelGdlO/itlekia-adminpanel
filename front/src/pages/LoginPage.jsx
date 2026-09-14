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
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex flex-col justify-center bg-rail px-8 py-10 text-primary-foreground lg:w-[42%]">
        <img
          src="/intelekia-isotipo.png"
          alt="Intelekia"
          className="mb-4 size-14 object-contain"
        />
        <p className="font-heading text-3xl font-semibold">Intelekia</p>
        <p className="mt-2 text-sm text-primary-foreground/70">Portal administrativo</p>
      </div>
      <div className="flex flex-1 items-center justify-center bg-card px-6 py-10">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
          <h1 className="font-heading text-xl font-semibold">Ingresar</h1>
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full">
            Ingresar
          </Button>
        </form>
      </div>
    </div>
  );
}

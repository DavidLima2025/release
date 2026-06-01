# SI 6ª CIA - Vercel + Supabase

## Login inicial
- Usuário: ADM6CIA
- Senha: 123456

## Configuração
1. Crie um projeto no Supabase.
2. Abra SQL Editor.
3. Execute `supabase/schema.sql`.
4. No Vercel, configure:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY

## Rodar local
```bash
npm install
cp .env.example .env
npm run dev
```

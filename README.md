# SI 6ª CIA — Controle de demandas

Sistema da Seção de Inteligência da 6ª CIA PM (1º BPM) para controlar demandas no calendário,
workflow, banco de alvos e indicadores. React + Vite + Tailwind + Supabase, com o tema da
"Apresentação Padrão PMMG" (preto, dourado `#9B8A5C`, creme `#F3F0E7`, fonte Rawline/Raleway).

## Funções

- **Painel**: calendário mensal, demandas do dia, criação rápida (clique duplo no dia).
- **Importar BO (PDF)**: lê o boletim do REDS/SIDS (nº, natureza, data/hora, local, envolvidos,
  materiais, guarnição e histórico) e cria a demanda no dia do registro, do fato ou no dia
  selecionado, com o PDF anexado. Aceita vários PDFs de uma vez e avisa se o REDS já foi importado.
- **Demandas**: lista com filtros (situação, responsável, tipo, prioridade, data) e pesquisa no histórico.
- **Status automático**: passou do prazo → *Atrasada*; faltando 2 dias → *Risco de prazo*.
- **Workflow**: quadro por etapa e cadastro/ordem das etapas.
- **Dashboard**, **Banco de alvos**, **Usuários**, **Auditoria** e **Tela TV**.

## Primeira configuração do banco (obrigatório)

1. No Supabase, abra **SQL Editor → New query**, cole o conteúdo de
   `supabase/00_autenticacao_admin.sql` e clique em **Run**. Pode rodar de novo sem problema.
2. Rode também `supabase/demandas_anexos.sql` e `supabase/banco_autores_suspeitos.sql`
   (anexos e banco de alvos), se ainda não rodou.
3. Entre com o administrador inicial e defina a senha pessoal (é obrigatório no 1º acesso):
   - **Login:** `ADM6CIA`
   - **Senha provisória:** `Pmmg@6cia2026`

Se o `ADM6CIA` já existia com uma senha, ela continua valendo. Esqueceu a senha do admin? No
final do script há uma linha comentada que a redefine para a provisória.

## Login, perfis e auditoria

- Senhas guardadas com bcrypt; ninguém (nem o admin) consegue ver a senha de outro usuário.
- Ao entrar, o servidor cria uma **sessão com token** (12 h, renovada com o uso). Usuário
  inativado, excluído ou com senha redefinida sai do sistema na hora.
- 5 senhas erradas seguidas bloqueiam o login por 15 minutos.
- Usuário novo ou com senha redefinida é obrigado a criar a própria senha no primeiro acesso.

| Perfil | Pode |
|---|---|
| Administrador | Tudo: cadastrar/editar/inativar/excluir usuários, redefinir senhas, auditoria |
| Gestor | Demandas, workflow, dashboard, banco de alvos e auditoria |
| Analista | Demandas, dashboard e banco de alvos |
| Colaborador | Demandas e banco de alvos |

Gestão de usuários e leitura da auditoria são conferidas **no banco** (funções SQL), não só
na tela. A auditoria registra logins, falhas, bloqueios, logout, trocas e redefinições de
senha, alterações de usuários, demandas e banco de alvos, com filtro por período, usuário e
categoria, e exportação em CSV (abre no Excel).

## Rodar localmente

```bash
cp .env.example .env   # preencha URL e chave anon do Supabase
npm install
npm run dev
```

## Deploy (Vercel)

Framework Vite, build `npm run build`, saída `dist`. Variáveis: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

## Estrutura

```
src/
  App.tsx               rotas internas e modais
  hooks/useAppData.ts   dados do Supabase e todas as ações
  lib/boletim.ts        leitor do BO (REDS) a partir do texto do PDF
  lib/pdf.ts            extração de texto com pdf.js (carregado sob demanda)
  lib/domain.ts         tipos, permissões, status automático
  lib/dates.ts          datas no fuso local
  views/                telas
  components/           componentes e UI do tema
supabase/               scripts SQL
```

## Segurança — o que ainda falta

Usuários, senhas, sessões e auditoria já estão protegidos no banco. As tabelas operacionais
(demandas, anexos, banco de alvos) ainda aceitam leitura e escrita pela chave pública, como
antes. O próximo passo é exigir a sessão também nessas tabelas (ou migrar para Supabase Auth).

Os scripts antigos `permissoes_usuarios.sql` e `complementar_auditoria.sql` foram removidos:
eles liberavam a edição de usuários pela chave pública. Não rode versões antigas deles.

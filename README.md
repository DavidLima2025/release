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

## Segurança — pendência importante

O login usa a função `login_user` e guarda o usuário no navegador; as políticas RLS liberam as
tabelas para a chave `anon`. Isso significa que quem tiver a chave pública pode ler e alterar os
dados direto na API. Para dados sensíveis, o próximo passo é migrar para **Supabase Auth** e
restringir as políticas RLS a usuários autenticados.

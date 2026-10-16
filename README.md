# MyFinance — código completo

Sistema de acompanhamento financeiro mensal, com cadastro, edição e exclusão de gastos e receitas, categorias, forma de pagamento, resumo mensal, gráficos e exportação CSV.

Este pacote corresponde à versão publicada após a correção de edição e exclusão de gastos e receitas. O código da aplicação foi preservado. Este README foi acrescentado para facilitar a continuidade; o README técnico original está em `docs/README_ORIGINAL.md`.

## Tecnologias

React, TypeScript, Tailwind CSS, Recharts e Lucide na interface. Vinext/Vite com rotas de API, Cloudflare Workers e D1 no servidor, e Drizzle para o esquema e as migrações do banco.

## Começar no VS Code (Windows, macOS ou Linux)

1. Extraia o ZIP e abra a pasta `MyFinance` no VS Code.
2. Instale Node.js compatível com o projeto (mínimo declarado: 22.13.0) e pnpm 11.25.0. As dependências precisam ser baixadas pela internet.
3. No terminal, dentro da pasta que contém `package.json`, execute:

```sh
npm install -g pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm build
```

4. Crie as tabelas do banco **local**, executando uma vez em um banco novo:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_organic_whistler.sql
```

Não repita essa migração em um banco no qual a tabela já existe. Ela cria a tabela, sem inserir dados de exemplo.

5. Inicie o desenvolvimento:

```sh
pnpm dev
```

Abra o endereço informado no terminal (porta padrão 5173). Para parar, pressione Ctrl+C.

## Pastas principais

| Caminho | Conteúdo |
| --- | --- |
| `app/page.tsx` | Tela principal, formulário, gráficos e ações de editar/excluir |
| `app/globals.css` | Estilos globais |
| `app/layout.tsx` | Nome, metadados e estrutura da página |
| `app/api/transactions/route.ts` | Consulta e criação de registros |
| `app/api/transactions/[id]/route.ts` | Edição e exclusão de registros |
| `db/` | Conexão D1 e definição da tabela |
| `drizzle/` | Migração SQL e metadados do esquema |
| `lib/money.ts` | Conversão de valores monetários em centavos |
| `public/` | Logo MyFinance, favicon e demais arquivos estáticos |
| `components/`, `hooks/`, `lib/` | Componentes e utilitários do projeto |
| `build/`, `scripts/` | Integração e comandos de desenvolvimento/compilação |
| `tests/` | Testes de edição, exclusão e valores monetários |
| `examples/`, `vendor/` | Exemplos do template, estilos e licenças incluídos |
| `.openai/hosting.json` | Identidade do site existente e declaração do banco DB |

## Verificação

```sh
node --test tests/transactions.test.cjs
pnpm exec tsc --noEmit
pnpm build
```

Os testes usam um banco simulado em memória para verificar os manipuladores das rotas. Não alteram dados financeiros reais. Os testes e a compilação passaram no ambiente em que o site foi desenvolvido; a instalação no seu computador ainda precisa ser executada.

## Banco de dados e hospedagem

O ZIP contém a estrutura do banco, mas **não contém as receitas e despesas cadastradas no site online**. A base local é separada e começa vazia. Para guardar uma cópia dos registros online, utilize a exportação CSV na área de registros do mês. O sistema atual não oferece importação de CSV.

O projeto utiliza Cloudflare D1; não é um backend PostgreSQL e não funciona apenas abrindo um arquivo HTML. As dependências são instaladas com pnpm. O banco local fica em `.wrangler/state`, criado ao executar os comandos.

Na publicação atual, o acesso privado é controlado pela plataforma Sites. Uma hospedagem independente exige configurar banco, ambiente de execução e controle de acesso próprios. A aplicação atual não separa os registros por usuário.

O identificador em `.openai/hosting.json` pertence ao MyFinance existente. Editar os arquivos localmente não atualiza automaticamente o site publicado. Para outra hospedagem, adapte a configuração do ambiente; a publicação atual usa o fluxo do Sites.

## Conteúdo do pacote

Inclui todas as pastas e arquivos de código versionados, o arquivo de dependências `package.json`, o lockfile `pnpm-lock.yaml`, os testes e os arquivos de configuração necessários. Não inclui `node_modules`, histórico Git, caches, builds gerados ou cópia do banco online. Essas exclusões não removem código-fonte e mantêm o ZIP leve.

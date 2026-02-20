# Mesa de Recibos

Aplicação web (frontend + API) para entrada, consulta, importação e gestão de recibos com PostgreSQL.

## Stack
- Frontend: Vite + React + TypeScript
- API: Express + TypeScript
- DB: PostgreSQL + Prisma

## Funcionalidades implementadas
- Persistência em backend (sem localStorage para dados principais)
- Filtros de tabela por ano, mês, tipo, estado, exequente e gestor
- Vistas guardadas (saved views)
- Ações em lote:
  - alteração de estado
  - edição em lote (gestor, exequente, indicações)
  - recálculo fiscal em lote
- Undo da última ação (estado, edição individual e ações em lote)
- Importação `.xlsx` com:
  - pré-visualização
  - deteção de conflitos
  - estratégias: `skip`, `update`, `duplicate`
- Exportação de snapshot atual da aplicação (`/api/records/export`)
- Cálculos automáticos configuráveis:
  - IVA
  - Retenção
  - Meu 5%
  - Outras taxas
- Auto-cálculo imediato ao preencher `valor indicado` (quando configurado)
- Lista de recentes com modos `Default` e `Lista` (condensada)
- Modal profissional de detalhe/edição de registo (consulta e tabela)

## Configuração local
1. Copiar variáveis de ambiente:
```bash
cp .env.example .env
```

2. (Opcional) Definir token público `logo.dev` para mostrar logótipos de exequentes:
```bash
VITE_LOGO_DEV_TOKEN="pk_J_6gnc2JTzKtdVlXmGyzvA"
```

3. Iniciar PostgreSQL (local ou Docker).

4. Gerar cliente Prisma e criar schema:
```bash
npm run prisma:generate
npm run prisma:push
```

5. Iniciar frontend + API:
```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000`

## Seed de dados
- O botão de seed está no separador `Importar`.
- Também pode usar API:
```bash
curl -X POST http://localhost:4000/api/seed \
  -H 'Content-Type: application/json' \
  -d '{"replace":false}'
```

- Regenerar `public/seed-records.json` diretamente do Excel:
```bash
npm run seed:from-xlsx -- "/Users/miguelbrito/Downloads/RECIBOS EMITIDOS 2025.xlsx"
```

## Notas
- Neste ambiente, o Docker daemon não estava disponível, por isso a migração Prisma não foi executada contra uma base ativa.
- A API arranca e responde em `/api/health`; para persistência completa precisa de PostgreSQL acessível no `DATABASE_URL`.

## Deployment
- Plano detalhado: `DEPLOYMENT_PLAN.md`

## DS Module Planning
- Plano formal: `DS_MODULE_PLAN.md`

## Future-Proofing Roadmap (API-first)
Backlog para evoluir a app com integrações externas e estabilidade de longo prazo.

- [ ] Versionar API (`/api/v1/...`) antes de mudanças breaking.
- [ ] Adicionar autenticação e autorização (JWT/sessão + roles).
- [ ] Publicar contrato OpenAPI/Swagger para integrações.
- [ ] Criar API keys e/ou webhooks para integrações externas.
- [ ] Tornar importações e ações em lote idempotentes.
- [ ] Adicionar audit log (quem alterou, quando, antes/depois).
- [ ] Implementar soft delete + estratégia de recuperação.
- [ ] Definir política de backups e restore testado.
- [ ] Cobrir fluxos críticos com testes automáticos:
  - cálculos fiscais
  - importação/conflitos
  - filtros e vistas guardadas
  - ações em lote e undo
- [ ] Adicionar observabilidade (logs estruturados, métricas, alertas, error tracking).

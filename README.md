# Meu Dinheiro Control

Crie um aplicativo web responsivo chamado “Controle Financeiro Pessoal”, em português do Brasil, com foco em registrar, organizar e acompanhar despesas mensais, receitas, compras parceladas e despesas recorrentes.

Use como referência visual um layout limpo e moderno parecido com dashboard financeiro: menu lateral no desktop, navegação inferior ou menu compacto no celular, cards com totais no dashboard, lista de transações em cards, botões de ação claros e modais para criar/editar registros.

O aplicativo deve ser mobile-first, funcionando muito bem no celular.

Funcionalidades principais:

1. Autenticação

- Criar login e cadastro de usuário.

- Cada usuário deve ver apenas seus próprios dados.

- Usar Supabase para autenticação e banco de dados.

2. Dashboard

Criar uma tela inicial com:

- Saldo total: receitas menos despesas.

- Total de receitas do mês.

- Total de despesas do mês.

- Total de despesas pagas.

- Total de despesas pendentes.

- Próximos vencimentos.

- Transações recentes.

- Filtro por mês e ano.

- Cards responsivos com valores em reais no formato brasileiro: R$ 1.234,56.

3. Transações

Criar tela de transações com lista completa contendo:

- Descrição.

- Tipo: Receita ou Despesa.

- Valor.

- Data de vencimento.

- Data de pagamento, opcional.

- Categoria.

- Status: Pago ou Pendente.

- Forma de pagamento: Pix, Dinheiro, Débito, Crédito, Boleto, Transferência, Outro.

- Observações.

- Botões para editar, excluir e marcar como pago.

A lista deve permitir:

- Filtrar por mês.

- Filtrar por tipo.

- Filtrar por categoria.

- Filtrar por status.

- Buscar por descrição.

- Ordenar por vencimento.

4. Nova transação

Criar modal ou página para adicionar transação com os campos:

- Tipo: Receita ou Despesa.

- Descrição.

- Valor.

- Data de vencimento.

- Categoria.

- Status.

- Forma de pagamento.

- Observações.

5. Compras parceladas

O app precisa ter suporte completo a compras parceladas.

Ao cadastrar uma despesa, permitir marcar a opção “Compra parcelada”.

Quando ativada, mostrar:

- Valor total da compra.

- Quantidade de parcelas.

- Data de vencimento da primeira parcela.

- Categoria.

- Forma de pagamento.

- Descrição base.

Ao salvar, o sistema deve gerar automaticamente uma transação para cada parcela.

Exemplo:

Descrição: Celular

Valor total: R$ 1.200,00

Parcelas: 12

Resultado:

Celular (1/12) - R$ 100,00

Celular (2/12) - R$ 100,00

...

Celular (12/12) - R$ 100,00

Cada parcela deve ter vencimento mensal automático.

Cada parcela deve poder ser paga individualmente.

A edição de uma parcela deve perguntar se deseja editar apenas aquela parcela ou todas as parcelas futuras.

As parcelas devem ficar relacionadas por um identificador de grupo.

6. Despesas recorrentes

O app precisa ter suporte a despesas recorrentes, como:

- Conta de luz.

- Água.

- Internet.

- Cartão de crédito.

- Aluguel.

- Condomínio.

- Assinaturas.

- Outros.

Ao cadastrar uma despesa, permitir marcar “Despesa recorrente”.

Quando ativada, mostrar:

- Frequência: mensal, semanal, anual.

- Dia de vencimento.

- Data de início.

- Data de fim opcional.

- Valor estimado.

- Categoria.

- Descrição.

O sistema deve gerar lançamentos recorrentes automaticamente para os próximos meses.

Inicialmente, gerar os próximos 12 meses.

Cada lançamento recorrente deve poder ser editado individualmente, pois contas como luz e cartão podem mudar de valor.

Também permitir cancelar a recorrência para os meses futuros.

7. Cartão de crédito

Criar uma área simples para cartão de crédito:

- Nome do cartão.

- Dia de fechamento.

- Dia de vencimento.

- Limite opcional.

- Ativo ou inativo.

Ao cadastrar despesa no cartão de crédito, permitir selecionar o cartão.

Se a compra for parcelada, distribuir as parcelas nas faturas futuras.

Criar tela ou seção de “Faturas” mostrando:

- Cartão.

- Mês da fatura.

- Valor total.

- Status: Aberta, Fechada, Paga.

- Lista de despesas da fatura.

8. Categorias

Criar tela para gerenciar categorias.

Cada categoria deve ter:

- Nome.

- Tipo: Receita, Despesa ou Ambos.

- Cor.

- Ícone opcional.

- Ativa ou inativa.

Categorias iniciais:

Despesas:

- Casa

- Alimentação

- Transporte

- Saúde

- Educação

- Lazer

- Assinaturas

- Cartão de crédito

- Impostos

- Outros

Receitas:

- Salário

- Freelance

- Reembolso

- Investimentos

- Outros

9. Tipos de despesas

Criar uma tela simples para tipos de despesas, se fizer sentido:

- Fixa

- Variável

- Parcelada

- Recorrente

- Eventual

10. Relatórios

Criar tela de relatórios com:

- Despesas por categoria.

- Evolução mensal de receitas e despesas.

- Total pago versus pendente.

- Maiores despesas do mês.

- Compras parceladas em aberto.

- Despesas recorrentes ativas.

Usar gráficos simples e responsivos.

11. Banco de dados Supabase

Criar tabelas adequadas com Row Level Security ativado.

Tabelas sugeridas:

profiles

categories

transactions

installment_groups

recurring_rules

credit_cards

credit_card_invoices

A tabela transactions deve conter pelo menos:

- id

- user_id

- type

- description

- amount

- due_date

- payment_date

- category_id

- status

- payment_method

- notes

- is_installment

- installment_group_id

- installment_number

- installment_total

- is_recurring

- recurring_rule_id

- credit_card_id

- invoice_month

- created_at

- updated_at

12. Design

Usar um visual moderno, claro e organizado.

Preferir:

- Fundo claro.

- Cards brancos.

- Bordas suaves.

- Cantos arredondados.

- Sombras leves.

- Verde para receitas.

- Vermelho para despesas.

- Azul escuro ou preto para botões principais.

- Layout parecido com o das imagens de referência.

No desktop:

- Menu lateral fixo com:

  - Dashboard

  - Transações

  - Categorias

  - Cartões

  - Relatórios

  - Configurações

No celular:

- Layout responsivo.

- Menu inferior ou menu hambúrguer.

- Botão flutuante para nova transação.

- Formulários fáceis de preencher no celular.

13. Experiência do usuário

- Ao salvar uma transação, mostrar confirmação.

- Ao excluir, pedir confirmação.

- Ao marcar como pago, atualizar dashboard automaticamente.

- Campos obrigatórios devem ter validação.

- Não permitir valor zero ou negativo no cadastro.

- Permitir valores com vírgula decimal brasileira.

- Datas no formato DD/MM/AAAA.

- Aplicativo totalmente em português.

14. Dados de exemplo

Criar dados fictícios para teste:

- Aluguel

- Luz

- Internet

- Supermercado

- Salário

- Cartão de crédito

- IPVA parcelado

- Assinatura de streaming

15. Importante

Priorize entregar primeiro um MVP funcional com:

- Login

- Dashboard

- Transações

- Categorias

- Parcelamento

- Recorrência

- Responsividade mobile

Depois, se possível, adicionar cartão de crédito e relatórios.

Crie o projeto completo com frontend, banco, tabelas, políticas RLS, componentes reutilizáveis e layout responsivo.

todos os dados devem ser persistidos em banco de dados, nao quero dados ficticios

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://despesasfacil.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4aee5481-bc47-4072-b52c-74a296931c48).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

/**
 * Traduz erros técnicos do backend em mensagens amigáveis.
 * Detalhes técnicos ficam apenas no console (nunca na interface).
 */
const MESSAGES: Record<string, string> = {
  not_authenticated: "Sua sessão expirou. Entre novamente para continuar.",
  invalid_description: "Informe uma descrição válida.",
  invalid_amount: "O valor deve ser maior que zero.",
  invalid_installments: "Quantidade de parcelas inválida (2 a 120).",
  invalid_occurrences: "Quantidade de lançamentos inválida.",
  invalid_due_date: "Informe uma data de vencimento válida.",
  invalid_scope: "Escopo da operação inválido.",
  invalid_category_owner: "Categoria inválida.",
  invalid_group_owner: "Parcelamento inválido.",
  invalid_rule_owner: "Recorrência inválida.",
  invalid_transaction_owner: "Transação inválida.",
  group_not_found: "Parcelamento não encontrado.",
  transaction_not_found: "Transação não encontrada.",
  nothing_updated: "Nada foi atualizado.",
  nothing_deleted: "Nada foi excluído.",
  owner_required: "Sua sessão expirou. Entre novamente para continuar.",
};

export function friendlyError(
  error: unknown,
  fallback = "Não foi possível concluir a operação.",
): string {
  if (typeof console !== "undefined") console.error("[app]", error);

  const raw =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";

  for (const key of Object.keys(MESSAGES)) {
    if (raw.includes(key)) return MESSAGES[key]!;
  }
  if (raw.includes("JWT") || raw.includes("401")) return MESSAGES["not_authenticated"]!;
  if (raw.includes("row-level security") || raw.includes("permission denied")) {
    return "Você não tem permissão para esta operação.";
  }
  if (raw.includes("violates check constraint")) return "Dados inválidos para esta operação.";
  return fallback;
}

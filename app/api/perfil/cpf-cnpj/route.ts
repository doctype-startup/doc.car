import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Cadastra o CPF/CNPJ do próprio despachante — usado só pra conferir a
 * reconfirmação exigida antes de cada consulta do CRM (app/api/crm/proprietario).
 * Não é dado exigido no cadastro inicial; só quando ele entra na aba CRM. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  const input = await request.json().catch(() => null);
  const cpfCnpj = String(input?.cpfCnpj || "").replace(/\D/g, "");

  if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
    return NextResponse.json({ error: "CPF/CNPJ inválido" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ cpf_cnpj: cpfCnpj })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: "não foi possível salvar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

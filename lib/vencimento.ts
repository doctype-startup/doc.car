/** Dia/mês/ano de uma data, no fuso de São Paulo — pra calcular "dia do
 * vencimento" sempre em cima do calendário do Brasil, não do servidor
 * (UTC na Vercel). */
function partesEmSaoPaulo(data: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [ano, mes, dia] = fmt.format(data).split("-").map(Number);
  return { ano, mes, dia };
}

/** Próximo "vencimento" do plano, contado sempre como o mesmo dia do mês
 * do cadastro — decisão de negócio pra simplificar (não depende da data
 * real de renovação do Stripe, que pode variar por proration, trial
 * etc.). Ex: cadastro dia 10 → vence todo dia 10. Se o mês de vencimento
 * for mais curto que o dia do cadastro (cadastro dia 31, vencimento em
 * fevereiro), usa o último dia desse mês. */
function proximoVencimento(cadastradoEm: string, agora: Date) {
  const cadastro = partesEmSaoPaulo(new Date(cadastradoEm));
  const hoje = partesEmSaoPaulo(agora);

  let anoVenc = hoje.ano;
  let mesVenc = hoje.mes;
  if (hoje.dia > cadastro.dia) {
    mesVenc += 1;
    if (mesVenc > 12) {
      mesVenc = 1;
      anoVenc += 1;
    }
  }

  const ultimoDiaDoMesVenc = new Date(Date.UTC(anoVenc, mesVenc, 0)).getUTCDate();
  const diaVenc = Math.min(cadastro.dia, ultimoDiaDoMesVenc);

  const vencimentoUTC = Date.UTC(anoVenc, mesVenc - 1, diaVenc);
  const hojeUTC = Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia);
  const dias = Math.round((vencimentoUTC - hojeUTC) / 86_400_000);

  return { ano: anoVenc, mes: mesVenc, dia: diaVenc, dias };
}

/** Quantos dias faltam até o próximo vencimento (0 no dia do vencimento). */
export function diasAteVencimento(cadastradoEm: string, agora: Date = new Date()): number {
  return proximoVencimento(cadastradoEm, agora).dias;
}

/** "DD/MM" do próximo vencimento, pra exibir no aviso. */
export function formatarDiaVencimento(cadastradoEm: string, agora: Date = new Date()): string {
  const { mes, dia } = proximoVencimento(cadastradoEm, agora);
  return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}

# DOC.CAR

App web de consulta veicular para despachantes — placa, ficha técnica, FIPE, débitos e restrições em um só lugar. Um produto **DOCTYPE**.

## Rodando localmente

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Estrutura

- `app/login` — login e cadastro de despachante
- `app/forgot-password` — recuperação de senha
- `app/dashboard` — consulta de veículo por placa, com ficha técnica, FIPE, débitos e restrições
- `app/dashboard/historico` — histórico de placas consultadas
- `lib/vehicle.ts` — camada de dados da consulta veicular (atualmente mock, determinística por placa)
- `lib/auth.ts` — sessão de demonstração baseada em `localStorage`

A autenticação e a consulta veicular atualmente usam dados simulados; a integração com provedores reais (FIPE, base de débitos/restrições, backend de autenticação) é o próximo passo.

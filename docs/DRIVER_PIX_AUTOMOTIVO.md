# Painel Pix automotivo: implementação e verificação

## Contrato

| Área | Comportamento |
| --- | --- |
| Ativação | Chave no perfil do motorista; aplica ao salvar, persiste em `driverPixLayout` no documento do perfil. |
| Compatibilidade | Ausência ou valor inválido volta a `legacy`. A chave desligada restaura a apresentação anterior. |
| Passageiro | Continua usando `PixSection` e o checkout anteriores. |
| Painel | Valor dos adicionais, ação principal grande, corrida resumida e QR direto; demais controles sob expansão. |
| Cobrança Mercado Pago | Reutiliza criação e consulta existentes; exibe progresso, espera, confirmação, erro ou cancelamento. |
| Confirmação | Exige `approved` **e** `paymentActivated`; QR direto exige conferência no banco. |

Não há migração de banco: `driverPixLayout` é um campo opcional no perfil Firestore. Os perfis anteriores mantêm o layout antigo. O mesmo salvamento de perfil já usado pela aplicação grava a escolha.

## Matriz de testes

| Cenário | Teste | Resultado esperado |
| --- | --- | --- |
| Preferência ausente/inválida, ligada e desligada | `driver-pix-layout.test.ts` | Padrão antigo; novo somente ao escolher `automotive`. |
| Cobrança pendente/aprovada não ativada | `driver-pix-layout.test.ts`, `driver-pix-components.test.ts` | Aguardando, sem confirmação falsa. |
| Aprovada e ativada | Mesmos testes | Confirmação visível. |
| Rejeitada/cancelada/erro | Mesmos testes | Orientação de falha ou encerramento. |
| Sem valor e sem chave Pix | `driver-pix-components.test.ts` | Cobrança desabilitada; acesso às configurações. |
| Alternância acessível | `driver-pix-components.test.ts` | `role=switch` e `aria-checked` correspondem à preferência. |
| Passageiro e regressão do pagamento Spotify | `tests/e2e/spotify-payment.spec.ts` | Experiência de passageiro segue operacional. |
| Tipos e empacotamento | `npm run lint`, `npm run build` | Sem erros de TypeScript ou bundling. |

Para validação manual em uma central de carro: entre como motorista, ative e salve a chave, confirme o painel em tela larga e estreita; selecione um adicional, abra a cobrança sandbox e verifique que ela só confirma após resposta real do servidor. Desative a chave e salve para conferir o retorno ao layout anterior. Repita na visão do passageiro para verificar que ela não mudou. O teste sandbox depende de credenciais e backend configurados.

O CI executa `npm install`, `npm test`, `npm run lint` e `npm run build`. O E2E em `main` usa respostas simuladas nas ações de pagamento e faz smoke de backend separadamente; ele não é comprovação de um pagamento real.

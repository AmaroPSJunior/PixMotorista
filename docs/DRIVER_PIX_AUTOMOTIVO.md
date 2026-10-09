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

## Encerramento remoto e aviso de recurso

O botão **Encerrar** do motorista chama `POST /api/driver/passenger-sessions/:sessionId/close`, exige autenticação de motorista e grava o estado `closed` no servidor antes de atualizar a lista. Um erro retorna mensagem visível e deixa a sessão ativa. A tela do passageiro recebe a mudança por Firestore ou pela consulta de fallback a cada dois segundos, limpa o acesso local e mostra imediatamente a entrada pelo nome. A consulta de uma sessão encerrada devolve `410` com o status específico, sem substituí-la por outra sessão do mesmo usuário.

O modal de liberação remota busca o serviço na lista e usa o mesmo mapeamento de `iconName` da lista de serviços. Para música, Wi-Fi e carregador, há ícones padrão quando o cadastro ainda não carregou. Se mais de um recurso for liberado, exibe os ícones de cada um.

O teste E2E `encerramento remoto tira o passageiro da sessão sem recarregar` cobre a atualização do outro dispositivo e a volta ao cadastro. O teste de dois dispositivos também verifica a nota musical do Spotify no modal de liberação. A rota de encerramento exige credenciais reais nos ambientes integrados; os testes de interface interceptam a API e não encerram sessões reais.

### Proteção da tela após o encerramento

Quando o passageiro sai ou o motorista encerra sua sessão, a aplicação limpa o acesso local e mostra diretamente a tela de entrada pelo nome. O QR Pix, o Wi-Fi, a música, os serviços e os botões de pagamento deixam de ser montados até existir uma sessão ativa associada ao nome informado. Durante a restauração da autenticação e da sessão, a tela exibe somente um estado de carregamento. O teste E2E verifica que essas seções não existem após ambos os modos de encerramento e que voltam após a identificação.

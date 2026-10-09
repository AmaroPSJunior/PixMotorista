# PixMotorista

Aplicação React para a visão do motorista e do passageiro, com pagamentos Pix e recursos da corrida.

## Painel Pix para a central do carro

Na visão do motorista, abra **Configurações → Perfil → Painel PIX automotivo**, ative a chave e toque em **Salvar Alterações**. A preferência `driverPixLayout` é salva no perfil do motorista no Firestore. O valor ausente ou inválido usa o layout atual (`legacy`); desligar a chave e salvar restaura esse layout. A visão do passageiro não muda.

O painel automotivo mostra o valor dos adicionais em destaque, um botão grande para gerar cobrança, um QR direto da chave Pix e informações da corrida. Passageiros/corrida e produtos/serviços ficam em seções expansíveis. O QR direto cadastrado pelo motorista precisa de conferência no banco; ele não prova pagamento. Uma cobrança Mercado Pago só aparece como **Pagamento confirmado** quando o servidor retorna `status: approved` e `paymentActivated: true`. Estados de espera, erro e cancelamento têm mensagens próprias.

Para configurar o painel, cadastre uma chave Pix no perfil do motorista. Para cobrar, selecione serviços ou caixinha e toque em **Gerar cobrança Pix**. A cobrança da corrida continua na seção **Passageiros e corrida**. Faça ajustes e confirme pagamentos com o veículo parado.

## Desenvolvimento e testes

```sh
npm install
npm test
npm run lint
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

Os testes unitários em `tests/driver-pix-layout.test.ts` verificam preferência, valores e estados de pagamento. `tests/driver-pix-components.test.ts` cobre renderização, configuração reversível e telas da cobrança. O fluxo E2E existente em `tests/e2e/spotify-payment.spec.ts` protege a experiência do passageiro. O workflow **Driver Pix CI** executa testes, checagem de tipos e build em pull requests; o workflow **E2E UI** roda após publicação em `main`.

As integrações reais exigem credenciais Firebase e Mercado Pago próprias do ambiente; os testes automatizados não realizam cobrança real. Consulte [`docs/DRIVER_PIX_AUTOMOTIVO.md`](docs/DRIVER_PIX_AUTOMOTIVO.md) para o contrato e a matriz de verificação.

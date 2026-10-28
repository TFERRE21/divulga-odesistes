# Central de Divulgação 24h

Central inicial para monitorar e preparar a divulgação de seis sites.

## O que faz
- Verifica a página inicial, o sitemap.xml e o robots.txt de cada domínio.
- Registra status HTTP, tempo de resposta, data e alertas em `data/latest.json`.
- Gera sugestões de pauta específicas por domínio em `data/promotion-plan.json`.
- GitHub Actions agenda as verificações a cada 30 minutos e permite execução manual.

## Sites cadastrados
Oolivo, Biomassa Florestal, DayMoney, Versos Musicais, GlobalTools e CriptoProBot.

## Executar localmente
Requer Node.js 20 ou superior:
```bash
npm run monitor
node scripts/create-plan.js
```

## Publicação do painel
O painel é um site estático que lê os arquivos JSON deste repositório. Para exibi-lo em GitHub Pages, habilite Pages nas configurações do repositório e selecione a branch `main`, pasta `/ (root)`. A URL pública do painel depende dessa configuração.

## Google Search Console e GA4
O script `scripts/sync-google.js` está preparado para sincronizar cliques, impressões, CTR, posição média, sessões e visualizações, sem consultas automatizadas às páginas de resultados do Google.

Para ativar:
1. Crie uma conta de serviço no Google Cloud e habilite a Search Console API e a Google Analytics Data API.
2. Adicione o e-mail da conta de serviço como usuária nas propriedades corretas do Search Console e do GA4. A conta precisa ter acesso de leitura.
3. Em Settings → Secrets and variables → Actions, crie o secret `GOOGLE_SERVICE_ACCOUNT_JSON` com o JSON completo da conta de serviço. Nunca coloque credenciais no código ou em arquivos do repositório.
4. Para cada propriedade GA4, crie secrets com os IDs numéricos: `GA4_PROPERTY_ID_OOLIVO`, `GA4_PROPERTY_ID_BIOMASSA_FLORESTAL`, `GA4_PROPERTY_ID_DAYMONEY`, `GA4_PROPERTY_ID_VERSOS_MUSICAIS`, `GA4_PROPERTY_ID_GLOBALTOOLS` e `GA4_PROPERTY_ID_CRIPTOPROBOT`.
5. Execute o workflow manualmente em Actions para validar o acesso. Sem as credenciais, o painel continuará mostrando o monitoramento técnico e indicará que as métricas não foram configuradas.

## Próximas integrações
1. UTMs e acompanhamento de visitas por canal.
2. Pinterest e outras redes por APIs oficiais, com credenciais, imagens públicas e permissões adequadas.
3. Fila de revisão e aprovação antes de qualquer publicação externa.

## Limites de segurança
O monitor apenas faz requisições normais para verificar saúde técnica. Não gera visitas artificiais, cliques em anúncios, comentários automáticos, troca de tráfego nem consultas automatizadas não autorizadas ao Google. O plano gera rascunhos, não publica em redes sociais.

## Agendamento
O workflow usa GitHub Actions a cada 30 minutos. O GitHub pode atrasar execuções agendadas e o recurso deve permanecer habilitado no repositório. Consulte a aba Actions para confirmar execuções reais.

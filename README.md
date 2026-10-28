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

## Próximas integrações
1. Google Search Console e Analytics por APIs oficiais e permissões apropriadas.
2. UTMs e acompanhamento de visitas por canal.
3. APIs oficiais de redes sociais/Pinterest, após configurar credenciais.
4. Fila de revisão para qualquer publicação externa.

## Limites de segurança
O monitor apenas faz requisições normais para verificar saúde técnica. Não gera visitas artificiais, cliques em anúncios, comentários automáticos, troca de tráfego nem consultas automatizadas não autorizadas ao Google. O plano gera rascunhos, não publica em redes sociais.

## Agendamento
O workflow usa GitHub Actions a cada 30 minutos. O GitHub pode atrasar execuções agendadas e o recurso deve permanecer habilitado no repositório. Consulte a aba Actions para confirmar execuções reais.

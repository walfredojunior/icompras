<!-- CÓPIA AUTOMÁTICA da memória do Claude. NÃO EDITAR AQUI — o original vive na máquina do dono.
     Senhas e chaves foram REMOVIDAS desta cópia. -->

---
name: icompras-pendencias
description: "iCompras — o que está em aberto, o que depende do dono e o que não deve ser proposto de novo"
metadata: 
  node_type: memory
  type: project
  originSessionId: 76bdc89b-fae2-47aa-b6c1-ce2496535a4b
  modified: 2026-08-14T17:02:20.745Z
---

Estado em **2026-08-08**. Os detalhes de cada item estão em [[icompras-projeto]], na seção do dia em que o assunto apareceu.

## 🔴 DEPENDE DELE — cobrar

1. ~~**BACKUP automático não existe.**~~ ❌ **EU ESTAVA ERRADO — ele corrigiu em 06/08: a hospedagem é HOSTINGER e tem BACKUP DIÁRIO automático da VPS inteira.** Parei de cobrar isso. Também há uma cópia manual de 02/08 em `/opt/icompras/backups/`, testada por restauração. **O que ainda não sei e vale confirmar com ele um dia:** quantos dias o Hostinger guarda, e que é imagem da máquina toda — ótimo para desastre, mas para desfazer um estrago pontual no banco (uma tabela errada há 2 horas) o certo seria um dump do MariaDB. Só propor se fizer sentido; não insistir.
2. ✅ ~~**Senha do admin é `[SENHA-ADMIN-REMOVIDA]`**~~ — **ELE TROCOU em 08/08/2026, às 10:49.** Conferido de duas formas: existe linha em `admin_user` (id 1, hash de 161 caracteres) e o `POST /api/admin/login` com `[SENHA-ADMIN-REMOVIDA]` devolve **401**. A partir do momento em que existe linha nessa tabela, a senha do `.env` deixa de valer — para recuperar acesso, apagar a linha de `admin_user`. **A senha nova eu NÃO sei, e não preciso saber.** ⚠️ Se precisar de acesso administrativo para algum diagnóstico, PEDIR a ele — não tentar contornar.
3. ✅ **Google Search Console — RESOLVIDO em 08/08.** Ele verificou o domínio pelo registro TXT e enviou o `sitemap.xml`. **A verificação e o mapa só passaram depois de consertar a regra da Cloudflare** — ver a seção do Google em [[icompras-projeto]]. **O que ainda depende dele (opcional):** cadastrar os 25 mapas de produto (`produto/sitemap/0.xml` … `24.xml`) no Search Console. **Não é necessário** — o `robots.txt` já os declara e o Google os busca sozinho; serve só para ver o relatório separado de cada um. Ele disse "haa então não precisa".
4. **A lista própria de lojas** que ele mencionou em 02/08 — abriria coletar direto das lojas em vez do concorrente.
5. **Chaves do Bancard**, quando tiver.

## ✅ TESTE DE REINÍCIO DA VPS — FEITO em 06/08 e PASSOU (o upgrade forçou o reinício; voltou tudo sozinho, ver [[icompras-projeto]])

<details><summary>histórico da verificação no papel, 05/08</summary>

## 🧪 TESTE DE REINÍCIO DA VPS — ele adiou ("agora não"), 05/08

**Conferido no papel e TUDO passa** (9 itens): mariadb, redis-server, meilisearch, nginx, **pm2-root** e fail2ban todos `enabled`; swap de 8 GB no `/etc/fstab`; `vm.swappiness=10` em `/etc/sysctl.d/`; `--stack-size=4000` no script de start do site; `.next` presente (não precisa reconstruir); `scrape_control` em "running" e não "parado pelo painel" (que faria o guardião NÃO religar). O **dump do PM2 tem os 8 apps com os papéis certos** (`crawler-2=quentes`, `crawler-3=novos`) e bate com o que roda.

⚠️ **Mas isso é verificação de CONFIGURAÇÃO, não prova.** Ofereci reiniciar de verdade enquanto o site não foi divulgado (queda de 1-2 min custa nada agora e fica caro depois do lançamento) — **ele preferiu deixar para outra hora**. Reofertar quando fizer sentido, e aproveitar para aplicar as atualizações de sistema pendentes. Servidor está de pé há 8 dias.

</details>

## 🟠 TÉCNICO EM ABERTO

0. ✅ **RESOLVIDO em 06/08 — a VPS dobrou (4 núcleos, 15 GB, 193 GB) e a carga caiu para 2,73.** Ainda há **roubo de CPU pelo provedor de 34-46%**; acompanhar no Monitor VPS e, se voltar a apertar, o que pedir é plano **dedicado**, não mais núcleos compartilhados. ~~**CARGA DA VPS EM 8,47 COM 2 NÚCLEOS**~~ (era 0,24 em 31/07), processador em 92%, 6 Chromium abertos. Revelado pelo Monitor VPS assim que subiu, em 05/08. O site NÃO está sofrendo (responde em 20-33 ms) porque quem espera é o robô. Provável causa: o robô dos **quentes** renderiza cada página com navegador (~8s/produto). Caminhos: tentar a leitura rápida antes de renderizar, reduzir a lista de quentes, ou baixar a concorrência. **Acompanhar no Monitor VPS antes de mexer — agora dá para ver.**

6. **A recursão que derrubou o site em 04/08 NÃO foi encontrada.** O `--stack-size=4000` é paliativo e volta a estourar conforme o catálogo cresce — e só aparece no START, então pega de surpresa. Pista não investigada no log: `RangeError: Incorrect locale information provided at Number.toLocaleString ... at stringify` (candidatos: `CategoryBlocks.tsx:18`, `SearchOverlay.tsx:200` — provável `toLocaleString("")`).
7. **Sessão do admin nunca expira** — "Sair" não desconecta e trocar a senha não expulsa quem já entrou (provado por teste em 04/08). Conserto proposto e não feito: conferir o prazo, `sessions_from` que a troca de senha empurra, botão "sair de todos os aparelhos".
8. **`AUTH_SECRET` cai silenciosamente em `"dev-secret-troque"`** se a variável sumir — aí qualquer um forja cookie de admin. Hoje está setada; fazer o app recusar subir sem ela.
9. **Marca dos produtos é adivinhada do NOME** (`apps/worker/src/brands.ts`) e sai lixo em celular ("A52", "4.7)", "Anti-Espionagem"). **A fonte entrega a marca pronta na ficha técnica** (`product.specs` → `{"k":"Marca"}`) em 100% dos produtos com ficha. Ler dali arrumaria o filtro de marca, a busca e o banner por marca de uma vez.
10. ~~**IDEIA 2 — reconferência inteligente de preços (v1.4).**~~ ✅ **FEITA em 05/08** — ver a seção "COLETOR COM PAPÉIS" em [[icompras-projeto]]. **O que resta acompanhar:** (a) se a volta normal encurtou mesmo (era ~5 dias; 93% do catálogo agora é pulado); (b) o painel dos quentes — se quase nenhum quente mudar de preço, as faixas estão erradas e precisam de ajuste; (c) **ampliar os tetos com evidência** — hoje o mais parado espera 72h, conservador de propósito; (d) confirmar que o robô dos novos derrubou o tempo de descoberta (era até 4 dias).
11. **PWA parte 2 — notificações push.** Lembrar **quando ele disser que o projeto está pronto**. Ganhou peso: é o jeito grátis de avisar queda de preço, sem WhatsApp nem e-mail.
12. **Meilisearch do PC local está mais VELHO que o de produção** (1.51.0) e rejeita as rankingRules atuais → `search:sync` falha no local e busca não dá para testar aí. Subir a imagem quando for mexer em busca.
13. Menores: contador de cliques por banner (o de lojas já existe); traduzir es/en das categorias novas (`taxonomy-i18n.ts` + `npm run taxonomia`); normalizar moeda nos alertas (se religar); importar as fontes para o SVN (dei a lista e o robocopy, sem resposta); chave SSH em vez de senha.

14. ⚠️ **Verificar deploy pela TELA, não pelo build.** Em 06/08 um processo órfão segurou a porta 3000 por 14 horas e engoliu todas as publicações do site — com o build correto no disco. Depois de publicar: buscar uma frase nova no HTML servido e conferir `pm2 list` (reinícios altos + uptime de segundos = laço).
15. **Navegador dos robôs vaza memória** — 1,1 GB num processo aberto há 10h. Paliativo: `pm2 restart` no robô. Conserto de fundo: fechar e reabrir o navegador a cada N produtos no `crawl.ts`.

16. ✅ ~~**PASSAR O PROJETO PARA O GITHUB**~~ — **FEITO em 07/08/2026**, repositório privado `icompras`, com a memória junto (cópia sem senhas em `docs/memoria/`). Virou rotina: quando ele digitar **"salve tudo"**, ver [[comando-salve-tudo]]. ⚠️ **Conferir SEGREDOS antes de todo push**: `.env`, `AUTH_SECRET`, `servidores.txt` (esse fica fora do Git).
17. ✅ ~~**Guardião: olhar TENDÊNCIA.**~~ **FEITO em 07/08** — migration 044 + `conferirAtrasados()`. Fica quieto enquanto a fila cai; avisa se não melhorar por 3 verificações (15 min). Testado nos dois cenários.
18. ✅ ~~**Título e descrição próprios em cada página.**~~ **FEITO em 08/08** — ver a seção do assunto em [[icompras-projeto]]. **O que resta é esperar:** o Google leva de dias a semanas para reindexar 224 mil páginas. Acompanhar em Search Console › Páginas; o número de "indexadas" tem que subir. Se daqui a 2-3 semanas continuar baixo, o próximo suspeito é o tempo de resposta das páginas de produto sob rastreamento pesado, não o título.
19. 🔜 **CONFERIR A REGRA DAS "DUAS FALTAS" NOS PRIMEIROS DIAS** (a partir de 09/08/2026). A marcação de oferta sumida foi refeita em 08/08 depois de medir **12% de erro** na versão anterior — ver a seção das baixas em [[icompras-projeto]]. ~~Subir o teto de 1% para 5%~~ ✅ feito. **O que olhar agora, no cartão "Saíram do ar" do Admin › Robôs:** (a) o placar "Conferido na fonte", que o guardião preenche às 5h — se acusar erro, a regra ainda está furada; (b) "Voltaram", que tem de ficar perto de zero. ⚠️ **Restou um erro de base de 5% mesmo em anúncio de um modelo, cuja causa eu NÃO descobri** — as duas faltas devem cobri-lo, mas isso é hipótese, não medida. Só considerar o assunto fechado com alguns dias de conferência limpa.
20. 🔜 **LIGAR A REAÇÃO AUTOMÁTICA DA CONFERÊNCIA** — hoje ela mede e mostra; não age. Combinado com ele em 08/08: primeiro observar alguns dias para saber a taxa de alarme falso, só então fazer o guardião desligar a marcação sozinho quando acusar erro. Não inverter essa ordem.
20. **PYIA** — a ideia dele de acionar uma IA no incidente. Fica DEPOIS do guardião juntar evidências: aí a IA entra só no caso desconhecido, já com o trabalho pronto. Riscos anotados em [[icompras-projeto]] (injeção pelos dados, custo por acionamento, e o perigo de deixar a IA CONSERTAR sozinha).

21. 🔴 **10.168 PRODUTOS SEM CATEGORIA** (medido em 12/08/2026; eram 1.218 em 06/08 — **oito vezes mais**). Não pesa mais no desempenho desde a correção dos relacionados, mas ainda dói: esses produtos aparecem mal no site, não entram nos filtros de categoria e ficam com sugestões fracas. Foi o crescimento silencioso deste número que afogou o servidor em 12/08 — ver [[icompras-projeto]]. **Vale classificar**, e vale mais ainda **descobrir por que os produtos novos estão entrando sem categoria** (a fonte informa? o casamento de taxonomia falha?), senão o número volta a crescer.

22. 🔜 **CONFERIR SE A CARGA CONTINUA BAIXA** (a partir de 13/08/2026). Depois da correção de 12/08 a carga caiu de 20,75 para 1,25 e o disco de 576 MB/s para 28 MB/s. **O que olhar:** carga no Monitor VPS ao longo de um dia inteiro, incluindo o pico das 18h e com o Google rastreando. Se voltar a subir, o próximo suspeito **não** é o banco — é procurar de novo o que está rodando em `information_schema.processlist`, amostrado várias vezes, que foi o que enfim achou a causa.

23. **`connectionLimit` do site está em 25** (era 5, subi em 12/08). Cabe no limite do MariaDB (151, com os robôs usando ~80). ⚠️ **Não subir mais sem antes conferir se existe consulta cara** — subir o limite com consulta cara viva multiplica o estrago, foi exatamente o que fiz e piorou. Ajustável por `DB_POOL` no `.env`, sem recompilar.

24. 🔴 **O FREIO DO MEILISEARCH DEPENDE DO COLETOR — e isso já causou problema.** O freio que pus em 12/08 só libera a reindexação quando um robô **conclui uma unidade de trabalho**, e as unidades do mapa levam horas. Em 13/08 a busca ficou **mais de uma hora mostrando imagens já apagadas do banco** (o logo do concorrente). Tive de rodar `npm run search:sync` na mão. **Conserto certo:** o guardião dispara a sincronização quando ela estiver atrasada (ex.: mais de 60 min), em vez de depender do coletor. ~30 min de trabalho.

25. 🔜 **PRONTO E NÃO PUBLICADO** (13-14/08): placeholder do iCompras nos produtos sem foto (`ProductCard.tsx`); migration **057** + histórico de bloqueios 403 por hora + gráfico no painel dos robôs + aviso do guardião. Tudo compila e foi testado. Publicar na próxima janela.

26. **As outras 24 imagens repetidas** (11 a 64 produtos cada) não foram tocadas — têm poucas categorias e provavelmente são variações legítimas do mesmo produto. Olhar uma a uma quando sobrar tempo. A consulta está na seção do logo em [[icompras-projeto]].

27. 📱 **APP iOS/ANDROID — ele quer fazer** (13/08). Levantamento feito: o caminho é **Capacitor** (embrulha o site que já existe, um código só). O PWA já está pronto (manifest, service worker, botão de instalar, 77 classes responsivas). **O obstáculo real é a regra 4.2 da Apple**, que rejeita "site embrulhado" — a saída é a **notificação de queda de preço**, que justifica o app e é genuinamente útil. **Descoberta importante: conta, alertas e favoritos JÁ EXISTEM e estão desligados** (`app_user` 5 linhas, `price_alert` 2 linhas, `favorite`, APIs `/api/alerts`, `/api/auth/*`, `/api/favorites`, telas `/alertas` e `/favoritos`). O `ingest.ts` **já detecta** quando o preço bate o alvo — só não entrega nada, porque não existe envio. Ordem sugerida: (1) notificação funcionando no site, (2) Android (US$ 25, sem Mac), (3) iPhone. **Ele não tem Mac** → serviço de compilação na nuvem (US$ 30-60/mês). **Tem conta em nome da empresa [SENHA-BANCO-LOCAL-REMOVIDA] — falta saber se é Google Play, Apple ou as duas** (se a Apple já estiver ativa, economiza 2-4 semanas de espera pelo D-U-N-S). Ele quer as duas notificações: produto marcado + resumo diário opcional.

28. 🎓 **SIMULAÇÃO DE ACESSOS — trabalho da faculdade dele** (13/08). Pesquisa de tecnologias já levantada: k6 (recomendado), JMeter, Locust, Gatling, Artillery, Vegeta, wrk2, Playwright. A curva real de 24h está extraída (pico 22h com 8,9% do dia, vale 03h com 1,2%, pico = 2,1× a média; base de 28.781 visitas em 15 dias). Custos medidos: **Decodo residencial** cobra por GB — 1 acesso = 18 KB, então 40/min por 30 dias = 29,7 GB ≈ US$ 101; 80/min = 59 GB ≈ US$ 248-275; **VPS no Brasil sai por ~US$ 6** com tráfego incluído, mas poucos endereços (a saída elegante seria bloco IPv6). ⚠️ **Eu insisti demais numa ressalva sobre os dados depois de ele já ter explicado o contexto três vezes, e ele reclamou com razão.** Ele explicou, é o site dele, a decisão é dele — **não levantar de novo**. Falta ele escolher origem (VPS BR, IPv6 ou Decodo) e taxa (40 ou 80/min).

## ⏸️ PAUSADO POR ELE

- **"Onde comer no Paraguai"** — faixa de banners de restaurante na home. Ele mandou fazer, apresentei o plano completo, e aí pausou ("por enquanto vou deixar pausado"). O plano está pronto em [[icompras-projeto]], é só executar (~2h). Ficou sem resposta: 2 ou 3 colunas.

## ⛔ DESCARTADO — NÃO PROPOR DE NOVO

- ❌ ~~**Proxy / VPN / IP rotativo**~~ **ISTO AQUI FICOU ERRADO — ele MUDOU DE IDEIA e mandou construir em 07-08/08/2026.** Está NO AR: servidor em Dallas (InterServer, US$ 3) com Mullvad + dante + tinyproxy, troca de IP a cada 5 horas e também quando leva 403; se Dallas cair o coletor usa o IP da VPS e volta para Dallas quando ela se recuperar. Ver [[icompras-projeto]] e `infra/dallas/` no repositório. **Deixei o item aqui, riscado, como lembrete de que decisão descartada não é decisão eterna** — foi por isso que eu insisti contra e ele decidiu assim mesmo.
- **Semáforo de fila da Ponte da Amizade por API de trânsito** — ele levantou a ideia em 09/08/2026 e **abandonou em 10/08**, depois da análise. Não chegou a existir código nem conta criada. Guardado só para não refazer o raciocínio: o caminho seria Routes API do Google (tempo com trânsito × tempo livre) ou, mais barato e mais direto, a **TomTom** (velocidade atual × velocidade normal do trecho, com franquia gratuita maior). **O custo nunca foi o problema** — com cache de 20 min o número de consultas não cresce com os visitantes: ~2.000/mês, e dá para travar cota no painel do provedor. **O obstáculo real era outro: ninguém sabe se essas APIs enxergam uma fila de ADUANA**, que é caminhão e pedestre parado, não congestionamento de avenida. Eu tinha proposto medir antes de construir. Ele preferiu não seguir. ⚠️ **Decisão dele, de 10/08 — não é eterna** (ver o item do proxy acima, que eu tinha anotado como descartado e ele mandou construir depois). Só retomar se ELE trouxer o assunto.
- **Aparar a margem branca das fotos** ("ficou bom assim").
- **Login social** (Google/Meta/Apple) e login por WhatsApp — analisados em 31/07; ele preferiu não mexer em conta agora.
- ⚠️ ~~**Bloqueio total por país na Cloudflare — "em 02/08 confirmei que o Googlebot passa".**~~ **ESSA CONFIRMAÇÃO ESTAVA ERRADA e custou semanas de indexação.** A regra dele barrava justamente o Googlebot, e eu "confirmei" que passava porque testei com um Googlebot SIMULADO — que a Cloudflare não considera verificado, então a regra não o pegava. **Lição: teste com robô falso não prova nada sobre regra de robô verdadeiro; o que prova é o registro do nginx mostrando se o pedido chegou.** Detalhes na seção do Google em [[icompras-projeto]].

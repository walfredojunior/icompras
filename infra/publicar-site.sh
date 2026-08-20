#!/bin/sh
# PUBLICAR O SITE — montar em pasta separada, TESTAR em porta isolada, trocar,
# conferir pela tela servida, e VOLTAR SOZINHO se der errado.
#
# Reagendado em 19/08/2026 para as 03:00 do Paraguai (06:00 UTC). Leva a foto do
# produto que abre grande ao clicar, pedida por ele em 19/08.
#
# ====================================================================
# AS REGRAS QUE ESTE ROTEIRO EXISTE PARA CUMPRIR
# ====================================================================
# 1. **Montar em OUTRA pasta** (`NEXT_DIST_DIR=.next-novo`). Em 11/08/2026 o
#    `next build` escrevendo direto no `.next` que o site estava usando derrubou
#    o admin no horário de pico: construção que morre no meio deixa o diretório
#    inconsistente e o processo que serve passa a falhar. Foi por isso que o
#    `next.config.ts` ganhou o `distDir` configurável — este roteiro usa.
# 2. **Testar em porta isolada ANTES de tocar na produção.** Ignorar isso
#    derrubou o site por 1 hora em 04/08/2026: ele não subia por um erro que só
#    aparece no START, e a produção já estava parada quando se descobriu.
# 3. **Conferir pela TELA SERVIDA, nunca pelo arquivo montado.** Em 06/08/2026
#    um processo órfão segurou a porta 3000 por 14 horas e engoliu todas as
#    publicações, com a montagem certa no disco.
# 4. **Falhou? Não toca na produção.** E se falhar DEPOIS da troca, volta
#    sozinho para a pasta anterior. Ninguém estará olhando às 3 da manhã.
#
# A PROVA de que o código novo está no ar é a etiqueta "ampliar foto" no HTML de
# uma página de produto: ela nasce hoje, junto com a janela da foto.
#
# ⚠ TROQUEI A PROVA DE PROPÓSITO (19/08/2026). A anterior era a rota
# `/api/admin/online` devolver 401 — e isso JÁ É VERDADE em produção desde
# ontem. Uma prova que passa mesmo sem a mudança nova não prova nada: aprovaria
# uma publicação que não subiu. **Toda publicação precisa da SUA própria prova.**
#
# O produto é escolhido no banco na hora, e não fixo no roteiro: produto some do
# catálogo, e um endereço chumbado faria a publicação abortar às 3 da manhã por
# um motivo que não tem nada a ver com o código.
#
# Ao terminar, este roteiro se remove do cron.
set -u

LOG=/var/log/publicar-site.log
APP=/opt/icompras/app
WEB=$APP/apps/web
# ⚠ 3010 e NÃO 3001. Na primeira tentativa (18/08/2026, 06:02) escolhi 3001 sem
# conferir, e a publicação abortou com `EADDRINUSE`: a porta é do `icompras-api`,
# de pé há 6 dias. O roteiro se comportou certo (não tocou na produção), mas a
# noite foi perdida por eu ter suposto em vez de olhar. Por isso, além de trocar
# o número, ele agora CONFERE antes de tentar — ver logo abaixo.
PORTA_TESTE=3010

registrar() { echo "$(date -u '+%H:%M:%S') $*" >> "$LOG"; }
sair_do_cron() { crontab -l 2>/dev/null | grep -v 'publicar-site.sh' | crontab -; }
desistir() {
  registrar "❌ ABORTADO: $*"
  registrar "   A produção NÃO foi tocada — o site segue no ar com a versão anterior."
  rm -rf "$WEB/.next-novo"
  sair_do_cron
  exit 1
}

echo "" >> "$LOG"
registrar "===== publicação do site ====="
cd "$APP" || desistir "não achei $APP"

# ---------------------------------------------------------- 1. montar à parte
registrar "montando em .next-novo (o site continua servindo o .next atual)..."
rm -rf "$WEB/.next-novo"
if ! NEXT_DIST_DIR=.next-novo npm run build -w @icompras/web >> "$LOG" 2>&1; then
  desistir "a montagem falhou (procurar 'error' acima no registro)"
fi
[ -d "$WEB/.next-novo" ] || desistir "a montagem terminou sem criar .next-novo"
registrar "montagem concluída"

# ------------------------------------------------- 2. teste em porta isolada
# Porta ocupada é motivo para desistir ANTES de mexer em qualquer coisa: subir
# ali daria erro e, pior, um teste que aponta para o processo de OUTRO programa
# aprovaria a publicação lendo a tela errada.
if ss -ltn 2>/dev/null | grep -q ":$PORTA_TESTE "; then
  desistir "a porta $PORTA_TESTE já está ocupada — escolher outra livre em PORTA_TESTE"
fi

registrar "subindo cópia de teste na porta $PORTA_TESTE..."
( cd "$APP" && NEXT_DIST_DIR=.next-novo PORT=$PORTA_TESTE npm run start -w @icompras/web >> "$LOG" 2>&1 ) &
TESTE_PID=$!

# Espera até 90s. Tempo fixo não serve: às vezes sobe em 3s, às vezes em 40 —
# e um `sleep 10` otimista reprovaria uma publicação boa.
i=0
ok=0
while [ $i -lt 90 ]; do
  if curl -sf -o /dev/null "http://127.0.0.1:$PORTA_TESTE/es"; then ok=1; break; fi
  i=$((i + 1))
  sleep 1
done

matar_teste() {
  pkill -P $TESTE_PID 2>/dev/null
  kill $TESTE_PID 2>/dev/null
  # ⚠ Espera a porta ser devolvida. Processo órfão segurando porta já custou 14
  # horas de publicações invisíveis (06/08/2026).
  j=0
  while [ $j -lt 20 ] && curl -sf -o /dev/null "http://127.0.0.1:$PORTA_TESTE/es"; do
    j=$((j + 1))
    sleep 1
  done
  # ⚠⚠ O NETO SOBREVIVE (visto em 18/08/2026). `npm run start` lança o `next`
  # como neto: matar o filho não mata quem realmente segura a porta, e em 18/08
  # um desses ficou 12 HORAS de pé com a 3010 na mão. Se a porta continuar
  # ocupada, encerra quem está nela PELO NÚMERO DO PROCESSO.
  # 💡 Pelo dono da porta, nunca por padrão de texto: `pkill -f` já casou com o
  # próprio comando SSH duas vezes num dia.
  DONO=$(ss -ltnpH "sport = :$PORTA_TESTE" 2>/dev/null | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2)
  if [ -n "${DONO:-}" ]; then
    registrar "⚠ a porta $PORTA_TESTE ficou com o processo $DONO (neto órfão) — encerrando"
    kill "$DONO" 2>/dev/null
    sleep 3
    ss -ltn 2>/dev/null | grep -q ":$PORTA_TESTE " && kill -9 "$DONO" 2>/dev/null
  fi
}

if [ "$ok" != "1" ]; then
  matar_teste
  desistir "a cópia de teste não subiu em 90s (é o defeito de 04/08: só aparece no START)"
fi
registrar "cópia de teste respondeu em ${i}s"

SLUG=$(mysql -uroot icompras -N -e "SELECT slug FROM product WHERE primary_image_url LIKE '/media/%/400.webp' ORDER BY updated_at DESC LIMIT 1" 2>/dev/null)
if [ -z "$SLUG" ]; then
  matar_teste
  desistir "não achei nenhum produto com foto para conferir a janela da foto"
fi
registrar "conferindo a janela da foto no produto: $SLUG"
if curl -s "http://127.0.0.1:$PORTA_TESTE/pt-BR/produto/$SLUG" | grep -q 'ampliar foto'; then
  matar_teste
  registrar "código novo confirmado na cópia de teste (a etiqueta da foto está no HTML)"
else
  matar_teste
  desistir "a página do produto na cópia de teste não trouxe a janela da foto"
fi

# ------------------------------------------------------ 3. trocar e reiniciar
registrar "trocando .next e reiniciando o site..."
rm -rf "$WEB/.next-anterior"
mv "$WEB/.next" "$WEB/.next-anterior" || desistir "não consegui guardar o .next atual"
mv "$WEB/.next-novo" "$WEB/.next" || {
  mv "$WEB/.next-anterior" "$WEB/.next"
  desistir "não consegui pôr a montagem nova no lugar (a anterior foi devolvida)"
}
pm2 restart icompras-web --update-env >> "$LOG" 2>&1
sleep 15

# ------------------------------------------- 4. conferir a TELA SERVIDA
HOME_COD=$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: icompras.com.py' http://127.0.0.1/es)
TEMPO=$(curl -s -o /dev/null -w '%{time_total}' -H 'Host: icompras.com.py' http://127.0.0.1/es)
# A MESMA prova da cópia de teste, agora na tela que o visitante recebe.
if curl -s -H 'Host: icompras.com.py' "http://127.0.0.1/pt-BR/produto/$SLUG" | grep -q 'ampliar foto'; then
  NOVA="sim"
else
  NOVA="não"
fi
registrar "produção: home $HOME_COD em ${TEMPO}s · janela da foto na tela servida: $NOVA"

if [ "$HOME_COD" != "200" ] || [ "$NOVA" != "sim" ]; then
  registrar "⚠ conferência reprovou — VOLTANDO para a montagem anterior"
  rm -rf "$WEB/.next-quebrado"
  mv "$WEB/.next" "$WEB/.next-quebrado"
  mv "$WEB/.next-anterior" "$WEB/.next"
  pm2 restart icompras-web --update-env >> "$LOG" 2>&1
  sleep 15
  VOLTOU=$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: icompras.com.py' http://127.0.0.1/es)
  registrar "após voltar: home $VOLTOU (a montagem ruim ficou em .next-quebrado, para eu examinar)"
  registrar "$(pm2 list --no-color | grep icompras-web)"
  sair_do_cron
  exit 1
fi

registrar "✅ publicado e conferido pela tela servida"
registrar "$(pm2 list --no-color | grep icompras-web)"
registrar "===== fim ====="
sair_do_cron

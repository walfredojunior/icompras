#!/bin/sh
# CLASSIFICAÇÃO POR IA DOS PRODUTOS SEM CATEGORIA — UMA VEZ SÓ.
#
# Agendado em 17/08/2026 para as 04:00 do Paraguai (07:00 UTC), a pedido do
# dono. A madrugada é quando o site tem 1,2% do movimento do dia, e ele pediu
# expressamente que trabalho pesado não coincidisse com gente usando o site.
#
# ⚠ ESTA TAREFA SE REMOVE DO CRON AO TERMINAR. Tarefa "de uma vez" que fica no
# cron vira tarefa de todo dia, e ninguém lembra de tirar — a segunda execução
# não teria o que classificar, mas gastaria chamadas pagas à toa.
#
# Retomável: se cair no meio, `npm run categorizar-ia` continua de onde parou
# (tabela `processo_estado`). Desfazível: o lote fica registrado em
# `alteracao_massa` e volta com `-- --desfazer=<lote>`.
set -u

cd /opt/icompras/app || exit 1

{
  echo ""
  echo "===== $(date -u '+%Y-%m-%d %H:%M UTC') — classificação por IA ====="
  npm run categorizar-ia -w @icompras/worker
  echo "===== terminou em $(date -u '+%H:%M UTC') ====="
} >> /var/log/categorizar-ia.log 2>&1

# Sai do cron. O `grep -v` refaz a lista sem esta linha; se a lista ficar
# vazia, `crontab -` grava vazio, que é o certo.
crontab -l 2>/dev/null | grep -v 'rodar-categorizacao-ia.sh' | crontab -

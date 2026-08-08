#!/bin/bash
# O SERVIDOR DE SAIDA SE VIGIA SOZINHO.
#
# A cada 10 minutos ele mesmo tenta buscar uma pagina da fonte pelo tunel. Se
# vier bloqueio, troca de servidor da VPN na hora — sem esperar o rodizio de
# 5 horas e sem ninguem precisar mandar.
#
# ⚠ POR QUE ASSIM, E NAO UM "BOTAO" QUE O COLETOR APERTA:
#
# A primeira ideia era um endereco HTTP aqui que o coletor chamaria para pedir
# a troca. Funcionaria — e seria a peca mais perigosa de todo o conjunto: uma
# porta que EXECUTA COMANDO no servidor. Segredo no caminho e firewall ajudam,
# mas o risco existe enquanto a porta existir.
#
# Vigiando-se sozinho, o servidor nao precisa de porta nenhuma aberta para
# receber ordem. Ele so descobre o problema e resolve. Menos peca, menos risco,
# e funciona igual — o coletor nem precisa saber que isto existe.
set -e

ALVO="https://www.comprasparaguai.com.br/x_30503/"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
MEU_IP=10.132.225.84
LOG=/var/log/mullvad-rodizio.log
MARCA=/etc/mullvad/ultima-troca-por-bloqueio

registrar() { echo "$(date -Is) vigia: $*" >> "$LOG"; }

CODIGO=$(curl -s -o /dev/null --max-time 30 --interface "$MEU_IP" -A "$UA" -w "%{http_code}" "$ALVO" || echo "000")

# 200 = tudo certo. Nao registra nada: log que enche de "esta tudo bem" e log
# que ninguem le.
[ "$CODIGO" = "200" ] && exit 0

# 429 e 503 sao pedido de calma, nao bloqueio. Trocar de IP aqui seria responder
# "entao mudo de identidade" a quem pediu educadamente para esperar — e o
# caminho mais rapido para o bloqueio de verdade.
if [ "$CODIGO" = "429" ] || [ "$CODIGO" = "503" ]; then
  registrar "fonte pediu calma (HTTP $CODIGO) — nao troco de IP por isso"
  exit 0
fi

# Trava de seguranca: no maximo uma troca por bloqueio a cada 20 minutos.
# Sem isto, uma fonte fora do ar faria o servidor girar a lista inteira em
# poucas horas, queimando IPs por um problema que nao e nosso.
AGORA=$(date +%s)
ULTIMA=$(cat "$MARCA" 2>/dev/null || echo 0)
if [ $((AGORA - ULTIMA)) -lt 1200 ]; then
  registrar "bloqueio (HTTP $CODIGO), mas troquei ha menos de 20 min — esperando"
  exit 0
fi

registrar "BLOQUEIO detectado (HTTP $CODIGO) — trocando de IP"
echo "$AGORA" > "$MARCA"
/usr/local/bin/trocar-ip.sh >> "$LOG" 2>&1

# Confere se a troca resolveu. Se nao resolveu, o bloqueio provavelmente nao e
# por IP — e isso precisa ficar escrito, senao alguem passa dias trocando IP
# atras de um problema que trocar IP nao resolve.
sleep 5
DEPOIS=$(curl -s -o /dev/null --max-time 30 --interface "$MEU_IP" -A "$UA" -w "%{http_code}" "$ALVO" || echo "000")
if [ "$DEPOIS" = "200" ]; then
  registrar "resolvido: a fonte voltou a responder com o IP novo"
else
  registrar "ATENCAO: continua HTTP $DEPOIS com IP novo — o bloqueio pode nao ser por IP"
fi

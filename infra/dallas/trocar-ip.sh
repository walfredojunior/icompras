#!/bin/bash
# TROCA O SERVIDOR DA VPN — e, com ele, o IP que o mundo enxerga.
#
# Roda de 5 em 5 horas (ver /etc/cron.d/mullvad-rodizio) e também sob demanda,
# quando o coletor detectar bloqueio.
#
# ⚠ O SEGREDO ESTA NO "Table = off".
#
# Sem ele, o WireGuard instala uma rota padrao e captura TODO o trafego da
# maquina — inclusive a resposta da conexao SSH e a do proxy. O servidor ficaria
# inacessivel e o proxy pararia de responder para a VPS do iCompras, porque as
# respostas sairiam pelo tunel em vez de voltarem pelo caminho de onde vieram.
#
# Com "Table = off" o WireGuard nao encosta na tabela de rotas. Quem decide o
# que passa pelo tunel e a REGRA abaixo: so o trafego que SAI do endereco
# 10.132.225.84 (o endereco que o Mullvad deu a esta maquina) vai pelo wg0.
# O proxy e configurado para usar esse endereco de origem; o resto da maquina
# — SSH, apt, tudo — continua saindo pelo eth0 normalmente.
set -e

CONF=/etc/wireguard/wg0.conf
LISTA=/etc/mullvad/servidores.txt
ESTADO=/etc/mullvad/atual
LOG=/var/log/mullvad-rodizio.log
MEU_IP=10.132.225.84

registrar() { echo "$(date -Is) $*" >> "$LOG"; }

# Escolhe o proximo da lista, em rodizio. Se um pais especifico for pedido
# (primeiro argumento), sorteia dentro dele.
if [ -n "$1" ]; then
  LINHA=$(grep "|$1|" "$LISTA" | shuf -n 1)
else
  ATUAL=$(cat "$ESTADO" 2>/dev/null || echo 0)
  TOTAL=$(wc -l < "$LISTA")
  PROX=$(( (ATUAL % TOTAL) + 1 ))
  echo "$PROX" > "$ESTADO"
  LINHA=$(sed -n "${PROX}p" "$LISTA")
fi

HOST=$(echo "$LINHA" | cut -d"|" -f1)
CHAVE=$(echo "$LINHA" | cut -d"|" -f2)
ENDERECO=$(echo "$LINHA" | cut -d"|" -f3)
PAIS=$(echo "$LINHA" | cut -d"|" -f4)
CIDADE=$(echo "$LINHA" | cut -d"|" -f5)

cat > "$CONF" <<FIM
# Gerado por trocar-ip.sh — nao editar a mao.
# Servidor atual: $HOST ($CIDADE/$PAIS)
[Interface]
PrivateKey = $(cat /etc/mullvad/chave.priv)
Address = ${MEU_IP}/32
# ⚠ NAO REMOVER: sem isto o WireGuard rouba a rota padrao e derruba o SSH.
Table = off
PostUp = ip rule add from ${MEU_IP} table 100 priority 100; ip route add default dev %i table 100
PostDown = ip rule del from ${MEU_IP} table 100 priority 100 2>/dev/null || true

[Peer]
PublicKey = $CHAVE
AllowedIPs = 0.0.0.0/0
Endpoint = ${ENDERECO}:51820
PersistentKeepalive = 25
FIM
chmod 600 "$CONF"

# ⚠ PELO systemd, e nao "wg-quick" direto.
#
# Chamando wg-quick na mao o tunel sobe, mas o systemd continua achando que
# o servico esta parado (`systemctl is-active` diz inactive com a interface
# no ar). Isso confunde qualquer conferencia e, num reinicio, o systemd pode
# tentar subir por cima do que ja esta rodando. Deixando ele no comando,
# existe UM dono do tunel.
systemctl restart wg-quick@wg0 >/dev/null 2>&1 || { wg-quick down wg0 2>/dev/null; wg-quick up wg0 >/dev/null 2>&1; }

sleep 3
# Confere pela PROPRIA saida do tunel: e o unico jeito de saber que funcionou.
VISTO=$(curl -s --max-time 20 --interface "$MEU_IP" https://ifconfig.co 2>/dev/null || echo "?")
registrar "servidor=$HOST ($CIDADE/$PAIS) ip_visto=$VISTO"
echo "  agora saindo por: $VISTO  ($HOST — $CIDADE/$PAIS)"

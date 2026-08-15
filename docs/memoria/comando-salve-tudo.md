<!-- CÓPIA AUTOMÁTICA da memória do Claude. NÃO EDITAR AQUI — o original vive na máquina do dono.
     Senhas e chaves foram REMOVIDAS desta cópia. -->

---
name: comando-salve-tudo
description: "Quando o dono digitar \"salve tudo\": gravar a memória do que foi feito e enviar tudo para o GitHub"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 76bdc89b-fae2-47aa-b6c1-ce2496535a4b
  modified: 2026-08-15T15:33:28.356Z
---

Combinado com ele em **07/08/2026**: **"quando eu digitar `salve tudo`, você salva a memória das coisas que fizemos e envia as atualizações pro github"**.

**Por quê:** ele é não-técnico e não quer decorar comandos nem lembrar de pedir backup. Duas palavras disparam a rotina inteira. Também resolve o problema de a cópia da memória no GitHub ser uma fotografia parada — sem um gatilho, ela envelhece sem ninguém notar.

## Como aplicar — os quatro passos, nesta ordem

**1. Gravar a memória** do que foi feito na conversa. O de sempre: o *porquê*, o que foi medido, o que deu errado no caminho. Atualizar [[icompras-projeto]] e [[icompras-pendencias]]; ajustar o índice em `MEMORY.md` se algo importante mudou.

**2. Refazer a cópia limpa** em `docs/memoria/` na VPS. **A cópia NÃO se atualiza sozinha.** Copiar os `.md` de `C:\Users\walfr\.claude\projects\C--projetos-icompras\memory\`, pôr o aviso no topo de cada arquivo e trocar as senhas — **do padrão MAIS LONGO para o mais curto**, senão uma troca atropela a outra:

| Procurar (sem diferenciar maiúscula) | Trocar por |
|---|---|
| `[SENHA-SSH-REMOVIDA]` **com o ponto OPCIONAL** (`[SENHA-SSH-REMOVIDA]\.\?`) | `[SENHA-SSH-REMOVIDA]` |
| `[SENHA-BANCO-LOCAL-REMOVIDA]` (palavra inteira) | `[SENHA-BANCO-LOCAL-REMOVIDA]` |
| `[SENHA-ADMIN-REMOVIDA]` | `[SENHA-ADMIN-REMOVIDA]` |
| `[SENHA-REMOVIDA]` | `[SENHA-REMOVIDA]` |
| `[SENHA-DALLAS-REMOVIDA]` | `[SENHA-DALLAS-REMOVIDA]` |
| `[CONTA-MULLVAD-REMOVIDA]` | `[CONTA-MULLVAD-REMOVIDA]` |
| `[SENHA-BANCO-REMOVIDA]` | `[SENHA-BANCO-REMOVIDA]` |
| `[CHAVE-BUSCA-REMOVIDA]` | `[CHAVE-BUSCA-REMOVIDA]` |
| `re_` seguido do resto da chave do Resend (`re_[A-Za-z0-9_]+`) | `[CHAVE-RESEND-REMOVIDA]` |
| `cfut_` seguido do resto do token da Cloudflare (`cfut_[A-Za-z0-9]+`) | `[TOKEN-CLOUDFLARE-REMOVIDO]` |

💡 **Melhor ainda: não escrever senha na memória.** Desde 07/08/2026 elas vivem em **Admin › Anotações** (no banco) e em `servidores.txt` (fora do Git). A memória deve apontar para lá, não repetir o valor — o que não está escrito não precisa ser filtrado.

⚠️ **`[SENHA-BANCO-LOCAL-REMOVIDA]` quase escapou** (07/08/2026) — é a senha do banco LOCAL do PC dele, e eu só filtrava a senha SSH inteira. Chegou a subir no primeiro envio da memória e ficou no histórico do repositório.

⚠️⚠️ **FILTRAR A SENHA SEM A PONTUAÇÃO TAMBÉM** (barrado em 12/08/2026). A senha SSH termina em ponto, e eu filtrava só a forma **com** o ponto. Mas o texto desta própria instrução citava a senha **sem** o ponto, ao explicar o caso do `[SENHA-BANCO-LOCAL-REMOVIDA]` — e essa forma passava pelo filtro, levando ao GitHub tudo menos o último caractere. **Isto NÃO é o alarme falso descrito abaixo**: ali o verificador casava com a palavra `guthub` do texto explicativo, que não é senha de nada; aqui o que casou **era** a senha. Regra: **filtrar o miolo da senha, com a pontuação opcional**, e ao citar uma senha em qualquer texto, citar o marcador (`[SENHA-SSH-REMOVIDA]`), nunca o valor.

**Conferir ANTES de commitar** que nenhum dos VALORES da tabela sobrou na cópia.

⚠️ **Procurar o valor INTEIRO, não um pedaço dele.** Em 07/08/2026 a conferência acusou senha na cópia e não havia nenhuma: ela casou com a palavra `guthub` escrita **dentro desta própria instrução**. Verificador que grita por causa do texto do verificador é alarme falso — e alarme falso é o que faz a gente parar de olhar.

⚠️ **A CONFERÊNCIA DO DIFF SÓ OLHA LINHAS ACRESCENTADAS (`^+`), NUNCA O DIFF INTEIRO.** Em 10/08/2026 removi uma senha padrão que estava no código; a trava barrou o envio porque a linha **apagada** aparece no diff com `-` na frente. Conferir o diff todo faz o ato de REMOVER um segredo parecer o ato de adicioná-lo — e aí a trava impede justamente o commit que conserta. O comando certo é `git diff --cached | grep "^+" | grep -iE "<segredos>"`.

⚠️ **REENVIAR O PACOTE DA MEMÓRIA A CADA TENTATIVA.** O roteiro faz `rm -rf docs/memoria` e depois extrai o `.tgz`, apagando o arquivo em seguida. Se a primeira tentativa abortar (por exemplo, na trava de senha) e eu reexecutar o mesmo roteiro, o `rm -rf` roda de novo, o `.tgz` já não existe, e **a pasta fica vazia** — a mesma falha que em 08/08/2026 subiu uma `docs/memoria` vazia. Aconteceu de novo em 10/08. O commit abortou nas duas vezes, então nada foi perdido no GitHub, mas **conferir sempre `git status` antes de commitar: linhas `D docs/memoria/...` significam que o pacote não chegou.**

⚠️ **Se a conferência acusar, PARAR.** Naquele dia o roteiro avisou e enviou assim mesmo, porque as duas coisas estavam em comandos separados. O envio tem de ser condicionado à conferência passar, não vir depois dela.

Quando aparecer senha nova durante o trabalho, somar à tabela acima **na hora**, não depois.

**3. Commitar e enviar, na VPS** (`/opt/icompras/app` — é lá que vive o `.git`; o PC dele só tem as fontes):

```
git add -A && git commit -m "<o que foi feito>" && git push origin master
```

**4. Conferir e contar para ele:** `git rev-parse master` igual a `origin/master`, quantos commits foram, e uma linha do que subiu.

## Cuidados

⚠️ **Conferir se sobrou senha nova.** Se durante o trabalho apareceu alguma chave ou senha em arquivo, ela vai junto. `grep` antes de enviar, sempre.

⚠️ **Não commitar arquivo de teste.** Costumo criar `.foto-*.mjs`, `.teste-*.mts` e afins — apagar antes. `git status --porcelain` deve mostrar só o que é para ficar.

⚠️ Se houver trabalho pela metade no servidor, dizer isso a ele em vez de enviar calado — "salve tudo" é para guardar o que está pronto, não para congelar algo quebrado.

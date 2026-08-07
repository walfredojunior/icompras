> ⚠️ **Cópia sem as senhas.** Histórico de trabalho do projeto, guardado aqui
> como backup. As senhas foram trocadas por marcadores antes de subir.
> A versão completa vive só na máquina do dono.

---
name: comando-salve-tudo
description: "Quando o dono digitar \"salve tudo\": gravar a memória do que foi feito e enviar tudo para o GitHub"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 76bdc89b-fae2-47aa-b6c1-ce2496535a4b
  modified: 2026-08-07T21:53:39.167Z
---

Combinado com ele em **07/08/2026**: **"quando eu digitar `salve tudo`, você salva a memória das coisas que fizemos e envia as atualizações pro github"**.

**Por quê:** ele é não-técnico e não quer decorar comandos nem lembrar de pedir backup. Duas palavras disparam a rotina inteira. Também resolve o problema de a cópia da memória no GitHub ser uma fotografia parada — sem um gatilho, ela envelhece sem ninguém notar.

## Como aplicar — os quatro passos, nesta ordem

**1. Gravar a memória** do que foi feito na conversa. O de sempre: o *porquê*, o que foi medido, o que deu errado no caminho. Atualizar [[icompras-projeto]] e [[icompras-pendencias]]; ajustar o índice em `MEMORY.md` se algo importante mudou.

**2. Refazer a cópia limpa** em `docs/memoria/` na VPS. **A cópia NÃO se atualiza sozinha.** Copiar os `.md` de `C:\Users\walfr\.claude\projects\C--projetos-icompras\memory\`, pôr o aviso no topo de cada arquivo e trocar as senhas — **do padrão MAIS LONGO para o mais curto**, senão uma troca atropela a outra:

| Procurar (sem diferenciar maiúscula) | Trocar por |
|---|---|
| `[SENHA-SSH-REMOVIDA]` | `[SENHA-SSH-REMOVIDA]` |
| `[SENHA-BANCO-LOCAL-REMOVIDA]` (palavra inteira) | `[SENHA-BANCO-LOCAL-REMOVIDA]` |
| `[SENHA-ADMIN-REMOVIDA]` | `[SENHA-ADMIN-REMOVIDA]` |
| `[SENHA-REMOVIDA]` | `[SENHA-REMOVIDA]` |

⚠️ **`[SENHA-BANCO-LOCAL-REMOVIDA]` quase escapou** (07/08/2026) — é a senha do banco LOCAL do PC dele, e eu só filtrava `[SENHA-SSH-REMOVIDA]`. Chegou a subir no primeiro envio da memória e ficou no histórico do repositório.

**Conferir ANTES de commitar** que nenhum dos VALORES da tabela sobrou na cópia.

⚠️ **Procurar o valor INTEIRO, não um pedaço dele.** Em 07/08/2026 a conferência acusou senha na cópia e não havia nenhuma: ela casou com a palavra `guthub` escrita **dentro desta própria instrução**. Verificador que grita por causa do texto do verificador é alarme falso — e alarme falso é o que faz a gente parar de olhar.

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

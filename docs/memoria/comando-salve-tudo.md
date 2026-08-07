> ⚠️ **Cópia sem as senhas.** Este arquivo é o histórico de trabalho do projeto,
> guardado aqui como backup. As senhas foram trocadas por marcadores antes de
> subir — repositório privado protege menos do que parece (um colaborador a
> mais, um token vazado, um clique errado em "tornar público").
> A versão completa vive só na máquina do dono.

---
name: comando-salve-tudo
description: "Quando o dono digitar \"salve tudo\": gravar a memória do que foi feito e enviar tudo para o GitHub"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 76bdc89b-fae2-47aa-b6c1-ce2496535a4b
  modified: 2026-08-07T17:00:30.620Z
---

Combinado com ele em **07/08/2026**: **"quando eu digitar `salve tudo`, você salva a memória das coisas que fizemos e envia as atualizações pro github"**.

**Por quê:** ele é não-técnico e não quer decorar comandos nem lembrar de pedir backup. Duas palavras disparam a rotina inteira. Também resolve o problema de a cópia da memória no GitHub ser uma fotografia parada — sem um gatilho, ela envelhece sem ninguém notar.

## Como aplicar — os quatro passos, nesta ordem

**1. Gravar a memória** do que foi feito na conversa. O de sempre: o *porquê*, o que foi medido, o que deu errado no caminho. Atualizar [[icompras-projeto]] e [[icompras-pendencias]]; ajustar o índice em `MEMORY.md` se algo importante mudou.

**2. Refazer a cópia limpa** em `docs/memoria/` na VPS. **A cópia NÃO se atualiza sozinha.** Copiar os `.md` de `C:\Users\walfr\.claude\projects\C--projetos-icompras\memory\`, trocar `[SENHA-SSH-REMOVIDA]` por `[SENHA-SSH-REMOVIDA]` e `[SENHA-ADMIN-REMOVIDA]` por `[SENHA-ADMIN-REMOVIDA]`, e pôr o aviso no topo de cada arquivo. Conferir com `grep` que não sobrou senha **antes** de commitar.

**3. Commitar e enviar, na VPS** (`/opt/icompras/app` — é lá que vive o `.git`; o PC dele só tem as fontes):

```
git add -A && git commit -m "<o que foi feito>" && git push origin master
```

**4. Conferir e contar para ele:** `git rev-parse master` igual a `origin/master`, quantos commits foram, e uma linha do que subiu.

## Cuidados

⚠️ **Conferir se sobrou senha nova.** Se durante o trabalho apareceu alguma chave ou senha em arquivo, ela vai junto. `grep` antes de enviar, sempre.

⚠️ **Não commitar arquivo de teste.** Costumo criar `.foto-*.mjs`, `.teste-*.mts` e afins — apagar antes. `git status --porcelain` deve mostrar só o que é para ficar.

⚠️ Se houver trabalho pela metade no servidor, dizer isso a ele em vez de enviar calado — "salve tudo" é para guardar o que está pronto, não para congelar algo quebrado.

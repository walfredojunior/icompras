> ⚠️ **Cópia sem as senhas.** Este arquivo é o histórico de trabalho do projeto,
> guardado aqui como backup. As senhas foram trocadas por marcadores antes de
> subir — repositório privado protege menos do que parece (um colaborador a
> mais, um token vazado, um clique errado em "tornar público").
> A versão completa vive só na máquina do dono.

# Memory Index

- [Projeto iCompras](icompras-projeto.md) — comparador de preços para BRASILEIROS que compram no Paraguai. No ar em https://icompras.com.py. **A VPS `179.198.101.162` é a FONTE DA VERDADE** (Hostinger, backup diário automático; senha SSH `[SENHA-SSH-REMOVIDA]`, com o ponto — ele mandou gravar); o PC local só tem as fontes, e o IP direto dá 403 de propósito. Em 06/08/2026: ~224 mil produtos, 8 apps PM2 (web/api/worker/guardião/4 coletores), VPS com 4 núcleos / 15 GB / 193 GB. **O arquivo é grande e está em ordem de assunto, não cronológica — procurar pelo título da seção.** ⚠️ REGRAS QUE NÃO PODEM SER ESQUECIDAS: **testar `next start` em porta isolada ANTES de reiniciar a produção** (ignorar isso derrubou o site por 1h em 04/08); **conferir o deploy lendo a TELA servida, nunca o arquivo construído** (um processo órfão na porta 3000 engoliu 14h de publicações em 05-06/08); **nunca rodar coletor ou operação de dados no banco local**; **nunca usar `pkill -f`** (casou com o próprio comando SSH duas vezes num dia); e **teste que trava tabela se faz em tabela descartável**, nunca numa que o coletor usa.
- [Pendências em aberto](icompras-pendencias.md) — o que falta e o que ele precisa decidir. **Ler junto com o índice.**
- [Trabalho autônomo](preferencia-trabalho-autonomo.md) — usuário não-técnico; trabalhar sozinho e explicar em linguagem simples

# Pendente: "melhorar foto"

Este código está aqui, e não em `apps/web/src/lib/`, por um motivo concreto:
**ele faz o `next build` do servidor estourar a memória** — cresce até 12 GB e
o kernel o mata (código 137), mesmo com 14 GB livres e o `.next` limpo.

Na máquina do dono (Windows) ele compila em 10 segundos. Só quebra no servidor.

Em 11/08/2026 isso derrubou o admin do site no horário de pico. Removi a
funcionalidade e o build passou de primeira — foi como a causa ficou provada.

A extensão `.txt` é de propósito: assim o compilador não o enxerga.

## O que ele faz
Recorta a moldura de cor uniforme, achata sobre branco e centraliza o produto
num quadrado, sem alterar o produto. Pedido do dono: "recorta e deixa o fundo
branco, mas não altera a foto do produto".

## Saída provável
Mover o processamento para o **worker**, que não usa esse compilador. Para o
cliente o resultado é o mesmo.

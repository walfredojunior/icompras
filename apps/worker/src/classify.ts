// Classificador de categoria RAIZ pelo NOME do produto (o nome já começa com o tipo).
// Regras ordenadas: a PRIMEIRA que casar vence — específicas antes das genéricas.
// Raízes: celulares | informatica | eletronicos | casa | moda | beleza | esportes

const RULES: Array<[RegExp, string]> = [
  // ===== ELETRONICOS (específicos primeiro; VR antes de "óculos") =====
  [/realidade virtual|\bvr\b|meta quest|oculos.*virtual|playstation vr|\bpico 4\b|oculus/, "eletronicos"],
  [/fone de ouvido|\bheadset\b|headphone|earbud|earphone|airpod|fone bluetooth|fone tws/, "eletronicos"],
  [/caixa de som|soundbar|home theater|alto.?falante|amplificador de som|caixa amplificada|caixa bluetooth/, "eletronicos"],
  [/smart ?tv|televisor|\btv \d|\btv$|\btv led|\btv oled/, "eletronicos"],
  [/\bdrone\b/, "eletronicos"],
  [/\bgps\b/, "eletronicos"],
  [/\bcamera\b|filmadora|gopro|\bdvr\b|webcam de seguranca/, "eletronicos"],
  [/projetor/, "eletronicos"],
  [/microfone/, "eletronicos"],
  [/\btablet\b|\bipad\b/, "eletronicos"],
  [/smartwatch|smart ?watch|relogio inteligente|smart band|\bmi band\b|amazfit|pulseira inteligente/, "eletronicos"],
  [/console|playstation|\bps5\b|\bps4\b|\bxbox\b|nintendo|video ?game/, "eletronicos"],
  [/binoculo|telescopio|luneta/, "eletronicos"],
  [/cigarro eletronico|\bvape\b|pod system/, "eletronicos"],
  [/power ?bank|carregador portatil|bateria portatil/, "eletronicos"],
  [/kindle|e-?reader/, "eletronicos"],

  // ===== INFORMATICA =====
  [/notebook|laptop|macbook|ultrabook|chromebook/, "informatica"],
  [/\bcomputador\b|desktop|\bpc gamer\b|all.?in.?one|mac mini|mac studio|\bimac\b/, "informatica"],
  [/\bmonitor\b/, "informatica"],
  [/\bmouse\b|mouse ?pad/, "informatica"],
  [/teclado|keyboard/, "informatica"],
  [/impressora|multifuncional|\btoner\b|cartucho de tinta|\bscanner\b/, "informatica"],
  [/\bplaca\b (de video|mae|-mae|grafica)|geforce|\brtx\b|\bgtx\b|radeon|placa de rede/, "informatica"],
  [/processador|\bryzen\b|core i[3579]|\bintel\b core|\bcpu\b/, "informatica"],
  [/memoria ram|\bram\b|\bssd\b|\bhd\b|hard disk|\bhdd\b|pen ?drive|cartao de memoria|\bnvme\b|\bm\.2\b|memoria interna/, "informatica"],
  [/cooler|water ?cooler|air ?cooler|ventoinha|dissipador|pasta termica|water ?block/, "informatica"],
  [/gabinete|fonte (atx|de alimentacao|modular)|\bpsu\b/, "informatica"],
  [/nobreak|no-break|estabilizador/, "informatica"],
  [/cadeira (gamer|de escritorio|ergonomica|presidente)/, "informatica"],
  [/roteador|repetidor|access point|\bmodem\b|adaptador (usb|wi-?fi|de rede)|\bswitch\b (de rede|gigabit)/, "informatica"],
  [/webcam/, "informatica"],
  [/hub usb|dock ?station|docking/, "informatica"],

  // ===== CELULARES =====
  [/\bcelular\b|smartphone|\biphone\b|galaxy (s|a|m|z|note|xcover)|\bredmi\b|\bpoco\b|moto (g|e|edge)|\binfinix\b|\btecno\b|\bitel\b|realme/, "celulares"],
  [/capa (para |de )?celular|pelicula|capinha|película|capa de silicone/, "celulares"],

  // ===== BELEZA =====
  [/perfume|eau de (parfum|toilette|cologne)|\bcolonia\b|deo colonia|body spray|\bedp\b|\bedt\b/, "beleza"],
  [/batom|\bgloss\b|corretivo|delineador|\brimel\b|mascara de cilios|maquiagem|\bsombra\b|\bblush\b|po compacto|primer facial|\bbase\b (liquida|matte|facial)/, "beleza"],
  [/barbeador|depilador|epilador|cortador de (cabelo|pelo|barba)|aparador de (barba|pelo)|maquina de cortar cabelo/, "beleza"],
  [/desodorante|antitranspirante|bronzeador|autobronzeador/, "beleza"],
  [/secador de cabelo|\bsecador\b|chapinha|prancha alisadora|modelador de (cabelo|cachos)|escova (rotativa|alisadora|secadora)|babyliss|\bbaby liss\b/, "beleza"],
  [/manicure|esmalte|kit de unha|lixa eletrica/, "beleza"],
  [/massageador|pistola de massagem/, "beleza"],
  [/\bcosmetico|creme (facial|hidratante|anti-?idade|para o rosto)|serum facial|acido hialuronico|\bshampoo\b|condicionador/, "beleza"],

  // ===== CASA =====
  [/chopeira|\badega\b|frigobar|cervejeira/, "casa"],
  [/robo (aspirador|de limpeza|lavador|limpador)|aspirador (de po|robo|vertical)/, "casa"],
  [/air ?fryer|fritadeira|liquidificador|cafeteira|batedeira|panela eletrica|sanduicheira|forno eletrico|micro-?ondas|mixer/, "casa"],
  [/colchao|inflavel/, "casa"],
  [/caixa termica|bolsa termica|cooler termico/, "casa"],
  [/ventilador|climatizador|umidificador|purificador de ar/, "casa"],
  [/lampada (inteligente|smart|led)|automacao residencial|\balexa\b|echo dot|fechadura (digital|eletronica)|camera de seguranca|camera ip/, "casa"],
  [/aquario|aquarismo/, "casa"],

  // ===== ESPORTES =====
  [/bicicleta|\bbike\b|patinete eletrico|\bpatins\b|\bskate\b/, "esportes"],
  [/carretilha|molinete|vara de pesca|\banzol\b|isca artificial|kit de pesca/, "esportes"],
  [/raquete|beach tennis|tenis de mesa|ping ?pong/, "esportes"],
  [/bola de (futebol|basquete|volei)|chuteira|luva de (boxe|goleiro)|\bhalter\b|anilha|kettlebell|corda de pular|caneleira/, "esportes"],
  [/mochila de hidratacao|cantil|barraca de camping/, "esportes"],
  [/capacete/, "esportes"],

  // ===== MODA (genéricos por último) =====
  [/oculos de sol|oculos escuro|\boculos\b/, "moda"],
  [/bolsa (feminina|masculina|termica|transversal)?|\bcarteira\b|mala de viagem|\bmochila\b/, "moda"],
  [/\bcalca\b|bermuda|\bshort\b|camiseta|\bblusa\b|\bcamisa\b|jaqueta|moletom|vestido|\bsaia\b|casaco/, "moda"],
  [/\btenis\b|\bsapato\b|sandalia|chinelo|\bbota\b|sapatenis/, "moda"],
  [/\brelogio\b/, "moda"],
];

export function classifyRoot(name: string): string | null {
  const s = (name || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  for (const [re, root] of RULES) if (re.test(s)) return root;
  return null;
}

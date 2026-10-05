import type { ErrorMessages } from "../types";

export const zhErrors = {
  "Informe o título da sala": "请输入房间名称",
  "O título deve possuir no máximo 50 caracteres": "名称最多包含 50 个字符",
  "Informe seu nome": "请输入你的名字",
  "A senha deve possuir pelo menos 6 caracteres": "密码至少包含 6 个字符",
  "Selecione o idioma em que deseja receber as traduções":
    "请选择接收翻译的语言",
  "Selecione o idioma que você irá falar na chamada": "请选择通话中使用的语言",
  "Informe o código da sala": "请输入房间代码",
  "Código da sala inválido": "房间代码无效",
  "Informe a senha": "请输入密码",
  "Código da sala inválido.": "房间代码无效。",
  "Sala não encontrada.": "未找到房间。",
  "Esta sala já possui dois participantes.": "此房间已有两位参与者。",
  "Senha incorreta.": "密码错误。",
  "Esta sala expirou.": "此房间已过期。",
  "Esta sala não está mais ativa.": "此房间已关闭。",
  "Informe seu nome.": "请输入你的名字。",
  "Este nome já está sendo usado na sala.": "此名字已在房间中使用。",
  "Este participante já está conectado.": "此参与者已连接。",
  "Não foi possível retomar este participante.": "无法恢复此参与者。",
  "Não foi possível entrar na sala. Tente novamente.": "无法加入房间，请重试。",
  "Confira os dados informados para criar a sala.":
    "请检查创建房间时填写的信息。",
  "Não foi possível criar a sala. Tente novamente.": "无法创建房间，请重试。",
  "Não foi possível concluir a operação. Tente novamente.":
    "无法完成操作，请重试。",
  "A sala foi criada, mas não foi possível conectar. Confirme novamente para tentar entrar.":
    "房间已创建，但无法连接。请再次确认以尝试加入。",
  "A conexão com o servidor foi interrompida. Tente novamente.":
    "与服务器的连接已中断，请重试。",
  "Não foi possível conectar ao servidor. Tente novamente.":
    "无法连接到服务器，请重试。",
  "A conexão com a sala foi interrompida.": "与房间的连接已中断。",
  "A conexão com a sala foi interrompida. Entre novamente.":
    "与房间的连接已中断，请重新加入。",
  "A conexão com a tradução foi interrompida.": "翻译连接已中断。",
  "A conexão com o chat foi interrompida. Tente novamente.":
    "聊天连接已中断，请重试。",
  "A sessão da sala não está disponível.": "房间会话不可用。",
  "A sessão da sala não está disponível para tradução.":
    "房间会话无法用于翻译。",
  "Não foi possível alterar o idioma.": "无法更改语言。",
  "Não foi possível alterar o idioma das traduções.": "无法更改翻译语言。",
  "Não foi possível confirmar o idioma. Tente selecionar novamente.":
    "无法确认语言，请重新选择。",
  "A confirmação pertence a outra sessão.": "确认信息属于其他会话。",
  "Selecione o idioma em que você está escrevendo.": "请选择你输入文字的语言。",
  "Selecione um idioma de destino válido para traduzir.":
    "请选择有效的目标翻译语言。",
  "Não foi possível carregar as mensagens.": "无法加载消息。",
  "Não foi possível enviar a mensagem.": "无法发送消息。",
  "O servidor demorou para carregar o histórico. Tente novamente.":
    "服务器加载历史记录超时，请重试。",
  "O servidor retornou um histórico de mensagens inválido.":
    "服务器返回的消息历史记录无效。",
  "A operação do chat foi cancelada.": "聊天操作已取消。",
  "Não foi possível conectar ao serviço de tradução. Tente novamente.":
    "无法连接到翻译服务，请重试。",
  "Não foi possível traduzir esta mensagem. Verifique os dados e tente novamente.":
    "无法翻译此消息，请检查信息后重试。",
  "A mensagem não está mais disponível para tradução.": "此消息已无法翻译。",
  "O serviço de tradução está indisponível. Tente novamente em instantes.":
    "翻译服务暂不可用，请稍后重试。",
  "Não foi possível traduzir a mensagem.": "无法翻译消息。",
  "O servidor retornou uma tradução incompatível com a mensagem.":
    "服务器返回的译文与消息不匹配。",
  "Não foi possível enviar este trecho para tradução.":
    "无法发送此片段进行翻译。",
  "Não foi possível traduzir este trecho.": "无法翻译此片段。",
  "O servidor não aceitou este trecho para tradução.":
    "服务器未接受此片段的翻译请求。",
  "O servidor não confirmou o recebimento deste trecho a tempo.":
    "服务器未及时确认收到此片段。",
  "O servidor retornou uma legenda inválida.": "服务器返回的字幕无效。",
  "Não foi possível entrar na chamada. Tente novamente.":
    "无法加入通话，请重试。",
  "Não foi possível iniciar a chamada.": "无法开始通话。",
  "Não foi possível iniciar a câmera e o microfone. Tente novamente.":
    "无法启动摄像头和麦克风，请重试。",
  "Permita o acesso à câmera e ao microfone para entrar na chamada.":
    "请允许使用摄像头和麦克风以加入通话。",
  "O acesso à câmera e ao microfone foi bloqueado pelo navegador.":
    "浏览器阻止了摄像头和麦克风访问。",
  "Nenhuma câmera ou microfone disponível foi encontrado.":
    "未找到可用的摄像头或麦克风。",
  "Não foi possível acessar a câmera ou o microfone. Verifique se outro aplicativo está usando o dispositivo.":
    "无法访问摄像头或麦克风，请检查是否有其他应用正在使用设备。",
  "A câmera ou o microfone não atende às configurações necessárias para a chamada.":
    "摄像头或麦克风不符合通话所需设置。",
  "Este navegador não oferece suporte ao acesso de câmera e microfone.":
    "此浏览器不支持访问摄像头和麦克风。",
  "O navegador não oferece suporte ao acesso de câmera e microfone.":
    "浏览器不支持访问摄像头和麦克风。",
  "O acesso à câmera e ao microfone foi interrompido.":
    "摄像头和麦克风访问已中断。",
  "O navegador não oferece suporte a chamadas WebRTC.":
    "浏览器不支持 WebRTC 通话。",
  "Não foi possível preparar a chamada. Tente novamente.":
    "无法准备通话，请重试。",
  "Não foi possível concluir a conexão da chamada.": "无法建立通话连接。",
  "O servidor demorou para confirmar a preparação da chamada.":
    "服务器确认通话准备状态超时。",
  "O servidor retornou uma confirmação de chamada inválida.":
    "服务器返回的通话确认无效。",
  "O servidor retornou um estado de espera inválido.":
    "服务器返回的等待状态无效。",
  "O servidor retornou um erro de preparação inválido.":
    "服务器返回的准备状态错误无效。",
  "O servidor retornou uma definição de iniciador inválida.":
    "服务器返回的通话发起者无效。",
  "O servidor retornou dados de negociação inválidos.":
    "服务器返回的协商数据无效。",
  "A negociação foi recebida de um participante inválido.":
    "收到了来自无效参与者的协商信息。",
  "A conexão não está pronta para receber uma nova oferta.":
    "连接尚未准备好接收新的提议。",
  "A conexão não está pronta para receber esta resposta.":
    "连接尚未准备好接收此应答。",
  "O navegador não conseguiu criar a resposta da chamada.":
    "浏览器无法创建通话应答。",
  "O navegador não conseguiu criar a oferta da chamada.":
    "浏览器无法创建通话提议。",
  "Não foi possível enviar uma oferta WebRTC válida.":
    "无法发送有效的 WebRTC 提议。",
  "Não foi possível enviar uma resposta WebRTC válida.":
    "无法发送有效的 WebRTC 应答。",
  "Não foi possível enviar um candidato de rede válido.":
    "无法发送有效的网络候选地址。",
  "Libere o microfone e tente novamente. Se necessário, clique na página para ativar o áudio.":
    "请允许访问麦克风后重试。如有需要，请点击页面以启用音频。",
  "Este navegador não oferece os recursos necessários para transcrição local. Use um navegador atualizado em HTTPS.":
    "此浏览器缺少本地转写所需功能，请使用最新浏览器并通过 HTTPS 访问。",
  "Este dispositivo não conseguiu acompanhar a transcrição. Feche outras abas e tente novamente.":
    "此设备无法跟上转写速度，请关闭其他标签页后重试。",
  "Não foi possível carregar o modelo de voz. Verifique a conexão e tente novamente.":
    "无法加载语音模型，请检查连接后重试。",
  "Não foi possível manter o microfone ativo. Verifique o dispositivo e tente novamente.":
    "无法保持麦克风启用，请检查设备后重试。",
  "A transcrição local foi interrompida. Tente novamente.":
    "本地转写已中断，请重试。",
  "Concluindo a transcrição anterior…": "正在完成上一段转写…",
  "O limite de tradução da DeepL foi atingido. O administrador precisa restabelecer a cota.":
    "已达到 DeepL 翻译限额，需要管理员恢复配额。",
  "Selecione Português, Inglês, Espanhol ou Chinês como idioma falado.":
    "请选择葡萄牙语、英语、西班牙语或中文作为使用的语言。",
  "Autorize o microfone para transcrever sua fala.":
    "请允许访问麦克风以转写你的语音。",
  "Transcrição pausada em segundo plano. Volte à sala e tente novamente.":
    "转写已在后台暂停，请返回房间后重试。",
  "A conexão de voz foi interrompida. Aguarde a reconexão da sala e tente novamente.":
    "语音连接已中断，请等待房间重新连接后重试。",
  "Não foi possível acompanhar a transcrição. Tente novamente.":
    "无法继续转写，请重试。",
  "Verificando o serviço de voz do Dicere…": "正在检查 Dicere 语音服务…",
  "Ativando o microfone…": "正在启用麦克风…",
} satisfies ErrorMessages;

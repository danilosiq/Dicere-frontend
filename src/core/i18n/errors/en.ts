import type { ErrorMessages } from "../types";

export const enErrors = {
  "Informe o título da sala": "Enter the room title",
  "O título deve possuir no máximo 50 caracteres":
    "The title must be no longer than 50 characters",
  "Informe seu nome": "Enter your name",
  "A senha deve possuir pelo menos 6 caracteres":
    "The password must contain at least 6 characters",
  "Selecione o idioma em que deseja receber as traduções":
    "Select the language you want to receive translations in",
  "Selecione o idioma que você irá falar na chamada":
    "Select the language you will speak during the call",
  "Informe o código da sala": "Enter the room code",
  "Código da sala inválido": "Invalid room code",
  "Informe a senha": "Enter the password",
  "Código da sala inválido.": "Invalid room code.",
  "Sala não encontrada.": "Room not found.",
  "Esta sala já possui dois participantes.":
    "This room already has two participants.",
  "Senha incorreta.": "Incorrect password.",
  "Esta sala expirou.": "This room has expired.",
  "Esta sala não está mais ativa.": "This room is no longer active.",
  "Informe seu nome.": "Enter your name.",
  "Este nome já está sendo usado na sala.":
    "This name is already in use in the room.",
  "Este participante já está conectado.":
    "This participant is already connected.",
  "Não foi possível retomar este participante.":
    "Could not restore this participant.",
  "Não foi possível entrar na sala. Tente novamente.":
    "Could not join the room. Try again.",
  "Confira os dados informados para criar a sala.":
    "Check the details entered to create the room.",
  "Não foi possível criar a sala. Tente novamente.":
    "Could not create the room. Try again.",
  "Não foi possível concluir a operação. Tente novamente.":
    "Could not complete the operation. Try again.",
  "A sala foi criada, mas não foi possível conectar. Confirme novamente para tentar entrar.":
    "The room was created, but connection failed. Confirm again to try joining.",
  "A conexão com o servidor foi interrompida. Tente novamente.":
    "The connection to the server was interrupted. Try again.",
  "Não foi possível conectar ao servidor. Tente novamente.":
    "Could not connect to the server. Try again.",
  "A conexão com a sala foi interrompida.":
    "The connection to the room was interrupted.",
  "A conexão com a sala foi interrompida. Entre novamente.":
    "The connection to the room was interrupted. Rejoin the room.",
  "A conexão com a tradução foi interrompida.":
    "The translation connection was interrupted.",
  "A conexão com o chat foi interrompida. Tente novamente.":
    "The chat connection was interrupted. Try again.",
  "A sessão da sala não está disponível.": "The room session is unavailable.",
  "A sessão da sala não está disponível para tradução.":
    "The room session is unavailable for translation.",
  "Não foi possível alterar o idioma.": "Could not change the language.",
  "Não foi possível alterar o idioma das traduções.":
    "Could not change the translation language.",
  "Não foi possível confirmar o idioma. Tente selecionar novamente.":
    "Could not confirm the language. Select it again.",
  "A confirmação pertence a outra sessão.":
    "The confirmation belongs to another session.",
  "Selecione o idioma em que você está escrevendo.":
    "Select the language you are writing in.",
  "Selecione um idioma de destino válido para traduzir.":
    "Select a valid target language for translation.",
  "Não foi possível carregar as mensagens.": "Could not load messages.",
  "Não foi possível enviar a mensagem.": "Could not send the message.",
  "O servidor demorou para carregar o histórico. Tente novamente.":
    "The server took too long to load history. Try again.",
  "O servidor retornou um histórico de mensagens inválido.":
    "The server returned invalid message history.",
  "A operação do chat foi cancelada.": "The chat operation was canceled.",
  "Não foi possível conectar ao serviço de tradução. Tente novamente.":
    "Could not connect to the translation service. Try again.",
  "Não foi possível traduzir esta mensagem. Verifique os dados e tente novamente.":
    "Could not translate this message. Check the details and try again.",
  "A mensagem não está mais disponível para tradução.":
    "This message is no longer available for translation.",
  "O serviço de tradução está indisponível. Tente novamente em instantes.":
    "The translation service is unavailable. Try again shortly.",
  "Não foi possível traduzir a mensagem.": "Could not translate the message.",
  "O servidor retornou uma tradução incompatível com a mensagem.":
    "The server returned a translation that does not match the message.",
  "Não foi possível enviar este trecho para tradução.":
    "Could not send this segment for translation.",
  "Não foi possível traduzir este trecho.": "Could not translate this segment.",
  "O servidor não aceitou este trecho para tradução.":
    "The server did not accept this segment for translation.",
  "O servidor não confirmou o recebimento deste trecho a tempo.":
    "The server did not acknowledge this segment in time.",
  "O servidor retornou uma legenda inválida.":
    "The server returned an invalid caption.",
  "Não foi possível entrar na chamada. Tente novamente.":
    "Could not join the call. Try again.",
  "Não foi possível iniciar a chamada.": "Could not start the call.",
  "Não foi possível iniciar a câmera e o microfone. Tente novamente.":
    "Could not start the camera and microphone. Try again.",
  "Permita o acesso à câmera e ao microfone para entrar na chamada.":
    "Allow camera and microphone access to join the call.",
  "O acesso à câmera e ao microfone foi bloqueado pelo navegador.":
    "Camera and microphone access was blocked by the browser.",
  "Nenhuma câmera ou microfone disponível foi encontrado.":
    "No available camera or microphone was found.",
  "Não foi possível acessar a câmera ou o microfone. Verifique se outro aplicativo está usando o dispositivo.":
    "Could not access the camera or microphone. Check whether another app is using the device.",
  "A câmera ou o microfone não atende às configurações necessárias para a chamada.":
    "The camera or microphone does not meet the call requirements.",
  "Este navegador não oferece suporte ao acesso de câmera e microfone.":
    "This browser does not support camera and microphone access.",
  "O navegador não oferece suporte ao acesso de câmera e microfone.":
    "The browser does not support camera and microphone access.",
  "O acesso à câmera e ao microfone foi interrompido.":
    "Camera and microphone access was interrupted.",
  "O navegador não oferece suporte a chamadas WebRTC.":
    "The browser does not support WebRTC calls.",
  "Não foi possível preparar a chamada. Tente novamente.":
    "Could not prepare the call. Try again.",
  "Não foi possível concluir a conexão da chamada.":
    "Could not establish the call connection.",
  "O servidor demorou para confirmar a preparação da chamada.":
    "The server took too long to confirm call readiness.",
  "O servidor retornou uma confirmação de chamada inválida.":
    "The server returned an invalid call confirmation.",
  "O servidor retornou um estado de espera inválido.":
    "The server returned an invalid waiting state.",
  "O servidor retornou um erro de preparação inválido.":
    "The server returned an invalid readiness error.",
  "O servidor retornou uma definição de iniciador inválida.":
    "The server returned an invalid call initiator.",
  "O servidor retornou dados de negociação inválidos.":
    "The server returned invalid negotiation data.",
  "A negociação foi recebida de um participante inválido.":
    "Negotiation was received from an invalid participant.",
  "A conexão não está pronta para receber uma nova oferta.":
    "The connection is not ready to receive a new offer.",
  "A conexão não está pronta para receber esta resposta.":
    "The connection is not ready to receive this answer.",
  "O navegador não conseguiu criar a resposta da chamada.":
    "The browser could not create the call answer.",
  "O navegador não conseguiu criar a oferta da chamada.":
    "The browser could not create the call offer.",
  "Não foi possível enviar uma oferta WebRTC válida.":
    "Could not send a valid WebRTC offer.",
  "Não foi possível enviar uma resposta WebRTC válida.":
    "Could not send a valid WebRTC answer.",
  "Não foi possível enviar um candidato de rede válido.":
    "Could not send a valid network candidate.",
  "Libere o microfone e tente novamente. Se necessário, clique na página para ativar o áudio.":
    "Allow microphone access and try again. If needed, click the page to activate audio.",
  "Este navegador não oferece os recursos necessários para transcrição local. Use um navegador atualizado em HTTPS.":
    "This browser lacks the features required for local transcription. Use an updated browser over HTTPS.",
  "Este dispositivo não conseguiu acompanhar a transcrição. Feche outras abas e tente novamente.":
    "This device could not keep up with transcription. Close other tabs and try again.",
  "Não foi possível carregar o modelo de voz. Verifique a conexão e tente novamente.":
    "Could not load the speech model. Check your connection and try again.",
  "Não foi possível manter o microfone ativo. Verifique o dispositivo e tente novamente.":
    "Could not keep the microphone active. Check the device and try again.",
  "A transcrição local foi interrompida. Tente novamente.":
    "Local transcription was interrupted. Try again.",
  "Concluindo a transcrição anterior…": "Finishing the previous transcription…",
  "O limite de tradução da DeepL foi atingido. O administrador precisa restabelecer a cota.":
    "The DeepL translation limit has been reached. The administrator needs to restore the quota.",
  "Selecione Português, Inglês, Espanhol ou Chinês como idioma falado.":
    "Select Portuguese, English, Spanish or Chinese as your spoken language.",
  "Autorize o microfone para transcrever sua fala.":
    "Allow microphone access to transcribe your speech.",
  "Transcrição pausada em segundo plano. Volte à sala e tente novamente.":
    "Transcription paused in the background. Return to the room and try again.",
  "A conexão de voz foi interrompida. Aguarde a reconexão da sala e tente novamente.":
    "The voice connection was interrupted. Wait for the room to reconnect and try again.",
  "Não foi possível acompanhar a transcrição. Tente novamente.":
    "Could not keep transcription running. Try again.",
  "Verificando o serviço de voz do Dicere…":
    "Checking the Dicere speech service…",
  "Ativando o microfone…": "Activating microphone…",
} satisfies ErrorMessages;

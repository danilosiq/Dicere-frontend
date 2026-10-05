import type { ErrorMessages } from "../types";

export const esErrors = {
  "Informe o título da sala": "Introduce el título de la sala",
  "O título deve possuir no máximo 50 caracteres":
    "El título debe tener como máximo 50 caracteres",
  "Informe seu nome": "Introduce tu nombre",
  "A senha deve possuir pelo menos 6 caracteres":
    "La contraseña debe tener al menos 6 caracteres",
  "Selecione o idioma em que deseja receber as traduções":
    "Selecciona el idioma en el que deseas recibir las traducciones",
  "Selecione o idioma que você irá falar na chamada":
    "Selecciona el idioma que hablarás en la llamada",
  "Informe o código da sala": "Introduce el código de la sala",
  "Código da sala inválido": "Código de sala inválido",
  "Informe a senha": "Introduce la contraseña",
  "Código da sala inválido.": "Código de sala inválido.",
  "Sala não encontrada.": "Sala no encontrada.",
  "Esta sala já possui dois participantes.":
    "Esta sala ya tiene dos participantes.",
  "Senha incorreta.": "Contraseña incorrecta.",
  "Esta sala expirou.": "Esta sala ha caducado.",
  "Esta sala não está mais ativa.": "Esta sala ya no está activa.",
  "Informe seu nome.": "Introduce tu nombre.",
  "Este nome já está sendo usado na sala.":
    "Este nombre ya está en uso en la sala.",
  "Este participante já está conectado.":
    "Este participante ya está conectado.",
  "Não foi possível retomar este participante.":
    "No se pudo recuperar este participante.",
  "Não foi possível entrar na sala. Tente novamente.":
    "No se pudo entrar en la sala. Inténtalo de nuevo.",
  "Confira os dados informados para criar a sala.":
    "Revisa los datos introducidos para crear la sala.",
  "Não foi possível criar a sala. Tente novamente.":
    "No se pudo crear la sala. Inténtalo de nuevo.",
  "Não foi possível concluir a operação. Tente novamente.":
    "No se pudo completar la operación. Inténtalo de nuevo.",
  "A sala foi criada, mas não foi possível conectar. Confirme novamente para tentar entrar.":
    "La sala se creó, pero no se pudo conectar. Confirma de nuevo para intentar entrar.",
  "A conexão com o servidor foi interrompida. Tente novamente.":
    "La conexión con el servidor se interrumpió. Inténtalo de nuevo.",
  "Não foi possível conectar ao servidor. Tente novamente.":
    "No se pudo conectar con el servidor. Inténtalo de nuevo.",
  "A conexão com a sala foi interrompida.":
    "La conexión con la sala se interrumpió.",
  "A conexão com a sala foi interrompida. Entre novamente.":
    "La conexión con la sala se interrumpió. Vuelve a entrar.",
  "A conexão com a tradução foi interrompida.":
    "La conexión de traducción se interrumpió.",
  "A conexão com o chat foi interrompida. Tente novamente.":
    "La conexión con el chat se interrumpió. Inténtalo de nuevo.",
  "A sessão da sala não está disponível.":
    "La sesión de la sala no está disponible.",
  "A sessão da sala não está disponível para tradução.":
    "La sesión de la sala no está disponible para traducir.",
  "Não foi possível alterar o idioma.": "No se pudo cambiar el idioma.",
  "Não foi possível alterar o idioma das traduções.":
    "No se pudo cambiar el idioma de las traducciones.",
  "Não foi possível confirmar o idioma. Tente selecionar novamente.":
    "No se pudo confirmar el idioma. Selecciónalo de nuevo.",
  "A confirmação pertence a outra sessão.":
    "La confirmación pertenece a otra sesión.",
  "Selecione o idioma em que você está escrevendo.":
    "Selecciona el idioma en el que estás escribiendo.",
  "Selecione um idioma de destino válido para traduzir.":
    "Selecciona un idioma de destino válido para traducir.",
  "Não foi possível carregar as mensagens.":
    "No se pudieron cargar los mensajes.",
  "Não foi possível enviar a mensagem.": "No se pudo enviar el mensaje.",
  "O servidor demorou para carregar o histórico. Tente novamente.":
    "El servidor tardó demasiado en cargar el historial. Inténtalo de nuevo.",
  "O servidor retornou um histórico de mensagens inválido.":
    "El servidor devolvió un historial de mensajes inválido.",
  "A operação do chat foi cancelada.": "La operación del chat se canceló.",
  "Não foi possível conectar ao serviço de tradução. Tente novamente.":
    "No se pudo conectar con el servicio de traducción. Inténtalo de nuevo.",
  "Não foi possível traduzir esta mensagem. Verifique os dados e tente novamente.":
    "No se pudo traducir este mensaje. Revisa los datos e inténtalo de nuevo.",
  "A mensagem não está mais disponível para tradução.":
    "Este mensaje ya no está disponible para traducir.",
  "O serviço de tradução está indisponível. Tente novamente em instantes.":
    "El servicio de traducción no está disponible. Inténtalo de nuevo en unos instantes.",
  "Não foi possível traduzir a mensagem.": "No se pudo traducir el mensaje.",
  "O servidor retornou uma tradução incompatível com a mensagem.":
    "El servidor devolvió una traducción que no corresponde al mensaje.",
  "Não foi possível enviar este trecho para tradução.":
    "No se pudo enviar este fragmento para traducir.",
  "Não foi possível traduzir este trecho.":
    "No se pudo traducir este fragmento.",
  "O servidor não aceitou este trecho para tradução.":
    "El servidor no aceptó este fragmento para traducir.",
  "O servidor não confirmou o recebimento deste trecho a tempo.":
    "El servidor no confirmó la recepción de este fragmento a tiempo.",
  "O servidor retornou uma legenda inválida.":
    "El servidor devolvió un subtítulo inválido.",
  "Não foi possível entrar na chamada. Tente novamente.":
    "No se pudo entrar en la llamada. Inténtalo de nuevo.",
  "Não foi possível iniciar a chamada.": "No se pudo iniciar la llamada.",
  "Não foi possível iniciar a câmera e o microfone. Tente novamente.":
    "No se pudieron iniciar la cámara y el micrófono. Inténtalo de nuevo.",
  "Permita o acesso à câmera e ao microfone para entrar na chamada.":
    "Permite el acceso a la cámara y al micrófono para entrar en la llamada.",
  "O acesso à câmera e ao microfone foi bloqueado pelo navegador.":
    "El navegador bloqueó el acceso a la cámara y al micrófono.",
  "Nenhuma câmera ou microfone disponível foi encontrado.":
    "No se encontró ninguna cámara o micrófono disponible.",
  "Não foi possível acessar a câmera ou o microfone. Verifique se outro aplicativo está usando o dispositivo.":
    "No se pudo acceder a la cámara o al micrófono. Comprueba si otra aplicación está usando el dispositivo.",
  "A câmera ou o microfone não atende às configurações necessárias para a chamada.":
    "La cámara o el micrófono no cumple los requisitos de la llamada.",
  "Este navegador não oferece suporte ao acesso de câmera e microfone.":
    "Este navegador no admite el acceso a la cámara y al micrófono.",
  "O navegador não oferece suporte ao acesso de câmera e microfone.":
    "El navegador no admite el acceso a la cámara y al micrófono.",
  "O acesso à câmera e ao microfone foi interrompido.":
    "El acceso a la cámara y al micrófono se interrumpió.",
  "O navegador não oferece suporte a chamadas WebRTC.":
    "El navegador no admite llamadas WebRTC.",
  "Não foi possível preparar a chamada. Tente novamente.":
    "No se pudo preparar la llamada. Inténtalo de nuevo.",
  "Não foi possível concluir a conexão da chamada.":
    "No se pudo establecer la conexión de la llamada.",
  "O servidor demorou para confirmar a preparação da chamada.":
    "El servidor tardó demasiado en confirmar la preparación de la llamada.",
  "O servidor retornou uma confirmação de chamada inválida.":
    "El servidor devolvió una confirmación de llamada inválida.",
  "O servidor retornou um estado de espera inválido.":
    "El servidor devolvió un estado de espera inválido.",
  "O servidor retornou um erro de preparação inválido.":
    "El servidor devolvió un error de preparación inválido.",
  "O servidor retornou uma definição de iniciador inválida.":
    "El servidor devolvió un iniciador de llamada inválido.",
  "O servidor retornou dados de negociação inválidos.":
    "El servidor devolvió datos de negociación inválidos.",
  "A negociação foi recebida de um participante inválido.":
    "Se recibió una negociación de un participante inválido.",
  "A conexão não está pronta para receber uma nova oferta.":
    "La conexión no está lista para recibir una nueva oferta.",
  "A conexão não está pronta para receber esta resposta.":
    "La conexión no está lista para recibir esta respuesta.",
  "O navegador não conseguiu criar a resposta da chamada.":
    "El navegador no pudo crear la respuesta de la llamada.",
  "O navegador não conseguiu criar a oferta da chamada.":
    "El navegador no pudo crear la oferta de la llamada.",
  "Não foi possível enviar uma oferta WebRTC válida.":
    "No se pudo enviar una oferta WebRTC válida.",
  "Não foi possível enviar uma resposta WebRTC válida.":
    "No se pudo enviar una respuesta WebRTC válida.",
  "Não foi possível enviar um candidato de rede válido.":
    "No se pudo enviar un candidato de red válido.",
  "Libere o microfone e tente novamente. Se necessário, clique na página para ativar o áudio.":
    "Permite el acceso al micrófono e inténtalo de nuevo. Si es necesario, haz clic en la página para activar el audio.",
  "Este navegador não oferece os recursos necessários para transcrição local. Use um navegador atualizado em HTTPS.":
    "Este navegador no tiene las funciones necesarias para la transcripción local. Usa un navegador actualizado con HTTPS.",
  "Este dispositivo não conseguiu acompanhar a transcrição. Feche outras abas e tente novamente.":
    "Este dispositivo no pudo seguir la transcripción. Cierra otras pestañas e inténtalo de nuevo.",
  "Não foi possível carregar o modelo de voz. Verifique a conexão e tente novamente.":
    "No se pudo cargar el modelo de voz. Revisa la conexión e inténtalo de nuevo.",
  "Não foi possível manter o microfone ativo. Verifique o dispositivo e tente novamente.":
    "No se pudo mantener el micrófono activo. Revisa el dispositivo e inténtalo de nuevo.",
  "A transcrição local foi interrompida. Tente novamente.":
    "La transcripción local se interrumpió. Inténtalo de nuevo.",
  "Concluindo a transcrição anterior…":
    "Finalizando la transcripción anterior…",
  "O limite de tradução da DeepL foi atingido. O administrador precisa restabelecer a cota.":
    "Se alcanzó el límite de traducción de DeepL. El administrador debe restablecer la cuota.",
  "Selecione Português, Inglês, Espanhol ou Chinês como idioma falado.":
    "Selecciona portugués, inglés, español o chino como idioma hablado.",
  "Autorize o microfone para transcrever sua fala.":
    "Permite el acceso al micrófono para transcribir tu voz.",
  "Transcrição pausada em segundo plano. Volte à sala e tente novamente.":
    "La transcripción se pausó en segundo plano. Vuelve a la sala e inténtalo de nuevo.",
  "A conexão de voz foi interrompida. Aguarde a reconexão da sala e tente novamente.":
    "La conexión de voz se interrumpió. Espera a que la sala se reconecte e inténtalo de nuevo.",
  "Não foi possível acompanhar a transcrição. Tente novamente.":
    "No se pudo mantener la transcripción. Inténtalo de nuevo.",
  "Verificando o serviço de voz do Dicere…":
    "Comprobando el servicio de voz de Dicere…",
  "Ativando o microfone…": "Activando el micrófono…",
} satisfies ErrorMessages;

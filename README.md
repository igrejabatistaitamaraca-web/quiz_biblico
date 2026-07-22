# Bíblia Quiz Live

Quiz bíblico multiplayer estilo auditório: a **TV** mostra as perguntas e o placar, os **celulares** dos jogadores funcionam como controle remoto. Segundo jogo da plataforma **BoardVerse**, entregue como MVP independente.

## Estrutura

```
biblia-quiz/
├── tv.html          → tela principal (TV / computador / projetor)
├── controle.html     → tela do celular de cada jogador
├── js/
│   ├── supabase.js       → configuração + DEMO_MODE
│   ├── data-provider.js  → DemoDataProvider / SupabaseDataProvider (mesma interface)
│   ├── game.js            → timer local, QR code, helpers
│   ├── audio.js           → narrador (arquivo gravado + fallback SpeechSynthesis)
│   ├── questions.js       → perguntas de exemplo do modo demo + cores/ícones
│   └── controle.js, tv.js → lógica de cada tela
└── audio/             → (opcional) arquivos .mp3 de narração gravada
```

## 1. Testar sem Supabase (Modo Demo)

O projeto já vem pronto para rodar **sem nenhuma configuração**:

1. Abra `js/supabase.js` e confirme que `DEMO_MODE = true`.
2. Sirva a pasta com qualquer servidor estático (não abra os arquivos direto com `file://`, pois os módulos JS e o BroadcastChannel exigem `http://`):
   ```bash
   cd biblia-quiz
   npx serve .
   # ou
   python3 -m http.server 8080
   ```
3. Abra `tv.html` em uma aba e `controle.html` em outra(s) aba(s) do **mesmo navegador** (o modo demo sincroniza as abas via `BroadcastChannel`).
4. Clique em **Criar Nova Sala** na TV, copie o código exibido e entre com ele em `controle.html`.

No modo demo, as 5 perguntas de exemplo em `questions.js` são usadas automaticamente.

## 2. Ligar ao Supabase real

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Confirme as tabelas usadas pelo projeto: `rooms`, `players`, `answers` e `perguntas`. As perguntas usam colunas em português, como `pergunta`, `alternativa_a` e `resposta_correta`.
3. Em **Database → Replication**, confirme que `rooms`, `players` e `answers` estão habilitadas para Realtime.
4. Em **Project Settings → API**, copie a **Project URL** e a **anon public key**.
5. Edite `js/supabase.js`:
   ```js
   export const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
   export const SUPABASE_ANON_KEY = "SUA-CHAVE-ANON-AQUI";
   export const DEMO_MODE = false;
   ```
6. Publique `tv.html` e `controle.html` em qualquer hospedagem estática (Vercel, Netlify, GitHub Pages) com **HTTPS** — necessário para a câmera ler o QR Code em celulares e para o Web Speech funcionar de forma consistente.
7. Adicione mais perguntas inserindo linhas na tabela `perguntas`.

## 3. Narração com áudio gravado

Coloque arquivos `.mp3` em `audio/` e preencha o campo `audio_url` da pergunta correspondente na tabela `perguntas` (ex: `audio/pergunta1.mp3`). Se o campo estiver vazio ou o arquivo não carregar, o narrador usa automaticamente a **Speech Synthesis** do navegador — o jogo nunca trava por falta de áudio.

## 4. Fluxo do jogo

```
Criar sala → QR Code → jogadores entram (nome + ícone) → host inicia
  → pergunta aparece na TV → narrador → jogadores respondem pelo celular
  → Supabase recebe respostas → Realtime sincroniza → tempo termina
  → calcula pontuação → mostra resposta certa → mostra placar
  → próxima pergunta → final da partida
```

## 5. Modo online (2 a 6 jogadores)

Abra `duelo.html` para criar ou entrar em uma partida na qual todos veem as perguntas e o placar no próprio aparelho. O anfitrião compartilha o link da sala e controla o início e o avanço das rodadas.

Para jogadores em redes diferentes, publique a pasta em uma hospedagem HTTPS. O Live Server é adequado apenas para testes na mesma rede local.

O modo online reaproveita as tabelas `rooms`, `players`, `answers` e `perguntas`; não é necessária uma alteração adicional no banco. As tabelas `rooms`, `players` e `answers` devem permanecer habilitadas na publicação `supabase_realtime`.

## 6. Observações importantes

- **Nickname = ícone**: ao entrar na sala, o jogador escolhe um emoji entre 12 opções como sua identidade visual. Não há campo de apelido em texto — o "nickname" é o próprio ícone.
- Máximo de **6 jogadores** por sala (bloqueado no banco via RLS e validado no frontend).
- Cada jogador só pode responder **uma vez por pergunta** (constraint única `room_id + question_id + player_id`).
- A pontuação é calculada **somente quando a pergunta termina**, nunca em tempo real por clique — evita qualquer tipo de manipulação client-side da pontuação.
- Tipos de pergunta implementados no MVP: `multiple_choice` e `bible_open`. Os tipos `true_false`, `complete_verse`, `who_am_i` e `bonus` já estão previstos na estrutura da tabela `perguntas`, prontos para implementação futura.
- A validação de "quem é o host" no MVP é feita de forma simples (token salvo localmente na TV que criou a sala). Para produção com múltiplos hosts simultâneos, o próximo passo natural é integrar Supabase Auth.

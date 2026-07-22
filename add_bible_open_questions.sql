insert into public.perguntas
  (id, pergunta, alternativa_a, alternativa_b, alternativa_c, alternativa_d,
   resposta_correta, categoria, dificuldade, audio_url, tempo_limite, tipo,
   explicacao, referencia, ativo)
values
  (151, 'Em qual passagem Jesus conta a parábola do bom samaritano?', 'Mateus 5', 'Lucas 10', 'João 3', 'Marcos 16', 'b', 'Evangelhos', 'facil', 'audio/q151.ogg', 35, 'bible_open', 'A parábola do bom samaritano está registrada no Evangelho de Lucas.', 'Lucas 10:25-37', true),
  (152, 'Segundo Atos 17, o que os bereanos faziam diariamente para confirmar o ensino recebido?', 'Consultavam os sacerdotes', 'Examinavam as Escrituras', 'Esperavam um sinal', 'Jejuavam no templo', 'b', 'Atos', 'medio', 'audio/q152.ogg', 40, 'bible_open', 'Os bereanos examinavam diariamente as Escrituras para conferir o que Paulo ensinava.', 'Atos 17:11', true),
  (153, 'Em qual livro do Antigo Testamento aparece a declaração: ''o justo viverá pela sua fé''?', 'Isaías', 'Jeremias', 'Habacuque', 'Malaquias', 'c', 'Profetas Menores', 'dificil', 'audio/q153.ogg', 45, 'bible_open', 'A declaração aparece em Habacuque e depois é retomada no Novo Testamento.', 'Habacuque 2:4', true),
  (154, 'Em qual capítulo encontramos a descrição da armadura de Deus?', 'Efésios 4', 'Efésios 5', 'Efésios 6', 'Filipenses 4', 'c', 'Cartas Paulinas', 'facil', 'audio/q154.ogg', 35, 'bible_open', 'Paulo descreve a armadura de Deus no encerramento da carta aos Efésios.', 'Efésios 6:10-18', true),
  (155, 'Qual rei encontrou o Livro da Lei durante a restauração do templo?', 'Ezequias', 'Josias', 'Manassés', 'Joás', 'b', 'Livros Históricos', 'medio', 'audio/q155.ogg', 40, 'bible_open', 'O Livro da Lei foi encontrado durante o reinado de Josias.', '2 Reis 22:8-11', true),
  (156, 'Qual salmo é conhecido por destacar repetidamente a Palavra e a Lei de Deus?', 'Salmo 23', 'Salmo 51', 'Salmo 91', 'Salmo 119', 'd', 'Salmos', 'facil', 'audio/q156.ogg', 35, 'bible_open', 'O Salmo 119 celebra os mandamentos, estatutos e a Palavra de Deus.', 'Salmo 119', true),
  (157, 'Em qual capítulo Paulo descreve o amor como paciente e bondoso?', 'Romanos 8', '1 Coríntios 13', '2 Coríntios 5', 'Gálatas 5', 'b', 'Cartas Paulinas', 'medio', 'audio/q157.ogg', 40, 'bible_open', 'A conhecida descrição do amor faz parte de 1 Coríntios 13.', '1 Coríntios 13:4-7', true),
  (158, 'Qual autor do Novo Testamento menciona a profecia de Enoque?', 'Pedro', 'João', 'Tiago', 'Judas', 'd', 'Cartas Gerais', 'dificil', 'audio/q158.ogg', 45, 'bible_open', 'A carta de Judas menciona diretamente a profecia atribuída a Enoque.', 'Judas 14-15', true),
  (159, 'Qual igreja do Apocalipse foi repreendida por ser morna?', 'Éfeso', 'Esmirna', 'Laodiceia', 'Filadélfia', 'c', 'Apocalipse', 'medio', 'audio/q159.ogg', 40, 'bible_open', 'A igreja de Laodiceia foi advertida por sua condição espiritual morna.', 'Apocalipse 3:14-22', true)
on conflict (id) do update set
  pergunta = excluded.pergunta,
  alternativa_a = excluded.alternativa_a,
  alternativa_b = excluded.alternativa_b,
  alternativa_c = excluded.alternativa_c,
  alternativa_d = excluded.alternativa_d,
  resposta_correta = excluded.resposta_correta,
  categoria = excluded.categoria,
  dificuldade = excluded.dificuldade,
  audio_url = excluded.audio_url,
  tempo_limite = excluded.tempo_limite,
  tipo = excluded.tipo,
  explicacao = excluded.explicacao,
  referencia = excluded.referencia,
  ativo = excluded.ativo;

update public.perguntas set tempo_limite = 30 where tipo = 'bible_open';
update public.perguntas set tempo_limite = 15 where tipo <> 'bible_open' or tipo is null;

select setval(
  pg_get_serial_sequence('public.perguntas', 'id'),
  (select max(id) from public.perguntas)
);

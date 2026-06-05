-- Importação do quadro Trello para o Banco de Alvos
-- Execute no Supabase > SQL Editor > New Query > Run

DO $$
DECLARE
  v_folder_id uuid;
  v_author_id uuid;
BEGIN
  SELECT id INTO v_folder_id FROM author_folders WHERE name = 'FURTO DE CORRENTINHA/CELUAR /ARROMBAMENTO/ roubo' LIMIT 1;
  IF v_folder_id IS NULL THEN
    INSERT INTO author_folders (name, description) VALUES ('FURTO DE CORRENTINHA/CELUAR /ARROMBAMENTO/ roubo', 'Importado do JSON do Trello') RETURNING id INTO v_folder_id;
  END IF;

  -- JUAN KAIKE
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'JUAN KAIKE' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('JUAN KAIKE', 'FUNÇÃO :FURTO DE CORRENTINHA', '21499866', 'FURTO DE CORRENTINHA', v_folder_id, 'Suspeito', 'Médio', 'NOME:JUAN KAIKE
CANDIDO DOS
SANTOS
RG:21499866
VULGO:
FUNÇÃO :FURTO DE CORRENTINHA') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/69c6bbc4c9745d68ac4e867d/attachments/69c6bbc58aa18fcc471d0427/download/1000628127_0x0_900x1600.png') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, '1000628127_0x0_900x1600.png', 'https://trello.com/1/cards/69c6bbc4c9745d68ac4e867d/attachments/69c6bbc58aa18fcc471d0427/download/1000628127_0x0_900x1600.png', 1360158, 'image/png', 'Importado do Trello');
  END IF;

  -- PIERRE HENRIQUE DE OLIVEIRA CANCIO
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'PIERRE HENRIQUE DE OLIVEIRA CANCIO' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('PIERRE HENRIQUE DE OLIVEIRA CANCIO', 'FUNÇÃO :FURTO DE CORRENTINHA', 'MG-21002606', 'FURTO DE CORRENTINHA', v_folder_id, 'Suspeito', 'Médio', '') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/69c6bc3a4712bb34c8673259/attachments/69c6bc3b0edbcda6ead5c959/download/1000628131_0x0_900x1600.png') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, '1000628131_0x0_900x1600.png', 'https://trello.com/1/cards/69c6bc3a4712bb34c8673259/attachments/69c6bc3b0edbcda6ead5c959/download/1000628131_0x0_900x1600.png', 1233921, 'image/png', 'Importado do Trello');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/69c6bc3a4712bb34c8673259/attachments/69c6bc9a122806d74469dd12/download/IMG-20260314-WA0054.jpg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'IMG-20260314-WA0054.jpg', 'https://trello.com/1/cards/69c6bc3a4712bb34c8673259/attachments/69c6bc9a122806d74469dd12/download/IMG-20260314-WA0054.jpg', 74624, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- MARQUES HENRIQUE SANTOS VIEIRA
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'MARQUES HENRIQUE SANTOS VIEIRA' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('MARQUES HENRIQUE SANTOS VIEIRA', 'MENOR', '23378948', 'FURTO DE CORRENTINHA', v_folder_id, 'Suspeito', 'Médio', '') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/69c6be71f1c867efefb15a66/attachments/69c6be72e947f112b5d90aec/download/1000628147_0x0_899x1599.png') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, '1000628147_0x0_899x1599.png', 'https://trello.com/1/cards/69c6be71f1c867efefb15a66/attachments/69c6be72e947f112b5d90aec/download/1000628147_0x0_899x1599.png', 1024926, 'image/png', 'Importado do Trello');
  END IF;

  -- HYAGO LUCAS FERNANDES CIRILO
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'HYAGO LUCAS FERNANDES CIRILO' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('HYAGO LUCAS FERNANDES CIRILO', 'FUNÇÃO : PULAO DE CORRENTINHA', '20039777', 'PULAO DE CORRENTINHA', v_folder_id, 'Suspeito', 'Médio', 'FURTOS PERTO DO SHOPPING CIDADE E NO CRUZAMENRO ESPÍRITO SANTO COM SANTOS DRUMOND') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/69c6c00417f628d16a7a5b5e/attachments/69c6c0067379ed3d3aa8591a/download/1000854915_0x0_1080x1044.png') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, '1000854915_0x0_1080x1044.png', 'https://trello.com/1/cards/69c6c00417f628d16a7a5b5e/attachments/69c6c0067379ed3d3aa8591a/download/1000854915_0x0_1080x1044.png', 840802, 'image/png', 'Importado do Trello');
  END IF;

  -- Joao Pedro Faria Ferreira
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'Joao Pedro Faria Ferreira' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('Joao Pedro Faria Ferreira', 'NAO TÊM', '21289243', 'pulao de correntinha', v_folder_id, 'Suspeito', 'Médio', 'NOME:Joao Pedro Faria Ferreira
RG:21289243
VULGO: NAO TÊM
FUNÇÃO :LADRÃO DE CORRENTINHA') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/69c6ea0b5d98b754405babb6/attachments/69c6ea0c5cf139b125733a2d/download/1000628549_0x0_900x1600.png') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, '1000628549_0x0_900x1600.png', 'https://trello.com/1/cards/69c6ea0b5d98b754405babb6/attachments/69c6ea0c5cf139b125733a2d/download/1000628549_0x0_900x1600.png', 556942, 'image/png', 'Importado do Trello');
  END IF;

  -- DIEGO LOURENCO DA SILVA
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'DIEGO LOURENCO DA SILVA' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('DIEGO LOURENCO DA SILVA', 'FUNÇÃO : PULAO DE CELULAR E CORRENTINHA', 'MG - 15709492', 'PULAO DE CELULAR E CORRENTINHA', v_folder_id, 'Suspeito', 'Médio', '') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/69c85cc14d70856df16ccecb/attachments/69c85cc2a2bcd6100e70d6a9/download/1000630404_0x0_900x1600.png') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, '1000630404_0x0_900x1600.png', 'https://trello.com/1/cards/69c85cc14d70856df16ccecb/attachments/69c85cc2a2bcd6100e70d6a9/download/1000630404_0x0_900x1600.png', 739806, 'image/png', 'Importado do Trello');
  END IF;

  -- RAFAEL VICTOR DE ALMEIDA RODRIGUES
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'RAFAEL VICTOR DE ALMEIDA RODRIGUES' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('RAFAEL VICTOR DE ALMEIDA RODRIGUES', 'FUNÇÃO :PULAO DE CORRENTINHA', 'MG - 20664978', 'PULAO DE CORRENTINHA', v_folder_id, 'Suspeito', 'Médio', '') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/69c85d8e63382c79862680db/attachments/69c85d909821e14708f376fa/download/1000630405_0x0_900x1600.png') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, '1000630405_0x0_900x1600.png', 'https://trello.com/1/cards/69c85d8e63382c79862680db/attachments/69c85d909821e14708f376fa/download/1000630405_0x0_900x1600.png', 1391318, 'image/png', 'Importado do Trello');
  END IF;

  -- WARLEN GOMES DA ROCHA
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'WARLEN GOMES DA ROCHA' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('WARLEN GOMES DA ROCHA', 'FUNÇÃO :AAROMBADOR DE LOJAS ATUA NA MADRUGADA', 'MG - 12437921', 'AAROMBADOR DE LOJAS ATUA NA MADRUGADA', v_folder_id, 'Suspeito', 'Médio', 'Fica na rua Itapecerica area do 34 próximo a praça do peixe') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/69c85e147fa2426dcfa9e8d0/attachments/69c85e14c712c0336684e576/download/1000630406_0x0_1200x1600.png') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, '1000630406_0x0_1200x1600.png', 'https://trello.com/1/cards/69c85e147fa2426dcfa9e8d0/attachments/69c85e14c712c0336684e576/download/1000630406_0x0_1200x1600.png', 1193111, 'image/png', 'Importado do Trello');
  END IF;

  -- BRUNO SILVA DRUMMOND VIEIRA
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'BRUNO SILVA DRUMMOND VIEIRA' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('BRUNO SILVA DRUMMOND VIEIRA', 'FUNÇÃO :ARROMBADOR , ATUA NA MADRUGADA', 'MG - 16220924', 'ARROMBADOR , ATUA NA MADRUGADA', v_folder_id, 'Suspeito', 'Médio', 'Autor de arrombamento na loja do cabeleireiro na rua sao paulo entre santos Dumont e caetes') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/69c85ea96a613db5e22d4350/attachments/69c85eaae46ac593738cd06a/download/1000630409_0x0_738x1600.png') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, '1000630409_0x0_738x1600.png', 'https://trello.com/1/cards/69c85ea96a613db5e22d4350/attachments/69c85eaae46ac593738cd06a/download/1000630409_0x0_738x1600.png', 874476, 'image/png', 'Importado do Trello');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/69c85ea96a613db5e22d4350/attachments/69ef4fb3ee300fc20f940726/download/IMG_20260427_085904.jpg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'IMG_20260427_085904.jpg', 'https://trello.com/1/cards/69c85ea96a613db5e22d4350/attachments/69ef4fb3ee300fc20f940726/download/IMG_20260427_085904.jpg', 6049952, 'image/jpeg', 'Importado do Trello');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/69c85ea96a613db5e22d4350/attachments/69ef4fc1c7a63e0beb91ab13/download/IMG_20260427_085852.jpg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'IMG_20260427_085852.jpg', 'https://trello.com/1/cards/69c85ea96a613db5e22d4350/attachments/69ef4fc1c7a63e0beb91ab13/download/IMG_20260427_085852.jpg', 6153456, 'image/jpeg', 'Importado do Trello');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/69c85ea96a613db5e22d4350/attachments/69ef4fc9b8cf2e973cc8bb73/download/IMG_20260427_085847.jpg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'IMG_20260427_085847.jpg', 'https://trello.com/1/cards/69c85ea96a613db5e22d4350/attachments/69ef4fc9b8cf2e973cc8bb73/download/IMG_20260427_085847.jpg', 5472708, 'image/jpeg', 'Importado do Trello');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/69c85ea96a613db5e22d4350/attachments/69ef4fd0707c45a3b765490a/download/IMG_20260427_085840.jpg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'IMG_20260427_085840.jpg', 'https://trello.com/1/cards/69c85ea96a613db5e22d4350/attachments/69ef4fd0707c45a3b765490a/download/IMG_20260427_085840.jpg', 4036797, 'image/jpeg', 'Importado do Trello');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/69c85ea96a613db5e22d4350/attachments/69efb88e00f265dc63a16c88/download/IMG_20260427_085837.jpg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'IMG_20260427_085837.jpg', 'https://trello.com/1/cards/69c85ea96a613db5e22d4350/attachments/69efb88e00f265dc63a16c88/download/IMG_20260427_085837.jpg', 4719153, 'image/jpeg', 'Importado do Trello');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/69c85ea96a613db5e22d4350/attachments/69efb892a22ab09b29c3b521/download/IMG_20260427_085857.jpg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'IMG_20260427_085857.jpg', 'https://trello.com/1/cards/69c85ea96a613db5e22d4350/attachments/69efb892a22ab09b29c3b521/download/IMG_20260427_085857.jpg', 4271706, 'image/jpeg', 'Importado do Trello');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/69c85ea96a613db5e22d4350/attachments/69efb8979db118e5fd528fbd/download/IMG_20260427_085904.jpg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'IMG_20260427_085904.jpg', 'https://trello.com/1/cards/69c85ea96a613db5e22d4350/attachments/69efb8979db118e5fd528fbd/download/IMG_20260427_085904.jpg', 6049952, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- Weslley Pereira De Jesus -
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'Weslley Pereira De Jesus -' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('Weslley Pereira De Jesus -', 'LACOSTE', '02118854609', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', '157 - Caetés e Oiapoque
Revólver cromado') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/69ef29ba6ca3344613e5d52d/attachments/69ef29bbe5f1c1c3948f9df7/download/408389_0x501_1004x1734.png') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, '408389_0x501_1004x1734.png', 'https://trello.com/1/cards/69ef29ba6ca3344613e5d52d/attachments/69ef29bbe5f1c1c3948f9df7/download/408389_0x501_1004x1734.png', 689421, 'image/png', 'Importado do Trello');
  END IF;

  -- David Jean Vieira Dos Santos
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'David Jean Vieira Dos Santos' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('David Jean Vieira Dos Santos', 'FUNÇÃO :LADRÃO DE CORRENTINHA', '18918570619', 'LADRÃO DE CORRENTINHA', v_folder_id, 'Suspeito', 'Médio', 'NOME: David Jean Vieira Dos Santos
RG:MG - 25649698
VULGO:
FUNÇÃO :LADRÃO DE CORRENTINHA') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1c77c1d36b6b66ec2a05c5/attachments/6a1c77c1d36b6b66ec2a0699/download/WhatsApp_Image_2026-05-31_at_14.40.11.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-05-31 at 14.40.11.jpeg', 'https://trello.com/1/cards/6a1c77c1d36b6b66ec2a05c5/attachments/6a1c77c1d36b6b66ec2a0699/download/WhatsApp_Image_2026-05-31_at_14.40.11.jpeg', 114768, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- Kevin Mateus Andrade Ferreira
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'Kevin Mateus Andrade Ferreira' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('Kevin Mateus Andrade Ferreira', '', '10782211542', 'LADRÃO DE CORRENTINHA', v_folder_id, 'Suspeito', 'Médio', 'Kevin Mateus Andrade Ferreira
CPF: 10782211542
RG: 26169659

FUNÇÃO :LADRÃO DE CORRENTINHA') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1c78b89c3404cb87d89ef1/attachments/6a1c78b89c3404cb87d89f22/download/WhatsApp_Image_2026-05-31_at_14.38.11.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-05-31 at 14.38.11.jpeg', 'https://trello.com/1/cards/6a1c78b89c3404cb87d89ef1/attachments/6a1c78b89c3404cb87d89f22/download/WhatsApp_Image_2026-05-31_at_14.38.11.jpeg', 119962, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- Luiz Gustavo Pereira De Souza
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'Luiz Gustavo Pereira De Souza' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('Luiz Gustavo Pereira De Souza', '', '17293517602', 'ladrão de correntinha', v_folder_id, 'Suspeito', 'Médio', 'Luiz Gustavo Pereira De Souza
CPF: 17293517602
RG: 22565080

FUNÇÃO : ladrão de correntinha') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1c7913e2ebdb349e926615/attachments/6a1c7913e2ebdb349e926647/download/WhatsApp_Image_2026-05-31_at_14.35.05.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-05-31 at 14.35.05.jpeg', 'https://trello.com/1/cards/6a1c7913e2ebdb349e926615/attachments/6a1c7913e2ebdb349e926647/download/WhatsApp_Image_2026-05-31_at_14.35.05.jpeg', 117976, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- Euler Rafael Moreira Da Silva
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'Euler Rafael Moreira Da Silva' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('Euler Rafael Moreira Da Silva', '', '16183594601', 'LADRÃO DE CORRENTINHA', v_folder_id, 'Suspeito', 'Médio', 'Euler Rafael Moreira Da Silva
CPF: 16183594601L
RG: 21490740

FUNÇÃO : LADRÃO DE CORRENTINHA') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1c79981238696a363b950b/attachments/6a1c79981238696a363b953e/download/WhatsApp_Image_2026-05-31_at_13.57.13.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-05-31 at 13.57.13.jpeg', 'https://trello.com/1/cards/6a1c79981238696a363b950b/attachments/6a1c79981238696a363b953e/download/WhatsApp_Image_2026-05-31_at_13.57.13.jpeg', 143747, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- lago Christofer De Oliveira
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'lago Christofer De Oliveira' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('lago Christofer De Oliveira', '', '14601557690', 'LADRÃO DE CORRENTINHA', v_folder_id, 'Suspeito', 'Médio', 'lago Christofer De Oliveira
CPF: 14601557690
RG: 20988468

FUNÇÃO LADRÃO DE CORRENTINHA') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1c7a2e26705aa85deb843d/attachments/6a1c7a2e26705aa85deb8471/download/WhatsApp_Image_2026-05-31_at_08.52.33.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-05-31 at 08.52.33.jpeg', 'https://trello.com/1/cards/6a1c7a2e26705aa85deb843d/attachments/6a1c7a2e26705aa85deb8471/download/WhatsApp_Image_2026-05-31_at_08.52.33.jpeg', 134130, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- Gabriel Rodrigues Dos Santos
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'Gabriel Rodrigues Dos Santos' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('Gabriel Rodrigues Dos Santos', '', '15027754680', 'Ladrão de correntinha', v_folder_id, 'Suspeito', 'Médio', 'Gabriel Rodrigues Dos Santos
CPF: 15027754680
RG: 20612082

FUNÇÃO: Ladrão de correntinha') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1c7a64fd3f4331521b6168/attachments/6a1c7a64fd3f4331521b619d/download/WhatsApp_Image_2026-05-31_at_08.50.53.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-05-31 at 08.50.53.jpeg', 'https://trello.com/1/cards/6a1c7a64fd3f4331521b6168/attachments/6a1c7a64fd3f4331521b619d/download/WhatsApp_Image_2026-05-31_at_08.50.53.jpeg', 113858, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- luri Rafael Reiner Dos Santos Silva
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'luri Rafael Reiner Dos Santos Silva' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('luri Rafael Reiner Dos Santos Silva', '', '16707979612', 'LADRÃO DE CORRENTINHA', v_folder_id, 'Suspeito', 'Médio', 'luri Rafael Reiner Dos Santos Silva
CPF: 16707979612
RG: 22699985

FUNÇÃO:LADRÃO DE CORRENTINHA') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1c7aeb6f604ffe3acacaa4/attachments/6a1c7aeb6f604ffe3acacada/download/WhatsApp_Image_2026-05-30_at_11.05.02.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-05-30 at 11.05.02.jpeg', 'https://trello.com/1/cards/6a1c7aeb6f604ffe3acacaa4/attachments/6a1c7aeb6f604ffe3acacada/download/WhatsApp_Image_2026-05-30_at_11.05.02.jpeg', 193892, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- Matheus Rodrigues Gonçalves Morais
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'Matheus Rodrigues Gonçalves Morais' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('Matheus Rodrigues Gonçalves Morais', '', '21948208', 'LADRÃO DE CORRENTINHA', v_folder_id, 'Suspeito', 'Médio', 'Matheus Rodrigues Gonçalves Morais
RG: 21948208

FUNÇÃO :LADRÃO DE CORRENTINHA') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1c7d34b1d821cd9330c04e/attachments/6a1c7d34b1d821cd9330c085/download/WhatsApp_Image_2026-05-30_at_11.05.02_(2).jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-05-30 at 11.05.02 (2).jpeg', 'https://trello.com/1/cards/6a1c7d34b1d821cd9330c04e/attachments/6a1c7d34b1d821cd9330c085/download/WhatsApp_Image_2026-05-30_at_11.05.02_(2).jpeg', 294027, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- ERICK HENRIQUE GARCIA DE CASTRO
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'ERICK HENRIQUE GARCIA DE CASTRO' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('ERICK HENRIQUE GARCIA DE CASTRO', '', '20367182', 'LADRÃO DE CORRENTINHA', v_folder_id, 'Suspeito', 'Médio', 'ERICK HENRIQUE GARCIA DE CASTRO
RG: 20367182

FUNÇÃO :LADRÃO DE CORRENTINHA') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1c7d74ff951bcdc9387e65/attachments/6a1c7d74ff951bcdc9387e9d/download/WhatsApp_Image_2026-05-30_at_10.50.54.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-05-30 at 10.50.54.jpeg', 'https://trello.com/1/cards/6a1c7d74ff951bcdc9387e65/attachments/6a1c7d74ff951bcdc9387e9d/download/WhatsApp_Image_2026-05-30_at_10.50.54.jpeg', 154817, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- Pedro Henrique Souza Silva
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'Pedro Henrique Souza Silva' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('Pedro Henrique Souza Silva', '', '14346705626', 'LADRÃO DE CORRENTINHA', v_folder_id, 'Suspeito', 'Médio', 'Pedro Henrique Souza Silva
CPF: 14346705626
RG: 24362572

FUNÇÃO :LADRÃO DE CORRENTINHA') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1c7e38fe2675043b5056fa/attachments/6a1c7e39fe2675043b505733/download/WhatsApp_Image_2026-04-24_at_10.16.59.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-04-24 at 10.16.59.jpeg', 'https://trello.com/1/cards/6a1c7e38fe2675043b5056fa/attachments/6a1c7e39fe2675043b505733/download/WhatsApp_Image_2026-04-24_at_10.16.59.jpeg', 182592, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- LEANDRO THALES SILVA ALMEIDA MG -
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'LEANDRO THALES SILVA ALMEIDA MG -' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('LEANDRO THALES SILVA ALMEIDA MG -', '', '22780527', 'LADRÃO DE CORRENTINHA', v_folder_id, 'Suspeito', 'Médio', 'Nome: LEANDRO THALES SILVA ALMEIDA

 MG - 22780527

FUNÇÃO :LADRÃO DE CORRENTINHA') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1c7e9b15caaf804e673ebf/attachments/6a1c7e9c15caaf804e673ef9/download/WhatsApp_Image_2026-04-10_at_11.59.51.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-04-10 at 11.59.51.jpeg', 'https://trello.com/1/cards/6a1c7e9b15caaf804e673ebf/attachments/6a1c7e9c15caaf804e673ef9/download/WhatsApp_Image_2026-04-10_at_11.59.51.jpeg', 89818, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- RIQUELME MOURA BARROS
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'RIQUELME MOURA BARROS' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('RIQUELME MOURA BARROS', '', 'MG-19817948', 'LADRÃO DE CORRENTINHA', v_folder_id, 'Suspeito', 'Médio', 'RIQUELME MOURA BARROS
RG:MG-19817948

FUNÇÃO :LADRÃO DE CORRENTINHA') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1c7ef563ee1add9e17137f/attachments/6a1c7ef563ee1add9e1713ba/download/WhatsApp_Image_2026-04-10_at_12.00.45.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-04-10 at 12.00.45.jpeg', 'https://trello.com/1/cards/6a1c7ef563ee1add9e17137f/attachments/6a1c7ef563ee1add9e1713ba/download/WhatsApp_Image_2026-04-10_at_12.00.45.jpeg', 138252, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- DANIEL ANTUNES DA SILVA PEREIRA
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'DANIEL ANTUNES DA SILVA PEREIRA' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('DANIEL ANTUNES DA SILVA PEREIRA', '', 'MG-18311283', 'LADRÃO DE CORRENTINHA', v_folder_id, 'Suspeito', 'Médio', 'DANIEL ANTUNES DA SILVA PEREIRA
RG: MG-18311283

FUNÇÃO :LADRÃO DE CORRENTINHA') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1c7f2e859a0ab95d3cefc3/attachments/6a1c7f2e859a0ab95d3cefff/download/WhatsApp_Image_2026-04-10_at_12.01.58.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-04-10 at 12.01.58.jpeg', 'https://trello.com/1/cards/6a1c7f2e859a0ab95d3cefc3/attachments/6a1c7f2e859a0ab95d3cefff/download/WhatsApp_Image_2026-04-10_at_12.01.58.jpeg', 131148, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- Everton Luiz dias
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'Everton Luiz dias' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('Everton Luiz dias', '', 'MG-12494892', 'LADRÃO DE CORRENTINHA', v_folder_id, 'Suspeito', 'Médio', 'Everton Luiz dias
RG MG-12494892

FUNÇÃO :LADRÃO DE CORRENTINHA') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1c7f911148c017a39443f5/attachments/6a1c7f911148c017a3944434/download/WhatsApp_Image_2026-04-07_at_10.00.15.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-04-07 at 10.00.15.jpeg', 'https://trello.com/1/cards/6a1c7f911148c017a39443f5/attachments/6a1c7f911148c017a3944434/download/WhatsApp_Image_2026-04-07_at_10.00.15.jpeg', 128166, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- JULIO HENRIQUE OLIVEIRA DOS ANJOS
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'JULIO HENRIQUE OLIVEIRA DOS ANJOS' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('JULIO HENRIQUE OLIVEIRA DOS ANJOS', '', '20315561', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', '') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1d988825a7845856227b1d/attachments/6a1d988825a7845856227b5b/download/WhatsApp_Image_2026-04-04_at_13.18.43.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-04-04 at 13.18.43.jpeg', 'https://trello.com/1/cards/6a1d988825a7845856227b1d/attachments/6a1d988825a7845856227b5b/download/WhatsApp_Image_2026-04-04_at_13.18.43.jpeg', 66690, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- WESLEY FERNANDO DA CONCEICAO REIS
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'WESLEY FERNANDO DA CONCEICAO REIS' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('WESLEY FERNANDO DA CONCEICAO REIS', '', '19533824', 'ARROMBAMENTO DE VEICULOS', v_folder_id, 'Suspeito', 'Médio', 'WESLEY FERNANDO DA CONCEICAO REIS

RG/Ident. 19533824

FUNÇÃO: ARROMBAMENTO DE VEICULOS') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1db9a5bddf6351f490503d/attachments/6a1db9a6bddf6351f490507c/download/Captura_de_tela_2026-06-01_135125.png') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'Captura de tela 2026-06-01 135125.png', 'https://trello.com/1/cards/6a1db9a5bddf6351f490503d/attachments/6a1db9a6bddf6351f490507c/download/Captura_de_tela_2026-06-01_135125.png', 96228, 'image/png', 'Importado do Trello');
  END IF;

  -- Alex Calixto dos Santos
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'Alex Calixto dos Santos' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('Alex Calixto dos Santos', '', '24722582', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', 'Alex Calixto dos Santos
RG: 24722582

LADRÃO DE CORRENTINHA') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1dd310a008327274b61206/attachments/6a1dd311a008327274b61384/download/WhatsApp_Image_2026-04-04_at_09.36.24.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-04-04 at 09.36.24.jpeg', 'https://trello.com/1/cards/6a1dd310a008327274b61206/attachments/6a1dd311a008327274b61384/download/WhatsApp_Image_2026-04-04_at_09.36.24.jpeg', 199961, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- WESLEY MARTEUS DE OLIVEIRA FERNANDES
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'WESLEY MARTEUS DE OLIVEIRA FERNANDES' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('WESLEY MARTEUS DE OLIVEIRA FERNANDES', '', '17101375685', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', 'Nome

WESLEY MARTEUS DE OLIVEIRA FERNANDES

CPF

17101375685

RG

19582775

LADRÃO DE CORRENTINHA') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1dd33aced092df6c384a16/attachments/6a1dd33aced092df6c384a57/download/WhatsApp_Image_2026-03-31_at_11.49.21.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-03-31 at 11.49.21.jpeg', 'https://trello.com/1/cards/6a1dd33aced092df6c384a16/attachments/6a1dd33aced092df6c384a57/download/WhatsApp_Image_2026-03-31_at_11.49.21.jpeg', 151691, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- ALEXANDER JUNIO FELIPE DOS SANTOS
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'ALEXANDER JUNIO FELIPE DOS SANTOS' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('ALEXANDER JUNIO FELIPE DOS SANTOS', '', '14870060639', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', '') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1dd37b69f2ebb42fc3cc24/attachments/6a1dd37b69f2ebb42fc3cc66/download/WhatsApp_Image_2026-03-31_at_11.48.53.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-03-31 at 11.48.53.jpeg', 'https://trello.com/1/cards/6a1dd37b69f2ebb42fc3cc24/attachments/6a1dd37b69f2ebb42fc3cc66/download/WhatsApp_Image_2026-03-31_at_11.48.53.jpeg', 137132, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- Douglas Ruan Alves Dos Anjos
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'Douglas Ruan Alves Dos Anjos' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('Douglas Ruan Alves Dos Anjos', '', '14316704648', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', 'Douglas Ruan Alves Dos Anjos
CPF: 14316704648
RG: 18002292

Rua Açucenas, 213, Vespasiano bairro Santa Clara') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1dd3c69312d6ad1dad3a5b/attachments/6a1dd3c69312d6ad1dad3bc4/download/WhatsApp_Image_2026-03-27_at_11.31.34.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-03-27 at 11.31.34.jpeg', 'https://trello.com/1/cards/6a1dd3c69312d6ad1dad3a5b/attachments/6a1dd3c69312d6ad1dad3bc4/download/WhatsApp_Image_2026-03-27_at_11.31.34.jpeg', 135975, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- MARCOS VINICIUS BARBOSA
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'MARCOS VINICIUS BARBOSA' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('MARCOS VINICIUS BARBOSA', '', '3493978', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', 'MARCOS VINICIUS BARBOSA
MG-18484112

LADRÃO DE CORRENTINHA') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1dd4053e99156f24268e1f/attachments/6a1dd4053e99156f24268e63/download/WhatsApp_Image_2026-03-27_at_11.27.58.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-03-27 at 11.27.58.jpeg', 'https://trello.com/1/cards/6a1dd4053e99156f24268e1f/attachments/6a1dd4053e99156f24268e63/download/WhatsApp_Image_2026-03-27_at_11.27.58.jpeg', 126363, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- Nicolas wiss de Sousa pinheiro da Silva
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'Nicolas wiss de Sousa pinheiro da Silva' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('Nicolas wiss de Sousa pinheiro da Silva', '', '', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', '') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1dd447540440542a59a2d1/attachments/6a1dd447540440542a59a32b/download/WhatsApp_Image_2026-03-27_at_11.25.37.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-03-27 at 11.25.37.jpeg', 'https://trello.com/1/cards/6a1dd447540440542a59a2d1/attachments/6a1dd447540440542a59a32b/download/WhatsApp_Image_2026-03-27_at_11.25.37.jpeg', 140927, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- JHONATAN RODRIGUES CAMPOS
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'JHONATAN RODRIGUES CAMPOS' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('JHONATAN RODRIGUES CAMPOS', '', '70609963627', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', 'JHONATAN RODRIGUES CAMPOS
CPF 70609963627

A05 Abordado na são Paulo com Olegário Maciel autor contumaz de furto de correntinha') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1dd48c9312d6ad1daf6603/attachments/6a1dd48c9312d6ad1daf6682/download/WhatsApp_Image_2026-03-24_at_11.07.34.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-03-24 at 11.07.34.jpeg', 'https://trello.com/1/cards/6a1dd48c9312d6ad1daf6603/attachments/6a1dd48c9312d6ad1daf6682/download/WhatsApp_Image_2026-03-24_at_11.07.34.jpeg', 202827, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- Marcos Daniel Rodrigues
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'Marcos Daniel Rodrigues' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('Marcos Daniel Rodrigues', '', '', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', 'Marcos Daniel Rodrigues
05/04/2009
Bairro São Benedito selenita Ribeirão Pimentel

LADRÃO DE CORRENTINHA') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1dd4dd4633a8ac0777ad19/attachments/6a1dd4dd4633a8ac0777ad60/download/WhatsApp_Image_2026-03-12_at_11.27.04.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-03-12 at 11.27.04.jpeg', 'https://trello.com/1/cards/6a1dd4dd4633a8ac0777ad19/attachments/6a1dd4dd4633a8ac0777ad60/download/WhatsApp_Image_2026-03-12_at_11.27.04.jpeg', 191921, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- Wenderson Júnior do Carmo
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'Wenderson Júnior do Carmo' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('Wenderson Júnior do Carmo', '', '', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', 'Wenderson Júnior do Carmo

Mãe: Luciana Dias do Carmo

LADRÃO DE CORRENTINHA') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1dd529222b6a5ef3054385/attachments/6a1dd52a222b6a5ef30543cd/download/WhatsApp_Image_2026-03-14_at_12.28.11.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-03-14 at 12.28.11.jpeg', 'https://trello.com/1/cards/6a1dd529222b6a5ef3054385/attachments/6a1dd52a222b6a5ef30543cd/download/WhatsApp_Image_2026-03-14_at_12.28.11.jpeg', 206628, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- KAYKY RAMALHO FERREIRA DE SOUZA
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'KAYKY RAMALHO FERREIRA DE SOUZA' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('KAYKY RAMALHO FERREIRA DE SOUZA', '', '70734120621', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', 'KAYKY RAMALHO FERREIRA DE SOUZA
CPF : 70734120621

LADRÃO DE CORRENTINHA') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1dd5a3b3057185025154e5/attachments/6a1dd5a3b30571850251552e/download/WhatsApp_Image_2026-04-15_at_14.14.38.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-04-15 at 14.14.38.jpeg', 'https://trello.com/1/cards/6a1dd5a3b3057185025154e5/attachments/6a1dd5a3b30571850251552e/download/WhatsApp_Image_2026-04-15_at_14.14.38.jpeg', 156683, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- LEANDRO PIETRO VIEIRA DOS SANTOS
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'LEANDRO PIETRO VIEIRA DOS SANTOS' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('LEANDRO PIETRO VIEIRA DOS SANTOS', '', '22484506', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', 'LADRÃO DE CORRENTINHA

LEANDRO PIETRO VIEIRA DOS SANTOS

MG - 22484506') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1dd5d8ed62d99eecc2cc54/attachments/6a1dd5d8ed62d99eecc2cc9e/download/WhatsApp_Image_2026-04-15_at_14.14.38_(1).jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-04-15 at 14.14.38 (1).jpeg', 'https://trello.com/1/cards/6a1dd5d8ed62d99eecc2cc54/attachments/6a1dd5d8ed62d99eecc2cc9e/download/WhatsApp_Image_2026-04-15_at_14.14.38_(1).jpeg', 82014, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- VICTOR CLEBERTON FERREIRA
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'VICTOR CLEBERTON FERREIRA' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('VICTOR CLEBERTON FERREIRA', '', '', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', 'VICTOR CLEBERTON FERREIRA

MÃE: LIVIA MARGARIDA FERREIRA

LADRÃO DE CORRENTINHA') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1dd61a7de56c76148ead1b/attachments/6a1dd61a7de56c76148ead66/download/WhatsApp_Image_2026-04-15_at_14.14.38_(2).jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-04-15 at 14.14.38 (2).jpeg', 'https://trello.com/1/cards/6a1dd61a7de56c76148ead1b/attachments/6a1dd61a7de56c76148ead66/download/WhatsApp_Image_2026-04-15_at_14.14.38_(2).jpeg', 215554, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- EDUARDO SOUZA DA SILVA
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'EDUARDO SOUZA DA SILVA' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('EDUARDO SOUZA DA SILVA', '', '23409021', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', '') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1dd64e9abe11054c039501/attachments/6a1dd64e9abe11054c03954d/download/WhatsApp_Image_2026-04-15_at_14.14.38_(3).jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-04-15 at 14.14.38 (3).jpeg', 'https://trello.com/1/cards/6a1dd64e9abe11054c039501/attachments/6a1dd64e9abe11054c03954d/download/WhatsApp_Image_2026-04-15_at_14.14.38_(3).jpeg', 144874, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- THIAGO ALEXANDRE NUNES DA SILVA
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'THIAGO ALEXANDRE NUNES DA SILVA' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('THIAGO ALEXANDRE NUNES DA SILVA', '', '21867058', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', '') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1dd66d3f75b986b698c759/attachments/6a1dd66d3f75b986b698c7a6/download/WhatsApp_Image_2026-04-15_at_14.14.38_(4).jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-04-15 at 14.14.38 (4).jpeg', 'https://trello.com/1/cards/6a1dd66d3f75b986b698c759/attachments/6a1dd66d3f75b986b698c7a6/download/WhatsApp_Image_2026-04-15_at_14.14.38_(4).jpeg', 263164, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- ICARO GABRIEL DOS SANTOS FERREIRA
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'ICARO GABRIEL DOS SANTOS FERREIRA' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('ICARO GABRIEL DOS SANTOS FERREIRA', '', '21886024', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', 'ICARO GABRIEL DOS SANTOS FERREIRA

RG: 21886024

Endereço: Trinta e Um de Janeiro, Bairro Nova Esperança - SANTA LUZIA') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1dd68dc8f00f80968ea796/attachments/6a1dd68dc8f00f80968ea7e4/download/WhatsApp_Image_2026-04-15_at_14.14.38_(5).jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-04-15 at 14.14.38 (5).jpeg', 'https://trello.com/1/cards/6a1dd68dc8f00f80968ea796/attachments/6a1dd68dc8f00f80968ea7e4/download/WhatsApp_Image_2026-04-15_at_14.14.38_(5).jpeg', 44007, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- OLIVER VINICIUS DOS SANTOS PEREIRA
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'OLIVER VINICIUS DOS SANTOS PEREIRA' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('OLIVER VINICIUS DOS SANTOS PEREIRA', '', '', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', 'OLIVER VINICIUS DOS SANTOS PEREIRA

Endereço: Trinta e Um de Janeiro, Bairro Nova Esperança - SANTA LUZIA

LADRÃO DE CORRENTINHA') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1dd722b1669111cd9a2336/attachments/6a1dd722b1669111cd9a2385/download/WhatsApp_Image_2026-04-15_at_14.14.38_(6).jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2026-04-15 at 14.14.38 (6).jpeg', 'https://trello.com/1/cards/6a1dd722b1669111cd9a2336/attachments/6a1dd722b1669111cd9a2385/download/WhatsApp_Image_2026-04-15_at_14.14.38_(6).jpeg', 40411, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- ISAAC WISS DA SILVA
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'ISAAC WISS DA SILVA' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('ISAAC WISS DA SILVA', '', '19059465628', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', '') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1ddc5a84aecc05ade6ab94/attachments/6a1ddc5a84aecc05ade6abe4/download/WhatsApp_Image_2025-11-26_at_11.48.39.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2025-11-26 at 11.48.39.jpeg', 'https://trello.com/1/cards/6a1ddc5a84aecc05ade6ab94/attachments/6a1ddc5a84aecc05ade6abe4/download/WhatsApp_Image_2025-11-26_at_11.48.39.jpeg', 107914, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- DAVI VIEIRA DOS SANTOS
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'DAVI VIEIRA DOS SANTOS' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('DAVI VIEIRA DOS SANTOS', '', '70439841658', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', '') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1ddc7c982ff19f34a3118f/attachments/6a1ddc7c982ff19f34a311e0/download/WhatsApp_Image_2025-11-26_at_11.46.25.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2025-11-26 at 11.46.25.jpeg', 'https://trello.com/1/cards/6a1ddc7c982ff19f34a3118f/attachments/6a1ddc7c982ff19f34a311e0/download/WhatsApp_Image_2025-11-26_at_11.46.25.jpeg', 146363, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- FAGNER JUNIO LEMOS DA SILVA,
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'FAGNER JUNIO LEMOS DA SILVA,' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('FAGNER JUNIO LEMOS DA SILVA,', '', '22666697', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', '') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1ddcf8d5fc281b93349795/attachments/6a1ddcf9d5fc281b933497e8/download/WhatsApp_Image_2025-11-21_at_19.24.08.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2025-11-21 at 19.24.08.jpeg', 'https://trello.com/1/cards/6a1ddcf8d5fc281b93349795/attachments/6a1ddcf9d5fc281b933497e8/download/WhatsApp_Image_2025-11-21_at_19.24.08.jpeg', 159752, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- RUAN VICTOR ANDRADE MARTINS
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'RUAN VICTOR ANDRADE MARTINS' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('RUAN VICTOR ANDRADE MARTINS', '', '19373491', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', '') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1ddd266685a40dc4a62e3f/attachments/6a1ddd276685a40dc4a62e92/download/WhatsApp_Image_2025-11-21_at_19.24.08_(1).jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2025-11-21 at 19.24.08 (1).jpeg', 'https://trello.com/1/cards/6a1ddd266685a40dc4a62e3f/attachments/6a1ddd276685a40dc4a62e92/download/WhatsApp_Image_2025-11-21_at_19.24.08_(1).jpeg', 157448, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- Ivan junior Coimbra da Silva
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'Ivan junior Coimbra da Silva' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('Ivan junior Coimbra da Silva', '', '18501609617', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', '') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1ddd4db3f7fb8e46d78bdc/attachments/6a1ddd4eb3f7fb8e46d78cbe/download/WhatsApp_Image_2025-11-21_at_19.24.08_(2).jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2025-11-21 at 19.24.08 (2).jpeg', 'https://trello.com/1/cards/6a1ddd4db3f7fb8e46d78bdc/attachments/6a1ddd4eb3f7fb8e46d78cbe/download/WhatsApp_Image_2025-11-21_at_19.24.08_(2).jpeg', 98552, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- Richard Gabriel Antonio flores
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'Richard Gabriel Antonio flores' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('Richard Gabriel Antonio flores', '', '16639285681', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', '') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1ddd6156296871500d7876/attachments/6a1ddd6156296871500d78cb/download/WhatsApp_Image_2025-11-21_at_19.24.08_(3).jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2025-11-21 at 19.24.08 (3).jpeg', 'https://trello.com/1/cards/6a1ddd6156296871500d7876/attachments/6a1ddd6156296871500d78cb/download/WhatsApp_Image_2025-11-21_at_19.24.08_(3).jpeg', 125251, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- GUILHERME DE OLIVEIRA SANTOS
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'GUILHERME DE OLIVEIRA SANTOS' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('GUILHERME DE OLIVEIRA SANTOS', '', '25367758', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', 'THIAGO ALEXANDRE NUNES DA SILVA
21867058

Ladrão de correntinha') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1ddd79ebb4bda5af7d08b8/attachments/6a1ddd79ebb4bda5af7d090e/download/WhatsApp_Image_2025-11-21_at_19.24.08_(4).jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2025-11-21 at 19.24.08 (4).jpeg', 'https://trello.com/1/cards/6a1ddd79ebb4bda5af7d08b8/attachments/6a1ddd79ebb4bda5af7d090e/download/WhatsApp_Image_2025-11-21_at_19.24.08_(4).jpeg', 260831, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- THIAGO ALEXANDRE NUNES DA SILVA
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'THIAGO ALEXANDRE NUNES DA SILVA' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('THIAGO ALEXANDRE NUNES DA SILVA', '', '21867058', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', 'THIAGO ALEXANDRE NUNES DA SILVA
21867058

Ladrão de correntinha') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1dddae8840f57178eff993/attachments/6a1dddae8840f57178eff9ea/download/WhatsApp_Image_2025-11-21_at_19.24.08_(5).jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2025-11-21 at 19.24.08 (5).jpeg', 'https://trello.com/1/cards/6a1dddae8840f57178eff993/attachments/6a1dddae8840f57178eff9ea/download/WhatsApp_Image_2025-11-21_at_19.24.08_(5).jpeg', 263164, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- Bryan de Souza Soares
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'Bryan de Souza Soares' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('Bryan de Souza Soares', '', '15487876630', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', '') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1dddd6d185b36158a8c54e/attachments/6a1dddd6d185b36158a8c5a6/download/WhatsApp_Image_2025-11-21_at_19.24.08_(6).jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2025-11-21 at 19.24.08 (6).jpeg', 'https://trello.com/1/cards/6a1dddd6d185b36158a8c54e/attachments/6a1dddd6d185b36158a8c5a6/download/WhatsApp_Image_2025-11-21_at_19.24.08_(6).jpeg', 164184, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- LEONARDO FARIA MARTINS
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'LEONARDO FARIA MARTINS' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('LEONARDO FARIA MARTINS', '', '16157555602', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', '') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1dde073df480474e12f03b/attachments/6a1dde073df480474e12f094/download/WhatsApp_Image_2025-11-28_at_16.07.06.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2025-11-28 at 16.07.06.jpeg', 'https://trello.com/1/cards/6a1dde073df480474e12f03b/attachments/6a1dde073df480474e12f094/download/WhatsApp_Image_2025-11-28_at_16.07.06.jpeg', 37924, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- MATHEUS GABRIEL NUNES DOS SANTOS
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'MATHEUS GABRIEL NUNES DOS SANTOS' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('MATHEUS GABRIEL NUNES DOS SANTOS', '', '', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', '') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1dde281e822197d4b57878/attachments/6a1dde291e822197d4b57955/download/WhatsApp_Image_2025-11-28_at_16.07.32.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2025-11-28 at 16.07.32.jpeg', 'https://trello.com/1/cards/6a1dde281e822197d4b57878/attachments/6a1dde291e822197d4b57955/download/WhatsApp_Image_2025-11-28_at_16.07.32.jpeg', 33851, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- EDUARDO FELIPE MENDES DAMASCENO
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'EDUARDO FELIPE MENDES DAMASCENO' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('EDUARDO FELIPE MENDES DAMASCENO', '', '21612503', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', '') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1ddea39fff9e8e92973eca/attachments/6a1ddea39fff9e8e92973f25/download/WhatsApp_Image_2025-11-29_at_09.09.12.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2025-11-29 at 09.09.12.jpeg', 'https://trello.com/1/cards/6a1ddea39fff9e8e92973eca/attachments/6a1ddea39fff9e8e92973f25/download/WhatsApp_Image_2025-11-29_at_09.09.12.jpeg', 126213, 'image/jpeg', 'Importado do Trello');
  END IF;

  -- VINICIUS CESAR DE ANDRADE
  v_author_id := NULL;
  SELECT id INTO v_author_id FROM crime_authors WHERE name = 'VINICIUS CESAR DE ANDRADE' AND folder_id = v_folder_id LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO crime_authors (name, alias, document, crimes, folder_id, status, risk_level, notes)
    VALUES ('VINICIUS CESAR DE ANDRADE', '', '24201113', 'Furto de correntinha/celular/arrombamento/roubo', v_folder_id, 'Suspeito', 'Médio', '') RETURNING id INTO v_author_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM author_photos WHERE author_id = v_author_id AND file_path = 'https://trello.com/1/cards/6a1ddec61ba8492df2e1bd59/attachments/6a1ddec71ba8492df2e1bdb5/download/WhatsApp_Image_2025-11-29_at_09.13.48.jpeg') THEN
    INSERT INTO author_photos (author_id, file_name, file_path, file_size, mime_type, description)
    VALUES (v_author_id, 'WhatsApp Image 2025-11-29 at 09.13.48.jpeg', 'https://trello.com/1/cards/6a1ddec61ba8492df2e1bd59/attachments/6a1ddec71ba8492df2e1bdb5/download/WhatsApp_Image_2025-11-29_at_09.13.48.jpeg', 168572, 'image/jpeg', 'Importado do Trello');
  END IF;

END $$;

NOTIFY pgrst, 'reload schema';
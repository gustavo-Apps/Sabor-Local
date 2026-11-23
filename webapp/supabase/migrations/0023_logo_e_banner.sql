-- Logo e banner da loja. Os arquivos ficam no bucket `cardapios`, na pasta do dono (<user_id>/...),
-- com as mesmas regras de isolamento do cardápio. Aqui só se guarda o endereço.

alter table vendedores
  add column logo_url text,
  add column banner_url text,
  -- só aceita endereço de arquivo do nosso próprio Storage (nunca um site de fora)
  add constraint vendedores_logo_url_ok
    check (logo_url is null or (char_length(logo_url) <= 500 and logo_url like '%/storage/v1/object/public/cardapios/%')),
  add constraint vendedores_banner_url_ok
    check (banner_url is null or (char_length(banner_url) <= 500 and banner_url like '%/storage/v1/object/public/cardapios/%'));

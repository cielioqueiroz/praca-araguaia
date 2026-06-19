-- Idempotência do backfill: impede pontos duplicados por dia/tipo.
alter table cotacoes_historico
  add constraint cotacoes_historico_tipo_data_unq unique (tipo, data_referencia);
